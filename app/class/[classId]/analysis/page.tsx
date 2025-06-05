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
  PencilIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import ConfirmModal from '@/components/ConfirmModal';
import { handleDemoSaveAttempt, isDemoClass } from '@/utils/demo-permissions';

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
  session_id?: string; // 세션 ID 추가
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

// UUID 생성 함수 추가
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0,
        v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// 분석 결과 목록 조회 함수
async function fetchAnalysisResults(classId: string): Promise<AnalysisResult[]> {
  console.log(`분석 목록 요청: classId=${classId}`);
  
  try {
    // 세션별 그룹화 활성화
    const response = await fetch(`/api/class/${classId}/analysis?group_by_session=true`);
    
    if (!response.ok) {
      throw new Error(`분석 결과를 불러오는데 실패했습니다 (${response.status})`);
    }
    
    const data = await response.json();
    console.log(`분석 목록 수신 성공, ${data ? data.length : 0}개의 결과 (세션별 그룹화됨)`);
    
    // 🔍 데이터 구조 상세 로그
    if (data && data.length > 0) {
      console.log('🔍 첫 번째 분석 결과 상세:', data[0]);
      console.log('🔍 result_data 타입:', typeof data[0].result_data);
      console.log('🔍 result_data 내용 (첫 100자):', 
        typeof data[0].result_data === 'string' 
          ? data[0].result_data.substring(0, 100) 
          : data[0].result_data
      );
      
      // AI 결과는 마크다운 텍스트이므로 JSON 파싱 시도 제거
      // if (typeof data[0].result_data === 'string') {
      //   try {
      //     const parsed = JSON.parse(data[0].result_data);
      //     console.log('🔍 파싱된 result_data:', parsed);
      //   } catch (e) {
      //     console.log('🔍 result_data JSON 파싱 실패:', e);
      //   }
      // }
    }
    
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

// 종합 분석 실행 함수 수정
async function runOverviewAnalysis(classId: string, sessionId: string, model: 'gpt' | 'gemini-flash' = 'gpt'): Promise<AnalysisResult> {
  console.log(`종합 분석 실행 요청: classId=${classId}, sessionId=${sessionId}, model=${model}`);
  
  try {
    const response = await fetch(`/api/class/${encodeURIComponent(classId)}/analysis/overview?sessionId=${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        session_id: sessionId,
        model: model 
      }), // session_id와 model 전달
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

// 학생 그룹별 분석 실행 함수 수정
async function runStudentGroupAnalysis(classId: string, groupIndex: number, sessionId: string, model: 'gpt' | 'gemini-flash' = 'gpt'): Promise<AnalysisResult> {
  console.log(`학생 그룹${groupIndex} 분석 실행 요청: classId=${classId}, sessionId=${sessionId}, model=${model}`);
  
  try {
    const response = await fetch(`/api/class/${encodeURIComponent(classId)}/analysis/students?group=${groupIndex}&sessionId=${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        session_id: sessionId,
        model: model 
      }), // session_id와 model 전달
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
    const response = await fetch(`/api/class/${encodeURIComponent(classId)}/analysis/${encodeURIComponent(analysisId)}`, {
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

// 세션별 분석 결과 삭제 함수 (같은 세션의 모든 분석 삭제)
async function deleteAnalysisSession(classId: string, sessionId: string): Promise<void> {
  console.log(`🗂️ 세션 삭제 요청: classId=${classId}, sessionId=${sessionId}`);
  
  try {
    // 먼저 해당 세션의 모든 분석 결과 조회
    const response = await fetch(`/api/class/${classId}/analysis`);
    if (!response.ok) {
      throw new Error('분석 결과 조회 실패');
    }
    
    const allResults = await response.json();
    const sessionResults = allResults.filter((result: AnalysisResult) => result.session_id === sessionId);
    
    console.log(`🗂️ 세션 ${sessionId}에 속한 분석 결과 ${sessionResults.length}개 발견`);
    
    // 각 분석 결과를 순차적으로 삭제
    for (const result of sessionResults) {
      await deleteAnalysis(classId, result.id);
      console.log(`🗑️ 세션 분석 삭제 완료: ${result.id} (${result.type})`);
    }
    
    console.log(`🗂️ 세션 ${sessionId} 전체 삭제 완료`);
  } catch (error) {
    console.error('🗂️ 세션 삭제 요청 오류:', error);
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
  classDetails?: Class | null;
}

function AnalysisCard({ analysis, classDetails }: AnalysisCardProps) {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const classId = params.classId as string;
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // 의미 있는 설명이 있는지 확인하고 없으면 기본 텍스트 사용
  const hasValidSummary = analysis.summary && analysis.summary.trim().length > 0 && 
                         !analysis.summary.includes("학급 관계 분석") && 
                         !analysis.summary.includes("분석 결과");
  
  const [description, setDescription] = useState(hasValidSummary ? analysis.summary : '편집 버튼을 눌러 설명을 입력하세요.');
  const [isSaving, setIsSaving] = useState(false);
  
  // 설명이 기본 텍스트인지 확인
  const isDefaultDescription = description === '편집 버튼을 눌러 설명을 입력하세요.';
  
  const createdAt = new Date(analysis.created_at);
  const formattedDate = format(createdAt, 'yyyy년 MM월 dd일', { locale: ko });
  const formattedTime = format(createdAt, 'HH:mm', { locale: ko });
  
  // 분석 유형 배지 정보
  const badge = getAnalysisBadge(analysis.type);
  
  // 삭제 Mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      // 🌟 데모 학급 권한 체크
      if (classDetails && isDemoClass(classDetails)) {
        const saveAttempt = handleDemoSaveAttempt(classDetails, "분석 결과 삭제");
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
      
      // 세션 ID가 있으면 세션 전체 삭제, 없으면 개별 삭제
      if (analysis.session_id) {
        console.log(`🗂️ 세션별 삭제 시작: ${analysis.session_id}`);
        return deleteAnalysisSession(classId, analysis.session_id);
      } else {
        console.log(`🗑️ 개별 삭제 시작: ${analysis.id}`);
        return deleteAnalysis(classId, analysis.id);
      }
    },
    onSuccess: () => {
      // 🌟 데모 학급이 아닌 경우만 성공 메시지 표시
      if (classDetails && !isDemoClass(classDetails)) {
        const message = analysis.session_id 
          ? '분석 세션이 삭제되었습니다.' 
          : '분석 결과가 삭제되었습니다.';
        toast.success(message);
      }
      queryClient.invalidateQueries({ queryKey: ['analysisResults', classId] });
      setIsDeleteDialogOpen(false);
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "DEMO_BLOCKED") {
        setIsDeleteDialogOpen(false);
        return;
      }
      toast.error(error instanceof Error ? error.message : '삭제 중 오류가 발생했습니다.');
    },
  });
  
  // 설명 업데이트 Mutation
  const updateDescriptionMutation = useMutation({
    mutationFn: async () => {
      // 🌟 데모 학급 권한 체크
      if (classDetails && isDemoClass(classDetails)) {
        const saveAttempt = handleDemoSaveAttempt(classDetails, "분석 결과 설명 수정");
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
      return updateAnalysisDescription(classId, analysis.id, description);
    },
    onSuccess: () => {
      // 🌟 데모 학급이 아닌 경우만 성공 메시지 표시
      if (classDetails && !isDemoClass(classDetails)) {
        toast.success('설명이 업데이트되었습니다.');
      }
      queryClient.invalidateQueries({ queryKey: ['analysisResults', classId] });
      setIsEditing(false);
      setIsSaving(false);
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "DEMO_BLOCKED") {
        setIsEditing(false);
        setIsSaving(false);
        return;
      }
      toast.error(error instanceof Error ? error.message : '설명 업데이트 중 오류가 발생했습니다.');
      setIsSaving(false);
    },
  });
  
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // 카드 클릭 이벤트 전파 방지
    setIsDeleteDialogOpen(true);
  };
  
  const confirmDelete = () => {
    deleteMutation.mutate();
  };
  
  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // 카드 클릭 이벤트 전파 방지
    setIsEditing(true);
  };
  
  const handleSaveClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // 카드 클릭 이벤트 전파 방지
    setIsSaving(true);
    updateDescriptionMutation.mutate();
  };
  
  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation(); // 카드 클릭 이벤트 전파 방지
    setDescription(analysis.summary || '편집 버튼을 눌러 설명을 입력하세요.');
    setIsEditing(false);
  };
  
  return (
    <>
      <motion.div
        className="bg-white rounded-lg shadow-md p-4 transition-all duration-300 hover:shadow-lg hover:bg-gray-50 relative group"
        whileHover={{ scale: 1.02 }}
        layout
      >
        <div 
          className={`${isEditing ? '' : 'cursor-pointer'} pb-6`}
          onClick={isEditing ? undefined : () => router.push(`/class/${classId}/analysis/${analysis.id}`)}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <div className="bg-indigo-100 text-indigo-600 p-2 rounded-full">
                <DocumentTextIcon className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-black">{formattedDate}</h3>
                </div>
                <p className="text-sm font-medium text-black">{formattedTime}</p>
              </div>
            </div>
            {!isEditing && <ChevronRightIcon className="w-5 h-5 text-gray-400" />}
          </div>
          <div className="mt-3">
            {isEditing ? (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="w-full h-24 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none text-black"
                placeholder="이 분석에 대한 설명을 입력하세요..."
              />
            ) : (
              <p className={`text-sm font-medium line-clamp-2 ${isDefaultDescription ? 'text-gray-500 italic' : 'text-black'}`}>
                {description}
              </p>
            )}
          </div>
        </div>
        
        {/* 버튼 영역 */}
        <div className="absolute bottom-3 right-3 flex space-x-2">
          {isEditing ? (
            <>
              <button
                onClick={handleCancelEdit}
                className="p-1.5 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
                title="취소"
              >
                <XCircleIcon className="w-4 h-4" />
              </button>
              <button
                onClick={handleSaveClick}
                disabled={isSaving}
                className="p-1.5 rounded-full bg-green-100 text-green-600 hover:bg-green-200 transition-colors focus:outline-none focus:ring-2 focus:ring-green-300"
                title="저장"
              >
                {isSaving ? (
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckIcon className="w-4 h-4" />
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleEditClick}
                className="p-1.5 rounded-full bg-gray-50 hover:bg-blue-50 text-gray-500 hover:text-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300"
                title="편집"
              >
                <PencilIcon className="w-4 h-4" />
              </button>
              <button
                onClick={handleDeleteClick}
                disabled={deleteMutation.isPending}
                className="p-1.5 rounded-full bg-gray-50 hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-300"
                title="삭제"
              >
                {deleteMutation.isPending ? (
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                ) : (
                  <TrashIcon className="w-4 h-4" />
                )}
              </button>
            </>
          )}
        </div>
      </motion.div>
      
      <ConfirmModal
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
        title={analysis.session_id ? "분석 세션 삭제 확인" : "분석 결과 삭제 확인"}
        message={
          analysis.session_id 
            ? `${formattedDate} ${formattedTime}에 생성된 분석 세션 전체를 정말 삭제하시겠습니까? 이 세션에 포함된 모든 분석 결과(종합분석, 학생분석 등)가 삭제됩니다. 이 작업은 되돌릴 수 없습니다.`
            : `${formattedDate} ${formattedTime}에 생성된 분석 결과를 정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`
        }
        confirmText="삭제"
        isLoading={deleteMutation.isPending}
      />
    </>
  );
}

// 모든 분석 결과 삭제 함수 추가
async function deleteAllAnalysis(classId: string): Promise<void> {
  console.log(`모든 분석 결과 삭제 요청: classId=${classId}`);
  
  try {
    const response = await fetch(`/api/class/${classId}/analysis?deleteAll=true`, {
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
    
    console.log('모든 분석 결과 삭제 성공');
  } catch (error: any) {
    console.error('분석 삭제 요청 오류:', error);
    throw error;
  }
}

// 사용자 정의 설명 저장 함수 추가
async function updateAnalysisDescription(
  classId: string, 
  analysisId: string, 
  description: string
): Promise<void> {
  console.log(`분석 설명 업데이트 요청: classId=${classId}, analysisId=${analysisId}`);
  
  try {
    // description이 기본 텍스트인 경우 빈 문자열로 처리
    const summary = description === '편집 버튼을 눌러 설명을 입력하세요.' ? '' : description;
    
    const response = await fetch(`/api/class/${classId}/analysis/${analysisId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ summary }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = '설명을 업데이트하는데 실패했습니다.';
      
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
    
    console.log('분석 설명 업데이트 성공');
  } catch (error: any) {
    console.error('설명 업데이트 요청 오류:', error);
    throw error;
  }
}

export default function ClassAnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const classId = params.classId as string;
  const [isDeleteAllDialogOpen, setIsDeleteAllDialogOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState('');
  const [selectedModel, setSelectedModel] = useState<'gpt' | 'gemini-flash'>('gemini-flash');
  
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
    mutationFn: async (sessionId: string) => {
      // 🌟 데모 학급 권한 체크 - 먼저 체크하고 차단
      if (classDetails && isDemoClass(classDetails)) {
        const saveAttempt = handleDemoSaveAttempt(classDetails, "AI 학급 관계 분석");
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
          // 실제 API 호출 없이 바로 리턴
          return Promise.resolve({} as AnalysisResult);
        }
      }
      return runOverviewAnalysis(classId, sessionId, selectedModel);
    },
    onSuccess: (newAnalysis) => {
      // 🌟 데모 학급인 경우에는 쿼리 무효화나 상태 업데이트 안함
      if (classDetails && isDemoClass(classDetails)) {
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['analysisResults', classId] });
      toast.success('종합 분석이 완료되었습니다.');
    },
    onError: (error) => {
      console.error('종합 분석 mutation 에러:', error);
      toast.error(error instanceof Error ? error.message : '종합 분석 실행 중 오류가 발생했습니다.');
      setIsAnalyzing(false);
    },
  });
  
  // 학생 그룹1 분석 실행 Mutation
  const runStudents1Mutation = useMutation({
    mutationFn: async (sessionId: string) => {
      // 🌟 데모 학급 권한 체크
      if (classDetails && isDemoClass(classDetails)) {
        const saveAttempt = handleDemoSaveAttempt(classDetails, "학생 그룹 분석");
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
      return runStudentGroupAnalysis(classId, 1, sessionId, selectedModel);
    },
    onSuccess: (newAnalysis) => {
      queryClient.invalidateQueries({ queryKey: ['analysisResults', classId] });
      // 🌟 데모 학급이 아닌 경우만 성공 메시지 표시
      if (classDetails && !isDemoClass(classDetails)) {
        toast.success('첫 번째 학생 그룹 분석이 완료되었습니다.');
      }
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "DEMO_BLOCKED") {
        return;
      }
      toast.error(error instanceof Error ? error.message : '학생 그룹1 분석 실행 중 오류가 발생했습니다.');
    },
  });
  
  // 학생 그룹2 분석 실행 Mutation
  const runStudents2Mutation = useMutation({
    mutationFn: async (sessionId: string) => {
      // 🌟 데모 학급 권한 체크
      if (classDetails && isDemoClass(classDetails)) {
        const saveAttempt = handleDemoSaveAttempt(classDetails, "학생 그룹 분석");
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
      return runStudentGroupAnalysis(classId, 2, sessionId, selectedModel);
    },
    onSuccess: (newAnalysis) => {
      queryClient.invalidateQueries({ queryKey: ['analysisResults', classId] });
      // 🌟 데모 학급이 아닌 경우만 성공 메시지 표시
      if (classDetails && !isDemoClass(classDetails)) {
        toast.success('두 번째 학생 그룹 분석이 완료되었습니다.');
      }
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "DEMO_BLOCKED") {
        return;
      }
      toast.error(error instanceof Error ? error.message : '학생 그룹2 분석 실행 중 오류가 발생했습니다.');
    },
  });
  
  // 학생 그룹3 분석 실행 Mutation
  const runStudents3Mutation = useMutation({
    mutationFn: async (sessionId: string) => {
      // 🌟 데모 학급 권한 체크
      if (classDetails && isDemoClass(classDetails)) {
        const saveAttempt = handleDemoSaveAttempt(classDetails, "학생 그룹 분석");
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
      return runStudentGroupAnalysis(classId, 3, sessionId, selectedModel);
    },
    onSuccess: (newAnalysis) => {
      queryClient.invalidateQueries({ queryKey: ['analysisResults', classId] });
      // 🌟 데모 학급이 아닌 경우만 성공 메시지 표시
      if (classDetails && !isDemoClass(classDetails)) {
        toast.success('세 번째 학생 그룹 분석이 완료되었습니다.');
      }
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "DEMO_BLOCKED") {
        return;
      }
      toast.error(error instanceof Error ? error.message : '학생 그룹3 분석 실행 중 오류가 발생했습니다.');
    },
  });
  
  // 학생 그룹4 분석 실행 Mutation
  const runStudents4Mutation = useMutation({
    mutationFn: async (sessionId: string) => {
      // 🌟 데모 학급 권한 체크
      if (classDetails && isDemoClass(classDetails)) {
        const saveAttempt = handleDemoSaveAttempt(classDetails, "학생 그룹 분석");
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
      return runStudentGroupAnalysis(classId, 4, sessionId, selectedModel);
    },
    onSuccess: (newAnalysis) => {
      queryClient.invalidateQueries({ queryKey: ['analysisResults', classId] });
      // 🌟 데모 학급이 아닌 경우만 성공 메시지 표시
      if (classDetails && !isDemoClass(classDetails)) {
        toast.success('네 번째 학생 그룹 분석이 완료되었습니다.');
      }
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "DEMO_BLOCKED") {
        return;
      }
      toast.error(error instanceof Error ? error.message : '학생 그룹4 분석 실행 중 오류가 발생했습니다.');
    },
  });
  
  // 학생 그룹5 분석 실행 Mutation
  const runStudents5Mutation = useMutation({
    mutationFn: async (sessionId: string) => {
      // 🌟 데모 학급 권한 체크
      if (classDetails && isDemoClass(classDetails)) {
        const saveAttempt = handleDemoSaveAttempt(classDetails, "학생 그룹 분석");
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
      return runStudentGroupAnalysis(classId, 5, sessionId, selectedModel);
    },
    onSuccess: (newAnalysis) => {
      queryClient.invalidateQueries({ queryKey: ['analysisResults', classId] });
      // 🌟 데모 학급이 아닌 경우만 성공 메시지 표시
      if (classDetails && !isDemoClass(classDetails)) {
        toast.success('다섯 번째 학생 그룹 분석이 완료되었습니다.');
      }
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "DEMO_BLOCKED") {
        return;
      }
      toast.error(error instanceof Error ? error.message : '학생 그룹5 분석 실행 중 오류가 발생했습니다.');
    },
  });
  
  // 학생 그룹6 분석 실행 Mutation
  const runStudents6Mutation = useMutation({
    mutationFn: async (sessionId: string) => {
      // 🌟 데모 학급 권한 체크
      if (classDetails && isDemoClass(classDetails)) {
        const saveAttempt = handleDemoSaveAttempt(classDetails, "학생 그룹 분석");
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
      return runStudentGroupAnalysis(classId, 6, sessionId, selectedModel);
    },
    onSuccess: (newAnalysis) => {
      queryClient.invalidateQueries({ queryKey: ['analysisResults', classId] });
      // 🌟 데모 학급이 아닌 경우만 성공 메시지 표시
      if (classDetails && !isDemoClass(classDetails)) {
        toast.success('여섯 번째 학생 그룹 분석이 완료되었습니다.');
      }
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "DEMO_BLOCKED") {
        return;
      }
      toast.error(error instanceof Error ? error.message : '학생 그룹6 분석 실행 중 오류가 발생했습니다.');
    },
  });
  
  // 학생 그룹7 분석 실행 Mutation
  const runStudents7Mutation = useMutation({
    mutationFn: async (sessionId: string) => {
      // 🌟 데모 학급 권한 체크
      if (classDetails && isDemoClass(classDetails)) {
        const saveAttempt = handleDemoSaveAttempt(classDetails, "학생 그룹 분석");
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
      return runStudentGroupAnalysis(classId, 7, sessionId, selectedModel);
    },
    onSuccess: (newAnalysis) => {
      queryClient.invalidateQueries({ queryKey: ['analysisResults', classId] });
      // 🌟 데모 학급이 아닌 경우만 성공 메시지 표시
      if (classDetails && !isDemoClass(classDetails)) {
        toast.success('일곱 번째 학생 그룹 분석이 완료되었습니다.');
      }
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "DEMO_BLOCKED") {
        return;
      }
      toast.error(error instanceof Error ? error.message : '학생 그룹7 분석 실행 중 오류가 발생했습니다.');
    },
  });
  
  // 학생 그룹8 분석 실행 Mutation
  const runStudents8Mutation = useMutation({
    mutationFn: async (sessionId: string) => {
      // 🌟 데모 학급 권한 체크
      if (classDetails && isDemoClass(classDetails)) {
        const saveAttempt = handleDemoSaveAttempt(classDetails, "학생 그룹 분석");
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
      return runStudentGroupAnalysis(classId, 8, sessionId, selectedModel);
    },
    onSuccess: (newAnalysis) => {
      queryClient.invalidateQueries({ queryKey: ['analysisResults', classId] });
      // 🌟 데모 학급이 아닌 경우만 성공 메시지 표시
      if (classDetails && !isDemoClass(classDetails)) {
        toast.success('여덟 번째 학생 그룹 분석이 완료되었습니다.');
      }
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "DEMO_BLOCKED") {
        return;
      }
      toast.error(error instanceof Error ? error.message : '학생 그룹8 분석 실행 중 오류가 발생했습니다.');
    },
  });
  
  // 전체 분석 순차 실행 함수 수정 - 모든 분석 완료 후에도 이동하지 않음
  const runFullAnalysisSequentially = async () => {
    try {
      // 분석 상태 시작
      setIsAnalyzing(true);
      
      // 모든 분석에 사용할 공통 세션 ID 생성
      const sessionId = generateUUID();
      console.log('분석 세션 ID 생성:', sessionId);

      // 종합 분석 실행
      setAnalysisProgress('학급 종합 분석을 진행 중입니다...');
      toast.success('종합 분석을 시작합니다...');
      const overviewResult = await runOverviewMutation.mutateAsync(sessionId);
      
      // 학생 그룹1 분석 실행
      setAnalysisProgress('첫 번째 학생 그룹 분석을 진행 중입니다...');
      toast.success('첫 번째 학생 그룹 분석을 시작합니다...');
      await runStudents1Mutation.mutateAsync(sessionId);
      
      // 학생 그룹2 분석 실행
      setAnalysisProgress('두 번째 학생 그룹 분석을 진행 중입니다...');
      toast.success('두 번째 학생 그룹 분석을 시작합니다...');
      await runStudents2Mutation.mutateAsync(sessionId);
      
      // 학생 그룹3 분석 실행
      setAnalysisProgress('세 번째 학생 그룹 분석을 진행 중입니다...');
      toast.success('세 번째 학생 그룹 분석을 시작합니다...');
      await runStudents3Mutation.mutateAsync(sessionId);
      
      // 학생 그룹4 분석 실행
      setAnalysisProgress('네 번째 학생 그룹 분석을 진행 중입니다...');
      toast.success('네 번째 학생 그룹 분석을 시작합니다...');
      await runStudents4Mutation.mutateAsync(sessionId);
      
      // 학생 그룹5 분석 실행
      setAnalysisProgress('다섯 번째 학생 그룹 분석을 진행 중입니다...');
      toast.success('다섯 번째 학생 그룹 분석을 시작합니다...');
      await runStudents5Mutation.mutateAsync(sessionId);
      
      // 학생 그룹6 분석 실행
      setAnalysisProgress('여섯 번째 학생 그룹 분석을 진행 중입니다...');
      toast.success('여섯 번째 학생 그룹 분석을 시작합니다...');
      await runStudents6Mutation.mutateAsync(sessionId);
      
      // 학생 그룹7 분석 실행
      setAnalysisProgress('일곱 번째 학생 그룹 분석을 진행 중입니다...');
      toast.success('일곱 번째 학생 그룹 분석을 시작합니다...');
      await runStudents7Mutation.mutateAsync(sessionId);
      
      // 학생 그룹8 분석 실행
      setAnalysisProgress('여덟 번째 학생 그룹 분석을 진행 중입니다...');
      toast.success('여덟 번째 학생 그룹 분석을 시작합니다...');
      await runStudents8Mutation.mutateAsync(sessionId);
      
      // 모든 분석 완료 
      toast.success('모든 분석이 완료되었습니다!');
      setIsAnalyzing(false);
      
      // 페이지 이동 코드 제거
    } catch (error) {
      toast.error('분석 과정 중 오류가 발생했습니다. 일부 분석은 완료되었을 수 있습니다.');
      console.error('순차 분석 오류:', error);
      setIsAnalyzing(false);
    }
  };
  
  // 모든 분석 결과 삭제 Mutation
  const deleteAllAnalysisMutation = useMutation({
    mutationFn: async () => {
      // 🌟 데모 학급 권한 체크
      if (classDetails && isDemoClass(classDetails)) {
        const saveAttempt = handleDemoSaveAttempt(classDetails, "모든 분석 결과 삭제");
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
      return deleteAllAnalysis(classId);
    },
    onSuccess: () => {
      // 🌟 데모 학급이 아닌 경우만 성공 메시지 표시
      if (classDetails && !isDemoClass(classDetails)) {
        toast.success('모든 분석 결과가 삭제되었습니다.');
      }
      queryClient.invalidateQueries({ queryKey: ['analysisResults', classId] });
      setIsDeleteAllDialogOpen(false);
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "DEMO_BLOCKED") {
        setIsDeleteAllDialogOpen(false);
        return;
      }
      toast.error(error instanceof Error ? error.message : '삭제 중 오류가 발생했습니다.');
    },
  });
  
  // 모든 분석 결과 삭제 핸들러
  const handleDeleteAllClick = () => {
    setIsDeleteAllDialogOpen(true);
  };
  
  // 모든 분석 결과 삭제 확인
  const confirmDeleteAll = () => {
    deleteAllAnalysisMutation.mutate();
  };
  
  const isLoading = isClassLoading || isResultsLoading;
  const isAnyRunning = runOverviewMutation.isPending || 
                      runStudents1Mutation.isPending || 
                      runStudents2Mutation.isPending || 
                      runStudents3Mutation.isPending ||
                      runStudents4Mutation.isPending ||
                      runStudents5Mutation.isPending ||
                      runStudents6Mutation.isPending ||
                      runStudents7Mutation.isPending ||
                      runStudents8Mutation.isPending;
  
  if (isLoading && !isAnyRunning && !isAnalyzing) {
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
          onClick={() => router.back()}
          className="flex items-center px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors shadow-sm"
        >
          <ArrowLeftIcon className="w-4 h-4 mr-2" />
          돌아가기
        </button>
      </div>
    );
  }
  
  if (!classDetails) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gray-100">
        <div className="text-2xl text-red-500 mb-4">학급 정보를 찾을 수 없습니다</div>
        <button
          onClick={() => router.back()}
          className="flex items-center px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors shadow-sm"
        >
          <ArrowLeftIcon className="w-4 h-4 mr-2" />
          돌아가기
        </button>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-100 relative">
      {/* 분석 진행 중 팝업 */}
      {isAnalyzing && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center">
          <div className="bg-white p-8 rounded-lg shadow-xl max-w-md text-center border-2 border-indigo-200">
            {/* AI 스타일 로딩 아이콘 */}
            <div className="flex justify-center items-center mb-4">
              <div className="relative w-16 h-16">
                {/* 바깥쪽 원 */}
                <div className="absolute inset-0 border-4 border-indigo-200 rounded-full"></div>
                {/* 회전하는 부분 */}
                <div className="absolute inset-0 border-4 border-transparent border-t-indigo-600 rounded-full animate-spin"></div>
                {/* 중앙 AI 아이콘 */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <SparklesIcon className="w-8 h-8 text-indigo-600" />
                </div>
              </div>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">분석 진행 중</h3>
            <p className="text-gray-600 mb-4">{analysisProgress}</p>
            <p className="text-sm text-gray-500">분석에는 몇 분 정도 소요될 수 있습니다. 잠시만 기다려주세요.</p>
          </div>
        </div>
      )}
      
      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* 헤더 */}
        <header className="mb-10 flex justify-between items-center bg-white p-5 rounded-lg shadow-md">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="flex items-center px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors shadow-sm"
            >
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              돌아가기
            </button>
            <h1 className="text-2xl font-bold text-black">{classDetails.name} 학급 분석</h1>
          </div>
        </header>
        
        {/* 분석 실행 설명 부분 - 분석 버튼을 오른쪽으로 옮김 */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                <SparklesIcon className="w-5 h-5 text-indigo-500 mr-2" />
                AI 기반 학급 관계 분석
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                학생들의 관계 데이터를 AI가 분석하여 학급 내 사회적 역학 구조와 관계 패턴을 파악합니다.
              </p>
              <p className="text-xs text-gray-500 mt-1">
                분석은 종합분석 및 학생그룹별 분석으로 나누어 진행됩니다. (Gemini 2.5 사용)
              </p>
            </div>
            <div className="flex items-center gap-3 ml-4">
              <button
                onClick={runFullAnalysisSequentially}
                disabled={isAnyRunning || isAnalyzing}
                className="px-6 py-3 text-sm bg-indigo-500 text-white rounded-md hover:bg-indigo-600 shadow focus:outline-none focus:ring-2 focus:ring-indigo-300 flex items-center disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-200"
              >
                {isAnyRunning || isAnalyzing ? (
                  <>
                    <ArrowPathIcon className="w-4 h-4 animate-spin mr-2" />
                    분석 중...
                  </>
                ) : (
                  <>
                    <SparklesIcon className="w-4 h-4 mr-2" />
                    새 분석 실행
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
        
        {/* 분석 결과 설명 */}
        <div className="bg-white shadow-md rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <DocumentTextIcon className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-semibold text-gray-800">분석 결과 목록</h2>
            </div>
            <button
              onClick={handleDeleteAllClick}
              disabled={deleteAllAnalysisMutation.isPending}
              className="p-2 rounded-full text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-300"
              title="모든 분석 결과 삭제"
            >
              {deleteAllAnalysisMutation.isPending ? (
                <ArrowPathIcon className="w-5 h-5 animate-spin" />
              ) : (
                <TrashIcon className="w-5 h-5" />
              )}
            </button>
          </div>
          <p className="text-sm text-gray-600 mb-2">
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
                    classDetails={classDetails}
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
        
        {/* 모든 분석 결과 삭제 확인 모달 */}
        <ConfirmModal
          isOpen={isDeleteAllDialogOpen}
          onClose={() => setIsDeleteAllDialogOpen(false)}
          onConfirm={confirmDeleteAll}
          title="모든 분석 결과 삭제 확인"
          message="정말 모든 분석 결과를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
          confirmText="모두 삭제"
          isLoading={deleteAllAnalysisMutation.isPending}
        />
      </div>
    </div>
  );
} 