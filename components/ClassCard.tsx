'use client';

import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Class as BaseClass } from '@/lib/supabase'; // Supabase 타입
import EditClassNameModal from './EditClassNameModal';
import ConfirmModal from './ConfirmModal'; // 삭제 확인 모달
import toast from 'react-hot-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query'; // 뮤테이션 훅
import { supabase } from '@/lib/supabase'; // supabase 클라이언트
import { useRouter } from 'next/navigation'; // 라우터 임포트
import { isDemoClass as checkIsDemoClass } from '@/utils/demo-permissions';

// 학급 수정 함수
async function updateClass(id: string, newName: string): Promise<BaseClass | null> {
  const { data, error } = await (supabase as any)
    .from('classes')
    .update({ name: newName.trim() })
    .eq('id', id)
    .select('id, name, created_at, user_id')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// 주관식 질문 개수를 포함하는 타입 정의 (page.tsx 와 동일하게)
interface ClassWithCount extends BaseClass {
  subjectiveQuestionCount?: number; // optional로 처리하여 에러 방지
  studentCount?: number; // 학생 수 필드 추가
  surveyCount?: number; // 설문지 수 필드 추가
  is_demo?: boolean; // 데모 학급 여부
  is_public?: boolean; // 공개 학급 여부
}

interface ClassCardProps {
  classData: ClassWithCount;
  // onEdit prop은 이제 사용하지 않지만, 호환성을 위해 남겨둘 수 있음 (또는 제거)
  onEdit: (id: string, newName: string) => Promise<void>; 
  onDelete: (id: string) => Promise<void>; // 부모의 삭제 처리 함수
}

export default function ClassCard({ classData, onEdit, onDelete }: ClassCardProps) {
  const queryClient = useQueryClient();
  const router = useRouter(); // 라우터 초기화
  const cardRef = useRef<HTMLDivElement>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

  // 수정 뮤테이션 (반환 타입 BaseClass | null)
  const updateMutation = useMutation<BaseClass | null, Error, { id: string; newName: string }>({
      mutationFn: ({ id, newName }) => {
          // 실제 수정 로직은 상위 컴포넌트나 상태 관리 라이브러리에서 처리해야 함
          console.warn("ClassCard: Actual update logic should be handled by parent or state management.");
          // 임시로 null 반환 또는 상위의 실제 함수 호출 결과를 반환해야 함
          return Promise.resolve(null); 
      },
      onSuccess: (updatedClass) => {
          // 상위 컴포넌트에서 invalidateQueries를 통해 UI가 업데이트될 것이므로,
          // ClassCard 자체에서 별도의 성공 메시지를 띄우지 않아도 됨.
          // 만약 updatedClass가 null이 아니라면 (실제 업데이트 로직이 여기 있다면) toast.success 사용 가능
          if (updatedClass) {
            // 이 부분은 실제 업데이트 로직이 ClassCard 내부에 있을 경우에만 유효
            // queryClient.invalidateQueries({ queryKey: ['classes'] }); // 상위에서 하므로 제거 또는 주석처리
            // toast.success(`'${updatedClass.name}'으로 수정되었습니다.`); // 상위에서 하므로 제거 또는 주석처리
          } else {
            // 실제 업데이트가 상위에서 이루어지므로, 여기서는 모달만 닫음
            // toast.info(...) 제거
          }
          setIsEditModalOpen(false); // 모달 닫기는 유지
      },
      onError: (error) => {
          // 에러 발생 시에는 사용자에게 피드백 제공
          toast.error(`수정 중 오류 발생: ${error.message}`);
      },
  });

  // 🌟 데모 학급 여부 확인
  const isDemoClass = checkIsDemoClass(classData);

  // 카드 클릭 핸들러
  const handleCardClick = () => {
    router.push(`/class/${classData.id}/dashboard`);
  };

  // 데모 학급 복사 핸들러
  const handleCopyDemoClass = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (isCopying) return;
    
    try {
      setIsCopying(true);
      toast.loading('데모 학급을 복사하는 중...', { id: 'copy-demo' });
      
      const response = await fetch(`/api/classes/${classData.id}/copy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `${classData.name} (복사본)`
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || '복사에 실패했습니다.');
      }
      
      toast.success('데모 학급이 성공적으로 복사되었습니다!', { id: 'copy-demo' });
      
      // 학급 목록 새로고침
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      
      // 새 학급으로 이동
      toast.loading('새 학급으로 이동 중...', { id: 'navigate' });
      setTimeout(() => {
        router.push(`/class/${result.data.newClass.id}/dashboard`);
        toast.dismiss('navigate');
      }, 1000);
      
    } catch (error) {
      console.error('데모 학급 복사 오류:', error);
      toast.error(error instanceof Error ? error.message : '복사 중 오류가 발생했습니다.', { id: 'copy-demo' });
    } finally {
      setIsCopying(false);
    }
  };

  // --- 이벤트 핸들러들 ---
  // 수정 버튼 클릭 핸들러 (모달 열기)
  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // 페이지 이동 방지
    setIsEditModalOpen(true); // 수정 모달 열기
  };

  // 수정 모달 저장 핸들러
  const handleSaveName = async (newName: string) => {
    await onEdit(classData.id, newName);
    setIsEditModalOpen(false);
  };

  // 삭제 버튼 핸들러
  const handleDeleteClick = (e: React.MouseEvent) => { e.stopPropagation(); setIsDeleteDialogOpen(true); };
  const confirmDelete = async () => { try { await onDelete(classData.id); } catch (error) {} };

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
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold truncate text-sm flex-1">{classData.name}</h3>
            {isDemoClass && (
              <span className="ml-2 px-2 py-1 bg-yellow-400 text-yellow-900 text-xs font-medium rounded-full whitespace-nowrap">
                🌟 체험용
              </span>
            )}
          </div>
        </div>

        {/* 하단: 정보 및 버튼 섹션 */}        
        <div className="p-4">
          {/* 정보 박스 */}          
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-sm font-medium text-gray-600 mb-1">전체 학생</p>
              <p className="text-xl font-bold text-indigo-500">{classData.studentCount ?? 0}명</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-sm font-medium text-gray-600 mb-1">설문지</p>
              <p className="text-xl font-bold text-indigo-500">{classData.surveyCount ?? 0}개</p>
            </div>
          </div>

          {/* 액션 버튼 */}          
          <div className="space-y-2">
            {/* 기존 버튼들 */}
            <div className="grid grid-cols-2 gap-3">
              {isDemoClass ? (
                <>
                  {/* 데모 학급: 복사 버튼 */}
                  <motion.button
                    onClick={handleCopyDemoClass}
                    disabled={isCopying}
                    className={`w-full px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-green-200 focus:ring-offset-1 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg ${
                      isCopying 
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                        : 'bg-green-50 text-green-600 hover:bg-green-100 active:bg-green-100 cursor-pointer'
                    }`}
                  >
                    {isCopying ? '⏳ 복사 중...' : '📋 복사'}
                  </motion.button>
                  {/* 데모 학급: 체험하기 버튼 */}
                  <motion.button
                    onClick={handleCardClick}
                    className="w-full px-4 py-2 bg-purple-50 text-purple-600 text-sm font-medium rounded-md hover:bg-purple-100 active:bg-purple-100 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:ring-offset-1 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
                  >
                    🚀 체험하기
                  </motion.button>
                </>
              ) : (
                <>
                  {/* 일반 학급: 수정/삭제 버튼 */}
                  <motion.button
                    onClick={handleEditClick}
                    className="w-full px-4 py-2 bg-indigo-50 text-indigo-500 text-sm font-medium rounded-md hover:bg-indigo-100 active:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:ring-offset-1 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
                  >
                    수정
                  </motion.button>
                  <motion.button
                    onClick={handleDeleteClick}
                    className="w-full px-4 py-2 bg-red-50 text-red-600 text-sm font-medium rounded-md hover:bg-red-100 active:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-200 focus:ring-offset-1 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
                  >
                    삭제
                  </motion.button>
                </>
              )}
            </div>
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