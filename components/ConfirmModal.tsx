'use client';

import React, { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = '확인',
  cancelText = '취소',
  isLoading = false,
}: ConfirmModalProps) {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-100"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-transparent" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-lg bg-white p-6 text-left align-middle shadow-lg transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-semibold leading-6 text-gray-900 flex items-center"
                >
                  <ExclamationTriangleIcon className="w-6 h-6 text-red-600 mr-2" aria-hidden="true" />
                  {title}
                </Dialog.Title>
                <div className="mt-3">
                  <p className="text-sm text-gray-600">
                    {message}
                  </p>
                </div>

                <div className="mt-6 flex justify-end space-x-2">
                  <motion.button
                    type="button"
                    className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md shadow-sm hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
                    onClick={onClose}
                  >
                    {cancelText}
                  </motion.button>
                  <motion.button
                    type="button"
                    className={`inline-flex justify-center px-4 py-2 text-sm font-medium text-white rounded-md shadow ${ 
                      isLoading ? 'bg-gray-400 cursor-not-allowed' : (confirmText === '삭제' ? 'bg-red-500 hover:bg-red-600 focus:ring-red-300' : 'bg-indigo-500 hover:bg-indigo-600 focus:ring-indigo-300')
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg`}
                    onClick={onConfirm}
                    disabled={isLoading}
                  >
                    {isLoading ? '처리 중...' : confirmText}
                  </motion.button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
