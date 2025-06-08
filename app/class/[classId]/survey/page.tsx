'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, Survey } from '@/lib/supabase';
import SurveyCard from '@/components/SurveyCard';
import { ArrowPathIcon, ExclamationCircleIcon, PlusIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
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
async function createSurvey(classId: string, name: string, description?: string, surveyDate?: string): Promise<Survey> {
  const insertData: any = { 
    class_id: classId, 
    name: name.trim(), 
    description: description?.trim() 
  };
  
  if (surveyDate) {
    insertData.survey_date = surveyDate;
  }
  
  const { data, error } = await (supabase as any)
    .from('surveys')
    .insert([insertData])
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
  const [newSurveyDate, setNewSurveyDate] = useState('');
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
  const createSurveyMutation = useMutation<Survey, Error, { name: string; description?: string; surveyDate?: string }>({ 
    mutationFn: async ({ name, description, surveyDate }) => {
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
      return createSurvey(classId, name, description, surveyDate);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surveys', classId] });
      setShowCreateSurveyModal(false);
      setNewSurveyName('');
      setNewSurveyDesc('');
      setNewSurveyDate('');
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
      createSurveyMutation.mutate({ 
        name: newSurveyName, 
        description: newSurveyDesc,
        surveyDate: newSurveyDate
      });
    } else {
      toast.error('설문 이름을 입력해주세요.');
    }
  };

  const handleCloseCreateModal = () => {
    setShowCreateSurveyModal(false);
    setNewSurveyName('');
    setNewSurveyDesc('');
    setNewSurveyDate('');
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
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center">
        <div className="flex flex-col items-center">
          <ArrowPathIcon className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
          <p className="text-lg text-gray-600">설문 목록을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center">
        <div className="text-center">
          <ExclamationCircleIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">오류가 발생했습니다</h2>
          <p className="text-gray-600 mb-4">설문 목록을 불러오는 중 문제가 발생했습니다.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center space-x-2">
            <ClipboardDocumentListIcon className="h-6 w-6 text-indigo-600" />
            <span>설문 작성</span>
          </h1>
        </div>

        {/* 학급 정보 */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
              <ClipboardDocumentListIcon className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-800">{classDetails?.name ?? ''} 설문 작성</h2>
              <p className="text-sm text-gray-600">학급 설문을 생성하고 관리합니다. 학생들의 관계도를 파악할 수 있습니다</p>
            </div>
          </div>
        </div>

        {/* 설문 목록 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-800">
              설문 목록 ({surveys?.length || 0}개)
            </h3>
            <button
              onClick={() => setShowCreateSurveyModal(true)}
              className="flex items-center space-x-2 bg-indigo-500 text-white px-4 py-2 rounded-lg hover:bg-indigo-600 transition-colors"
            >
              <PlusIcon className="h-5 w-5" />
              <span>설문 생성</span>
            </button>
          </div>

          {/* 설문 카드 그리드 */}
          {surveys && surveys.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {surveys.map((survey) => (
                <SurveyCard 
                  key={survey.id} 
                  survey={survey} 
                  onClick={() => handleSurveyClick(survey.id)}
                  onEdit={handleEditSurvey}
                  onDelete={handleDeleteSurveyClick}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ClipboardDocumentListIcon className="h-8 w-8 text-indigo-600" />
              </div>
              <p className="text-gray-600 mb-4">아직 생성된 설문이 없습니다</p>
              <button
                onClick={() => setShowCreateSurveyModal(true)}
                className="text-indigo-600 hover:text-indigo-800 font-medium"
              >
                첫 번째 설문 생성하기
              </button>
            </div>
          )}
        </div>
      </div>

      {showCreateSurveyModal && (
        <div 
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ 
            backgroundColor: 'rgba(0, 0, 0, 0.5)', 
            zIndex: 9999 
          }}
          onClick={handleCloseCreateModal}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full relative"
            style={{ zIndex: 10000 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-800" style={{ color: '#1f2937' }}>새 설문 생성</h3>
                <button
                  onClick={handleCloseCreateModal}
                  className="text-gray-500 hover:text-gray-700"
                  style={{ color: '#6b7280' }}
                >
                  <PlusIcon className="h-6 w-6 rotate-45" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ color: '#374151' }}>설문명</label>
                  <input
                    type="text"
                    value={newSurveyName}
                    onChange={(e) => setNewSurveyName(e.target.value)}
                    placeholder="예: 1학기 친구관계, 2학기 설문..."
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    style={{ color: '#111827', backgroundColor: '#ffffff' }}
                    maxLength={50}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ color: '#374151' }}>설명</label>
                  <textarea
                    value={newSurveyDesc}
                    onChange={(e) => setNewSurveyDesc(e.target.value)}
                    placeholder="설문에 대한 간단한 설명을 입력하세요..."
                    rows={3}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                    style={{ color: '#111827', backgroundColor: '#ffffff' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ color: '#374151' }}>설문진행날짜</label>
                  <input
                    type="date"
                    value={newSurveyDate}
                    onChange={(e) => setNewSurveyDate(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    style={{ color: '#111827', backgroundColor: '#ffffff' }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 mt-6">
                <button
                  onClick={handleCloseCreateModal}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                  style={{ color: '#374151', backgroundColor: '#ffffff', borderColor: '#d1d5db' }}
                >
                  취소
                </button>
                <button
                  onClick={handleCreateSurvey}
                  disabled={!newSurveyName.trim() || createSurveyMutation.isPending}
                  className="bg-indigo-500 text-white px-4 py-2 rounded-lg hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: '#6366f1', color: '#ffffff' }}
                >
                  {createSurveyMutation.isPending ? '생성 중...' : '생성하기'}
                </button>
              </div>
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