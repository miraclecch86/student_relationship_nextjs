'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, Survey } from '@/lib/supabase';
import StudentListPanel from '@/components/StudentListPanel';
import SurveyCard from '@/components/SurveyCard';
import { ArrowPathIcon, ExclamationCircleIcon, PlusIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

// --- 데이터 Fetching 함수 --- 

// 설문 목록 조회 함수
async function fetchSurveys(classId: string): Promise<Survey[]> {
  const { data, error } = await supabase
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

// 학급 정보 조회 함수 추가 (헤더용)
async function fetchClassDetails(classId: string): Promise<{ name: string } | null> {
    const { data, error } = await supabase
        .from('classes')
        .select('name')
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
  const { data, error } = await supabase
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

export default function SurveyListPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const classId = params.classId as string;

  const [showCreateSurveyModal, setShowCreateSurveyModal] = useState(false);
  const [newSurveyName, setNewSurveyName] = useState('');
  const [newSurveyDesc, setNewSurveyDesc] = useState('');

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
    mutationFn: ({ name, description }) => createSurvey(classId, name, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surveys', classId] });
      setShowCreateSurveyModal(false);
      setNewSurveyName('');
      setNewSurveyDesc('');
      toast.success('새로운 설문이 생성되었습니다.');
    },
    onError: (error) => {
      toast.error(error.message);
    },
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

  const isLoading = isLoadingClassDetails || isLoadingSurveys;
  const isError = isErrorSurveys;

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen"><ArrowPathIcon className="w-8 h-8 animate-spin" /></div>;
  }

  if (isError) {
    return <div className="flex justify-center items-center h-screen text-red-500"><ExclamationCircleIcon className="w-8 h-8 mr-2" /> 설문 목록 로딩 실패</div>;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <div className="flex flex-col flex-1 overflow-hidden p-4 lg:p-6 gap-4 lg:gap-6">
        <div className="flex-shrink-0 bg-white rounded-lg shadow-md border border-gray-200 p-4 lg:p-6">
          <header className="flex items-center justify-between">
            <button
              onClick={() => router.push('/')}
              className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <ArrowLeftIcon className="w-5 h-5 mr-2" />
              학급 목록
            </button>
            <h1 className="text-xl font-semibold text-gray-800">
              {classDetails?.name ?? '학급 정보 로딩 중...'} - 설문 목록
            </h1>
            <div className="w-32"></div>
          </header>
        </div>

        <div className="flex flex-1 overflow-hidden gap-4 lg:gap-6">
          <aside className="w-64 bg-white rounded-lg shadow-md flex flex-col flex-shrink-0 border border-gray-200 overflow-hidden">
            <StudentListPanel classId={classId} />
          </aside>

          <main className="flex-1 bg-white rounded-lg shadow-md border border-gray-200 p-6 lg:p-8 overflow-y-auto">
            <div className="mb-6 flex justify-end">
              <button
                onClick={() => setShowCreateSurveyModal(true)}
                className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <PlusIcon className="w-5 h-5 mr-2" />
                새 설문 만들기
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {surveys && surveys.length > 0 ? (
                surveys.map((survey) => (
                  <SurveyCard key={survey.id} survey={survey} onClick={() => handleSurveyClick(survey.id)} />
                ))
              ) : (
                <p className="text-gray-500 italic col-span-full text-center mt-8">생성된 설문이 없습니다. '새 설문 만들기' 버튼을 클릭하여 설문을 추가하세요.</p>
              )}
            </div>
          </main>
        </div>
      </div>

      {showCreateSurveyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">새 설문 만들기</h2>
            <input
              type="text"
              placeholder="설문 이름"
              value={newSurveyName}
              onChange={(e) => setNewSurveyName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <textarea
              placeholder="설문 설명 (선택)"
              value={newSurveyDesc}
              onChange={(e) => setNewSurveyDesc(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCreateSurveyModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                취소
              </button>
              <button
                onClick={handleCreateSurvey}
                disabled={createSurveyMutation.isPending}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {createSurveyMutation.isPending ? '생성 중...' : '생성'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 