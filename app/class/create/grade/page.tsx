'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
// import { supabase } from '@/lib/supabase'; // 클라이언트 supabase 사용 제거
import { createClass as createClassAction } from './actions'; // 서버 액션 import

// 로컬 createClass 함수 제거
/*
async function createClass(name: string): Promise<{ id: string }> {
  // ... (기존 로컬 함수 내용)
}
*/

// 서버 액션 반환 타입 정의 (actions.ts 를 기반으로)
interface CreatedClass {
    id: string;
    created_at: string;
    name: string;
    user_id: string;
    grade: number | null;
    class: number | null;
}

export default function Page({ searchParams }: { searchParams: { school: string } }) {
  const router = useRouter();
  // searchParams를 직접 접근하는 대신 구조 분해 할당 사용 권장
  const schoolName = searchParams.school ?? ''; // null 병합 연산자 사용
  const [grade, setGrade] = useState('');
  const [classNum, setClassNum] = useState('');

  // useMutation 타입을 서버 액션의 인자와 반환값에 맞게 수정
  const createClassMutation = useMutation<
    CreatedClass, // 성공 시 반환 타입
    Error,        // 에러 타입
    { school: string; grade: number; classNum: number } // mutate 인자 타입
  >({
    mutationFn: createClassAction, // 서버 액션 함수 사용
    onSuccess: (data) => {
      const newClassId = data.id;
      router.push(`/class/create/students?classId=${newClassId}`);
    },
    onError: (error) => {
      console.error("Failed to create class:", error);
      alert(`학급 생성 실패: ${error.message}`); // 에러 메시지는 서버 액션에서 온 것
    }
  });

  const handleSubmit = () => {
    // 입력값 검증 및 숫자 변환
    const gradeNum = parseInt(grade, 10);
    const classNumParsed = parseInt(classNum, 10);

    if (!isNaN(gradeNum) && !isNaN(classNumParsed) && schoolName.trim()) {
      // 서버 액션 호출 시 객체 형태로 인자 전달
      createClassMutation.mutate({ 
          school: schoolName, 
          grade: gradeNum, 
          classNum: classNumParsed 
      });
    } else {
      alert('학교 이름이 유효하고, 학년과 반은 숫자로 입력해주세요.');
    }
  };

  return (
    <div>
      <h1>학년 / 반 입력</h1>
      <p>학교: {schoolName}</p>
      <input
        type="number" // 숫자 입력 타입 사용
        placeholder="학년 (숫자)"
        value={grade}
        onChange={(e) => setGrade(e.target.value)}
      />
      <input
        type="number" // 숫자 입력 타입 사용
        placeholder="반 (숫자)"
        value={classNum}
        onChange={(e) => setClassNum(e.target.value)}
      />
      <button onClick={handleSubmit} disabled={createClassMutation.isPending}>
        {createClassMutation.isPending ? '생성 중...' : '다음 (학생 입력)'}
      </button>
    </div>
  );
} 