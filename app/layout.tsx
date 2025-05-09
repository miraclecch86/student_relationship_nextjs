'use client';

import '@/styles/globals.css';
import type { Metadata } from 'next'; // Metadata는 서버 컴포넌트에서만 사용 가능
import { Inter } from 'next/font/google';
import React, { useState } from 'react'; // useState import
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'; // React Query Provider import
import { Toaster } from 'react-hot-toast'; // Toaster 임포트
import Navbar from '@/components/Navbar'; // Navbar 컴포넌트 임포트

const inter = Inter({ subsets: ['latin'] });

// Metadata 객체는 제거 (또는 별도 서버 컴포넌트로 분리)
// export const metadata: Metadata = {
//   title: '학생 관계 시각화',
//   description: '학급 내 학생들의 관계를 관리하고 시각화하는 도구',
// };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // QueryClient 인스턴스 생성 (컴포넌트 라이프사이클 동안 유지)
  const [queryClient] = useState(() => new QueryClient());

  return (
    <html lang="ko">
      <body className={`${inter.className} bg-gray-50`}> {/* 기본 배경색 적용 */}
        <QueryClientProvider client={queryClient}> {/* Provider로 감싸기 */}
          <Navbar /> {/* 상단 네비게이션 바 추가 */}
          <main className="pt-14"> {/* 네비게이션 바 높이만큼 상단 패딩 추가 */}
            {children}
          </main>
          <Toaster position="top-center" /> {/* Toaster 위치를 top-center로 변경 */}
        </QueryClientProvider>
      </body>
    </html>
  );
}
