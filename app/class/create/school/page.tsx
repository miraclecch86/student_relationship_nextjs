'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Page() {
  const router = useRouter();
  const [schoolName, setSchoolName] = useState('');

  const handleSubmit = () => {
    if (schoolName.trim()) {
      // Pass school name as search param to the next step
      router.push(`/class/create/grade?school=${encodeURIComponent(schoolName.trim())}`);
    } else {
      alert('학교 이름을 입력해주세요.');
    }
  };

  return (
    <div>
      <h1>학교 이름 입력</h1>
      <input
        type="text"
        placeholder="학교 이름"
        value={schoolName}
        onChange={(e) => setSchoolName(e.target.value)}
      />
      <button onClick={handleSubmit}>다음 (학년/반 입력)</button>
    </div>
  );
} 