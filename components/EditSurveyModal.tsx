'use client';

import { useState, Fragment, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { motion } from 'framer-motion';
import { Survey } from '@/lib/supabase'; // Survey 타입 import

interface EditSurveyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedSurvey: Partial<Survey>) => Promise<void>; // 변경된 필드만 전달
  initialSurvey: Survey | null;
  isLoading?: boolean;
}

export default function EditSurveyModal({
  isOpen,
  onClose,
  onSave,
  initialSurvey,
  isLoading = false,
}: EditSurveyModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [createdAt, setCreatedAt] = useState('');

  useEffect(() => {
    if (isOpen && initialSurvey) {
      setName(initialSurvey.name || '');
      setDescription(initialSurvey.description || '');
      // 날짜 형식을 yyyy-mm-dd 로 변환
      setCreatedAt(initialSurvey.created_at ? new Date(initialSurvey.created_at).toISOString().split('T')[0] : '');
    }
  }, [isOpen, initialSurvey]);

  const handleSaveClick = async () => {
    if (!initialSurvey) return;

    const updatedFields: Partial<Survey> = {};
    if (name.trim() && name.trim() !== initialSurvey.name) {
      updatedFields.name = name.trim();
    }
    const trimmedDescription = description.trim();
    if (trimmedDescription !== (initialSurvey.description || '')) {
      updatedFields.description = trimmedDescription || undefined; // 빈 문자열이면 undefined
    }
    if (createdAt && new Date(createdAt).toISOString() !== new Date(initialSurvey.created_at).toISOString()) {
        // Date 객체로 변환 후 UTC 시간대 고려하여 ISO 문자열로 저장
        const dateObj = new Date(createdAt);
        if (!isNaN(dateObj.getTime())) {
            // 입력된 날짜의 시작 시간(00:00:00 UTC)으로 설정
            const utcDate = new Date(Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate()));
            updatedFields.created_at = utcDate.toISOString();
        }
    }

    if (Object.keys(updatedFields).length > 0) {
      try {
        await onSave({ id: initialSurvey.id, ...updatedFields });
        onClose(); // 성공 시 모달 닫기
      } catch (error) {
        console.error("Save failed in modal:", error);
        // 에러 처리는 부모의 onError에서 담당
      }
    } else {
      onClose(); // 변경사항 없으면 닫기
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        {/* 오버레이 제거 */}
        {/* 
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
          leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-50" /> 
        </Transition.Child>
        */}

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100"
              leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95"
             >
              <Dialog.Panel 
                className="w-full max-w-md transform overflow-hidden rounded-lg bg-white p-6 text-left align-middle transition-all"
                style={{ boxShadow: '0 -8px 20px rgba(0, 0, 0, 0.1), 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' }}
              >
                <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-indigo-600">
                  설문 정보 수정
                </Dialog.Title>
                <div className="mt-4 space-y-4">
                  <div>
                    <label htmlFor="survey-name" className="block text-sm font-medium text-gray-900 mb-1">설문 이름</label>
                    <input
                      id="survey-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm text-black placeholder:text-gray-400"
                    />
                  </div>
                  <div>
                    <label htmlFor="survey-desc" className="block text-sm font-medium text-gray-900 mb-1">설명 (선택)</label>
                    <textarea
                      id="survey-desc"
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm resize-none text-black placeholder:text-gray-400"
                    />
                  </div>
                  <div>
                     <label htmlFor="survey-date" className="block text-sm font-medium text-gray-900 mb-1">생성일</label>
                    <input
                      id="survey-date"
                      type="date"
                      value={createdAt}
                      onChange={(e) => setCreatedAt(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm text-black"
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end space-x-2">
                  <button
                    type="button"
                    className="px-4 py-2 text-sm text-black bg-gray-100 rounded-md hover:bg-gray-200"
                    onClick={onClose}
                    disabled={isLoading}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    className={`px-4 py-2 text-sm font-medium text-white rounded-md shadow-sm ${isLoading ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                    onClick={handleSaveClick}
                    disabled={isLoading}
                  >
                    {isLoading ? '저장 중...' : '저장'}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
} 