'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Bars3Icon,
} from '@heroicons/react/24/outline';
import UserProfile from './UserProfile';

export default function Navbar() {
  const pathname = usePathname();
  
  let classId = '';
  if (pathname.startsWith('/class/')) {
    const pathParts = pathname.split('/');
    if (pathParts.length > 2) {
      classId = pathParts[2];
    }
  }

  const navLinks = [
    { name: '학급 목록', href: '/teacher' },
    { name: '대시보드', href: classId ? `/class/${classId}/dashboard` : undefined, requiresClassId: true },
    { name: '학급 일지', href: classId ? `/class/${classId}/journal` : undefined, requiresClassId: true },
    { name: '설문 작성', href: classId ? `/class/${classId}/survey` : undefined, requiresClassId: true },
    { name: '학급 분석', href: classId ? `/class/${classId}/analysis` : undefined, requiresClassId: true },
    { name: '쫑알쫑알', href: classId ? `/class/${classId}/schoolrecord` : undefined, requiresClassId: true },
    { name: '학생 관리', href: classId ? `/class/${classId}/students` : undefined, requiresClassId: true },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 h-14 bg-gray-900 shadow-md z-50 text-white flex items-center px-4">
      <div className="flex items-center justify-between w-full max-w-7xl mx-auto">
        <div className="flex items-center">
          <Link href="/teacher" className="flex items-center">
            <span className="text-xl font-bold text-indigo-400 mr-1">학생</span>
            <span className="text-xl font-bold">관계도</span>
          </Link>
        </div>
        
        <div className="hidden md:flex flex-grow justify-center items-center space-x-10">
          {navLinks.map((link) => {
            const isActive = (
              (pathname === link.href || pathname.startsWith(link.href + '/') || 
               (link.name === '대시보드' && classId && (pathname === `/class/${classId}/dashboard` || pathname === `/class/${classId}`))) ||
              (link.href?.startsWith('/class/') && pathname.startsWith(link.href)) ||
              (link.name === '학급 목록' && (pathname === '/teacher' || pathname === '/')) 
            );
            const isDisabled = link.requiresClassId && !classId;

            if (isDisabled) {
              return (
                <span
                  key={link.name}
                  className="text-base font-medium text-gray-500 cursor-not-allowed pb-1"
                >
                  {link.name}
                </span>
              );
            }

            return (
              <Link
                key={link.name}
                href={link.href!}
                className={`text-base font-medium pb-1 ${
                  isActive
                    ? 'text-indigo-300 border-b-2 border-indigo-400' 
                    : 'text-gray-300 hover:text-indigo-300'
                }`}
              >
                {link.name}
              </Link>
            );
          })}
        </div>
        
        <div className="flex items-center space-x-2">
          <UserProfile size="sm" />
        </div>
      </div>
    </nav>
  );
} 