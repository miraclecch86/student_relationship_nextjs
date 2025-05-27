'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, Student, Class } from '@/lib/supabase';
import {
  UserPlusIcon,
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  ArrowPathIcon,
  Bars3Icon,
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import ConfirmModal from '@/components/ConfirmModal';
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
  verticalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { arrayMove } from '@dnd-kit/sortable';

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

// 학생 목록 조회 함수
async function fetchStudents(classId: string): Promise<Student[]> {
  const { data, error } = await supabase
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
  const { data: existingStudent, error: checkError } = await supabase
    .from('students')
    .select('id')
    .eq('class_id', classId)
    .eq('name', name.trim())
    .maybeSingle();

  if (checkError) throw new Error(`학생 확인 중 오류: ${checkError.message}`);
  if (existingStudent) throw new Error(`이미 '${name.trim()}' 학생이 존재합니다.`);

  const { data, error } = await supabase
    .from('students')
    .insert([{ name: name.trim(), class_id: classId }])
    .select()
    .single();
    
  if (error) throw new Error(`학생 추가 실패: ${error.message}`);
  return data;
}

// 학생 이름 수정 함수
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

// 학생 순서 업데이트 함수
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

// 학생 삭제 함수
async function deleteStudent(studentId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_student', { student_id_to_delete: studentId });

  if (error) {
    console.error('RPC delete_student error:', error);
    throw new Error(`학생 삭제 실패: ${error.message}`);
  }
}

// 학생 아이템 컴포넌트
interface StudentItemProps {
  student: Student;
  onUpdateStudent: (id: string, newName: string) => Promise<void>;
  onDeleteStudent: (id: string) => Promise<void>;
  listeners?: any;
  isDragging?: boolean;
  disabled?: boolean;
}

function StudentItem({ 
  student, 
  onUpdateStudent, 
  onDeleteStudent, 
  listeners, 
  isDragging = false,
  disabled = false
}: StudentItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(student.name);
  const [isDeleting, setIsDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

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
      await onUpdateStudent(student.id, editName);
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

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleting(true);
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
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ type: "tween", duration: 0.2 }}
        className={`bg-white rounded-lg shadow-sm p-4 flex items-center justify-between touch-none will-change-transform ${
          isDragging ? 'opacity-100 scale-100 shadow-lg bg-white' : ''
        } ${disabled ? 'pointer-events-none' : ''}`}
        style={{ transformOrigin: '0 0' }}
        {...listeners}
      >
        <div className="flex items-center gap-3 flex-grow">
          <div className={`p-1.5 hover:bg-gray-100 rounded cursor-grab active:cursor-grabbing flex-shrink-0 drag-handle ${disabled ? 'opacity-50' : ''}`}>
            <Bars3Icon className="w-5 h-5 text-gray-400" />
          </div>
          
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="flex-grow p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-300 text-black"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="font-semibold text-gray-900">{student.name}</span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={handleSaveClick}
                className="p-1.5 bg-emerald-100 text-emerald-600 rounded-full hover:bg-emerald-200"
              >
                <CheckIcon className="w-5 h-5" />
              </button>
              <button
                onClick={handleCancelClick}
                className="p-1.5 bg-red-100 text-red-600 rounded-full hover:bg-red-200"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleUpdateClick}
                className="p-1.5 bg-indigo-100 text-indigo-600 rounded-full hover:bg-indigo-200"
              >
                <PencilIcon className="w-5 h-5" />
              </button>
              <button
                onClick={handleDeleteClick}
                className="p-1.5 bg-red-100 text-red-600 rounded-full hover:bg-red-200"
              >
                <TrashIcon className="w-5 h-5" />
              </button>
            </>
          )}
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

// SortableStudentItem 컴포넌트
function SortableStudentItem(props: {
  student: Student;
  onUpdateStudent: (id: string, newName: string) => Promise<void>;
  onDeleteStudent: (id: string) => Promise<void>;
  disabled?: boolean;
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
      duration: 100,
      easing: 'cubic-bezier(0, 0, 0.2, 1)',
    }
  });

  // 수직 방향으로만 이동하도록 제한
  const constrainedTransform = transform ? {
    ...transform,
    x: 0 // x축 이동을 0으로 고정
  } : transform;

  const style = {
    transform: CSS.Transform.toString(constrainedTransform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    position: 'relative' as const,
    opacity: isDragging ? 0.7 : 1,
    willChange: 'transform',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <StudentItem
        student={props.student}
        onUpdateStudent={props.onUpdateStudent}
        onDeleteStudent={props.onDeleteStudent}
        listeners={listeners}
        isDragging={isDragging}
        disabled={props.disabled}
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
  const [isTouchScrolling, setIsTouchScrolling] = useState(false);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 센서 설정
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,        // 드래그를 위한 최소 이동 거리 (3에서 8로 증가)
        delay: 250,         // 드래그 활성화 전 지연 시간 (100에서 250ms로 증가)
        tolerance: 5,       // 허용 오차 범위 (1에서 5로 증가)
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
      setStudentOrder(students.map(student => student.id));
    }
  }, [students]);

  // 정렬된 학생 목록
  const sortedStudents = useMemo(() => {
    if (!students) return [];
    return [...students].sort((a, b) => {
      const indexA = studentOrder.indexOf(a.id);
      const indexB = studentOrder.indexOf(b.id);
      return indexA - indexB;
    });
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

  // 드래그 시작 핸들러
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  // 드래그 종료 핸들러
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

  // 터치 이벤트 핸들러
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setTouchStartY(e.touches[0].clientY);
      setIsTouchScrolling(false);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY === null || !scrollContainerRef.current || e.touches.length !== 1) return;
    
    const touchY = e.touches[0].clientY;
    const diff = touchStartY - touchY;
    
    // 초기 터치 움직임이 작으면 스크롤이 아닌 드래그로 간주
    if (Math.abs(diff) < 2) return;
    
    // 스크롤 의도 감지 - 수직 움직임이 큰 경우
    if (Math.abs(diff) > 2 && !isTouchScrolling) {
      setIsTouchScrolling(true);
    }
    
    if (isTouchScrolling) {
      scrollContainerRef.current.scrollTop += diff;
      setTouchStartY(touchY);
    }
  };

  const handleTouchEnd = () => {
    setTouchStartY(null);
    // 터치 종료 후 바로 스크롤 상태 초기화
    setIsTouchScrolling(false);
  };

  const isLoading = isClassLoading || isStudentsLoading;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100">
        <ArrowPathIcon className="w-8 h-8 animate-spin text-indigo-500" />
        <div className="text-xl text-indigo-500 ml-3">로딩 중...</div>
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

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-screen-lg mx-auto px-6 py-10">
        {/* 헤더 */}
        <header className="mb-10 flex justify-between items-center bg-white p-5 rounded-lg shadow-md">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(`/class/${classId}/dashboard`)}
              className="px-4 py-2 text-sm bg-indigo-500 text-white rounded-md hover:bg-indigo-600 shadow focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-1 transition-all duration-200 flex items-center"
            >
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              대시보드
            </button>
            <h1 className="text-2xl font-bold text-black">{classDetails.name} 학생 목록</h1>
          </div>
          <button
            onClick={handleAddStudent}
            disabled={addStudentMutation.isPending}
            className="px-4 py-2 text-sm bg-indigo-500 text-white rounded-md hover:bg-indigo-600 shadow focus:outline-none focus:ring-2 focus:ring-indigo-300 flex items-center disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {addStudentMutation.isPending ? (
              <>
                <ArrowPathIcon className="w-4 h-4 animate-spin mr-2" />
                추가 중...
              </>
            ) : (
              <>
                <UserPlusIcon className="w-4 h-4 mr-2" />
                학생 추가
              </>
            )}
          </button>
        </header>

        {/* 학생 추가 입력 필드는 현재 위치 유지 */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex gap-4">
            <input
              type="text"
              value={newStudentName}
              onChange={(e) => setNewStudentName(e.target.value)}
              onKeyPress={handleAddStudentKeyPress}
              placeholder="학생 이름 입력 후, 헤더의 '학생 추가' 버튼 클릭"
              className="flex-grow px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-300 text-black placeholder:text-gray-500"
            />
          </div>
        </div>

        {/* 학생 목록 */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            학생 목록 ({students?.length || 0}명)
          </h2>
          
          {isStudentsError ? (
            <div className="bg-red-100 text-red-600 p-4 rounded-lg">
              학생 목록을 불러오는 중 오류가 발생했습니다.
            </div>
          ) : students && students.length > 0 ? (
            <div 
              ref={scrollContainerRef}
              className="space-y-3 overflow-y-auto max-h-[600px] pr-2" 
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <AnimatePresence mode="popLayout">
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
                    <div className="space-y-3">
                      {sortedStudents.map((student) => (
                        <SortableStudentItem
                          key={student.id}
                          student={student}
                          onUpdateStudent={handleUpdateStudent}
                          onDeleteStudent={handleDeleteStudent}
                          disabled={isTouchScrolling}
                        />
                      ))}
                    </div>
                  </SortableContext>
                  <DragOverlay 
                    adjustScale={false}
                    zIndex={100}
                    dropAnimation={{
                      duration: 100,
                      easing: 'cubic-bezier(0, 0, 0.2, 1)',
                    }}
                  >
                    {activeId && students ? (
                      <StudentItem
                        student={students.find(s => s.id === activeId)!}
                        onUpdateStudent={async () => {}}
                        onDeleteStudent={async () => {}}
                        isDragging={true}
                      />
                    ) : null}
                  </DragOverlay>
                </DndContext>
              </AnimatePresence>
            </div>
          ) : (
            <div className="bg-gray-100 text-gray-600 p-8 rounded-lg text-center">
              <p className="mb-4">등록된 학생이 없습니다.</p>
              <p className="text-sm">위의 '학생 추가' 버튼을 눌러 새 학생을 추가해보세요.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 