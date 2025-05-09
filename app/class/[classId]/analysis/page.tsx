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
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import UserProfile from '@/components/UserProfile';

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
  const response = await fetch(`/api/class/${classId}/analysis`);
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || '분석 결과를 불러오는데 실패했습니다.');
  }
  
  return response.json();
}

// 특정 분석 결과 조회 함수
async function fetchAnalysisDetail(classId: string, analysisId: string): Promise<AnalysisResult> {
  const response = await fetch(`/api/class/${classId}/analysis/${analysisId}`);
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || '분석 결과 상세 정보를 불러오는데 실패했습니다.');
  }
  
  return response.json();
}

// 분석 실행 함수
async function runAnalysis(classId: string): Promise<AnalysisResult> {
  const response = await fetch(`/api/class/${classId}/analysis`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || '분석을 실행하는데 실패했습니다.');
  }
  
  return response.json();
}

// 분석 카드 컴포넌트
interface AnalysisCardProps {
  analysis: AnalysisResult;
  onClick: () => void;
  isSelected: boolean;
}

function AnalysisCard({ analysis, onClick, isSelected }: AnalysisCardProps) {
  const createdAt = new Date(analysis.created_at);
  const formattedDate = format(createdAt, 'yyyy년 MM월 dd일', { locale: ko });
  const formattedTime = format(createdAt, 'HH:mm', { locale: ko });
  
  return (
    <motion.div
      className={`bg-white rounded-lg shadow-md p-4 cursor-pointer transition-all duration-300 hover:shadow-lg ${
        isSelected ? 'border-2 border-indigo-500 bg-indigo-50' : ''
      }`}
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      layout
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <div className="bg-indigo-100 text-indigo-600 p-2 rounded-full">
            <DocumentTextIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-medium text-gray-800">{formattedDate}</h3>
            <p className="text-sm text-gray-500">{formattedTime}</p>
          </div>
        </div>
        <ChevronRightIcon className="w-5 h-5 text-gray-400" />
      </div>
      <div className="mt-3">
        <p className="text-sm text-gray-600 line-clamp-2">{analysis.summary}</p>
      </div>
    </motion.div>
  );
}

// 분석 결과 상세 컴포넌트
interface AnalysisDetailProps {
  analysis: AnalysisResult;
}

function AnalysisDetail({ analysis }: AnalysisDetailProps) {
  const createdAt = new Date(analysis.created_at);
  const formattedDate = format(createdAt, 'yyyy년 MM월 dd일 HH:mm', { locale: ko });
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-100 text-indigo-600 p-2 rounded-full">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-medium text-gray-800">분석 일시</h3>
            <p className="text-sm text-gray-500">{formattedDate}</p>
          </div>
        </div>
      </div>
      
      {/* 전체 분석 요약 */}
      <div className="border-l-4 border-indigo-500 pl-4 py-2 bg-indigo-50 rounded-r-md">
        <h3 className="text-lg font-semibold text-indigo-700 mb-2">분석 요약</h3>
        <p className="text-gray-700 whitespace-pre-line">{analysis.result_data.analysis}</p>
      </div>
      
      {/* 관계 분석 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">관계 분석</h3>
        <p className="text-gray-700">{analysis.result_data.relationships.description}</p>
        
        {analysis.result_data.relationships.issues && analysis.result_data.relationships.issues.length > 0 && (
          <div className="mt-4">
            <h4 className="font-medium text-gray-700 mb-2">주요 이슈</h4>
            <ul className="list-disc list-inside space-y-1 pl-4">
              {analysis.result_data.relationships.issues.map((issue, index) => (
                <li key={index} className="text-gray-600">{issue}</li>
              ))}
            </ul>
          </div>
        )}
        
        {analysis.result_data.relationships.recommendations && analysis.result_data.relationships.recommendations.length > 0 && (
          <div className="mt-4">
            <h4 className="font-medium text-gray-700 mb-2">권장 사항</h4>
            <ul className="list-disc list-inside space-y-1 pl-4">
              {analysis.result_data.relationships.recommendations.map((rec, index) => (
                <li key={index} className="text-gray-600">{rec}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      
      {/* 사회적 역학 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">사회적 역학</h3>
        <p className="text-gray-700">{analysis.result_data.socialDynamics.description}</p>
        
        {analysis.result_data.socialDynamics.strongConnections && analysis.result_data.socialDynamics.strongConnections.length > 0 && (
          <div className="mt-4">
            <h4 className="font-medium text-gray-700 mb-2">강한 유대 관계</h4>
            <ul className="list-disc list-inside space-y-1 pl-4">
              {analysis.result_data.socialDynamics.strongConnections.map((connection, index) => (
                <li key={index} className="text-gray-600">{connection}</li>
              ))}
            </ul>
          </div>
        )}
        
        {analysis.result_data.socialDynamics.isolatedStudents && analysis.result_data.socialDynamics.isolatedStudents.length > 0 && (
          <div className="mt-4">
            <h4 className="font-medium text-gray-700 mb-2">고립된 학생</h4>
            <ul className="list-disc list-inside space-y-1 pl-4">
              {analysis.result_data.socialDynamics.isolatedStudents.map((student, index) => (
                <li key={index} className="text-gray-600">{student}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ClassAnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const classId = params.classId as string;
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null);
  
  // 학급 정보 조회
  const { data: classDetails, isLoading: isClassLoading } = useQuery({
    queryKey: ['classDetails', classId],
    queryFn: () => fetchClassDetails(classId),
    enabled: !!classId,
  });
  
  // 분석 결과 목록 조회
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
  
  // 선택한 분석 결과 상세 조회
  const { 
    data: selectedAnalysis,
    isLoading: isDetailLoading
  } = useQuery({
    queryKey: ['analysisDetail', classId, selectedAnalysisId],
    queryFn: () => fetchAnalysisDetail(classId, selectedAnalysisId!),
    enabled: !!selectedAnalysisId,
  });
  
  // 분석 실행 Mutation
  const runAnalysisMutation = useMutation({
    mutationFn: () => runAnalysis(classId),
    onSuccess: (newAnalysis) => {
      queryClient.invalidateQueries({ queryKey: ['analysisResults', classId] });
      setSelectedAnalysisId(newAnalysis.id);
      toast.success('분석이 완료되었습니다.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '분석 실행 중 오류가 발생했습니다.');
    },
  });
  
  const handleRunAnalysis = () => {
    runAnalysisMutation.mutate();
  };
  
  const handleSelectAnalysis = (analysisId: string) => {
    setSelectedAnalysisId(analysisId);
  };
  
  const isLoading = isClassLoading || isResultsLoading;
  
  if (isLoading) {
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
        <header className="mb-8 flex justify-between items-center bg-white p-4 rounded-lg shadow-md">
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
          <UserProfile />
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
            </div>
            <button
              onClick={handleRunAnalysis}
              disabled={runAnalysisMutation.isPending}
              className="px-4 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 shadow focus:outline-none focus:ring-2 focus:ring-indigo-300 flex items-center disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {runAnalysisMutation.isPending ? (
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
        
        {/* 분석 결과 목록 및 상세 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* 분석 결과 목록 */}
          <div className="md:col-span-1">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <CalendarIcon className="w-5 h-5 text-indigo-500 mr-2" />
              분석 결과 목록
            </h2>
            
            {analysisResults && analysisResults.length > 0 ? (
              <div className="space-y-4 overflow-y-auto max-h-[600px] pr-2">
                <AnimatePresence>
                  {analysisResults.map((analysis) => (
                    <AnalysisCard
                      key={analysis.id}
                      analysis={analysis}
                      onClick={() => handleSelectAnalysis(analysis.id)}
                      isSelected={selectedAnalysisId === analysis.id}
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
          
          {/* 분석 결과 상세 */}
          <div className="md:col-span-2">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <DocumentTextIcon className="w-5 h-5 text-indigo-500 mr-2" />
              분석 결과 상세
            </h2>
            
            {isDetailLoading ? (
              <div className="bg-white rounded-lg shadow-md p-10 flex justify-center items-center">
                <ArrowPathIcon className="w-8 h-8 animate-spin text-indigo-500" />
                <div className="text-indigo-500 ml-3">분석 결과 불러오는 중...</div>
              </div>
            ) : selectedAnalysis ? (
              <AnalysisDetail analysis={selectedAnalysis} />
            ) : (
              <div className="bg-gray-100 text-gray-600 p-10 rounded-lg text-center">
                <p className="mb-4">왼쪽에서 분석 결과를 선택해주세요.</p>
                <p className="text-sm">분석 결과가 없다면 '새 분석 실행' 버튼을 눌러 분석을 시작해보세요.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 