'use client';

import React from 'react';
import { Survey } from '@/lib/supabase';
import { DocumentTextIcon } from '@heroicons/react/24/outline';

interface SurveyCardProps {
  survey: Survey;
  onClick: () => void;
}

export default function SurveyCard({ survey, onClick }: SurveyCardProps) {
  return (
    <div 
      onClick={onClick}
      className="bg-white rounded-lg shadow-md p-4 cursor-pointer hover:shadow-lg transition-shadow duration-200 border border-gray-200 flex flex-col justify-between min-h-[120px]"
    >
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-1 truncate">{survey.name}</h3>
        <p className="text-sm text-gray-600 line-clamp-2 mb-2">{survey.description || '설명 없음'}</p>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-400 mt-auto">
        <DocumentTextIcon className="w-4 h-4 mr-1" />
        <span>{new Date(survey.created_at).toLocaleDateString()} 생성</span>
        {/* TODO: Add more info like number of relations if needed */}
      </div>
    </div>
  );
} 