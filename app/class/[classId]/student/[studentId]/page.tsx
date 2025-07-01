'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, Student, Relationship, Question, Answer } from '@/lib/supabase';
import { RELATIONSHIP_TYPES, RELATIONSHIP_COLORS } from '@/lib/constants';
import ConfirmModal from '@/components/ConfirmModal';
import { ArrowUturnLeftIcon, PlusIcon, TrashIcon, ExclamationCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { handleDemoSaveAttempt, isDemoClass } from '@/utils/demo-permissions';
import { useAutoSave } from '@/hooks/useAutoSave';

// 학생 데이터 타입 (간단 버전)
type TargetStudent = Pick<Student, 'id' | 'name'>; // 성별 등 추가 정보 필요 시 확장

// 관계 설정 데이터 타입
type RelationshipSetting = {
    [targetStudentId: string]: keyof typeof RELATIONSHIP_TYPES | null;
};

// 답변 데이터 타입
type AnswerSetting = {
    [questionId: string]: string;
};

// Student 타입에 gender 추가 (Supabase 스키마에 gender 컬럼 필요)
// 타입을 lib/supabase.ts 와 일치시킴 (소문자 사용)
type CurrentStudentData = Student & { gender?: 'male' | 'female' | null };

// --- 데이터 Fetching 함수 ---

// 🆕 학급 정보 조회 함수 추가
async function fetchClassDetails(classId: string) {
    const { data, error } = await (supabase as any)
        .from('classes')
        .select('*')
        .eq('id', classId)
        .single();
    if (error) { console.error('Error fetching class:', error); return null; }
    return data;
}

async function fetchCurrentStudent(studentId: string): Promise<CurrentStudentData | null> {
    const { data, error } = await (supabase as any)
        .from('students')
        .select('*, gender') // gender 필드 조회 추가
        .eq('id', studentId)
        .single();
    if (error) { console.error('Error fetching current student:', error); return null; }
    return data;
}

// 이름순 대신 생성순으로 모든 학생 조회하는 함수로 변경
async function fetchAllStudentsOrdered(classId: string): Promise<Student[]> { // TargetStudent 대신 Student 사용 (created_at 필요)
    const { data, error } = await (supabase as any)
        .from('students')
        // Student 타입에 필요한 모든 필수 필드 선택
        .select('id, name, class_id, created_at, gender, position_x, position_y') // 필요한 모든 필드 명시 (Student 타입 기준)
        .eq('class_id', classId)
        .order('created_at'); // 생성 시간 순서로 변경
    if (error) { console.error('Error fetching all students:', error); return []; }
    // 반환되는 데이터는 Student[] 타입과 호환됨
    return (data as Student[]) || []; // 타입 단언 추가
}

async function fetchExistingRelationships(studentId: string): Promise<RelationshipSetting> {
    const { data, error } = await (supabase as any)
        .from('relations')
        .select('to_student_id, relation_type')
        .eq('from_student_id', studentId);
    if (error) { console.error('Error fetching relationships:', error); return {}; }

    const settings: RelationshipSetting = {};
    data.forEach((rel: any) => {
        settings[rel.to_student_id] = rel.relation_type as keyof typeof RELATIONSHIP_TYPES;
    });
    return settings;
}

async function fetchQuestions(classId: string): Promise<Question[]> {
    const { data, error } = await (supabase as any).from('questions').select('*').eq('class_id', classId).order('created_at');
    if (error) { console.error("Error fetching questions:", error); return []; }
    return data;
}

async function fetchAnswers(studentId: string): Promise<AnswerSetting> {
    const { data, error } = await (supabase as any).from('answers').select('question_id, answer_text').eq('student_id', studentId);
    if (error) { console.error("Error fetching answers:", error); return {}; }

    const settings: AnswerSetting = {};
    data.forEach((ans: any) => {
        settings[ans.question_id] = ans.answer_text;
    });
    return settings;
}

// --- 데이터 저장/수정/삭제 함수 ---

// 관계 및 답변 저장 (null 관계 삭제 포함)
async function saveAllSettings(
    studentId: string,
    classId: string, // classId 추가
    relationships: RelationshipSetting,
    answers: AnswerSetting,
    initialRelationships: RelationshipSetting, // 초기 관계 데이터 추가
    classData?: any // 🆕 학급 데이터 추가
): Promise<void> {
    // 🌟 데모 학급 권한 체크
    if (classData && isDemoClass(classData)) {
        const saveAttempt = handleDemoSaveAttempt(classData, "관계 설정 변경사항");
        if (!saveAttempt.canSave) {
            // 데모 학급에서는 저장하지 않고 메시지만 표시
            toast.success(saveAttempt.message || "체험판에서는 저장되지 않습니다.", {
                duration: 4000,
                style: {
                    background: '#3B82F6',
                    color: 'white',
                    padding: '16px',
                    fontSize: '14px',
                    lineHeight: '1.5',
                    whiteSpace: 'pre-line'
                }
            });
            return; // 실제 저장하지 않고 종료
        }
    }

    // const queryClient = useQueryClient(); // 캐시 무효화는 onSuccess에서 처리

    // 1. 관계 저장/삭제
    const currentRelationshipTargets = Object.keys(relationships);
    const initialRelationshipTargets = Object.keys(initialRelationships);

    const relationshipsToUpsert = currentRelationshipTargets
        .filter(targetId => relationships[targetId] !== null && relationships[targetId] !== initialRelationships[targetId])
        .map(targetId => ({
            from_student_id: studentId,
            to_student_id: targetId,
            relation_type: relationships[targetId] as keyof typeof RELATIONSHIP_TYPES,
        }));

    const relationshipsToDelete = initialRelationshipTargets
        .filter(targetId => relationships[targetId] === null && initialRelationships[targetId] !== null);

    // Upsert 실행
    if (relationshipsToUpsert.length > 0) {
        const { error: upsertError } = await (supabase as any).from('relations').upsert(relationshipsToUpsert, {
            onConflict: 'from_student_id, to_student_id',
        });
        if (upsertError) throw new Error(`관계 저장 실패: ${upsertError.message}`);
    }

    // Delete 실행
    if (relationshipsToDelete.length > 0) {
        const { error: deleteError } = await (supabase as any)
            .from('relations')
            .delete()
            .eq('from_student_id', studentId)
            .in('to_student_id', relationshipsToDelete);
        if (deleteError) throw new Error(`관계 삭제 실패: ${deleteError.message}`);
    }

    // 2. 답변 저장
    const answerUpserts = Object.entries(answers).map(([questionId, text]) => ({
        student_id: studentId,
        question_id: questionId,
        answer_text: text,
    }));
    if (answerUpserts.length > 0) {
        const { error: ansError } = await (supabase as any).from('answers').upsert(answerUpserts, {
            onConflict: 'student_id, question_id',
        });
        if (ansError) throw new Error(`답변 저장 실패: ${ansError.message}`);
    }

    // 캐시 무효화는 onSuccess 핸들러에서 처리
}

async function addQuestion(classId: string, questionText: string): Promise<Question> {
    const { data, error } = await (supabase as any)
        .from('questions')
        .insert([{ class_id: classId, question_text: questionText.trim() }])
        .select()
        .single();
    if (error) throw new Error(`질문 추가 실패: ${error.message}`);
    return data;
}

// 질문 및 관련 답변 모두 삭제 (주의! RPC 함수로 만드는 것이 더 안전하고 효율적일 수 있음)
async function deleteQuestionAndAnswers(questionId: string): Promise<void> {
    // 1. 해당 질문에 대한 모든 답변 삭제
    const { error: ansError } = await (supabase as any).from('answers').delete().eq('question_id', questionId);
    if (ansError) throw new Error(`답변 삭제 실패: ${ansError.message}`);

    // 2. 질문 삭제
    const { error: qError } = await (supabase as any).from('questions').delete().eq('id', questionId);
    if (qError) throw new Error(`질문 삭제 실패: ${qError.message}`);
}

// 학생 성별 업데이트 함수 수정
async function updateStudentGender(studentId: string, gender: 'male' | 'female' | null): Promise<void> {
    // DB에 저장하기 전에 소문자로 변환 (또는 DB 제약조건에 맞는 다른 값으로)
    const valueToSave = gender ? gender.toLowerCase() : null;
    const { error } = await (supabase as any)
        .from('students')
        .update({ gender: valueToSave }) // 소문자 또는 null 값으로 업데이트
        .eq('id', studentId);
    if (error) throw new Error(`성별 업데이트 실패: ${error.message}`);
}

export default function StudentRelationshipEditorPage() {
    const params = useParams();
    const router = useRouter();
    const queryClient = useQueryClient();
    const classId = params.classId as string;
    const studentId = params.studentId as string;

    // --- 상태 관리 ---
    const [relationshipSettings, setRelationshipSettings] = useState<RelationshipSetting>({});
    const [answerSettings, setAnswerSettings] = useState<AnswerSetting>({});
    const [newQuestionText, setNewQuestionText] = useState('');
    const [questionToDelete, setQuestionToDelete] = useState<Question | null>(null);
    const [initialRelationshipsData, setInitialRelationshipsData] = useState<RelationshipSetting>({}); // 초기 관계 데이터 저장용
    const [selectedGender, setSelectedGender] = useState<'male' | 'female' | null>(null); // 성별 상태 추가
    const [initialGender, setInitialGender] = useState<'male' | 'female' | null>(null); // 초기 성별 저장용

    // --- 데이터 조회 Queries ---
    
    // 🆕 학급 정보 조회
    const { data: classDetails } = useQuery({
        queryKey: ['classDetails', classId],
        queryFn: () => fetchClassDetails(classId),
        enabled: !!classId,
    });

    const { data: currentStudent, isLoading: isLoadingStudent } = useQuery<CurrentStudentData | null, Error>({
        queryKey: ['student', studentId],
        queryFn: () => fetchCurrentStudent(studentId),
        enabled: !!studentId,
    });

    // otherStudents 대신 allStudentsOrdered 조회
    const { data: allStudents, isLoading: isLoadingAllStudents } = useQuery<Student[], Error>({
        queryKey: ['allStudentsOrdered', classId], // 쿼리 키 변경
        queryFn: () => fetchAllStudentsOrdered(classId), // 새 함수 사용
        enabled: !!classId,
    });

    // allStudents에서 현재 학생 제외하여 otherStudents 생성
    const otherStudents = useMemo(() => {
        if (!allStudents) return [];
        return allStudents.filter(student => student.id !== studentId);
    }, [allStudents, studentId]);

    const { data: initialRelationships, isLoading: isLoadingRels } = useQuery<RelationshipSetting, Error>({
        queryKey: ['relations', studentId, 'settings'],
        queryFn: () => fetchExistingRelationships(studentId),
        enabled: !!studentId,
    });

    const { data: questions, isLoading: isLoadingQuestions } = useQuery<Question[], Error>({
        queryKey: ['questions', classId],
        queryFn: () => fetchQuestions(classId),
        enabled: !!classId,
    });

    const { data: initialAnswers, isLoading: isLoadingAnswers } = useQuery<AnswerSetting, Error>({
        queryKey: ['answers', studentId, 'settings'],
        queryFn: () => fetchAnswers(studentId),
        enabled: !!studentId,
    });

    // --- 데이터 로딩 및 상태 초기화 ---
    useEffect(() => {
        if (currentStudent) {
            const genderFromDB = currentStudent.gender; // 'male' | 'female' | null | undefined

            // genderFromDB 값이 'male' 또는 'female'인지 확인 후 그대로 상태에 저장
            let genderForState: 'male' | 'female' | null = null;
            if (genderFromDB === 'male' || genderFromDB === 'female') {
                genderForState = genderFromDB; // toUpperCase() 제거, 소문자 그대로 사용
            }

            console.log("Fetched student gender:", genderFromDB);
            console.log("Setting state gender to:", genderForState); // 소문자 또는 null

            setSelectedGender(genderForState);
            setInitialGender(genderForState);
        } else {
             setSelectedGender(null);
             setInitialGender(null);
        }
    }, [currentStudent]);

    useEffect(() => {
        if (initialRelationships != null && typeof initialRelationships === 'object') {
            setRelationshipSettings(initialRelationships);
            setInitialRelationshipsData(initialRelationships);
        }
    }, [initialRelationships]);

    useEffect(() => {
        if (initialAnswers != null && typeof initialAnswers === 'object') {
            setAnswerSettings(initialAnswers);
        }
    }, [initialAnswers]);

    // --- 데이터 변경 Mutations ---
    const saveSettingsMutation = useMutation<void, Error, void>({
        mutationFn: () => saveAllSettings(studentId, classId, relationshipSettings, answerSettings, initialRelationshipsData, classDetails),
        onSuccess: () => {
            // 🌟 데모 학급인 경우 "저장되었습니다" 메시지 표시하지 않음
            if (classDetails && !isDemoClass(classDetails)) {
                toast.success('설정이 저장되었습니다.');
            }
            router.push(`/class/${classId}`); // 관계도 페이지로 이동
        },
        onError: (error) => {
            toast.error(`저장 실패: ${error.message}`);
        }
    });

    const addQuestionMutation = useMutation<Question, Error, string>({
        mutationFn: (questionText) => addQuestion(classId, questionText),
        onSuccess: (newQuestion) => {
            queryClient.invalidateQueries({ queryKey: ['questions', classId] });
            setNewQuestionText(''); // 입력 필드 초기화
            toast.success(`'${newQuestion.question_text}' 질문이 추가되었습니다.`);
        },
        onError: (error) => {
            toast.error(`질문 추가 실패: ${error.message}`);
        }
    });

    const deleteQuestionMutation = useMutation<void, Error, string>({
        mutationFn: (questionId) => deleteQuestionAndAnswers(questionId),
        onSuccess: (data, questionId) => {
            queryClient.invalidateQueries({ queryKey: ['questions', classId] });
            queryClient.invalidateQueries({ queryKey: ['answers'] }); // 전체 답변 캐시 무효화
            setQuestionToDelete(null);
            // 상태 업데이트: 로컬 상태에서도 해당 질문/답변 제거
            setAnswerSettings(prev => {
                const newAnswers = { ...prev };
                delete newAnswers[questionId];
                return newAnswers;
            });
            toast.success('질문 및 관련 답변이 삭제되었습니다.');
        },
        onError: (error) => {
            toast.error(`질문 삭제 실패: ${error.message}`);
            setQuestionToDelete(null); // 실패 시에도 모달은 닫는 것이 좋을 수 있음
        }
    });

    // 성별 업데이트 Mutation 추가
    const updateStudentGenderMutation = useMutation<void, Error, {"gender": 'male' | 'female' | null}>({
        mutationFn: ({ gender }) => updateStudentGender(studentId, gender),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['student', studentId] });
        },
        onError: (error) => {
            toast.error(`성별 업데이트 실패: ${error.message}`);
        }
    });

    // --- 자동저장 훅 설정 ---
    const { autoSave: autoSaveRelationships, immediateeSave: immediateSaveRelationships } = useAutoSave({
        delay: 1000, // 1초 지연
        onSave: useCallback(async () => {
            if (classDetails && isDemoClass(classDetails)) {
                // 데모 학급에서는 저장 안함
                return;
            }
            try {
                await saveAllSettings(studentId, classId, relationshipSettings, answerSettings, initialRelationshipsData, classDetails);
                console.log('관계 설정 자동저장 완료');
            } catch (error) {
                console.error('관계 설정 자동저장 실패:', error);
            }
        }, [studentId, classId, relationshipSettings, answerSettings, initialRelationshipsData, classDetails]),
    });

    const { autoSave: autoSaveAnswers, immediateeSave: immediateSaveAnswers } = useAutoSave({
        delay: 2000, // 2초 지연
        onSave: useCallback(async () => {
            if (classDetails && isDemoClass(classDetails)) {
                // 데모 학급에서는 저장 안함
                return;
            }
            try {
                await saveAllSettings(studentId, classId, relationshipSettings, answerSettings, initialRelationshipsData, classDetails);
                console.log('답변 자동저장 완료');
            } catch (error) {
                console.error('답변 자동저장 실패:', error);
            }
        }, [studentId, classId, relationshipSettings, answerSettings, initialRelationshipsData, classDetails]),
    });

    // 페이지를 떠나기 전 즉시 저장 처리
    useEffect(() => {
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            // 변경사항이 있으면 즉시 저장
            if (classDetails && !isDemoClass(classDetails)) {
                // 동기적으로 저장 시도 (beforeunload에서는 비동기 호출이 제한적)
                immediateSaveRelationships({ ...relationshipSettings });
                immediateSaveAnswers({ ...answerSettings });
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [relationshipSettings, answerSettings, classDetails, immediateSaveRelationships, immediateSaveAnswers]);

    // --- 핸들러 함수들 ---
    const handleRelationshipChange = (targetId: string, type: keyof typeof RELATIONSHIP_TYPES | null) => {
        const newSettings = { ...relationshipSettings, [targetId]: type };
        setRelationshipSettings(newSettings);
        autoSaveRelationships(newSettings); // 관계 변경 시 자동저장 트리거
    };

    const handleAnswerChange = (questionId: string, text: string) => {
        const newAnswers = { ...answerSettings, [questionId]: text };
        setAnswerSettings(newAnswers);
        autoSaveAnswers(newAnswers); // 답변 변경 시 자동저장 트리거
    };

    const handleAddQuestion = () => {
        if (newQuestionText.trim()) {
            addQuestionMutation.mutate(newQuestionText.trim());
        }
    };

    // Enter 키 핸들러 추가
    const handleAddQuestionKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            handleAddQuestion();
        }
    };

    const handleDeleteQuestionClick = (question: Question) => {
        setQuestionToDelete(question);
    };

    const confirmDeleteQuestion = () => {
        if (!questionToDelete) return;

        deleteQuestionMutation.mutate(questionToDelete.id, {
            onSuccess: () => {
                setQuestionToDelete(null); // 삭제 확인 모달 닫기
                queryClient.invalidateQueries({ queryKey: ['questions', classId] });
            },
            onError: (error) => {
                console.error("Failed to delete question:", error);
            }
        });
    };

    // 돌아가기 핸들러 수정 (즉시 저장 추가)
    const handleGoBack = async () => {
        try {
            // 0. 자동저장 대기 중인 내용 즉시 저장
            if (classDetails && !isDemoClass(classDetails)) {
                await immediateSaveRelationships({ ...relationshipSettings });
                await immediateSaveAnswers({ ...answerSettings });
            }

            // 1. 관계/답변 저장 먼저 실행
            await saveSettingsMutation.mutateAsync();

            // 2. 성별 변경 시 성별 업데이트 실행 (MALE 또는 FEMALE일 때만)
            if (selectedGender !== initialGender && (selectedGender === 'male' || selectedGender === 'female')) {
                await updateStudentGenderMutation.mutateAsync({ gender: selectedGender });
            }
            // 참고: 만약 성별을 null로 되돌리는 기능이 필요하고 DB 제약조건이 NULL을 허용한다면,
            // else if (selectedGender !== initialGender && selectedGender === null) {
            //     await updateStudentGenderMutation.mutateAsync({ gender: null });
            // }

            // 모든 저장이 성공하면 페이지 이동
            router.push(`/class/${classId}`);
        } catch (error) {
            console.error("저장 중 오류 발생:", error);
        }
    };

    // --- 로딩 / 에러 처리 ---
    const isLoading = isLoadingStudent || isLoadingAllStudents || isLoadingRels || isLoadingQuestions || isLoadingAnswers || saveSettingsMutation.isPending || addQuestionMutation.isPending || deleteQuestionMutation.isPending || updateStudentGenderMutation.isPending;

    if (!studentId || !classId) {
        return <div>잘못된 접근입니다.</div>; // ID가 없는 경우
    }

    if (isLoading && !(saveSettingsMutation.isPending || addQuestionMutation.isPending || deleteQuestionMutation.isPending || updateStudentGenderMutation.isPending)) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-50">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    // TODO: Query 에러 처리 UI 개선 필요
    if (!currentStudent) {
        return <div>학생 정보를 불러올 수 없습니다.</div>;
    }

    return (
        <div className="min-h-screen bg-white p-6">
            <div className="max-w-6xl mx-auto">
                <header className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
                    <div className="flex items-center gap-4">
                        <h1 className="text-xl font-bold text-gray-800">
                            {currentStudent.name}의 관계 설정
                        </h1>
                        {/* 성별 선택 버튼 그룹 */}
                        <div className="flex items-center space-x-1 bg-gray-100 p-0.5 rounded-lg">
                            <button
                                onClick={() => setSelectedGender('male')}
                                className={`px-3 py-1 text-xs rounded-md transition-colors duration-150 ${selectedGender === 'male' ? 'bg-[#6366f1] text-white shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                남학생
                            </button>
                            <button
                                onClick={() => setSelectedGender('female')}
                                className={`px-3 py-1 text-xs rounded-md transition-colors duration-150 ${selectedGender === 'female' ? 'bg-[#6366f1] text-white shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                여학생
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={handleGoBack}
                        disabled={saveSettingsMutation.isPending || updateStudentGenderMutation.isPending} // 성별 저장 중에도 비활성화
                        className="px-4 py-2 text-sm bg-[#6366f1] text-white rounded-lg hover:bg-[#4f46e5] transition-colors duration-200 font-semibold flex items-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {(saveSettingsMutation.isPending || updateStudentGenderMutation.isPending) ? (
                           <svg className="animate-spin -ml-1 mr-1 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                               <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                               <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                           </svg>
                        ) : <ArrowUturnLeftIcon className="w-4 h-4" />}
                        {(saveSettingsMutation.isPending || updateStudentGenderMutation.isPending) ? '저장중...' : '돌아가기'}
                    </button>
                </header>

                <div className="mb-8 bg-white p-4 rounded-xl shadow-md">
                    {/* otherStudents가 useMemo로 생성되었으므로 로딩 상태 추가 확인 */}
                    {isLoadingAllStudents ? (
                       <div className="text-center text-gray-500 py-4">학생 목록 로딩 중...</div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {otherStudents && otherStudents.length > 0 ? (
                              otherStudents.map(target => { // 이제 otherStudents는 created_at 순서
                                  const currentRelation = relationshipSettings[target.id] || null;
                                  return (
                                      <div key={target.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex flex-col justify-between">
                                          <p className="font-semibold text-center mb-3 text-black truncate" title={target.name}>{target.name || `학생 ${target.id.substring(0, 4)}`}</p>
                                          <div className="flex justify-center gap-1.5">
                                              {/* 새 4가지 관계 유형 버튼 */}
                                              {(Object.keys(RELATIONSHIP_TYPES) as Array<keyof typeof RELATIONSHIP_TYPES>).map(type => {
                                                  const isSelected = currentRelation === type;
                                                  const bgColor = isSelected ? RELATIONSHIP_COLORS[type] : '#f3f4f6'; // 미선택 시 연한 회색 (bg-gray-100)
                                                  const textColor = isSelected ? 'text-white' : 'text-gray-600';
                                                  const hoverEffect = isSelected ? `hover:brightness-110` : `hover:bg-gray-200`;

                                                  return (
                                                      <button
                                                          key={type}
                                                          onClick={() => handleRelationshipChange(target.id, isSelected ? null : type)}
                                                          className={`px-3 py-1 text-xs rounded-md transition-all duration-150 ${hoverEffect} ${textColor} ${isSelected ? '' : 'border border-gray-200'}`}
                                                          style={{ backgroundColor: bgColor }}
                                                      >
                                                          {RELATIONSHIP_TYPES[type]}
                                                      </button>
                                                  );
                                              })}
                                          </div>
                                      </div>
                                  );
                              })
                          ) : (
                              <p className="text-gray-500 italic col-span-full text-center py-4">같은 반에 다른 학생이 없습니다.</p>
                          )}
                      </div>
                    )}
                </div>

                <div className="mb-8 bg-white p-4 rounded-xl shadow-md">
                    <h2 className="text-lg font-semibold mb-3 text-[#6366f1] border-b pb-2">주관식 질문 추가</h2>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newQuestionText}
                            onChange={(e) => setNewQuestionText(e.target.value)}
                            onKeyPress={handleAddQuestionKeyPress}
                            placeholder="새로운 주관식 질문을 입력하세요"
                            className="flex-grow min-w-0 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#6366f1] text-sm text-black placeholder:text-gray-500"
                            disabled={addQuestionMutation.isPending}
                        />
                        <button
                            onClick={handleAddQuestion}
                            disabled={!newQuestionText.trim() || addQuestionMutation.isPending}
                            className="px-4 py-2 text-sm bg-[#6366f1] text-white rounded-lg hover:bg-[#4f46e5] disabled:opacity-60 transition-colors duration-200 flex-shrink-0 flex items-center gap-1"
                        >
                            {addQuestionMutation.isPending ? '추가중...' : '추가'}
                        </button>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-md">
                    <h2 className="text-lg font-semibold mb-3 text-[#6366f1] border-b pb-2">주관식 내용 입력</h2>
                    {questions && questions.length > 0 ? (
                        <div className="space-y-4">
                            {questions.map((q) => (
                                <div key={q.id}>
                                    <div className="flex justify-between items-center mb-1.5">
                                        <label htmlFor={`answer-${q.id}`} className="block text-sm font-medium text-gray-700">
                                            {q.question_text}
                                        </label>
                                        <button
                                            onClick={() => handleDeleteQuestionClick(q)}
                                            disabled={deleteQuestionMutation.isPending && questionToDelete?.id === q.id}
                                            className="text-xs text-red-600 bg-red-100 hover:bg-red-200 px-2 py-1 rounded-md disabled:opacity-50 transition-colors duration-150 flex items-center gap-0.5"
                                            title="질문 삭제"
                                        >
                                            <TrashIcon className="w-3 h-3" /> 삭제
                                        </button>
                                    </div>
                                    <textarea
                                        id={`answer-${q.id}`}
                                        rows={3}
                                        value={answerSettings[q.id] || ''}
                                        onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                        placeholder="답변을 입력하세요..."
                                        className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#6366f1] text-sm text-black placeholder:text-gray-500 resize-none"
                                    />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500 italic text-center py-4">등록된 주관식 질문이 없습니다.</p>
                    )}
                </div>

                <div className="mt-8 flex justify-center">
                    <button
                        onClick={handleGoBack}
                        disabled={saveSettingsMutation.isPending || updateStudentGenderMutation.isPending}
                        className="px-6 py-3 text-base bg-[#6366f1] text-white rounded-lg hover:bg-[#4f46e5] transition-colors duration-200 font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {(saveSettingsMutation.isPending || updateStudentGenderMutation.isPending) ? '저장중...' : '돌아가기'}
                    </button>
                </div>

                {questionToDelete && (
                    <ConfirmModal
                        isOpen={!!questionToDelete}
                        onClose={() => setQuestionToDelete(null)}
                        onConfirm={confirmDeleteQuestion}
                        title="질문 삭제 확인"
                        message={`'${questionToDelete.question_text}' 질문과 이 질문에 대한 모든 학생들의 답변을 삭제하시겠습니까?`}
                        confirmText="삭제"
                    />
                )}
            </div>
        </div>
    );
}
