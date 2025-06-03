'use client';

import React, { useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  ArrowLeftIcon,
  ChartBarIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from 'date-fns';
import { ko } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import type { Class, Student } from '@/lib/supabase';

// 색상 팔레트
const COLORS = {
  present: '#10B981', // 초록색 - 출석
  late: '#F59E0B',    // 노란색 - 조퇴  
  fieldTrip: '#8B5CF6', // 보라색 - 체험학습
  absent: '#EF4444'   // 빨간색 - 결석
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

// 학급 학생 목록 조회
async function fetchClassStudents(classId: string): Promise<Student[]> {
  const { data, error } = await (supabase as any)
    .from('students')
    .select('*')
    .eq('class_id', classId)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Error fetching students:', error);
    return [];
  }

  console.log('Students data received:', data);
  return data || [];
}

// 기간별 출석 데이터 조회
async function fetchAttendanceData(classId: string, startDate: string, endDate: string): Promise<any[]> {
  try {
    console.log('Fetching attendance data for:', { classId, startDate, endDate });
    
    // 1단계: 해당 기간의 모든 일지 먼저 조회
    const { data: journals, error: journalsError } = await (supabase as any)
      .from('class_journals')
      .select('id, journal_date')
      .eq('class_id', classId)
      .gte('journal_date', startDate)
      .lte('journal_date', endDate);

    if (journalsError) {
      console.error('Error fetching journals:', journalsError);
      return [];
    }

    console.log('Journals found:', journals);

    if (!journals || journals.length === 0) {
      console.log('No journals found for the period');
      return [];
    }

    // 2단계: 해당 일지들의 출석 데이터 조회
    const journalIds = journals.map((j: any) => j.id);
    
    const { data: attendanceData, error: attendanceError } = await (supabase as any)
      .from('journal_student_status')
      .select(`
        *,
        students(id, name, student_number)
      `)
      .in('journal_id', journalIds);

    if (attendanceError) {
      console.error('Error fetching attendance:', attendanceError);
      return [];
    }

    console.log('Raw attendance data:', attendanceData);

    // 3단계: 일지 정보와 함께 결합
    const enrichedData = attendanceData?.map((attendance: any) => {
      const journal = journals.find((j: any) => j.id === attendance.journal_id);
      return {
        ...attendance,
        class_journals: journal
      };
    }) || [];

    console.log('Enriched attendance data:', enrichedData);
    return enrichedData;
  } catch (error) {
    console.error('Error in fetchAttendanceData:', error);
    return [];
  }
}

// 출석 통계 계산 함수
function calculateAttendanceStats(attendanceData: any[], students: Student[]) {
  console.log('Calculating stats with:', { 
    attendanceDataCount: attendanceData.length, 
    studentsCount: students.length,
    sampleAttendanceData: attendanceData.slice(0, 3),
    sampleStudents: students.slice(0, 3)
  });

  const studentStats = students.map(student => {
    const studentRecords = attendanceData.filter(record => record.student_id === student.id);
    
    console.log(`Student ${student.name} records:`, studentRecords.map(r => r.attendance_status));
    
    const stats = {
      studentId: student.id,
      studentName: student.name,
      studentNumber: student.student_number,
      present: studentRecords.filter(r => r.attendance_status === '출석').length,
      late: studentRecords.filter(r => r.attendance_status === '조퇴').length,
      fieldTrip: studentRecords.filter(r => r.attendance_status === '체험학습').length,
      absent: studentRecords.filter(r => r.attendance_status === '결석').length,
      total: studentRecords.length
    };

    return {
      ...stats,
      attendanceRate: stats.total > 0 ? ((stats.present / stats.total) * 100).toFixed(1) : '0.0'
    };
  });

  // 전체 통계
  const totalStats = {
    totalStudents: students.length,
    totalRecords: attendanceData.length,
    present: attendanceData.filter(r => r.attendance_status === '출석').length,
    late: attendanceData.filter(r => r.attendance_status === '조퇴').length,
    fieldTrip: attendanceData.filter(r => r.attendance_status === '체험학습').length,
    absent: attendanceData.filter(r => r.attendance_status === '결석').length
  };

  console.log('Calculated stats:', { studentStats: studentStats.slice(0, 3), totalStats });

  return { studentStats, totalStats };
}

type DateRange = 'thisMonth' | 'lastMonth' | 'last3Months' | 'thisYear';

interface DateRangeOption {
  key: DateRange;
  label: string;
  startDate: Date;
  endDate: Date;
}

export default function AttendanceAnalysisPage() {
  const router = useRouter();
  const params = useParams();
  const classId = params.classId as string;
  
  const [selectedRange, setSelectedRange] = useState<DateRange>('thisMonth');

  // 날짜 범위 옵션
  const dateRangeOptions: DateRangeOption[] = useMemo(() => {
    const now = new Date();
    return [
      {
        key: 'thisMonth',
        label: '이번 달',
        startDate: startOfMonth(now),
        endDate: endOfMonth(now)
      },
      {
        key: 'lastMonth',
        label: '지난 달',
        startDate: startOfMonth(subMonths(now, 1)),
        endDate: endOfMonth(subMonths(now, 1))
      },
      {
        key: 'last3Months',
        label: '최근 3개월',
        startDate: startOfMonth(subMonths(now, 2)),
        endDate: endOfMonth(now)
      },
      {
        key: 'thisYear',
        label: '올해',
        startDate: startOfYear(now),
        endDate: endOfYear(now)
      }
    ];
  }, []);

  const currentRange = dateRangeOptions.find(option => option.key === selectedRange)!;

  // 학급 정보 조회
  const { data: classDetails, isLoading: isClassLoading } = useQuery<Class | null, Error>({
    queryKey: ['classDetails', classId],
    queryFn: () => fetchClassDetails(classId),
    enabled: !!classId,
  });

  // 학생 목록 조회
  const { data: students, isLoading: isStudentsLoading } = useQuery<Student[], Error>({
    queryKey: ['students', classId],
    queryFn: () => fetchClassStudents(classId),
    enabled: !!classId,
  });

  // 출석 데이터 조회
  const { data: attendanceData, isLoading: isAttendanceLoading } = useQuery<any[], Error>({
    queryKey: ['attendanceData', classId, selectedRange],
    queryFn: () => fetchAttendanceData(
      classId, 
      format(currentRange.startDate, 'yyyy-MM-dd'),
      format(currentRange.endDate, 'yyyy-MM-dd')
    ),
    enabled: !!classId,
  });

  // 출석 통계 계산
  const { studentStats, totalStats } = useMemo(() => {
    if (!students || !attendanceData) {
      return { studentStats: [], totalStats: { totalStudents: 0, totalRecords: 0, present: 0, late: 0, fieldTrip: 0, absent: 0 } };
    }
    return calculateAttendanceStats(attendanceData, students);
  }, [students, attendanceData]);

  if (isClassLoading || isStudentsLoading) {
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
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push(`/class/${classId}/journal`)}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5" />
              <span>학급 일지로 돌아가기</span>
            </button>
            <div className="h-6 w-px bg-gray-300" />
            <h1 className="text-3xl font-bold text-gray-800 flex items-center space-x-2">
              <ChartBarIcon className="h-8 w-8 text-green-600" />
              <span>{classDetails.name} 출석 분석</span>
            </h1>
          </div>
        </div>

        {/* 기간 정보 */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8 border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-green-100 p-2 rounded-lg">
                <CalendarDaysIcon className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-800">
                  {format(currentRange.startDate, 'yyyy년 M월 d일', { locale: ko })} ~ {format(currentRange.endDate, 'yyyy년 M월 d일', { locale: ko })}
                </h2>
                <p className="text-gray-600">
                  총 {students?.length || 0}명 학생의 출석 분석 결과
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <UserGroupIcon className="h-5 w-5 text-green-600" />
                <span className="text-sm text-gray-600">
                  총 {totalStats.totalRecords}건의 출석 기록
                </span>
              </div>
              {/* 기간 선택 */}
              <div className="flex items-center space-x-3">
                <FunnelIcon className="h-5 w-5 text-gray-500" />
                <select
                  value={selectedRange}
                  onChange={(e) => setSelectedRange(e.target.value as DateRange)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900 bg-white"
                >
                  {dateRangeOptions.map(option => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {isAttendanceLoading ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-gray-600">출석 데이터를 분석하고 있습니다...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8">
            {/* 전체 통계 카드 */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center space-x-2">
                <ChartBarIcon className="h-5 w-5 text-green-600" />
                <span>전체 통계</span>
              </h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-600 rounded-full"></div>
                    <span className="text-gray-700 font-medium">출석</span>
                  </div>
                  <span className="text-green-600 font-bold">{totalStats.present}건</span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-yellow-600 rounded-full"></div>
                    <span className="text-gray-700 font-medium">조퇴</span>
                  </div>
                  <span className="text-yellow-600 font-bold">{totalStats.late}건</span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-purple-600 rounded-full"></div>
                    <span className="text-gray-700 font-medium">체험학습</span>
                  </div>
                  <span className="text-purple-600 font-bold">{totalStats.fieldTrip}건</span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-red-600 rounded-full"></div>
                    <span className="text-gray-700 font-medium">결석</span>
                  </div>
                  <span className="text-red-600 font-bold">{totalStats.absent}건</span>
                </div>
              </div>
            </div>

            {/* 학생별 상세 통계 테이블 */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">학생별 상세 통계</h3>
              
              {studentStats.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-700">학생명</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-700">출석</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-700">조퇴</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-700">체험학습</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-700">결석</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-700">총 기록</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-700">출석률</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentStats.map((stat, index) => (
                        <motion.tr
                          key={stat.studentId}
                          className="border-b border-gray-100 hover:bg-gray-50"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                        >
                          <td className="py-3 px-4 font-medium text-gray-900">{stat.studentName}</td>
                          <td className="text-center py-3 px-4 text-green-600 font-semibold">{stat.present}</td>
                          <td className="text-center py-3 px-4 text-yellow-600 font-semibold">{stat.late}</td>
                          <td className="text-center py-3 px-4 text-purple-600 font-semibold">{stat.fieldTrip}</td>
                          <td className="text-center py-3 px-4 text-red-600 font-semibold">{stat.absent}</td>
                          <td className="text-center py-3 px-4 text-gray-700 font-semibold">{stat.total}</td>
                          <td className="text-center py-3 px-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              parseFloat(stat.attendanceRate) >= 95 
                                ? 'bg-green-100 text-green-800'
                                : parseFloat(stat.attendanceRate) >= 90
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                            }`}>
                              {stat.attendanceRate}%
                            </span>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <UserGroupIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">학생 데이터가 없습니다.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 