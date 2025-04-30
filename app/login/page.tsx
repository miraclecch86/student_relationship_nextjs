'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (provider: 'google' | 'kakao') => {
    setError(null);
    setIsLoading(true);

    const redirectUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3000/auth/callback'
      : 'https://student-relationship.vercel.app/auth/callback';

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (oauthError) {
      console.error(`${provider} Login Error:`, oauthError);
      setError(`로그인 중 오류가 발생했습니다: ${oauthError.message}`);
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
          <h2 className="text-2xl font-semibold mb-6 text-gray-700">로그인</h2>

          {error && (
            <p className="text-red-500 text-sm mb-4 p-3 bg-red-100 rounded border border-red-300">
              {error}
            </p>
          )}

          <div className="space-y-4">
            <button
              onClick={() => handleLogin('google')}
              disabled={isLoading}
              className="w-full bg-white text-gray-800 border border-gray-300 rounded-md px-4 py-2 shadow-sm hover:bg-gray-100 flex items-center justify-center space-x-2 transition duration-150 ease-in-out disabled:opacity-50"
            >
              {isLoading ? (
                 <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                   <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                   <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                 </svg>
              ) : (
                <svg
                  className="w-5 h-5"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 48 48"
                >
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.4 0 6.3 1.2 8.7 3.4l6.5-6.5C35.3 2.9 29.9 1 24 1 14.9 1 7.4 6.5 3.9 14.1l7.7 6C13.2 13.4 18.2 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.1 24.4c0-1.6-.1-3.2-.4-4.7H24v8.9h12.4c-.5 2.9-2.1 5.4-4.6 7.1l7.3 5.7c4.3-4 6.9-9.8 6.9-17z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M11.6 28.1c-.4-1.2-.6-2.5-.6-3.8s.2-2.6.6-3.8l-7.7-6C2.6 17.7 1 20.7 1 24.3s1.6 6.6 3.9 9.5l7.7-5.7z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 47c5.9 0 11.1-1.9 14.8-5.2l-7.3-5.7c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.8-3.9-12.6-9.2l-7.7 6C7.4 41.5 14.9 47 24 47z"
                  />
                  <path fill="none" d="M0 0h48v48H0z" />
                </svg>
              )}
              <span>Google 계정으로 로그인</span>
            </button>

            <button
              onClick={() => handleLogin('kakao')}
              disabled={isLoading}
              className="w-full bg-[#FEE500] text-black font-bold rounded-md px-4 py-2 shadow-sm hover:brightness-95 flex items-center justify-center space-x-2 transition duration-150 ease-in-out disabled:opacity-50 disabled:brightness-75"
            >
             {isLoading ? (
                 <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                   <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                   <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                 </svg>
              ) : (
                <svg
                  className="w-5 h-5"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                >
                  <path
                    fill="#3C1E1E"
                    d="M12 3C6.5 3 2 6.5 2 11c0 2.8 1.9 5.2 4.7 6.5-.2.6-.7 2.3-.8 2.6 0 0 0 .2.1.2s.2 0 .2 0c.3-.1 3.3-2.2 3.8-2.6.6.1 1.3.2 2 .2 5.5 0 10-3.5 10-8 0-4.5-4.5-8-10-8"
                  />
                </svg>
              )}
              <span>카카오 계정으로 로그인</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
} 