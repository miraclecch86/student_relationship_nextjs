'use client';

import React, { useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { supabase, Class, ClassJournal } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { 
  ChevronLeftIcon, 
  ChevronRightIcon, 
  MagnifyingGlassIcon,
  CalendarDaysIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { ko } from 'date-fns/locale';
import toast from 'react-hot-toast';

// 학급 정보 조회
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

// 특정 월의 학급 일지 조회 (특정 학급만) - 각 기능별 상세 정보 포함
async function fetchMonthlyJournals(year: number, month: number, classId: string): Promise<any[]> {
  const startDate = format(new Date(year, month - 1, 1), 'yyyy-MM-dd');
  const endDate = format(new Date(year, month, 0), 'yyyy-MM-dd');

  const { data, error } = await supabase
    .from('class_journals')
    .select(`
      *,
      classes!inner(name, user_id),
      journal_announcements(id, keywords, teacher_input_content, ai_generated_content),
      journal_student_status(id, student_id, attendance_status, memo),
      journal_class_memos(id, content)
    `)
    .eq('class_id', classId)
    .gte('journal_date', startDate)
    .lte('journal_date', endDate)
    .eq('classes.user_id', (await supabase.auth.getSession()).data.session?.user.id);

  if (error) {
    console.error('Error fetching monthly journals:', error);
    return [];
  }

  // 각 일지에 대해 어떤 기능이 있는지 분석
  const journalsWithDetails = (data || []).map(journal => {
    const announcements = (journal as any).journal_announcements || [];
    const studentStatus = (journal as any).journal_student_status || [];
    const classMemos = (journal as any).journal_class_memos || [];

    // 실제 내용이 있는 알림장만 필터링
    const validAnnouncements = announcements.filter((ann: any) => 
      ann.ai_generated_content?.trim() || ann.teacher_input_content?.trim()
    );

    // 실제 내용이 있는 학생 상태만 필터링
    const validStudentStatus = studentStatus.filter((status: any) => 
      status.attendance_status || status.memo?.trim()
    );

    // 실제 내용이 있는 학급 메모만 필터링
    const validClassMemos = classMemos.filter((memo: any) => 
      memo.content?.trim()
    );

    return {
      ...journal,
      hasAnnouncements: validAnnouncements.length > 0,
      hasStudentStatus: validStudentStatus.length > 0,
      hasClassMemos: validClassMemos.length > 0,
      announcementCount: validAnnouncements.length,
      studentStatusCount: validStudentStatus.length,
      classMemoCount: validClassMemos.length
    };
  });

  // 실제 내용이 있는 일지만 반환
  return journalsWithDetails.filter(journal => 
    journal.hasAnnouncements || journal.hasStudentStatus || journal.hasClassMemos
  );
}

// 검색 함수 (특정 학급만)
async function searchJournals(searchTerm: string, classId: string): Promise<any[]> {
  if (!searchTerm.trim()) return [];

  const { data, error } = await supabase
    .from('class_journals')
    .select(`
      *,
      classes!inner(name, user_id),
      journal_announcements(keywords, teacher_input_content, ai_generated_content),
      journal_student_status(memo),
      journal_class_memos(content)
    `)
    .eq('class_id', classId)
    .eq('classes.user_id', (await supabase.auth.getSession()).data.session?.user.id)
    .or(`
      journal_announcements.keywords.cs.{${searchTerm}},
      journal_announcements.teacher_input_content.ilike.%${searchTerm}%,
      journal_announcements.ai_generated_content.ilike.%${searchTerm}%,
      journal_student_status.memo.ilike.%${searchTerm}%,
      journal_class_memos.content.ilike.%${searchTerm}%
    `);

  if (error) {
    console.error('Error searching journals:', error);
    return [];
  }

  return data || [];
}

export default function ClassJournalPage() {
  const router = useRouter();
  const params = useParams();
  const classId = params.classId as string;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // 현재 월의 첫날과 마지막날
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // 학급 정보 조회
  const { data: classDetails, isLoading: isClassLoading } = useQuery<Class | null, Error>({
    queryKey: ['classDetails', classId],
    queryFn: () => fetchClassDetails(classId),
    enabled: !!classId,
  });

  // 월별 일지 조회
  const { data: monthlyJournals, isLoading: isJournalsLoading } = useQuery<any[], Error>({
    queryKey: ['monthly-journals', classId, currentDate.getFullYear(), currentDate.getMonth() + 1],
    queryFn: () => fetchMonthlyJournals(currentDate.getFullYear(), currentDate.getMonth() + 1, classId),
    enabled: !!classId,
  });

  // 날짜별 일지 존재 여부 맵
  const journalMap = useMemo(() => {
    const map = new Map<string, any[]>();
    monthlyJournals?.forEach(journal => {
      const dateKey = journal.journal_date;
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(journal);
    });
    return map;
  }, [monthlyJournals]);

  // 이전/다음 달 이동
  const goToPreviousMonth = () => setCurrentDate(prev => subMonths(prev, 1));
  const goToNextMonth = () => setCurrentDate(prev => addMonths(prev, 1));

  // 검색 실행
  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchJournals(searchTerm, classId);
      setSearchResults(results);
      if (results.length === 0) {
        toast.success('검색 결과가 없습니다.');
      }
    } catch (error) {
      toast.error('검색 중 오류가 발생했습니다.');
    } finally {
      setIsSearching(false);
    }
  };

  // 날짜 클릭 핸들러
  const handleDateClick = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    router.push(`/class/${classId}/journal/${dateStr}`);
  };

  // 검색 결과 클릭 핸들러
  const handleSearchResultClick = (result: any) => {
    router.push(`/class/${classId}/journal/${result.journal_date}`);
  };

  if (isClassLoading || isJournalsLoading) {
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
      <div className="max-w-6xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push(`/class/${classId}/dashboard`)}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5" />
              <span>대시보드로 돌아가기</span>
            </button>
            <div className="h-6 w-px bg-gray-300" />
            <h1 className="text-3xl font-bold text-gray-800 flex items-center space-x-2">
              <CalendarDaysIcon className="h-8 w-8 text-blue-600" />
              <span>{classDetails.name} 학급 일지</span>
            </h1>
          </div>
        </div>

        {/* 검색 섹션 */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">학급 일지 검색</h2>
            <span className="text-sm text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
              {classDetails.name} 학급
            </span>
          </div>
          <div className="flex space-x-4">
            <div className="flex-1">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="키워드를 입력하세요 (알림장 내용, 학생 메모, 학급 메모 등)"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <MagnifyingGlassIcon className="h-5 w-5" />
              <span>{isSearching ? '검색 중...' : '검색'}</span>
            </button>
          </div>

          {/* 검색 결과 */}
          {searchResults.length > 0 && (
            <div className="mt-6">
              <h3 className="text-md font-medium text-gray-700 mb-3">
                검색 결과 ({searchResults.length}개)
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {searchResults.map((result) => (
                  <div
                    key={result.id}
                    onClick={() => handleSearchResultClick(result)}
                    className="p-3 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-blue-900">
                          {format(new Date(result.journal_date), 'yyyy년 M월 d일 (E)', { locale: ko })}
                        </p>
                        <p className="text-sm text-blue-700">{classDetails.name}</p>
                      </div>
                      <span className="text-xs text-blue-600 bg-blue-200 px-2 py-1 rounded">
                        클릭하여 보기
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 캘린더 섹션 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          {/* 캘린더 헤더 */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={goToPreviousMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeftIcon className="h-6 w-6 text-gray-600" />
            </button>
            
            <h2 className="text-2xl font-bold text-gray-800">
              {format(currentDate, 'yyyy년 M월', { locale: ko })}
            </h2>
            
            <button
              onClick={goToNextMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRightIcon className="h-6 w-6 text-gray-600" />
            </button>
          </div>

          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
              <div key={day} className="p-3 text-center text-sm font-medium text-gray-500">
                {day}
              </div>
            ))}
          </div>

          {/* 캘린더 그리드 */}
          <div className="grid grid-cols-7 gap-1">
            {monthDays.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const dayJournals = journalMap.get(dateStr) || [];
              const isToday = isSameDay(day, new Date());

              // 해당 날짜의 모든 기능 정보 수집
              const dayFeatures = {
                hasAnnouncements: false,
                hasStudentStatus: false,
                hasClassMemos: false,
                announcementCount: 0,
                studentStatusCount: 0,
                classMemoCount: 0
              };

              dayJournals.forEach(journal => {
                if (journal.hasAnnouncements) {
                  dayFeatures.hasAnnouncements = true;
                  dayFeatures.announcementCount += journal.announcementCount || 0;
                }
                if (journal.hasStudentStatus) {
                  dayFeatures.hasStudentStatus = true;
                  dayFeatures.studentStatusCount += journal.studentStatusCount || 0;
                }
                if (journal.hasClassMemos) {
                  dayFeatures.hasClassMemos = true;
                  dayFeatures.classMemoCount += journal.classMemoCount || 0;
                }
              });

              const hasAnyContent = dayFeatures.hasAnnouncements || dayFeatures.hasStudentStatus || dayFeatures.hasClassMemos;

              return (
                <motion.div
                  key={day.toISOString()}
                  onClick={() => handleDateClick(day)}
                  className={`
                    p-2 min-h-[100px] border border-gray-200 cursor-pointer transition-all duration-200
                    hover:bg-blue-50 hover:border-blue-300
                    ${isToday ? 'bg-blue-100 border-blue-400' : 'bg-white'}
                    ${hasAnyContent ? 'ring-2 ring-green-200' : ''}
                  `}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="text-sm font-medium text-gray-900 mb-2">
                    {format(day, 'd')}
                  </div>
                  
                  {hasAnyContent && (
                    <div className="space-y-1">
                      {dayFeatures.hasAnnouncements && (
                        <div className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded truncate">
                          📢 알림장
                        </div>
                      )}
                      {dayFeatures.hasStudentStatus && (
                        <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded truncate">
                          👥 오늘의 아이들
                        </div>
                      )}
                      {dayFeatures.hasClassMemos && (
                        <div className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded truncate">
                          📝 오늘의 우리반
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
} 