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
      // 역할 업데이트 전 세션 갱신 시도
      console.log('[DEBUG SelectRole] Attempting to refresh session...');
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        console.error('[DEBUG SelectRole] Error refreshing session:', refreshError);
        // 세션 갱신 실패 시, 로그인 재시도 유도
        throw new Error('사용자 세션 갱신에 실패했습니다. 다시 로그인해주세요.');
      }
      console.log('[DEBUG SelectRole] Session refreshed successfully.');

      // 갱신된 세션 정보 가져오기
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session?.user) {
        console.error('[DEBUG SelectRole] Error getting session or user after refresh:', sessionError);
        throw new Error('갱신된 사용자 세션 정보를 찾을 수 없습니다.');
      }
      const user = session.user;

      console.log('[DEBUG SelectRole] Updating role for user (after refresh):', user.id);

      const { error: metadataError } = await supabase.auth.updateUser({
        data: { role: role }
      });

      if (metadataError) {
        console.error('[DEBUG SelectRole] Metadata update error:', metadataError);
        throw metadataError;
      }

      console.log('[DEBUG SelectRole] User metadata updated successfully');

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({ 
          id: user.id, 
          role: role,
          role_verified: true,
          email: user.email
        }, { 
          onConflict: 'id' 
        });

      if (profileError) {
        console.error('[DEBUG SelectRole] Profile upsert error:', profileError);
        throw profileError;
      }

      console.log('[DEBUG SelectRole] Profile upserted successfully');

      const { error: roleTableError } = await supabase
        .from('user_roles')
        .upsert({ 
          user_id: user.id,
          role: role 
        }, {
          onConflict: 'user_id, role' 
        });
      
      if (roleTableError) {
        console.error('[DEBUG SelectRole] User_roles upsert error:', roleTableError);
        if (roleTableError.code === '23505') {
            console.error('[DEBUG SelectRole] Unique constraint violation on user_roles.');
        } else if (roleTableError.code === '42P10') {
             console.error('[DEBUG SelectRole] ON CONFLICT specification error. Check constraint columns.');
        }
        throw roleTableError;
      }

      console.log('[DEBUG SelectRole] User_roles upserted successfully');

      if (role === 'teacher') {
        router.replace('/teacher');
      } else {
        router.replace('/student');
      }

    } catch (error) {
      console.error('[DEBUG SelectRole] Role selection error caught:', error);
      // 세션 관련 에러 메시지 표시
      if (error instanceof Error && (error.message.includes('세션') || error.message.includes('session'))) {
        setError(error.message);
      } else {
        setError('역할 선택 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h1 className="text-2xl font-bold text-center mb-6 text-indigo-600">당신의 역할을 선택해주세요</h1>
        
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