'use client';

import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState, Suspense } from 'react';

// 선생님 이름 입력 컴포넌트
function TeacherNameInputContent({ resetParam }: { resetParam: string | null }) {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teacherName, setTeacherName] = useState('');
  
  // 페이지 진입 시 세션 완전 초기화 및 갱신
  useEffect(() => {
    const refreshAuthState = async () => {
      const wasReset = resetParam === 'true';
      
      if (wasReset) {
        // 브라우저 스토리지 초기화
        sessionStorage.clear();
        localStorage.removeItem('supabase.auth.token');
      }
      
      try {
        // Supabase 세션 명시적 갱신
        const { error } = await supabase.auth.refreshSession();
        if (error) {
          console.log('세션 갱신 실패:', error.message);
        }
      } catch (err) {
        console.log('세션 갱신 중 오류:', err);
      }
    };
    
    refreshAuthState();
  }, [supabase.auth, resetParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!teacherName.trim()) {
      setError('선생님 이름을 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 역할 업데이트 전 세션 갱신 시도
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        console.log('세션 갱신 실패:', refreshError.message);
        throw new Error('사용자 세션 갱신에 실패했습니다. 다시 로그인해주세요.');
      }

      // 갱신된 세션 정보 가져오기
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session?.user) {
        console.log('세션 정보 가져오기 실패:', sessionError);
        throw new Error('갱신된 사용자 세션 정보를 찾을 수 없습니다.');
      }
      const user = session.user;

      // 사용자 메타데이터에 선생님 이름과 역할 저장
      const { error: metadataError } = await supabase.auth.updateUser({
        data: { 
          role: 'teacher',
          teacher_name: teacherName.trim(),
          role_verified: true
        }
      });

      if (metadataError) {
        console.log('사용자 메타데이터 업데이트 실패:', metadataError.message);
        throw metadataError;
      }

      // 메타데이터만 사용 (profiles, user_roles 테이블 사용 안함)

      // 세션 강제 갱신하여 메타데이터 즉시 반영
      await supabase.auth.refreshSession();
      
      // 선생님 페이지로 이동
      router.replace('/teacher');

    } catch (error) {
      console.log('선생님 정보 설정 오류:', error);
      // 세션 관련 에러 메시지 표시
      if (error instanceof Error && (error.message.includes('세션') || error.message.includes('session'))) {
        setError(error.message);
      } else {
        setError('선생님 정보 설정 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white p-8 rounded-xl shadow-lg w-96">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">환영합니다!</h1>
          <p className="text-gray-600">선생님 이름을 입력해 주세요</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="teacherName" className="block text-sm font-medium text-gray-700 mb-2">
              선생님 이름
            </label>
            <input
              type="text"
              id="teacherName"
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
              placeholder="홍길동"
              disabled={isLoading}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors disabled:bg-gray-100 text-gray-900 placeholder-gray-400"
              autoFocus
            />
          </div>
          
          <button
            type="submit"
            disabled={isLoading || !teacherName.trim()}
            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isLoading ? '설정 중...' : '시작하기'}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm text-center">{error}</p>
          </div>
        )}

        <p className="mt-6 text-sm text-gray-500 text-center">
          입력하신 이름은 나중에 수정할 수 있습니다.
        </p>
      </div>
    </div>
  );
}

// useSearchParams를 사용하는 컴포넌트 - Suspense로 감싸서 사용됨
function TeacherNameInputWithParams() {
  const searchParams = useSearchParams();
  const resetParam = searchParams.get('reset');
  
  return <TeacherNameInputContent resetParam={resetParam} />;
}

// 메인 페이지 컴포넌트
export default function TeacherNameInput() {
  // Suspense로 감싸서 useSearchParams 사용하는 컴포넌트를 렌더링
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white p-8 rounded-xl shadow-lg w-96">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">로딩 중...</h1>
          </div>
        </div>
      </div>
    }>
      <TeacherNameInputWithParams />
    </Suspense>
  );
} 