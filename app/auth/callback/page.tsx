'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // 세션 처리를 위해 getUser() 또는 getSession()을 호출할 수 있지만,
        // 에러 처리를 제외하고 특별한 로직 없이 성공 시 리디렉션합니다.
        const { error } = await supabase.auth.getSession(); 
        
        if (error) {
          console.error('[DEBUG Callback] Error during getSession on callback:', error);
          router.replace('/login?error=auth_callback_failed');
          return;
        }
        
        // 역할 확인 없이 기본 페이지(예: /teacher)로 리디렉션
        console.log('[DEBUG Callback] Auth successful, redirecting to /teacher...');
        router.replace('/teacher'); 

      } catch (err) {
        console.error('[DEBUG Callback] Unexpected error during callback handling:', err);
        router.replace('/login?error=callback_exception');
      }
    };

    handleAuthCallback();
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div>인증 처리 중...</div>
    </div>
  );
} 