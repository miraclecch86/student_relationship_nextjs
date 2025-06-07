'use client';

import React, { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PlusIcon,
  XMarkIcon,
  ClipboardDocumentCheckIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  PencilIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

// 타입 정의
interface Class {
  id: string;
  name: string;
  user_id: string;
}

interface HomeworkMonth {
  id: string;
  class_id: string;
  month_year: string;
  name: string;
  created_at: string;
  updated_at: string;
}

// API 함수들
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

async function fetchHomeworkMonths(classId: string): Promise<HomeworkMonth[]> {
  const { data, error } = await (supabase as any)
    .from('homework_months')
    .select('*')
    .eq('class_id', classId)
    .order('month_year', { ascending: false });

  if (error) {
    console.error('Error fetching homework months:', error);
    return [];
  }

  return data || [];
}

async function addHomeworkMonth(classId: string, monthYear: string, name: string): Promise<HomeworkMonth> {
  const { data, error } = await (supabase as any)
    .from('homework_months')
    .insert({
      class_id: classId,
      month_year: monthYear,
      name: name.trim()
    })
    .select()
    .single();

  if (error) {
    throw new Error('과제 월 추가 중 오류가 발생했습니다.');
  }

  return data;
}

async function updateHomeworkMonth(monthId: string, monthYear: string, name: string): Promise<HomeworkMonth> {
  const { data, error } = await (supabase as any)
    .from('homework_months')
    .update({
      month_year: monthYear,
      name: name.trim()
    })
    .eq('id', monthId)
    .select()
    .single();

  if (error) {
    throw new Error('과제 월 수정 중 오류가 발생했습니다.');
  }

  return data;
}

export default function HomeworkPage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  
  const classId = params.classId as string;

  // 상태
  const [isMonthModalOpen, setIsMonthModalOpen] = useState(false);
  const [newMonthYear, setNewMonthYear] = useState('');
  const [newMonthName, setNewMonthName] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingMonth, setEditingMonth] = useState<HomeworkMonth | null>(null);
  const [editMonthYear, setEditMonthYear] = useState('');
  const [editMonthName, setEditMonthName] = useState('');

  // 데이터 조회
  const { data: classDetails } = useQuery({
    queryKey: ['classDetails', classId],
    queryFn: () => fetchClassDetails(classId),
    enabled: !!classId,
  });

  const { data: homeworkMonths = [] } = useQuery<HomeworkMonth[]>({
    queryKey: ['homeworkMonths', classId],
    queryFn: () => fetchHomeworkMonths(classId),
    enabled: !!classId,
  });

  // 월 추가 뮤테이션
  const addMonthMutation = useMutation({
    mutationFn: ({ classId, monthYear, name }: { classId: string; monthYear: string; name: string }) => 
      addHomeworkMonth(classId, monthYear, name),
    onSuccess: () => {
      toast.success('과제 월이 추가되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['homeworkMonths'] });
      setNewMonthYear('');
      setNewMonthName('');
      setIsMonthModalOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // 월 수정 뮤테이션
  const updateMonthMutation = useMutation({
    mutationFn: ({ monthId, monthYear, name }: { monthId: string; monthYear: string; name: string }) => 
      updateHomeworkMonth(monthId, monthYear, name),
    onSuccess: () => {
      toast.success('과제 월이 수정되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['homeworkMonths'] });
      setEditMonthYear('');
      setEditMonthName('');
      setEditingMonth(null);
      setIsEditModalOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // 월 추가 핸들러
  const handleAddMonth = () => {
    if (!newMonthYear.trim()) {
      toast.error('년월을 선택해주세요.');
      return;
    }

    // 설명이 비어있으면 기본값 설정
    const description = newMonthName.trim() || `${newMonthYear.split('-')[0]}년 ${parseInt(newMonthYear.split('-')[1])}월 과제`;

    addMonthMutation.mutate({ 
      classId, 
      monthYear: newMonthYear, 
      name: description 
    });
  };

  // 월 수정 핸들러
  const handleEditMonth = (month: HomeworkMonth) => {
    setEditingMonth(month);
    setEditMonthYear(month.month_year);
    setEditMonthName(month.name);
    setIsEditModalOpen(true);
  };

  const handleUpdateMonth = () => {
    if (!editMonthYear.trim()) {
      toast.error('년월을 선택해주세요.');
      return;
    }

    if (editingMonth) {
      // 설명이 비어있으면 기본값 설정
      const description = editMonthName.trim() || `${editMonthYear.split('-')[0]}년 ${parseInt(editMonthYear.split('-')[1])}월 과제`;

      updateMonthMutation.mutate({ 
        monthId: editingMonth.id,
        monthYear: editMonthYear, 
        name: description 
      });
    }
  };

  // 현재 년월을 기본값으로 설정
  const getCurrentMonthYear = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  if (!classDetails) {
    return <div className="flex justify-center items-center h-screen">로딩 중...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center space-x-2">
            <ClipboardDocumentCheckIcon className="h-6 w-6 text-amber-600" />
            <span>과제 체크</span>
          </h1>
        </div>

        {/* 학급 정보 */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
              <ClipboardDocumentCheckIcon className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-800">{classDetails.name} 과제 체크</h2>
              <p className="text-sm text-gray-600">월별 과제를 관리하고 학생들의 제출 현황을 확인할 수 있습니다</p>
            </div>
          </div>
        </div>

        {/* 과제 월 목록 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-800">
              과제 월 목록 ({homeworkMonths.length}개)
            </h3>
            <button
              onClick={() => {
                setNewMonthYear(getCurrentMonthYear());
                setNewMonthName('');
                setIsMonthModalOpen(true);
              }}
              className="flex items-center space-x-2 bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 transition-colors"
            >
              <PlusIcon className="h-5 w-5" />
              <span>월 추가</span>
            </button>
          </div>

          {/* 월 카드 그리드 */}
          {homeworkMonths.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <AnimatePresence>
          {homeworkMonths.map((month) => {
            // 년월을 한국어 형식으로 변환
            const formatMonthYear = (monthYear: string) => {
              const [year, monthNum] = monthYear.split('-');
              return `${year}년 ${parseInt(monthNum)}월`;
            };
            
            return (
              <motion.div
                key={month.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer group"
                onClick={() => router.push(`/class/${classId}/homework/${month.id}`)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                    <CalendarDaysIcon className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditMonth(month);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
                      title="과제 월 수정"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // 삭제 로직 (나중에 구현)
                        console.log('Delete homework month:', month.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                      title="과제 월 삭제"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <h4 className="text-lg font-semibold text-gray-800 mb-2">
                  {formatMonthYear(month.month_year)}
                </h4>
                <p className="text-sm text-gray-600 mb-3 min-h-[2.5rem] leading-relaxed">
                  {month.name || '과제 설명이 없습니다.'}
                </p>
                <div className="mt-3 flex items-center text-xs text-amber-600">
                  <ClipboardDocumentCheckIcon className="h-3 w-3 mr-1" />
                  <span>과제 목록 보기</span>
                </div>
              </motion.div>
            );
          })}
              </AnimatePresence>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ClipboardDocumentCheckIcon className="h-8 w-8 text-amber-600" />
              </div>
              <p className="text-gray-600 mb-4">아직 생성된 과제 월이 없습니다</p>
              <button
                onClick={() => {
                  setNewMonthYear(getCurrentMonthYear());
                  setNewMonthName('');
                  setIsMonthModalOpen(true);
                }}
                className="text-amber-600 hover:text-amber-800 font-medium"
              >
                첫 번째 과제 월 생성하기
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 월 추가 모달 */}
      <AnimatePresence>
        {isMonthModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
            onClick={() => setIsMonthModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">새 과제 월 추가</h3>
                <button
                  onClick={() => setIsMonthModalOpen(false)}
                  className="text-gray-600 hover:text-gray-800"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    년월 선택 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="month"
                    value={newMonthYear}
                    onChange={(e) => setNewMonthYear(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-gray-900"
                  />
                  <p className="text-xs text-gray-500 mt-1">선택한 월이 카드 제목으로 표시됩니다</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    설명 (선택사항)
                  </label>
                  <textarea
                    value={newMonthName}
                    onChange={(e) => setNewMonthName(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-gray-900 placeholder-gray-500 resize-none"
                    placeholder="예: 중간고사 대비 과제, 여름방학 특별과제, 단원 정리 과제"
                  />
                  <p className="text-xs text-gray-500 mt-1">비워두면 기본 설명이 자동으로 생성됩니다</p>
                </div>
              </div>

                              <div className="flex items-center justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setIsMonthModalOpen(false)}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleAddMonth}
                    disabled={!newMonthYear.trim() || addMonthMutation.isPending}
                    className="bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {addMonthMutation.isPending ? '추가 중...' : '추가하기'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 월 수정 모달 */}
      <AnimatePresence>
        {isEditModalOpen && editingMonth && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
            onClick={() => setIsEditModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">과제 월 수정</h3>
                  <button
                    onClick={() => setIsEditModalOpen(false)}
                    className="text-gray-600 hover:text-gray-800"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      년월 선택 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="month"
                      value={editMonthYear}
                      onChange={(e) => setEditMonthYear(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      설명 (선택사항)
                    </label>
                    <textarea
                      value={editMonthName}
                      onChange={(e) => setEditMonthName(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-gray-900 placeholder-gray-500 resize-none"
                      placeholder="예: 중간고사 대비 과제, 여름방학 특별과제, 단원 정리 과제"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleUpdateMonth}
                    disabled={!editMonthYear.trim() || updateMonthMutation.isPending}
                    className="bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updateMonthMutation.isPending ? '수정 중...' : '수정하기'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
} 