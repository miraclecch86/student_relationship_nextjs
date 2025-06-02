'use client';

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, Student, Relationship, Class, Question, Answer } from '@/lib/supabase';
import RelationshipGraph, { RelationshipGraphRef } from '@/components/RelationshipGraph';
import ConfirmModal from '@/components/ConfirmModal';
import StudentListItem from '@/components/StudentListItem';
import RelationshipTypeRankBox from '@/components/RelationshipTypeRankBox';
import WeeklyAnswersBox from '@/components/WeeklyAnswersBox';
import { RELATIONSHIP_TYPES, RELATIONSHIP_COLORS } from '@/lib/constants';
import { ArrowPathIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { handleDemoSaveAttempt, isDemoClass } from '@/utils/demo-permissions';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  AnimateLayoutChanges,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { arrayMove } from '@dnd-kit/sortable';
import UserProfile from '@/components/UserProfile';
import RelationshipAnalysis from '@/components/RelationshipAnalysis';

// 데이터 타입 정의 (D3.js용 노드 및 링크)
export interface NodeData extends Student {
  x?: number;
  y?: number;
  fx?: number | null | undefined;
  fy?: number | null | undefined;
}

export interface LinkData {
  source: string; // from_student_id
  target: string; // to_student_id
  type: keyof typeof RELATIONSHIP_TYPES;
}

// Supabase 데이터 fetching 함수들
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

async function fetchStudents(classId: string): Promise<NodeData[]> {
  const { data, error } = await (supabase as any)
    .from('students')
    .select('*, position_x, position_y')
    .eq('class_id', classId)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) {
    console.error('Error fetching students:', error);
    return [];
  }
  return data as NodeData[];
}

async function fetchRelationships(classId: string, surveyId?: string | null): Promise<LinkData[]> {
    // 특정 학급의 학생 ID 목록 가져오기
    const { data: students, error: studentError } = await (supabase as any)
        .from('students')
        .select('id')
        .eq('class_id', classId);

    if (studentError || !students || students.length === 0) {
        console.error('Error fetching student IDs or no students found:', studentError);
        return [];
    }

    const studentIds = students.map((s: any) => s.id);

    // 해당 학생들 간의 관계 데이터 가져오기
    let query = (supabase as any)
        .from('relations')
        .select('from_student_id, to_student_id, relation_type')
        .in('from_student_id', studentIds)
        .in('to_student_id', studentIds);

    // surveyId 유무에 따라 필터링
    if (surveyId) {
        query = query.eq('survey_id', surveyId);
    } else {
        query = query.is('survey_id', null); // surveyId가 없으면 null인 관계만 (기본 관계도)
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching relationships:', error);
        return [];
    }

    // D3 Link 형식으로 변환
    const linkData = data.map((rel: any) => ({
        source: rel.from_student_id,
        target: rel.to_student_id,
        type: rel.relation_type as keyof typeof RELATIONSHIP_TYPES,
    }));

    console.log(`Fetched relationships for surveyId: ${surveyId ?? 'NULL'}`, linkData);
    return linkData;
}

// --- 학생 추가 함수 ---
async function addStudent(classId: string, name: string): Promise<Student> {
  // 이름 중복 체크
  const { data: existingStudent, error: checkError } = await (supabase as any)
    .from('students')
    .select('id')
    .eq('class_id', classId)
    .eq('name', name.trim())
    .maybeSingle(); // 없으면 null 반환

  if (checkError) throw new Error(`학생 확인 중 오류: ${checkError.message}`);
  if (existingStudent) throw new Error(`이미 '${name.trim()}' 학생이 존재합니다.`);

  const { data, error } = await (supabase as any)
    .from('students')
    .insert([{ name: name.trim(), class_id: classId }])
    .select()
    .single();
  if (error) throw new Error(`학생 추가 실패: ${error.message}`);
  return data;
}

// --- 학생 초기화 함수 (RPC 호출로 변경) ---
async function resetStudentsAndRelationships(classId: string): Promise<void> {
    // RPC 함수 호출로 변경: 특정 학급의 학생 및 관련 데이터(관계, 답변) 삭제
    const { error } = await (supabase as any).rpc('reset_class_data', { class_id_to_reset: classId });

    if (error) {
        console.error('RPC reset_class_data error:', error);
        throw new Error(`데이터 초기화 실패: ${error.message}`);
    }
    // 기존 로직 (개별 테이블 delete) 제거
}

// --- 학생 이름 수정 함수 ---
async function updateStudentName(studentId: string, newName: string): Promise<Student | null> {
    const { data, error } = await (supabase as any)
        .from('students')
        .update({ name: newName.trim() })
        .eq('id', studentId)
        .select()
        .single();
    if (error) throw new Error(`학생 이름 수정 실패: ${error.message}`);
    return data;
}

// --- 학생 삭제 함수 (RPC 호출로 변경) ---
async function deleteStudent(studentId: string): Promise<void> {
    // RPC 함수 호출로 변경: 학생 및 관련 데이터(관계, 답변) 삭제
    const { error } = await (supabase as any).rpc('delete_student', { student_id_to_delete: studentId });

    if (error) {
        console.error('RPC delete_student error:', error);
        throw new Error(`학생 삭제 실패: ${error.message}`);
    }
    // 기존 로직 (개별 테이블 delete) 제거
}

// --- 주관식 질문 및 답변 fetching 함수 추가 ---
async function fetchQuestions(classId: string): Promise<Question[]> {
    const { data, error } = await (supabase as any)
        .from('questions')
        .select('*')
        .eq('class_id', classId)
        .order('created_at');
    if (error) {
        console.error("Error fetching questions:", error);
        return [];
    }
    return data;
}

async function fetchAnswers(studentId: string): Promise<Answer[]> {
    const { data, error } = await (supabase as any)
        .from('answers')
        .select(`
            *,
            questions ( question_text )
        `)
        .eq('student_id', studentId);

    if (error) {
        console.error("Error fetching answers:", error);
        return [];
    }
    return data;
}

// 학생 순서 업데이트 함수 추가
async function updateStudentOrder(studentId: string, newOrder: number): Promise<void> {
  const { error } = await (supabase as any)
    .from('students')
    .update({ display_order: newOrder })
    .eq('id', studentId);
  
  if (error) {
    console.error('Error updating student order:', error);
    throw new Error(`학생 순서 업데이트 실패: ${error.message}`);
  }
}

export default function ClassRelationshipPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const classId = params.classId as string;
  const graphRef = useRef<RelationshipGraphRef>(null);

  const [selectedStudent, setSelectedStudent] = useState<NodeData | null>(null);
  const [filterType, setFilterType] = useState<keyof typeof RELATIONSHIP_TYPES | 'ALL'>('ALL');
  const [newStudentName, setNewStudentName] = useState('');
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [studentOrder, setStudentOrder] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // 학급 상세 정보 조회
  const { data: classDetails, isLoading: isLoadingClass, isError: isErrorClass, error: errorClass } = useQuery({
    queryKey: ['classDetails', classId],
    queryFn: () => fetchClassDetails(classId),
    enabled: !!classId,
  });

  // 학생 목록 조회
  const { data: students, isLoading: isLoadingStudents, isError: isErrorStudents, error: errorStudents } = useQuery({
    queryKey: ['students', classId],
    queryFn: () => fetchStudents(classId),
    enabled: !!classId,
  });

  // 관계 목록 조회 (surveyId 없이 호출하여 기본 관계만 가져옴)
  const { data: relationships, isLoading: isLoadingRelationships, isError: isErrorRelationships, error: errorRelationships } = useQuery({
    queryKey: ['relations', classId, null], // queryKey에 null 추가하여 구분
    queryFn: () => fetchRelationships(classId, null),
    enabled: !!classId,
  });

  // 필터링된 관계 데이터
  const filteredRelationships = useMemo(() => {
    if (!relationships) return [];
    if (filterType === 'ALL') return relationships;
    return relationships.filter(link => link.type === filterType);
  }, [relationships, filterType]);

  // --- 주관식 답변 조회 Query ---
  const { data: answers, isLoading: isLoadingAnswers, isError: isErrorAnswers, error: errorAnswers } = useQuery({
      queryKey: ['answers', selectedStudent?.id],
      queryFn: () => fetchAnswers(selectedStudent!.id),
      enabled: !!selectedStudent, // 학생이 선택되었을 때만 실행
  });

  // --- 주관식 질문 목록 조회 Query ---
  const { data: questions, isLoading: isLoadingQuestions } = useQuery({
      queryKey: ['questions', classId],
      queryFn: () => fetchQuestions(classId),
      enabled: !!classId,
  });

  // --- 관계 유형별 랭킹 데이터 계산 ---
  const rankedStudentsByType = useMemo(() => {
    if (!students || !relationships) return {};

    const rankings: { [key: string]: (Student & { count: number })[] } = {};
    const studentMap = new Map(students.map((s: any) => [s.id, s]));

    // 각 관계 유형별로 계산
    Object.keys(RELATIONSHIP_TYPES).forEach(type => {
      const counts = new Map<string, number>();
      relationships
        .filter(link => link.type === type)
        .forEach(link => {
          counts.set(link.target, (counts.get(link.target) || 0) + 1);
        });

      // 득표 수에 따라 정렬된 학생 목록 생성
      const ranked = Array.from(counts.entries())
        .sort(([, countA], [, countB]) => countB - countA) // 내림차순 정렬
        .map(([studentId, count]) => {
            const studentData = studentMap.get(studentId);
            return studentData ? { ...studentData, count } : null;
        })
        .filter((s): s is Student & { count: number } => s !== null); // null 제거 및 타입 단언

      rankings[type] = ranked;
    });

    return rankings;
  }, [students, relationships]);

  // 학생 목록 순서 초기화
  useEffect(() => {
    if (students) {
      setStudentOrder(students.map(student => student.id));
    }
  }, [students]);

  // 드래그 앤 드롭 종료 핸들러 수정
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    
    if (over && active.id !== over.id) {
      const oldIndex = studentOrder.indexOf(active.id as string);
      const newIndex = studentOrder.indexOf(over.id as string);
      
      const newOrder = arrayMove(studentOrder, oldIndex, newIndex);
      setStudentOrder(newOrder);

      try {
        // 변경된 순서대로 학생들의 display_order 업데이트
        const updatePromises = newOrder.map((studentId, index) => 
          updateStudentOrder(studentId, index + 1)
        );
        
        await Promise.all(updatePromises);
        // 성공적으로 저장되면 학생 목록 다시 불러오기
        queryClient.invalidateQueries({ queryKey: ['students', classId] });
      } catch (error) {
        console.error('Failed to update student order:', error);
        toast.error('학생 순서 저장에 실패했습니다.');
        // 에러 발생 시 이전 순서로 되돌리기
        setStudentOrder(studentOrder);
      }
    }
  };

  // 정렬된 학생 목록
  const sortedStudents = useMemo(() => {
    if (!students) return [];
    return [...students].sort((a, b) => {
      const indexA = studentOrder.indexOf(a.id);
      const indexB = studentOrder.indexOf(b.id);
      return indexA - indexB;
    });
  }, [students, studentOrder]);

  // --- 학생 추가 Mutation ---
  const addStudentMutation = useMutation<Student, Error, string>({
    mutationFn: async (name) => {
      // 🌟 데모 학급 권한 체크
      if (classDetails && isDemoClass(classDetails)) {
        const saveAttempt = handleDemoSaveAttempt(classDetails, "학생 추가");
        if (!saveAttempt.canSave) {
          toast.success(saveAttempt.message || "체험판에서는 저장되지 않습니다.", {
            duration: 4000,
            style: {
              background: '#3B82F6',
              color: 'white',
              padding: '16px',
              fontSize: '14px',
              lineHeight: '1.5',
              whiteSpace: 'pre-line'
            }
          });
          throw new Error("DEMO_BLOCKED");
        }
      }
      return addStudent(classId, name);
    },
    onSuccess: (newStudent) => {
      queryClient.invalidateQueries({ queryKey: ['students', classId] }); // 학생 목록 캐시 무효화
      setNewStudentName(''); // 입력 필드 초기화
      // 🌟 데모 학급이 아닌 경우만 성공 메시지 표시
      if (classDetails && !isDemoClass(classDetails)) {
        toast.success(`'${newStudent.name}' 학생이 추가되었습니다.`); // 성공 토스트
      }
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "DEMO_BLOCKED") {
        return;
      }
      toast.error(error.message); // alert -> toast.error
    },
  });

  // --- 학생 초기화 Mutation (mutationFn 내부만 수정) ---
  const resetStudentsMutation = useMutation<void, Error, string>({
      mutationFn: async (classId: string) => {
        // 🌟 데모 학급 권한 체크
        if (classDetails && isDemoClass(classDetails)) {
          const saveAttempt = handleDemoSaveAttempt(classDetails, "학생 및 관계 데이터 초기화");
          if (!saveAttempt.canSave) {
            toast.success(saveAttempt.message || "체험판에서는 저장되지 않습니다.", {
              duration: 4000,
              style: {
                background: '#3B82F6',
                color: 'white',
                padding: '16px',
                fontSize: '14px',
                lineHeight: '1.5',
                whiteSpace: 'pre-line'
              }
            });
            throw new Error("DEMO_BLOCKED");
          }
        }
        return resetStudentsAndRelationships(classId);
      },
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['students', classId] });
          queryClient.invalidateQueries({ queryKey: ['relations', classId] });
          queryClient.invalidateQueries({ queryKey: ['answers'] });
          queryClient.invalidateQueries({ queryKey: ['questions', classId] });
          setSelectedStudent(null); // 선택된 학생 초기화
          setIsResetModalOpen(false); // 모달 닫기
          // 🌟 데모 학급이 아닌 경우만 성공 메시지 표시
          if (classDetails && !isDemoClass(classDetails)) {
            toast.success('학생 및 관계 데이터가 초기화되었습니다.'); // alert -> toast.success
          }
      },
      onError: (error) => {
          if (error instanceof Error && error.message === "DEMO_BLOCKED") {
            setIsResetModalOpen(false);
            return;
          }
          toast.error(`초기화 실패: ${error.message}`); // alert -> toast.error
          setIsResetModalOpen(false); // 모달 닫기
      }
  });

  // --- 학생 이름 수정 Mutation ---
  const updateStudentNameMutation = useMutation<Student | null, Error, { studentId: string; newName: string }>({
      mutationFn: async ({ studentId, newName }) => {
        // 🌟 데모 학급 권한 체크
        if (classDetails && isDemoClass(classDetails)) {
          const saveAttempt = handleDemoSaveAttempt(classDetails, "학생 이름 수정");
          if (!saveAttempt.canSave) {
            toast.success(saveAttempt.message || "체험판에서는 저장되지 않습니다.", {
              duration: 4000,
              style: {
                background: '#3B82F6',
                color: 'white',
                padding: '16px',
                fontSize: '14px',
                lineHeight: '1.5',
                whiteSpace: 'pre-line'
              }
            });
            throw new Error("DEMO_BLOCKED");
          }
        }
        return updateStudentName(studentId, newName);
      },
      onSuccess: (updatedStudent) => {
          if (!updatedStudent) return;
          queryClient.invalidateQueries({ queryKey: ['students', classId] });
          // 선택된 학생 정보도 업데이트 (이름 변경 즉시 반영)
          if (selectedStudent?.id === updatedStudent.id) {
              setSelectedStudent(prev => prev ? { ...prev, name: updatedStudent.name } : null);
          }
          // 🌟 데모 학급이 아닌 경우만 성공 메시지 표시
          if (classDetails && !isDemoClass(classDetails)) {
            toast.success(`'${updatedStudent.name}' 학생 이름이 수정되었습니다.`); // 성공 토스트
          }
      },
      onError: (error) => {
          if (error instanceof Error && error.message === "DEMO_BLOCKED") {
            return;
          }
          toast.error(error.message); // alert -> toast.error
      },
  });

  // --- 학생 삭제 Mutation (mutationFn 내부만 수정) ---
    const deleteStudentMutation = useMutation<void, Error, string>({
        mutationFn: async (studentId: string) => {
          // 🌟 데모 학급 권한 체크
          if (classDetails && isDemoClass(classDetails)) {
            const saveAttempt = handleDemoSaveAttempt(classDetails, "학생 삭제");
            if (!saveAttempt.canSave) {
              toast.success(saveAttempt.message || "체험판에서는 저장되지 않습니다.", {
                duration: 4000,
                style: {
                  background: '#3B82F6',
                  color: 'white',
                  padding: '16px',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  whiteSpace: 'pre-line'
                }
              });
              throw new Error("DEMO_BLOCKED");
            }
          }
          return deleteStudent(studentId);
        },
        onSuccess: (_, studentId) => {
            queryClient.invalidateQueries({ queryKey: ['students', classId] });
            queryClient.invalidateQueries({ queryKey: ['relations', classId] });
            queryClient.invalidateQueries({ queryKey: ['answers', studentId] }); // 답변 캐시도 무효화
            // 삭제된 학생이 선택된 상태였다면 선택 해제
            if (selectedStudent?.id === studentId) {
                setSelectedStudent(null);
            }
            // 🌟 데모 학급이 아닌 경우만 성공 메시지 표시
            if (classDetails && !isDemoClass(classDetails)) {
              toast.success('학생이 삭제되었습니다.'); // 성공 토스트
            }
        },
        onError: (error) => {
            if (error instanceof Error && error.message === "DEMO_BLOCKED") {
              return;
            }
            toast.error(`학생 삭제 실패: ${error.message}`); // alert -> toast.error
        },
    });

  const isLoading = isLoadingClass || isLoadingStudents || isLoadingRelationships || isLoadingQuestions;
  const isError = isErrorClass || isErrorStudents || isErrorRelationships;
  const combinedError = errorClass || errorStudents || errorRelationships;

  // --- 핸들러 함수들 ---
  const handleAddStudent = () => {
    if (newStudentName.trim()) {
      addStudentMutation.mutate(newStudentName.trim());
    }
  };
  const handleAddStudentKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
          handleAddStudent();
      }
  };

  const handleResetStudents = () => {
    setIsResetModalOpen(true); // 초기화 확인 모달 열기
  };
  const confirmResetStudents = () => {
      resetStudentsMutation.mutate(classId);
      // 모달은 ConfirmModal 내부에서 닫힘
  };

  // handleNodeClick 핸들러는 StudentListItem에서도 사용하므로 이름 변경 및 통합
  const handleSelectStudent = useCallback((student: NodeData | null) => {
    setSelectedStudent(student);
  }, []);

  // StudentListItem에 전달할 함수들
  const handleUpdateStudent = async (id: string, newName: string) => {
      await updateStudentNameMutation.mutateAsync({ studentId: id, newName });
  };
  const handleDeleteStudent = async (id: string) => {
      await deleteStudentMutation.mutateAsync(id);
  };

  // --- 데이터 조회 결과를 로그로 확인 ---
  console.log('Students data:', students);
  console.log('Relationships data from query:', relationships); // fetchRelationships 결과
  console.log('Filtered relationships before passing to graph:', filteredRelationships);
  console.log('Ranked students by type:', rankedStudentsByType); // 랭킹 데이터 로그 추가

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const dropAnimationConfig = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.5',
        },
      },
    }),
  };

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
            <p className="text-black mb-4 text-center">데이터를 불러오는 중 문제가 발생했습니다. 네트워크 연결을 확인하거나 잠시 후 다시 시도해주세요.</p>
            <pre className="text-xs text-red-400 bg-red-50 p-2 rounded overflow-x-auto max-w-lg">
                {combinedError?.message || '알 수 없는 오류'}
            </pre>
            {/* 뒤로가기 버튼 등 추가 가능 */} 
        </div>
    );
  }

  if (!classDetails) {
    return (
        <div className="flex flex-col justify-center items-center min-h-screen bg-gray-100">
            <ExclamationCircleIcon className="w-16 h-16 text-yellow-500 mb-4" />
            <p className="text-lg text-black">해당 학급 정보를 찾을 수 없습니다.</p>
            <button onClick={() => router.push('/')} className="mt-4 text-[#6366f1] hover:underline">
                학급 목록으로 돌아가기
            </button>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-screen-2xl mx-auto px-4 py-8 flex flex-col">

        {/* 상단 헤더: 수정 */}
        <header className="mb-4 flex justify-between items-center bg-white p-3 rounded-lg shadow-md flex-shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 text-sm bg-[#6366f1] text-white rounded-md hover:bg-[#4f46e5] shadow focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-1 transition-all duration-200 cursor-pointer font-semibold hover:-translate-y-0.5 hover:shadow-md"
            >
              교실 선택
            </button>
            <h1 className="text-xl font-bold text-black">{classDetails.name}</h1>
          </div>
          <UserProfile />
        </header>

        {/* 컨트롤 패널 */}
        <div className="mb-4 flex flex-wrap justify-between items-center gap-4 bg-white p-3 rounded-lg shadow-md flex-shrink-0">
          <div className="flex gap-2 items-center flex-wrap">
            <span className="font-semibold text-sm mr-2 text-[#6366f1]">관계 필터:</span>
            <button onClick={() => setFilterType('ALL')} className={`px-3 py-1 text-xs rounded-md transition-all duration-200 ${filterType === 'ALL' ? 'bg-[#6366f1] text-white shadow' : 'bg-gray-100 text-gray-700 hover:bg-[#e0e7ff]'}`}>전체</button>
            {/* 새 4가지 관계 유형 필터 버튼 */} 
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
          <div className="flex gap-2">
            <button
              onClick={handleResetStudents}
              disabled={resetStudentsMutation.isPending}
              className="px-4 py-2 text-sm bg-red-500 text-white rounded-md hover:bg-red-600 shadow focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-1 transition-all duration-200 cursor-pointer font-semibold disabled:opacity-70 disabled:cursor-not-allowed hover:disabled:-translate-y-0 hover:disabled:shadow hover:-translate-y-0.5 hover:shadow-md"
            >
              {resetStudentsMutation.isPending ? '초기화중...' : '학생 초기화'}
            </button>
          </div>
        </div>

        <div className="flex-grow flex flex-col gap-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="w-full md:w-[230px] bg-white rounded-lg shadow-md flex flex-col flex-shrink-0">
              <h3 className="text-base font-semibold p-3 border-b text-[#6366f1] flex-shrink-0">
                학생 목록 ({students?.length || 0}명)
              </h3>
              <div className="p-3 border-b">
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    onKeyPress={handleAddStudentKeyPress}
                    placeholder="학생 이름 입력"
                    className="flex-grow min-w-0 px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-300 text-sm shadow-sm text-black placeholder:text-gray-500"
                  />
                  <button
                    onClick={handleAddStudent}
                    disabled={!newStudentName.trim() || addStudentMutation.isPending}
                    className="px-3 py-1 text-sm bg-[#6366f1] text-white rounded-md shadow focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-1 transition-all duration-200 cursor-pointer font-semibold disabled:opacity-70 disabled:cursor-not-allowed flex-shrink-0"
                  >
                    {addStudentMutation.isPending ? '추가중...' : '추가'}
                  </button>
                </div>
              </div>
              <div className="flex-grow overflow-y-auto p-2 space-y-2">
                <AnimatePresence mode='popLayout'>
                  {students && students.length > 0 ? (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={studentOrder}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-2">
                          {sortedStudents.map(student => (
                            <SortableStudentItem
                              key={student.id}
                              student={student}
                              classId={classId}
                              onSelect={handleSelectStudent}
                              isSelected={selectedStudent?.id === student.id}
                              onUpdateStudent={handleUpdateStudent}
                              onDeleteStudent={handleDeleteStudent}
                            />
                          ))}
                        </div>
                      </SortableContext>
                      <DragOverlay>
                        {activeId ? (
                          <StudentListItem
                            student={students.find(s => s.id === activeId)!}
                            classId={classId}
                            onSelect={handleSelectStudent}
                            isSelected={selectedStudent?.id === activeId}
                            onUpdateStudent={handleUpdateStudent}
                            onDeleteStudent={handleDeleteStudent}
                            isDragging={true}
                          />
                        ) : null}
                      </DragOverlay>
                    </DndContext>
                  ) : (
                    <p className="text-sm text-gray-500 p-3 italic text-center">등록된 학생이 없습니다.</p>
                  )}
                </AnimatePresence>
              </div>
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

              {/* 새 4가지 관계 유형 랭킹 박스 */} 
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 flex-shrink-0">
                {Object.entries(RELATIONSHIP_TYPES).map(([type, title]) => (
                    <div key={type} className="min-h-[180px]">
                        {students && relationships ? (
                            <RelationshipTypeRankBox
                                title={title}
                                students={rankedStudentsByType[type]?.slice(0, 10)}
                                relationshipType={type} // key (e.g., FRIENDLY) 전달
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
          
          {/* AI 관계 분석 섹션 추가 */}
          {students && relationships && (
            <div className="mt-4">
              <RelationshipAnalysis 
                classId={classId}
                students={students}
                relationships={relationships}
                questions={questions}
                answers={answers}
              />
            </div>
          )}
        </div>

        {/* 확인 모달 */}
        <ConfirmModal
          isOpen={isResetModalOpen}
          onClose={() => setIsResetModalOpen(false)}
          onConfirm={confirmResetStudents}
          title="학생 데이터 초기화"
          message={`'${classDetails.name}' 학급의 모든 학생 및 관계 데이터를 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
          confirmText="초기화"
        />
      </div>
    </div>
  );
}

// SortableStudentItem 컴포넌트
function SortableStudentItem(props: {
  student: NodeData;
  classId: string;
  onSelect: (student: NodeData) => void;
  isSelected: boolean;
  onUpdateStudent: (id: string, newName: string) => Promise<void>;
  onDeleteStudent: (id: string) => Promise<void>;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: props.student.id,
    transition: {
      duration: 300,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    position: 'relative' as const,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <StudentListItem
        student={props.student}
        classId={props.classId}
        onSelect={props.onSelect}
        isSelected={props.isSelected}
        onUpdateStudent={props.onUpdateStudent}
        onDeleteStudent={props.onDeleteStudent}
        listeners={listeners}
        isDragging={isDragging}
      />
    </div>
  );
}
