'use client';

import React, { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PlusIcon,
  XMarkIcon,
  TrashIcon,
  PencilIcon,
  ChartBarIcon,
  BookOpenIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

// 과목 타입 정의
interface Subject {
  id: string;
  class_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

// 학급 정보 조회
async function fetchClassDetails(classId: string): Promise<any> {
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

// 과목 목록 조회
async function fetchSubjects(classId: string): Promise<Subject[]> {
  const { data, error } = await (supabase as any)
    .from('subjects')
    .select('*')
    .eq('class_id', classId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching subjects:', error);
    return [];
  }

  return data || [];
}

// 과목 추가
async function addSubject(classId: string, name: string): Promise<Subject> {
  const { data, error } = await (supabase as any)
    .from('subjects')
    .insert({
      class_id: classId,
      name: name.trim()
    })
    .select()
    .single();

  if (error) {
    throw new Error('과목 추가 중 오류가 발생했습니다.');
  }

  return data;
}

// 과목 수정
async function updateSubject(subjectId: string, name: string): Promise<Subject> {
  const { data, error } = await (supabase as any)
    .from('subjects')
    .update({ name: name.trim() })
    .eq('id', subjectId)
    .select()
    .single();

  if (error) {
    throw new Error('과목 수정 중 오류가 발생했습니다.');
  }

  return data;
}

// 과목 삭제
async function deleteSubject(subjectId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('subjects')
    .delete()
    .eq('id', subjectId);

  if (error) {
    throw new Error('과목 삭제 중 오류가 발생했습니다.');
  }
}

export default function AssessmentsPage() {
  const router = useRouter();
  const params = useParams();
  const classId = params.classId as string;
  const queryClient = useQueryClient();

  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [editSubjectName, setEditSubjectName] = useState('');

  // 학급 정보 조회
  const { data: classDetails, isLoading: isClassLoading } = useQuery({
    queryKey: ['classDetails', classId],
    queryFn: () => fetchClassDetails(classId),
    enabled: !!classId,
  });

  // 과목 목록 조회
  const { data: subjects = [], isLoading: isSubjectsLoading } = useQuery<Subject[]>({
    queryKey: ['subjects', classId],
    queryFn: () => fetchSubjects(classId),
    enabled: !!classId,
  });

  // 과목 추가 뮤테이션
  const addSubjectMutation = useMutation({
    mutationFn: ({ classId, name }: { classId: string; name: string }) => 
      addSubject(classId, name),
    onSuccess: () => {
      toast.success('과목이 추가되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      setNewSubjectName('');
      setIsSubjectModalOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // 과목 수정 뮤테이션
  const updateSubjectMutation = useMutation({
    mutationFn: ({ subjectId, name }: { subjectId: string; name: string }) => 
      updateSubject(subjectId, name),
    onSuccess: () => {
      toast.success('과목이 수정되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      setEditSubjectName('');
      setEditingSubject(null);
      setIsEditModalOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // 과목 삭제 뮤테이션
  const deleteSubjectMutation = useMutation({
    mutationFn: deleteSubject,
    onSuccess: () => {
      toast.success('과목이 삭제되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleAddSubject = () => {
    if (!newSubjectName.trim()) {
      toast.error('과목명을 입력해주세요.');
      return;
    }

    addSubjectMutation.mutate({ classId, name: newSubjectName });
  };

  const handleEditSubject = (subject: Subject) => {
    setEditingSubject(subject);
    setEditSubjectName(subject.name);
    setIsEditModalOpen(true);
  };

  const handleUpdateSubject = () => {
    if (!editSubjectName.trim()) {
      toast.error('과목명을 입력해주세요.');
      return;
    }

    if (editingSubject) {
      updateSubjectMutation.mutate({ 
        subjectId: editingSubject.id, 
        name: editSubjectName 
      });
    }
  };

  const handleDeleteSubject = (subjectId: string) => {
    if (confirm('정말로 이 과목을 삭제하시겠습니까? 관련된 모든 평가 데이터가 삭제됩니다.')) {
      deleteSubjectMutation.mutate(subjectId);
    }
  };

  if (isClassLoading || isSubjectsLoading) {
    return <div className="flex justify-center items-center h-screen">로딩 중...</div>;
  }

  if (!classDetails) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">학급을 찾을 수 없습니다</h1>
          <button
            onClick={() => router.push('/')}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center space-x-2">
            <ChartBarIcon className="h-6 w-6 text-rose-600" />
            <span>평가 기록</span>
          </h1>
        </div>

        {/* 학급 정보 */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-rose-100 rounded-full flex items-center justify-center">
              <ChartBarIcon className="h-5 w-5 text-rose-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-800">{classDetails.name} 평가 기록</h2>
              <p className="text-sm text-gray-600">과목별 평가를 기록하고 학생들의 성취도를 관리할 수 있습니다</p>
            </div>
          </div>
        </div>

        {/* 과목 목록 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-800">
              과목 목록 ({subjects.length}개)
            </h3>
            <button
              onClick={() => setIsSubjectModalOpen(true)}
              className="flex items-center space-x-2 bg-rose-500 text-white px-4 py-2 rounded-lg hover:bg-rose-600 transition-colors"
            >
              <PlusIcon className="h-5 w-5" />
              <span>과목 생성</span>
            </button>
          </div>

          {/* 과목 카드 그리드 */}
          {subjects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <AnimatePresence>
                {subjects.map((subject) => (
                  <motion.div
                    key={subject.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-200 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer group"
                    onClick={() => router.push(`/class/${classId}/assessments/${subject.id}`)}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 bg-rose-100 rounded-full flex items-center justify-center">
                        <BookOpenIcon className="h-5 w-5 text-rose-600" />
                      </div>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditSubject(subject);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
                          title="과목 수정"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSubject(subject.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                          title="과목 삭제"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <h4 className="text-lg font-semibold text-gray-800 mb-2">{subject.name}</h4>
                    <p className="text-sm text-gray-600">평가 기록</p>
                    <div className="mt-3 flex items-center text-xs text-rose-600">
                      <ChartBarIcon className="h-3 w-3 mr-1" />
                      <span>평가 항목 기록</span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <BookOpenIcon className="h-8 w-8 text-rose-600" />
              </div>
              <p className="text-gray-600 mb-4">아직 생성된 과목이 없습니다</p>
              <button
                onClick={() => setIsSubjectModalOpen(true)}
                className="text-rose-600 hover:text-rose-800 font-medium"
              >
                첫 번째 과목 생성하기
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 과목 생성 모달 */}
      <AnimatePresence>
        {isSubjectModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
            onClick={() => setIsSubjectModalOpen(false)}
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
                  <h3 className="text-xl font-semibold text-gray-900">새 과목 생성</h3>
                  <button
                    onClick={() => setIsSubjectModalOpen(false)}
                    className="text-gray-600 hover:text-gray-800"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">과목명</label>
                    <input
                      type="text"
                      value={newSubjectName}
                      onChange={(e) => setNewSubjectName(e.target.value)}
                      placeholder="예: 국어, 수학, 영어..."
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-gray-900 placeholder-gray-500"
                      maxLength={50}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleAddSubject();
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setIsSubjectModalOpen(false)}
                    className="px-4 py-2 text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleAddSubject}
                    disabled={!newSubjectName.trim() || addSubjectMutation.isPending}
                    className="bg-rose-500 text-white px-4 py-2 rounded-lg hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {addSubjectMutation.isPending ? '생성 중...' : '생성하기'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 과목 수정 모달 */}
      <AnimatePresence>
        {isEditModalOpen && editingSubject && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
            onClick={() => setIsEditModalOpen(false)}
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
                  <h3 className="text-xl font-semibold text-gray-900">과목 수정</h3>
                  <button
                    onClick={() => setIsEditModalOpen(false)}
                    className="text-gray-600 hover:text-gray-800"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">과목명</label>
                    <input
                      type="text"
                      value={editSubjectName}
                      onChange={(e) => setEditSubjectName(e.target.value)}
                      placeholder="예: 국어, 수학, 영어..."
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-gray-900 placeholder-gray-500"
                      maxLength={50}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleUpdateSubject();
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleUpdateSubject}
                    disabled={!editSubjectName.trim() || updateSubjectMutation.isPending}
                    className="bg-rose-500 text-white px-4 py-2 rounded-lg hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {updateSubjectMutation.isPending ? '수정 중...' : '수정하기'}
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