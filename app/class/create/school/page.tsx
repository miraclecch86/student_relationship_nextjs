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
    <div>
      <h1>학교 정보 입력</h1>
      <div style={{ marginBottom: '1rem' }}>
        <label>
          연도
          <input
            type="number"
            placeholder="예: 2024"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            min="2000"
            max="2100"
            required
            style={{ marginLeft: '0.5rem' }}
          />
        </label>
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <label>
          학교 이름
          <input
            type="text"
            placeholder="학교 이름"
            value={schoolName}
            onChange={(e) => setSchoolName(e.target.value)}
            required
            style={{ marginLeft: '0.5rem' }}
          />
        </label>
      </div>
      <button onClick={handleSubmit}>다음 (학년/반 입력)</button>
    </div>
  );
} 