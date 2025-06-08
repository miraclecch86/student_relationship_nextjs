'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { supabase, Class } from '@/lib/supabase';
import {
  ClipboardDocumentListIcon,
  UserGroupIcon,
  ChartBarIcon,
  DocumentTextIcon,
  InformationCircleIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import CarouselBanner from '@/components/CarouselBanner';

// 학급 정보 조회 함수
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

// 대시보드 카드 컴포넌트
interface DashboardCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  color: string;
}

function DashboardCard({ title, description, icon, href, color }: DashboardCardProps) {
  const router = useRouter();
  
  return (
    <motion.div
      className="group bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer border border-gray-100 hover:border-gray-200 overflow-hidden"
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={() => router.push(href)}
    >
      {/* 아이콘 영역 */}
      <div className={`${color} px-3 py-4 relative`}>
        <div className="flex items-center justify-between">
          <div className="bg-white/25 backdrop-blur-sm p-3 rounded-xl group-hover:scale-105 transition-transform duration-300">
          {icon}
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>
        {/* 미묘한 그라데이션 오버레이 */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
      
      {/* 텍스트 영역 */}
      <div className="p-5">
        <h3 className="text-lg font-bold text-gray-800 mb-2 group-hover:text-gray-900 transition-colors duration-300">
          {title}
        </h3>
        <p className="text-sm text-gray-600 line-clamp-3 group-hover:text-gray-700 transition-colors duration-300">
          {description}
        </p>
        
        {/* 하단 액션 힌트 */}
        <div className="mt-3 flex items-center text-xs font-medium opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-1 group-hover:translate-y-0">
          <span className={`${color.replace('bg-', 'text-').replace('-500', '-600')}`}>
            자세히 보기
          </span>
          <svg className={`w-3 h-3 ml-1 ${color.replace('bg-', 'text-').replace('-500', '-600')}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </motion.div>
  );
}

export default function ClassDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.classId as string;
  const [teacherName, setTeacherName] = useState<string | null>(null);

  useEffect(() => {
    // 선생님 이름 가져오기
    const getTeacherName = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const teacherName = session.user.user_metadata?.teacher_name;
        setTeacherName(teacherName || null);
      }
    };

    getTeacherName();
  }, []);

  // CarouselBanner를 위한 슬라이드 데이터 예시
  const dashboardBannerSlides = [
    {
      id: 1,
      title: '📢 대시보드 주요 업데이트 안내',
      description: '새로운 위젯과 통계 기능이 추가되었습니다. 지금 바로 확인해보세요!',
      link: '#',
      titleIcon: <InformationCircleIcon className="w-6 h-6 text-sky-300" />
    },
    {
      id: 2,
      title: '✨ 사용자 편의성 개선',
      description: '더욱 빨라진 로딩 속도와 직관적인 UI를 경험해보세요.',
      link: '#',
    }
  ];

  // 학급 정보 조회
  const { data: classDetails, isLoading, isError, error } = useQuery({
    queryKey: ['classDetails', classId],
    queryFn: () => fetchClassDetails(classId),
    enabled: !!classId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex justify-center items-center">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-white/50">
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <div className="w-12 h-12 border-3 border-gray-200 rounded-full animate-spin"></div>
              <div className="w-12 h-12 border-3 border-transparent border-t-indigo-600 rounded-full animate-spin absolute top-0"></div>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-800">로딩 중</h3>
              <p className="text-sm text-gray-600">잠시만 기다려주세요...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !classDetails) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex justify-center items-center">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-white/50 max-w-md text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">오류가 발생했습니다</h3>
          <p className="text-sm text-gray-600 mb-4">
          {error instanceof Error ? error.message : '학급 정보를 불러올 수 없습니다.'}
        </p>
        <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
            다시 시도
        </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-6 pb-12 pt-5">
        <CarouselBanner slides={dashboardBannerSlides} autoPlayInterval={6000} />
        
        {/* 헤더 */}
        <header className="mt-6 mb-8 bg-white/90 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-white/50">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-1 flex items-center space-x-3">
                <ChartBarIcon className="h-8 w-8 text-indigo-600" />
                <span>{classDetails.name} 대시보드</span>
              </h1>
              {teacherName && (
                <p className="text-gray-600 font-medium">
                  {teacherName}선생님, 오늘도 화이팅! 📚✨
                </p>
              )}
            </div>
          </div>
        </header>

        {/* 대시보드 카드 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {/* 학급 일지 카드 - 첫 번째로 이동 */}
          <DashboardCard
            title="학급 일지"
            description="스마트 학급 일지를 작성하고 관리합니다. AI 알림장 생성, 학생 출결 관리, 학급 메모 등을 한 곳에서 관리하세요."
            icon={<CalendarDaysIcon className="w-7 h-7 text-white" />}
            href={`/class/${classId}/journal`}
            color="bg-blue-500"
          />
          
          {/* 설문 작성 카드 */}
          <DashboardCard
            title="설문 작성"
            description="학급 설문을 생성하고 관리합니다. 학생들의 관계를 파악하기 위한 설문을 만들어보세요."
            icon={<ClipboardDocumentListIcon className="w-7 h-7 text-white" />}
            href={`/class/${classId}/survey`}
            color="bg-indigo-500"
          />
          
          {/* 학급 분석 카드 */}
          <DashboardCard
            title="학급 분석"
            description="AI 기반 학급 분석 결과를 확인합니다. 학생 관계에 대한 인사이트를 얻어보세요."
            icon={<ChartBarIcon className="w-7 h-7 text-white" />}
            href={`/class/${classId}/analysis`}
            color="bg-purple-500"
          />
          
          {/* 쫑알쫑알 카드 (생활기록부) */}
          <DashboardCard
            title="쫑알쫑알"
            description="학생별 생활기록부 문구를 AI로 생성합니다. 학생의 특성과 활동 내용을 반영한 맞춤형 문구를 작성해보세요."
            icon={<DocumentTextIcon className="w-7 h-7 text-white" />}
            href={`/class/${classId}/schoolrecord`}
            color="bg-amber-500"
          />

          {/* 학생 관리 카드 - 마지막으로 이동 */}
          <DashboardCard
            title="학생 관리"
            description="학급 학생들의 정보를 관리합니다. 학생 추가, 개인정보 입력, 순서 조정 및 상세 정보를 관리할 수 있습니다."
            icon={<UserGroupIcon className="w-7 h-7 text-white" />}
            href={`/class/${classId}/students`}
            color="bg-emerald-500"
          />
        </div>
      </div>
    </div>
  );
} 