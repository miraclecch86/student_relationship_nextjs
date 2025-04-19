'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError) {
          console.error('Error getting user:', userError);
          router.replace('/login');
          return;
        }

        if (!user) {
          console.log('[DEBUG] No user found in callback, redirecting to login.');
          router.replace('/login');
          return;
        }

        const userRole = user?.user_metadata?.role;
        console.log('[DEBUG] Checking role from getUser() in callback page. userRole:', userRole, 'User metadata:', user?.user_metadata);

        if (!userRole) {
          router.replace('/select-role');
        } else if (userRole === 'teacher') {
          router.replace('/');
        } else if (userRole === 'student') {
          router.replace('/student');
        } else {
          console.warn('Unexpected user role:', userRole);
          router.replace('/select-role');
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        router.replace('/login');
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