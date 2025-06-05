'use client';

import React, { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeftIcon,
  PlusIcon,
  XMarkIcon,
  ClipboardDocumentCheckIcon,
  CalendarDaysIcon,
  ChartBarIcon
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

export default function HomeworkPage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  
  const classId = params.classId as string;

  // 상태
  const [isMonthModalOpen, setIsMonthModalOpen] = useState(false);
  const [newMonthYear, setNewMonthYear] = useState('');
  const [newMonthName, setNewMonthName] = useState('');

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

  // 월 추가 핸들러
  const handleAddMonth = () => {
    if (!newMonthYear.trim() || !newMonthName.trim()) {
      toast.error('년월과 이름을 모두 입력해주세요.');
      return;
    }

    addMonthMutation.mutate({ 
      classId, 
      monthYear: newMonthYear, 
      name: newMonthName 
    });
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
      <div className="max-w-6xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.back()}
              className="flex items-center px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors shadow-sm"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              <span>돌아가기</span>
            </button>
            <div className="h-6 w-px bg-gray-300" />
            <h1 className="text-3xl font-bold text-gray-800 flex items-center space-x-2">
              <ClipboardDocumentCheckIcon className="h-8 w-8 text-amber-600" />
              <span>{classDetails.name} 과제 체크</span>
            </h1>
          </div>
          <button
            onClick={() => {
              setNewMonthYear(getCurrentMonthYear());
              setNewMonthName('');
              setIsMonthModalOpen(true);
            }}
            className="flex items-center px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors shadow-sm"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            <span>월 추가</span>
          </button>
        </div>

        {/* 월 카드 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {homeworkMonths.map((month) => (
            <motion.div
              key={month.id}
              onClick={() => router.push(`/class/${classId}/homework/${month.id}`)}
              className="bg-white rounded-xl shadow-sm p-6 cursor-pointer hover:shadow-md transition-all duration-200 hover:-translate-y-1 border border-gray-200"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="text-center">
                <div className="bg-amber-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CalendarDaysIcon className="h-8 w-8 text-amber-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">{month.name}</h3>
                <p className="text-sm text-gray-600 mb-4">
                  {month.month_year}
                </p>
                <div className="bg-amber-50 text-amber-700 text-xs px-3 py-1 rounded-full inline-block">
                  과제 목록 보기
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* 빈 상태 */}
        {homeworkMonths.length === 0 && (
          <div className="text-center py-12">
            <ClipboardDocumentCheckIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">아직 과제 월이 없습니다</h3>
            <p className="text-gray-600 mb-6">
              첫 번째 과제 월을 추가해보세요.
            </p>
            <button
              onClick={() => {
                setNewMonthYear(getCurrentMonthYear());
                setNewMonthName('');
                setIsMonthModalOpen(true);
              }}
              className="flex items-center mx-auto px-6 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors shadow-sm"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              <span>첫 번째 월 추가</span>
            </button>
          </div>
        )}
      </div>

      {/* 월 추가 모달 */}
      <AnimatePresence>
        {isMonthModalOpen && (
          <div className="fixed inset-0 bg-transparent flex items-center justify-center z-50">
            <motion.div
              className="bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-2xl border border-gray-200"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
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
                    년월 (YYYY-MM)
                  </label>
                  <input
                    type="month"
                    value={newMonthYear}
                    onChange={(e) => setNewMonthYear(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                    placeholder="2024-03"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    이름
                  </label>
                  <input
                    type="text"
                    value={newMonthName}
                    onChange={(e) => setNewMonthName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                    placeholder="예: 3월 과제, 중간고사 대비 과제"
                  />
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => setIsMonthModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-900 rounded-md hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleAddMonth}
                  disabled={addMonthMutation.isPending}
                  className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600 transition-colors disabled:opacity-50"
                >
                  {addMonthMutation.isPending ? '추가 중...' : '추가'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
} 