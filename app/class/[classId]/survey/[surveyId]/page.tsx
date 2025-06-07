'use client';

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, Student, Relationship, Class, Question, Answer, Survey } from '@/lib/supabase';
import RelationshipGraph, { RelationshipGraphRef } from '@/components/RelationshipGraph';
import ConfirmModal from '@/components/ConfirmModal';
import StudentListPanel from '@/components/StudentListPanel';
import RelationshipTypeRankBox from '@/components/RelationshipTypeRankBox';
import WeeklyAnswersBox from '@/components/WeeklyAnswersBox';
import { RELATIONSHIP_TYPES, RELATIONSHIP_COLORS } from '@/lib/constants';
import { ArrowPathIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export interface NodeData extends Student {
  x?: number;
  y?: number;
  fx?: number | null | undefined;
  fy?: number | null | undefined;
}

export interface LinkData {
  source: string;
  target: string;
  type: keyof typeof RELATIONSHIP_TYPES;
}

async function fetchClassDetails(classId: string): Promise<Class | null> {
  const { data, error } = await (supabase as any).from('classes').select('*').eq('id', classId).single();
  if (error) { console.error('Error fetching class details:', error); return null; }
  return data;
}

async function fetchSurveyDetails(surveyId: string): Promise<Survey | null> {
  const { data, error } = await (supabase as any).from('surveys').select('*').eq('id', surveyId).single();
  if (error) { console.error('Error fetching survey details:', error); return null; }
  return data;
}

async function fetchStudents(classId: string): Promise<NodeData[]> {
  const { data, error } = await (supabase as any).from('students').select('*, position_x, position_y').eq('class_id', classId).order('display_order', { ascending: true }).order('created_at', { ascending: true });
  if (error) { console.error('Error fetching students:', error); return []; }
  return data as NodeData[];
}

async function fetchRelationships(classId: string, surveyId?: string | null): Promise<LinkData[]> {
    const { data: students, error: studentError } = await (supabase as any).from('students').select('id').eq('class_id', classId);
    if (studentError || !students || students.length === 0) { console.error('Error fetching student IDs:', studentError); return []; }
    const studentIds = students.map((s: any) => s.id);
    let query = (supabase as any).from('relations').select('from_student_id, to_student_id, relation_type').in('from_student_id', studentIds).in('to_student_id', studentIds);
    if (surveyId) {
        query = query.eq('survey_id', surveyId);
    } else { 
        console.warn('fetchRelationships called without surveyId in survey page');
        return [];
    }
    const { data, error } = await query;
    if (error) { console.error('Error fetching relationships:', error); return []; }
    const linkData = data.map((rel: any) => ({ source: rel.from_student_id, target: rel.to_student_id, type: rel.relation_type as keyof typeof RELATIONSHIP_TYPES }));
    console.log(`Fetched relationships for surveyId: ${surveyId}`, linkData);
    return linkData;
}

async function fetchQuestions(classId: string, surveyId: string): Promise<Question[]> {
    const { data, error } = await (supabase as any)
        .from('questions')
        .select('*')
        .eq('class_id', classId)
        .eq('survey_id', surveyId)
        .order('created_at');
    if (error) { console.error("Error fetching questions:", error); return []; }
    return data;
}

async function fetchAnswers(studentId: string): Promise<Answer[]> {
    const { data, error } = await (supabase as any).from('answers').select(`*, questions ( question_text )`).eq('student_id', studentId);
    if (error) { console.error("Error fetching answers:", error); return []; }
    return data;
}

export default function SurveyRelationshipPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const classId = params.classId as string;
  const surveyId = params.surveyId as string;
  const graphRef = useRef<RelationshipGraphRef>(null);

  const [selectedStudent, setSelectedStudent] = useState<NodeData | null>(null);
  const [filterType, setFilterType] = useState<keyof typeof RELATIONSHIP_TYPES | 'ALL'>('ALL');

  const { data: classDetails, isLoading: isLoadingClass, isError: isErrorClass } = useQuery({
    queryKey: ['classDetails', classId],
    queryFn: () => fetchClassDetails(classId),
    enabled: !!classId,
  });

  const { data: surveyDetails, isLoading: isLoadingSurvey, isError: isErrorSurvey } = useQuery({
    queryKey: ['surveyDetails', surveyId],
    queryFn: () => fetchSurveyDetails(surveyId),
    enabled: !!surveyId,
  });

  const { data: students, isLoading: isLoadingStudents, isError: isErrorStudents } = useQuery({
    queryKey: ['students', classId],
    queryFn: () => fetchStudents(classId),
    enabled: !!classId,
  });

  const { data: relationships, isLoading: isLoadingRelationships, isError: isErrorRelationships } = useQuery({
    queryKey: ['relations', classId, surveyId],
    queryFn: () => fetchRelationships(classId, surveyId),
    enabled: !!classId && !!surveyId,
  });

  const filteredRelationships = useMemo(() => {
    if (!relationships) return [];
    if (filterType === 'ALL') return relationships;
    return relationships.filter(link => link.type === filterType);
  }, [relationships, filterType]);

  const { data: answers, isLoading: isLoadingAnswers, isError: isErrorAnswers } = useQuery({
      queryKey: ['answers', selectedStudent?.id],
      queryFn: () => fetchAnswers(selectedStudent!.id),
      enabled: !!selectedStudent,
  });

  const { data: questions, isLoading: isLoadingQuestions } = useQuery({
    queryKey: ['questions', classId, surveyId],
    queryFn: () => fetchQuestions(classId, surveyId),
    enabled: !!classId && !!surveyId,
  });

  const rankedStudentsByType = useMemo(() => {
    if (!students || !relationships) return {};
    const rankings: { [key: string]: (Student & { count: number })[] } = {};
    const studentMap = new Map(students.map((s: any) => [s.id, s]));
    Object.keys(RELATIONSHIP_TYPES).forEach(type => {
      const counts = new Map<string, number>();
      relationships.filter(link => link.type === type).forEach(link => {
        counts.set(link.target, (counts.get(link.target) || 0) + 1);
      });
      const ranked = Array.from(counts.entries())
        .sort(([, countA], [, countB]) => countB - countA)
        .map(([studentId, count]) => {
            const studentData = studentMap.get(studentId);
            return studentData ? { ...studentData, count } : null;
        })
        .filter((s): s is Student & { count: number } => s !== null);
      rankings[type] = ranked;
    });
    return rankings;
  }, [students, relationships]);

  const isLoading = isLoadingClass || isLoadingSurvey || isLoadingStudents || isLoadingRelationships || isLoadingQuestions;
  const isError = isErrorClass || isErrorSurvey || isErrorStudents || isErrorRelationships;

  const handleSelectStudent = useCallback((student: NodeData | null) => {
    setSelectedStudent(student);
  }, []);

  // --- 관계 추가 Mutation ---
  const addRelationshipMutation = useMutation<
    Relationship | null, 
    Error, 
    { from: string; to: string; type: keyof typeof RELATIONSHIP_TYPES }
  >({
    mutationFn: async ({ from, to, type }: { from: string; to: string; type: keyof typeof RELATIONSHIP_TYPES }): Promise<Relationship | null> => {
      // surveyId가 유효한지 확인
      if (!surveyId) {
        throw new Error("Survey ID가 유효하지 않습니다.");
      }
      console.log(`Adding relationship: ${from} -> ${to}, type: ${type}, surveyId: ${surveyId}`);
      const { data, error } = await (supabase as any)
        .from('relations')
        .insert({ 
          from_student_id: from, 
          to_student_id: to, 
          relation_type: type, 
          survey_id: surveyId
        })
        .select()
        .single();
      
      if (error) {
        if (error.code === '23505') { 
          console.warn(`Relationship already exists: ${from} -> ${to} for survey ${surveyId}`);
          return null;
        } else {
          throw error;
        }
      }
      return data;
    },
    onSuccess: (data: Relationship | null) => {
      if (data) {
        queryClient.invalidateQueries({ queryKey: ['relations', classId, surveyId] }); 
        toast.success('관계가 추가되었습니다.');
      }
    },
    onError: (error: Error) => {
      toast.error(`관계 추가 실패: ${error.message}`);
    },
  });

  // --- 관계 삭제 Mutation ---
  const deleteRelationshipMutation = useMutation<
    void, 
    Error, 
    { from: string; to: string }
  >({
    mutationFn: async ({ from, to }: { from: string; to: string }): Promise<void> => {
      if (!surveyId) {
        throw new Error("Survey ID가 유효하지 않습니다.");
      }
      console.log(`Deleting relationship: ${from} -> ${to}, surveyId: ${surveyId}`);
      const { error } = await (supabase as any)
        .from('relations')
        .delete()
        .match({ 
          from_student_id: from, 
          to_student_id: to, 
          survey_id: surveyId
        });
        
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relations', classId, surveyId] });
      toast.success('관계가 삭제되었습니다.');
    },
    onError: (error: Error) => {
      toast.error(`관계 삭제 실패: ${error.message}`);
    },
  });

  // --- 관계 생성/삭제 트리거 함수 (예시) ---
  // 실제 사용 시 RelationshipGraph 컴포넌트의 이벤트나 다른 UI 요소와 연결 필요
  const handleAddRelationship = useCallback((sourceId: string, targetId: string, type: keyof typeof RELATIONSHIP_TYPES) => {
    if (sourceId && targetId && sourceId !== targetId) {
      addRelationshipMutation.mutate({ from: sourceId, to: targetId, type });
    }
  }, [addRelationshipMutation]);

  const handleDeleteRelationship = useCallback((sourceId: string, targetId: string) => {
     if (sourceId && targetId) {
       deleteRelationshipMutation.mutate({ from: sourceId, to: targetId });
     }
  }, [deleteRelationshipMutation]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center">
        <div className="text-center">
          <ArrowPathIcon className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-spin" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">로딩 중...</h2>
          <p className="text-gray-600">학생 관계도를 불러오고 있습니다.</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center">
        <div className="text-center">
          <ExclamationCircleIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">오류가 발생했습니다</h2>
          <p className="text-gray-600 mb-4">데이터를 불러오는 중 문제가 발생했습니다.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (!classDetails || !surveyDetails) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center">
        <div className="text-center">
          <ExclamationCircleIcon className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">정보를 찾을 수 없습니다</h2>
          <p className="text-gray-600 mb-4">학급 또는 설문 정보를 찾을 수 없습니다.</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center space-x-2">
            <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span>학생 관계도</span>
          </h1>
        </div>

        {/* 학급 및 설문 정보 */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-800">{classDetails.name} - {surveyDetails.name}</h2>
              <p className="text-sm text-gray-600">학생들 간의 관계를 시각적으로 확인하고 분석할 수 있습니다</p>
            </div>
          </div>
        </div>

        {/* 관계 필터 */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-800">관계 필터</h3>
            <span className="text-sm text-gray-500">
              원하는 관계 유형을 선택하여 필터링하세요
            </span>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <button 
              onClick={() => setFilterType('ALL')} 
              className={`px-4 py-2 text-sm rounded-lg font-medium transition-all duration-200 ${
                filterType === 'ALL' 
                  ? 'bg-purple-500 text-white shadow-md' 
                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
              }`}
            >
              전체
            </button>
            {Object.entries(RELATIONSHIP_TYPES).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilterType(key as keyof typeof RELATIONSHIP_TYPES)}
                className={`px-4 py-2 text-sm rounded-lg font-medium transition-all duration-200 ${
                  filterType === key 
                    ? 'text-white shadow-md' 
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
                style={filterType === key ? { backgroundColor: RELATIONSHIP_COLORS[key as keyof typeof RELATIONSHIP_COLORS] } : {}}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* 학생 목록 패널 */}
          <div className="w-full lg:w-80 bg-white rounded-xl shadow-sm flex flex-col">
            <StudentListPanel
              classId={classId}
              onStudentSelect={(studentId) => {
                router.push(`/class/${classId}/survey/${surveyId}/student/${studentId}`);
              }}
            />
          </div>

          {/* 메인 콘텐츠 */}
          <div className="flex-1 flex flex-col gap-6">
            {/* 관계도 그래프 */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden relative" style={{ height: '600px' }}>
              <div className="p-4 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-800">관계도 그래프</h3>
                <p className="text-sm text-gray-600">학생들을 클릭하거나 드래그하여 상호작용할 수 있습니다</p>
              </div>
              <div className="absolute inset-0 top-16">
                {students && relationships ? (
                  <RelationshipGraph
                    ref={graphRef}
                    nodes={students}
                    links={filteredRelationships}
                    onNodeClick={handleSelectStudent}
                    selectedNodeId={selectedStudent?.id || null}
                    classId={classId}
                    surveyId={surveyId}
                  />
                ) : (
                  <div className="flex justify-center items-center h-full text-gray-500">
                    관계도 데이터를 불러오고 있습니다...
                  </div>
                )}
              </div>
            </div>

            {/* 주간 답변 박스 */}
            <div className="bg-white rounded-xl shadow-sm">
              <WeeklyAnswersBox
                questions={questions}
                answers={answers}
                selectedStudent={selectedStudent}
                isLoadingAnswers={isLoadingAnswers}
              />
            </div>

            {/* 관계 유형별 순위 */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-800">관계 유형별 순위</h3>
                <span className="text-sm text-gray-500">각 관계 유형별로 가장 많이 선택받은 학생들</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {Object.entries(RELATIONSHIP_TYPES).map(([type, title]) => (
                  <div key={type} className="min-h-[200px]">
                    {students && relationships ? (
                      <RelationshipTypeRankBox
                        title={title}
                        students={rankedStudentsByType[type]?.slice(0, 10)}
                        relationshipType={type}
                      />
                    ) : (
                      <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 h-full flex items-center justify-center border border-gray-200">
                        <div className="text-center">
                          <ArrowPathIcon className="w-8 h-8 text-gray-400 mx-auto mb-2 animate-spin" />
                          <p className="text-sm text-gray-500">로딩 중...</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 