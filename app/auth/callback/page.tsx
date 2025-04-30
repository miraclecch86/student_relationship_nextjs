'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState('인증 처리 중입니다...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    console.log('[DEBUG Callback] Page mounted. Setting up auth listener...');

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      console.log('[DEBUG Callback] Auth state changed:', event);

      if (event === 'SIGNED_IN' && session) {
        console.log('[DEBUG Callback] SIGNED_IN detected. Redirecting to root (/).');
        setMessage('로그인 성공! 잠시 후 이동합니다...');
        
        // 역할 확인 로직 제거! 바로 루트로 리디렉션하여 미들웨어가 처리하도록 위임
        router.replace('/'); 

      } else if (event === 'SIGNED_OUT') {
        console.log('[DEBUG Callback] SIGNED_OUT detected. Redirecting to login.');
        // 로그아웃 시에는 로그인 페이지로
        router.replace('/login');
      }
      // 다른 이벤트는 무시 (INITIAL_SESSION 등)
      
    });

    return () => {
      console.log('[DEBUG Callback] Page unmounting. Unsubscribing auth listener.');
      isMounted = false;
      subscription?.unsubscribe();
    };

  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md text-center">
        {!error && <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>}
        <p className={`text-gray-600 ${error ? 'text-red-500 font-semibold' : ''}`}>
          {error ? `오류: ${error}` : message}
        </p>
        {error && 
          <p className="text-sm text-gray-500 mt-2">문제가 지속되면 관리자에게 문의하세요.</p>
        }
      </div>
    </div>
  );
} 