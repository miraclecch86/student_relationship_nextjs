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
  ChartBarIcon,
  BookOpenIcon,
  DocumentArrowDownIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

// 타입 정의
interface Subject {
  id: string;
  class_id: string;
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

interface AssessmentItem {
  id: string;
  subject_id: string;
  name: string;
  assessment_date?: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

interface AssessmentRecord {
  id: string;
  student_id: string;
  assessment_item_id: string;
  score: string;
  created_at: string;
  updated_at: string;
}

// API 함수들
async function fetchSubject(subjectId: string): Promise<Subject | null> {
  const { data, error } = await (supabase as any)
    .from('subjects')
    .select('*')
    .eq('id', subjectId)
    .single();
  
  if (error) {
    console.error('Error fetching subject:', error);
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

async function fetchAssessmentItems(subjectId: string): Promise<AssessmentItem[]> {
  const { data, error } = await (supabase as any)
    .from('assessment_items')
    .select('*')
    .eq('subject_id', subjectId)
    .order('order_index', { ascending: true });

  if (error) {
    console.error('Error fetching assessment items:', error);
    return [];
  }

  return data || [];
}

async function fetchAssessmentRecords(subjectId: string): Promise<AssessmentRecord[]> {
  const { data, error } = await (supabase as any)
    .from('assessment_records')
    .select(`
      *,
      assessment_items!inner(subject_id)
    `)
    .eq('assessment_items.subject_id', subjectId);

  if (error) {
    console.error('Error fetching assessment records:', error);
    return [];
  }

  return data || [];
}

async function addAssessmentItem(subjectId: string, name: string, assessmentDate?: string): Promise<AssessmentItem> {
  // 현재 최대 order_index 조회
  const { data: maxOrderData } = await (supabase as any)
    .from('assessment_items')
    .select('order_index')
    .eq('subject_id', subjectId)
    .order('order_index', { ascending: false })
    .limit(1);

  const maxOrder = maxOrderData?.[0]?.order_index || 0;

  const insertData: any = {
    subject_id: subjectId,
    name: name.trim(),
    order_index: maxOrder + 1
  };

  if (assessmentDate) {
    insertData.assessment_date = assessmentDate;
  }

  const { data, error } = await (supabase as any)
    .from('assessment_items')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    throw new Error('평가 항목 추가 중 오류가 발생했습니다.');
  }

  return data;
}

async function updateAssessmentRecord(studentId: string, assessmentItemId: string, score: string): Promise<void> {
  const { data: existingRecord } = await (supabase as any)
    .from('assessment_records')
    .select('id')
    .eq('student_id', studentId)
    .eq('assessment_item_id', assessmentItemId)
    .single();

  if (existingRecord) {
    // 기존 레코드 업데이트
    const { error } = await (supabase as any)
      .from('assessment_records')
      .update({ score: score })
      .eq('id', existingRecord.id);

    if (error) {
      throw new Error('평가 기록 수정 중 오류가 발생했습니다.');
    }
  } else {
    // 새 레코드 생성
    const { error } = await (supabase as any)
      .from('assessment_records')
      .insert({
        student_id: studentId,
        assessment_item_id: assessmentItemId,
        score: score
      });

    if (error) {
      throw new Error('평가 기록 생성 중 오류가 발생했습니다.');
    }
  }
}

async function updateAssessmentItem(assessmentItemId: string, name: string, assessmentDate?: string): Promise<AssessmentItem> {
  const updateData: any = {
    name: name.trim()
  };

  if (assessmentDate) {
    updateData.assessment_date = assessmentDate;
  } else {
    updateData.assessment_date = null;
  }

  const { data, error } = await (supabase as any)
    .from('assessment_items')
    .update(updateData)
    .eq('id', assessmentItemId)
    .select()
    .single();

  if (error) {
    throw new Error('평가 항목 수정 중 오류가 발생했습니다.');
  }

  return data;
}

async function deleteAssessmentItem(assessmentItemId: string): Promise<void> {
  // 먼저 관련 평가 기록들 삭제
  await (supabase as any)
    .from('assessment_records')
    .delete()
    .eq('assessment_item_id', assessmentItemId);

  // 평가 항목 삭제
  const { error } = await (supabase as any)
    .from('assessment_items')
    .delete()
    .eq('id', assessmentItemId);

  if (error) {
    throw new Error('평가 항목 삭제 중 오류가 발생했습니다.');
  }
}

export default function SubjectAssessmentPage() {
  const router = useRouter();
  const params = useParams();
  const classId = params.classId as string;
  const subjectId = params.subjectId as string;
  const queryClient = useQueryClient();

  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemDate, setNewItemDate] = useState('');
  const [editingCell, setEditingCell] = useState<{studentId: string, itemId: string} | null>(null);
  const [editingValues, setEditingValues] = useState<{score: string}>({score: ''});
  
  // 평가 항목 편집 관련 상태
  const [isEditItemModalOpen, setIsEditItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AssessmentItem | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemDate, setEditItemDate] = useState('');

  // 데이터 조회
  const { data: subject } = useQuery({
    queryKey: ['subject', subjectId],
    queryFn: () => fetchSubject(subjectId),
    enabled: !!subjectId,
  });

  const { data: students = [] } = useQuery<Student[]>({
    queryKey: ['students', classId],
    queryFn: () => fetchStudents(classId),
    enabled: !!classId,
  });

  const { data: assessmentItems = [] } = useQuery<AssessmentItem[]>({
    queryKey: ['assessmentItems', subjectId],
    queryFn: () => fetchAssessmentItems(subjectId),
    enabled: !!subjectId,
  });

  const { data: assessmentRecords = [] } = useQuery<AssessmentRecord[]>({
    queryKey: ['assessmentRecords', subjectId],
    queryFn: () => fetchAssessmentRecords(subjectId),
    enabled: !!subjectId,
  });

  // 평가 항목 추가 뮤테이션
  const addItemMutation = useMutation({
    mutationFn: ({ subjectId, name, assessmentDate }: { subjectId: string; name: string; assessmentDate?: string }) => 
      addAssessmentItem(subjectId, name, assessmentDate),
    onSuccess: () => {
      toast.success('평가 항목이 추가되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['assessmentItems'] });
      setNewItemName('');
      setNewItemDate('');
      setIsItemModalOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // 평가 기록 업데이트 뮤테이션
  const updateRecordMutation = useMutation({
    mutationFn: ({ studentId, assessmentItemId, score }: { 
      studentId: string; 
      assessmentItemId: string; 
      score: string; 
    }) => updateAssessmentRecord(studentId, assessmentItemId, score),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessmentRecords'] });
      setEditingCell(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // 평가 항목 수정 뮤테이션
  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, name, assessmentDate }: { itemId: string; name: string; assessmentDate?: string }) => 
      updateAssessmentItem(itemId, name, assessmentDate),
    onSuccess: () => {
      toast.success('평가 항목이 수정되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['assessmentItems'] });
      setEditItemName('');
      setEditItemDate('');
      setEditingItem(null);
      setIsEditItemModalOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // 평가 항목 삭제 뮤테이션
  const deleteItemMutation = useMutation({
    mutationFn: deleteAssessmentItem,
    onSuccess: () => {
      toast.success('평가 항목이 삭제되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['assessmentItems'] });
      queryClient.invalidateQueries({ queryKey: ['assessmentRecords'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });



  // 특정 학생과 평가 항목의 점수 가져오기
  const getScoreData = useCallback((studentId: string, itemId: string): {score: string} => {
    const record = assessmentRecords.find(
      r => r.student_id === studentId && r.assessment_item_id === itemId
    );
    
    if (!record?.score) {
      return { score: '' };
    }
    
    // JSON 형태로 저장된 경우
    try {
      const parsed = JSON.parse(record.score);
      return {
        score: parsed.score || ''
      };
    } catch {
      // 기존 단순 텍스트 형태인 경우
      return { score: record.score };
    }
  }, [assessmentRecords]);

  // 평가 항목 추가
  const handleAddItem = () => {
    if (!newItemName.trim()) {
      toast.error('평가 항목명을 입력해주세요.');
      return;
    }

    addItemMutation.mutate({ 
      subjectId, 
      name: newItemName, 
      assessmentDate: newItemDate || undefined 
    });
  };

  // 점수 업데이트
  const handleScoreUpdate = (studentId: string, itemId: string, scoreData: {score: string}) => {
    updateRecordMutation.mutate({ studentId, assessmentItemId: itemId, score: scoreData.score });
  };

  // 평가 항목 편집
  const handleEditItem = (item: AssessmentItem) => {
    setEditingItem(item);
    setEditItemName(item.name);
    setEditItemDate(item.assessment_date || '');
    setIsEditItemModalOpen(true);
  };

  // 평가 항목 수정 저장
  const handleUpdateItem = () => {
    if (!editItemName.trim()) {
      toast.error('평가 항목명을 입력해주세요.');
      return;
    }
    if (!editingItem) return;

    updateItemMutation.mutate({ 
      itemId: editingItem.id,
      name: editItemName, 
      assessmentDate: editItemDate || undefined 
    });
  };

  // 평가 항목 삭제
  const handleDeleteItem = (itemId: string) => {
    if (confirm('정말로 이 평가 항목을 삭제하시겠습니까? 관련된 모든 평가 기록이 삭제됩니다.')) {
      deleteItemMutation.mutate(itemId);
    }
  };

  // 엑셀 내보내기
  const exportToExcel = () => {
    if (!subject || students.length === 0) {
      toast.error('내보낼 데이터가 없습니다.');
      return;
    }

    const headers = ['이름', ...assessmentItems.map(item => item.name)];
    const data = students.map(student => [
      student.name,
      ...assessmentItems.map(item => getScoreData(student.id, item.id).score)
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, subject.name);
    
    const fileName = `${subject.name}_평가기록_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    toast.success('엑셀 파일로 내보내기 완료!');
  };

  if (!subject) {
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
              className="flex items-center px-3 py-1.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors shadow-sm text-sm"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-1.5" />
              <span>목록으로</span>
            </button>
            <div className="h-4 w-px bg-gray-300" />
            <h1 className="text-xl font-bold text-gray-800 flex items-center space-x-2">
              <BookOpenIcon className="h-5 w-5 text-rose-600" />
              <span>{subject.name} 평가 기록</span>
            </h1>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={exportToExcel}
              className="flex items-center space-x-1.5 bg-green-500 text-white px-3 py-1.5 rounded-lg hover:bg-green-600 transition-colors text-sm"
            >
              <DocumentArrowDownIcon className="h-4 w-4" />
              <span>엑셀 다운로드</span>
            </button>
            <button
              onClick={() => setIsItemModalOpen(true)}
              className="flex items-center space-x-1.5 bg-rose-500 text-white px-3 py-1.5 rounded-lg hover:bg-rose-600 transition-colors text-sm"
            >
              <PlusIcon className="h-4 w-4" />
              <span>열 추가</span>
            </button>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3">
          <div className="bg-white rounded-lg shadow-sm p-2 border border-gray-200">
            <div className="flex items-center">
              <div className="p-1 bg-blue-100 rounded-md">
                <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <div className="ml-2">
                <p className="text-xs font-medium text-gray-600">총 학생</p>
                <p className="text-sm font-bold text-gray-900">{students.length}명</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-2 border border-gray-200">
            <div className="flex items-center">
              <div className="p-1 bg-green-100 rounded-md">
                <ChartBarIcon className="w-3 h-3 text-green-600" />
              </div>
              <div className="ml-2">
                <p className="text-xs font-medium text-gray-600">평가 항목</p>
                <p className="text-sm font-bold text-gray-900">{assessmentItems.length}개</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-2 border border-gray-200">
            <div className="flex items-center">
              <div className="p-1 bg-yellow-100 rounded-md">
                <svg className="w-3 h-3 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-2">
                <p className="text-xs font-medium text-gray-600">입력 완료</p>
                <p className="text-sm font-bold text-gray-900">
                  {Math.round((assessmentRecords.length / (students.length * assessmentItems.length || 1)) * 100)}%
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-2 border border-gray-200">
            <div className="flex items-center">
              <div className="p-1 bg-purple-100 rounded-md">
                <svg className="w-3 h-3 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div className="ml-2">
                <p className="text-xs font-medium text-gray-600">평균 진도</p>
                <p className="text-sm font-bold text-gray-900">
                  {assessmentRecords.length > 0 ? Math.round(assessmentRecords.length / students.length * 100) / 100 : 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 평가 기록 테이블 - 개선된 디자인 */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
          {/* 가로 스크롤 컨테이너 */}
          <div className="overflow-x-auto">
            <div className="min-w-full" style={{ minWidth: `${Math.max(600, 120 + assessmentItems.length * 100)}px` }}>
              {/* 테이블 헤더 - 평가 항목들 */}
              <div className="bg-gradient-to-r from-rose-50 to-pink-50 border-b border-rose-200 p-1.5">
                <div className="grid gap-1.5" style={{ gridTemplateColumns: `120px repeat(${assessmentItems.length}, 100px)` }}>
                  <div className="font-medium text-gray-900 flex items-center text-xs">
                    <span className="text-xs">👤</span>
                    <span className="ml-1">학생명</span>
                  </div>
                  {assessmentItems.map((item) => (
                    <div key={item.id} className="text-center">
                      <div className="bg-white rounded-md p-1.5 shadow-sm border border-rose-200 group hover:shadow-md transition-all">
                        <div className="mb-0.5">
                          <span className="font-medium text-gray-900 text-xs">{item.name}</span>
                        </div>
                        {item.assessment_date ? (
                          <div className="relative flex items-center justify-center">
                            <div className="text-xs text-gray-500 text-center">
                              {new Date(item.assessment_date).toLocaleDateString('ko-KR', { 
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
                  ))}
                </div>
              </div>

                            {/* 테이블 바디 - 학생별 평가 */}
              <div className="divide-y divide-gray-100">
                {students.length > 0 ? (
                  students.map((student, index) => (
                                     <div key={student.id} className="p-1.5 hover:bg-gray-50/50 transition-colors">
                        <div className="grid gap-1.5 items-center" style={{ gridTemplateColumns: `120px repeat(${assessmentItems.length}, 100px)` }}>
                        {/* 학생 이름 */}
                        <div className="flex items-center space-x-1.5">
                          <div className="w-5 h-5 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-medium text-xs">
                            {student.name.charAt(0)}
                          </div>
                          <span className="font-medium text-gray-900 text-xs truncate">{student.name}</span>
                        </div>
                        
                                             {/* 평가 점수들 */}
                         {assessmentItems.map((item) => {
                           const cellKey = `${student.id}-${item.id}`;
                           const isEditing = editingCell?.studentId === student.id && editingCell?.itemId === item.id;
                           const scoreData = getScoreData(student.id, item.id);
                       
                       // 점수에 따른 색상 결정
                       const getScoreColor = (score: string) => {
                         if (!score || score === '-') return 'bg-gray-100 text-gray-500 border-gray-200';
                         const numScore = parseFloat(score);
                         if (!isNaN(numScore)) {
                           if (numScore >= 90) return 'bg-green-100 text-green-800 border-green-200';
                           if (numScore >= 80) return 'bg-blue-100 text-blue-800 border-blue-200';
                           if (numScore >= 70) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
                           return 'bg-red-100 text-red-800 border-red-200';
                         }
                         // 문자 점수 (A, B, C 등)
                         if (score === 'A' || score === '우수') return 'bg-green-100 text-green-800 border-green-200';
                         if (score === 'B' || score === '보통') return 'bg-blue-100 text-blue-800 border-blue-200';
                         if (score === 'C' || score === '미흡') return 'bg-yellow-100 text-yellow-800 border-yellow-200';
                         return 'bg-gray-100 text-gray-700 border-gray-200';
                       };
                       
                       return (
                         <div key={cellKey} className="flex justify-center">
                           {isEditing ? (
                             <div className="bg-white border-2 border-rose-400 rounded-md p-1.5 shadow-lg">
                               <div className="space-y-1.5">
                                 {/* 점수 입력 */}
                                 <div>
                                   <input
                                     type="text"
                                     value={editingValues.score}
                                     onChange={(e) => setEditingValues({score: e.target.value})}
                                     placeholder="90, A, 우수"
                                     className="w-20 px-1.5 py-0.5 text-center border border-rose-200 rounded bg-white text-gray-900 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 font-medium text-xs"
                                     onKeyDown={(e) => {
                                       if (e.key === 'Enter') {
                                         handleScoreUpdate(student.id, item.id, editingValues);
                                       } else if (e.key === 'Escape') {
                                         setEditingCell(null);
                                       }
                                     }}
                                   />
                                 </div>
                                 
                                 {/* 저장/취소 버튼 */}
                                 <div className="flex justify-center space-x-1">
                                   <button
                                     onClick={() => handleScoreUpdate(student.id, item.id, editingValues)}
                                     className="px-1 py-0.5 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                                   >
                                     저장
                                   </button>
                                   <button
                                     onClick={() => setEditingCell(null)}
                                     className="px-1 py-0.5 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
                                   >
                                     취소
                                   </button>
                                 </div>
                               </div>
                             </div>
                           ) : (
                             <div className="flex justify-center">
                               {/* 점수 버튼 */}
                               <button
                                 onClick={() => {
                                   setEditingCell({ studentId: student.id, itemId: item.id });
                                   setEditingValues({ score: scoreData.score });
                                 }}
                                 className={`
                                   w-10 h-5 rounded-md font-medium text-xs border transition-all
                                   hover:shadow-sm hover:scale-105 cursor-pointer
                                   ${getScoreColor(scoreData.score)}
                                   ${!scoreData.score ? 'hover:bg-rose-50 hover:border-rose-300' : ''}
                                 `}
                               >
                                 {scoreData.score || '+'}
                               </button>
                             </div>
                           )}
                         </div>
                       );
                     })}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-10 text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <p className="text-gray-500 text-sm font-medium">등록된 학생이 없습니다</p>
                <p className="text-gray-400 mt-1 text-xs">학생을 먼저 등록해주세요</p>
              </div>
            )}
          </div>
            </div>
          </div>
        </div>

        {/* 도움말 카드 */}
        {assessmentItems.length > 0 && students.length > 0 && (
          <div className="mt-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
            <div className="flex items-start space-x-2">
              <div className="flex-shrink-0">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xs font-medium text-blue-900 mb-1">💡 사용 팁</h3>
                <ul className="text-xs text-blue-800 space-y-0.5">
                  <li>• 점수 버튼을 클릭하여 점수를 입력하세요</li>
                  <li>• 점수: 숫자(0-100) 또는 문자(A, B, C, 우수, 보통, 미흡) 모두 가능</li>
                  <li>• 색상으로 성취도를 한눈에 확인 (🟢우수 🔵보통 🟡미흡 🔴부족)</li>
                  <li>• Enter로 저장, Esc로 취소할 수 있습니다</li>
                  <li>• 열이 많을 때는 가로 스크롤로 확인하세요</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 평가 항목 추가 모달 */}
      <AnimatePresence>
        {isItemModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
            onClick={() => setIsItemModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-900">새 평가 항목 추가</h3>
                  <button
                    onClick={() => setIsItemModalOpen(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">평가 항목명</label>
                    <input
                      type="text"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      placeholder="예: 국어 1, 발표력, 태도 등..."
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-gray-900 placeholder-gray-500"
                      maxLength={50}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && e.shiftKey === false) {
                          handleAddItem();
                        }
                      }}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">평가 날짜 (선택사항)</label>
                    <input
                      type="date"
                      value={newItemDate}
                      onChange={(e) => setNewItemDate(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-gray-900"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleAddItem();
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setIsItemModalOpen(false)}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleAddItem}
                    disabled={!newItemName.trim() || addItemMutation.isPending}
                    className="bg-rose-500 text-white px-4 py-2 rounded-lg hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {addItemMutation.isPending ? '추가 중...' : '추가하기'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 평가 항목 편집 모달 */}
      <AnimatePresence>
        {isEditItemModalOpen && editingItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
            onClick={() => setIsEditItemModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-900">평가 항목 수정</h3>
                  <button
                    onClick={() => setIsEditItemModalOpen(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">평가 항목명</label>
                    <input
                      type="text"
                      value={editItemName}
                      onChange={(e) => setEditItemName(e.target.value)}
                      placeholder="예: 국어 1, 발표력, 태도 등..."
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                      maxLength={50}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && e.shiftKey === false) {
                          handleUpdateItem();
                        }
                      }}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">평가 날짜 (선택사항)</label>
                    <input
                      type="date"
                      value={editItemDate}
                      onChange={(e) => setEditItemDate(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleUpdateItem();
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setIsEditItemModalOpen(false)}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleUpdateItem}
                    disabled={!editItemName.trim() || updateItemMutation.isPending}
                    className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updateItemMutation.isPending ? '수정 중...' : '수정하기'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
} 