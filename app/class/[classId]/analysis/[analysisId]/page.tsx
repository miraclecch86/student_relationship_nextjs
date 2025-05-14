'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, Class } from '@/lib/supabase';
import {
  ArrowLeftIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  SparklesIcon,
  DocumentDuplicateIcon
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import toast from 'react-hot-toast';

// 분석 결과 타입 정의
interface AnalysisResult {
  id: string;
  class_id: string;
  created_at: string;
  result_data: string; // 마크다운 또는 JSON 문자열
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

// 분석 결과 조회 함수
async function fetchAnalysisResult(analysisId: string): Promise<AnalysisResult | null> {
  const { data, error } = await supabase
    .from('analysis_results')
    .select('*')
    .eq('id', analysisId)
    .single();
  
  if (error) {
    console.error('Error fetching analysis result:', error);
    return null;
  }
  
  return data;
}

// 특정 타입의 최신 분석 결과 조회 함수
async function fetchLatestAnalysisResultByType(classId: string, type: string): Promise<AnalysisResult | null> {
  const { data, error } = await supabase
    .from('analysis_results')
    .select('*')
    .eq('class_id', classId)
    .eq('type', type)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (error) {
    console.error(`Error fetching ${type} analysis result:`, error);
    return null;
  }
  
  return data;
}

// 직접 GPT API를 호출하여 새 분석 실행하기
async function runAnalysis(classId: string, type: string): Promise<AnalysisResult> {
  let url = '';
  
  switch (type) {
    case 'overview':
      url = `/api/class/${classId}/analysis/overview`;
      break;
    case 'students-1':
      url = `/api/class/${classId}/analysis/students?group=1`;
      break;
    case 'students-2':
      url = `/api/class/${classId}/analysis/students?group=2`;
      break;
    case 'students-3':
      url = `/api/class/${classId}/analysis/students?group=3`;
      break;
    default:
      url = `/api/class/${classId}/analysis`;
  }
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`API 요청 실패: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('분석 실행 중 오류:', error);
    throw error;
  }
}

export default function AnalysisDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const classId = params.classId as string;
  const analysisId = params.analysisId as string;
  
  // 활성 탭 상태
  const [activeTab, setActiveTab] = useState<string>('overview');
  
  // 학급 정보 조회
  const { data: classDetails, isLoading: isClassLoading } = useQuery({
    queryKey: ['classDetails', classId],
    queryFn: () => fetchClassDetails(classId),
    enabled: !!classId,
  });
  
  // 현재 분석 결과 조회
  const { data: currentAnalysis, isLoading: isCurrentLoading } = useQuery({
    queryKey: ['analysisResult', analysisId],
    queryFn: () => fetchAnalysisResult(analysisId),
    enabled: !!analysisId,
  });
  
  // 종합 분석 결과 조회
  const { 
    data: overviewAnalysis, 
    isLoading: isOverviewLoading,
    refetch: refetchOverview
  } = useQuery({
    queryKey: ['analysisResult', classId, 'overview'],
    queryFn: () => fetchLatestAnalysisResultByType(classId, 'overview'),
    enabled: !!classId && activeTab === 'overview',
  });
  
  // 학생 그룹1 분석 결과 조회
  const { 
    data: students1Analysis, 
    isLoading: isStudents1Loading,
    refetch: refetchStudents1
  } = useQuery({
    queryKey: ['analysisResult', classId, 'students-1'],
    queryFn: () => fetchLatestAnalysisResultByType(classId, 'students-1'),
    enabled: !!classId && activeTab === 'students-1',
  });
  
  // 학생 그룹2 분석 결과 조회
  const { 
    data: students2Analysis, 
    isLoading: isStudents2Loading,
    refetch: refetchStudents2
  } = useQuery({
    queryKey: ['analysisResult', classId, 'students-2'],
    queryFn: () => fetchLatestAnalysisResultByType(classId, 'students-2'),
    enabled: !!classId && activeTab === 'students-2',
  });
  
  // 학생 그룹3 분석 결과 조회
  const { 
    data: students3Analysis, 
    isLoading: isStudents3Loading,
    refetch: refetchStudents3
  } = useQuery({
    queryKey: ['analysisResult', classId, 'students-3'],
    queryFn: () => fetchLatestAnalysisResultByType(classId, 'students-3'),
    enabled: !!classId && activeTab === 'students-3',
  });
  
  // 새 분석 실행 Mutation
  const runAnalysisMutation = useMutation({
    mutationFn: (type: string) => runAnalysis(classId, type),
    onMutate: (type) => {
      toast.loading(`${getTabTitle(type)} 분석을 실행 중입니다...`);
    },
    onSuccess: (data, type) => {
      toast.dismiss();
      toast.success(`${getTabTitle(type)} 분석이 완료되었습니다.`);
      
      // 분석 유형에 따라 쿼리 무효화 및 재조회
      queryClient.invalidateQueries({ queryKey: ['analysisResult', classId, type] });
      
      // 해당 유형의 분석 결과 다시 조회
      switch (type) {
        case 'overview':
          refetchOverview();
          break;
        case 'students-1':
          refetchStudents1();
          break;
        case 'students-2':
          refetchStudents2();
          break;
        case 'students-3':
          refetchStudents3();
          break;
      }
    },
    onError: (error, type) => {
      toast.dismiss();
      toast.error(`${getTabTitle(type)} 분석 중 오류가 발생했습니다.`);
      console.error('분석 오류:', error);
    }
  });
  
  // 새 분석 실행 핸들러
  const handleRunAnalysis = (type: string) => {
    runAnalysisMutation.mutate(type);
  };
  
  // 현재 분석 타입에 맞는 탭 타이틀 가져오기
  const getTabTitle = (type: string): string => {
    switch (type) {
      case 'overview': return '종합 분석';
      case 'students-1': return '학생 분석 1';
      case 'students-2': return '학생 분석 2';
      case 'students-3': return '학생 분석 3';
      case 'current': return currentAnalysis?.type ? getTabTitle(currentAnalysis.type) : '분석 결과';
      default: return '분석 결과';
    }
  };
  
  // 분석 결과 데이터 처리
  const getFormattedContent = (analysis: AnalysisResult | null) => {
    if (!analysis) return '';
    
    let content = '';
    
    try {
      // 결과가 JSON 문자열인지 확인
      if (typeof analysis.result_data === 'string') {
        try {
          // JSON 파싱 시도
          const parsed = JSON.parse(analysis.result_data);
          
          // 이전 형식 호환성 (분석 결과가 객체 내 필드로 있는 경우)
          if (parsed.analysis) {
            content = parsed.analysis;
          } else {
            // 그냥 문자열로 간주
            content = analysis.result_data;
          }
        } catch (e) {
          // 파싱 실패 시 문자열 그대로 사용
          content = analysis.result_data;
        }
      } else {
        // 이미 객체인 경우 (드문 경우)
        content = JSON.stringify(analysis.result_data);
      }
      
      // 필요없는 제목 제거 및 숫자 변환 
      content = content.replace(/# .*학급 .*보고서(\n|\r\n)?/g, '');
      
      // 학생분석 페이지 제목 제거
      if (activeTab.startsWith('students-')) {
        // 다양한 형태의 제목/소제목 제거
        content = content.replace(/# 학생 그룹 \d+ 개별 분석(\n|\r\n)?/g, '');
        content = content.replace(/## 개별 학생 분석(\n|\r\n)?/g, '');
        content = content.replace(/# 학생 그룹 \d+ 분석(\n|\r\n)?/g, '');
        content = content.replace(/## 학생 그룹 \d+ 분석(\n|\r\n)?/g, '');
        content = content.replace(/그룹 \d+ 개별 학생 분석(\n|\r\n)?/g, '');
        
        // 설명 텍스트 제거
        content = content.replace(/데이터를 기반으로 한 각 학생의 심리적, 사회적 분석과 발전적 제안을 제공합니다\.(\n|\r\n)?/g, '');
        content = content.replace(/이 분석에서는 그룹 \d+에 속한 학생들 각각에 대한 상세 분석을 제공합니다\.(\n|\r\n)?/g, '');
        
        // 그룹에 관한 설명 제거
        content = content.replace(/이 그룹에 해당하는 학생이 없습니다\.(\n|\r\n)?/g, '분석할 학생이 없습니다.');
        
        // 학생분석이 바로 시작하도록 상단 텍스트 완전히 제거
        const firstHeadingIndex = content.indexOf('### ');
        if (firstHeadingIndex > 0) {
          // "### " 앞의 모든 텍스트 제거
          content = content.substring(firstHeadingIndex);
        } else {
          // 학생 목록이 없는 페이지의 특수 처리
          const noStudentPattern = /학생 그룹 \d+ 분석[\s\S]*?이 그룹에 해당하는 학생이 없습니다/g;
          content = content.replace(noStudentPattern, '분석할 학생이 없습니다');
        }
      }
      
      // 종합분석 번호 변경
      content = content.replace(/## 4\./g, '## 4.');
      content = content.replace(/## 5\./g, '## 5.');
      content = content.replace(/## 6\./g, '## 6.');
      content = content.replace(/## 7\./g, '## 6.');
      
    } catch (e) {
      console.error('분석 결과 파싱 오류:', e);
      content = '분석 결과를 표시할 수 없습니다.';
    }
    
    return content;
  };
  
  // 현재 활성화된 탭에 대한 분석 결과 가져오기
  const getActiveAnalysis = () => {
    switch (activeTab) {
      case 'overview': return overviewAnalysis;
      case 'students-1': return students1Analysis;
      case 'students-2': return students2Analysis;
      case 'students-3': return students3Analysis;
      default: return overviewAnalysis;
    }
  };
  
  // 현재 활성화된 탭의 로딩 상태 확인
  const isActiveTabLoading = () => {
    switch (activeTab) {
      case 'overview': return isOverviewLoading;
      case 'students-1': return isStudents1Loading;
      case 'students-2': return isStudents2Loading;
      case 'students-3': return isStudents3Loading;
      default: return false;
    }
  };
  
  // 현재 활성화된 탭의 실행 중 상태 확인
  const isActiveTabRunning = () => {
    return runAnalysisMutation.isPending && runAnalysisMutation.variables === activeTab;
  };
  
  // 전체 로딩 상태 확인
  const isPageLoading = isCurrentLoading || isClassLoading;
  
  if (isPageLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100">
        <ArrowPathIcon className="w-8 h-8 animate-spin text-indigo-500" />
        <div className="text-xl text-indigo-500 ml-3">로딩 중...</div>
      </div>
    );
  }
  
  if (!currentAnalysis || !classDetails) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gray-100">
        <div className="text-2xl text-red-500 mb-4">분석 결과를 찾을 수 없습니다</div>
        <button
          onClick={() => router.push(`/class/${classId}/analysis`)}
          className="px-4 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600"
        >
          분석 목록으로 돌아가기
        </button>
      </div>
    );
  }
  
  // 날짜 포맷팅
  const createdAt = new Date(currentAnalysis.created_at);
  const formattedDate = format(createdAt, 'yyyy년 MM월 dd일', { locale: ko });
  const formattedTime = format(createdAt, 'HH:mm', { locale: ko });
  
  // 현재 활성화된 탭의 분석 결과
  const activeAnalysis = getActiveAnalysis();
  const isLoading = isActiveTabLoading();
  const isRunning = isActiveTabRunning();
  
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-screen-xl mx-auto px-4 py-8">
        {/* 헤더 */}
        <header className="mb-8 bg-white p-4 rounded-lg shadow-md">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(`/class/${classId}/analysis`)}
              className="px-4 py-2 text-sm bg-indigo-500 text-white rounded-md hover:bg-indigo-600 shadow focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-1 transition-all duration-200 flex items-center"
            >
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              분석 목록
            </button>
            <h1 className="text-2xl font-bold text-black">{classDetails.name} 분석 결과</h1>
          </div>
          <div className="mt-2 flex items-center text-gray-500">
            <DocumentTextIcon className="w-4 h-4 mr-2" />
            <span>{formattedDate} {formattedTime} 생성</span>
          </div>
        </header>
        
        {/* 탭 네비게이션 */}
        <div className="bg-white shadow-md rounded-lg p-4 mb-6">
          <div className="flex flex-wrap border-b border-gray-200">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 font-medium text-sm mr-2 ${
                activeTab === 'overview'
                  ? 'text-black font-bold'
                  : 'text-black'
              }`}
            >
              종합분석
            </button>
            <button
              onClick={() => setActiveTab('students-1')}
              className={`px-4 py-2 font-medium text-sm mr-2 ${
                activeTab === 'students-1'
                  ? 'text-black font-bold'
                  : 'text-black'
              }`}
            >
              학생분석 1
            </button>
            <button
              onClick={() => setActiveTab('students-2')}
              className={`px-4 py-2 font-medium text-sm mr-2 ${
                activeTab === 'students-2'
                  ? 'text-black font-bold'
                  : 'text-black'
              }`}
            >
              학생분석 2
            </button>
            <button
              onClick={() => setActiveTab('students-3')}
              className={`px-4 py-2 font-medium text-sm ${
                activeTab === 'students-3'
                  ? 'text-black font-bold'
                  : 'text-black'
              }`}
            >
              학생분석 3
            </button>
          </div>
          <div className="mt-2">
            <p className="text-sm text-gray-800 font-medium">
              {activeTab === 'overview' ? '전체 학급에 대한 종합 분석 결과' :
              activeTab === 'students-1' ? '학생 그룹 1에 대한 개별 분석 결과' :
              activeTab === 'students-2' ? '학생 그룹 2에 대한 개별 분석 결과' :
              '학생 그룹 3에 대한 개별 분석 결과'}
            </p>
          </div>
        </div>
        
        {/* 분석 결과 내용 */}
        {isLoading || isRunning ? (
          <div className="bg-white rounded-lg shadow-md p-6 flex flex-col justify-center items-center min-h-[400px]">
            <div className="mb-6 relative">
              <div className="w-20 h-20 rounded-full border-t-4 border-b-4 border-indigo-500 animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <SparklesIcon className="w-10 h-10 text-indigo-500 animate-pulse" />
              </div>
            </div>
            <div className="text-xl text-black font-semibold mb-3 text-center">
              {isRunning ? 'AI 분석을 실행 중입니다...' : '로딩 중...'}
            </div>
            <div className="text-sm text-gray-500 text-center max-w-md">
              {isRunning ? 
                '분석에는 약 1~2분이 소요됩니다. 대량의 학생 데이터를 처리하는 과정이라 시간이 다소 걸리니 잠시만 기다려주세요.' : 
                '분석 결과를 불러오고 있습니다...'}
            </div>
            <div className="mt-8 relative w-full max-w-md h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="absolute top-0 left-0 h-full bg-indigo-500 animate-loading-bar"></div>
            </div>
            <style jsx>{`
              @keyframes loadingBar {
                0% { width: 0%; }
                30% { width: 50%; }
                60% { width: 75%; }
                100% { width: 95%; }
              }
              .animate-loading-bar {
                animation: loadingBar 2s ease-in-out infinite;
              }
            `}</style>
          </div>
        ) : activeAnalysis ? (
          <div className="bg-white rounded-lg shadow-md p-10 relative">
            <button 
              onClick={() => {
                if (activeAnalysis) {
                  const content = getFormattedContent(activeAnalysis);
                  navigator.clipboard.writeText(content)
                    .then(() => toast.success('분석 내용이 클립보드에 복사되었습니다.'))
                    .catch(() => toast.error('복사하는 중에 오류가 발생했습니다.'));
                }
              }}
              className="absolute top-4 right-4 p-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors duration-200 flex items-center space-x-1"
              title="분석 내용 복사하기"
            >
              <div className="relative">
                <DocumentDuplicateIcon className="w-5 h-5 text-gray-600" />
                <div className="absolute top-0.5 left-0.5 w-5 h-5 border border-gray-600 rounded-sm -z-10"></div>
              </div>
              <span className="text-sm text-gray-700">복사</span>
            </button>
            <div className="prose prose-headings:text-black prose-headings:font-extrabold prose-headings:mb-6 prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-p:text-black prose-p:mb-6 prose-p:leading-7 prose-li:text-black prose-li:mb-2 prose-strong:font-bold prose-ul:mb-6 prose-ol:mb-6 max-w-none text-black leading-8" style={{ color: 'black !important' }}>
              <style>{`
                .prose * {
                  color: black !important;
                }
                .prose h1 {
                  font-size: 2.5rem !important;
                  font-weight: 900 !important;
                  margin-top: 2rem !important;
                  margin-bottom: 1.5rem !important;
                }
                .prose h2 {
                  font-size: 2rem !important;
                  font-weight: 800 !important;
                  margin-top: 1.75rem !important;
                  margin-bottom: 1.25rem !important;
                }
                .prose h3 {
                  font-size: 1.5rem !important;
                  font-weight: 700 !important;
                  margin-top: 1.5rem !important;
                  margin-bottom: 1rem !important;
                }
                .prose p, .prose li, .prose h1, .prose h2, .prose h3, .prose h4, .prose h5, .prose h6, .prose strong, .prose em, .prose blockquote, .prose code, .prose pre {
                  color: black !important;
                }
                .prose p {
                  margin-bottom: 1.25rem !important;
                  line-height: 1.8 !important;
                }
                .prose li {
                  margin-bottom: 0.75rem !important;
                }
                /* 학생 이름 강조 (### 다음의 이름) */
                .prose h3 + p strong:first-child, 
                .prose h3 strong:first-child,
                .prose h3 strong {
                  font-size: 1.3rem !important;
                  font-weight: 800 !important;
                }
              `}</style>
              <ReactMarkdown>
                {getFormattedContent(activeAnalysis)}
              </ReactMarkdown>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <h3 className="text-lg font-medium text-black">이 탭에 대한 분석 결과가 없습니다</h3>
            <p className="mt-2 text-black">분석을 실행하여 결과를 확인할 수 있습니다.</p>
            <button
              onClick={() => handleRunAnalysis(activeTab)}
              disabled={runAnalysisMutation.isPending}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 flex items-center gap-2 mx-auto"
            >
              <SparklesIcon className="w-5 h-5" />
              분석 실행하기
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 