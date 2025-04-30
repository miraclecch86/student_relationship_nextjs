'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
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
import { useRouter, usePathname } from 'next/navigation';

// NodeData 정의 (공통으로 사용될 수 있으므로 lib 등에 정의하는 것이 좋음)
interface NodeData extends Student {
  x?: number;
  y?: number;
  fx?: number | null | undefined;
  fy?: number | null | undefined;
}

// --- 데이터 fetching 및 mutation 함수들 --- (컴포넌트 내부 또는 별도 파일)
async function fetchStudents(classId: string): Promise<NodeData[]> {
  const { data, error } = await supabase
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
  const { data: existingStudent, error: checkError } = await supabase
    .from('students')
    .select('id')
    .eq('class_id', classId)
    .eq('name', name.trim())
    .maybeSingle();
  if (checkError) throw new Error(`학생 확인 중 오류: ${checkError.message}`);
  if (existingStudent) throw new Error(`이미 '${name.trim()}' 학생이 존재합니다.`);

  const { count, error: countError } = await supabase
    .from('students')
    .select('* ', { count: 'exact', head: true })
    .eq('class_id', classId);
  if (countError) throw new Error(`학생 수 조회 오류: ${countError.message}`);
  const newOrder = (count ?? 0) + 1;

  const { data, error } = await supabase
    .from('students')
    .insert([{ name: name.trim(), class_id: classId, display_order: newOrder }])
    .select()
    .single();
  if (error) throw new Error(`학생 추가 실패: ${error.message}`);
  return data;
}

async function updateStudentName(studentId: string, newName: string): Promise<Student | null> {
    const { data, error } = await supabase
        .from('students')
        .update({ name: newName.trim() })
        .eq('id', studentId)
        .select()
        .single();
    if (error) throw new Error(`학생 이름 수정 실패: ${error.message}`);
    return data;
}

async function deleteStudent(studentId: string): Promise<void> {
    // delete_student RPC 사용 (relations, answers 자동 삭제)
    const { error } = await supabase.rpc('delete_student', { student_id_to_delete: studentId });
    if (error) {
        console.error('RPC delete_student error:', error);
        throw new Error(`학생 삭제 실패: ${error.message}`);
    }
}

async function updateStudentOrder(studentId: string, newOrder: number): Promise<void> {
  const { error } = await supabase
    .from('students')
    .update({ display_order: newOrder })
    .eq('id', studentId);
  if (error) {
    console.error('Error updating student order:', error);
    throw new Error(`학생 순서 업데이트 실패: ${error.message}`);
  }
}

// SortableStudentItem 컴포넌트 (클릭 동작 없음)
function SortableStudentItem(props: {
  student: NodeData;
  classId: string;
  isSelected: boolean;
  onUpdateStudent: (id: string, newName: string) => Promise<void>;
  onDeleteStudent: (id: string) => Promise<void>;
  onClick: (studentId: string) => void; // 선택 상태 관리를 위한 onClick 추가
}) {
  const { student, classId, isSelected, onUpdateStudent, onDeleteStudent, onClick } = props;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: student.id,
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
        student={student}
        classId={classId}
        onSelect={() => onClick(student.id)} // 클릭 시 ID 전달 (페이지 이동 X)
        isSelected={isSelected}
        onUpdateStudent={onUpdateStudent}
        onDeleteStudent={onDeleteStudent}
        listeners={listeners}
        isDragging={isDragging}
      />
    </div>
  );
}


interface StudentListPanelProps {
  classId: string;
  onStudentSelect?: (studentId: string) => void;
}

export default function StudentListPanel({ classId, onStudentSelect }: StudentListPanelProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const [newStudentName, setNewStudentName] = useState('');
  const [studentOrder, setStudentOrder] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor)
  );

  // 학생 목록 조회
  const { data: students, isLoading, isError, error } = useQuery({
    queryKey: ['students', classId],
    queryFn: () => fetchStudents(classId!),
    enabled: !!classId,
  });

  // 학생 목록 순서 초기화
  useEffect(() => {
    if (students) {
      setStudentOrder(students.map(student => student.id));
    }
  }, [students]);

  // 정렬된 학생 목록
  const sortedStudents = useMemo(() => {
    if (!students) return [];
    // DndContext가 studentOrder 기반으로 렌더링하므로, students 배열을 studentOrder 순서에 맞게 정렬
    const studentMap = new Map(students.map(s => [s.id, s]));
    return studentOrder.map(id => studentMap.get(id)).filter(Boolean) as NodeData[];
  }, [students, studentOrder]);

  // --- 학생 추가 Mutation ---
  const addStudentMutation = useMutation<Student, Error, string>({
    mutationFn: (name) => addStudent(classId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students', classId] });
      setNewStudentName('');
      toast.success('학생이 추가되었습니다.');
    },
    onError: (error) => toast.error(error.message),
  });

  // --- 학생 이름 수정 Mutation ---
  const updateStudentNameMutation = useMutation<Student | null, Error, { studentId: string; newName: string }>({
      mutationFn: ({ studentId, newName }) => updateStudentName(studentId, newName),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['students', classId] });
        toast.success('학생 이름이 수정되었습니다.');
      },
      onError: (error) => toast.error(error.message),
  });

  // --- 학생 삭제 Mutation ---
  const deleteStudentMutation = useMutation<void, Error, string>({
        mutationFn: deleteStudent,
        onSuccess: (_, deletedId) => {
            queryClient.invalidateQueries({ queryKey: ['students', classId] });
            toast.success('학생이 삭제되었습니다.');
            if (selectedStudentId === deletedId) {
              setSelectedStudentId(null); // 삭제 시 선택 해제
            }
        },
        onError: (error) => toast.error(error.message),
  });

  // --- 핸들러 함수들 ---
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

  const handleStudentClick = (studentId: string) => {
    // 설문 상세 페이지 등에서 onStudentSelect가 전달되면 그걸 우선 사용
    if (onStudentSelect) {
      onStudentSelect(studentId);
      return;
    }
    // 기존 로직 (설문 목록 페이지 등)
    const currentPath = pathname;
    const isSurveyListPage = /^\/class\/[^/]+\/survey$/.test(currentPath);
    if (isSurveyListPage) {
      // 설문 목록 페이지: 아무 작업도 하지 않음
      return;
    } else {
      router.push(`/class/${classId}/student/${studentId}`);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setSelectedStudentId(null); // 드래그 시작 시 선택 해제
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    
    if (over && active.id !== over.id && classId) {
      const oldIndex = studentOrder.indexOf(active.id as string);
      const newIndex = studentOrder.indexOf(over.id as string);
      
      const newOrderArray = arrayMove(studentOrder, oldIndex, newIndex);
      // 낙관적 업데이트: 즉시 UI 반영
      setStudentOrder(newOrderArray);

      try {
        const updatePromises = newOrderArray.map((studentId, index) => 
          updateStudentOrder(studentId, index + 1)
        );
        await Promise.all(updatePromises);
        // 성공 시 캐시 무효화하여 서버 데이터와 동기화 (선택 사항, 이미 낙관적 업데이트됨)
        // queryClient.invalidateQueries({ queryKey: ['students', classId] });
      } catch (error) {
        console.error('Failed to update student order:', error);
        toast.error('학생 순서 저장에 실패했습니다.');
        // 에러 시 원래 순서로 롤백 (데이터를 다시 불러오는 것이 더 안전할 수 있음)
        queryClient.invalidateQueries({ queryKey: ['students', classId] }); 
      }
    }
  };

  if (isLoading) {
    return <div className="p-4 text-center"><ArrowPathIcon className="w-6 h-6 animate-spin mx-auto" /></div>;
  }

  if (isError) {
    return <div className="p-4 text-red-500 text-center"><ExclamationCircleIcon className="w-6 h-6 mx-auto mb-1" /> 로딩 실패: {error?.message}</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <h3 className="text-base font-semibold p-3 border-b text-indigo-600 flex-shrink-0">
        학생 목록 ({students?.length || 0}명)
      </h3>
      <div className="p-3 border-b">
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={newStudentName}
            onChange={(e) => setNewStudentName(e.target.value)}
            onKeyPress={handleAddStudentKeyPress}
            placeholder="학생 이름 입력 후 Enter"
            className="flex-grow min-w-0 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm shadow-sm text-black placeholder:text-gray-400"
          />
          <button
            onClick={handleAddStudent}
            disabled={!newStudentName.trim() || addStudentMutation.isPending}
            className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            {addStudentMutation.isPending ? '...' : '추가'}
          </button>
        </div>
      </div>
      <div className="flex-grow overflow-y-auto p-2 space-y-1">
        <AnimatePresence>
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
                {/* sortedStudents 배열을 사용하여 렌더링 */}
                {sortedStudents.map(student => (
                  <SortableStudentItem
                    key={student.id}
                    student={student}
                    classId={classId}
                    isSelected={selectedStudentId === student.id} // 선택 상태 전달
                    onUpdateStudent={handleUpdateStudent}
                    onDeleteStudent={handleDeleteStudent}
                    onClick={handleStudentClick} // 클릭 핸들러 전달
                  />
                ))}
              </SortableContext>
              <DragOverlay>
                {activeId && students ? (
                  <StudentListItem
                    student={students.find(s => s.id === activeId)!}
                    classId={classId}
                    onSelect={() => {}} // 오버레이는 클릭 동작 없음
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
    </div>
  );
} 