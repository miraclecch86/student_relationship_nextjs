'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Class } from '@/lib/supabase'; // Supabase 타입
import EditClassNameModal from './EditClassNameModal';
import ConfirmModal from './ConfirmModal'; // 삭제 확인 모달
import toast from 'react-hot-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query'; // 뮤테이션 훅
import { supabase } from '@/lib/supabase'; // supabase 클라이언트
import { useRouter } from 'next/navigation'; // 라우터 임포트

// 학급 수정 함수
async function updateClass(id: string, newName: string): Promise<Class | null> {
  const { data, error } = await supabase
    .from('classes')
    .update({ name: newName.trim() })
    .eq('id', id)
    .select('id, name, created_at')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

interface ClassCardProps {
  classData: Class;
  // onEdit prop은 이제 사용하지 않지만, 호환성을 위해 남겨둘 수 있음 (또는 제거)
  onEdit: (id: string, newName: string) => Promise<void>; 
  onDelete: (id: string) => Promise<void>; // 부모의 삭제 처리 함수
}

export default function ClassCard({ classData, onEdit, onDelete }: ClassCardProps) {
  const queryClient = useQueryClient();
  const router = useRouter(); // 라우터 초기화
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // 수정 뮤테이션
  const updateMutation = useMutation<Class | null, Error, { id: string; newName: string }>({
      mutationFn: ({ id, newName }) => updateClass(id, newName),
      onSuccess: (updatedClass) => {
          if (updatedClass) {
              queryClient.invalidateQueries({ queryKey: ['classes'] });
              toast.success(`'${updatedClass.name}'으로 수정되었습니다.`);
              setIsEditModalOpen(false);
          } else {
              toast.error('학급 이름 수정 중 오류 발생');
          }
      },
      onError: (error) => {
          toast.error(`수정 실패: ${error.message}`);
      },
  });

  // --- 이벤트 핸들러들 ---
  // 수정 버튼 클릭 핸들러 (모달 열기)
  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // 페이지 이동 방지
    setIsEditModalOpen(true); // 수정 모달 열기
  };

  // 수정 모달 저장 핸들러
  const handleSaveName = async (newName: string) => {
    // 뮤테이션 실행 (로딩 상태는 모달이 prop으로 받음)
    await updateMutation.mutateAsync({ id: classData.id, newName });
    // 성공 시 onSuccess에서 모달 닫힘
  };

  // 삭제 버튼 핸들러
  const handleDeleteClick = (e: React.MouseEvent) => { e.stopPropagation(); setIsDeleteDialogOpen(true); };
  const confirmDelete = async () => { try { await onDelete(classData.id); } catch (error) {} };

  // 카드 클릭 핸들러
  const handleCardClick = () => { router.push(`/class/${classData.id}`); };
  // --- 이벤트 핸들러들 끝 ---

  return (
    <>
      <motion.div
        // 변경: hover 효과(translate + shadow), transition 추가
        className="bg-white rounded-xl shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-transform duration-200 hover:-translate-y-1"
        onClick={handleCardClick}
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }} // opacity, scale 전환 유지
      >
        {/* 상단: 학급 이름 */}
        <div className="bg-indigo-500 px-4 py-3">
          <h3 className="text-white font-semibold truncate">{classData.name}</h3>
        </div>

        {/* 하단: 정보 및 버튼 섹션 */}        
        <div className="p-4">
          {/* 정보 박스 */}          
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-gray-100 rounded-lg p-3 text-center">
              <p className="text-sm font-medium text-gray-600 mb-1">전체 학생</p>
              <p className="text-xl font-bold text-indigo-500">0</p>
            </div>
            <div className="bg-gray-100 rounded-lg p-3 text-center">
              <p className="text-sm font-medium text-gray-600 mb-1">관계 설정</p>
              <p className="text-xl font-bold text-indigo-500">0%</p>
            </div>
          </div>

          {/* 액션 버튼 */}          
          <div className="grid grid-cols-2 gap-3">
            {/* 수정 버튼 */}            
            <motion.button
              onClick={handleEditClick}
              // 변경: 색상(light indigo), hover 효과(translate + shadow), 기본 스타일(rounded-md 등) 확인, active 스타일 변경
              className="w-full px-4 py-2 bg-indigo-50 text-indigo-500 text-sm font-medium rounded-md hover:bg-indigo-100 active:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-1 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
            >
              수정
            </motion.button>
            {/* 삭제 버튼 */}            
            <motion.button
              onClick={handleDeleteClick}
              // 변경: 색상(light red), hover 효과(translate + shadow), 기본 스타일 확인, active 스타일 변경
              className="w-full px-4 py-2 bg-red-50 text-red-600 text-sm font-medium rounded-md hover:bg-red-100 active:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-1 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
            >
              삭제
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* 수정 모달 렌더링 */}      
      <EditClassNameModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSaveName} // 저장 핸들러 전달
        initialName={classData.name}
        isLoading={updateMutation.isPending} // 로딩 상태 전달
      />

      {/* 삭제 확인 모달 */}      
      <ConfirmModal
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
        title="학급 삭제 확인"
        message={`'${classData.name}' 학급을 정말 삭제하시겠습니까? 관련된 모든 데이터(학생, 관계 등)가 삭제됩니다.`}
        confirmText="삭제"
      />
    </>
  );
} 