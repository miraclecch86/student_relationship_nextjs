'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, Class } from '@/lib/supabase';
import {
  ArrowLeftIcon,
  SparklesIcon,
  CalendarIcon,
  ArrowPathIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  TrashIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import ConfirmModal from '@/components/ConfirmModal';

// 분석 결과 타입 정의
interface AnalysisResult {
  id: string;
  class_id: string;
  created_at: string;
  result_data: {
    analysis: string;
    relationships: {
      description: string;
      issues?: string[];
      recommendations?: string[];
    };
    socialDynamics: {
      description: string;
      strongConnections?: string[];
      isolatedStudents?: string[];
    };
  };
  summary: string;
  type: string; // 'full', 'overview', 'students-1', 'students-2', 'students-3'
}

// 학급 정보 조회 함수
async function fetchClassDetails(classId: string): Promise<Class | null> {
  const { data, error } = await supabase
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

// 분석 결과 목록 조회 함수
async function fetchAnalysisResults(classId: string): Promise<AnalysisResult[]> {
  console.log(`분석 목록 요청: classId=${classId}`);
  
  try {
    // API 엔드포인트에 직접 요청
    const response = await fetch(`/api/class/${classId}/analysis`);
    
    if (!response.ok) {
      throw new Error(`분석 결과를 불러오는데 실패했습니다 (${response.status})`);
    }
    
    const data = await response.json();
    console.log(`분석 목록 수신 성공, ${data ? data.length : 0}개의 결과`);
    return data || [];
  } catch (error) {
    console.error('분석 목록 요청 오류:', error);
    throw error;
  }
}

// 분석 실행 함수 - 복잡한 로직이 있으므로 API 호출 방식 유지
async function runAnalysis(classId: string): Promise<AnalysisResult> {
  console.log(`분석 실행 요청: classId=${classId}`);
  
  try {
    const response = await fetch(`/api/class/${classId}/analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = '분석을 실행하는데 실패했습니다.';
      
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (e) {
        console.error('오류 응답 파싱 실패:', e);
      }
      
      console.error(`API 오류 (${response.status}):`, errorMessage);
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    console.log('분석 실행 성공, 결과 ID:', data.id);
    return data;
  } catch (error) {
    console.error('분석 실행 요청 오류:', error);
    throw error;
  }
}

// 종합 분석 실행 함수
async function runOverviewAnalysis(classId: string): Promise<AnalysisResult> {
  console.log(`종합 분석 실행 요청: classId=${classId}`);
  
  try {
    const response = await fetch(`/api/class/${classId}/analysis/overview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = '종합 분석을 실행하는데 실패했습니다.';
      
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (e) {
        console.error('오류 응답 파싱 실패:', e);
      }
      
      console.error(`API 오류 (${response.status}):`, errorMessage);
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    console.log('종합 분석 실행 성공, 결과 ID:', data.id);
    return data;
  } catch (error) {
    console.error('종합 분석 실행 요청 오류:', error);
    throw error;
  }
}

// 학생 그룹별 분석 실행 함수
async function runStudentGroupAnalysis(classId: string, groupIndex: number): Promise<AnalysisResult> {
  console.log(`학생 그룹${groupIndex} 분석 실행 요청: classId=${classId}`);
  
  try {
    const response = await fetch(`/api/class/${classId}/analysis/students?group=${groupIndex}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `학생 그룹${groupIndex} 분석을 실행하는데 실패했습니다.`;
      
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (e) {
        console.error('오류 응답 파싱 실패:', e);
      }
      
      console.error(`API 오류 (${response.status}):`, errorMessage);
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    console.log(`학생 그룹${groupIndex} 분석 실행 성공, 결과 ID:`, data.id);
    return data;
  } catch (error) {
    console.error(`학생 그룹${groupIndex} 분석 실행 요청 오류:`, error);
    throw error;
  }
}

async function deleteAnalysis(classId: string, analysisId: string): Promise<void> {
  console.log(`분석 결과 삭제 요청: classId=${classId}, analysisId=${analysisId}`);
  
  try {
    const response = await fetch(`/api/class/${classId}/analysis/${analysisId}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = '분석 결과를 삭제하는데 실패했습니다.';
      
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (e) {
        console.error('오류 응답 파싱 실패:', e);
      }
      
      console.error(`API 오류 (${response.status}):`, errorMessage);
      throw new Error(errorMessage);
    }
    
    console.log('분석 결과 삭제 성공');
  } catch (error) {
    console.error('분석 삭제 요청 오류:', error);
    throw error;
  }
}

// 분석 유형에 따른 배지 색상 및 텍스트 가져오기
const getAnalysisBadge = (type: string) => {
  switch(type) {
    case 'overview':
      return { text: '종합분석', bgColor: '', textColor: 'text-black' };
    case 'students-1':
      return { text: '학생분석 1', bgColor: '', textColor: 'text-black' };
    case 'students-2':
      return { text: '학생분석 2', bgColor: '', textColor: 'text-black' };
    case 'students-3':
      return { text: '학생분석 3', bgColor: '', textColor: 'text-black' };
    case 'full':
    default:
      return { text: '전체분석', bgColor: '', textColor: 'text-black' };
  }
};

// 분석 카드 컴포넌트
interface AnalysisCardProps {
  analysis: AnalysisResult;
}

function AnalysisCard({ analysis }: AnalysisCardProps) {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const classId = params.classId as string;
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  const createdAt = new Date(analysis.created_at);
  const formattedDate = format(createdAt, 'yyyy년 MM월 dd일', { locale: ko });
  const formattedTime = format(createdAt, 'HH:mm', { locale: ko });
  
  // 분석 유형 배지 정보
  const badge = getAnalysisBadge(analysis.type);
  
  // 삭제 Mutation
  const deleteAnalysisMutation = useMutation({
    mutationFn: () => deleteAnalysis(classId, analysis.id),
    onSuccess: () => {
      toast.success('분석 결과가 삭제되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['analysisResults', classId] });
      setIsDeleteDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '삭제 중 오류가 발생했습니다.');
    },
  });
  
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // 카드 클릭 이벤트 전파 방지
    setIsDeleteDialogOpen(true);
  };
  
  const confirmDelete = () => {
    deleteAnalysisMutation.mutate();
  };
  
  return (
    <>
      <motion.div
        className="bg-white rounded-lg shadow-md p-4 transition-all duration-300 hover:shadow-lg hover:bg-gray-50 relative group"
        whileHover={{ scale: 1.02 }}
        layout
      >
        <div 
          className="cursor-pointer pb-6" // 하단에 여백 추가하여 삭제 버튼 공간 확보
          onClick={() => router.push(`/class/${classId}/analysis/${analysis.id}`)}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <div className="bg-indigo-100 text-indigo-600 p-2 rounded-full">
                <DocumentTextIcon className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-black">{formattedDate}</h3>
                </div>
                <p className="text-sm text-black">{formattedTime}</p>
              </div>
            </div>
            <ChevronRightIcon className="w-5 h-5 text-gray-400" />
          </div>
          <div className="mt-3">
            <p className="text-sm text-black line-clamp-2">{analysis.summary}</p>
          </div>
        </div>
        
        {/* 삭제 버튼 */}
        <div className="absolute bottom-3 right-3">
          <button
            onClick={handleDeleteClick}
            disabled={deleteAnalysisMutation.isPending}
            className="p-1.5 rounded-full bg-gray-50 hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-300"
            title="삭제"
          >
            {deleteAnalysisMutation.isPending ? (
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
            ) : (
              <TrashIcon className="w-4 h-4" />
            )}
          </button>
        </div>
      </motion.div>
      
      <ConfirmModal
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
        title="분석 결과 삭제 확인"
        message={`${formattedDate} ${formattedTime}에 생성된 분석 결과를 정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmText="삭제"
        isLoading={deleteAnalysisMutation.isPending}
      />
    </>
  );
}

export default function ClassAnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const classId = params.classId as string;
  
  // 학급 정보 조회
  const { data: classDetails, isLoading: isClassLoading } = useQuery({
    queryKey: ['classDetails', classId],
    queryFn: () => fetchClassDetails(classId),
    enabled: !!classId,
  });
  
  // 분석 결과 목록 조회 (모든 결과)
  const { 
    data: analysisResults, 
    isLoading: isResultsLoading, 
    isError: isResultsError,
    error: resultsError
  } = useQuery({
    queryKey: ['analysisResults', classId],
    queryFn: () => fetchAnalysisResults(classId),
    enabled: !!classId,
  });
  
  // 종합 분석 실행 Mutation
  const runOverviewMutation = useMutation({
    mutationFn: () => runOverviewAnalysis(classId),
    onSuccess: (newAnalysis) => {
      queryClient.invalidateQueries({ queryKey: ['analysisResults', classId] });
      toast.success('종합 분석이 완료되었습니다.');
      router.push(`/class/${classId}/analysis/${newAnalysis.id}`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '종합 분석 실행 중 오류가 발생했습니다.');
    },
  });
  
  // 학생 그룹1 분석 실행 Mutation
  const runStudents1Mutation = useMutation({
    mutationFn: () => runStudentGroupAnalysis(classId, 1),
    onSuccess: (newAnalysis) => {
      queryClient.invalidateQueries({ queryKey: ['analysisResults', classId] });
      toast.success('첫 번째 학생 그룹 분석이 완료되었습니다.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '학생 그룹1 분석 실행 중 오류가 발생했습니다.');
    },
  });
  
  // 학생 그룹2 분석 실행 Mutation
  const runStudents2Mutation = useMutation({
    mutationFn: () => runStudentGroupAnalysis(classId, 2),
    onSuccess: (newAnalysis) => {
      queryClient.invalidateQueries({ queryKey: ['analysisResults', classId] });
      toast.success('두 번째 학생 그룹 분석이 완료되었습니다.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '학생 그룹2 분석 실행 중 오류가 발생했습니다.');
    },
  });
  
  // 학생 그룹3 분석 실행 Mutation
  const runStudents3Mutation = useMutation({
    mutationFn: () => runStudentGroupAnalysis(classId, 3),
    onSuccess: (newAnalysis) => {
      queryClient.invalidateQueries({ queryKey: ['analysisResults', classId] });
      toast.success('세 번째 학생 그룹 분석이 완료되었습니다.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '학생 그룹3 분석 실행 중 오류가 발생했습니다.');
    },
  });
  
  // 기존 분석 실행 Mutation (호환성 유지)
  const runAnalysisMutation = useMutation({
    mutationFn: () => runAnalysis(classId),
    onSuccess: (newAnalysis) => {
      queryClient.invalidateQueries({ queryKey: ['analysisResults', classId] });
      toast.success('분석이 완료되었습니다.');
      router.push(`/class/${classId}/analysis/${newAnalysis.id}`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '분석 실행 중 오류가 발생했습니다.');
    },
  });
  
  // 전체 분석 순차 실행 함수
  const runFullAnalysisSequentially = async () => {
    try {
      toast.success('종합 분석을 시작합니다...');
      await runOverviewMutation.mutateAsync();
      
      toast.success('첫 번째 학생 그룹 분석을 시작합니다...');
      await runStudents1Mutation.mutateAsync();
      
      toast.success('두 번째 학생 그룹 분석을 시작합니다...');
      await runStudents2Mutation.mutateAsync();
      
      toast.success('세 번째 학생 그룹 분석을 시작합니다...');
      await runStudents3Mutation.mutateAsync();
      
      toast.success('모든 분석이 완료되었습니다!');
    } catch (error) {
      toast.error('분석 과정 중 오류가 발생했습니다. 일부 분석은 완료되었을 수 있습니다.');
      console.error('순차 분석 오류:', error);
    }
  };
  
  const isLoading = isClassLoading || isResultsLoading;
  const isAnyRunning = runOverviewMutation.isPending || 
                      runStudents1Mutation.isPending || 
                      runStudents2Mutation.isPending || 
                      runStudents3Mutation.isPending ||
                      runAnalysisMutation.isPending;
  
  if (isLoading && !isAnyRunning) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100">
        <ArrowPathIcon className="w-8 h-8 animate-spin text-indigo-500" />
        <div className="text-xl text-indigo-500 ml-3">로딩 중...</div>
      </div>
    );
  }
  
  if (isResultsError) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gray-100">
        <div className="text-2xl text-red-500 mb-4">오류가 발생했습니다</div>
        <p className="text-gray-700 mb-4">
          {resultsError instanceof Error ? resultsError.message : '분석 결과를 불러올 수 없습니다.'}
        </p>
        <button
          onClick={() => router.push(`/class/${classId}/dashboard`)}
          className="px-4 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600"
        >
          대시보드로 돌아가기
        </button>
      </div>
    );
  }
  
  if (!classDetails) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gray-100">
        <div className="text-2xl text-red-500 mb-4">학급 정보를 찾을 수 없습니다</div>
        <button
          onClick={() => router.push('/teacher')}
          className="px-4 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600"
        >
          학급 목록으로 돌아가기
        </button>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-screen-xl mx-auto px-4 py-8">
        {/* 헤더 */}
        <header className="mb-8 bg-white p-4 rounded-lg shadow-md">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(`/class/${classId}/dashboard`)}
              className="px-4 py-2 text-sm bg-indigo-500 text-white rounded-md hover:bg-indigo-600 shadow focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-1 transition-all duration-200 flex items-center"
            >
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              대시보드
            </button>
            <h1 className="text-2xl font-bold text-black">{classDetails.name} 학급 분석</h1>
          </div>
        </header>
        
        {/* 분석 실행 버튼 */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                <SparklesIcon className="w-5 h-5 text-indigo-500 mr-2" />
                GPT 기반 학급 관계 분석
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                학생들의 관계 데이터를 AI가 분석하여 학급 내 사회적 역학 구조와 관계 패턴을 파악합니다.
              </p>
              <p className="text-xs text-gray-500 mt-1">
                분석은 종합분석 및 학생그룹별 분석으로 나누어 진행됩니다.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={runFullAnalysisSequentially}
                disabled={isAnyRunning}
                className="px-4 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 shadow focus:outline-none focus:ring-2 focus:ring-indigo-300 flex items-center disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isAnyRunning ? (
                  <>
                    <ArrowPathIcon className="w-5 h-5 animate-spin mr-2" />
                    분석 중...
                  </>
                ) : (
                  <>
                    <SparklesIcon className="w-5 h-5 mr-2" />
                    새 분석 실행
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
        
        {/* 분석 결과 설명 */}
        <div className="bg-white shadow-md rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-2 mb-3">
            <DocumentTextIcon className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-800">분석 결과 목록</h2>
          </div>
          <p className="text-sm text-gray-600">
            각 분석 결과를 클릭하면 상세 내용을 볼 수 있습니다. 상세 페이지에서 종합분석과 학생그룹별 분석을 탭으로 확인할 수 있습니다.
          </p>
        </div>
        
        {/* 분석 결과 목록 */}
        <div className="mt-8">
          {isResultsLoading ? (
            <div className="flex justify-center items-center p-12">
              <ArrowPathIcon className="w-6 h-6 animate-spin text-indigo-500" />
              <span className="ml-2 text-indigo-500">로딩 중...</span>
            </div>
          ) : analysisResults && analysisResults.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {analysisResults.map((analysis) => (
                  <AnalysisCard
                    key={analysis.id}
                    analysis={analysis}
                  />
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="bg-gray-100 text-gray-600 p-8 rounded-lg text-center">
              <p className="mb-4">분석 결과가 없습니다.</p>
              <p className="text-sm">위의 '새 분석 실행' 버튼을 눌러 분석을 시작해보세요.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 