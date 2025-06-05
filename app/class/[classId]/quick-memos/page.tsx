'use client';

import React, { useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, Class, ClassQuickMemo } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { 
  ArrowLeftIcon,
  ClockIcon,
  PaperAirplaneIcon,
  PencilIcon,
  XMarkIcon,
  TrashIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import toast from 'react-hot-toast';

// 학급 정보 조회
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

// 빠른 메모 조회 함수 (모든 메모)
async function fetchAllClassQuickMemos(classId: string): Promise<ClassQuickMemo[]> {
  const { data, error } = await (supabase as any)
    .from('class_quick_memos')
    .select('*')
    .eq('class_id', classId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching quick memos:', error);
    return [];
  }

  return data || [];
}

// 빠른 메모 추가 함수
async function addClassQuickMemo(memoData: { class_id: string; content: string }): Promise<ClassQuickMemo> {
  const { data, error } = await (supabase as any)
    .from('class_quick_memos')
    .insert(memoData)
    .select()
    .single();

  if (error) {
    throw new Error('메모 추가 중 오류가 발생했습니다.');
  }

  return data;
}

// 빠근 메모 삭제 함수
async function deleteClassQuickMemo(memoId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('class_quick_memos')
    .delete()
    .eq('id', memoId);

  if (error) {
    throw new Error('메모 삭제 중 오류가 발생했습니다.');
  }
}

export default function QuickMemosPage() {
  const router = useRouter();
  const params = useParams();
  const classId = params.classId as string;
  const [quickMemoText, setQuickMemoText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const queryClient = useQueryClient();

  // 학급 정보 조회
  const { data: classDetails, isLoading: isClassLoading } = useQuery<Class | null, Error>({
    queryKey: ['classDetails', classId],
    queryFn: () => fetchClassDetails(classId),
    enabled: !!classId,
  });

  // 모든 빠른 메모 조회
  const { data: quickMemos, isLoading: isMemosLoading } = useQuery<ClassQuickMemo[], Error>({
    queryKey: ['all-quick-memos', classId],
    queryFn: () => fetchAllClassQuickMemos(classId),
    enabled: !!classId,
  });

  // 빠른 메모 추가 뮤테이션
  const addMemoMutation = useMutation({
    mutationFn: addClassQuickMemo,
    onSuccess: () => {
      toast.success('메모가 추가되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['all-quick-memos'] });
      queryClient.invalidateQueries({ queryKey: ['quick-memos'] }); // 메인 페이지 캐시도 무효화
      setQuickMemoText('');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // 빠른 메모 삭제 뮤테이션
  const deleteMemoMutation = useMutation({
    mutationFn: deleteClassQuickMemo,
    onSuccess: () => {
      toast.success('메모가 삭제되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['all-quick-memos'] });
      queryClient.invalidateQueries({ queryKey: ['quick-memos'] }); // 메인 페이지 캐시도 무효화
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // 검색된 메모 필터링
  const filteredMemos = useMemo(() => {
    if (!quickMemos) return [];
    if (!searchTerm.trim()) return quickMemos;
    
    return quickMemos.filter(memo => 
      memo.content.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [quickMemos, searchTerm]);

  // 빠른 메모 추가 핸들러
  const handleAddQuickMemo = () => {
    if (!quickMemoText.trim()) {
      toast.error('메모 내용을 입력해주세요.');
      return;
    }

    addMemoMutation.mutate({
      class_id: classId,
      content: quickMemoText.trim()
    });
  };

  // Enter 키로 메모 추가
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddQuickMemo();
    }
  };

  // 메모 삭제 핸들러
  const handleDeleteMemo = (memoId: string) => {
    if (confirm('정말로 이 메모를 삭제하시겠습니까?')) {
      deleteMemoMutation.mutate(memoId);
    }
  };

  // 시간 포맷 함수
  const formatMemoTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60);
      return `${diffInMinutes}분 전`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}시간 전`;
    } else {
      // 같은 년도면 월일만, 다른 년도면 년월일 표시
      const isSameYear = date.getFullYear() === now.getFullYear();
      return format(date, isSameYear ? 'M월 d일 HH:mm' : 'yyyy년 M월 d일 HH:mm', { locale: ko });
    }
  };

  // 검색어 클리어 핸들러
  const handleClearSearch = () => {
    setSearchTerm('');
  };

  if (isClassLoading) {
    return <div className="flex justify-center items-center h-screen">로딩 중...</div>;
  }

  if (!classDetails) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">학급을 찾을 수 없습니다</h1>
          <button
            onClick={() => router.push('/')}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.back()}
              className="flex items-center px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors shadow-sm"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              <span>돌아가기</span>
            </button>
            <div className="h-4 w-px bg-gray-300" />
            <h1 className="text-xl font-bold text-gray-800 flex items-center space-x-2">
              <PencilIcon className="h-6 w-6 text-blue-600" />
              <span>{classDetails.name} 빠른 메모</span>
            </h1>
          </div>
        </div>

        {/* 메인 컨텐츠 */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          {/* 메모 통계 및 검색 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <div className="text-xs text-gray-600">
                총 <span className="font-semibold text-blue-600">{quickMemos?.length || 0}</span>개의 메모
                {searchTerm && (
                  <span className="ml-2">
                    • 검색 결과 <span className="font-semibold text-green-600">{filteredMemos.length}</span>개
                  </span>
                )}
              </div>
            </div>
            
            {/* 검색 영역 */}
            <div className="relative">
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <MagnifyingGlassIcon className="h-4 w-4 absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="메모 내용으로 검색하세요..."
                    className="pl-8 pr-8 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs w-48 text-gray-900 placeholder-gray-400"
                  />
                  {searchTerm && (
                    <button
                      onClick={handleClearSearch}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <XMarkIcon className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 메모 입력 영역 */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex space-x-3 mb-2">
              <textarea
                value={quickMemoText}
                onChange={(e) => setQuickMemoText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="빠른 메모를 입력하세요... (Shift+Enter로 줄바꿈, Enter로 저장)"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-900 placeholder-gray-500 text-sm"
                rows={2}
                maxLength={500}
              />
              <div className="flex flex-col space-y-2">
                <button
                  onClick={handleAddQuickMemo}
                  disabled={!quickMemoText.trim() || addMemoMutation.isPending}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                  title={addMemoMutation.isPending ? '추가 중...' : '메모 추가'}
                >
                  <PaperAirplaneIcon className="h-4 w-4" />
                </button>
                <span className="text-xs text-gray-500 text-center">{quickMemoText.length}/500</span>
              </div>
            </div>
          </div>

          {/* 메모 목록 */}
          <div className="space-y-1.5">
            {isMemosLoading ? (
              <div className="text-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-500 mt-2 text-sm">메모를 불러오는 중...</p>
              </div>
            ) : filteredMemos && filteredMemos.length > 0 ? (
              filteredMemos.map((memo, index) => (
                <motion.div
                  key={memo.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="bg-gray-50 rounded p-2 border border-gray-200 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-2">
                      <p className="text-gray-800 text-xs leading-relaxed break-words whitespace-pre-wrap">
                        {searchTerm ? (
                          memo.content.split(new RegExp(`(${searchTerm})`, 'gi')).map((part, i) => 
                            part.toLowerCase() === searchTerm.toLowerCase() ? (
                              <mark key={i} className="bg-yellow-200 px-0.5 rounded">{part}</mark>
                            ) : part
                          )
                        ) : memo.content}
                      </p>
                      <div className="flex items-center mt-1 text-xs text-gray-500">
                        <ClockIcon className="h-3 w-3 mr-1" />
                        <span>{formatMemoTime(memo.created_at)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteMemo(memo.id)}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                      title="메모 삭제"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </motion.div>
              ))
            ) : quickMemos && quickMemos.length > 0 && searchTerm ? (
              <div className="text-center py-8 text-gray-500 bg-gray-50 rounded border-2 border-dashed border-gray-300">
                <MagnifyingGlassIcon className="h-8 w-8 mx-auto mb-3 text-gray-300" />
                <h3 className="text-sm font-medium text-gray-600 mb-1">검색 결과가 없습니다</h3>
                <p className="text-xs text-gray-500">'{searchTerm}'와 일치하는 메모를 찾을 수 없습니다</p>
                <button
                  onClick={handleClearSearch}
                  className="mt-2 text-xs text-blue-600 hover:text-blue-800"
                >
                  검색어 지우기
                </button>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 bg-gray-50 rounded border-2 border-dashed border-gray-300">
                <PencilIcon className="h-8 w-8 mx-auto mb-3 text-gray-300" />
                <h3 className="text-sm font-medium text-gray-600 mb-1">아직 작성된 메모가 없습니다</h3>
                <p className="text-xs text-gray-500">위에서 첫 번째 빠른 메모를 추가해보세요!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 