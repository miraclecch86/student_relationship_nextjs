'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClass as createClassAction } from './actions';

export default function GradeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const schoolName = searchParams.get('school') ?? '';
  const year = searchParams.get('year') ?? '';
  const [grade, setGrade] = useState('');
  const [classNum, setClassNum] = useState('');

  const createClassMutation = useMutation<
    void, 
    Error,
    { school: string; grade: number; classNum: number; year: number }
  >({
    mutationFn: createClassAction,
    onError: (error: any) => {
      if (error?.message?.includes('NEXT_REDIRECT')) {
        console.log('Server action redirected successfully.');
        return;
      }
      console.error("Failed to create class (Mutation Level Error):", error);
      alert(`학급 생성 중 오류 발생: ${error.message ?? '알 수 없는 오류'}`); 
    }
  });

  const handleSubmit = () => {
    const gradeNum = parseInt(grade, 10);
    const classNumParsed = parseInt(classNum, 10);
    const yearNum = parseInt(year, 10);

    if (!isNaN(yearNum) && !isNaN(gradeNum) && !isNaN(classNumParsed) && schoolName.trim()) {
      createClassMutation.mutate({ 
          school: schoolName, 
          grade: gradeNum, 
          classNum: classNumParsed,
          year: yearNum
      });
    } else {
      alert('학교 이름이 유효하고, 연도, 학년, 반은 숫자로 입력해주세요.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-700 via-indigo-800 to-indigo-900">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-indigo-800 mb-6 text-center">학년 / 반 입력</h1>
        <div className="mb-2 text-center text-gray-600">연도: <span className="font-semibold">{year}</span></div>
        <div className="mb-6 text-center text-gray-600">학교: <span className="font-semibold">{schoolName}</span></div>
        <div className="mb-4">
          <input
            type="number"
            placeholder="학년 (숫자)"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3 text-black placeholder:text-gray-400"
          />
          <input
            type="number"
            placeholder="반 (숫자)"
            value={classNum}
            onChange={(e) => setClassNum(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black placeholder:text-gray-400"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={createClassMutation.isPending}
          className="w-full py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition disabled:opacity-60"
        >
          {createClassMutation.isPending ? '생성 중...' : '다음 (학생 입력)'}
        </button>
      </div>
    </div>
  );
} 