'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Page() {
  const router = useRouter();
  const [year, setYear] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [teacherName, setTeacherName] = useState<string | null>(null);

  useEffect(() => {
    // 선생님 이름 가져오기
    const getTeacherName = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const teacherName = session.user.user_metadata?.teacher_name;
        setTeacherName(teacherName || null);
      }
    };

    getTeacherName();
  }, []);

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
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-indigo-800 mb-2">새 학급 만들기</h1>
          {teacherName && (
            <p className="text-sm text-gray-600">
              {teacherName}선생님, 새로운 학급을 만들어 보세요! 🎓
            </p>
          )}
        </div>
        
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