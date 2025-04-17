'use client';

import { useState, Fragment, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { motion } from 'framer-motion';

interface EditClassNameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newName: string) => Promise<void>; // 저장 함수 (비동기 처리 고려)
  initialName: string;
  isLoading?: boolean; // 저장 중 로딩 상태
}

export default function EditClassNameModal({
  isOpen,
  onClose,
  onSave,
  initialName,
  isLoading = false,
}: EditClassNameModalProps) {
  const [editedName, setEditedName] = useState(initialName);

  // 모달이 열릴 때마다 초기 이름으로 상태 업데이트
  useEffect(() => {
    if (isOpen) {
      setEditedName(initialName);
    }
  }, [isOpen, initialName]);

  const handleSaveClick = async () => {
    if (editedName.trim() && editedName.trim() !== initialName) {
      try {
        await onSave(editedName.trim()); // 부모 컴포넌트의 저장 함수 호출
        // 성공 시 모달 닫기는 부모 컴포넌트의 onSuccess 등에서 처리하는 것이 좋음
        // onClose(); // 여기서 직접 닫지 않음
      } catch (error) {
        // 에러는 onSave를 호출한 곳(뮤테이션 등)에서 처리
        console.error("Save failed in modal:", error);
      }
    } else if (editedName.trim() === initialName) {
      onClose(); // 변경 없으면 그냥 닫기
    } else {
      alert('학급 이름은 비워둘 수 없습니다.'); // 간단한 alert 사용
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        {/* 투명 배경 오버레이 */}
        <Transition.Child 
          as={Fragment} 
          enter="ease-out duration-100"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-transparent" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child 
              as={Fragment} 
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
             >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-lg bg-white p-6 text-left align-middle shadow-lg transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-semibold leading-6 text-gray-900" // 아이콘 제거
                >
                  학급 이름 수정
                </Dialog.Title>
                <div className="mt-4">
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    // 입력창 스타일 적용
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent shadow-sm text-gray-800"
                    placeholder="새 학급 이름"
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveClick()} // Enter로 저장
                  />
                </div>

                {/* 버튼 영역: space-x-3 -> space-x-2 변경 */}                
                <div className="mt-6 flex justify-end space-x-2">
                  <motion.button
                    type="button"
                    className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md shadow-sm hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
                    onClick={onClose}
                    disabled={isLoading}
                  >
                    취소
                  </motion.button>
                  <motion.button
                    type="button"
                    className={`inline-flex justify-center px-4 py-2 text-sm font-medium text-white rounded-md shadow ${ 
                      isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-500 hover:bg-indigo-600 focus:ring-indigo-300'
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg`}
                    onClick={handleSaveClick}
                    disabled={isLoading}
                  >
                    {isLoading ? '저장 중...' : '저장'}
                  </motion.button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
} 