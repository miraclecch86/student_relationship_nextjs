'use client';

import { useState, useEffect } from 'react';
import { Survey } from '@/lib/supabase'; // Survey 타입 import
import { PlusIcon } from '@heroicons/react/24/outline';

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

  const handleCloseModal = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ 
        backgroundColor: 'rgba(0, 0, 0, 0.5)', 
        zIndex: 9999 
      }}
      onClick={handleCloseModal}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-md w-full relative"
        style={{ zIndex: 10000 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-800" style={{ color: '#1f2937' }}>설문 정보 수정</h3>
            <button
              onClick={handleCloseModal}
              className="text-gray-500 hover:text-gray-700"
              style={{ color: '#6b7280' }}
            >
              <PlusIcon className="h-6 w-6 rotate-45" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2" style={{ color: '#374151' }}>설문명</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 1학기 친구관계, 2학기 설문..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                style={{ color: '#111827', backgroundColor: '#ffffff' }}
                maxLength={50}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2" style={{ color: '#374151' }}>설명</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="설문에 대한 간단한 설명을 입력하세요..."
                rows={3}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                style={{ color: '#111827', backgroundColor: '#ffffff' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2" style={{ color: '#374151' }}>설문진행날짜</label>
              <input
                type="date"
                value={createdAt}
                onChange={(e) => setCreatedAt(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                style={{ color: '#111827', backgroundColor: '#ffffff' }}
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 mt-6">
            <button
              onClick={handleCloseModal}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              style={{ color: '#374151', backgroundColor: '#ffffff', borderColor: '#d1d5db' }}
              disabled={isLoading}
            >
              취소
            </button>
            <button
              onClick={handleSaveClick}
              disabled={!name.trim() || isLoading}
              className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#22c55e', color: '#ffffff' }}
            >
              {isLoading ? '저장 중...' : '저장하기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 