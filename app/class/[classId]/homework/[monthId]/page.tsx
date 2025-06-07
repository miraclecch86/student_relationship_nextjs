'use client';

import React, { useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeftIcon,
  PlusIcon,
  XMarkIcon,
  TrashIcon,
  PencilIcon,
  ClipboardDocumentCheckIcon,
  BookOpenIcon,
  UserGroupIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

// 타입 정의
interface HomeworkMonth {
  id: string;
  class_id: string;
  month_year: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface Student {
  id: string;
  name: string;
  student_number: number;
  class_id: string;
}

interface HomeworkItem {
  id: string;
  homework_month_id: string;
  name: string;
  due_date?: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

interface HomeworkRecord {
  id: string;
  student_id: string;
  homework_item_id: string;
  is_submitted: boolean;
  created_at: string;
  updated_at: string;
}

// API 함수들
async function fetchHomeworkMonth(monthId: string): Promise<HomeworkMonth | null> {
  const { data, error } = await (supabase as any)
    .from('homework_months')
    .select('*')
    .eq('id', monthId)
    .single();
  
  if (error) {
    console.error('Error fetching homework month:', error);
    return null;
  }
  
  return data;
}

async function fetchStudents(classId: string): Promise<Student[]> {
  const { data, error } = await (supabase as any)
    .from('students')
    .select('*')
    .eq('class_id', classId)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Error fetching students:', error);
    return [];
  }

  return data || [];
}

async function fetchHomeworkItems(monthId: string): Promise<HomeworkItem[]> {
  const { data, error } = await (supabase as any)
    .from('homework_items')
    .select('*')
    .eq('homework_month_id', monthId)
    .order('order_index', { ascending: true });

  if (error) {
    console.error('Error fetching homework items:', error);
    return [];
  }

  return data || [];
}

async function fetchHomeworkRecords(monthId: string): Promise<HomeworkRecord[]> {
  const { data, error } = await (supabase as any)
    .from('homework_records')
    .select(`
      *,
      homework_items!inner(homework_month_id)
    `)
    .eq('homework_items.homework_month_id', monthId);

  if (error) {
    console.error('Error fetching homework records:', error);
    return [];
  }

  return data || [];
}

async function addHomeworkItem(monthId: string, name: string, dueDate?: string): Promise<HomeworkItem> {
  // 현재 최대 order_index 조회
  const { data: maxOrderData } = await (supabase as any)
    .from('homework_items')
    .select('order_index')
    .eq('homework_month_id', monthId)
    .order('order_index', { ascending: false })
    .limit(1);

  const maxOrder = maxOrderData?.[0]?.order_index || 0;

  const insertData: any = {
    homework_month_id: monthId,
    name: name.trim(),
    order_index: maxOrder + 1
  };

  if (dueDate) {
    insertData.due_date = dueDate;
  }

  const { data, error } = await (supabase as any)
    .from('homework_items')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    throw new Error('과제 항목 추가 중 오류가 발생했습니다.');
  }

  return data;
}

async function updateHomeworkRecord(studentId: string, homeworkItemId: string, isSubmitted: boolean): Promise<void> {
  const { data: existingRecord } = await (supabase as any)
    .from('homework_records')
    .select('id')
    .eq('student_id', studentId)
    .eq('homework_item_id', homeworkItemId)
    .single();

  if (existingRecord) {
    // 기존 레코드 업데이트
    const { error } = await (supabase as any)
      .from('homework_records')
      .update({ is_submitted: isSubmitted })
      .eq('id', existingRecord.id);

    if (error) {
      throw new Error('과제 기록 수정 중 오류가 발생했습니다.');
    }
  } else {
    // 새 레코드 생성
    const { error } = await (supabase as any)
      .from('homework_records')
      .insert({
        student_id: studentId,
        homework_item_id: homeworkItemId,
        is_submitted: isSubmitted
      });

    if (error) {
      throw new Error('과제 기록 생성 중 오류가 발생했습니다.');
    }
  }
}

async function updateHomeworkItem(itemId: string, name: string, dueDate?: string): Promise<HomeworkItem> {
  const updateData: any = {
    name: name.trim()
  };

  if (dueDate) {
    updateData.due_date = dueDate;
  } else {
    updateData.due_date = null;
  }

  const { data, error } = await (supabase as any)
    .from('homework_items')
    .update(updateData)
    .eq('id', itemId)
    .select()
    .single();

  if (error) {
    throw new Error('과제 항목 수정 중 오류가 발생했습니다.');
  }

  return data;
}

async function deleteHomeworkItem(itemId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('homework_items')
    .delete()
    .eq('id', itemId);

  if (error) {
    throw new Error('과제 항목 삭제 중 오류가 발생했습니다.');
  }
}

export default function MonthHomeworkPage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  
  const monthId = params.monthId as string;
  const classId = params.classId as string;

  // 상태
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemDueDate, setNewItemDueDate] = useState('');
  
  // 수정 관련 상태
  const [isEditItemModalOpen, setIsEditItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<HomeworkItem | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemDueDate, setEditItemDueDate] = useState('');

  // 데이터 조회
  const { data: homeworkMonth } = useQuery({
    queryKey: ['homeworkMonth', monthId],
    queryFn: () => fetchHomeworkMonth(monthId),
    enabled: !!monthId,
  });

  const { data: students = [] } = useQuery<Student[]>({
    queryKey: ['students', classId],
    queryFn: () => fetchStudents(classId),
    enabled: !!classId,
  });

  const { data: homeworkItems = [] } = useQuery<HomeworkItem[]>({
    queryKey: ['homeworkItems', monthId],
    queryFn: () => fetchHomeworkItems(monthId),
    enabled: !!monthId,
  });

  const { data: homeworkRecords = [] } = useQuery<HomeworkRecord[]>({
    queryKey: ['homeworkRecords', monthId],
    queryFn: () => fetchHomeworkRecords(monthId),
    enabled: !!monthId,
  });

  // 과제 항목 추가 뮤테이션
  const addItemMutation = useMutation({
    mutationFn: ({ monthId, name, dueDate }: { monthId: string; name: string; dueDate?: string }) => 
      addHomeworkItem(monthId, name, dueDate),
    onSuccess: () => {
      toast.success('과제 항목이 추가되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['homeworkItems'] });
      setNewItemName('');
      setNewItemDueDate('');
      setIsItemModalOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // 과제 기록 업데이트 뮤테이션
  const updateRecordMutation = useMutation({
    mutationFn: ({ studentId, homeworkItemId, isSubmitted }: { 
      studentId: string; 
      homeworkItemId: string; 
      isSubmitted: boolean;
    }) => updateHomeworkRecord(studentId, homeworkItemId, isSubmitted),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homeworkRecords'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // 과제 항목 수정 뮤테이션
  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, name, dueDate }: { itemId: string; name: string; dueDate?: string }) => 
      updateHomeworkItem(itemId, name, dueDate),
    onSuccess: () => {
      toast.success('과제 항목이 수정되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['homeworkItems'] });
      setEditItemName('');
      setEditItemDueDate('');
      setEditingItem(null);
      setIsEditItemModalOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // 과제 항목 삭제 뮤테이션
  const deleteItemMutation = useMutation({
    mutationFn: deleteHomeworkItem,
    onSuccess: () => {
      toast.success('과제 항목이 삭제되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['homeworkItems'] });
      queryClient.invalidateQueries({ queryKey: ['homeworkRecords'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // 특정 학생과 과제 항목의 제출 상태 가져오기
  const getSubmissionStatus = useCallback((studentId: string, itemId: string): boolean => {
    const record = homeworkRecords.find(
      r => r.student_id === studentId && r.homework_item_id === itemId
    );
    return record?.is_submitted || false;
  }, [homeworkRecords]);

  // 학생별 제출율 계산
  const getSubmissionRate = useCallback((studentId: string): number => {
    if (homeworkItems.length === 0) return 0;
    
    const submittedCount = homeworkItems.filter(item => 
      getSubmissionStatus(studentId, item.id)
    ).length;
    
    return Math.round((submittedCount / homeworkItems.length) * 100);
  }, [homeworkItems, getSubmissionStatus]);

  // 컬럼(과제 항목) 완료 여부 확인
  const isColumnComplete = useCallback((itemId: string): boolean => {
    if (students.length === 0) return false;
    
    // 해당 과제 항목에 대해 모든 학생이 제출했는지 확인
    const submittedCount = students.filter(student => 
      getSubmissionStatus(student.id, itemId)
    ).length;
    
    return submittedCount === students.length;
  }, [students, getSubmissionStatus]);

  // 과제별(컬럼별) 제출율 계산
  const getColumnSubmissionRate = useCallback((itemId: string): number => {
    if (students.length === 0) return 0;
    
    const submittedCount = students.filter(student => 
      getSubmissionStatus(student.id, itemId)
    ).length;
    
    return Math.round((submittedCount / students.length) * 100);
  }, [students, getSubmissionStatus]);

  // 과제 항목 추가
  const handleAddItem = () => {
    if (!newItemName.trim()) {
      toast.error('과제 항목명을 입력해주세요.');
      return;
    }

    addItemMutation.mutate({ 
      monthId, 
      name: newItemName, 
      dueDate: newItemDueDate || undefined 
    });
  };

  // 체크박스 토글
  const handleToggleSubmission = (studentId: string, itemId: string) => {
    const currentStatus = getSubmissionStatus(studentId, itemId);
    updateRecordMutation.mutate({ 
      studentId, 
      homeworkItemId: itemId, 
      isSubmitted: !currentStatus 
    });
  };

  // 과제 항목 수정
  const handleEditItem = (item: HomeworkItem) => {
    setEditingItem(item);
    setEditItemName(item.name);
    setEditItemDueDate(item.due_date || '');
    setIsEditItemModalOpen(true);
  };

  // 과제 항목 수정 저장
  const handleUpdateItem = () => {
    if (!editItemName.trim()) {
      toast.error('과제 항목명을 입력해주세요.');
      return;
    }
    if (!editingItem) return;

    updateItemMutation.mutate({ 
      itemId: editingItem.id,
      name: editItemName, 
      dueDate: editItemDueDate || undefined 
    });
  };

  // 과제 항목 삭제
  const handleDeleteItem = (itemId: string) => {
    if (confirm('정말로 이 과제 항목을 삭제하시겠습니까? 관련된 모든 제출 기록이 삭제됩니다.')) {
      deleteItemMutation.mutate(itemId);
    }
  };

  if (!homeworkMonth) {
    return <div className="flex justify-center items-center h-screen">로딩 중...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-full mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => router.back()}
              className="flex items-center px-3 py-1.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors shadow-sm"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-1.5" />
              <span className="text-sm">목록으로</span>
            </button>
            <div className="h-5 w-px bg-gray-300" />
            <h1 className="text-xl font-bold text-gray-800 flex items-center space-x-2">
              <ClipboardDocumentCheckIcon className="h-6 w-6 text-amber-600" />
              <span>{homeworkMonth.name}</span>
            </h1>
          </div>
          <button
            onClick={() => setIsItemModalOpen(true)}
            className="flex items-center px-3 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors shadow-sm"
          >
            <PlusIcon className="h-4 w-4 mr-1.5" />
            <span className="text-sm">과제 추가</span>
          </button>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
            <div className="flex items-center space-x-2">
              <div className="bg-blue-100 p-1.5 rounded">
                <UserGroupIcon className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <div className="text-sm font-bold text-gray-900">{students.length}</div>
                <div className="text-xs text-gray-600">총 학생</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
            <div className="flex items-center space-x-2">
              <div className="bg-amber-100 p-1.5 rounded">
                <BookOpenIcon className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <div className="text-sm font-bold text-gray-900">{homeworkItems.length}</div>
                <div className="text-xs text-gray-600">과제 항목</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
            <div className="flex items-center space-x-2">
              <div className="bg-green-100 p-1.5 rounded">
                <CheckIcon className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <div className="text-sm font-bold text-gray-900">
                  {homeworkItems.length > 0 && students.length > 0 
                    ? Math.round(students.reduce((acc, student) => acc + getSubmissionRate(student.id), 0) / students.length)
                    : 0}%
                </div>
                <div className="text-xs text-gray-600">평균 제출율</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
            <div className="flex items-center space-x-2">
              <div className="bg-purple-100 p-1.5 rounded">
                <ClipboardDocumentCheckIcon className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <div className="text-sm font-bold text-gray-900">
                  {homeworkItems.length * students.length}
                </div>
                <div className="text-xs text-gray-600">전체 제출 건수</div>
              </div>
            </div>
          </div>
        </div>

        {/* 과제 체크 테이블 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-3 bg-gradient-to-r from-amber-500 to-orange-500">
            <h2 className="text-sm font-semibold text-white flex items-center space-x-2">
              <ClipboardDocumentCheckIcon className="h-5 w-5" />
              <span>과제 제출 현황</span>
            </h2>
          </div>

          {students.length > 0 && homeworkItems.length > 0 ? (
            <div className="overflow-x-auto">
              <div style={{ minWidth: `${120 + homeworkItems.length * 100}px` }}>
                {/* 테이블 헤더 */}
                <div className="bg-gray-50 border-b border-gray-200 p-1.5">
                  <div className="grid gap-1.5" style={{ gridTemplateColumns: `120px repeat(${homeworkItems.length}, 100px)` }}>
                    <div className="text-center">
                      <span className="font-medium text-gray-900 text-xs">학생명</span>
                    </div>
                    {homeworkItems.map((item) => {
                      const isComplete = isColumnComplete(item.id);
                      return (
                      <div key={item.id} className="text-center">
                        <div className={`
                          rounded-md p-1.5 shadow-sm border group hover:shadow-md transition-all
                          ${isComplete 
                            ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200' 
                            : 'bg-white border-amber-200'
                          }
                        `}>
                          <div className="mb-1 flex items-center justify-center space-x-1">
                            {isComplete && (
                              <CheckIcon className="w-3 h-3 text-green-600" />
                            )}
                            <span className={`font-medium text-xs ${isComplete ? 'text-green-800' : 'text-gray-900'}`}>
                              {item.name}
                            </span>
                          </div>
                          {item.due_date ? (
                            <div className="relative flex items-center justify-center">
                              <div className="text-xs text-gray-500 text-center">
                                {new Date(item.due_date).toLocaleDateString('ko-KR', { 
                                  month: 'short', 
                                  day: 'numeric' 
                                })}
                              </div>
                              <div className="absolute right-0 flex space-x-0.5">
                                <button
                                  onClick={() => handleEditItem(item)}
                                  className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
                                  title="항목 수정"
                                >
                                  <PencilIcon className="h-2 w-2" />
                                </button>
                                <button
                                  onClick={() => handleDeleteItem(item.id)}
                                  className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                                  title="항목 삭제"
                                >
                                  <TrashIcon className="h-2 w-2" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="relative flex items-center justify-center h-3">
                              <div className="absolute right-0 flex space-x-0.5">
                                <button
                                  onClick={() => handleEditItem(item)}
                                  className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
                                  title="항목 수정"
                                >
                                  <PencilIcon className="h-2 w-2" />
                                </button>
                                <button
                                  onClick={() => handleDeleteItem(item.id)}
                                  className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                                  title="항목 삭제"
                                >
                                  <TrashIcon className="h-2 w-2" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>

                {/* 테이블 본문 */}
                <div className="divide-y divide-gray-200">
                  {students.map((student) => (
                    <div key={student.id} className="p-1.5 hover:bg-gray-50 transition-colors">
                      <div className="grid gap-1.5" style={{ gridTemplateColumns: `120px repeat(${homeworkItems.length}, 100px)` }}>
                        <div className="flex items-center space-x-2 px-1">
                          <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-xs font-medium">
                              {student.name.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 text-xs">{student.name}</div>
                            <div className="text-xs text-gray-500">
                              제출율: {getSubmissionRate(student.id)}%
                            </div>
                          </div>
                        </div>
                        {homeworkItems.map((item) => (
                          <div key={item.id} className="flex items-center justify-center">
                            <button
                              onClick={() => handleToggleSubmission(student.id, item.id)}
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                getSubmissionStatus(student.id, item.id)
                                  ? 'bg-green-500 border-green-500 text-white'
                                  : 'bg-white border-gray-300 hover:border-gray-400'
                              }`}
                            >
                              {getSubmissionStatus(student.id, item.id) && (
                                <CheckIcon className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  
                  {/* 과제별 제출 완료율 표시 행 */}
                  {homeworkItems.length > 0 && (
                    <div className="border-t-2 border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-1.5">
                      <div className="grid gap-1.5" style={{ gridTemplateColumns: `120px repeat(${homeworkItems.length}, 100px)` }}>
                        <div className="flex items-center px-1">
                          <div className="flex items-center space-x-1">
                            <svg className="w-3 h-3 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            <span className="font-medium text-amber-800 text-xs">과제별 완료율</span>
                          </div>
                        </div>
                        {homeworkItems.map((item) => {
                          const rate = getColumnSubmissionRate(item.id);
                          const isComplete = isColumnComplete(item.id);
                          return (
                            <div key={`rate-${item.id}`} className="flex items-center justify-center">
                              <div className={`
                                px-2 py-1 rounded-md text-xs font-medium
                                ${isComplete 
                                  ? 'bg-green-100 text-green-800 border border-green-200' 
                                  : rate >= 80 
                                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                    : rate >= 60
                                      ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                                      : 'bg-red-100 text-red-800 border border-red-200'
                                }
                              `}>
                                {rate}%
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center">
              <ClipboardDocumentCheckIcon className="h-10 w-10 text-gray-400 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-gray-800 mb-2">
                {students.length === 0 ? '학생이 없습니다' : '과제 항목이 없습니다'}
              </h3>
              <p className="text-xs text-gray-600 mb-4">
                {students.length === 0 
                  ? '먼저 학생을 추가해주세요.' 
                  : '첫 번째 과제 항목을 추가해보세요.'
                }
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 과제 항목 추가 모달 */}
      <AnimatePresence>
        {isItemModalOpen && (
          <div className="fixed inset-0 bg-transparent flex items-center justify-center z-50">
            <motion.div
              className="bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-2xl border border-gray-200"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">새 과제 추가</h3>
                <button
                  onClick={() => setIsItemModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    과제명
                  </label>
                  <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                    placeholder="예: 수학 문제집 p.23-25"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    제출 마감일 (선택사항)
                  </label>
                  <input
                    type="date"
                    value={newItemDueDate}
                    onChange={(e) => setNewItemDueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-gray-900"
                  />
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => setIsItemModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleAddItem}
                  disabled={addItemMutation.isPending}
                  className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600 transition-colors disabled:opacity-50"
                >
                  {addItemMutation.isPending ? '추가 중...' : '추가'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 과제 항목 수정 모달 */}
      <AnimatePresence>
        {isEditItemModalOpen && (
          <div className="fixed inset-0 bg-transparent flex items-center justify-center z-50">
            <motion.div
              className="bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-2xl border border-gray-200"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">과제 수정</h3>
                <button
                  onClick={() => setIsEditItemModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    과제명
                  </label>
                  <input
                    type="text"
                    value={editItemName}
                    onChange={(e) => setEditItemName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                    placeholder="예: 수학 문제집 p.23-25"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    제출 마감일 (선택사항)
                  </label>
                  <input
                    type="date"
                    value={editItemDueDate}
                    onChange={(e) => setEditItemDueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  />
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => setIsEditItemModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleUpdateItem}
                  disabled={updateItemMutation.isPending}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  {updateItemMutation.isPending ? '수정 중...' : '수정'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
} 