'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, Class, ClassJournal, ClassSchedule, ClassQuickMemo, Student } from '@/lib/supabase';

// TODO 아이템 타입 정의
interface TodoItem {
  id: string;
  class_id: string;
  title: string;
  start_date: string;
  end_date: string;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}
import StudentDetailForm from '@/components/StudentDetailForm';
import { motion } from 'framer-motion';
import { 
  ChevronLeftIcon, 
  ChevronRightIcon, 
  MagnifyingGlassIcon,
  CalendarDaysIcon,
  ArrowLeftIcon,
  PlusIcon,
  XMarkIcon,
  ClockIcon,
  PaperAirplaneIcon,
  ClipboardDocumentListIcon,
  ChartBarIcon,
  DocumentTextIcon,
  PencilIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, getDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import toast from 'react-hot-toast';

// 한국 공휴일 데이터 (2025년 기준)
const getKoreanHolidays = (year: number): { [key: string]: string } => {
  const holidays: { [key: string]: string } = {};
  
  // 고정 공휴일
  holidays[`${year}-01-01`] = '신정';
  holidays[`${year}-03-01`] = '삼일절';
  holidays[`${year}-05-05`] = '어린이날';
  holidays[`${year}-06-06`] = '현충일';
  holidays[`${year}-08-15`] = '광복절';
  holidays[`${year}-10-03`] = '개천절';
  holidays[`${year}-10-09`] = '한글날';
  holidays[`${year}-12-25`] = '크리스마스';
  
  // 2025년 음력 공휴일 (매년 달라짐)
  if (year === 2025) {
    holidays['2025-01-28'] = '설날연휴';
    holidays['2025-01-29'] = '설날';
    holidays['2025-01-30'] = '설날연휴';
    holidays['2025-05-05'] = '어린이날'; // 이미 위에 있음
    holidays['2025-05-06'] = '어린이날 대체휴일';
    holidays['2025-08-14'] = '추석연휴';
    holidays['2025-08-15'] = '광복절'; // 이미 위에 있음
    holidays['2025-08-16'] = '추석연휴';
    holidays['2025-08-18'] = '추석 대체휴일';
  }
  
  // 2024년 음력 공휴일
  if (year === 2024) {
    holidays['2024-02-09'] = '설날연휴';
    holidays['2024-02-10'] = '설날';
    holidays['2024-02-11'] = '설날연휴';
    holidays['2024-02-12'] = '설날 대체휴일';
    holidays['2024-04-10'] = '국회의원선거일';
    holidays['2024-05-06'] = '어린이날 대체휴일';
    holidays['2024-09-16'] = '추석연휴';
    holidays['2024-09-17'] = '추석';
    holidays['2024-09-18'] = '추석연휴';
  }
  
  // 2026년 음력 공휴일 (예상)
  if (year === 2026) {
    holidays['2026-02-16'] = '설날연휴';
    holidays['2026-02-17'] = '설날';
    holidays['2026-02-18'] = '설날연휴';
    holidays['2026-10-05'] = '추석연휴';
    holidays['2026-10-06'] = '추석';
    holidays['2026-10-07'] = '추석연휴';
  }
  
  return holidays;
};

// 실시간 공휴일 데이터 가져오기 (GitHub CDN 사용)
const fetchRealTimeHolidays = async (year: number): Promise<{ [key: string]: string }> => {
  try {
    const response = await fetch(`https://holidays.hyunbin.page/${year}.json`);
    if (!response.ok) {
      console.warn(`공휴일 데이터를 찾을 수 없습니다: ${year}년`);
      return getKoreanHolidays(year);
    }
    
    const holidayData = await response.json();
    
    // 빈 객체이거나 null인 경우 처리
    if (!holidayData || typeof holidayData !== 'object') {
      console.warn(`공휴일 데이터가 올바르지 않습니다: ${year}년`);
      return getKoreanHolidays(year);
    }
    
    const holidays: { [key: string]: string } = {};
    
    // JSON 데이터를 우리 형식으로 변환
    Object.entries(holidayData).forEach(([date, names]) => {
      try {
        if (Array.isArray(names)) {
          // 여러 개의 공휴일이 겹치는 경우 첫 번째 이름 사용
          holidays[date] = names[0];
        } else if (typeof names === 'string') {
          holidays[date] = names;
        }
      } catch (entryError) {
        console.warn(`공휴일 데이터 변환 오류: ${date}`, entryError);
      }
    });
    
    return holidays;
  } catch (error) {
    console.warn(`실시간 공휴일 데이터 가져오기 실패 (${year}년):`, error);
    // 실패 시 기본 데이터 사용
    return getKoreanHolidays(year);
  }
};

// 주말 여부 확인 함수
const isWeekend = (date: Date): boolean => {
  const day = getDay(date); // 0: 일요일, 6: 토요일
  return day === 0 || day === 6;
};

// 일요일 여부 확인 함수
const isSunday = (date: Date): boolean => {
  return getDay(date) === 0;
};

// 토요일 여부 확인 함수
const isSaturday = (date: Date): boolean => {
  return getDay(date) === 6;
};

// 공휴일 여부 확인 함수
const getHolidayName = (date: Date, realTimeHolidays?: { [key: string]: string }): string | null => {
  const dateStr = format(date, 'yyyy-MM-dd');
  
  // 실시간 데이터가 있으면 우선 사용
  if (realTimeHolidays && realTimeHolidays[dateStr]) {
    return realTimeHolidays[dateStr];
  }
  
  // 없으면 기본 데이터 사용
  const holidays = getKoreanHolidays(date.getFullYear());
  return holidays[dateStr] || null;
};

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

// 특정 월의 학급 일지 조회 (특정 학급만) - 각 기능별 상세 정보 포함
async function fetchMonthlyJournals(year: number, month: number, classId: string): Promise<any[]> {
  const startDate = format(new Date(year, month - 1, 1), 'yyyy-MM-dd');
  const endDate = format(new Date(year, month, 0), 'yyyy-MM-dd');

  const { data, error } = await (supabase as any)
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
    .eq('classes.user_id', (await (supabase as any).auth.getSession()).data.session?.user.id);

  if (error) {
    console.error('Error fetching monthly journals:', error);
    return [];
  }

  // 일지별로 기능 정보 집계
  const enrichedData = data?.map((journal: any) => {
    const announcements = journal.journal_announcements || [];
    const studentStatuses = journal.journal_student_status || [];
    const classMemos = journal.journal_class_memos || [];

    return {
      ...journal,
      hasAnnouncements: announcements.length > 0,
      hasStudentStatus: studentStatuses.length > 0,
      hasClassMemos: classMemos.length > 0,
      announcementCount: announcements.length,
      studentStatusCount: studentStatuses.length,
      classMemoCount: classMemos.length
    };
  }) || [];

  return enrichedData;
}

// 학급 일지 검색 함수
async function searchJournals(searchTerm: string, classId: string): Promise<any[]> {
  try {
    const { data: { session } } = await (supabase as any).auth.getSession();
    
    if (!session) {
      throw new Error('인증이 필요합니다.');
    }

    // 검색어를 포함하는 일지 검색
    const { data, error } = await (supabase as any)
      .from('class_journals')
      .select(`
        *,
        classes!inner(name, user_id),
        journal_announcements(keywords, teacher_input_content, ai_generated_content),
        journal_student_status(memo),
        journal_class_memos(content)
      `)
      .eq('class_id', classId)
      .eq('classes.user_id', session.user.id)
      .order('journal_date', { ascending: false });

    if (error) {
      throw new Error('검색 중 오류가 발생했습니다.');
    }

    // 검색어와 매칭되는 결과 필터링
    const results = data?.filter((journal: any) => {
      const searchLower = searchTerm.toLowerCase();
      
      // 알림장 내용 검색
      const announcementMatch = journal.journal_announcements?.some((ann: any) => 
        ann.keywords?.some((keyword: string) => keyword.toLowerCase().includes(searchLower)) ||
        ann.teacher_input_content?.toLowerCase().includes(searchLower) ||
        ann.ai_generated_content?.toLowerCase().includes(searchLower)
      );

      // 학생 메모 검색
      const studentMemoMatch = journal.journal_student_status?.some((status: any) =>
        status.memo?.toLowerCase().includes(searchLower)
      );

      // 학급 메모 검색
      const classMemoMatch = journal.journal_class_memos?.some((memo: any) =>
        memo.content?.toLowerCase().includes(searchLower)
      );

      return announcementMatch || studentMemoMatch || classMemoMatch;
    }).map((journal: any) => ({
      ...journal,
      matched_content: `${journal.journal_announcements?.length || 0}개 알림장, ${journal.journal_student_status?.length || 0}개 학생 기록, ${journal.journal_class_memos?.length || 0}개 학급 메모`
    })) || [];

    return results;
  } catch (error) {
    console.error('Error searching journals:', error);
    throw error;
  }
}

// 일정 조회 함수
async function fetchClassSchedules(classId: string, year: number, month: number): Promise<ClassSchedule[]> {
  const startDate = format(new Date(year, month - 1, 1), 'yyyy-MM-dd');
  const endDate = format(new Date(year, month, 0), 'yyyy-MM-dd');

  const { data, error } = await (supabase as any)
    .from('class_schedules')
    .select('*')
    .eq('class_id', classId)
    .gte('schedule_date', startDate)
    .lte('schedule_date', endDate)
    .order('schedule_date', { ascending: true });

  if (error) {
    console.error('Error fetching schedules:', error);
    return [];
  }

  return data || [];
}

// 일정 추가 함수
async function addClassSchedule(scheduleData: Omit<ClassSchedule, 'id' | 'created_at' | 'updated_at'>): Promise<ClassSchedule> {
  const { data, error } = await (supabase as any)
    .from('class_schedules')
    .insert(scheduleData)
    .select()
    .single();

  if (error) {
    throw new Error('일정 추가 중 오류가 발생했습니다.');
  }

  return data;
}

// 일정 삭제 함수
async function deleteClassSchedule(scheduleId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('class_schedules')
    .delete()
    .eq('id', scheduleId);

  if (error) {
    throw new Error('일정 삭제 중 오류가 발생했습니다.');
  }
}

// 일정 수정 함수
async function updateClassSchedule(scheduleId: string, scheduleData: Partial<ClassSchedule>): Promise<ClassSchedule> {
  const { data, error } = await (supabase as any)
    .from('class_schedules')
    .update(scheduleData)
    .eq('id', scheduleId)
    .select()
    .single();

  if (error) {
    throw new Error('일정 수정 중 오류가 발생했습니다.');
  }

  return data;
}

// 빠른 메모 조회 함수
async function fetchClassQuickMemos(classId: string): Promise<ClassQuickMemo[]> {
  const { data, error } = await (supabase as any)
    .from('class_quick_memos')
    .select('*')
    .eq('class_id', classId)
    .order('created_at', { ascending: false })
    .limit(20);

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

// 빠른 메모 삭제 함수
async function deleteClassQuickMemo(memoId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('class_quick_memos')
    .delete()
    .eq('id', memoId);

  if (error) {
    throw new Error('메모 삭제 중 오류가 발생했습니다.');
  }
}

// 일별 우리반 기록 조회 함수
async function fetchClassDailyRecords(classId: string, year: number, month: number): Promise<any[]> {
  const startDate = format(new Date(year, month - 1, 1), 'yyyy-MM-dd');
  const endDate = format(new Date(year, month, 0), 'yyyy-MM-dd');

  const { data, error } = await (supabase as any)
    .from('class_daily_records')
    .select('*')
    .eq('class_id', classId)
    .or(`record_date.gte.${startDate},actual_date.gte.${startDate}`)
    .or(`record_date.lte.${endDate},actual_date.lte.${endDate}`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching daily records:', error);
    return [];
  }

  return data || [];
}

// 월별 출석 데이터 조회 함수
async function fetchMonthlyAttendance(classId: string, year: number, month: number): Promise<any[]> {
  const startDate = format(new Date(year, month - 1, 1), 'yyyy-MM-dd');
  const endDate = format(new Date(year, month, 0), 'yyyy-MM-dd');

  const { data, error } = await (supabase as any)
    .from('journal_student_status')
    .select(`
      *,
      class_journals!inner(
        journal_date,
        class_id
      )
    `)
    .eq('class_journals.class_id', classId)
    .gte('class_journals.journal_date', startDate)
    .lte('class_journals.journal_date', endDate);

  if (error) {
    console.error('Error fetching attendance data:', error);
    return [];
  }

  return data || [];
}

// 월별 알림장 데이터 조회 함수
async function fetchMonthlyAnnouncements(classId: string, year: number, month: number): Promise<any[]> {
  const startDate = format(new Date(year, month - 1, 1), 'yyyy-MM-dd');
  const endDate = format(new Date(year, month, 0), 'yyyy-MM-dd');

  const { data, error } = await (supabase as any)
    .from('journal_announcements')
    .select(`
      *,
      class_journals!inner(
        journal_date,
        class_id
      )
    `)
    .eq('class_journals.class_id', classId)
    .gte('class_journals.journal_date', startDate)
    .lte('class_journals.journal_date', endDate);

  if (error) {
    console.error('Error fetching announcements data:', error);
    return [];
  }

  return data || [];
}

// 학급의 총 학생 수 조회 함수
async function fetchClassStudentCount(classId: string): Promise<number> {
  const { data, error } = await (supabase as any)
    .from('students')
    .select('id')
    .eq('class_id', classId);

  if (error) {
    console.error('Error fetching student count:', error);
    return 0;
  }

  return data?.length || 0;
}

// 학생 생일 정보 조회 함수
async function fetchStudentBirthdays(classId: string): Promise<Array<{id: string, name: string, birthday: string}>> {
  const { data, error } = await (supabase as any)
    .from('students')
    .select('id, name, birthday')
    .eq('class_id', classId)
    .not('birthday', 'is', null);

  if (error) {
    console.error('Error fetching student birthdays:', error);
    return [];
  }

  return data || [];
}

// TODO 아이템 조회
async function fetchClassTodos(classId: string): Promise<TodoItem[]> {
  const { data, error } = await (supabase as any)
    .from('class_todos')
    .select('*')
    .eq('class_id', classId)
    .order('start_date', { ascending: true })
    .order('end_date', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching todos:', error);
    return [];
  }

  return data || [];
}

// TODO 아이템 추가
async function addClassTodo(todoData: { class_id: string; title: string; start_date: string; end_date: string }): Promise<TodoItem> {
  const { data, error } = await (supabase as any)
    .from('class_todos')
    .insert({
      ...todoData,
      is_completed: false
    })
    .select()
    .single();

  if (error) {
    throw new Error('TODO 추가 중 오류가 발생했습니다.');
  }

  return data;
}

// TODO 완료 상태 토글
async function toggleTodoComplete(todoId: string, isCompleted: boolean): Promise<TodoItem> {
  const { data, error } = await (supabase as any)
    .from('class_todos')
    .update({ is_completed: isCompleted })
    .eq('id', todoId)
    .select()
    .single();

  if (error) {
    throw new Error('TODO 상태 변경 중 오류가 발생했습니다.');
  }

  return data;
}

// TODO 아이템 삭제
async function deleteClassTodo(todoId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('class_todos')
    .delete()
    .eq('id', todoId);

  if (error) {
    throw new Error('TODO 삭제 중 오류가 발생했습니다.');
  }
}

export default function ClassJournalPage() {
  const router = useRouter();
  const params = useParams();
  const classId = params.classId as string;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // 일정 관련 상태
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ClassSchedule | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [newSchedule, setNewSchedule] = useState({
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    end_date: '',
    is_all_day: false,
    color: 'blue'
  });

  // 빠른 메모 관련 상태
  const [quickMemoText, setQuickMemoText] = useState('');

  // 탭 관련 상태
  const [activeTab, setActiveTab] = useState<'schedule' | 'classroom' | 'attendance'>('schedule');

  // 실시간 공휴일 데이터 상태
  const [realTimeHolidays, setRealTimeHolidays] = useState<{ [key: string]: string }>({});
  
  // 학생 상세정보 모달 상태
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isStudentDetailOpen, setIsStudentDetailOpen] = useState(false);
  
  // 선택된 날짜 상태 (일정 목록 표시용)
  const [selectedDateForSchedule, setSelectedDateForSchedule] = useState<Date>(new Date());
  
  // TODO 모달 상태
  const [isTodoModalOpen, setIsTodoModalOpen] = useState(false);
  const [newTodo, setNewTodo] = useState({
    title: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: format(new Date(), 'yyyy-MM-dd')
  });

  // 탭 옵션 정의
  const tabs = [
    { key: 'schedule', label: '일정관리', icon: '📅' },
    { key: 'classroom', label: '교실관리', icon: '🏫' },
    { key: 'attendance', label: '출석부', icon: '✅' }
  ] as const;

  // 색상 옵션 정의
  const colorOptions = [
    { value: 'blue', label: '파란색', bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200', solid: 'bg-blue-500' },
    { value: 'red', label: '빨간색', bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200', solid: 'bg-red-500' },
    { value: 'green', label: '초록색', bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200', solid: 'bg-green-500' },
    { value: 'yellow', label: '노란색', bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200', solid: 'bg-yellow-500' },
    { value: 'purple', label: '보라색', bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200', solid: 'bg-purple-500' },
    { value: 'pink', label: '분홍색', bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-200', solid: 'bg-pink-500' },
    { value: 'indigo', label: '남색', bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-200', solid: 'bg-indigo-500' },
    { value: 'teal', label: '청록색', bg: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-200', solid: 'bg-teal-500' },
    { value: 'orange', label: '주황색', bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200', solid: 'bg-orange-500' },
    { value: 'gray', label: '회색', bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200', solid: 'bg-gray-500' }
  ];

  const queryClient = useQueryClient();

  // 현재 월의 첫날과 마지막날
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  
  // 캘린더에서 실제 표시되는 첫 번째 날 (월의 첫째 주 일요일)
  const calendarStart = new Date(monthStart);
  calendarStart.setDate(monthStart.getDate() - monthStart.getDay());
  
  // 캘린더를 항상 6주(42일)로 고정
  const calendarEnd = new Date(calendarStart);
  calendarEnd.setDate(calendarStart.getDate() + 41); // 42일째 (0부터 시작하므로 41을 더함)
  
  // 캘린더 전체 날짜 (항상 42일 - 6주)
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

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
    placeholderData: (previousData) => previousData,
  });

  // 월별 일정 조회
  const { data: monthlySchedules, isLoading: isSchedulesLoading } = useQuery<ClassSchedule[], Error>({
    queryKey: ['monthly-schedules', classId, currentDate.getFullYear(), currentDate.getMonth() + 1],
    queryFn: () => fetchClassSchedules(classId, currentDate.getFullYear(), currentDate.getMonth() + 1),
    enabled: !!classId,
    placeholderData: (previousData) => previousData,
  });

  // 빠른 메모 조회
  const { data: quickMemos, isLoading: isMemosLoading } = useQuery<ClassQuickMemo[], Error>({
    queryKey: ['quick-memos', classId],
    queryFn: () => fetchClassQuickMemos(classId),
    enabled: !!classId,
  });

  // 월별 일일 기록 조회
  const { data: monthlyDailyRecords, isLoading: isDailyRecordsLoading } = useQuery<any[], Error>({
    queryKey: ['monthly-daily-records', classId, currentDate.getFullYear(), currentDate.getMonth() + 1],
    queryFn: () => fetchClassDailyRecords(classId, currentDate.getFullYear(), currentDate.getMonth() + 1),
    enabled: !!classId,
    placeholderData: (previousData) => previousData,
  });

  // 월별 출석 데이터 조회
  const { data: monthlyAttendance, isLoading: isAttendanceLoading } = useQuery<any[], Error>({
    queryKey: ['monthly-attendance', classId, currentDate.getFullYear(), currentDate.getMonth() + 1],
    queryFn: () => fetchMonthlyAttendance(classId, currentDate.getFullYear(), currentDate.getMonth() + 1),
    enabled: !!classId,
    placeholderData: (previousData) => previousData,
  });

  // 월별 알림장 데이터 조회
  const { data: monthlyAnnouncements, isLoading: isAnnouncementsLoading } = useQuery<any[], Error>({
    queryKey: ['monthly-announcements', classId, currentDate.getFullYear(), currentDate.getMonth() + 1],
    queryFn: () => fetchMonthlyAnnouncements(classId, currentDate.getFullYear(), currentDate.getMonth() + 1),
    enabled: !!classId,
    placeholderData: (previousData) => previousData,
  });

  // 학급 학생 수 조회
  const { data: classStudentCount } = useQuery<number, Error>({
    queryKey: ['class-student-count', classId],
    queryFn: () => fetchClassStudentCount(classId),
    enabled: !!classId,
  });

  // 학생 생일 정보 조회
  const { data: studentBirthdays } = useQuery<Array<{id: string, name: string, birthday: string}>, Error>({
    queryKey: ['student-birthdays', classId],
    queryFn: () => fetchStudentBirthdays(classId),
    enabled: !!classId,
  });

  // TODO 목록 조회
  const { data: classTodos, isLoading: isTodosLoading } = useQuery<TodoItem[], Error>({
    queryKey: ['class-todos', classId],
    queryFn: () => fetchClassTodos(classId),
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

  // 날짜별 일일 기록 맵 (actual_date 기준)
  const dailyRecordsMap = useMemo(() => {
    const map = new Map<string, any[]>();
    monthlyDailyRecords?.forEach(record => {
      const dateKey = record.actual_date || record.record_date; // actual_date 우선, 없으면 record_date 사용
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(record);
    });
    return map;
  }, [monthlyDailyRecords]);

  // 날짜별 출석 데이터 맵
  const attendanceMap = useMemo(() => {
    const map = new Map<string, any[]>();
    monthlyAttendance?.forEach(attendance => {
      const dateKey = attendance.class_journals.journal_date;
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(attendance);
    });
    return map;
  }, [monthlyAttendance]);

  // 날짜별 알림장 맵
  const announcementsMap = useMemo(() => {
    const map = new Map<string, any[]>();
    monthlyAnnouncements?.forEach(announcement => {
      const dateKey = announcement.class_journals.journal_date;
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(announcement);
    });
    return map;
  }, [monthlyAnnouncements]);

  // 기간 일정을 모든 해당 날짜에 매핑하는 함수
  const getScheduleDatesInRange = (schedule: ClassSchedule): string[] => {
    const dates: string[] = [];
    const startDate = new Date(schedule.schedule_date);
    const endDate = schedule.end_date ? new Date(schedule.end_date) : startDate;
    
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      dates.push(format(currentDate, 'yyyy-MM-dd'));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dates;
  };

  // 날짜별 일정 맵 (기간 일정 고려)
  const scheduleMap = useMemo(() => {
    const map = new Map<string, ClassSchedule[]>();
    monthlySchedules?.forEach(schedule => {
      const scheduleDates = getScheduleDatesInRange(schedule);
      scheduleDates.forEach(dateKey => {
        if (!map.has(dateKey)) {
          map.set(dateKey, []);
        }
        map.get(dateKey)!.push(schedule);
      });
    });
    return map;
  }, [monthlySchedules]);

  // 날짜별 생일 학생 맵
  const birthdayMap = useMemo(() => {
    const map = new Map<string, Array<{id: string, name: string, birthday: string}>>();
    
    if (studentBirthdays) {
      const currentYear = currentDate.getFullYear();
      
      studentBirthdays.forEach(student => {
        if (student.birthday) {
          // 생일을 현재 년도로 변환 (월-일만 사용)
          const birthdayDate = new Date(student.birthday);
          const birthdayThisYear = new Date(currentYear, birthdayDate.getMonth(), birthdayDate.getDate());
          const dateKey = format(birthdayThisYear, 'yyyy-MM-dd');
          
          if (!map.has(dateKey)) {
            map.set(dateKey, []);
          }
          map.get(dateKey)!.push(student);
        }
      });
    }
    
    return map;
  }, [studentBirthdays, currentDate]);

  // 오늘 생일인 학생들
  const todayBirthdays = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return birthdayMap.get(today) || [];
  }, [birthdayMap]);

  // 선택된 날짜의 일정과 생일 통합 (시간순 정렬)
  const selectedDateSchedules = useMemo(() => {
    const selectedDateStr = format(selectedDateForSchedule, 'yyyy-MM-dd');
    const schedules = scheduleMap.get(selectedDateStr) || [];
    const birthdays = birthdayMap.get(selectedDateStr) || [];
    
    // 일정 데이터 변환
    const scheduleItems = schedules.map(schedule => {
      let timeDisplay = '시간 미지정';
      if (schedule.is_all_day) {
        timeDisplay = '하루 종일';
      } else if (schedule.start_time) {
        const startTime = schedule.start_time.slice(0, 5); // HH:MM 형식으로 자르기
        const endTime = schedule.end_time ? schedule.end_time.slice(0, 5) : null;
        timeDisplay = endTime ? `${startTime} - ${endTime}` : startTime;
      }
      
      return {
        type: 'schedule' as const,
        id: schedule.id,
        title: schedule.title,
        description: schedule.description,
        time: timeDisplay,
        color: schedule.color || 'blue',
        isAllDay: schedule.is_all_day,
        sortTime: schedule.start_time || '00:00',
        studentId: undefined
      };
    });
    
    // 생일 데이터 변환
    const birthdayItems = birthdays.map(student => ({
      type: 'birthday' as const,
      id: student.id,
      title: `${student.name} 생일`,
      description: '🎂',
      time: '하루 종일',
      color: 'blue',
      isAllDay: true,
      sortTime: '00:00',
      studentId: student.id
    }));
    
    // 통합하고 정렬 (생일을 맨 위에, 그 다음 시간순)
    return [...birthdayItems, ...scheduleItems].sort((a, b) => {
      // 생일을 항상 맨 위에
      if (a.type === 'birthday' && b.type !== 'birthday') return -1;
      if (a.type !== 'birthday' && b.type === 'birthday') return 1;
      
      // 같은 타입일 때는 시간순 정렬
      if (a.isAllDay && !b.isAllDay) return -1;
      if (!a.isAllDay && b.isAllDay) return 1;
      return a.sortTime.localeCompare(b.sortTime);
    });
  }, [scheduleMap, birthdayMap, selectedDateForSchedule]);

  // 출석 완료 여부 확인 함수
  const isAttendanceComplete = (dateStr: string): boolean => {
    const dayAttendance = attendanceMap.get(dateStr) || [];
    const totalStudents = classStudentCount || 0;
    
    // 출석부가 작성되어 있고, 전체 학생 수와 출석 기록 수가 일치하면 완료
    return dayAttendance.length > 0 && dayAttendance.length === totalStudents && totalStudents > 0;
  };

  // 출석부 페이지로 이동하는 함수
  const handleAttendanceDateClick = (date: Date) => {
    const formattedDate = format(date, 'yyyy-MM-dd');
    router.push(`/class/${classId}/attendance/${formattedDate}`);
  };

  // 일정 추가 뮤테이션
  const addScheduleMutation = useMutation({
    mutationFn: addClassSchedule,
    onSuccess: () => {
      toast.success('일정이 추가되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['monthly-schedules'] });
      setIsScheduleModalOpen(false);
      setNewSchedule({
        title: '',
        description: '',
        start_time: '',
        end_time: '',
        end_date: '',
        is_all_day: false,
        color: 'blue'
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // 일정 삭제 뮤테이션
  const deleteScheduleMutation = useMutation({
    mutationFn: deleteClassSchedule,
    onSuccess: () => {
      toast.success('일정이 삭제되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['monthly-schedules'] });
      // 모달 닫기 및 상태 초기화
      setIsScheduleModalOpen(false);
      setIsEditMode(false);
      setEditingSchedule(null);
      setNewSchedule({
        title: '',
        description: '',
        start_time: '',
        end_time: '',
        end_date: '',
        is_all_day: false,
        color: 'blue'
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // 일정 수정 뮤테이션
  const updateScheduleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ClassSchedule> }) => updateClassSchedule(id, data),
    onSuccess: () => {
      toast.success('일정이 수정되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['monthly-schedules'] });
      setIsScheduleModalOpen(false);
      setIsEditMode(false);
      setEditingSchedule(null);
      setNewSchedule({
        title: '',
        description: '',
        start_time: '',
        end_time: '',
        end_date: '',
        is_all_day: false,
        color: 'blue'
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // 빠른 메모 추가 뮤테이션
  const addMemoMutation = useMutation({
    mutationFn: addClassQuickMemo,
    onSuccess: () => {
      toast.success('빠른 메모가 추가되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['quick-memos'] });
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
      toast.success('빠른 메모가 삭제되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['quick-memos'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // TODO 추가 뮤테이션
  const addTodoMutation = useMutation({
    mutationFn: addClassTodo,
    onSuccess: () => {
      toast.success('TODO가 추가되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['class-todos'] });
      setIsTodoModalOpen(false);
      setNewTodo({
        title: '',
        start_date: format(new Date(), 'yyyy-MM-dd'),
        end_date: format(new Date(), 'yyyy-MM-dd')
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // TODO 완료 상태 토글 뮤테이션
  const toggleTodoMutation = useMutation({
    mutationFn: ({ todoId, isCompleted }: { todoId: string; isCompleted: boolean }) =>
      toggleTodoComplete(todoId, isCompleted),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-todos'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // TODO 삭제 뮤테이션
  const deleteTodoMutation = useMutation({
    mutationFn: deleteClassTodo,
    onSuccess: () => {
      toast.success('TODO가 삭제되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['class-todos'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // 이전/다음 달 이동
  const goToPreviousMonth = () => {
    setCurrentDate(prev => subMonths(prev, 1));
    // 일정 관리 탭에서 선택된 날짜가 현재 월이 아니면 해당 월의 1일로 변경
    if (activeTab === 'schedule') {
      const newDate = subMonths(currentDate, 1);
      if (!isSameMonth(selectedDateForSchedule, newDate)) {
        setSelectedDateForSchedule(startOfMonth(newDate));
      }
    }
  };
  
  const goToNextMonth = () => {
    setCurrentDate(prev => addMonths(prev, 1));
    // 일정 관리 탭에서 선택된 날짜가 현재 월이 아니면 해당 월의 1일로 변경
    if (activeTab === 'schedule') {
      const newDate = addMonths(currentDate, 1);
      if (!isSameMonth(selectedDateForSchedule, newDate)) {
        setSelectedDateForSchedule(startOfMonth(newDate));
      }
    }
  };

  // 오늘로 이동
  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    // 일정 관리 탭에서는 선택된 날짜도 오늘로 변경
    if (activeTab === 'schedule') {
      setSelectedDateForSchedule(today);
    }
  };

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
    if (activeTab === 'schedule') {
      // 일정 관리 탭에서는 해당 날짜의 일정을 사이드바에 표시
      setSelectedDateForSchedule(date);
    } else {
      // 다른 탭에서는 기존 동작 (해당 날짜 페이지로 이동)
      const formattedDate = format(date, 'yyyy-MM-dd');
      router.push(`/class/${classId}/journal/${formattedDate}`);
    }
  };

  // + 버튼 클릭 핸들러 (새 일정 추가)
  const handleAddScheduleClick = () => {
    setIsEditMode(false);
    setEditingSchedule(null);
    setSelectedDate(new Date());
    setNewSchedule({
      title: '',
      description: '',
      start_time: '',
      end_time: '',
      end_date: '',
      is_all_day: false,
      color: 'blue'
    });
    setIsScheduleModalOpen(true);
  };

  // 일정 클릭 핸들러 (수정)
  const handleScheduleClick = (schedule: ClassSchedule, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditMode(true);
    setEditingSchedule(schedule);
    setSelectedDate(new Date(schedule.schedule_date));
    setNewSchedule({
      title: schedule.title,
      description: schedule.description || '',
      start_time: schedule.start_time || '',
      end_time: schedule.end_time || '',
      end_date: schedule.end_date || '',
      is_all_day: schedule.is_all_day || false,
      color: schedule.color || 'blue'
    });
    setIsScheduleModalOpen(true);
  };

  // 일정 추가/수정 핸들러
  const handleSaveSchedule = () => {
    if (!newSchedule.title.trim()) {
      toast.error('일정 제목을 입력해주세요.');
      return;
    }

    if (!selectedDate) {
      toast.error('날짜를 선택해주세요.');
      return;
    }

    // 종료일이 시작일보다 이전인지 검증
    if (newSchedule.end_date && newSchedule.end_date < format(selectedDate, 'yyyy-MM-dd')) {
      toast.error('종료일은 시작일보다 늦어야 합니다.');
      return;
    }

    const scheduleData = {
      class_id: classId,
      title: newSchedule.title.trim(),
      description: newSchedule.description.trim() || undefined,
      schedule_date: format(selectedDate, 'yyyy-MM-dd'),
      end_date: newSchedule.end_date || undefined,
      start_time: newSchedule.is_all_day ? undefined : (newSchedule.start_time || undefined),
      end_time: newSchedule.is_all_day ? undefined : (newSchedule.end_time || undefined),
      is_all_day: newSchedule.is_all_day,
      color: newSchedule.color
    };

    if (isEditMode && editingSchedule) {
      updateScheduleMutation.mutate({ id: editingSchedule.id, data: scheduleData });
    } else {
      addScheduleMutation.mutate(scheduleData);
    }
  };

  // 하루종일 체크박스 변경 핸들러
  const handleAllDayChange = (checked: boolean) => {
    setNewSchedule(prev => ({
      ...prev,
      is_all_day: checked,
      start_time: checked ? '' : prev.start_time,
      end_time: checked ? '' : prev.end_time
    }));
  };

  // 일정 삭제 핸들러
  const handleDeleteSchedule = (scheduleId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('정말로 이 일정을 삭제하시겠습니까?')) {
      deleteScheduleMutation.mutate(scheduleId);
    }
  };

  // 색상에 따른 클래스 반환
  const getColorClasses = (color: string) => {
    const colorOption = colorOptions.find(option => option.value === color);
    return colorOption || colorOptions[0]; // 기본값은 파란색
  };

  // 빠른 메모 추가 핸들러
  const handleAddQuickMemo = () => {
    if (!quickMemoText.trim()) {
      toast.error('빠른 메모를 입력해주세요.');
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

  // 학생 상세정보 모달 핸들러
  const handleStudentClick = (studentId: string) => {
    setSelectedStudentId(studentId);
    setIsStudentDetailOpen(true);
  };

  const handleStudentDetailClose = () => {
    setIsStudentDetailOpen(false);
    setSelectedStudentId(null);
  };

  const handleStudentSave = () => {
    // 학생 정보 저장 후 생일 정보 다시 로드
    queryClient.invalidateQueries({ queryKey: ['student-birthdays', classId] });
    handleStudentDetailClose();
  };

  // TODO 관련 핸들러
  const handleAddTodo = () => {
    if (!newTodo.title.trim()) {
      toast.error('TODO 제목을 입력해주세요.');
      return;
    }

    if (new Date(newTodo.start_date) > new Date(newTodo.end_date)) {
      toast.error('시작일이 종료일보다 늦을 수 없습니다.');
      return;
    }

    addTodoMutation.mutate({
      class_id: classId,
      title: newTodo.title.trim(),
      start_date: newTodo.start_date,
      end_date: newTodo.end_date
    });
  };

  const handleToggleTodo = (todoId: string, currentCompleted: boolean) => {
    toggleTodoMutation.mutate({
      todoId,
      isCompleted: !currentCompleted
    });
  };

  const handleDeleteTodo = (todoId: string) => {
    if (confirm('정말로 이 TODO를 삭제하시겠습니까?')) {
      deleteTodoMutation.mutate(todoId);
    }
  };

  // 실시간 공휴일 데이터 가져오기
  useEffect(() => {
    const loadHolidays = async () => {
      try {
        const holidays = await fetchRealTimeHolidays(currentDate.getFullYear());
        setRealTimeHolidays(holidays);
      } catch (error) {
        console.warn('공휴일 데이터 로딩 실패:', error);
        // 에러 발생 시 기본 데이터로 폴백
        const fallbackHolidays = getKoreanHolidays(currentDate.getFullYear());
        setRealTimeHolidays(fallbackHolidays);
      }
    };
    
    loadHolidays();
  }, [currentDate.getFullYear()]);

  // 탭 변경 시 선택된 날짜 조정
  useEffect(() => {
    if (activeTab === 'schedule') {
      // 일정 관리 탭으로 변경 시, 선택된 날짜가 현재 월이 아니면 현재 월의 오늘 또는 1일로 변경
      if (!isSameMonth(selectedDateForSchedule, currentDate)) {
        const today = new Date();
        if (isSameMonth(today, currentDate)) {
          setSelectedDateForSchedule(today);
        } else {
          setSelectedDateForSchedule(startOfMonth(currentDate));
        }
      }
    }
  }, [activeTab, currentDate, selectedDateForSchedule]);

  // 학급 정보 로딩 중일 때만 전체 로딩 화면 표시
  if (isClassLoading) {
    return <div className="flex justify-center items-center h-screen">로딩 중...</div>;
  }

  if (!classDetails) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">학급을 찾을 수 없습니다</h1>
          <button
            onClick={() => router.back()}
            className="flex items-center px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors shadow-sm"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            <span>돌아가기</span>
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
              onClick={() => router.back()}
              className="flex items-center px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors shadow-sm"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              <span>돌아가기</span>
            </button>
            <div className="h-6 w-px bg-gray-300" />
            <h1 className="text-3xl font-bold text-gray-800 flex items-center space-x-2">
              <CalendarDaysIcon className="h-8 w-8 text-blue-600" />
              <span>{classDetails.name} 학급 일지</span>
            </h1>
          </div>
        </div>

        {/* 캘린더 섹션 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          {/* 탭 컨텐츠 */}
          <div className="grid grid-cols-12 gap-6">
            {/* 왼쪽 메뉴 리스트 */}
            <div className="col-span-3">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-base font-semibold text-gray-800 mb-4">메뉴</h3>
                <div className="space-y-1.5">
                  <button
                    onClick={() => router.push(`/class/${classId}/journal/${format(new Date(), 'yyyy-MM-dd')}/daily-records`)}
                    className="w-full text-left p-2 rounded-lg bg-white hover:bg-blue-50 hover:text-blue-600 transition-colors border border-gray-200 flex items-center space-x-2.5"
                  >
                    <div className="w-7 h-7 bg-purple-100 rounded-full flex items-center justify-center">
                      <span className="text-purple-600 text-xs font-semibold">📝</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">누가 기록</span>
                  </button>

                  <button
                    onClick={() => router.push(`/class/${classId}/survey`)}
                    className="w-full text-left p-2 rounded-lg bg-white hover:bg-blue-50 hover:text-blue-600 transition-colors border border-gray-200 flex items-center space-x-2.5"
                  >
                    <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center">
                      <span className="text-indigo-600 text-xs font-semibold">📋</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">설문 작성</span>
                  </button>

                  <button
                    onClick={() => router.push(`/class/${classId}/announcements`)}
                    className="w-full text-left p-2 rounded-lg bg-white hover:bg-blue-50 hover:text-blue-600 transition-colors border border-gray-200 flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className="w-7 h-7 bg-orange-100 rounded-full flex items-center justify-center">
                        <span className="text-orange-600 text-xs font-semibold">📢</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">알림장 생성</span>
                    </div>
                    <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium border border-gray-200">AI</span>
                  </button>

                  <button
                    onClick={() => router.push(`/class/${classId}/analysis`)}
                    className="w-full text-left p-2 rounded-lg bg-white hover:bg-blue-50 hover:text-blue-600 transition-colors border border-gray-200 flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className="w-7 h-7 bg-purple-100 rounded-full flex items-center justify-center">
                        <ChartBarIcon className="h-3.5 w-3.5 text-purple-600" />
                      </div>
                      <span className="text-sm font-medium text-gray-900">학급 분석</span>
                    </div>
                    <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium border border-gray-200">AI</span>
                  </button>

                  <button
                    onClick={() => router.push(`/class/${classId}/schoolrecord`)}
                    className="w-full text-left p-2 rounded-lg bg-white hover:bg-blue-50 hover:text-blue-600 transition-colors border border-gray-200 flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className="w-7 h-7 bg-amber-100 rounded-full flex items-center justify-center">
                        <DocumentTextIcon className="h-3.5 w-3.5 text-amber-600" />
                      </div>
                      <span className="text-sm font-medium text-gray-900">쫑알쫑알</span>
                    </div>
                    <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium border border-gray-200">AI</span>
                  </button>

                  <button
                    onClick={() => router.push(`/class/${classId}/attendance-analysis`)}
                    className="w-full text-left p-2 rounded-lg bg-white hover:bg-blue-50 hover:text-blue-600 transition-colors border border-gray-200 flex items-center space-x-2.5"
                  >
                    <div className="w-7 h-7 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-green-600 text-xs font-semibold">📊</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">출석 통계</span>
                  </button>
                  
                  <button
                    onClick={() => router.push(`/class/${classId}/students`)}
                    className="w-full text-left p-2 rounded-lg bg-white hover:bg-blue-50 hover:text-blue-600 transition-colors border border-gray-200 flex items-center space-x-2.5"
                  >
                    <div className="w-7 h-7 bg-emerald-100 rounded-full flex items-center justify-center">
                      <span className="text-emerald-600 text-xs font-semibold">👥</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">학생 정보</span>
                  </button>

                  <button
                    onClick={() => router.push(`/class/${classId}/assessments`)}
                    className="w-full text-left p-2 rounded-lg bg-white hover:bg-blue-50 hover:text-blue-600 transition-colors border border-gray-200 flex items-center space-x-2.5"
                  >
                    <div className="w-7 h-7 bg-rose-100 rounded-full flex items-center justify-center">
                      <span className="text-rose-600 text-xs font-semibold">📊</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">평가 기록</span>
                  </button>

                  <button
                    onClick={() => router.push(`/class/${classId}/homework`)}
                    className="w-full text-left p-2 rounded-lg bg-white hover:bg-blue-50 hover:text-blue-600 transition-colors border border-gray-200 flex items-center space-x-2.5"
                  >
                    <div className="w-7 h-7 bg-amber-100 rounded-full flex items-center justify-center">
                      <span className="text-amber-600 text-xs font-semibold">✅</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">과제 체크</span>
                  </button>
                </div>

                {/* 일정 목록 */}
                {selectedDateSchedules.length > 0 && (
                  <div className="mt-6 bg-blue-50 rounded-xl p-4 border border-blue-200">
                                          <h3 className="text-sm font-semibold text-blue-800 mb-3 flex items-center">
                        <span className="mr-2">📅</span>
                        {format(selectedDateForSchedule, 'M월 d일', { locale: ko })} 일정
                        {isSameDay(selectedDateForSchedule, new Date()) && (
                          <span className="ml-2 text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">오늘</span>
                        )}
                      </h3>
                      <div className="space-y-2">
                        {selectedDateSchedules.map((item) => (
                        <div
                          key={`${item.type}-${item.id}`}
                          onClick={(e) => {
                            if (item.type === 'birthday') {
                              handleStudentClick(item.studentId!);
                            } else {
                              // 일정 클릭 시 기존 handleScheduleClick 함수 활용
                              const schedule = monthlySchedules?.find(s => s.id === item.id);
                              if (schedule) {
                                handleScheduleClick(schedule, e);
                              }
                            }
                          }}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors border ${
                            item.type === 'birthday' 
                              ? 'bg-blue-50 hover:bg-blue-100 border-blue-200' 
                              : 'bg-white hover:bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="flex items-center space-x-2 flex-1 min-w-0">
                            {item.type === 'birthday' ? (
                              <span className="text-sm">🎂</span>
                            ) : (
                              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${getColorClasses(item.color).bg}`}></div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-gray-800 truncate">
                                {item.title}
                              </div>
                            </div>
                          </div>
                          <div className={`text-xs font-medium ml-2 flex-shrink-0 ${
                            item.type === 'birthday' ? 'text-blue-600' : 'text-gray-600'
                          }`}>
                            {item.time}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* 일정이 없는 경우 메시지 */}
                {selectedDateSchedules.length === 0 && (
                  <div className="mt-6 bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-600 mb-2 flex items-center">
                      <span className="mr-2">📅</span>
                      {format(selectedDateForSchedule, 'M월 d일', { locale: ko })} 일정
                      {isSameDay(selectedDateForSchedule, new Date()) && (
                        <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">오늘</span>
                      )}
                    </h3>
                    <div className="text-xs text-gray-500 text-center py-4">
                      {format(selectedDateForSchedule, 'M월 d일', { locale: ko })}에는 등록된 일정이 없습니다
                    </div>
                  </div>
                )}

                {/* TODO 리스트 */}
                <div className="mt-6 bg-green-50 rounded-xl p-4 border border-green-200">
                  <div className="flex items-center justify-between mb-3">
                    <h3 
                      onClick={() => router.push(`/class/${classId}/todos`)}
                      className="text-sm font-semibold text-green-800 flex items-center cursor-pointer hover:text-green-900 transition-colors"
                    >
                      <span className="mr-2">✅</span>
                      TO-DO 리스트
                    </h3>
                    <button
                      onClick={() => setIsTodoModalOpen(true)}
                      className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 transition-colors"
                    >
                      + 추가
                    </button>
                  </div>
                  
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {isTodosLoading ? (
                      <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600 mx-auto"></div>
                      </div>
                    ) : classTodos && classTodos.length > 0 ? (
                      classTodos.map((todo) => (
                        <div
                          key={todo.id}
                          className="flex items-start space-x-2 p-2 rounded-lg bg-white border border-green-200 hover:bg-green-50 transition-colors"
                        >
                          {/* 체크박스와 우선순위 점 */}
                          <div className="flex flex-col items-center">
                            <input
                              type="checkbox"
                              checked={todo.is_completed}
                              onChange={() => handleToggleTodo(todo.id, todo.is_completed)}
                              className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                            />
                            
                            {/* 우선순위 점 (체크박스 하단) */}
                            <div className="mt-1">
                              {(() => {
                                const today = new Date();
                                const startDate = new Date(todo.start_date);
                                const diffDays = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
                                
                                if (diffDays < 0) {
                                  return <div className={`w-1.5 h-1.5 bg-red-500 rounded-full ${!todo.is_completed ? 'animate-pulse' : 'opacity-60'}`} title="지난 TODO"></div>;
                                } else if (diffDays === 0) {
                                  return <div className={`w-1.5 h-1.5 bg-orange-500 rounded-full ${!todo.is_completed ? 'animate-pulse' : 'opacity-60'}`} title="오늘 TODO"></div>;
                                } else if (diffDays <= 3) {
                                  return <div className={`w-1.5 h-1.5 bg-yellow-500 rounded-full ${todo.is_completed ? 'opacity-60' : ''}`} title="임박한 TODO"></div>;
                                } else {
                                  return <div className={`w-1.5 h-1.5 bg-green-500 rounded-full ${todo.is_completed ? 'opacity-60' : ''}`} title="여유있는 TODO"></div>;
                                }
                              })()}
                            </div>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className={`text-xs font-medium ${
                              todo.is_completed 
                                ? 'text-gray-500 line-through' 
                                : 'text-gray-800'
                            } truncate`}>
                              {todo.title}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {format(new Date(todo.start_date), 'M월 d일', { locale: ko })}
                              {todo.start_date !== todo.end_date && (
                                <span> ~ {format(new Date(todo.end_date), 'M월 d일', { locale: ko })}</span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteTodo(todo.id)}
                            className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                            title="삭제"
                          >
                            <TrashIcon className="h-3 w-3" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-gray-500 text-center py-4">
                        등록된 TODO가 없습니다
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 오른쪽 캘린더 */}
            <div className="col-span-9">
              {/* 탭 헤더 - 생일 알림과 함께 한 줄로 배치 */}
              <div className="mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex space-x-8">
                    {tabs.map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-3 text-sm font-medium transition-all duration-200 flex items-center space-x-2 border-b-2 ${
                          activeTab === tab.key
                            ? 'text-blue-600 border-blue-600'
                            : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <span>{tab.icon}</span>
                        <span>{tab.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* 오늘 생일 알림 - 탭 오른쪽으로 이동 */}
                  {todayBirthdays.length > 0 && (
                    <div className="flex items-center space-x-3 px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg shadow-sm">
                      <div className="flex-shrink-0">
                        <span className="text-lg">🎉</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-semibold text-blue-800">
                          오늘 생일이 있어요!
                        </span>
                        <div className="flex space-x-1">
                          {todayBirthdays.map((student, index) => (
                            <span
                              key={student.id}
                              className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full cursor-pointer hover:bg-blue-200 transition-colors"
                              onClick={() => handleStudentClick(student.id)}
                            >
                              <span className="mr-1">🎂</span>
                              {student.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 캘린더 헤더 */}
              <div className="relative flex items-center justify-between mb-6">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={goToPreviousMonth}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ChevronLeftIcon className="h-6 w-6 text-gray-600" />
                  </button>
                  <button
                    onClick={goToToday}
                    className="flex items-center space-x-2 bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                  >
                    <span>📅</span>
                    <span>오늘로 이동</span>
                  </button>
                </div>
                
                <h2 className="absolute left-1/2 transform -translate-x-1/2 text-2xl font-bold text-gray-800">
                  {format(currentDate, 'yyyy년 M월', { locale: ko })}
                </h2>
                
                <div className="flex items-center space-x-2">
                  {activeTab === 'schedule' && (
                    <button
                      onClick={handleAddScheduleClick}
                      className="flex items-center space-x-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      <PlusIcon className="h-5 w-5" />
                      <span>일정 추가</span>
                    </button>
                  )}
                  <button
                    onClick={goToNextMonth}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ChevronRightIcon className="h-6 w-6 text-gray-600" />
                  </button>
                </div>
              </div>

              {/* 요일 헤더 */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['일', '월', '화', '수', '목', '금', '토'].map((day, index) => (
                  <div 
                    key={day} 
                    className={`p-3 text-center text-sm font-medium ${
                      index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : 'text-gray-500'
                    }`}
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* 캘린더 그리드 */}
              <div className="grid grid-cols-7 gap-1 h-[900px]">
                {(isJournalsLoading || isSchedulesLoading || isDailyRecordsLoading || isAttendanceLoading || isAnnouncementsLoading) ? (
                  // 로딩 중일 때도 캘린더 구조 유지
                  Array.from({ length: 42 }, (_, index) => (
                    <div
                      key={`loading-${index}`}
                      className="p-2 min-h-[150px] border bg-white border-gray-200 animate-pulse"
                    >
                      <div className="h-4 bg-gray-200 rounded mb-2 w-6"></div>
                      <div className="space-y-1">
                        <div className="h-3 bg-gray-100 rounded w-full"></div>
                        <div className="h-3 bg-gray-100 rounded w-3/4"></div>
                      </div>
                    </div>
                  ))
                ) : (
                  calendarDays.map((day, index) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const dayJournals = journalMap.get(dateStr) || [];
                    const daySchedules = scheduleMap.get(dateStr) || [];
                    const dayDailyRecords = dailyRecordsMap.get(dateStr) || [];
                    const dayAttendance = attendanceMap.get(dateStr) || [];
                    const dayBirthdays = birthdayMap.get(dateStr) || [];
                    const isToday = isSameDay(day, new Date());
                    const isSelectedDate = activeTab === 'schedule' && isSameDay(day, selectedDateForSchedule);
                    const isWeekendDay = isWeekend(day);
                    const holidayName = getHolidayName(day, realTimeHolidays);
                    const isHoliday = holidayName !== null;
                    const isSundayDay = isSunday(day);
                    const isSaturdayDay = isSaturday(day);
                    const isCurrentMonth = isSameMonth(day, currentDate);

                    // 출석 완료 여부 확인
                    const totalStudents = classStudentCount || 0;
                    const isAttendanceCompleteDay = dayAttendance.length > 0 && dayAttendance.length === totalStudents && totalStudents > 0;

                    const dayFeatures = {
                      hasAnnouncements: false,
                      hasStudentStatus: false,
                      hasClassMemos: false,
                      hasDailyRecords: dayDailyRecords.length > 0,
                      hasAttendance: dayAttendance.length > 0,
                      announcementCount: 0,
                      studentStatusCount: 0,
                      classMemoCount: 0,
                      dailyRecordsCount: dayDailyRecords.length
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

                    // 배경색 결정 로직
                    let backgroundColor = 'bg-white';
                    let borderColor = 'border-gray-200';
                    
                    if (isToday) {
                      backgroundColor = 'bg-white';
                      borderColor = 'border-2 border-blue-500';
                    } else if (isSelectedDate && !isToday) {
                      backgroundColor = 'bg-white';
                      borderColor = 'border-2 border-orange-400';
                    } else if (isWeekendDay && isCurrentMonth) {
                      backgroundColor = 'bg-gray-50';
                      borderColor = 'border-gray-200';
                    } else if (!isCurrentMonth) {
                      backgroundColor = 'bg-gray-25';
                      borderColor = 'border-gray-100';
                    }

                    // 클릭 핸들러 결정
                    const handleDateClickForTab = () => {
                      if (activeTab === 'attendance') {
                        handleAttendanceDateClick(day);
                      } else if (activeTab === 'schedule') {
                        handleDateClick(day);
                      }
                      // 교실관리 탭에서는 날짜 클릭 비활성화
                    };

                    // 날짜 셀 스타일 결정
                    const dateInteractionClass = (activeTab === 'attendance' || activeTab === 'schedule')
                      ? 'cursor-pointer hover:bg-gray-50' 
                      : '';

                    return (
                      <div
                        key={day.toISOString()}
                        className={`
                          p-2 min-h-[150px] border transition-all duration-200 relative
                          ${backgroundColor} ${borderColor} ${dateInteractionClass}
                        `}
                        onClick={(activeTab === 'attendance' || activeTab === 'schedule') ? handleDateClickForTab : undefined}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className={`text-sm font-medium ${
                            !isCurrentMonth
                              ? 'text-gray-300'
                              : isHoliday 
                                ? 'text-red-600 font-bold' 
                                : isSundayDay
                                  ? 'text-red-500'
                                  : isSaturdayDay 
                                    ? 'text-blue-500'
                                    : 'text-gray-900'
                          }`}>
                            {format(day, 'd')}
                          </div>
                        </div>
                        
                        {/* 공휴일 표시 (현재 월만) */}
                        {isHoliday && isCurrentMonth && (
                          <div className="text-[10px] text-red-600 font-semibold mb-1 truncate">
                            {holidayName}
                          </div>
                        )}
                        
                        {/* 생일 표시 (일정 관리 탭에서만, 현재 월만) */}
                        {activeTab === 'schedule' && dayBirthdays.length > 0 && isCurrentMonth && (
                          <div className="mb-1">
                            {dayBirthdays.slice(0, 2).map((student) => (
                              <div
                                key={student.id}
                                className="text-[10px] px-1.5 py-0.5 rounded truncate mb-0.5 cursor-pointer transition-colors flex items-center bg-blue-100 text-blue-800 hover:bg-blue-200"
                                title={`${student.name} 생일${isToday ? ' (오늘!)' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStudentClick(student.id);
                                }}
                              >
                                <span className="mr-1">🎂</span>
                                <span>{student.name}</span>
                              </div>
                            ))}
                            {dayBirthdays.length > 2 && (
                              <div className="text-[10px] text-blue-600 px-1.5 py-0.5">
                                +{dayBirthdays.length - 2}명 더
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* 일정 표시 (일정 탭일 때만) */}
                        {activeTab === 'schedule' && daySchedules.length > 0 && isCurrentMonth && (
                          <div className="absolute bottom-1 left-1 right-1 flex flex-col-reverse space-y-reverse space-y-0.5">
                            {daySchedules.slice(0, 6).map((schedule) => {
                              const colorClasses = getColorClasses(schedule.color || 'blue');
                              
                              return (
                                <div
                                  key={`${schedule.id}-${dateStr}`}
                                  onClick={(e) => handleScheduleClick(schedule, e)}
                                  className={`text-[10px] px-1.5 py-0.5 rounded truncate cursor-pointer hover:brightness-110 transition-all ${colorClasses.bg} ${colorClasses.text} font-medium`}
                                  title={`${schedule.title}${schedule.description ? ` - ${schedule.description}` : ''}`}
                                >
                                  {schedule.title}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* 교실관리 탭일 때 일일 기록과 알림장 표시 */}
                        {activeTab === 'classroom' && isCurrentMonth && (
                          <div className="absolute bottom-1 left-1 right-1 flex flex-col space-y-0.5">
                            {/* 누가 기록 표시 */}
                            {dayFeatures.hasDailyRecords && (
                              <div 
                                className="text-[10px] bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded truncate cursor-pointer hover:bg-teal-200 transition-colors font-medium"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/class/${classId}/journal/${dateStr}/daily-records`);
                                }}
                              >
                                📝 누가 기록
                              </div>
                            )}
                            {/* 알림장 표시 */}
                            {announcementsMap.get(dateStr) && announcementsMap.get(dateStr)!.length > 0 && (
                              <div 
                                className="text-[10px] bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded truncate cursor-pointer hover:bg-yellow-200 transition-colors font-medium"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/class/${classId}/announcements`);
                                }}
                              >
                                📢 알림장
                              </div>
                            )}
                          </div>
                        )}

                        {/* 출석부 탭일 때 출석 완료 표시 - 맨 아래 고정 */}
                        {activeTab === 'attendance' && isCurrentMonth && (
                          <div className="absolute bottom-1 left-1 right-1">
                            {dayAttendance.length === totalStudents && totalStudents > 0 ? (
                              <div className="text-[10px] bg-green-100 text-green-800 px-1.5 py-0.5 rounded truncate font-medium">
                                ✅ 출석완료
                              </div>
                            ) : dayAttendance.length > 0 && totalStudents > 0 ? (
                              <div className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded truncate font-medium">
                                ⏳ 진행중 ({dayAttendance.length}/{totalStudents})
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 캘린더 하단 빠른 메모 섹션 - 전체 너비 */}
        <div className="bg-white rounded-xl shadow-sm p-4 mt-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => router.push(`/class/${classId}/quick-memos`)}
              className="text-lg font-semibold text-gray-800 flex items-center space-x-2 hover:text-blue-600 transition-colors cursor-pointer"
            >
              <PencilIcon className="h-5 w-5 text-blue-600" />
              <span>빠른 메모</span>
            </button>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-500">
                {quickMemos?.length || 0}개 메모
              </span>
            </div>
          </div>

          {/* 메모 입력 영역 */}
          <div className="mb-4">
            <div className="flex space-x-3">
              <textarea
                value={quickMemoText}
                onChange={(e) => setQuickMemoText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="빠른 메모를 입력하세요... (Shift+Enter로 줄바꿈, Enter로 저장)"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-900 placeholder-gray-500 text-sm"
                rows={2}
                maxLength={500}
              />
              <button
                onClick={handleAddQuickMemo}
                disabled={!quickMemoText.trim() || addMemoMutation.isPending}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center self-start text-sm"
                title={addMemoMutation.isPending ? '추가 중...' : '메모 추가'}
              >
                <PaperAirplaneIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* 메모 목록 - 최근 5개만 표시 */}
          <div className="space-y-1.5">
            {quickMemos && quickMemos.length > 0 ? (
              <div>
                {/* 메모 표시 영역 */}
                <div className="space-y-1.5">
                  {quickMemos.slice(0, 5).map((memo) => (
                    <div
                      key={memo.id}
                      className="bg-gray-50 rounded p-2 border border-gray-200 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 pr-2">
                          <p className="text-gray-800 text-xs leading-relaxed break-words">{memo.content}</p>
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
                    </div>
                  ))}
                </div>
                
                {/* 전체 보기 안내 */}
                {quickMemos.length > 5 && (
                  <div className="text-center pt-2 border-t border-gray-200">
                    <button
                      onClick={() => router.push(`/class/${classId}/quick-memos`)}
                      className="text-xs text-gray-500 hover:text-blue-600 transition-colors"
                    >
                      {quickMemos.length - 5}개 메모 더 있음 • 전체 보기
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500 bg-gray-50 rounded border-2 border-dashed border-gray-300">
                <PencilIcon className="h-5 w-5 mx-auto mb-2 text-gray-300" />
                <p className="text-xs font-medium text-gray-600">아직 작성된 메모가 없습니다</p>
                <p className="text-xs text-gray-500 mt-0.5">위에서 빠른 메모를 추가해보세요!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 일정 추가/수정 모달 */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-xl border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {isEditMode ? '일정 수정' : '일정 추가'}
              </h3>
              <button
                onClick={() => {
                  setIsScheduleModalOpen(false);
                  setIsEditMode(false);
                  setEditingSchedule(null);
                  setNewSchedule({
                    title: '',
                    description: '',
                    start_time: '',
                    end_time: '',
                    end_date: '',
                    is_all_day: false,
                    color: 'blue'
                  });
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              {/* 제목 */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">제목</label>
                <input
                  type="text"
                  value={newSchedule.title}
                  onChange={(e) => setNewSchedule(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="일정 제목을 입력하세요"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  maxLength={100}
                />
              </div>

              {/* 설명 */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">설명 (선택사항)</label>
                <textarea
                  value={newSchedule.description}
                  onChange={(e) => setNewSchedule(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="일정 설명을 입력하세요"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-900"
                  rows={3}
                  maxLength={500}
                />
              </div>

              {/* 날짜 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">시작일</label>
                  <input
                    type="date"
                    value={selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''}
                    onChange={(e) => setSelectedDate(new Date(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">종료일</label>
                  <input
                    type="date"
                    value={newSchedule.end_date}
                    onChange={(e) => setNewSchedule(prev => ({ ...prev, end_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  />
                </div>
              </div>

              {/* 시간 (하루종일이 아닐 때만) */}
              {!newSchedule.is_all_day && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">시작 시간</label>
                    <input
                      type="time"
                      value={newSchedule.start_time}
                      onChange={(e) => setNewSchedule(prev => ({ ...prev, start_time: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">종료 시간</label>
                    <input
                      type="time"
                      value={newSchedule.end_time}
                      onChange={(e) => setNewSchedule(prev => ({ ...prev, end_time: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    />
                  </div>
                </div>
              )}

              {/* 하루종일 체크박스 */}
              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={newSchedule.is_all_day}
                    onChange={(e) => handleAllDayChange(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-900">하루종일</span>
                </label>
              </div>

              {/* 색상 */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">색상</label>
                <div className="flex items-center space-x-2">
                  {colorOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setNewSchedule(prev => ({ ...prev, color: option.value }))}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${option.solid} ${
                        newSchedule.color === option.value
                          ? 'border-gray-800 scale-110'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                      title={option.label}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* 버튼 */}
            <div className="flex items-center justify-between mt-6">
              <div>
                {isEditMode && editingSchedule && (
                  <button
                    onClick={(e) => handleDeleteSchedule(editingSchedule.id, e)}
                    className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center space-x-2"
                  >
                    <TrashIcon className="h-4 w-4" />
                    <span>삭제</span>
                  </button>
                )}
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => {
                    setIsScheduleModalOpen(false);
                    setIsEditMode(false);
                    setEditingSchedule(null);
                    setNewSchedule({
                      title: '',
                      description: '',
                      start_time: '',
                      end_time: '',
                      end_date: '',
                      is_all_day: false,
                      color: 'blue'
                    });
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleSaveSchedule}
                  disabled={!newSchedule.title.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isEditMode ? '수정' : '추가'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TODO 추가 모달 */}
      {isTodoModalOpen && (
        <div className="fixed inset-0 bg-transparent flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-xl border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">TODO 추가</h3>
              <button
                onClick={() => {
                  setIsTodoModalOpen(false);
                  setNewTodo({
                    title: '',
                    start_date: format(new Date(), 'yyyy-MM-dd'),
                    end_date: format(new Date(), 'yyyy-MM-dd')
                  });
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              {/* 제목 */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">내용</label>
                <input
                  type="text"
                  value={newTodo.title}
                  onChange={(e) => setNewTodo(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="할 일을 입력하세요"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                  maxLength={200}
                />
              </div>

              {/* 날짜 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">시작일</label>
                  <input
                    type="date"
                    value={newTodo.start_date}
                    onChange={(e) => setNewTodo(prev => ({ ...prev, start_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">종료일</label>
                  <input
                    type="date"
                    value={newTodo.end_date}
                    onChange={(e) => setNewTodo(prev => ({ ...prev, end_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                  />
                </div>
              </div>
            </div>

            {/* 버튼 */}
            <div className="flex items-center justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setIsTodoModalOpen(false);
                  setNewTodo({
                    title: '',
                    start_date: format(new Date(), 'yyyy-MM-dd'),
                    end_date: format(new Date(), 'yyyy-MM-dd')
                  });
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleAddTodo}
                disabled={!newTodo.title.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 학생 상세정보 모달 */}
      {isStudentDetailOpen && selectedStudentId && (
        <StudentDetailForm
          studentId={selectedStudentId}
          classId={classId}
          onClose={handleStudentDetailClose}
          onSave={handleStudentSave}
        />
      )}
    </div>
  );
}