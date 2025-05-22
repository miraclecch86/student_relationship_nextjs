'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { supabase, Class } from '@/lib/supabase';
import {
  ClipboardDocumentListIcon,
  UserGroupIcon,
  ChartBarIcon,
  ArrowLeftIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

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
      className="bg-white rounded-xl shadow-md overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-1 max-w-sm mx-auto"
      whileHover={{ scale: 1.02 }}
      onClick={() => router.push(href)}
    >
      <div className={`${color} px-3 py-4 flex items-center justify-center`}>
        <div className="bg-white/20 p-3 rounded-full">
          {icon}
        </div>
      </div>
      <div className="p-5">
        <h3 className="text-lg font-bold mb-1.5 text-gray-800">{title}</h3>
        <p className="text-sm text-gray-600 line-clamp-3">{description}</p>
      </div>
    </motion.div>
  );
}

export default function ClassDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.classId as string;

  // 학급 정보 조회
  const { data: classDetails, isLoading, isError, error } = useQuery({
    queryKey: ['classDetails', classId],
    queryFn: () => fetchClassDetails(classId),
    enabled: !!classId,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100">
        <div className="text-2xl text-indigo-500">로딩 중...</div>
      </div>
    );
  }

  if (isError || !classDetails) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gray-100">
        <div className="text-2xl text-red-500 mb-4">오류가 발생했습니다</div>
        <p className="text-gray-700 mb-4">
          {error instanceof Error ? error.message : '학급 정보를 불러올 수 없습니다.'}
        </p>
        <button
          onClick={() => router.push('/teacher')}
          className="px-4 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600"
        >
          학급 목록으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* 헤더 */}
        <header className="mb-10 flex justify-between items-center bg-white p-5 rounded-lg shadow-md">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/teacher')}
              className="px-4 py-2 text-sm bg-indigo-500 text-white rounded-md hover:bg-indigo-600 shadow focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-1 transition-all duration-200 flex items-center"
            >
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              학급 목록
            </button>
            <h1 className="text-2xl font-bold text-black">{classDetails.name} 대시보드</h1>
          </div>
        </header>

        {/* 대시보드 카드 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 px-2">
          {/* 설문 작성 카드 */}
          <DashboardCard
            title="설문 작성"
            description="학급 설문을 생성하고 관리합니다. 학생들의 관계를 파악하기 위한 설문을 만들어보세요."
            icon={<ClipboardDocumentListIcon className="w-7 h-7 text-white" />}
            href={`/class/${classId}/survey`}
            color="bg-indigo-500"
          />
          
          {/* 학생 목록 카드 */}
          <DashboardCard
            title="학생 목록"
            description="학급의 학생들을 관리합니다. 학생을 추가, 수정, 삭제할 수 있습니다."
            icon={<UserGroupIcon className="w-7 h-7 text-white" />}
            href={`/class/${classId}/students`}
            color="bg-emerald-500"
          />
          
          {/* 분석 카드 */}
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
        </div>
      </div>
    </div>
  );
} 