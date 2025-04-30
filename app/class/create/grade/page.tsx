import React, { Suspense } from 'react';
import GradeForm from './GradeForm'; // 새로 만든 컴포넌트 import

export default function Page() {
  return (
    // Suspense 로 감싸고 fallback UI 지정
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-700 via-indigo-800 to-indigo-900">
        <div className="text-white text-lg">로딩 중...</div>
      </div>
    }>
      <GradeForm />
    </Suspense>
  );
} 