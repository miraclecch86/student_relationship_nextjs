'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRightOnRectangleIcon, UserIcon } from '@heroicons/react/24/outline';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

type UserProfileProps = {
  size?: 'sm' | 'md' | 'lg';
};

export default function UserProfile({ size = 'md' }: UserProfileProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 사용자 정보 가져오기
    const getUserProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // 이메일이 undefined일 경우 null로 설정
        const email = session.user.email || '';
        setUserEmail(email);
        
        // 사용자 이름은 이메일에서 @ 앞부분 추출
        const nameFromEmail = email.split('@')[0] || null;
        setUserName(nameFromEmail);
      }
    };

    getUserProfile();
  }, []);

  useEffect(() => {
    // 외부 클릭 감지하여 드롭다운 닫기
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.replace('/login');
    } catch (err) {
      console.error('Logout error:', err);
      toast.error('로그아웃 중 오류가 발생했습니다.');
    }
  };

  const handleRoleChange = () => {
    // API 라우트를 사용하여 역할 재설정
    window.location.href = '/api/reset-role';
  };

  // 사용자 이니셜을 가져오는 함수
  const getInitial = (name: string | null) => {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  };

  // 이름에 기반한 색상 생성 함수 - 파란색 계열로 변경
  const getColorByName = (name: string | null): string => {
    if (!name) return 'bg-blue-500';
    
    // 파란색 계열 컬러 팔레트
    const colors = [
      'bg-blue-500', 'bg-sky-500', 'bg-cyan-500', 'bg-teal-500',
      'bg-blue-600', 'bg-sky-600', 'bg-cyan-600', 'bg-teal-600',
      'bg-indigo-500', 'bg-indigo-600', 'bg-blue-700', 'bg-sky-700'
    ];
    
    // 이름의 각 문자 코드 합계로 일관된 색상 선택
    const sum = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[sum % colors.length];
  };

  const userColor = getColorByName(userName);
  
  // 크기 조정
  const avatarSize = size === 'sm' ? 'w-7 h-7' : size === 'lg' ? 'w-10 h-10' : 'w-8 h-8';
  const dropdownAvatarSize = size === 'sm' ? 'w-9 h-9' : size === 'lg' ? 'w-12 h-12' : 'w-10 h-10';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center rounded-full transition-all duration-300 focus:outline-none"
        aria-expanded={isOpen}
      >
        <div className={`${avatarSize} rounded-full flex items-center justify-center text-white font-medium shadow-lg transition-all duration-300 ${userColor}`}>
          {getInitial(userName)}
        </div>
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute right-0 mt-2 w-60 origin-top-right bg-white/90 backdrop-blur-sm rounded-lg shadow-xl overflow-hidden z-20 border border-gray-100"
          >
            <div className="px-4 py-3 bg-gradient-to-br from-blue-50 to-sky-50 border-b border-gray-100">
              <div className="flex items-center space-x-3">
                <div className={`${dropdownAvatarSize} rounded-full flex items-center justify-center text-white font-medium shadow ${userColor}`}>
                  {getInitial(userName)}
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-700 truncate">{userName || '사용자'}</p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{userEmail || '이메일 정보 없음'}</p>
                </div>
              </div>
            </div>
            <div className="p-1">
              <button
                onClick={handleRoleChange}
                className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 rounded-md transition-colors duration-200 my-1"
              >
                <UserIcon className="w-4 h-4 mr-2 text-blue-600" />
                <span>역할 변경하기</span>
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-red-50 rounded-md transition-colors duration-200 my-1"
              >
                <ArrowRightOnRectangleIcon className="w-4 h-4 mr-2 text-red-500" />
                <span>로그아웃</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
} 