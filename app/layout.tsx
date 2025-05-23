'use client';

import '@/styles/globals.css';
import { Inter } from 'next/font/google';
import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import Navbar from '@/components/Navbar';
import { usePathname } from 'next/navigation';

const inter = Inter({ subsets: ['latin'] });

// 클라이언트 컴포넌트에서는 metadata를 직접 익스포트할 수 없습니다.
// 아래 주석 처리된 metadata 정의는 서버 컴포넌트로 이동해야 합니다.
// export const metadata = {
//   title: '학급 관계 분석',
//   description: '학생 관계 데이터를 분석하는 애플리케이션입니다.',
// };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(() => new QueryClient());
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const loginPaths = ['/auth/login', '/login'];
  const hideNavbar = loginPaths.includes(pathname);

  if (!isMounted) {
    return (
      <html lang="ko">
        <head />
        <body className={inter.className}>
          <div className="min-h-screen bg-gray-100"></div>
        </body>
      </html>
    );
  }

  return (
    <html lang="ko" suppressHydrationWarning={true}>
      <head />
      <body className={`${inter.className} bg-gray-100`}>
        <QueryClientProvider client={queryClient}>
          {!hideNavbar && <Navbar />}
          <main className={!hideNavbar ? "pt-14" : ""}>
            {children}
          </main>
          <Toaster position="top-right" />
        </QueryClientProvider>
      </body>
    </html>
  );
}
