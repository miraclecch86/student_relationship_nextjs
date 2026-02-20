'use client';

import React, { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { SparklesIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';

interface DemoModalProps {
    isOpen: boolean;
    onClose: () => void;
    message?: string;
}

export default function DemoModal({
    isOpen,
    onClose,
    message = "실제 학급을 생성하시면 모든 기능을 자유롭게 사용하실 수 있습니다."
}: DemoModalProps) {
    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95 translateY-4"
                            enterTo="opacity-100 scale-100 translateY-0"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100 translateY-0"
                            leaveTo="opacity-0 scale-95 translateY-4"
                        >
                            <Dialog.Panel className="w-full max-w-sm transform overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 p-6 text-left align-middle shadow-2xl transition-all border border-indigo-400">

                                <div className="flex flex-col items-center justify-center text-center space-y-4">
                                    <div className="flex items-center justify-center w-12 h-12 bg-white/20 rounded-full backdrop-blur-sm shadow-inner">
                                        <SparklesIcon className="w-7 h-7 text-yellow-300" aria-hidden="true" />
                                    </div>

                                    <Dialog.Title
                                        as="h3"
                                        className="text-lg font-bold leading-6 text-white drop-shadow-md"
                                    >
                                        체험판 안내
                                    </Dialog.Title>

                                    <div className="bg-white/10 rounded-xl p-4 w-full backdrop-blur-sm border border-white/20 shadow-sm">
                                        <p className="text-[15px] font-medium text-white mb-2 flex items-start text-left">
                                            <CheckCircleIcon className="w-5 h-5 text-green-300 mr-2 flex-shrink-0 mt-0.5" />
                                            <span>{message}</span>
                                        </p>
                                        <p className="text-sm text-indigo-100 text-left pl-7">
                                            새로운 학급을 추가하여 쫑알쫑알의 스마트한 AI 기능들을 맘껏 누려보세요!
                                        </p>
                                    </div>

                                    <div className="mt-6 w-full">
                                        <motion.button
                                            type="button"
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            className="w-full inline-flex justify-center rounded-xl bg-white px-4 py-3 text-sm font-bold text-indigo-600 shadow-md hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 transition-all"
                                            onClick={onClose}
                                        >
                                            확인했습니다
                                        </motion.button>
                                    </div>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}
