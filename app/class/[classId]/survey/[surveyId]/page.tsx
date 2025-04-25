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
  const { data, error } = await supabase.from('classes').select('*').eq('id', classId).single();
  if (error) { console.error('Error fetching class details:', error); return null; }
  return data;
}

async function fetchSurveyDetails(surveyId: string): Promise<Survey | null> {
  const { data, error } = await supabase.from('surveys').select('*').eq('id', surveyId).single();
  if (error) { console.error('Error fetching survey details:', error); return null; }
  return data;
}

async function fetchStudents(classId: string): Promise<NodeData[]> {
  const { data, error } = await supabase.from('students').select('*, position_x, position_y').eq('class_id', classId).order('display_order', { ascending: true }).order('created_at', { ascending: true });
  if (error) { console.error('Error fetching students:', error); return []; }
  return data as NodeData[];
}

async function fetchRelationships(classId: string, surveyId?: string | null): Promise<LinkData[]> {
    const { data: students, error: studentError } = await supabase.from('students').select('id').eq('class_id', classId);
    if (studentError || !students || students.length === 0) { console.error('Error fetching student IDs:', studentError); return []; }
    const studentIds = students.map(s => s.id);
    let query = supabase.from('relations').select('from_student_id, to_student_id, relation_type').in('from_student_id', studentIds).in('to_student_id', studentIds);
    if (surveyId) {
        query = query.eq('survey_id', surveyId);
    } else { 
        console.warn('fetchRelationships called without surveyId in survey page');
        return [];
    }
    const { data, error } = await query;
    if (error) { console.error('Error fetching relationships:', error); return []; }
    const linkData = data.map(rel => ({ source: rel.from_student_id, target: rel.to_student_id, type: rel.relation_type as keyof typeof RELATIONSHIP_TYPES }));
    console.log(`Fetched relationships for surveyId: ${surveyId}`, linkData);
    return linkData;
}

async function fetchQuestions(classId: string): Promise<Question[]> {
    const { data, error } = await supabase.from('questions').select('*').eq('class_id', classId).order('created_at');
    if (error) { console.error("Error fetching questions:", error); return []; }
    return data;
}

async function fetchAnswers(studentId: string): Promise<Answer[]> {
    const { data, error } = await supabase.from('answers').select(`*, questions ( question_text )`).eq('student_id', studentId);
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
      queryKey: ['questions', classId],
      queryFn: () => fetchQuestions(classId),
      enabled: !!classId,
  });

  const rankedStudentsByType = useMemo(() => {
    if (!students || !relationships) return {};
    const rankings: { [key: string]: (Student & { count: number })[] } = {};
    const studentMap = new Map(students.map(s => [s.id, s]));
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
      const { data, error } = await supabase
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
      const { error } = await supabase
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
        <div className="flex flex-col justify-center items-center min-h-screen bg-gray-100">
            <ArrowPathIcon className="w-12 h-12 text-blue-500 animate-spin mb-4" />
            <p className="text-lg text-black">데이터를 불러오는 중입니다...</p>
        </div>
    );
  }

  if (isError) {
    return (
        <div className="flex flex-col justify-center items-center min-h-screen bg-gray-100 p-4">
            <ExclamationCircleIcon className="w-16 h-16 text-red-500 mb-4" />
            <h2 className="text-xl font-semibold text-red-700 mb-2">오류 발생</h2>
            <p className="text-black mb-4 text-center">데이터를 불러오는 중 문제가 발생했습니다.</p>
        </div>
    );
  }

  if (!classDetails || !surveyDetails) {
    return (
        <div className="flex flex-col justify-center items-center min-h-screen bg-gray-100">
            <ExclamationCircleIcon className="w-16 h-16 text-yellow-500 mb-4" />
            <p className="text-lg text-black">학급 또는 설문 정보를 찾을 수 없습니다.</p>
            <button onClick={() => router.push(`/class/${classId}/survey`)} className="mt-4 text-[#6366f1] hover:underline">
                설문 목록으로 돌아가기
            </button>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-screen-2xl mx-auto px-4 py-8 flex flex-col">

        <header className="mb-4 flex justify-between items-center bg-white p-3 rounded-lg shadow-md flex-shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(`/class/${classId}/survey`)}
              className="px-4 py-2 text-sm bg-[#6366f1] text-white rounded-md hover:bg-[#4f46e5] shadow focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-1 transition-all duration-200 cursor-pointer font-semibold hover:-translate-y-0.5 hover:shadow-md"
            >
              설문 목록
            </button>
            <h1 className="text-xl font-bold text-black">{classDetails.name} - {surveyDetails.name}</h1>
          </div>
        </header>

        <div className="mb-4 flex flex-wrap justify-between items-center gap-4 bg-white p-3 rounded-lg shadow-md flex-shrink-0">
          <div className="flex gap-2 items-center flex-wrap">
            <span className="font-semibold text-sm mr-2 text-[#6366f1]">관계 필터:</span>
            <button onClick={() => setFilterType('ALL')} className={`px-3 py-1 text-xs rounded-md transition-all duration-200 ${filterType === 'ALL' ? 'bg-[#6366f1] text-white shadow' : 'bg-gray-100 text-gray-700 hover:bg-[#e0e7ff]'}`}>전체</button>
            {Object.entries(RELATIONSHIP_TYPES).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilterType(key as keyof typeof RELATIONSHIP_TYPES)}
                className={`px-3 py-1 text-xs rounded-md transition-all duration-200 ${filterType === key ? 'text-white shadow' : 'bg-gray-100 text-gray-700 hover:bg-[#e0e7ff]'}`}
                style={filterType === key ? { backgroundColor: RELATIONSHIP_COLORS[key as keyof typeof RELATIONSHIP_COLORS] } : {}}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-grow flex flex-col md:flex-row gap-4">

          <div className="w-full md:w-[230px] bg-white rounded-lg shadow-md flex flex-col flex-shrink-0">
            <StudentListPanel classId={classId} />
          </div>

          <div className="flex-1 flex flex-col gap-5">
            <div className="bg-white rounded-lg shadow-md overflow-hidden relative h-[720px] flex-shrink-0">
              {students && relationships ? (
                <RelationshipGraph
                  ref={graphRef}
                  nodes={students}
                  links={filteredRelationships}
                  onNodeClick={handleSelectStudent}
                  selectedNodeId={selectedStudent?.id}
                  classId={classId}
                  surveyId={surveyId}
                  // TODO: RelationshipGraph가 관계 생성/삭제 이벤트를 발생시킨다면,
                  //       아래와 같이 핸들러를 props로 전달해야 함
                  // onAddRelationship={handleAddRelationship} 
                  // onDeleteRelationship={handleDeleteRelationship}
                />
              ) : (
                <div className="flex justify-center items-center h-full text-gray-500 italic">학생 또는 관계 데이터가 없습니다.</div>
              )}
            </div>

            <div className="w-full flex-shrink-0 mb-2">
              <WeeklyAnswersBox
                  questions={questions}
                  answers={answers}
                  selectedStudent={selectedStudent}
                  isLoadingAnswers={isLoadingAnswers}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 flex-shrink-0">
              {Object.entries(RELATIONSHIP_TYPES).map(([type, title]) => (
                  <div key={type} className="min-h-[180px]">
                      {students && relationships ? (
                          <RelationshipTypeRankBox
                              title={title}
                              students={rankedStudentsByType[type]?.slice(0, 10)}
                              relationshipType={type}
                          />
                      ) : (
                          <div className="bg-white rounded-lg shadow-md p-3 h-full flex items-center justify-center text-sm text-gray-500 italic">
                              랭킹 데이터 로딩 중...
                          </div>
                      )}
                  </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 