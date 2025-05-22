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

// 생활기록부 결과 타입 정의
interface SchoolRecord {
  id: string;
  class_id: string;
  created_at: string;
  result_data: {
    records: any;
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

// 생활기록부 목록 조회 함수
async function fetchSchoolRecords(classId: string): Promise<SchoolRecord[]> {
  console.log(`생활기록부 목록 요청: classId=${classId}`);
  
  try {
    // API 엔드포인트에 요청
    const response = await fetch(`/api/class/${classId}/schoolrecord`);
    
    if (!response.ok) {
      throw new Error(`생활기록부를 불러오는데 실패했습니다 (${response.status})`);
    }
    
    const data = await response.json();
    console.log(`생활기록부 목록 수신 성공, ${data ? data.length : 0}개의 결과`);
    return data || [];
  } catch (error) {
    console.error('생활기록부 목록 요청 오류:', error);
    throw error;
  }
}

// 생활기록부 생성 함수
async function generateSchoolRecord(classId: string): Promise<SchoolRecord> {
  console.log(`생활기록부 생성 요청: classId=${classId}`);
  
  try {
    const response = await fetch(`/api/class/${classId}/schoolrecord`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = '생활기록부를 생성하는데 실패했습니다.';
      
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
    console.log('생활기록부 생성 성공, 결과 ID:', data.id);
    return data;
  } catch (error) {
    console.error('생활기록부 생성 요청 오류:', error);
    throw error;
  }
}

// 생활기록부 삭제 함수
async function deleteSchoolRecord(classId: string, recordId: string): Promise<void> {
  console.log(`생활기록부 삭제 요청: classId=${classId}, recordId=${recordId}`);
  
  try {
    const response = await fetch(`/api/class/${encodeURIComponent(classId)}/schoolrecord/${encodeURIComponent(recordId)}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = '생활기록부를 삭제하는데 실패했습니다.';
      
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
    
    console.log('생활기록부 삭제 성공');
  } catch (error) {
    console.error('생활기록부 삭제 요청 오류:', error);
    throw error;
  }
}

// 모든 생활기록부 삭제 함수
async function deleteAllSchoolRecords(classId: string): Promise<void> {
  console.log(`모든 생활기록부 삭제 요청: classId=${classId}`);
  
  try {
    const response = await fetch(`/api/class/${encodeURIComponent(classId)}/schoolrecord?all=true`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = '모든 생활기록부를 삭제하는데 실패했습니다.';
      
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
    
    console.log('모든 생활기록부 삭제 성공');
  } catch (error) {
    console.error('모든 생활기록부 삭제 요청 오류:', error);
    throw error;
  }
}

// 생활기록부 설명 업데이트 함수
async function updateSchoolRecordDescription(
  classId: string, 
  recordId: string, 
  description: string
): Promise<void> {
  console.log(`생활기록부 설명 업데이트 요청: classId=${classId}, recordId=${recordId}, description=${description}`);
  
  try {
    // description이 기본 텍스트인 경우 빈 문자열로 처리
    const summary = description === '편집 버튼을 눌러 설명을 입력하세요.' ? '' : description;
    
    const response = await fetch(`/api/class/${encodeURIComponent(classId)}/schoolrecord/${encodeURIComponent(recordId)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ summary }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = '생활기록부 설명을 업데이트하는데 실패했습니다.';
      
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
    
    console.log('생활기록부 설명 업데이트 성공');
  } catch (error) {
    console.error('생활기록부 설명 업데이트 요청 오류:', error);
    throw error;
  }
}

// 생활기록부 카드 컴포넌트
interface SchoolRecordCardProps {
  record: SchoolRecord;
}

function SchoolRecordCard({ record }: SchoolRecordCardProps) {
  const router = useRouter();
  const params = useParams();
  const classId = params.classId as string;
  const queryClient = useQueryClient();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // 의미 있는 설명이 있는지 확인하고 없으면 기본 텍스트 사용
  const hasValidSummary = record.summary && record.summary.trim().length > 0 && 
                         !record.summary.includes("학생별 생활기록부") && 
                         !record.summary.includes("생활기록부");
  
  const [description, setDescription] = useState(hasValidSummary ? record.summary : '편집 버튼을 눌러 설명을 입력하세요.');
  const [isSaving, setIsSaving] = useState(false);
  
  // 설명이 기본 텍스트인지 확인
  const isDefaultDescription = description === '편집 버튼을 눌러 설명을 입력하세요.';
  
  const createdAt = new Date(record.created_at);
  const formattedDate = format(createdAt, 'yyyy년 MM월 dd일', { locale: ko });
  const formattedTime = format(createdAt, 'HH:mm', { locale: ko });
  
  // 삭제 Mutation
  const deleteMutation = useMutation({
    mutationFn: () => deleteSchoolRecord(classId, record.id),
    onSuccess: () => {
      toast.success('생활기록부가 삭제되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['schoolRecords', classId] });
      setIsDeleteDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '삭제 중 오류가 발생했습니다.');
    },
  });
  
  // 설명 업데이트 Mutation
  const updateDescriptionMutation = useMutation({
    mutationFn: () => updateSchoolRecordDescription(classId, record.id, description),
    onSuccess: () => {
      toast.success('설명이 업데이트되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['schoolRecords', classId] });
      setIsEditing(false);
      setIsSaving(false);
    },
    onError: (error) => {
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
    setDescription(hasValidSummary ? record.summary : '편집 버튼을 눌러 설명을 입력하세요.');
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
          onClick={isEditing ? undefined : () => router.push(`/class/${classId}/schoolrecord/${record.id}`)}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <div className="bg-amber-100 text-amber-600 p-2 rounded-full">
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
                className="w-full h-24 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none text-black"
                placeholder="이 생활기록부에 대한 설명을 입력하세요..."
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
        title="생활기록부 삭제 확인"
        message={`${formattedDate} ${formattedTime}에 생성된 생활기록부를 정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmText="삭제"
        isLoading={deleteMutation.isPending}
      />
    </>
  );
}

export default function SchoolRecordPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.classId as string;
  const queryClient = useQueryClient();
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');
  
  // 학급 정보 조회
  const { 
    data: classDetails, 
    isLoading: isClassLoading, 
    isError: isClassError, 
    error: classError 
  } = useQuery({
    queryKey: ['classDetails', classId],
    queryFn: () => fetchClassDetails(classId),
    enabled: !!classId,
  });
  
  // 생활기록부 목록 조회
  const {
    data: schoolRecords,
    isLoading: isRecordsLoading,
    isError: isRecordsError,
    error: recordsError
  } = useQuery({
    queryKey: ['schoolRecords', classId],
    queryFn: () => fetchSchoolRecords(classId),
    enabled: !!classId,
  });
  
  // 생활기록부 생성 mutation
  const generateMutation = useMutation({
    mutationFn: () => generateSchoolRecord(classId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schoolRecords', classId] });
      toast.success('생활기록부가 생성되었습니다.');
      setIsGenerating(false);
    },
    onError: (error: any) => {
      toast.error(`생성 실패: ${error.message}`);
      setIsGenerating(false);
    },
  });
  
  // 모든 생활기록부 삭제 mutation
  const deleteAllMutation = useMutation({
    mutationFn: () => deleteAllSchoolRecords(classId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schoolRecords', classId] });
      toast.success('모든 생활기록부가 삭제되었습니다.');
    },
    onError: (error: any) => {
      toast.error(`삭제 실패: ${error.message}`);
    },
  });
  
  const handleDeleteAllClick = () => {
    setIsDeleteAllModalOpen(true);
  };
  
  const confirmDeleteAll = () => {
    deleteAllMutation.mutate();
    setIsDeleteAllModalOpen(false);
  };

  const generateSchoolRecordWithProgress = () => {
    setIsGenerating(true);
    setGenerationProgress('생활기록부 생성 중입니다...');
    generateMutation.mutate();
  };
  
  if (isClassLoading || isRecordsLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100">
        <ArrowPathIcon className="w-8 h-8 animate-spin text-amber-500" />
        <div className="text-xl text-amber-500 ml-3">로딩 중...</div>
      </div>
    );
  }

  if (isClassError || !classDetails) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gray-100">
        <div className="text-2xl text-red-500 mb-4">오류가 발생했습니다</div>
        <p className="text-gray-700 mb-4">
          {classError instanceof Error ? classError.message : '학급 정보를 불러올 수 없습니다.'}
        </p>
        <button
          onClick={() => router.push('/teacher')}
          className="px-4 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600"
        >
          학급 목록으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 relative">
      {/* 생성 진행 중 팝업 */}
      {isGenerating && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center">
          <div className="bg-white p-8 rounded-lg shadow-xl max-w-md text-center border-2 border-amber-200">
            {/* AI 스타일 로딩 아이콘 */}
            <div className="flex justify-center items-center mb-4">
              <div className="relative w-16 h-16">
                {/* 바깥쪽 원 */}
                <div className="absolute inset-0 border-4 border-amber-200 rounded-full"></div>
                {/* 회전하는 부분 */}
                <div className="absolute inset-0 border-4 border-transparent border-t-amber-600 rounded-full animate-spin"></div>
                {/* 중앙 AI 아이콘 */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <SparklesIcon className="w-8 h-8 text-amber-600" />
                </div>
              </div>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">생성 진행 중</h3>
            <p className="text-gray-600 mb-4">{generationProgress}</p>
            <p className="text-sm text-gray-500">생성에는 몇 분 정도 소요될 수 있습니다. 잠시만 기다려주세요.</p>
          </div>
        </div>
      )}
      
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* 헤더 */}
        <header className="mb-8 bg-white p-4 rounded-lg shadow-md">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(`/class/${classId}/dashboard`)}
              className="px-4 py-2 text-sm bg-amber-500 text-white rounded-md hover:bg-amber-600 shadow focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-1 transition-all duration-200 flex items-center"
            >
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              대시보드
            </button>
            <h1 className="text-2xl font-bold text-black">{classDetails.name} 생활기록부</h1>
          </div>
        </header>
        
        {/* 생활기록부 생성 버튼 */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                <SparklesIcon className="w-5 h-5 text-amber-500 mr-2" />
                AI 기반 생활기록부 생성
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                학생들의 관계 데이터와 활동 내용을 AI가 분석하여 학생별 맞춤형 생활기록부 문구를 생성합니다.
              </p>
              <p className="text-xs text-gray-500 mt-1">
                각 학생의 특성을 반영한 구체적이고 개성 있는 생활기록부 문구를 제공합니다.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={generateSchoolRecordWithProgress}
                disabled={generateMutation.isPending || isGenerating}
                className="px-4 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600 shadow focus:outline-none focus:ring-2 focus:ring-amber-300 flex items-center disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {generateMutation.isPending || isGenerating ? (
                  <>
                    <ArrowPathIcon className="w-5 h-5 animate-spin mr-2" />
                    생성 중...
                  </>
                ) : (
                  <>
                    <SparklesIcon className="w-5 h-5 mr-2" />
                    새 생활기록부 생성
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
        
        {/* 생활기록부 목록 설명 */}
        <div className="bg-white shadow-md rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <DocumentTextIcon className="w-5 h-5 text-amber-600" />
              <h2 className="text-lg font-semibold text-gray-800">생활기록부 목록</h2>
            </div>
            {schoolRecords && schoolRecords.length > 0 && (
              <button
                onClick={handleDeleteAllClick}
                disabled={deleteAllMutation.isPending}
                className="p-2 rounded-full text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-300"
                title="모든 생활기록부 삭제"
              >
                {deleteAllMutation.isPending ? (
                  <ArrowPathIcon className="w-5 h-5 animate-spin" />
                ) : (
                  <TrashIcon className="w-5 h-5" />
                )}
              </button>
            )}
          </div>
          <p className="text-sm text-gray-600">
            각 생활기록부를 클릭하면 상세 내용을 볼 수 있습니다. 생성된 생활기록부에는 학생별 맞춤형 문구가 포함되어 있습니다.
          </p>
        </div>
        
        {/* 생활기록부 목록 */}
        <div className="mt-8">
          {isRecordsLoading ? (
            <div className="flex justify-center items-center p-12">
              <ArrowPathIcon className="w-6 h-6 animate-spin text-amber-500" />
              <span className="ml-2 text-amber-500">로딩 중...</span>
            </div>
          ) : isRecordsError ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8 flex items-start">
              <ExclamationTriangleIcon className="w-6 h-6 text-red-500 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-medium text-red-800">데이터 로딩 오류</h3>
                <p className="text-red-700 mt-1">
                  {recordsError instanceof Error ? recordsError.message : '생활기록부 목록을 불러오는 중 오류가 발생했습니다.'}
                </p>
                <button
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['schoolRecords', classId] })}
                  className="mt-2 px-3 py-1 bg-red-100 text-red-800 text-sm rounded-md hover:bg-red-200 inline-flex items-center"
                >
                  <ArrowPathIcon className="w-4 h-4 mr-1" />
                  다시 시도
                </button>
              </div>
            </div>
          ) : schoolRecords && schoolRecords.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {schoolRecords.map((record) => (
                  <SchoolRecordCard
                    key={record.id}
                    record={record}
                  />
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="bg-gray-100 text-gray-600 p-8 rounded-lg text-center">
              <p className="mb-4">생성된 생활기록부가 없습니다.</p>
              <p className="text-sm">위의 '새 생활기록부 생성' 버튼을 눌러 생성을 시작해보세요.</p>
            </div>
          )}
        </div>
        
        {/* 모든 생활기록부 삭제 확인 모달 */}
        <ConfirmModal
          isOpen={isDeleteAllModalOpen}
          onClose={() => setIsDeleteAllModalOpen(false)}
          onConfirm={confirmDeleteAll}
          title="모든 생활기록부 삭제 확인"
          message="정말 모든 생활기록부를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
          confirmText="모두 삭제"
          isLoading={deleteAllMutation.isPending}
        />
      </div>
    </div>
  );
} 