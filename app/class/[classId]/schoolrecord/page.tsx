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
    const response = await fetch(`/api/class/${encodeURIComponent(classId)}/schoolrecord/${encodeURIComponent(recordId)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ summary: description }),
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
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [description, setDescription] = useState(record.summary || '');
  
  // 삭제 mutation
  const deleteMutation = useMutation({
    mutationFn: () => deleteSchoolRecord(classId, record.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schoolRecords', classId] });
      toast.success('생활기록부를 삭제했습니다.');
    },
    onError: (error: any) => {
      toast.error(`삭제 실패: ${error.message}`);
    },
  });
  
  // 설명 업데이트 mutation
  const updateDescriptionMutation = useMutation({
    mutationFn: () => updateSchoolRecordDescription(classId, record.id, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schoolRecords', classId] });
      toast.success('설명을 업데이트했습니다.');
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast.error(`업데이트 실패: ${error.message}`);
    },
  });
  
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleteModalOpen(true);
  };
  
  const confirmDelete = () => {
    deleteMutation.mutate();
    setIsDeleteModalOpen(false);
  };
  
  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };
  
  const handleSaveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateDescriptionMutation.mutate();
  };
  
  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(false);
    setDescription(record.summary || '');
  };
  
  return (
    <>
      <motion.div
        className="bg-white rounded-xl shadow-md overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-300"
        whileHover={{ scale: 1.01 }}
        onClick={() => router.push(`/class/${classId}/schoolrecord/${record.id}`)}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-amber-500 text-white">
          <div className="flex items-center">
            <DocumentTextIcon className="w-6 h-6 mr-2" />
            <span className="font-semibold">생활기록부</span>
          </div>
          <div className="text-sm flex items-center">
            <CalendarIcon className="w-4 h-4 mr-1" />
            {format(new Date(record.created_at), 'yyyy년 MM월 dd일 HH:mm', { locale: ko })}
          </div>
        </div>
        
        <div className="p-4">
          {isEditing ? (
            <div onClick={(e) => e.stopPropagation()} className="pb-3">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border border-gray-300 rounded-md p-2 focus:ring-amber-500 focus:border-amber-500"
                rows={3}
                placeholder="생활기록부 설명 입력..."
              />
              <div className="flex justify-end mt-2 space-x-2">
                <button
                  onClick={handleSaveClick}
                  className="px-3 py-1 bg-amber-500 text-white rounded-md hover:bg-amber-600 flex items-center text-sm"
                >
                  <CheckIcon className="w-4 h-4 mr-1" />
                  저장
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="px-3 py-1 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 flex items-center text-sm"
                >
                  <XCircleIcon className="w-4 h-4 mr-1" />
                  취소
                </button>
              </div>
            </div>
          ) : (
            <p className="text-gray-700 mb-4 line-clamp-3">
              {record.summary || '생활기록부 문구가 생성되었습니다.'}
            </p>
          )}
          
          <div className="flex justify-between items-center">
            <div className="flex space-x-2">
              <button
                onClick={handleEditClick}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 flex items-center"
              >
                <PencilIcon className="w-4 h-4 mr-1" />
                설명 수정
              </button>
            </div>
            
            <div className="flex items-center">
              <button
                onClick={handleDeleteClick}
                className="p-1 text-gray-500 hover:text-red-500 transition-colors"
              >
                <TrashIcon className="w-5 h-5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/class/${classId}/schoolrecord/${record.id}`);
                }}
                className="ml-2 p-1 text-gray-500 hover:text-amber-500 transition-colors"
              >
                <ChevronRightIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
      
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="생활기록부 삭제"
        message="정말 이 생활기록부를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
        confirmText="삭제"
        cancelText="취소"
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
    },
    onError: (error: any) => {
      toast.error(`생성 실패: ${error.message}`);
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
  
  if (isClassLoading || isRecordsLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100">
        <div className="text-2xl text-amber-500">로딩 중...</div>
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
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-screen-2xl mx-auto px-4 py-8">
        {/* 헤더 */}
        <header className="mb-8 bg-white p-4 rounded-lg shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push(`/class/${classId}/dashboard`)}
                className="px-4 py-2 text-sm bg-amber-500 text-white rounded-md hover:bg-amber-600 shadow focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-1 transition-all duration-200 flex items-center"
              >
                <ArrowLeftIcon className="w-4 h-4 mr-2" />
                대시보드
              </button>
              <h1 className="text-2xl font-bold text-gray-900">{classDetails.name} 생활기록부</h1>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                className="px-4 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600 shadow focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-1 transition-all duration-200 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generateMutation.isPending ? (
                  <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <SparklesIcon className="w-5 h-5 mr-2" />
                )}
                생활기록부 생성
              </button>
              
              {schoolRecords && schoolRecords.length > 0 && (
                <button
                  onClick={handleDeleteAllClick}
                  className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 shadow focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-1 transition-all duration-200 flex items-center"
                >
                  <TrashIcon className="w-5 h-5 mr-2" />
                  전체 삭제
                </button>
              )}
            </div>
          </div>
          
          <p className="text-gray-600">
            학생별 생활기록부 문구를 AI로 생성합니다. 학생의 특성과 활동 내용을 반영한 맞춤형 문구입니다.
          </p>
        </header>

        {/* 생활기록부 목록 */}
        {isRecordsError ? (
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {schoolRecords.map((record) => (
                <motion.div
                  key={record.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3 }}
                >
                  <SchoolRecordCard record={record} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            <DocumentTextIcon className="w-16 h-16 text-amber-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-800 mb-2">생활기록부가 없습니다</h3>
            <p className="text-gray-600 mb-6">
              아직 생성된 생활기록부가 없습니다. '생활기록부 생성' 버튼을 클릭하여 학생별 생활기록부 문구를 생성해보세요.
            </p>
            <button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="px-6 py-3 bg-amber-500 text-white rounded-md hover:bg-amber-600 shadow inline-flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generateMutation.isPending ? (
                <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <SparklesIcon className="w-5 h-5 mr-2" />
              )}
              생활기록부 생성하기
            </button>
          </div>
        )}
      </div>
      
      <ConfirmModal
        isOpen={isDeleteAllModalOpen}
        onClose={() => setIsDeleteAllModalOpen(false)}
        onConfirm={confirmDeleteAll}
        title="모든 생활기록부 삭제"
        message="정말 모든 생활기록부를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
        confirmText="전체 삭제"
        cancelText="취소"
      />
    </div>
  );
} 