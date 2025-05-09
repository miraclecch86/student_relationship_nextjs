'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { 
  Bars3Icon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import UserProfile from './UserProfile';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  
  return (
    <nav className="fixed top-0 left-0 right-0 h-14 bg-gray-900 shadow-md z-50 text-white flex items-center px-4">
      <div className="flex items-center justify-between w-full max-w-screen-2xl mx-auto">
        {/* 왼쪽: 로고 및 햄버거 메뉴 */}
        <div className="flex items-center">
          <button className="md:hidden p-2 mr-2">
            <Bars3Icon className="w-6 h-6" />
          </button>
          <Link href="/teacher" className="flex items-center">
            <span className="text-xl font-bold text-indigo-400 mr-1">학생</span>
            <span className="text-xl font-bold">관계도</span>
          </Link>
        </div>
        
        {/* 중앙: 검색창(옵션) */}
        <div className="hidden md:flex mx-auto max-w-xl w-full px-6">
          <div className="relative w-full">
            <input 
              type="text" 
              placeholder="학급 검색" 
              className="w-full bg-gray-800 rounded-full py-1.5 pl-10 pr-4 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          </div>
        </div>
        
        {/* 오른쪽: 사용자 프로필 */}
        <div className="flex items-center">
          <UserProfile size="sm" />
        </div>
      </div>
    </nav>
  );
} 