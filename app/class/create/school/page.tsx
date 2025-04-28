'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Page() {
  const router = useRouter();
  const [year, setYear] = useState('');
  const [schoolName, setSchoolName] = useState('');

  const handleSubmit = () => {
    if (!year.trim()) {
      alert('연도를 입력해주세요.');
      return;
    }
    if (!schoolName.trim()) {
      alert('학교 이름을 입력해주세요.');
      return;
    }
    // Pass year and school name as search params to the next step
    router.push(`/class/create/grade?year=${encodeURIComponent(year.trim())}&school=${encodeURIComponent(schoolName.trim())}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-700 via-indigo-800 to-indigo-900">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-indigo-800 mb-6 text-center">학교 정보 입력</h1>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">연도</label>
          <input
            type="number"
            placeholder="예: 2024"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            min="2000"
            max="2100"
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black placeholder:text-gray-400"
          />
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">학교 이름</label>
          <input
            type="text"
            placeholder="학교 이름"
            value={schoolName}
            onChange={(e) => setSchoolName(e.target.value)}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black placeholder:text-gray-400"
          />
        </div>
        <button
          onClick={handleSubmit}
          className="w-full py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition"
        >
          다음 (학년/반 입력)
        </button>
      </div>
    </div>
  );
} 