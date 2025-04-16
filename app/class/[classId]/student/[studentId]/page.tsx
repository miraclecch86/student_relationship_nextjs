'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, Student, Relationship, Question, Answer } from '@/lib/supabase';
import { RELATIONSHIP_TYPES, RELATIONSHIP_COLORS } from '@/lib/constants';
import ConfirmModal from '@/components/ConfirmModal';
import { ArrowUturnLeftIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

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

// --- 데이터 Fetching 함수 ---
async function fetchCurrentStudent(studentId: string): Promise<Student | null> {
    const { data, error } = await supabase.from('students').select('*').eq('id', studentId).single();
    if (error) { console.error('Error fetching current student:', error); return null; }
    return data;
}

async function fetchOtherStudents(classId: string, currentStudentId: string): Promise<TargetStudent[]> {
    const { data, error } = await supabase
        .from('students')
        .select('id, name')
        .eq('class_id', classId)
        .neq('id', currentStudentId); // 본인 제외
    if (error) { console.error('Error fetching other students:', error); return []; }
    return data;
}

async function fetchExistingRelationships(studentId: string): Promise<RelationshipSetting> {
    const { data, error } = await supabase
        .from('relations')
        .select('to_student_id, relation_type')
        .eq('from_student_id', studentId);
    if (error) { console.error('Error fetching relationships:', error); return {}; }

    const settings: RelationshipSetting = {};
    data.forEach(rel => {
        settings[rel.to_student_id] = rel.relation_type as keyof typeof RELATIONSHIP_TYPES;
    });
    return settings;
}

async function fetchQuestions(classId: string): Promise<Question[]> {
    const { data, error } = await supabase.from('questions').select('*').eq('class_id', classId).order('created_at');
    if (error) { console.error("Error fetching questions:", error); return []; }
    return data;
}

async function fetchAnswers(studentId: string): Promise<AnswerSetting> {
    const { data, error } = await supabase.from('answers').select('question_id, answer_text').eq('student_id', studentId);
    if (error) { console.error("Error fetching answers:", error); return {}; }

    const settings: AnswerSetting = {};
    data.forEach(ans => {
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
    initialRelationships: RelationshipSetting // 초기 관계 데이터 추가
): Promise<void> {
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
        const { error: upsertError } = await supabase.from('relations').upsert(relationshipsToUpsert, {
            onConflict: 'from_student_id, to_student_id',
        });
        if (upsertError) throw new Error(`관계 저장 실패: ${upsertError.message}`);
    }

    // Delete 실행
    if (relationshipsToDelete.length > 0) {
        const { error: deleteError } = await supabase
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
        const { error: ansError } = await supabase.from('answers').upsert(answerUpserts, {
            onConflict: 'student_id, question_id',
        });
        if (ansError) throw new Error(`답변 저장 실패: ${ansError.message}`);
    }

    // 캐시 무효화는 onSuccess 핸들러에서 처리
}

async function addQuestion(classId: string, questionText: string): Promise<Question> {
    const { data, error } = await supabase
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
    const { error: ansError } = await supabase.from('answers').delete().eq('question_id', questionId);
    if (ansError) throw new Error(`답변 삭제 실패: ${ansError.message}`);

    // 2. 질문 삭제
    const { error: qError } = await supabase.from('questions').delete().eq('id', questionId);
    if (qError) throw new Error(`질문 삭제 실패: ${qError.message}`);
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

    // --- 데이터 조회 Queries ---
    const { data: currentStudent, isLoading: isLoadingStudent } = useQuery({
        queryKey: ['student', studentId],
        queryFn: () => fetchCurrentStudent(studentId),
        enabled: !!studentId,
    });

    const { data: otherStudents, isLoading: isLoadingOthers } = useQuery({
        queryKey: ['otherStudents', classId, studentId],
        queryFn: () => fetchOtherStudents(classId, studentId),
        enabled: !!classId && !!studentId,
    });

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

    // onSuccess 로직을 useEffect로 이동
    useEffect(() => {
        if (initialRelationships) {
            setRelationshipSettings(initialRelationships);
            setInitialRelationshipsData(initialRelationships); // 초기 데이터 백업
        }
    }, [initialRelationships]);

    useEffect(() => {
        if (initialAnswers) {
            setAnswerSettings(initialAnswers);
        }
    }, [initialAnswers]);

    // --- 데이터 변경 Mutations ---
    const saveSettingsMutation = useMutation<void, Error, void>({
        mutationFn: () => saveAllSettings(studentId, classId, relationshipSettings, answerSettings, initialRelationshipsData),
        onSuccess: () => {
            // 캐시 무효화는 saveAllSettings 내부에서 처리
            toast.success('설정이 저장되었습니다.');
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

    // --- 핸들러 함수들 ---
    const handleRelationshipChange = (targetId: string, type: keyof typeof RELATIONSHIP_TYPES | null) => {
        setRelationshipSettings(prev => ({ ...prev, [targetId]: type }));
    };

    const handleAnswerChange = (questionId: string, text: string) => {
        setAnswerSettings(prev => ({ ...prev, [questionId]: text }));
    };

    const handleAddQuestion = () => {
        if (newQuestionText.trim()) {
            addQuestionMutation.mutate(newQuestionText.trim());
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

    const handleGoBack = () => {
        saveSettingsMutation.mutate();
    };

    // --- 로딩 / 에러 처리 ---
    const isLoading = isLoadingStudent || isLoadingOthers || isLoadingRels || isLoadingQuestions || isLoadingAnswers || saveSettingsMutation.isPending || addQuestionMutation.isPending || deleteQuestionMutation.isPending;

    if (!studentId || !classId) {
        return <div>잘못된 접근입니다.</div>; // ID가 없는 경우
    }

    if (isLoading && !(saveSettingsMutation.isPending || addQuestionMutation.isPending || deleteQuestionMutation.isPending)) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    // TODO: Query 에러 처리 UI 개선 필요
    if (!currentStudent) {
        return <div>학생 정보를 불러올 수 없습니다.</div>;
    }

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            {/* 상단 헤더 & 돌아가기 버튼 */}
            <div className="flex justify-between items-center mb-6 pb-4 border-b">
                <h1 className="text-2xl font-bold text-gray-800">{currentStudent.name} 학생 관계 설정</h1>
                <button
                    onClick={handleGoBack}
                    disabled={saveSettingsMutation.isPending}
                    className={`flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${saveSettingsMutation.isPending ? 'animate-pulse' : ''}`}
                >
                    {saveSettingsMutation.isPending ? (
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : (
                        <ArrowUturnLeftIcon className="h-4 w-4 mr-2" />
                    )}
                    {saveSettingsMutation.isPending ? '저장 중...' : '저장하고 돌아가기'}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 관계 설정 영역 */}
                <div className="bg-white p-4 rounded-lg shadow">
                    <h2 className="text-lg font-semibold mb-4 border-b pb-2 text-gray-700">친구 관계 설정</h2>
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                        {otherStudents && otherStudents.length > 0 ? (
                            otherStudents.map(target => (
                                <div key={target.id} className="p-3 border rounded-md hover:shadow-md transition-shadow">
                                    <p className="font-medium mb-2 text-gray-800">{target.name}</p>
                                    <div className="flex gap-2 flex-wrap">
                                        {(Object.keys(RELATIONSHIP_TYPES) as Array<keyof typeof RELATIONSHIP_TYPES>).map(type => (
                                            <button
                                                key={type}
                                                onClick={() => handleRelationshipChange(target.id, type === relationshipSettings[target.id] ? null : type)}
                                                className={`px-3 py-1 text-xs rounded-full border transition-colors ${relationshipSettings[target.id] === type ? 'text-white shadow-inner' : 'text-gray-600 bg-gray-50 hover:bg-gray-100'}`}
                                                style={relationshipSettings[target.id] === type ? { backgroundColor: RELATIONSHIP_COLORS[type] || '#CCCCCC' } : {}}
                                            >
                                                {RELATIONSHIP_TYPES[type]}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-500 text-sm">같은 반에 다른 학생이 없습니다.</p>
                        )}
                    </div>
                </div>

                {/* 주관식 질문/답변 영역 */}
                <div className="space-y-6">
                    {/* 질문 추가 영역 */}
                    <div className="bg-white p-4 rounded-lg shadow">
                        <h3 className="text-md font-semibold mb-3 text-gray-700">새 질문 추가 (선생님용)</h3>
                        <div className="flex items-center space-x-2">
                            <input
                                type="text"
                                value={newQuestionText}
                                onChange={(e) => setNewQuestionText(e.target.value)}
                                placeholder="질문 내용을 입력하세요..."
                                className="flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                disabled={addQuestionMutation.isPending}
                            />
                            <button
                                onClick={handleAddQuestion}
                                disabled={addQuestionMutation.isPending || !newQuestionText.trim()}
                                className={`inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed ${addQuestionMutation.isPending ? 'animate-pulse' : ''}`}
                            >
                                {addQuestionMutation.isPending ? (
                                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : (
                                    <PlusIcon className="h-4 w-4" />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* 답변 영역 */}
                    <div className="bg-white p-4 rounded-lg shadow">
                        <h2 className="text-lg font-semibold mb-4 border-b pb-2 text-gray-700">주관식 답변 작성</h2>
                        <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                            {questions && questions.length > 0 ? (
                                questions.map(question => (
                                    <div key={question.id} className="border-b pb-3 last:border-b-0">
                                        <div className="flex justify-between items-start mb-2">
                                            <label htmlFor={`answer-${question.id}`} className="block text-sm font-medium text-gray-700 flex-1 mr-2">{question.question_text}</label>
                                            <button
                                                onClick={() => handleDeleteQuestionClick(question)}
                                                disabled={deleteQuestionMutation.isPending && questionToDelete?.id === question.id}
                                                className={`text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed p-1 rounded-full hover:bg-red-100 transition-colors ${deleteQuestionMutation.isPending && questionToDelete?.id === question.id ? 'animate-pulse' : ''}`}
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                            </button>
                                        </div>
                                        <textarea
                                            id={`answer-${question.id}`}
                                            rows={3}
                                            value={answerSettings[question.id] || ''}
                                            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            placeholder="답변을 입력하세요..."
                                        />
                                    </div>
                                ))
                            ) : (
                                <p className="text-gray-500 text-sm">등록된 질문이 없습니다.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* 질문 삭제 확인 모달 */}
            {questionToDelete && (
                <ConfirmModal
                    isOpen={!!questionToDelete}
                    onClose={() => setQuestionToDelete(null)}
                    onConfirm={confirmDeleteQuestion}
                    title="질문 삭제 확인"
                    message={`'${questionToDelete.question_text}' 질문을 정말 삭제하시겠습니까? 이 질문에 대한 모든 학생의 답변도 함께 삭제됩니다.`}
                    confirmText="삭제"
                />
            )}
        </div>
    );
}
