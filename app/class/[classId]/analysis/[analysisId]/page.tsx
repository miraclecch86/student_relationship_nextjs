'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { supabase, Class } from '@/lib/supabase';
import {
  ArrowLeftIcon,
  CalendarIcon,
  ArrowPathIcon,
  UsersIcon,
  UserIcon,
  ClockIcon,
  HomeIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

// 분석 결과 타입 정의 (확장된 버전)
interface AnalysisResult {
  id: string;
  class_id: string;
  created_at: string;
  result_data: {
    analysis: string;
    relationships: {
      description: string;
      issues?: string[];
      recommendations?: string[];
    };
    socialDynamics: {
      description: string;
      strongConnections?: string[];
      isolatedStudents?: string[];
    };
    individualAnalysis?: {
      students: Array<{
        name: string;
        socialPosition: string;
        strengths: string[];
        challenges: string[];
        suggestions: string[];
      }>;
    };
    classroomEnvironment?: {
      overall: string;
      positiveAspects: string[];
      challengingAreas: string[];
      improvementSuggestions: string[];
    };
    timelineProjection?: {
      shortTerm: string;
      midTerm: string;
      longTerm: string;
      keyMilestones: string[];
    };
  };
  summary: string;
}

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

// 특정 분석 결과 조회 함수
async function fetchAnalysisDetail(classId: string, analysisId: string): Promise<AnalysisResult> {
  try {
    const { data, error } = await supabase
      .from('analysis_results')
      .select('*')
      .eq('id', analysisId)
      .eq('class_id', classId)
      .single();
    
    if (error) {
      throw new Error(`분석 결과를 불러오는데 실패했습니다: ${error.message}`);
    }
    
    if (!data) {
      throw new Error('분석 결과를 찾을 수 없습니다.');
    }
    
    return data as AnalysisResult;
  } catch (error) {
    console.error('분석 상세 정보 요청 오류:', error);
    throw error;
  }
}

// 탭 컴포넌트
function TabButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center px-4 py-2 text-sm rounded-lg transition-all ${
        active
          ? 'bg-indigo-100 text-indigo-700 font-medium'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      <div className="mr-2">{icon}</div>
      {label}
    </button>
  );
}

// 개요 탭 컴포넌트
function OverviewTab({ analysis }: { analysis: AnalysisResult }) {
  // 데이터 안전 검사
  const safeAnalysis = typeof analysis.result_data.analysis === 'string' 
    ? analysis.result_data.analysis 
    : '분석 데이터를 표시할 수 없습니다. 다시 분석을 실행해주세요.';

  const relationships = analysis.result_data.relationships || { description: '관계 분석 데이터가 없습니다.' };
  const socialDynamics = analysis.result_data.socialDynamics || { description: '사회적 역학 데이터가 없습니다.' };
  const classroomEnv = analysis.result_data.classroomEnvironment;

  // issues와 recommendations가 배열인지 확인
  const hasIssues = relationships.issues && Array.isArray(relationships.issues) && relationships.issues.length > 0;
  const hasRecommendations = relationships.recommendations && Array.isArray(relationships.recommendations) && relationships.recommendations.length > 0;
  const hasStrongConnections = socialDynamics.strongConnections && Array.isArray(socialDynamics.strongConnections) && socialDynamics.strongConnections.length > 0;
  const hasIsolatedStudents = socialDynamics.isolatedStudents && Array.isArray(socialDynamics.isolatedStudents) && socialDynamics.isolatedStudents.length > 0;

  return (
    <div className="space-y-6">
      {/* 전체 분석 요약 */}
      <div className="border-l-4 border-indigo-500 pl-4 py-2 bg-indigo-50 rounded-r-md">
        <h3 className="text-lg font-semibold text-indigo-700 mb-2">분석 요약</h3>
        <p className="text-gray-700 whitespace-pre-line">{safeAnalysis}</p>
      </div>
      
      {/* 관계 분석 */}
      <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">관계 분석</h3>
        <p className="text-gray-700">{relationships.description}</p>
        
        {hasIssues && (
          <div className="mt-4">
            <h4 className="font-medium text-gray-700 mb-2">주요 이슈</h4>
            <ul className="list-disc list-inside space-y-1 pl-4">
              {relationships.issues!.map((issue, index) => (
                <li key={index} className="text-gray-600">{issue}</li>
              ))}
            </ul>
          </div>
        )}
        
        {hasRecommendations && (
          <div className="mt-4">
            <h4 className="font-medium text-gray-700 mb-2">권장 사항</h4>
            <ul className="list-disc list-inside space-y-1 pl-4">
              {relationships.recommendations!.map((rec, index) => (
                <li key={index} className="text-gray-600">{rec}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      
      {/* 사회적 역학 */}
      <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">사회적 역학</h3>
        <p className="text-gray-700">{socialDynamics.description}</p>
        
        {hasStrongConnections && (
          <div className="mt-4">
            <h4 className="font-medium text-gray-700 mb-2">강한 유대 관계</h4>
            <ul className="list-disc list-inside space-y-1 pl-4">
              {socialDynamics.strongConnections!.map((connection, index) => (
                <li key={index} className="text-gray-600">{connection}</li>
              ))}
            </ul>
          </div>
        )}
        
        {hasIsolatedStudents && (
          <div className="mt-4">
            <h4 className="font-medium text-gray-700 mb-2">고립된 학생</h4>
            <ul className="list-disc list-inside space-y-1 pl-4">
              {socialDynamics.isolatedStudents!.map((student, index) => (
                <li key={index} className="text-gray-600">{student}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      
      {/* 교실 환경 평가 */}
      {classroomEnv && (
        <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">교실 환경 평가</h3>
          <p className="text-gray-700">{classroomEnv.overall || '전반적 평가 데이터가 없습니다.'}</p>
          
          {Array.isArray(classroomEnv.positiveAspects) && classroomEnv.positiveAspects.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium text-gray-700 mb-2">긍정적 측면</h4>
              <ul className="list-disc list-inside space-y-1 pl-4">
                {classroomEnv.positiveAspects.map((item, index) => (
                  <li key={index} className="text-gray-600">{item}</li>
                ))}
              </ul>
            </div>
          )}
          
          {Array.isArray(classroomEnv.challengingAreas) && classroomEnv.challengingAreas.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium text-gray-700 mb-2">개선이 필요한 부분</h4>
              <ul className="list-disc list-inside space-y-1 pl-4">
                {classroomEnv.challengingAreas.map((item, index) => (
                  <li key={index} className="text-gray-600">{item}</li>
                ))}
              </ul>
            </div>
          )}
          
          {Array.isArray(classroomEnv.improvementSuggestions) && classroomEnv.improvementSuggestions.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium text-gray-700 mb-2">환경 개선 제안</h4>
              <ul className="list-disc list-inside space-y-1 pl-4">
                {classroomEnv.improvementSuggestions.map((item, index) => (
                  <li key={index} className="text-gray-600">{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// 학생별 분석 탭 컴포넌트
function StudentAnalysisTab({ analysis }: { analysis: AnalysisResult }) {
  // 학생 데이터 안전성 검사
  const individualAnalysis = analysis.result_data.individualAnalysis;
  
  if (!individualAnalysis || !Array.isArray(individualAnalysis.students) || individualAnalysis.students.length === 0) {
    return (
      <div className="bg-yellow-50 text-yellow-700 p-4 rounded-md">
        이 분석에는 학생별 상세 분석 데이터가 없습니다.
      </div>
    );
  }
  
  const [selectedStudent, setSelectedStudent] = useState<string | null>(
    individualAnalysis.students[0]?.name || null
  );
  
  const students = individualAnalysis.students;
  const selectedStudentData = students.find(s => s.name === selectedStudent);
  
  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* 학생 목록 */}
      <div className="md:w-1/3 bg-white rounded-lg shadow-md p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b">학생 목록</h3>
        <div className="space-y-2">
          {students.map(student => (
            <button
              key={student.name}
              onClick={() => setSelectedStudent(student.name)}
              className={`w-full text-left px-4 py-2 rounded-md transition-all ${
                selectedStudent === student.name
                  ? 'bg-indigo-100 text-indigo-700 font-medium'
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              {student.name}
            </button>
          ))}
        </div>
      </div>
      
      {/* 선택된 학생 상세 정보 */}
      {selectedStudentData && (
        <div className="md:w-2/3 bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold text-indigo-700 mb-4">{selectedStudentData.name}</h3>
          
          <div className="bg-gray-50 p-4 rounded-md mb-4">
            <h4 className="font-medium text-gray-700 mb-2">사회적 위치</h4>
            <p className="text-gray-600">{selectedStudentData.socialPosition || '정보 없음'}</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-green-50 p-4 rounded-md">
              <h4 className="font-medium text-green-700 mb-2">강점</h4>
              {Array.isArray(selectedStudentData.strengths) && selectedStudentData.strengths.length > 0 ? (
                <ul className="list-disc list-inside space-y-1">
                  {selectedStudentData.strengths.map((strength, index) => (
                    <li key={index} className="text-gray-600">{strength}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-600">데이터 없음</p>
              )}
            </div>
            
            <div className="bg-yellow-50 p-4 rounded-md">
              <h4 className="font-medium text-yellow-700 mb-2">도전 과제</h4>
              {Array.isArray(selectedStudentData.challenges) && selectedStudentData.challenges.length > 0 ? (
                <ul className="list-disc list-inside space-y-1">
                  {selectedStudentData.challenges.map((challenge, index) => (
                    <li key={index} className="text-gray-600">{challenge}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-600">데이터 없음</p>
              )}
            </div>
            
            <div className="bg-blue-50 p-4 rounded-md">
              <h4 className="font-medium text-blue-700 mb-2">개선 제안</h4>
              {Array.isArray(selectedStudentData.suggestions) && selectedStudentData.suggestions.length > 0 ? (
                <ul className="list-disc list-inside space-y-1">
                  {selectedStudentData.suggestions.map((suggestion, index) => (
                    <li key={index} className="text-gray-600">{suggestion}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-600">데이터 없음</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 시간적 변화 탭 컴포넌트
function TimelineTab({ analysis }: { analysis: AnalysisResult }) {
  const timelineProjection = analysis.result_data.timelineProjection;
  
  if (!timelineProjection) {
    return (
      <div className="bg-yellow-50 text-yellow-700 p-4 rounded-md">
        이 분석에는 시간적 변화 예측 데이터가 없습니다.
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">시간에 따른 변화 예측</h3>
        
        <div className="space-y-8">
          {/* 단기 예측 */}
          <div className="bg-blue-50 p-4 rounded-md">
            <h4 className="font-medium text-blue-700 mb-2 flex items-center">
              <span className="h-2 w-2 bg-blue-500 rounded-full mr-2"></span>
              단기 전망 (1-2개월)
            </h4>
            <p className="text-gray-700">{timelineProjection.shortTerm || '데이터 없음'}</p>
          </div>
          
          {/* 중기 예측 */}
          <div className="bg-indigo-50 p-4 rounded-md">
            <h4 className="font-medium text-indigo-700 mb-2 flex items-center">
              <span className="h-2 w-2 bg-indigo-500 rounded-full mr-2"></span>
              중기 전망 (3-6개월)
            </h4>
            <p className="text-gray-700">{timelineProjection.midTerm || '데이터 없음'}</p>
          </div>
          
          {/* 장기 예측 */}
          <div className="bg-purple-50 p-4 rounded-md">
            <h4 className="font-medium text-purple-700 mb-2 flex items-center">
              <span className="h-2 w-2 bg-purple-500 rounded-full mr-2"></span>
              장기 전망 (학년도 기준)
            </h4>
            <p className="text-gray-700">{timelineProjection.longTerm || '데이터 없음'}</p>
          </div>
          
          {/* 주요 이정표 */}
          {Array.isArray(timelineProjection.keyMilestones) && timelineProjection.keyMilestones.length > 0 && (
            <div className="border-t pt-6">
              <h4 className="font-medium text-gray-800 mb-4">주요 이정표</h4>
              <div className="relative pl-8">
                {timelineProjection.keyMilestones.map((milestone, index) => (
                  <div key={index} className="mb-6 relative">
                    <div className="absolute left-0 top-0 -ml-6">
                      <div className="h-4 w-4 rounded-full bg-indigo-500"></div>
                      {index < timelineProjection.keyMilestones.length - 1 && (
                        <div className="h-full w-0.5 bg-indigo-300 absolute top-4 left-2 -ml-0.5"></div>
                      )}
                    </div>
                    <p className="text-gray-700">{milestone}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AnalysisDetailPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.classId as string;
  const analysisId = params.analysisId as string;
  const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'timeline'>('overview');
  
  // 학급 정보 조회
  const { data: classDetails, isLoading: isClassLoading } = useQuery({
    queryKey: ['classDetails', classId],
    queryFn: () => fetchClassDetails(classId),
    enabled: !!classId,
  });
  
  // 분석 결과 상세 조회
  const { 
    data: analysis,
    isLoading: isAnalysisLoading,
    isError: isAnalysisError,
    error: analysisError
  } = useQuery({
    queryKey: ['analysisDetail', classId, analysisId],
    queryFn: () => fetchAnalysisDetail(classId, analysisId),
    enabled: !!classId && !!analysisId,
    retry: 1,
  });
  
  const isLoading = isClassLoading || isAnalysisLoading;
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100">
        <ArrowPathIcon className="w-8 h-8 animate-spin text-indigo-500" />
        <div className="text-xl text-indigo-500 ml-3">로딩 중...</div>
      </div>
    );
  }
  
  if (isAnalysisError) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gray-100">
        <div className="text-2xl text-red-500 mb-4">오류가 발생했습니다</div>
        <p className="text-gray-700 mb-4">
          {analysisError instanceof Error ? analysisError.message : '분석 결과를 불러올 수 없습니다.'}
        </p>
        <button
          onClick={() => router.push(`/class/${classId}/analysis`)}
          className="px-4 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600"
        >
          분석 목록으로 돌아가기
        </button>
      </div>
    );
  }
  
  if (!classDetails) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gray-100">
        <div className="text-2xl text-red-500 mb-4">학급 정보를 찾을 수 없습니다</div>
        <button
          onClick={() => router.push('/teacher')}
          className="px-4 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600"
        >
          학급 목록으로 돌아가기
        </button>
      </div>
    );
  }
  
  if (!analysis) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gray-100">
        <div className="text-2xl text-red-500 mb-4">분석 결과를 찾을 수 없습니다</div>
        <button
          onClick={() => router.push(`/class/${classId}/analysis`)}
          className="px-4 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600"
        >
          분석 목록으로 돌아가기
        </button>
      </div>
    );
  }
  
  const createdAt = new Date(analysis.created_at);
  const formattedDate = format(createdAt, 'yyyy년 MM월 dd일 HH:mm', { locale: ko });
  
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-screen-xl mx-auto px-4 py-8">
        {/* 헤더 */}
        <header className="mb-6 bg-white p-4 rounded-lg shadow-md">
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={() => router.push(`/class/${classId}/analysis`)}
              className="px-4 py-2 text-sm bg-indigo-500 text-white rounded-md hover:bg-indigo-600 shadow focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-1 transition-all duration-200 flex items-center"
            >
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              분석 목록
            </button>
            <h1 className="text-2xl font-bold text-black">{classDetails.name} 학급 분석 결과</h1>
          </div>
          <div className="flex items-center mt-3 text-gray-500">
            <CalendarIcon className="w-4 h-4 mr-2" />
            <span className="text-sm">{formattedDate}</span>
          </div>
        </header>
        
        {/* 탭 메뉴 */}
        <div className="bg-white p-2 rounded-lg shadow-md mb-6 flex flex-wrap gap-2">
          <TabButton
            active={activeTab === 'overview'}
            icon={<HomeIcon className="w-5 h-5" />}
            label="학급 개요"
            onClick={() => setActiveTab('overview')}
          />
          <TabButton
            active={activeTab === 'students'}
            icon={<UserIcon className="w-5 h-5" />}
            label="학생별 분석"
            onClick={() => setActiveTab('students')}
          />
          <TabButton
            active={activeTab === 'timeline'}
            icon={<ClockIcon className="w-5 h-5" />}
            label="시간적 변화"
            onClick={() => setActiveTab('timeline')}
          />
        </div>
        
        {/* 탭 컨텐츠 */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'overview' && <OverviewTab analysis={analysis} />}
            {activeTab === 'students' && <StudentAnalysisTab analysis={analysis} />}
            {activeTab === 'timeline' && <TimelineTab analysis={analysis} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
} 