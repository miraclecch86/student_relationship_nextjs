'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, Student, Class, StudentForClient } from '@/lib/supabase';
import {
  UserPlusIcon,
  PencilIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  ArrowPathIcon,
  Bars3Icon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import ConfirmModal from '@/components/ConfirmModal';
import StudentDetailForm from '@/components/StudentDetailForm';
import { handleDemoSaveAttempt, isDemoClass } from '@/utils/demo-permissions';
import {
  DndContext,
  rectIntersection,
  KeyboardSensor,
  MouseSensor,
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
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { arrayMove } from '@dnd-kit/sortable';

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

// 학생 목록 조회 함수
async function fetchStudents(classId: string): Promise<Student[]> {
  const { data, error } = await (supabase as any)
    .from('students')
    .select('*')
    .eq('class_id', classId)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });
  
  if (error) {
    console.error('Error fetching students:', error);
    return [];
  }
  
  return data;
}

// 학생 추가 함수
async function addStudent(classId: string, name: string): Promise<Student> {
  // 이름 중복 체크
  const { data: existingStudent, error: checkError } = await (supabase as any)
    .from('students')
    .select('id')
    .eq('class_id', classId)
    .eq('name', name.trim())
    .maybeSingle();

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

// 학생 이름 수정 함수
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

// 학생 순서 업데이트 함수
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

// 학생 삭제 함수
async function deleteStudent(studentId: string): Promise<void> {
  const { error } = await (supabase as any).rpc('delete_student', { student_id_to_delete: studentId });

  if (error) {
    console.error('RPC delete_student error:', error);
    throw new Error(`학생 삭제 실패: ${error.message}`);
  }
}

// StudentItem 컴포넌트 - dragHandleRef 제거
interface StudentItemProps {
  student: Student;
  onUpdateStudent: (id: string, newName: string) => Promise<void>;
  onDeleteStudent: (id: string) => Promise<void>;
  onDetailClick: (student: Student) => void;
  listeners?: any;
  isDragging?: boolean;
  disabled?: boolean;
  activeId?: string | null;
}

function StudentItem({ 
  student, 
  onUpdateStudent, 
  onDeleteStudent, 
  onDetailClick,
  listeners, 
  isDragging = false,
  disabled = false,
  activeId = null
}: StudentItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(student.name);
  const [isDeleting, setIsDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // 외부 클릭 시 자동저장 처리
  useEffect(() => {
    if (!isEditing) return;

    const handleClickOutside = async (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        // 이름이 변경되었고 유효한 경우에만 저장
        if (editName.trim() && editName.trim() !== student.name) {
          try {
            await onUpdateStudent(student.id, editName.trim());
            setIsEditing(false);
          } catch (error) {
            // 저장 실패 시 원래 이름으로 되돌리기
            setEditName(student.name);
          }
        } else if (editName.trim() === '') {
          // 빈 이름인 경우 원래 이름으로 되돌리기
          setEditName(student.name);
          setIsEditing(false);
        } else {
          // 변경사항이 없는 경우 그냥 편집모드 종료
          setIsEditing(false);
        }
      }
    };

    // 짧은 지연 후 이벤트 리스너 추가 (편집 버튼 클릭과 충돌 방지)
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isEditing, editName, student.name, student.id, onUpdateStudent]);

  const handleUpdateClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleSaveClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editName.trim() === '') {
      toast.error('학생 이름을 입력해주세요.');
      return;
    }

    try {
      await onUpdateStudent(student.id, editName.trim());
      setIsEditing(false);
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  const handleCancelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditName(student.name);
    setIsEditing(false);
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    
    if (e.key === 'Enter') {
      e.preventDefault();
      if (editName.trim() === '') {
        toast.error('학생 이름을 입력해주세요.');
        return;
      }
      try {
        await onUpdateStudent(student.id, editName.trim());
        setIsEditing(false);
      } catch (error) {
        // Error is handled by the mutation
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditName(student.name);
      setIsEditing(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleting(true);
  };

  const handleDetailClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDetailClick(student);
  };

  const handleConfirmDelete = async () => {
    try {
      await onDeleteStudent(student.id);
    } catch (error) {
      // Error is handled by the mutation
    }
    setIsDeleting(false);
  };

  return (
    <>
      <motion.div 
        ref={containerRef}
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ type: "tween", duration: 0.2 }}
        className={`bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 hover:shadow-md transition-all duration-200 group ${
          isDragging ? 'opacity-30' : ''
        } ${disabled ? 'pointer-events-none' : ''}`}
        style={{ 
          transformOrigin: '0 0',
          touchAction: 'auto'
        }}
      >
        <div className="flex items-center justify-between">
          {/* 왼쪽: 드래그 핸들 + 학생 정보 */}
          <div className="flex items-center gap-3 flex-grow">
            {/* 드래그 핸들 */}
            <div 
              className={`p-2 hover:bg-blue-100 rounded-lg cursor-grab active:cursor-grabbing flex-shrink-0 drag-handle transition-colors ${
                disabled ? 'opacity-50' : ''
              } ${
                activeId === student.id ? 'bg-blue-200 border-2 border-blue-400' : 'bg-blue-50'
              }`} 
              title="드래그하여 순서 변경"
              {...listeners}
            >
              <Bars3Icon className={`w-5 h-5 transition-colors ${
                activeId === student.id ? 'text-blue-700' : 'text-blue-500'
              }`} />
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              {isEditing ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-grow p-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium bg-white"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <h3 className="text-base font-medium text-gray-900">{student.name}</h3>
              )}
              <div className="flex gap-1 sm:gap-2 flex-wrap">
                {student.gender && (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    student.gender === 'male' 
                      ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}>
                    {student.gender === 'male' ? '남' : '여'}
                  </span>
                )}
                {student.tablet_number && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-50 text-slate-700 border border-slate-200">
                    태블릿 #{student.tablet_number}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* 오른쪽: 액션 버튼들 */}
          <div className="flex items-center gap-1.5 ml-4 flex-shrink-0">
            {isEditing ? (
              <>
                <button
                  onClick={handleSaveClick}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 transition-colors shadow-sm"
                >
                  <CheckIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">저장</span>
                </button>
                <button
                  onClick={handleCancelClick}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-500 text-white text-sm font-medium rounded-lg hover:bg-gray-600 transition-colors shadow-sm"
                >
                  <XMarkIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">취소</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleDetailClick}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors shadow-sm"
                  title="상세정보보기"
                >
                  <InformationCircleIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">상세정보보기</span>
                </button>
                <button
                  onClick={handleUpdateClick}
                  className="inline-flex items-center justify-center w-8 h-8 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors shadow-sm opacity-0 group-hover:opacity-100"
                  title="수정"
                >
                  <PencilIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={handleDeleteClick}
                  className="inline-flex items-center justify-center w-8 h-8 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-sm opacity-0 group-hover:opacity-100"
                  title="삭제"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>

      <ConfirmModal
        isOpen={isDeleting}
        onClose={() => setIsDeleting(false)}
        onConfirm={handleConfirmDelete}
        title="학생 삭제 확인"
        message={`'${student.name}' 학생을 정말 삭제하시겠습니까? 관련된 모든 데이터(관계, 답변 등)가 삭제됩니다.`}
        confirmText="삭제"
      />
    </>
  );
}

// SortableStudentItem 컴포넌트 - 드래그 핸들에만 listeners 적용!
function SortableStudentItem(props: {
  student: Student;
  onUpdateStudent: (id: string, newName: string) => Promise<void>;
  onDeleteStudent: (id: string) => Promise<void>;
  onDetailClick: (student: Student) => void;
  disabled?: boolean;
  activeId?: string | null;
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
    disabled: props.disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes}
      // 🔥 전체 카드에서 listeners 제거! 드래그 핸들에만 적용할 예정
    >
      <StudentItem
        student={props.student}
        onUpdateStudent={props.onUpdateStudent}
        onDeleteStudent={props.onDeleteStudent}
        onDetailClick={props.onDetailClick}
        isDragging={isDragging}
        disabled={props.disabled}
        activeId={props.activeId}
        listeners={listeners} // 🎯 listeners를 StudentItem으로 전달
      />
    </div>
  );
}

export default function ClassStudentsPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const classId = params.classId as string;
  const [newStudentName, setNewStudentName] = useState('');
  const [studentOrder, setStudentOrder] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // 🔥 센서 설정 (Hooks 규칙 준수) - 안정적인 기본 드래그!
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5, // 마우스: 기본값으로 복원
      },
    }),
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,     // 터치: 적당한 거리
        delay: 500,       // 터치: 0.5초 길게 누르기
        tolerance: 200,   // 🎯 tolerance 다시 올림 (안정적인 드래그)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 학급 정보 조회
  const { data: classDetails, isLoading: isClassLoading } = useQuery({
    queryKey: ['classDetails', classId],
    queryFn: () => fetchClassDetails(classId),
    enabled: !!classId,
  });

  // 학생 목록 조회
  const { 
    data: students, 
    isLoading: isStudentsLoading, 
    isError: isStudentsError 
  } = useQuery({
    queryKey: ['students', classId],
    queryFn: () => fetchStudents(classId),
    enabled: !!classId,
  });

  // 학생 목록 순서 초기화
  useEffect(() => {
    if (students) {
      const newOrder = students.map(student => student.id);
      console.log('🔄 Student order updated:', {
        studentsCount: students.length,
        newOrder
      });
      setStudentOrder(newOrder);
    }
  }, [students]);

  // 정렬된 학생 목록
  const sortedStudents = useMemo(() => {
    if (!students) return [];
    const sorted = [...students].sort((a, b) => {
      const indexA = studentOrder.indexOf(a.id);
      const indexB = studentOrder.indexOf(b.id);
      return indexA - indexB;
    });
    console.log('📋 Sorted students:', {
      originalCount: students.length,
      sortedCount: sorted.length,
      studentOrder: studentOrder.slice(0, 3), // 처음 3개만 로그
      sortedIds: sorted.slice(0, 3).map(s => s.id) // 처음 3개만 로그
    });
    return sorted;
  }, [students, studentOrder]);

  // 학생 추가 Mutation
  const addStudentMutation = useMutation({
    mutationFn: async (name: string) => {
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
          throw new Error("DEMO_BLOCKED"); // 특별한 에러로 표시
        }
      }
      return addStudent(classId, name);
    },
    onSuccess: (newStudent) => {
      queryClient.invalidateQueries({ queryKey: ['students', classId] });
      setNewStudentName('');
      // 🌟 데모 학급이 아닌 경우만 성공 메시지 표시
      if (classDetails && !isDemoClass(classDetails)) {
        toast.success(`'${newStudent.name}' 학생이 추가되었습니다.`);
      }
    },
    onError: (error) => {
      // 데모 블록 에러는 무시 (이미 메시지 표시됨)
      if (error instanceof Error && error.message === "DEMO_BLOCKED") {
        return;
      }
      toast.error(error instanceof Error ? error.message : '학생 추가 실패');
    },
  });

  // 학생 이름 수정 Mutation
  const updateStudentMutation = useMutation({
    mutationFn: async ({ studentId, newName }: { studentId: string; newName: string }) => {
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
      if (updatedStudent) {
        queryClient.invalidateQueries({ queryKey: ['students', classId] });
        // 🌟 데모 학급이 아닌 경우만 성공 메시지 표시
        if (classDetails && !isDemoClass(classDetails)) {
          toast.success(`'${updatedStudent.name}' 학생 이름이 수정되었습니다.`);
        }
      }
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "DEMO_BLOCKED") {
        return;
      }
      toast.error(error instanceof Error ? error.message : '학생 이름 수정 실패');
    },
  });

  // 학생 삭제 Mutation
  const deleteStudentMutation = useMutation({
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students', classId] });
      // 🌟 데모 학급이 아닌 경우만 성공 메시지 표시
      if (classDetails && !isDemoClass(classDetails)) {
        toast.success('학생이 삭제되었습니다.');
      }
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "DEMO_BLOCKED") {
        return;
      }
      toast.error(error instanceof Error ? error.message : '학생 삭제 실패');
    },
  });

  const handleAddStudent = () => {
    if (newStudentName.trim()) {
      addStudentMutation.mutate(newStudentName.trim());
    } else {
      toast.error('학생 이름을 입력해주세요.');
    }
  };

  const handleAddStudentKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleAddStudent();
    }
  };

  const handleUpdateStudent = async (id: string, newName: string) => {
    await updateStudentMutation.mutateAsync({ studentId: id, newName });
  };

  const handleDeleteStudent = async (id: string) => {
    await deleteStudentMutation.mutateAsync(id);
  };

  // 학생 상세 정보 모달 핸들러들
  const handleDetailClick = (student: Student) => {
    setSelectedStudent(student);
  };

  const handleDetailModalClose = () => {
    setSelectedStudent(null);
  };

  const handleStudentSave = (updatedStudent: StudentForClient) => {
    // 학생 목록 새로고침
    queryClient.invalidateQueries({ queryKey: ['students', classId] });
  };

  // 드래그 시작 핸들러
  const handleDragStart = (event: DragStartEvent) => {
    console.log('🚀 Drag started:', {
      activeId: event.active.id,
      studentOrder,
      sortedStudentsCount: sortedStudents.length
    });
    setActiveId(event.active.id as string);
  };

  // 드래그 종료 핸들러
  const handleDragEnd = async (event: DragEndEvent) => {
    console.log('🏁 Drag ended:', {
      activeId: event.active.id,
      overId: event.over?.id,
      hasOver: !!event.over,
      collisions: event.collisions
    });
    const { active, over } = event;
    setActiveId(null); // 🎯 항상 activeId 리셋
    
    if (over && active.id !== over.id) {
      console.log('✅ Drag successful - moving items');
      const oldIndex = studentOrder.indexOf(active.id as string);
      const newIndex = studentOrder.indexOf(over.id as string);
      
      console.log('📊 Index details:', { 
        oldIndex, 
        newIndex, 
        activeId: active.id, 
        overId: over.id,
        studentOrderLength: studentOrder.length
      });
      
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
        console.log('💾 Order saved successfully');
      } catch (error) {
        console.error('❌ Failed to update student order:', error);
        toast.error('학생 순서 저장에 실패했습니다.');
        // 에러 발생 시 이전 순서로 되돌리기
        setStudentOrder(studentOrder);
      }
    } else {
      console.log('⚠️ Drag failed - no valid drop target or same position');
      if (!over) {
        console.log('❌ No drop target found');
      } else if (active.id === over.id) {
        console.log('⚪ Same position - no change needed');
      }
    }
  };

  // 🎯 드래그 취소 핸들러 추가 (중요!)
  const handleDragCancel = () => {
    console.log('❌ Drag cancelled - resetting activeId');
    setActiveId(null); // 드래그 취소 시 activeId 리셋
  };

  const isLoading = isClassLoading || isStudentsLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center">
        <div className="text-center">
          <ArrowPathIcon className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-spin" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">로딩 중...</h2>
          <p className="text-gray-600">학생 정보를 불러오고 있습니다.</p>
        </div>
      </div>
    );
  }

  if (!classDetails) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center">
        <div className="text-center">
          <XMarkIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">오류가 발생했습니다</h2>
          <p className="text-gray-600 mb-4">학급 정보를 찾을 수 없습니다.</p>
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center space-x-2">
            <UserPlusIcon className="h-6 w-6 text-blue-600" />
            <span>학생 관리</span>
          </h1>
        </div>

        {/* 학급 정보 */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <UserPlusIcon className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-800">{classDetails.name} 학생 관리</h2>
              <p className="text-sm text-gray-600">학급 학생들의 정보를 관리하고 순서를 변경할 수 있습니다</p>
            </div>
          </div>
        </div>

        {/* 학생 추가 섹션 */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">새 학생 추가</h3>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <input
              type="text"
              value={newStudentName}
              onChange={(e) => setNewStudentName(e.target.value)}
              onKeyPress={handleAddStudentKeyPress}
              placeholder="학생 이름을 입력하세요"
              className="flex-grow p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black placeholder:text-gray-500"
            />
            <button
              onClick={handleAddStudent}
              disabled={addStudentMutation.isPending}
              className="flex items-center space-x-2 bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {addStudentMutation.isPending ? (
                <>
                  <ArrowPathIcon className="w-5 h-5 animate-spin" />
                  <span>추가 중...</span>
                </>
              ) : (
                <>
                  <UserPlusIcon className="w-5 h-5" />
                  <span>학생 추가</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 학생 목록 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-800">
              학생 목록 ({students?.length || 0}명)
            </h3>
            <div className="text-sm text-gray-500">
              드래그하여 순서를 변경할 수 있습니다
            </div>
          </div>
          
          {isStudentsError ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <XMarkIcon className="h-8 w-8 text-red-600" />
              </div>
              <p className="text-red-600 mb-4">학생 목록을 불러오는 중 오류가 발생했습니다</p>
              <button
                onClick={() => window.location.reload()}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                다시 시도
              </button>
            </div>
          ) : students && students.length > 0 ? (
            <div 
              ref={scrollContainerRef}
              className="space-y-3 overflow-y-auto max-h-[600px]" 
              style={{ 
                WebkitOverflowScrolling: 'touch',
                touchAction: activeId ? 'none' : 'pan-y',
                overflowY: 'auto',
              }}
            >
              <AnimatePresence mode="popLayout">
                <DndContext
                  id={`dnd-context-${classId}`}
                  sensors={sensors}
                  collisionDetection={rectIntersection}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragCancel={handleDragCancel}
                  modifiers={[]}
                >
                  <SortableContext
                    items={studentOrder}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-3">
                      {sortedStudents.map((student) => (
                        <SortableStudentItem
                          key={student.id}
                          student={student}
                          onUpdateStudent={handleUpdateStudent}
                          onDeleteStudent={handleDeleteStudent}
                          onDetailClick={handleDetailClick}
                          disabled={false}
                          activeId={activeId}
                        />
                      ))}
                    </div>
                  </SortableContext>
                  <DragOverlay 
                    adjustScale={false}
                    zIndex={1000}
                    dropAnimation={{
                      duration: 200,
                      easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
                    }}
                  >
                    {activeId && sortedStudents ? (() => {
                      const draggedStudent = sortedStudents.find(s => s.id === activeId);
                      return draggedStudent ? (
                        <StudentItem
                          student={draggedStudent}
                          onUpdateStudent={async () => {}}
                          onDeleteStudent={async () => {}}
                          onDetailClick={handleDetailClick}
                          isDragging={true}
                          disabled={false}
                          activeId={null}
                        />
                      ) : null;
                    })() : null}
                  </DragOverlay>
                </DndContext>
              </AnimatePresence>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <UserPlusIcon className="h-8 w-8 text-blue-600" />
              </div>
              <p className="text-gray-600 mb-4">아직 등록된 학생이 없습니다</p>
              <button
                onClick={() => {
                  const input = document.querySelector('input[placeholder="학생 이름을 입력하세요"]') as HTMLInputElement;
                  input?.focus();
                }}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                첫 번째 학생 추가하기
              </button>
            </div>
          )}
        </div>
      </div>

      {selectedStudent && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl">
            <StudentDetailForm
              studentId={selectedStudent.id}
              classId={classId}
              onClose={handleDetailModalClose}
              onSave={handleStudentSave}
            />
          </div>
        </div>
      )}
    </div>
  );
} 