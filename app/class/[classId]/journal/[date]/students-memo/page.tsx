'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  UserGroupIcon,
  CheckIcon,
  XMarkIcon,
  ClockIcon,
  AcademicCapIcon,
  PencilIcon
} from '@heroicons/react/24/outline';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import type { Class, ClassJournal, Student, JournalStudentStatus, ATTENDANCE_STATUS } from '@/lib/supabase';
import { useAutoSave } from '@/hooks/useAutoSave';
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

// 학급 학생 목록 조회
async function fetchStudents(classId: string): Promise<Student[]> {
  const { data, error } = await (supabase as any)
    .from('students')
    .select('*')
    .eq('class_id', classId)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Error fetching students:', error);
    return [];
  }

  return data || [];
}

// 해당 날짜의 학급 일지 조회 또는 생성
async function getOrCreateJournal(classId: string, date: string): Promise<ClassJournal> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('인증이 필요합니다.');
  }

  // 먼저 기존 일지가 있는지 확인
  const { data: existingJournal } = await (supabase as any)
    .from('class_journals')
    .select('*')
    .eq('class_id', classId)
    .eq('journal_date', date)
    .single();

  if (existingJournal) {
    return existingJournal;
  }

  // 없으면 새로 생성
  const { data, error } = await (supabase as any)
    .from('class_journals')
    .insert({
      class_id: classId,
      journal_date: date
    })
    .select()
    .single();

  if (error) {
    throw new Error('일지 생성 중 오류가 발생했습니다.');
  }

  return data;
}

// 기존 학생 상태 조회
async function fetchStudentStatuses(classId: string, date: string): Promise<JournalStudentStatus[]> {
  const { data, error } = await (supabase as any)
    .from('journal_student_status')
    .select(`
      *,
      class_journals!inner(*),
      students(*)
    `)
    .eq('class_journals.class_id', classId)
    .eq('class_journals.journal_date', date);

  if (error) {
    console.error('Error fetching student statuses:', error);
    return [];
  }

  return data || [];
}

// 학생 상태 저장/업데이트
async function saveStudentStatus(
  journalId: string,
  studentId: string,
  attendanceStatus: string,
  memo: string
): Promise<JournalStudentStatus> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('인증이 필요합니다.');
  }

  // upsert 사용 (있으면 업데이트, 없으면 생성)
  const { data, error } = await (supabase as any)
    .from('journal_student_status')
    .upsert({
      journal_id: journalId,
      student_id: studentId,
      attendance_status: attendanceStatus,
      memo: memo,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'journal_id,student_id'
    })
    .select()
    .single();

  if (error) {
    throw new Error('학생 상태 저장 중 오류가 발생했습니다.');
  }

  return data;
}

// 출석 상태 옵션
const ATTENDANCE_OPTIONS = [
  { value: '출석', label: '출석', icon: CheckIcon, color: 'green' },
  { value: '조퇴', label: '조퇴', icon: ClockIcon, color: 'yellow' },
  { value: '결석', label: '결석', icon: XMarkIcon, color: 'red' },
  { value: '체험학습', label: '체험학습', icon: AcademicCapIcon, color: 'blue' },
];

export default function StudentsMemoPage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  
  const classId = params.classId as string;
  const date = params.date as string;

  const [studentStatuses, setStudentStatuses] = useState<Record<string, { attendance: string; memo: string }>>({});
  const [isSaving, setIsSaving] = useState(false);

  // 학급 정보 조회
  const { data: classDetails, isLoading: isClassLoading } = useQuery<Class | null, Error>({
    queryKey: ['classDetails', classId],
    queryFn: () => fetchClassDetails(classId),
    enabled: !!classId,
  });

  // 학생 목록 조회
  const { data: students, isLoading: isStudentsLoading } = useQuery<Student[], Error>({
    queryKey: ['students', classId],
    queryFn: () => fetchStudents(classId),
    enabled: !!classId,
  });

  // 기존 학생 상태 조회
  const { data: existingStatuses, isLoading: isStatusesLoading } = useQuery<JournalStudentStatus[], Error>({
    queryKey: ['student-statuses', classId, date],
    queryFn: () => fetchStudentStatuses(classId, date),
    enabled: !!classId && !!date,
  });

  // 기존 상태 데이터 로드
  useEffect(() => {
    if (students && existingStatuses) {
      const statusMap: Record<string, { attendance: string; memo: string }> = {};
      
      students.forEach(student => {
        const existingStatus = existingStatuses.find(status => status.student_id === student.id);
        statusMap[student.id] = {
          attendance: existingStatus?.attendance_status || '출석',
          memo: existingStatus?.memo || ''
        };
      });
      
      setStudentStatuses(statusMap);
    }
  }, [students, existingStatuses]);

  // 출석 상태 변경
  const handleAttendanceChange = (studentId: string, attendance: string) => {
    const newStatuses = {
      ...studentStatuses,
      [studentId]: {
        ...studentStatuses[studentId],
        attendance
      }
    };
    setStudentStatuses(newStatuses);
    autoSave(newStatuses); // 자동저장 트리거
  };

  // 자동저장 기능
  const { autoSave } = useAutoSave<Record<string, { attendance: string; memo: string }>>({
    delay: 3000, // 3초 후 자동저장
    onSave: async (statuses) => {
      const journal = await getOrCreateJournal(classId, date);
      
      const promises = Object.entries(statuses).map(([studentId, status]) => 
        saveStudentStatus(journal.id, studentId, status.attendance, status.memo)
      );
      
      await Promise.all(promises);
      queryClient.invalidateQueries({ queryKey: ['student-statuses', classId, date] });
      
      console.log('자동저장 완료 - 학생 상태');
    },
    enabled: !!classId && !!date
  });

  // 메모 변경
  const handleMemoChange = (studentId: string, memo: string) => {
    const newStatuses = {
      ...studentStatuses,
      [studentId]: {
        ...studentStatuses[studentId],
        memo
      }
    };
    setStudentStatuses(newStatuses);
    autoSave(newStatuses); // 자동저장 트리거
  };

  // 저장 뮤테이션
  const saveMutation = useMutation({
    mutationFn: async () => {
      // 먼저 일지 생성/조회
      const journal = await getOrCreateJournal(classId, date);
      
      // 모든 학생 상태 저장
      const promises = Object.entries(studentStatuses).map(([studentId, status]) => 
        saveStudentStatus(journal.id, studentId, status.attendance, status.memo)
      );
      
      await Promise.all(promises);
    },
    onSuccess: () => {
      toast.success('학생 상태가 저장되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['date-journals'] });
      queryClient.invalidateQueries({ queryKey: ['student-statuses'] });
      router.push(`/class/${classId}/journal/${date}`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // 저장 핸들러
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveMutation.mutateAsync();
    } finally {
      setIsSaving(false);
    }
  };

  if (isClassLoading || isStudentsLoading || isStatusesLoading) {
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
            <UserGroupIcon className="h-8 w-8 text-green-600" />
            <span>오늘의 아이들</span>
          </h1>
        </div>

        {/* 학급 및 날짜 정보 */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8 border border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="bg-green-100 p-2 rounded-lg">
              <UserGroupIcon className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-800">{classDetails.name}</h2>
              <p className="text-gray-600">{formattedDate} 학생 출결 및 메모</p>
            </div>
          </div>
        </div>

        {/* 학생 목록 */}
        <div className="space-y-4">
          {students && students.map((student, index) => {
            const status = studentStatuses[student.id] || { attendance: '출석', memo: '' };
            
            return (
              <motion.div
                key={student.id}
                className="bg-white rounded-xl shadow-sm p-6 border border-gray-200"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="flex items-start space-x-6">
                  {/* 학생 정보 */}
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-green-600 font-semibold">{student.name[0]}</span>
                    </div>
                    <p className="text-center text-sm font-medium text-gray-800 mt-2">{student.name}</p>
                  </div>

                  {/* 출석 상태 선택 */}
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-800 mb-3">출결 상태</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {ATTENDANCE_OPTIONS.map((option) => {
                        const Icon = option.icon;
                        const isSelected = status.attendance === option.value;
                        
                        return (
                          <button
                            key={option.value}
                            onClick={() => handleAttendanceChange(student.id, option.value)}
                            className={`
                              flex items-center space-x-2 px-3 py-2 rounded-lg border transition-all duration-200
                              ${isSelected 
                                ? `bg-${option.color}-100 border-${option.color}-300 text-${option.color}-700` 
                                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                              }
                            `}
                          >
                            <Icon className="h-4 w-4" />
                            <span className="text-sm font-medium">{option.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 메모 입력 */}
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-3">
                      <PencilIcon className="h-4 w-4 text-gray-600" />
                      <h4 className="text-sm font-medium text-gray-800">특이사항 메모</h4>
                    </div>
                    <textarea
                      value={status.memo}
                      onChange={(e) => handleMemoChange(student.id, e.target.value)}
                      placeholder="학생의 특이사항이나 메모를 입력하세요..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none text-gray-900 placeholder-gray-500"
                      rows={3}
                      maxLength={500}
                    />
                    <p className="text-xs text-gray-500 mt-1">{status.memo.length}/500</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* 저장 버튼 */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            <CheckIcon className="h-5 w-5" />
            <span>{isSaving ? '저장 중...' : '학생 상태 저장'}</span>
          </button>
        </div>
      </div>
    </div>
  );
} 