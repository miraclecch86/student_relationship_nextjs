'use client';

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  CalendarDaysIcon,
  UserGroupIcon,
  SpeakerWaveIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import type { Class, ClassJournalWithDetails } from '@/lib/supabase';

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

// 특정 날짜의 학급 일지 조회 (특정 학급만)
async function fetchDateJournals(date: string, classId: string): Promise<ClassJournalWithDetails[]> {
  const { data, error } = await (supabase as any)
    .from('class_journals')
    .select(`
      *,
      journal_announcements(*),
      journal_student_status(*),
      journal_class_memos(*)
    `)
    .eq('class_id', classId)
    .eq('journal_date', date)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export default function DateJournalPage() {
  const router = useRouter();
  const params = useParams();
  
  const classId = params.classId as string;
  const date = params.date as string;

  // 학급 정보 조회
  const { data: classDetails, isLoading: isClassLoading } = useQuery<Class | null, Error>({
    queryKey: ['classDetails', classId],
    queryFn: () => fetchClassDetails(classId),
    enabled: !!classId,
  });

  // 해당 날짜의 일지 조회
  const { data: journals, isLoading: isJournalsLoading } = useQuery<ClassJournalWithDetails[], Error>({
    queryKey: ['date-journals', date, classId],
    queryFn: () => fetchDateJournals(date, classId),
    enabled: !!date && !!classId,
  });

  // 3가지 기능으로 이동하는 핸들러들
  const handleAnnouncementClick = () => {
    router.push(`/class/${classId}/announcements`);
  };

  const handleStudentsClick = () => {
    router.push(`/class/${classId}/journal/${date}/students-memo`);
  };

  const handleClassMemoClick = () => {
    router.push(`/class/${classId}/journal/${date}/class-notes`);
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

  const formattedDate = format(parseISO(date), 'yyyy년 M월 d일 (E)', { locale: ko });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center space-x-2">
            <CalendarDaysIcon className="h-8 w-8 text-blue-600" />
            <span>{classDetails.name} - {formattedDate}</span>
          </h1>
        </div>

        {/* 안내 메시지 */}
        <div className="text-center mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            오늘의 학급 일지를 작성해보세요
          </h2>
          <p className="text-gray-600">
            아래 3가지 기능 중 원하는 것을 선택하여 일지를 작성할 수 있습니다.
          </p>
        </div>

        {/* 3가지 기능 선택 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 알림장 생성 카드 */}
          <motion.div
            onClick={handleAnnouncementClick}
            className="bg-white rounded-xl shadow-sm p-6 cursor-pointer hover:shadow-md transition-all duration-200 hover:-translate-y-1 border border-gray-200"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="text-center">
              <div className="bg-yellow-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <SpeakerWaveIcon className="h-8 w-8 text-yellow-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">알림장 생성</h3>
              <p className="text-sm text-gray-600 mb-4">
                키워드와 상세 내용을 입력하여 AI가 학부모용 알림장을 자동 생성합니다.
              </p>
              <div className="bg-yellow-50 text-yellow-700 text-xs px-3 py-1 rounded-full inline-block">
                AI 자동 생성
              </div>
            </div>
          </motion.div>

          {/* 오늘의 아이들 카드 */}
          <motion.div
            onClick={handleStudentsClick}
            className="bg-white rounded-xl shadow-sm p-6 cursor-pointer hover:shadow-md transition-all duration-200 hover:-translate-y-1 border border-gray-200"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="text-center">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <UserGroupIcon className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">오늘의 아이들</h3>
              <p className="text-sm text-gray-600 mb-4">
                학생들의 출결 상태를 관리하고 개별 특이사항을 메모할 수 있습니다.
              </p>
              <div className="bg-green-50 text-green-700 text-xs px-3 py-1 rounded-full inline-block">
                출결 & 메모 관리
              </div>
            </div>
          </motion.div>

          {/* 오늘의 우리 반 카드 */}
          <motion.div
            onClick={handleClassMemoClick}
            className="bg-white rounded-xl shadow-sm p-6 cursor-pointer hover:shadow-md transition-all duration-200 hover:-translate-y-1 border border-gray-200"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="text-center">
              <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <DocumentTextIcon className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">오늘의 우리 반</h3>
              <p className="text-sm text-gray-600 mb-4">
                학급 전체의 특이사항, 분위기, 주요 사건 등을 자유롭게 기록합니다.
              </p>
              <div className="bg-purple-50 text-purple-700 text-xs px-3 py-1 rounded-full inline-block">
                학급 전체 메모
              </div>
            </div>
          </motion.div>
        </div>

        {/* 기존 일지 내용 표시 (있는 경우) */}
        {journals && journals.length > 0 && (
          <div className="mt-12">
            <h3 className="text-lg font-semibold text-gray-800 mb-6">이미 작성된 일지 내용</h3>
            <div className="space-y-6">
              {journals.map((journal) => (
                <motion.div
                  key={journal.id}
                  className="bg-white rounded-xl shadow-sm p-6 border border-gray-200"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="bg-blue-100 p-2 rounded-lg">
                        <CalendarDaysIcon className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-gray-800">
                          {classDetails.name} 학급 일지
                        </h4>
                        <p className="text-sm text-gray-500">
                          {format(new Date(journal.created_at), 'HH:mm에 작성', { locale: ko })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 일지 내용 요약 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* 알림장 */}
                    <div className="bg-yellow-50 p-4 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <SpeakerWaveIcon className="h-5 w-5 text-yellow-600" />
                        <h5 className="font-medium text-yellow-800">알림장</h5>
                      </div>
                      <p className="text-sm text-yellow-700">
                        {(journal as any).journal_announcements?.length > 0 
                          ? `${(journal as any).journal_announcements.length}개 알림장 작성됨`
                          : '알림장 없음'
                        }
                      </p>
                    </div>

                    {/* 학생 현황 */}
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <UserGroupIcon className="h-5 w-5 text-green-600" />
                        <h5 className="font-medium text-green-800">학생 현황</h5>
                      </div>
                      <p className="text-sm text-green-700">
                        {(journal as any).journal_student_status?.length > 0 
                          ? `${(journal as any).journal_student_status.length}명 기록됨`
                          : '학생 기록 없음'
                        }
                      </p>
                    </div>

                    {/* 학급 메모 */}
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <DocumentTextIcon className="h-5 w-5 text-purple-600" />
                        <h5 className="font-medium text-purple-800">학급 메모</h5>
                      </div>
                      <p className="text-sm text-purple-700">
                        {(journal as any).journal_class_memos?.length > 0 
                          ? `${(journal as any).journal_class_memos.length}개 메모 작성됨`
                          : '메모 없음'
                        }
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 