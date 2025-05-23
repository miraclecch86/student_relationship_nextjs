'use client';

import { XMarkIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';

interface BannerProps {
  text: string;
  onClose: () => void;
  show: boolean;
}

export default function Banner({ text, onClose, show }: BannerProps) {
  if (!show) {
    return null;
  }

  return (
    <div className="bg-indigo-600 text-white">
      <div className="max-w-7xl mx-auto py-3 px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between flex-wrap">
          <div className="w-0 flex-1 flex items-center">
            <span className="flex p-2 rounded-lg bg-indigo-800">
              <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3.418A4.001 4.001 0 0116 0H7a3 3 0 00-2.967 2.618c.01.06.015.12.015.182v3.876c0 .06-.004.121-.014.18C4.004 7.065 4 7.124 4 7.184v4.018a2.5 2.5 0 001.436 2.481z" />
              </svg>
            </span>
            <p className="ml-3 font-medium text-white truncate">
              <span className="md:hidden">{text}</span>
              <span className="hidden md:inline">{text}</span>
            </p>
          </div>
          <div className="order-2 flex-shrink-0 sm:order-3 sm:ml-3">
            <button
              type="button"
              className="-mr-1 flex p-2 rounded-md hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-white sm:-mr-2"
              onClick={onClose}
            >
              <span className="sr-only">닫기</span>
              <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 