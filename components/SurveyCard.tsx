'use client';

import React from 'react';
import { Survey } from '@/lib/supabase';
import { PencilIcon, TrashIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/outline';

interface SurveyCardProps {
  survey: Survey;
  onClick: () => void;
  onEdit: (survey: Survey) => void;
  onDelete: (surveyId: string) => void;
}

export default function SurveyCard({ survey, onClick, onEdit, onDelete }: SurveyCardProps) {
  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(survey);
    console.log("Edit survey:", survey.id);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(survey.id);
  };

  return (
    <>
      <div
        onClick={onClick}
        className="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-200 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer group min-h-[180px] flex flex-col"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
            <ClipboardDocumentListIcon className="h-5 w-5 text-indigo-600" />
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={handleEditClick}
              className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
              title="설문 수정"
            >
              <PencilIcon className="h-4 w-4" />
            </button>
            <button
              onClick={handleDeleteClick}
              className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
              title="설문 삭제"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
        
        <div className="flex-1 flex flex-col">
          <h4 className="text-lg font-semibold text-gray-800 mb-2">{survey.name}</h4>
          
          {/* 설명 */}
          <div className="flex-1 mb-3">
            {survey.description ? (
              <p className="text-sm text-gray-600 line-clamp-3">{survey.description}</p>
            ) : (
              <p className="text-sm text-gray-400 italic">설명이 없습니다</p>
            )}
          </div>
          
          {/* 하단 고정 링크와 날짜 */}
          <div className="flex items-center justify-between text-xs mt-auto">
            <div className="flex items-center text-indigo-600">
              <ClipboardDocumentListIcon className="h-3 w-3 mr-1" />
              <span>설문 항목 기록</span>
            </div>
            {/* 설문 진행 날짜 */}
            {survey.survey_date ? (
              <div className="flex items-center text-gray-500">
                <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{new Date(survey.survey_date).toLocaleDateString('ko-KR')}</span>
              </div>
            ) : (
              <div className="flex items-center text-gray-400">
                <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>미설정</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
} 