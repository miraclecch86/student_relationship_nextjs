'use client';

import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState } from 'react';

export default function SelectRole() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRoleSelect = async (role: 'teacher' | 'student') => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('사용자 정보를 찾을 수 없습니다.');

      // 1. profiles 테이블 업데이트
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          role: role,
          role_verified: true 
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // 2. user_roles 테이블에 추가 (중복 방지)
      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({ 
          user_id: user.id,
          role: role 
        }, {
          onConflict: 'user_id,role'
        });

      if (roleError) throw roleError;

      // 3. 역할에 따른 리다이렉트
      if (role === 'teacher') {
        // 유저의 classId 가져오기
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('class_id')
          .eq('id', user.id)
          .single();
        
        if (profileError) throw profileError;
        if (!profile?.class_id) throw new Error('클래스 정보를 찾을 수 없습니다.');

        // 해당 클래스 페이지로 리다이렉트
        router.replace(`/class/${profile.class_id}`);
      } else {
        router.replace('/student');
      }

    } catch (error) {
      console.error('Role selection error:', error);
      setError('역할 선택 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h1 className="text-2xl font-bold text-center mb-6">당신의 역할을 선택해주세요</h1>
        
        <div className="space-y-4">
          <button
            onClick={() => handleRoleSelect('teacher')}
            disabled={isLoading}
            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300"
          >
            {isLoading ? '처리중...' : '선생님'}
          </button>
          
          <button
            onClick={() => handleRoleSelect('student')}
            disabled={isLoading}
            className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-300"
          >
            {isLoading ? '처리중...' : '학생'}
          </button>
        </div>

        {error && (
          <p className="mt-4 text-red-500 text-sm text-center">{error}</p>
        )}

        <p className="mt-6 text-sm text-gray-500 text-center">
          선택하신 역할은 나중에 변경할 수 있습니다.
        </p>
      </div>
    </div>
  );
} 