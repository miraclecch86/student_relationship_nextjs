'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, Student } from '@/lib/supabase';
import StudentListItem from '@/components/StudentListItem';
import { ArrowPathIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
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
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { arrayMove } from '@dnd-kit/sortable';

// NodeData 정의
interface NodeData extends Student {
  x?: number;
  y?: number;
  fx?: number | null | undefined;
  fy?: number | null | undefined;
}

// 데이터 fetching 및 mutation 함수들
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

async function addStudent(classId: string, name: string): Promise<Student> {
  const { data: existingStudent, error: checkError } = await (supabase as any)
    .from('students')
    .select('id')
    .eq('class_id', classId)
    .eq('name', name.trim())
    .maybeSingle();
  if (checkError) throw new Error(`학생 확인 중 오류: ${checkError.message}`);
  if (existingStudent) throw new Error(`이미 '${name.trim()}' 학생이 존재합니다.`);

  const { count, error: countError } = await (supabase as any)
    .from('students')
    .select('* ', { count: 'exact', head: true })
    .eq('class_id', classId);
  if (countError) throw new Error(`학생 수 조회 오류: ${countError.message}`);
  const newOrder = (count ?? 0) + 1;

  const { data, error } = await (supabase as any)
    .from('students')
    .insert([{ name: name.trim(), class_id: classId, display_order: newOrder }])
    .select()
    .single();
  if (error) throw new Error(`학생 추가 실패: ${error.message}`);
  return data;
}

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

async function deleteStudent(studentId: string): Promise<void> {
  const { error } = await (supabase as any).rpc('delete_student', { student_id_to_delete: studentId });
  if (error) {
    console.error('RPC delete_student error:', error);
    throw new Error(`학생 삭제 실패: ${error.message}`);
  }
}

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

// SortableStudentItem 컴포넌트
function SortableStudentItem(props: {
  student: NodeData;
  classId: string;
  isSelected: boolean;
  onUpdateStudent: (id: string, newName: string) => Promise<void>;
  onDeleteStudent: (id: string) => Promise<void>;
  disabled: boolean;
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
        onSelect={() => {}}
        isSelected={props.isSelected}
        onUpdateStudent={props.onUpdateStudent}
        onDeleteStudent={props.onDeleteStudent}
        listeners={listeners}
        isDragging={isDragging}
        disabled={props.disabled}
      />
    </div>
  );
}

export default function StudentsPageClientContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const classId = searchParams.get('classId');
  const queryClient = useQueryClient();

  const [newStudentName, setNewStudentName] = useState('');
  const [studentOrder, setStudentOrder] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [isTouchScrolling, setIsTouchScrolling] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { 
      activationConstraint: { 
        delay: 200,
        tolerance: 0
      } 
    }),
    useSensor(KeyboardSensor)
  );

  const { data: students, isLoading: isLoadingStudents, isError: isErrorStudents, error: errorStudents } = useQuery({
    queryKey: ['students', classId],
    queryFn: () => fetchStudents(classId!),
    enabled: !!classId,
  });

  useEffect(() => {
    if (students) {
      setStudentOrder(students.map(student => student.id));
    }
  }, [students]);

  const sortedStudents = useMemo(() => {
    if (!students) return [];
    return [...students].sort((a, b) => {
      const indexA = studentOrder.indexOf(a.id);
      const indexB = studentOrder.indexOf(b.id);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [students, studentOrder]);

  const addStudentMutation = useMutation<Student, Error, string>({
    mutationFn: (name) => addStudent(classId!, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students', classId] });
      setNewStudentName('');
      toast.success('학생이 추가되었습니다.');
    },
    onError: (error) => toast.error(error.message),
  });

  const updateStudentNameMutation = useMutation<Student | null, Error, { studentId: string; newName: string }>({
    mutationFn: ({ studentId, newName }) => updateStudentName(studentId, newName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students', classId] });
      toast.success('학생 이름이 수정되었습니다.');
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteStudentMutation = useMutation<void, Error, string>({
    mutationFn: deleteStudent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students', classId] });
      toast.success('학생이 삭제되었습니다.');
      setSelectedStudentId(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const handleAddStudent = () => {
    if (newStudentName.trim() && classId) {
      addStudentMutation.mutate(newStudentName.trim());
    }
  };

  const handleAddStudentKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleAddStudent();
    }
  };

  const handleUpdateStudent = async (id: string, newName: string) => {
    await updateStudentNameMutation.mutateAsync({ studentId: id, newName });
  };

  const handleDeleteStudent = async (id: string) => {
    await deleteStudentMutation.mutateAsync(id);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    
    if (over && active.id !== over.id && classId) {
      const oldIndex = studentOrder.indexOf(active.id as string);
      const newIndex = studentOrder.indexOf(over.id as string);
      
      const newOrderArray = arrayMove(studentOrder, oldIndex, newIndex);
      setStudentOrder(newOrderArray);

      try {
        const updatePromises = newOrderArray.map((studentId, index) => 
          updateStudentOrder(studentId, index + 1)
        );
        await Promise.all(updatePromises);
      } catch (error) {
        console.error('Failed to update student order:', error);
        toast.error('학생 순서 저장에 실패했습니다.');
        setStudentOrder(studentOrder);
      }
    }
  };

  const handleComplete = () => {
    if (classId) {
      router.push(`/class/${classId}/dashboard`);
    }
  };

  // 터치 이벤트 핸들러 추가
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartY(e.touches[0].clientY);
    setIsTouchScrolling(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY === null || !scrollContainerRef.current) return;
    
    const touchY = e.touches[0].clientY;
    const diff = touchStartY - touchY;
    
    if (Math.abs(diff) > 10 && !isTouchScrolling) {
      setIsTouchScrolling(true);
    }
    
    if (isTouchScrolling) {
      // 스크롤 동작 처리
      scrollContainerRef.current.scrollTop += diff / 2;
      setTouchStartY(touchY);
      e.stopPropagation();
    }
  };

  const handleTouchEnd = () => {
    setTouchStartY(null);
    // 잠시 후 스크롤 플래그 리셋 (드래그를 위해)
    setTimeout(() => setIsTouchScrolling(false), 300);
  };

  if (!classId) {
    return <div>잘못된 접근입니다. 학급 생성 과정을 다시 시작해주세요.</div>;
  }

  if (isLoadingStudents) {
    return <div className="flex justify-center items-center h-screen"><ArrowPathIcon className="w-8 h-8 animate-spin" /></div>;
  }

  if (isErrorStudents) {
    return <div className="flex justify-center items-center h-screen text-red-500"><ExclamationCircleIcon className="w-8 h-8 mr-2" /> 학생 목록 로딩 실패: {errorStudents?.message}</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-700 via-indigo-800 to-indigo-900">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col">
        <h1 className="text-2xl font-bold p-6 border-b text-center text-indigo-800">학생 목록 입력</h1>
        <div className="p-6 border-b">
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={newStudentName}
              onChange={(e) => setNewStudentName(e.target.value)}
              onKeyPress={handleAddStudentKeyPress}
              placeholder="학생 이름 입력 후 Enter"
              className="flex-grow min-w-0 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm shadow-sm text-black placeholder:text-gray-500"
            />
            <button
              onClick={handleAddStudent}
              disabled={!newStudentName.trim() || addStudentMutation.isPending}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            >
              {addStudentMutation.isPending ? '추가중...' : '추가'}
            </button>
          </div>
        </div>
        <div 
          ref={scrollContainerRef}
          className="flex-grow overflow-y-auto p-4 space-y-2 max-h-[400px]" 
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <AnimatePresence>
            {students && students.length > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                modifiers={[]}
              >
                <SortableContext
                  items={studentOrder}
                  strategy={verticalListSortingStrategy}
                >
                  {sortedStudents.map(student => (
                    <SortableStudentItem
                      key={student.id}
                      student={student}
                      classId={classId}
                      isSelected={selectedStudentId === student.id}
                      onUpdateStudent={handleUpdateStudent}
                      onDeleteStudent={handleDeleteStudent}
                      disabled={isTouchScrolling}
                    />
                  ))}
                </SortableContext>
                <DragOverlay>
                  {activeId && students ? (
                    <StudentListItem
                      student={students.find(s => s.id === activeId)!}
                      classId={classId}
                      onSelect={() => {}}
                      isSelected={false}
                      onUpdateStudent={async () => {}}
                      onDeleteStudent={async () => {}}
                      isDragging={true}
                    />
                  ) : null}
                </DragOverlay>
              </DndContext>
            ) : (
              <p className="text-sm text-gray-500 p-4 italic text-center">학생을 추가해주세요.</p>
            )}
          </AnimatePresence>
        </div>
        <div className="p-6 border-t text-center">
          <button 
            onClick={handleComplete} 
            disabled={!students || students.length === 0}
            className="w-full px-4 py-2 text-base font-semibold bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            학생 목록 입력 완료
          </button>
        </div>
      </div>
    </div>
  );
} 