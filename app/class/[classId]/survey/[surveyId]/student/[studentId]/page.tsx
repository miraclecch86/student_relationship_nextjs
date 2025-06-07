"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, Student, Relationship, Question, Answer } from "@/lib/supabase";
import { RELATIONSHIP_TYPES, RELATIONSHIP_COLORS } from "@/lib/constants";
import ConfirmModal from "@/components/ConfirmModal";
import { PlusIcon, TrashIcon, ExclamationCircleIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import { handleDemoSaveAttempt, isDemoClass } from "@/utils/demo-permissions";
import { useAutoSave } from "@/hooks/useAutoSave";

// 타입 정의
type RelationshipSetting = { [targetStudentId: string]: keyof typeof RELATIONSHIP_TYPES | null };
type AnswerSetting = { [questionId: string]: string };
type CurrentStudentData = Student & { gender?: 'male' | 'female' | null };

// --- 데이터 Fetching 함수 (surveyId 반영) ---
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
        .select('*, gender')
        .eq('id', studentId)
        .single();
    if (error) { console.error('Error fetching current student:', error); return null; }
    return data;
}

async function fetchAllStudentsOrdered(classId: string): Promise<Student[]> {
    const { data, error } = await (supabase as any)
        .from('students')
        .select('id, name, class_id, created_at, gender, position_x, position_y')
        .eq('class_id', classId)
        .order('created_at');
    if (error) { console.error('Error fetching all students:', error); return []; }
    return (data as Student[]) || [];
}

async function fetchExistingRelationships(studentId: string, surveyId: string): Promise<RelationshipSetting> {
    const { data, error } = await (supabase as any)
        .from('relations')
        .select('to_student_id, relation_type')
        .eq('from_student_id', studentId)
        .eq('survey_id', surveyId);
    if (error) { console.error('Error fetching relationships:', error); return {}; }
    const settings: RelationshipSetting = {};
    data.forEach((rel: any) => {
        settings[rel.to_student_id] = rel.relation_type as keyof typeof RELATIONSHIP_TYPES;
    });
    return settings;
}

async function fetchQuestions(classId: string, surveyId: string): Promise<Question[]> {
    const { data, error } = await (supabase as any)
        .from('questions')
        .select('*')
        .eq('class_id', classId)
        .eq('survey_id', surveyId)
        .order('created_at');
    if (error) { console.error("Error fetching questions:", error); return []; }
    return data;
}

async function fetchAnswers(studentId: string, surveyId: string): Promise<AnswerSetting> {
    const { data, error } = await (supabase as any).from('answers').select('question_id, answer_text').eq('student_id', studentId).eq('survey_id', surveyId);
    if (error) { console.error("Error fetching answers:", error); return {}; }
    const settings: AnswerSetting = {};
    data.forEach((ans: any) => {
        settings[ans.question_id] = ans.answer_text;
    });
    return settings;
}

// --- 데이터 저장/수정/삭제 함수 (surveyId 반영) ---
async function saveAllSettings(
    studentId: string,
    classId: string,
    surveyId: string,
    relationships: RelationshipSetting,
    answers: AnswerSetting,
    initialRelationships: RelationshipSetting,
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

    // 1. 관계 저장/삭제
    const currentRelationshipTargets = Object.keys(relationships);
    const initialRelationshipTargets = Object.keys(initialRelationships);
    const relationshipsToUpsert = currentRelationshipTargets
        .filter(targetId => relationships[targetId] !== null && relationships[targetId] !== initialRelationships[targetId])
        .map(targetId => ({
            from_student_id: studentId,
            to_student_id: targetId,
            relation_type: relationships[targetId] as keyof typeof RELATIONSHIP_TYPES,
            survey_id: surveyId,
        }));
    const relationshipsToDelete = initialRelationshipTargets
        .filter(targetId => relationships[targetId] === null && initialRelationships[targetId] !== null);
    if (relationshipsToUpsert.length > 0) {
        const { error: upsertError } = await (supabase as any).from('relations').upsert(relationshipsToUpsert, {
            onConflict: 'from_student_id, to_student_id, survey_id',
        });
        if (upsertError) throw new Error(`관계 저장 실패: ${upsertError.message}`);
    }
    if (relationshipsToDelete.length > 0) {
        const { error: deleteError } = await (supabase as any)
            .from('relations')
            .delete()
            .eq('from_student_id', studentId)
            .eq('survey_id', surveyId)
            .in('to_student_id', relationshipsToDelete);
        if (deleteError) throw new Error(`관계 삭제 실패: ${deleteError.message}`);
    }
    // 2. 답변 저장
    const answerUpserts = Object.entries(answers).map(([questionId, text]) => ({
        student_id: studentId,
        question_id: questionId,
        answer_text: text,
        survey_id: surveyId,
    }));
    if (answerUpserts.length > 0) {
        const { error: ansError } = await (supabase as any).from('answers').upsert(answerUpserts, {
            onConflict: 'student_id, question_id, survey_id',
        });
        if (ansError) throw new Error(`답변 저장 실패: ${ansError.message}`);
    }
}

async function addQuestion(classId: string, surveyId: string, questionText: string): Promise<Question> {
    const { data, error } = await (supabase as any)
        .from('questions')
        .insert([{ class_id: classId, survey_id: surveyId, question_text: questionText.trim() }])
        .select()
        .single();
    if (error) throw new Error(`질문 추가 실패: ${error.message}`);
    return data;
}

async function deleteQuestionAndAnswers(questionId: string, surveyId: string): Promise<void> {
    // 1. 해당 질문에 대한 모든 답변 삭제 (해당 설문에 한정)
    const { error: ansError } = await (supabase as any).from('answers').delete().eq('question_id', questionId).eq('survey_id', surveyId);
    if (ansError) throw new Error(`답변 삭제 실패: ${ansError.message}`);
    // 2. 질문 삭제 (질문은 설문별이 아니므로 그대로)
    const { error: qError } = await (supabase as any).from('questions').delete().eq('id', questionId);
    if (qError) throw new Error(`질문 삭제 실패: ${qError.message}`);
}

async function updateStudentGender(studentId: string, gender: 'male' | 'female' | null): Promise<void> {
    const valueToSave = gender ? gender.toLowerCase() : null;
    const { error } = await (supabase as any)
        .from('students')
        .update({ gender: valueToSave })
        .eq('id', studentId);
    if (error) throw new Error(`성별 업데이트 실패: ${error.message}`);
}

export default function SurveyStudentDetailPage() {
    const params = useParams();
    const router = useRouter();
    const queryClient = useQueryClient();
    const classId = params.classId as string;
    const surveyId = params.surveyId as string;
    const studentId = params.studentId as string;

    // --- 상태 관리 ---
    const [relationshipSettings, setRelationshipSettings] = useState<RelationshipSetting>({});
    const [answerSettings, setAnswerSettings] = useState<AnswerSetting>({});
    const [newQuestionText, setNewQuestionText] = useState('');
    const [questionToDelete, setQuestionToDelete] = useState<Question | null>(null);
    const [initialRelationshipsData, setInitialRelationshipsData] = useState<RelationshipSetting>({});
    const [selectedGender, setSelectedGender] = useState<'male' | 'female' | null>(null);
    const [initialGender, setInitialGender] = useState<'male' | 'female' | null>(null);

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
    const { data: allStudents, isLoading: isLoadingAllStudents } = useQuery<Student[], Error>({
        queryKey: ['allStudentsOrdered', classId],
        queryFn: () => fetchAllStudentsOrdered(classId),
        enabled: !!classId,
    });
    const otherStudents = useMemo(() => {
        if (!allStudents) return [];
        return allStudents.filter(student => student.id !== studentId);
    }, [allStudents, studentId]);
    const { data: initialRelationships, isLoading: isLoadingRels } = useQuery<RelationshipSetting, Error>({
        queryKey: ['relations', studentId, surveyId, 'settings'],
        queryFn: () => fetchExistingRelationships(studentId, surveyId),
        enabled: !!studentId && !!surveyId,
    });
    const { data: questions, isLoading: isLoadingQuestions } = useQuery<Question[], Error>({
        queryKey: ['questions', classId, surveyId],
        queryFn: () => fetchQuestions(classId, surveyId),
        enabled: !!classId && !!surveyId,
    });
    const { data: initialAnswers, isLoading: isLoadingAnswers } = useQuery<AnswerSetting, Error>({
        queryKey: ['answers', studentId, surveyId, 'settings'],
        queryFn: () => fetchAnswers(studentId, surveyId),
        enabled: !!studentId && !!surveyId,
    });

    // --- 데이터 로딩 및 상태 초기화 ---
    useEffect(() => {
        if (currentStudent) {
            const genderFromDB = currentStudent.gender;
            let genderForState: 'male' | 'female' | null = null;
            if (genderFromDB === 'male' || genderFromDB === 'female') {
                genderForState = genderFromDB;
            }
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
        mutationFn: () => saveAllSettings(studentId, classId, surveyId, relationshipSettings, answerSettings, initialRelationshipsData, classDetails),
        onSuccess: () => {
            // 🌟 데모 학급인 경우 "저장되었습니다" 메시지 표시하지 않음
            if (classDetails && !isDemoClass(classDetails)) {
                toast.success('설정이 저장되었습니다.');
            }
        },
        onError: (error) => {
            toast.error(`저장 실패: ${error.message}`);
        }
    });
    const addQuestionMutation = useMutation<Question, Error, string>({
        mutationFn: (questionText) => addQuestion(classId, surveyId, questionText),
        onSuccess: (newQuestion) => {
            queryClient.invalidateQueries({ queryKey: ['questions', classId, surveyId] });
            setNewQuestionText('');
            toast.success(`'${newQuestion.question_text}' 질문이 추가되었습니다.`);
        },
        onError: (error) => {
            toast.error(`질문 추가 실패: ${error.message}`);
        }
    });
    const deleteQuestionMutation = useMutation<void, Error, string>({
        mutationFn: (questionId) => deleteQuestionAndAnswers(questionId, surveyId),
        onSuccess: (data, questionId) => {
            queryClient.invalidateQueries({ queryKey: ['questions', classId, surveyId] });
            queryClient.invalidateQueries({ queryKey: ['answers'] });
            setQuestionToDelete(null);
            setAnswerSettings(prev => {
                const newAnswers = { ...prev };
                delete newAnswers[questionId];
                return newAnswers;
            });
            toast.success('질문 및 관련 답변이 삭제되었습니다.');
        },
        onError: (error) => {
            toast.error(`질문 삭제 실패: ${error.message}`);
            setQuestionToDelete(null);
        }
    });
    const updateStudentGenderMutation = useMutation<void, Error, { gender: 'male' | 'female' | null }>({
        mutationFn: ({ gender }) => updateStudentGender(studentId, gender),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['student', studentId] });
        },
        onError: (error) => {
            toast.error(`성별 업데이트 실패: ${error.message}`);
        }
    });

    // --- 자동저장 훅 설정 ---
    const { autoSave: autoSaveRelationships } = useAutoSave({
        delay: 1000, // 1초 지연
        onSave: useCallback(async () => {
            if (classDetails && isDemoClass(classDetails)) {
                // 데모 학급에서는 저장 안함
                return;
            }
            try {
                await saveAllSettings(studentId, classId, surveyId, relationshipSettings, answerSettings, initialRelationshipsData, classDetails);
                console.log('관계 설정 자동저장 완료');
            } catch (error) {
                console.error('관계 설정 자동저장 실패:', error);
            }
        }, [studentId, classId, surveyId, relationshipSettings, answerSettings, initialRelationshipsData, classDetails]),
    });

    const { autoSave: autoSaveAnswers } = useAutoSave({
        delay: 2000, // 2초 지연
        onSave: useCallback(async () => {
            if (classDetails && isDemoClass(classDetails)) {
                // 데모 학급에서는 저장 안함
                return;
            }
            try {
                await saveAllSettings(studentId, classId, surveyId, relationshipSettings, answerSettings, initialRelationshipsData, classDetails);
                console.log('답변 자동저장 완료');
            } catch (error) {
                console.error('답변 자동저장 실패:', error);
            }
        }, [studentId, classId, surveyId, relationshipSettings, answerSettings, initialRelationshipsData, classDetails]),
    });

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
        deleteQuestionMutation.mutate(questionToDelete.id);
    };

    // --- 로딩 / 에러 처리 ---
    const isLoading = isLoadingStudent || isLoadingAllStudents || isLoadingRels || isLoadingQuestions || isLoadingAnswers || saveSettingsMutation.isPending || addQuestionMutation.isPending || deleteQuestionMutation.isPending || updateStudentGenderMutation.isPending;
    if (!studentId || !classId || !surveyId) {
        return <div>잘못된 접근입니다.</div>;
    }
    if (isLoading && !(saveSettingsMutation.isPending || addQuestionMutation.isPending || deleteQuestionMutation.isPending || updateStudentGenderMutation.isPending)) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-50">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
        );
    }
    if (!currentStudent) {
        return <div>학생 정보를 불러올 수 없습니다.</div>;
    }
    return (
        <div className="min-h-screen bg-white p-6">
            <div className="max-w-screen-lg mx-auto">
                <header className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
                    <div className="flex items-center gap-4">
                        <h1 className="text-xl font-bold text-gray-800">
                            {currentStudent.name}의 관계 설정
                        </h1>
                        {/* 성별 선택 버튼 그룹 */}
                        <div className="flex items-center space-x-1 bg-gray-100 p-0.5 rounded-lg">
                            <button
                                onClick={() => {
                                    setSelectedGender('male');
                                    if (selectedGender !== 'male') {
                                        updateStudentGenderMutation.mutate({ gender: 'male' });
                                    }
                                }}
                                className={`px-3 py-1 text-xs rounded-md transition-colors duration-150 ${selectedGender === 'male' ? 'bg-[#6366f1] text-white shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                남학생
                            </button>
                            <button
                                onClick={() => {
                                    setSelectedGender('female');
                                    if (selectedGender !== 'female') {
                                        updateStudentGenderMutation.mutate({ gender: 'female' });
                                    }
                                }}
                                className={`px-3 py-1 text-xs rounded-md transition-colors duration-150 ${selectedGender === 'female' ? 'bg-[#6366f1] text-white shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                여학생
                            </button>
                        </div>
                    </div>
                </header>
                <div className="mb-8 bg-white p-4 rounded-xl shadow-md">
                    {isLoadingAllStudents ? (
                       <div className="text-center text-gray-500 py-4">학생 목록 로딩 중...</div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {otherStudents && otherStudents.length > 0 ? (
                              otherStudents.map(target => {
                                  const currentRelation = relationshipSettings[target.id] || null;
                                  return (
                                      <div key={target.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex flex-col justify-between">
                                          <p className="font-semibold text-center mb-3 text-black truncate" title={target.name}>{target.name || `학생 ${target.id.substring(0, 4)}`}</p>
                                          <div className="flex justify-center gap-1.5">
                                              {(Object.keys(RELATIONSHIP_TYPES) as Array<keyof typeof RELATIONSHIP_TYPES>).map(type => {
                                                  const isSelected = currentRelation === type;
                                                  const bgColor = isSelected ? RELATIONSHIP_COLORS[type] : '#f3f4f6';
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