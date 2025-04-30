'use client';

import React, { useState } from 'react';
import { Survey } from '@/lib/supabase';
import { DocumentTextIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import ConfirmModal from './ConfirmModal';

interface SurveyCardProps {
  survey: Survey;
  onClick: () => void;
  onEdit: (survey: Survey) => void;
  onDelete: (surveyId: string) => void;
}

export default function SurveyCard({ survey, onClick, onEdit, onDelete }: SurveyCardProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(survey);
    console.log("Edit survey:", survey.id);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    onDelete(survey.id);
    setIsDeleteDialogOpen(false);
  };

  return (
    <>
      <div
        onClick={onClick}
        className="bg-white rounded-lg shadow-md p-4 cursor-pointer hover:shadow-lg transition-shadow duration-200 border border-gray-200 flex flex-col justify-between min-h-[150px]"
      >
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-1 truncate" title={survey.name}>{survey.name}</h3>
          <p className="text-sm text-gray-500 line-clamp-2 mb-3 h-10">{survey.description || '설명 없음'}</p>
        </div>
        <div className="mt-auto flex items-center justify-between border-t pt-2">
          <div className="flex items-center text-xs text-gray-400">
            <DocumentTextIcon className="w-4 h-4 mr-1 flex-shrink-0" />
            <span>{new Date(survey.created_at).toLocaleDateString()} 생성</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleEditClick}
              className="p-1.5 rounded-md text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
              title="수정"
            >
              <PencilIcon className="w-4 h-4" />
            </button>
            <button
              onClick={handleDeleteClick}
              className="p-1.5 rounded-md text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
              title="삭제"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
        title="설문 삭제 확인"
        message={`'${survey.name}' 설문을 정말 삭제하시겠습니까? 관련된 모든 질문, 답변, 관계 데이터가 삭제됩니다.`}
        confirmText="삭제"
      />
    </>
  );
} 