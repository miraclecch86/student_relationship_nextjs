'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, Class, Student } from '@/lib/supabase';
import {
  DocumentTextIcon,
  ArrowPathIcon,
  SparklesIcon,
  DocumentDuplicateIcon,
  TableCellsIcon,
  DocumentIcon,
  ChartBarIcon,
  UserGroupIcon,
  UserIcon
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import toast from 'react-hot-toast';

// 분석 결과 타입 정의
interface AnalysisResult {
  id: string;
  class_id: string;
  created_at: string;
  result_data: string; // 마크다운 또는 JSON 문자열
  summary: string;
  type: string; // 'full', 'overview', 'students-1', 'students-2', 'students-3', 'students-4', 'students-5', 'students-6', 'students-7', 'students-8'
  session_id?: string; // 분석 세션 ID (여러 분석 결과가 같은 세션에 속함)
}

// 학급 정보 조회 함수
async function fetchClassDetails(classId: string): Promise<Class | null> {
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

// 학생 목록 조회 함수 추가
async function fetchStudents(classId: string): Promise<Student[]> {
  const { data, error } = await (supabase as any)
    .from('students')
    .select('*')
    .eq('class_id', classId)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });
  
  if (error) {
    console.error('Error fetching students:', error);
    return [];
  }
  
  return data;
}

// 분석 결과 조회 함수
async function fetchAnalysisResult(analysisId: string): Promise<AnalysisResult | null> {
  const { data, error } = await (supabase as any)
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
  const { data, error } = await (supabase as any)
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

// 직접 AI API를 호출하여 새 분석 실행하기
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
    case 'students-4':
      url = `/api/class/${classId}/analysis/students?group=4`;
      break;
    case 'students-5':
      url = `/api/class/${classId}/analysis/students?group=5`;
      break;
    case 'students-6':
      url = `/api/class/${classId}/analysis/students?group=6`;
      break;
    case 'students-7':
      url = `/api/class/${classId}/analysis/students?group=7`;
      break;
    case 'students-8':
      url = `/api/class/${classId}/analysis/students?group=8`;
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
  
  // 학생 목록 조회
  const { data: students = [] } = useQuery({
    queryKey: ['students', classId],
    queryFn: () => fetchStudents(classId),
    enabled: !!classId,
  });
  
  // 현재 분석 결과 조회
  const { data: currentAnalysis, isLoading: isCurrentLoading } = useQuery({
    queryKey: ['analysisResult', analysisId],
    queryFn: () => fetchAnalysisResult(analysisId),
    enabled: !!analysisId,
  });
  
  // 현재 분석 세션 ID 조회를 위한 쿼리
  const { data: analysisSession } = useQuery({
    queryKey: ['analysisSession', analysisId],
    queryFn: async () => {
      // 현재 분석 결과에서 세션 ID 가져오기
      if (currentAnalysis?.session_id) {
        return { sessionId: currentAnalysis.session_id };
      }
      
      // 세션 ID가 없는 경우: 기본 동작 유지 (이전 버전 호환성)
      return { sessionId: null };
    },
    enabled: !!currentAnalysis,
  });
  
  // 세션 ID 추출
  const sessionId = analysisSession?.sessionId;
  
  // 종합 분석 결과 조회 - 세션 ID가 있으면 해당 세션의 결과, 없으면 최신 결과
  const { 
    data: overviewAnalysis, 
    isLoading: isOverviewLoading,
    refetch: refetchOverview
  } = useQuery({
    queryKey: ['analysisResult', classId, 'overview', sessionId],
    queryFn: async () => {
      if (sessionId) {
        // 같은 세션의 'overview' 타입 분석 조회
        const { data, error } = await (supabase as any)
          .from('analysis_results')
          .select('*')
          .eq('class_id', classId)
          .eq('type', 'overview')
          .eq('session_id', sessionId)
          .single();
          
        if (error || !data) {
          // 세션 결과가 없으면 최신 결과 조회
          return fetchLatestAnalysisResultByType(classId, 'overview');
        }
        
        return data;
      } else {
        // 세션 ID가 없으면 기존 방식으로 최신 결과 조회
        return fetchLatestAnalysisResultByType(classId, 'overview');
      }
    },
    enabled: !!classId && activeTab === 'overview',
  });
  
  // 학생 그룹1 분석 결과 조회 - 세션 ID 기반
  const { 
    data: students1Analysis, 
    isLoading: isStudents1Loading,
    refetch: refetchStudents1
  } = useQuery({
    queryKey: ['analysisResult', classId, 'students-1', sessionId],
    queryFn: async () => {
      if (sessionId) {
        // 같은 세션의 'students-1' 타입 분석 조회
        const { data, error } = await (supabase as any)
          .from('analysis_results')
          .select('*')
          .eq('class_id', classId)
          .eq('type', 'students-1')
          .eq('session_id', sessionId)
          .single();
          
        if (error || !data) {
          // 세션 결과가 없으면 최신 결과 조회
          return fetchLatestAnalysisResultByType(classId, 'students-1');
        }
        
        return data;
      } else {
        // 세션 ID가 없으면 기존 방식으로 최신 결과 조회
        return fetchLatestAnalysisResultByType(classId, 'students-1');
      }
    },
    enabled: !!classId && activeTab === 'students-1',
  });
  
  // 학생 그룹2 분석 결과 조회 - 세션 ID 기반
  const { 
    data: students2Analysis, 
    isLoading: isStudents2Loading,
    refetch: refetchStudents2
  } = useQuery({
    queryKey: ['analysisResult', classId, 'students-2', sessionId],
    queryFn: async () => {
      if (sessionId) {
        // 같은 세션의 'students-2' 타입 분석 조회
        const { data, error } = await (supabase as any)
          .from('analysis_results')
          .select('*')
          .eq('class_id', classId)
          .eq('type', 'students-2')
          .eq('session_id', sessionId)
          .single();
          
        if (error || !data) {
          // 세션 결과가 없으면 최신 결과 조회
          return fetchLatestAnalysisResultByType(classId, 'students-2');
        }
        
        return data;
      } else {
        // 세션 ID가 없으면 기존 방식으로 최신 결과 조회
        return fetchLatestAnalysisResultByType(classId, 'students-2');
      }
    },
    enabled: !!classId && activeTab === 'students-2',
  });
  
  // 학생 그룹3 분석 결과 조회 - 세션 ID 기반
  const { 
    data: students3Analysis, 
    isLoading: isStudents3Loading,
    refetch: refetchStudents3
  } = useQuery({
    queryKey: ['analysisResult', classId, 'students-3', sessionId],
    queryFn: async () => {
      if (sessionId) {
        // 같은 세션의 'students-3' 타입 분석 조회
        const { data, error } = await (supabase as any)
          .from('analysis_results')
          .select('*')
          .eq('class_id', classId)
          .eq('type', 'students-3')
          .eq('session_id', sessionId)
          .single();
          
        if (error || !data) {
          // 세션 결과가 없으면 최신 결과 조회
          return fetchLatestAnalysisResultByType(classId, 'students-3');
        }
        
        return data;
      } else {
        // 세션 ID가 없으면 기존 방식으로 최신 결과 조회
        return fetchLatestAnalysisResultByType(classId, 'students-3');
      }
    },
    enabled: !!classId && activeTab === 'students-3',
  });
  
  // 학생 그룹4 분석 결과 조회 - 세션 ID 기반
  const { 
    data: students4Analysis, 
    isLoading: isStudents4Loading,
    refetch: refetchStudents4
  } = useQuery({
    queryKey: ['analysisResult', classId, 'students-4', sessionId],
    queryFn: async () => {
      if (sessionId) {
        // 같은 세션의 'students-4' 타입 분석 조회
        const { data, error } = await (supabase as any)
          .from('analysis_results')
          .select('*')
          .eq('class_id', classId)
          .eq('type', 'students-4')
          .eq('session_id', sessionId)
          .single();
          
        if (error || !data) {
          // 세션 결과가 없으면 최신 결과 조회
          return fetchLatestAnalysisResultByType(classId, 'students-4');
        }
        
        return data;
      } else {
        // 세션 ID가 없으면 기존 방식으로 최신 결과 조회
        return fetchLatestAnalysisResultByType(classId, 'students-4');
      }
    },
    enabled: !!classId && activeTab === 'students-4',
  });
  
  // 학생 그룹5 분석 결과 조회 - 세션 ID 기반
  const { 
    data: students5Analysis, 
    isLoading: isStudents5Loading,
    refetch: refetchStudents5
  } = useQuery({
    queryKey: ['analysisResult', classId, 'students-5', sessionId],
    queryFn: async () => {
      if (sessionId) {
        // 같은 세션의 'students-5' 타입 분석 조회
        const { data, error } = await (supabase as any)
          .from('analysis_results')
          .select('*')
          .eq('class_id', classId)
          .eq('type', 'students-5')
          .eq('session_id', sessionId)
          .single();
          
        if (error || !data) {
          // 세션 결과가 없으면 최신 결과 조회
          return fetchLatestAnalysisResultByType(classId, 'students-5');
        }
        
        return data;
      } else {
        // 세션 ID가 없으면 기존 방식으로 최신 결과 조회
        return fetchLatestAnalysisResultByType(classId, 'students-5');
      }
    },
    enabled: !!classId && activeTab === 'students-5',
  });
  
  // 학생 그룹6 분석 결과 조회 - 세션 ID 기반
  const { 
    data: students6Analysis, 
    isLoading: isStudents6Loading,
    refetch: refetchStudents6
  } = useQuery({
    queryKey: ['analysisResult', classId, 'students-6', sessionId],
    queryFn: async () => {
      if (sessionId) {
        // 같은 세션의 'students-6' 타입 분석 조회
        const { data, error } = await (supabase as any)
          .from('analysis_results')
          .select('*')
          .eq('class_id', classId)
          .eq('type', 'students-6')
          .eq('session_id', sessionId)
          .single();
          
        if (error || !data) {
          // 세션 결과가 없으면 최신 결과 조회
          return fetchLatestAnalysisResultByType(classId, 'students-6');
        }
        
        return data;
      } else {
        // 세션 ID가 없으면 기존 방식으로 최신 결과 조회
        return fetchLatestAnalysisResultByType(classId, 'students-6');
      }
    },
    enabled: !!classId && activeTab === 'students-6',
  });
  
  // 학생 그룹7 분석 결과 조회 - 세션 ID 기반
  const { 
    data: students7Analysis, 
    isLoading: isStudents7Loading,
    refetch: refetchStudents7
  } = useQuery({
    queryKey: ['analysisResult', classId, 'students-7', sessionId],
    queryFn: async () => {
      if (sessionId) {
        // 같은 세션의 'students-7' 타입 분석 조회
        const { data, error } = await (supabase as any)
          .from('analysis_results')
          .select('*')
          .eq('class_id', classId)
          .eq('type', 'students-7')
          .eq('session_id', sessionId)
          .single();
          
        if (error || !data) {
          // 세션 결과가 없으면 최신 결과 조회
          return fetchLatestAnalysisResultByType(classId, 'students-7');
        }
        
        return data;
      } else {
        // 세션 ID가 없으면 기존 방식으로 최신 결과 조회
        return fetchLatestAnalysisResultByType(classId, 'students-7');
      }
    },
    enabled: !!classId && activeTab === 'students-7',
  });
  
  // 학생 그룹8 분석 결과 조회 - 세션 ID 기반
  const { 
    data: students8Analysis, 
    isLoading: isStudents8Loading,
    refetch: refetchStudents8
  } = useQuery({
    queryKey: ['analysisResult', classId, 'students-8', sessionId],
    queryFn: async () => {
      if (sessionId) {
        // 같은 세션의 'students-8' 타입 분석 조회
        const { data, error } = await (supabase as any)
          .from('analysis_results')
          .select('*')
          .eq('class_id', classId)
          .eq('type', 'students-8')
          .eq('session_id', sessionId)
          .single();
          
        if (error || !data) {
          // 세션 결과가 없으면 최신 결과 조회
          return fetchLatestAnalysisResultByType(classId, 'students-8');
        }
        
        return data;
      } else {
        // 세션 ID가 없으면 기존 방식으로 최신 결과 조회
        return fetchLatestAnalysisResultByType(classId, 'students-8');
      }
    },
    enabled: !!classId && activeTab === 'students-8',
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
        case 'students-4':
          refetchStudents4();
          break;
        case 'students-5':
          refetchStudents5();
          break;
        case 'students-6':
          refetchStudents6();
          break;
        case 'students-7':
          refetchStudents7();
          break;
        case 'students-8':
          refetchStudents8();
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
      case 'students-4': return '학생 분석 4';
      case 'students-5': return '학생 분석 5';
      case 'students-6': return '학생 분석 6';
      case 'students-7': return '학생 분석 7';
      case 'students-8': return '학생 분석 8';
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
          
          // 통합 분석인 경우 (type='combined')
          if (analysis.type === 'combined') {
            // 현재 활성 탭에 따라 다른 내용 표시
            if (activeTab === 'overview' && parsed.overview) {
              content = typeof parsed.overview === 'string' ? parsed.overview : JSON.stringify(parsed.overview);
            } else if (activeTab === 'students-1' && parsed['students-1']) {
              content = typeof parsed['students-1'] === 'string' ? parsed['students-1'] : JSON.stringify(parsed['students-1']);
            } else if (activeTab === 'students-2' && parsed['students-2']) {
              content = typeof parsed['students-2'] === 'string' ? parsed['students-2'] : JSON.stringify(parsed['students-2']);
            } else if (activeTab === 'students-3' && parsed['students-3']) {
              content = typeof parsed['students-3'] === 'string' ? parsed['students-3'] : JSON.stringify(parsed['students-3']);
            } else {
              // 기본값: 종합 분석
              content = typeof parsed.overview === 'string' ? parsed.overview : JSON.stringify(parsed.overview);
            }
          }
          // 이전 형식 호환성 (분석 결과가 객체 내 필드로 있는 경우)
          else if (parsed.analysis) {
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
      

      
            // ===== 특수 케이스: 학생분석 페이지 정리 =====
      if (activeTab.startsWith('students-')) {
        // 불필요한 제목 및 설명 제거
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
        
        // 🔥 첫 번째 학생 누락 방지: 위험한 텍스트 자르기 로직 제거
        // 대신 필요없는 제목만 선별적으로 제거
        content = content.replace(/^# 개별 학생 심층 분석 보고서.*$/gm, '');
        content = content.replace(/^## ⚠️ 절대 준수 사항.*$/gm, '');
        content = content.replace(/^### 📝 각 학생별 표준 분석 구조.*$/gm, '');
        
        // 학생이 없는 경우만 특별 처리
        if (content.includes('분석할 학생이 없습니다') || content.includes('이 그룹에 해당하는 학생이 없습니다')) {
          content = '# 분석할 학생이 없습니다\n\n이 그룹에는 분석할 학생이 없습니다.';
        }
        
        // 구분선 형식 통일
        content = content.replace(/---+/g, '\n\n---\n\n');
        

      }
      

      
              // ===== 1. 하위 항목 제목 볼드체 처리 =====
      // 교실 활동, 교우 관계 전략 등
      const subSectionTitles = [
        '교실 활동', '교우 관계 전략', '그룹 활동 참여', '갈등 해결 및 의사소통 기술',
        '심리적 건강 지원', '자신감과 자아존중감 향상', '스트레스 관리', '동기 부여와 학습 탄력성'
      ];
      
      subSectionTitles.forEach(title => {
        content = content.replace(new RegExp(`^\\s*(${title}):\\s*(.*)$`, 'gm'), `**${title}:** $2`);
      });
      
      // ===== 2. 번호 매김 통일 =====
      // 번호가 있는 제안 항목 처리
      content = content.replace(/^(\d+\)\s*[^\n:]+)$/gm, '- **$1**');
      content = content.replace(/^(\d+\.\s*[^\n:]+)$/gm, '- **$1**');
      
      // ===== 3. 기타 키워드 및 특수 항목 강조 =====
      // 단기, 중기, 장기 계획 키워드 강조
      content = content.replace(/단기\(1-2주\):/g, '**단기(1-2주):**');
      content = content.replace(/중기\(1-2개월\):/g, '**중기(1-2개월):**');
      content = content.replace(/장기\(학기 전체\):/g, '**장기(학기 전체):**');
      
      // 활동 정보 강조
      const activityInfoItems = ['소요시간', '준비물', '진행 방법'];
      activityInfoItems.forEach(item => {
        content = content.replace(new RegExp(`${item}:`, 'g'), `**${item}:**`);
      });
      
      // 목적, 방법, 기대효과, 참고자료 스타일 통일 및 보라색으로 변경
      const keyItems = ['목적', '방법', '기대효과', '참고자료', '활동명', '준비물', '진행 방법', '소요시간'];
      
      keyItems.forEach(item => {
        // "항목:" 형식 (스페이스 없음)
        content = content.replace(new RegExp(`^(\\s*)${item}:(?![\\s\\S]*?<span)`, 'gm'), 
          `$1<span style="color: #4338ca; font-weight: 400; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;">${item}:</span> `);
        
        // "항목: " 형식 (스페이스 있음)
        content = content.replace(new RegExp(`^(\\s*)${item}: (?![\\s\\S]*?<span)`, 'gm'), 
          `$1<span style="color: #4338ca; font-weight: 400; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;">${item}:</span> `);
      });
      
      // ===== 4. 실행 가능한 활동 제안 처리 개선 =====
      // "실행 가능한 활동 제안" 섹션 강조 
      content = content.replace(/^(실행 가능한 활동 제안|실행 가능한 활동|구체적 활동 제안)(\s*|:)/gm, 
        '<div style="color: #4338ca; font-weight: 400; margin-top: 1rem; margin-bottom: 0.5rem;">실행 가능한 활동 제안</div>');
      
      // 활동명 패턴 처리 (다양한 형식 포함)
      // 예: 1. **학급 안전감 규칙 만들기, 2. **아침 인사 루틴 등
      content = content.replace(/(\d+\.\s*)\*\*([^*\n]+)\*\*/g, 
        '<div style="color: #4338ca; font-weight: 400; margin-top: 1rem;">$1$2</div>');
      
      // 참고 자료 링크 처리 개선
      content = content.replace(/\*\*참고 자료 링크\*\*:\s*\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g, 
        '<div style="margin-top: 0.5rem;"><span style="color: #4338ca; font-weight: 400;">참고 자료:</span> <a href="$2" target="_blank" style="color: #2563eb; text-decoration: underline;">$1</a></div>');
      
      // 괄호 안의 URL 형식 처리 (https://www.edunet.net/... 형식)
      content = content.replace(/\((https?:\/\/[^\s)]+)\)/g, 
        '<a href="$1" target="_blank" style="color: #2563eb; text-decoration: underline;">$1</a>');
      
      return content;
    } catch (error) {
      console.error('분석 결과 포맷팅 오류:', error);
      return analysis?.result_data || '분석 결과를 불러오는 중 오류가 발생했습니다.';
    }
  }
  
  // 현재 활성화된 탭에 대한 분석 결과 가져오기
  const getActiveAnalysis = () => {
    // 만약 currentAnalysis가 있고, 그 type이 현재 활성 탭과 일치하면 현재 분석 결과를 반환
    if (currentAnalysis && currentAnalysis.type === activeTab) {
      return currentAnalysis;
    }
    
    // 그렇지 않으면 세션 기반으로 가져온 결과 반환
    switch (activeTab) {
      case 'overview': return overviewAnalysis;
      case 'students-1': return students1Analysis;
      case 'students-2': return students2Analysis;
      case 'students-3': return students3Analysis;
      case 'students-4': return students4Analysis;
      case 'students-5': return students5Analysis;
      case 'students-6': return students6Analysis;
      case 'students-7': return students7Analysis;
      case 'students-8': return students8Analysis;
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
      case 'students-4': return isStudents4Loading;
      case 'students-5': return isStudents5Loading;
      case 'students-6': return isStudents6Loading;
      case 'students-7': return isStudents7Loading;
      case 'students-8': return isStudents8Loading;
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
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* 헤더 */}
        <header className="mb-8 bg-white p-4 rounded-lg shadow-md">
          <h1 className="text-2xl font-bold text-black">{classDetails.name} 분석 결과</h1>
          <div className="mt-2 flex items-center text-gray-500">
            <DocumentTextIcon className="w-4 h-4 mr-2" />
            <span>{formattedDate} {formattedTime} 생성</span>
          </div>
        </header>
        
        {/* 탭 네비게이션 */}
        <div className="bg-white shadow-md rounded-lg p-5 mb-6">
          <h2 className="text-xl font-bold text-black mb-3">분석 결과</h2>
          <div className="flex flex-wrap border-b border-gray-200 gap-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-2 font-medium text-sm rounded-t-lg flex items-center ${
                activeTab === 'overview'
                  ? 'text-indigo-700 font-bold border-b-2 border-indigo-500'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <ChartBarIcon className="w-4 h-4 mr-1" />
              종합분석
            </button>
            <button
              onClick={() => setActiveTab('students-1')}
              className={`px-3 py-2 font-medium text-sm rounded-t-lg flex items-center ${
                activeTab === 'students-1'
                  ? 'text-indigo-700 font-bold border-b-2 border-indigo-500'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <UserGroupIcon className="w-4 h-4 mr-1" />
              학생분석 1
            </button>
            <button
              onClick={() => setActiveTab('students-2')}
              className={`px-3 py-2 font-medium text-sm rounded-t-lg flex items-center ${
                activeTab === 'students-2'
                  ? 'text-indigo-700 font-bold border-b-2 border-indigo-500'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <UserGroupIcon className="w-4 h-4 mr-1" />
              학생분석 2
            </button>
            <button
              onClick={() => setActiveTab('students-3')}
              className={`px-3 py-2 font-medium text-sm rounded-t-lg flex items-center ${
                activeTab === 'students-3'
                  ? 'text-indigo-700 font-bold border-b-2 border-indigo-500'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <UserGroupIcon className="w-4 h-4 mr-1" />
              학생분석 3
            </button>
            <button
              onClick={() => setActiveTab('students-4')}
              className={`px-3 py-2 font-medium text-sm rounded-t-lg flex items-center ${
                activeTab === 'students-4'
                  ? 'text-indigo-700 font-bold border-b-2 border-indigo-500'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <UserGroupIcon className="w-4 h-4 mr-1" />
              학생분석 4
            </button>
            <button
              onClick={() => setActiveTab('students-5')}
              className={`px-3 py-2 font-medium text-sm rounded-t-lg flex items-center ${
                activeTab === 'students-5'
                  ? 'text-indigo-700 font-bold border-b-2 border-indigo-500'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <UserGroupIcon className="w-4 h-4 mr-1" />
              학생분석 5
            </button>
            <button
              onClick={() => setActiveTab('students-6')}
              className={`px-3 py-2 font-medium text-sm rounded-t-lg flex items-center ${
                activeTab === 'students-6'
                  ? 'text-indigo-700 font-bold border-b-2 border-indigo-500'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <UserGroupIcon className="w-4 h-4 mr-1" />
              학생분석 6
            </button>
            <button
              onClick={() => setActiveTab('students-7')}
              className={`px-3 py-2 font-medium text-sm rounded-t-lg flex items-center ${
                activeTab === 'students-7'
                  ? 'text-indigo-700 font-bold border-b-2 border-indigo-500'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <UserGroupIcon className="w-4 h-4 mr-1" />
              학생분석 7
            </button>
            <button
              onClick={() => setActiveTab('students-8')}
              className={`px-3 py-2 font-medium text-sm rounded-t-lg flex items-center ${
                activeTab === 'students-8'
                  ? 'text-indigo-700 font-bold border-b-2 border-indigo-500'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <UserGroupIcon className="w-4 h-4 mr-1" />
              학생분석 8
            </button>
          </div>
          <div className={`mt-3 p-3 rounded-md border border-gray-200 text-gray-700`}>
            <div className="flex items-center">
              {activeTab === 'overview' ? (
                <ChartBarIcon className="w-5 h-5 mr-2 flex-shrink-0" />
              ) : activeTab === 'students-1' || activeTab === 'students-2' || activeTab === 'students-3' || activeTab === 'students-4' || activeTab === 'students-5' || activeTab === 'students-6' || activeTab === 'students-7' || activeTab === 'students-8' ? (
                <UserGroupIcon className="w-5 h-5 mr-2 flex-shrink-0" />
              ) : (
                <UserGroupIcon className="w-5 h-5 mr-2 flex-shrink-0" />
              )}
              <p className="text-sm font-medium">
                {activeTab === 'overview' ? '전체 학급에 대한 종합 분석 결과를 확인합니다. 학급 내 관계 패턴, 네트워크 구조, 그리고 사회적 역학에 대한 통찰을 제공합니다.' :
                activeTab === 'students-1' ? '학생 그룹 1에 대한 개별 분석 결과를 확인합니다. 각 학생의 관계 현황, 강점 및 개선 가능한 영역을 확인할 수 있습니다.' :
                activeTab === 'students-2' ? '학생 그룹 2에 대한 개별 분석 결과를 확인합니다. 각 학생의 관계 현황, 강점 및 개선 가능한 영역을 확인할 수 있습니다.' :
                activeTab === 'students-3' ? '학생 그룹 3에 대한 개별 분석 결과를 확인합니다. 각 학생의 관계 현황, 강점 및 개선 가능한 영역을 확인할 수 있습니다.' :
                activeTab === 'students-4' ? '학생 그룹 4에 대한 개별 분석 결과를 확인합니다. 각 학생의 관계 현황, 강점 및 개선 가능한 영역을 확인할 수 있습니다.' :
                activeTab === 'students-5' ? '학생 그룹 5에 대한 개별 분석 결과를 확인합니다. 각 학생의 관계 현황, 강점 및 개선 가능한 영역을 확인할 수 있습니다.' :
                activeTab === 'students-6' ? '학생 그룹 6에 대한 개별 분석 결과를 확인합니다. 각 학생의 관계 현황, 강점 및 개선 가능한 영역을 확인할 수 있습니다.' :
                activeTab === 'students-7' ? '학생 그룹 7에 대한 개별 분석 결과를 확인합니다. 각 학생의 관계 현황, 강점 및 개선 가능한 영역을 확인할 수 있습니다.' :
                '학생 그룹 8에 대한 개별 분석 결과를 확인합니다. 각 학생의 관계 현황, 강점 및 개선 가능한 영역을 확인할 수 있습니다.'}
              </p>
            </div>
          </div>
        </div>
        
        {/* 분석 결과 내용 */}
        {isLoading || isRunning ? (
          <div className="bg-white rounded-lg shadow-md p-6 flex flex-col justify-center items-center min-h-[400px] border border-gray-200">
            <div className="mb-6 relative">
              <div className="w-20 h-20 rounded-full border-t-4 border-b-4 border-indigo-500 animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <SparklesIcon className="w-10 h-10 text-indigo-500 animate-pulse" />
              </div>
            </div>
            <div className="text-xl text-indigo-700 font-semibold mb-3 text-center">
              {isRunning ? 'AI 분석을 실행 중입니다...' : '분석 결과 로딩 중...'}
            </div>
            <div className="text-sm text-gray-600 text-center max-w-md">
              {isRunning ? 
                '분석에는 약 1~2분이 소요됩니다. 대량의 학생 데이터를 처리하는 과정이라 시간이 다소 걸리니 잠시만 기다려주세요.' : 
                `${getTabTitle(activeTab)} 결과를 불러오고 있습니다...`}
            </div>
            <div className="mt-8 relative w-full max-w-md h-2 bg-gray-100 rounded-full overflow-hidden">
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
          <div className="bg-white rounded-lg shadow-md p-6 relative">
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
            <div className="prose max-w-none text-black">
              <style>{`
                /* 기본 텍스트 스타일 설정 */
                .prose * {
                  color: black !important;
                  font-size: 1rem !important;
                  line-height: 1.6 !important;
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
                }
                
                /* 본문 텍스트 일반 굵기로 */
                .prose p {
                  font-weight: 400 !important;
                  margin-top: 0.75rem !important;
                  margin-bottom: 0.75rem !important;
                  line-height: 1.6 !important;
                  text-align: justify !important;
                }
                
                /* 모든 제목 크기와 스타일 통일 */
                .prose h1, .prose h2, .prose h3, .prose h4, .prose h5, .prose h6 {
                  font-size: 1rem !important;
                  margin-top: 1.5rem !important;
                  margin-bottom: 0.5rem !important;
                  padding-bottom: 0.3rem !important;
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
                }
                
                /* H2, H3 제목 굵게 */
                .prose h2, .prose h3 {
                  font-weight: 700 !important;
                  color: #4338ca !important;
                }
                
                /* 제목 계층별 밑줄 스타일만 차별화 */
                /* 학생 이름을 위한 h1 스타일 */
                .prose h1 {
                  font-size: 1.5rem !important;
                  font-weight: 700 !important;
                  color: #4338ca !important;
                  border-bottom: 2px solid #4338ca !important;
                  margin-top: 2.5rem !important;
                  margin-bottom: 1rem !important;
                  padding-bottom: 0.5rem !important;
                }
                
                .prose h2 {
                  border-bottom: 1px solid #e5e7eb !important;
                }
                
                .prose h3 {
                  border-bottom: 1px dotted #e5e7eb !important;
                }
                
                /* 숫자가 달린 소제목과 학생 이름 모두 파란색으로 통일 */
                .prose h1, .prose h2, .prose h3,
                .prose h1 strong, 
                .prose h2 strong,
                .prose h3 strong {
                  color: #4338ca !important; /* 파란색(#2563eb)에서 보라색(#4338ca)으로 변경 */
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
                }
                

                
                /* 목록 스타일 통일 */
                .prose ul, .prose ol {
                  margin-top: 0.5rem !important;
                  margin-bottom: 0.5rem !important;
                  padding-left: 1.5rem !important;
                }
                
                .prose li {
                  margin-top: 0.3rem !important;
                  margin-bottom: 0.3rem !important;
                  line-height: 1.5 !important;
                }
                
                /* 단기/중기/장기 계획 스타일 통일 */
                .prose p:has(strong:contains("단기(1-2주)")) {
                  border-left: 3px solid #3b82f6 !important;
                  padding-left: 0.75rem !important;
                  margin: 0.75rem 0 !important;
                  background-color: #f9fafb !important;
                  padding: 0.5rem 0.75rem !important;
                }
                
                .prose p:has(strong:contains("중기(1-2개월)")) {
                  border-left: 3px solid #8b5cf6 !important;
                  padding-left: 0.75rem !important;
                  margin: 0.75rem 0 !important;
                  background-color: #f9fafb !important;
                  padding: 0.5rem 0.75rem !important;
                }
                
                .prose p:has(strong:contains("장기(학기 전체)")) {
                  border-left: 3px solid #10b981 !important;
                  padding-left: 0.75rem !important;
                  margin: 0.75rem 0 !important;
                  background-color: #f9fafb !important;
                  padding: 0.5rem 0.75rem !important;
                }
                
                /* 하위 섹션 제목 스타일 통일 */
                .prose p:has(strong:first-child) {
                  margin-top: 1rem !important;
                  font-weight: 400 !important;
                }
                
                /* 심리적 특성 분석 등 주요 섹션 제목 강조 */
                p:has(strong:contains("심리적 특성 분석")),
                p:has(strong:contains("심리적 특성 및 발달 단계 분석")),
                p:has(strong:contains("성격 유형 및 행동 패턴")),
                p:has(strong:contains("관계 분석")),
                p:has(strong:contains("사회적 위치와 영향력")),
                p:has(strong:contains("관계 패턴 및 주요 교우 관계")),
                p:has(strong:contains("강점과 과제")),
                p:has(strong:contains("강점과 잠재력")),
                p:has(strong:contains("직면한 어려움 또는 도전 과제")),
                p:has(strong:contains("발전을 위한 구체적 제안")) {
                  background-color: #f3f4f6 !important;
                  padding: 0.5rem 0.75rem !important;
                  border-radius: 0.25rem !important;
                  margin-top: 1.25rem !important;
                  font-weight: 400 !important;
                }
                
                /* 볼드체 강조 일관성 */
                .prose strong {
                  font-weight: 700 !important;
                  color: black !important;
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
                }
                
                /* 링크 스타일 통일 */
                .prose a {
                  color: #4338ca !important; /* 파란색(#2563eb)에서 보라색(#4338ca)으로 변경 */
                  text-decoration: underline !important;
                  font-weight: 400 !important;
                }
                
                /* 구분선 스타일 */
                .prose hr {
                  margin: 1.5rem 0 !important;
                  border-color: #e5e7eb !important;
                  border-width: 1px !important;
                }
                
                /* 학생분석 섹션 간 간격 통일 */
                .prose > * + * {
                  margin-top: 1rem !important;
                }
                
                /* 인용구 스타일 통일 */
                .prose blockquote {
                  border-left: 4px solid #d1d5db !important;
                  margin: 1rem 0 !important;
                  padding-left: 1rem !important;
                  font-style: italic !important;
                  color: #6b7280 !important;
                }
                
                /* 코드 블록 스타일 통일 */
                .prose pre {
                  background-color: #f3f4f6 !important;
                  padding: 1rem !important;
                  border-radius: 0.375rem !important;
                  overflow-x: auto !important;
                }
                
                /* 인라인 코드 스타일 */
                .prose code {
                  background-color: #f3f4f6 !important;
                  padding: 0.2rem 0.4rem !important;
                  border-radius: 0.25rem !important;
                  font-size: 0.875rem !important;
                }
                
                /* 전체 컨테이너 패딩 */
                .prose {
                  padding: 1rem !important;
                }

                /* 활동명, 목적 등의 키워드 스타일 */
                .prose span[style*="color: #4338ca"] {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
                  font-weight: 400 !important;
                  display: inline-block !important;
                }
                
                /* 활동명, 목적 등 키워드 관련 태그 직접 지정 */
                span[style*="활동명"], span[style*="목적"], span[style*="방법"], 
                span[style*="준비물"], span[style*="진행 방법"], span[style*="소요시간"],
                span[style*="기대효과"], span[style*="참고자료"] {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
                  font-weight: 400 !important;
                  color: #4338ca !important;
                }
                
                /* 보라색으로 표시되는 모든 텍스트 */
                [style*="color: #4338ca"] {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
                }
              `}</style>
              <ReactMarkdown rehypePlugins={[rehypeRaw]}
                components={{
                  // h1, h2: 보라색 제목 렌더링
                  h1: ({ node, ...props }) => {
                    const text = props.children?.toString() || '';
                    // 학생 이름을 위한 특별 스타일링 (모든 h1 태그 적용)
                    return (
                      <h1 style={{ 
                        color: '#4338ca', 
                        fontWeight: '500',
                        fontSize: '1.5rem',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                        borderBottom: '2px solid #4338ca',
                        marginTop: '2.5rem',
                        marginBottom: '1rem',
                        paddingBottom: '0.5rem'
                      }} {...props} />
                    );
                  },
                  h2: ({ node, ...props }) => {
                    return <h2 {...props} />;
                  },
                  p: ({ node, ...props }) => {
                    const text = props.children?.toString() || '';
                    
                    // 목적, 방법, 기대효과, 참고자료가 포함된 텍스트를 찾아 스타일 적용
                    const keyItems = ['목적', '방법', '기대효과', '참고자료', '활동명', '준비물', '진행 방법', '소요시간'];
                    for (const item of keyItems) {
                      if (text.startsWith(`${item}:`) || text.includes(`${item}: `)) {
                        // 라벨과 내용 분리
                        const colonIndex = text.indexOf(':');
                        if (colonIndex !== -1) {
                          const label = text.substring(0, colonIndex + 1);
                          const content = text.substring(colonIndex + 1);
                          
                          // 스타일이 적용된 라벨과 내용을 결합해 반환
                          return (
                            <p>
                              <span style={{ 
                                color: '#4338ca', 
                                fontWeight: '400',
                                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                                display: 'inline-block'
                              }}>
                                {label}
                              </span>
                              {content}
                            </p>
                          );
                        }
                      }
                    }
                    
                    // 일반 텍스트는 그대로 반환
                    return <p {...props} />;
                  },
                }}
              >
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