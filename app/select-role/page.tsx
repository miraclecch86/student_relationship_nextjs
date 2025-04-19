'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function SelectRolePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRoleSelect = async (role: 'teacher' | 'student') => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) throw userError;
      if (!user) {
        router.replace('/login');
        return;
      }

      // 1. user_metadata에 role 저장
      const { error: updateError } = await supabase.auth.updateUser({
        data: { role }
      });

      if (updateError) throw updateError;

      // 2. user_roles 테이블에 저장
      const { error: insertError } = await supabase
        .from('user_roles')
        .insert([
          {
            user_id: user.id,
            role
          }
        ]);

      if (insertError) throw insertError;

      // 3. 역할에 따른 페이지로 리디렉션
      if (role === 'teacher') {
        router.replace('/');
      } else {
        router.replace('/student');
      }
    } catch (err) {
      console.error('Role selection error:', err);
      setError('역할 선택 중 오류가 발생했습니다. 다시 시도해주세요.');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2 bg-gray-50">
      <main className="flex flex-col items-center justify-center w-full flex-1 px-4 sm:px-20 text-center">
        <h1 className="text-4xl font-bold mb-10 text-gray-800">
          Student Relationship
        </h1>

        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm">
          <h2 className="text-2xl font-semibold mb-6 text-gray-700">당신의 역할을 선택해주세요</h2>
          
          {error && (
            <p className="text-red-500 text-sm mb-4 p-3 bg-red-100 rounded border border-red-300">
              {error}
            </p>
          )}

          <div className="space-y-4">
            <button
              onClick={() => handleRoleSelect('teacher')}
              disabled={isLoading}
              className={`w-full bg-indigo-500 text-white font-semibold rounded-md px-4 py-3 shadow-sm hover:bg-indigo-600 transition duration-150 ease-in-out ${
                isLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              선생님
            </button>

            <button
              onClick={() => handleRoleSelect('student')}
              disabled={isLoading}
              className={`w-full bg-emerald-500 text-white font-semibold rounded-md px-4 py-3 shadow-sm hover:bg-emerald-600 transition duration-150 ease-in-out ${
                isLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              학생
            </button>
          </div>

          <p className="mt-6 text-sm text-gray-500">
            선택하신 역할은 나중에 변경할 수 있습니다.
          </p>
        </div>
      </main>
    </div>
  );
} 