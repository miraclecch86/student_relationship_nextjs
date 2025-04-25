'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, Student, Survey } from '@/lib/supabase'; // Survey 타입 추가
import StudentListPanel from '@/components/StudentListPanel'; // 학생 목록 패널 컴포넌트 (추후 생성)
import SurveyCard from '@/components/SurveyCard'; // 설문 카드 컴포넌트 (추후 생성)
import { ArrowPathIcon, ExclamationCircleIcon, PlusIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

// NodeData 정의 (학생 목록용)
interface NodeData extends Student {
  x?: number;
  y?: number;
  fx?: number | null | undefined;
  fy?: number | null | undefined;
}

// --- 데이터 Fetching 함수 --- 

// 학생 목록 조회 (기존 함수 재활용)
async function fetchStudents(classId: string): Promise<NodeData[]> {
  // ... (기존 fetchStudents 로직) ...
  const { data, error } = await supabase
    .from('students')
    .select('*, position_x, position_y') 
    .eq('class_id', classId)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) {
    console.error('Error fetching students:', error);
    return [];
  }
  return data as NodeData[];
}

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

// 학생 관련 Mutation 함수들 (addStudent, updateStudentName, deleteStudent, updateStudentOrder)
// -> StudentListPanel 컴포넌트 내부 또는 props로 전달될 예정
// ... (기존 함수 정의) ...

export default function SurveyListPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const classId = params.classId as string;

  const [showCreateSurveyModal, setShowCreateSurveyModal] = useState(false);
  const [newSurveyName, setNewSurveyName] = useState('');
  const [newSurveyDesc, setNewSurveyDesc] = useState('');

  // 학생 목록 조회
  const { data: students, isLoading: isLoadingStudents, isError: isErrorStudents } = useQuery({
    queryKey: ['students', classId],
    queryFn: () => fetchStudents(classId!),
    enabled: !!classId,
  });

  // 설문 목록 조회
  const { data: surveys, isLoading: isLoadingSurveys, isError: isErrorSurveys, refetch: refetchSurveys } = useQuery({
    queryKey: ['surveys', classId],
    queryFn: () => fetchSurveys(classId!),
    enabled: !!classId,
  });

  // 설문 생성 Mutation
  const createSurveyMutation = useMutation<Survey, Error, { name: string; description?: string }>({ 
    mutationFn: ({ name, description }) => createSurvey(classId, name, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surveys', classId] }); // 설문 목록 캐시 무효화
      setShowCreateSurveyModal(false); // 모달 닫기
      setNewSurveyName(''); // 입력 초기화
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

  const isLoading = isLoadingStudents || isLoadingSurveys;
  const isError = isErrorStudents || isErrorSurveys;

  if (isLoading) {
    // 로딩 상태 UI
    return <div className="flex justify-center items-center h-screen"><ArrowPathIcon className="w-8 h-8 animate-spin" /></div>;
  }

  if (isError) {
    // 에러 상태 UI
    return <div className="flex justify-center items-center h-screen text-red-500"><ExclamationCircleIcon className="w-8 h-8 mr-2" /> 데이터 로딩 실패</div>;
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* 왼쪽: 학생 목록 패널 (컴포넌트로 분리 예정) */}
      <div className="w-64 bg-white shadow-md flex flex-col flex-shrink-0">
        <StudentListPanel classId={classId} students={students || []} /> 
      </div>

      {/* 오른쪽: 설문 목록 및 생성 */}
      <div className="flex-1 p-8 overflow-y-auto">
        <header className="mb-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">설문 목록</h1>
          <button 
            onClick={() => setShowCreateSurveyModal(true)}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <PlusIcon className="w-5 h-5 mr-2" />
            새 설문 만들기
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {surveys && surveys.length > 0 ? (
            surveys.map((survey) => (
              <SurveyCard key={survey.id} survey={survey} onClick={() => handleSurveyClick(survey.id)} />
            ))
          ) : (
            <p className="text-gray-500 italic col-span-full text-center mt-8">생성된 설문이 없습니다. '새 설문 만들기' 버튼을 클릭하여 설문을 추가하세요.</p>
          )}
        </div>
      </div>

      {/* 새 설문 생성 모달 (간단 구현) */}
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