'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, Survey } from '@/lib/supabase';
import SurveyCard from '@/components/SurveyCard';
import { ArrowPathIcon, ExclamationCircleIcon, PlusIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import ConfirmModal from '@/components/ConfirmModal';
import EditSurveyModal from '@/components/EditSurveyModal';
import { handleDemoSaveAttempt, isDemoClass } from '@/utils/demo-permissions';

// --- 데이터 Fetching 함수 --- 

// 설문 목록 조회 함수
async function fetchSurveys(classId: string): Promise<Survey[]> {
  const { data, error } = await (supabase as any)
    .from('surveys')
    .select('*')
    .eq('class_id', classId)
    .order('created_at', { ascending: true });
  
  if (error) {
    console.error('Error fetching surveys:', error);
    throw new Error('설문 목록 조회 실패');
  }
  return data || [];
}

// 학급 정보 조회 함수 수정 (전체 정보 필요)
async function fetchClassDetails(classId: string): Promise<any | null> {
    const { data, error } = await (supabase as any)
        .from('classes')
        .select('*')
        .eq('id', classId)
        .single();
    if (error) {
        console.error('Error fetching class details:', error);
        return null;
    }
    return data;
}

// --- 데이터 Mutation 함수 --- 

// 설문 생성 함수
async function createSurvey(classId: string, name: string, description?: string): Promise<Survey> {
  const { data, error } = await (supabase as any)
    .from('surveys')
    .insert([{ class_id: classId, name: name.trim(), description: description?.trim() }])
    .select()
    .single();

  if (error) {
    console.error('Error creating survey:', error);
    throw new Error('설문 생성 실패');
  }
  return data;
}

// 설문 삭제 함수 (예시: CASCADE 설정이 DB에 되어 있다고 가정)
async function deleteSurvey(surveyId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('surveys')
    .delete()
    .eq('id', surveyId);
  if (error) throw new Error(`설문 삭제 실패: ${error.message}`);
}

// 설문 업데이트 함수 추가
async function updateSurvey(surveyData: Partial<Survey>): Promise<Survey | null> {
    if (!surveyData.id) throw new Error("수정할 설문 ID가 없습니다.");
    const { id, ...updateData } = surveyData; // id는 조건에만 사용
    
    // 업데이트할 필드가 있는지 확인
    if (Object.keys(updateData).length === 0) {
        console.log("No fields to update for survey:", id);
        return null; // 변경 사항 없으면 null 반환
    }

    const { data, error } = await (supabase as any)
      .from('surveys')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw new Error(`설문 업데이트 실패: ${error.message}`);
    return data;
}

export default function SurveyListPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const classId = params.classId as string;

  const [showCreateSurveyModal, setShowCreateSurveyModal] = useState(false);
  const [newSurveyName, setNewSurveyName] = useState('');
  const [newSurveyDesc, setNewSurveyDesc] = useState('');
  const [surveyToDelete, setSurveyToDelete] = useState<Survey | null>(null);
  const [surveyToEdit, setSurveyToEdit] = useState<Survey | null>(null);

  // 학급 상세 정보 조회 (헤더용)
  const { data: classDetails, isLoading: isLoadingClassDetails } = useQuery({
    queryKey: ['classDetails', classId],
    queryFn: () => fetchClassDetails(classId!),
    enabled: !!classId,
  });

  // 설문 목록 조회
  const { data: surveys, isLoading: isLoadingSurveys, isError: isErrorSurveys } = useQuery({
    queryKey: ['surveys', classId],
    queryFn: () => fetchSurveys(classId!),
    enabled: !!classId,
  });

  // 설문 생성 Mutation
  const createSurveyMutation = useMutation<Survey, Error, { name: string; description?: string }>({ 
    mutationFn: async ({ name, description }) => {
      // 🌟 데모 학급 권한 체크
      if (classDetails && isDemoClass(classDetails)) {
        const saveAttempt = handleDemoSaveAttempt(classDetails, "설문 생성");
        if (!saveAttempt.canSave) {
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
          throw new Error("DEMO_BLOCKED");
        }
      }
      return createSurvey(classId, name, description);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surveys', classId] });
      setShowCreateSurveyModal(false);
      setNewSurveyName('');
      setNewSurveyDesc('');
      // 🌟 데모 학급이 아닌 경우만 성공 메시지 표시
      if (classDetails && !isDemoClass(classDetails)) {
        toast.success('새로운 설문이 생성되었습니다.');
      }
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "DEMO_BLOCKED") {
        return;
      }
      toast.error(error.message);
    },
  });

  // 설문 삭제 Mutation
  const deleteSurveyMutation = useMutation<void, Error, string>({
    mutationFn: async (surveyId: string) => {
      // 🌟 데모 학급 권한 체크
      if (classDetails && isDemoClass(classDetails)) {
        const saveAttempt = handleDemoSaveAttempt(classDetails, "설문 삭제");
        if (!saveAttempt.canSave) {
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
          throw new Error("DEMO_BLOCKED");
        }
      }
      return deleteSurvey(surveyId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surveys', classId] });
      setSurveyToDelete(null);
      // 🌟 데모 학급이 아닌 경우만 성공 메시지 표시
      if (classDetails && !isDemoClass(classDetails)) {
        toast.success('설문이 삭제되었습니다.');
      }
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "DEMO_BLOCKED") {
        setSurveyToDelete(null);
        return;
      }
      toast.error(error.message);
      setSurveyToDelete(null);
    }
  });

  // 설문 수정 Mutation 추가
  const updateSurveyMutation = useMutation<Survey | null, Error, Partial<Survey>>({
    mutationFn: async (surveyData: Partial<Survey>) => {
      // 🌟 데모 학급 권한 체크
      if (classDetails && isDemoClass(classDetails)) {
        const saveAttempt = handleDemoSaveAttempt(classDetails, "설문 수정");
        if (!saveAttempt.canSave) {
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
          throw new Error("DEMO_BLOCKED");
        }
      }
      return updateSurvey(surveyData);
    },
    onSuccess: (updatedSurvey) => {
      if (updatedSurvey) {
        queryClient.invalidateQueries({ queryKey: ['surveys', classId] });
        // 🌟 데모 학급이 아닌 경우만 성공 메시지 표시
        if (classDetails && !isDemoClass(classDetails)) {
          toast.success('설문 정보가 수정되었습니다.');
        }
      } else {
        // 변경 사항이 없었을 경우 (toast.info 대신 기본 toast 사용)
        if (classDetails && !isDemoClass(classDetails)) {
          toast('변경된 내용이 없습니다.');
        }
      }
      setSurveyToEdit(null); // 모달 닫기
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "DEMO_BLOCKED") {
        setSurveyToEdit(null);
        return;
      }
      toast.error(error.message);
      // 모달을 닫지 않고 에러를 표시할 수도 있음
      // setSurveyToEdit(null);
    }
  });

  const handleCreateSurvey = () => {
    if (newSurveyName.trim()) {
      createSurveyMutation.mutate({ name: newSurveyName, description: newSurveyDesc });
    } else {
      toast.error('설문 이름을 입력해주세요.');
    }
  };

  const handleSurveyClick = (surveyId: string) => {
    router.push(`/class/${classId}/survey/${surveyId}`);
  };

  // 수정 버튼 클릭 시
  const handleEditSurvey = (survey: Survey) => {
    setSurveyToEdit(survey); // 수정 모달 열기
  };

  // 수정 모달 저장 버튼 클릭 시
  const handleSaveSurveyEdit = async (updatedSurveyData: Partial<Survey>) => {
    await updateSurveyMutation.mutateAsync(updatedSurveyData);
    // 성공/실패 처리는 onSuccess/onError에서
  };

  // 삭제 버튼 클릭 시 (확인 모달 열기)
  const handleDeleteSurveyClick = (surveyId: string) => {
    const survey = surveys?.find(s => s.id === surveyId);
    if (survey) {
      setSurveyToDelete(survey); 
    }
  };
  
  // 삭제 확인 모달에서 확인 눌렀을 때
  const confirmSurveyDelete = () => {
    if (surveyToDelete) {
      deleteSurveyMutation.mutate(surveyToDelete.id);
    }
  };

  const isLoading = isLoadingClassDetails || isLoadingSurveys;
  const isError = isErrorSurveys;

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen"><ArrowPathIcon className="w-8 h-8 animate-spin" /></div>;
  }

  if (isError) {
    return <div className="flex justify-center items-center h-screen text-red-500"><ExclamationCircleIcon className="w-8 h-8 mr-2" /> 설문 목록 로딩 실패</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <header className="mb-10 flex justify-between items-center bg-white p-5 rounded-lg shadow-md">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="flex items-center px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors shadow-sm"
            >
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              돌아가기
            </button>
            <h1 className="text-2xl font-bold text-black">
              {classDetails?.name ?? ''} - 설문 목록
            </h1>
          </div>
          <button
            onClick={() => setShowCreateSurveyModal(true)}
            className="flex items-center px-4 py-2 text-sm bg-indigo-500 text-white rounded-md hover:bg-indigo-600 shadow focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-1 transition-all duration-200"
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            새 설문 만들기
          </button>
        </header>

        <main className="bg-white rounded-lg shadow-md border border-gray-200 p-6 lg:p-8 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {surveys && surveys.length > 0 ? (
              surveys.map((survey) => (
                <SurveyCard 
                  key={survey.id} 
                  survey={survey} 
                  onClick={() => handleSurveyClick(survey.id)}
                  onEdit={handleEditSurvey}
                  onDelete={handleDeleteSurveyClick}
                />
              ))
            ) : (
              <p className="text-gray-500 italic col-span-full text-center mt-8">생성된 설문이 없습니다. '새 설문 만들기' 버튼을 클릭하여 설문을 추가하세요.</p>
            )}
          </div>
        </main>
      </div>

      {showCreateSurveyModal && (
        <div className="fixed inset-0 bg-indigo-900 bg-opacity-60 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
            <h2 className="text-2xl font-bold text-indigo-800 mb-6 text-center">새 설문 만들기</h2>
            <input
              type="text"
              placeholder="설문 이름"
              value={newSurveyName}
              onChange={(e) => setNewSurveyName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black placeholder:text-gray-400"
            />
            <textarea
              placeholder="설문 설명 (선택)"
              value={newSurveyDesc}
              onChange={(e) => setNewSurveyDesc(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-6 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black placeholder:text-gray-400"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCreateSurveyModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                취소
              </button>
              <button
                onClick={handleCreateSurvey}
                disabled={createSurveyMutation.isPending}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {createSurveyMutation.isPending ? '생성 중...' : '생성'}
              </button>
            </div>
          </div>
        </div>
      )}

      {surveyToDelete && (
        <ConfirmModal
          isOpen={!!surveyToDelete}
          onClose={() => setSurveyToDelete(null)}
          onConfirm={confirmSurveyDelete}
          title="설문 삭제 확인"
          message={`'${surveyToDelete.name}' 설문을 정말 삭제하시겠습니까? 관련된 모든 데이터(질문, 답변, 관계 등)가 삭제됩니다.`}
          confirmText="삭제"
          isLoading={deleteSurveyMutation.isPending}
        />
      )}

      {/* 설문 수정 모달 */}      
      {surveyToEdit && (
          <EditSurveyModal
            isOpen={!!surveyToEdit}
            onClose={() => setSurveyToEdit(null)}
            onSave={handleSaveSurveyEdit}
            initialSurvey={surveyToEdit}
            isLoading={updateSurveyMutation.isPending}
          />
      )}
    </div>
  );
} 