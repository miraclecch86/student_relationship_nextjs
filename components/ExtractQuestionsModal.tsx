'use client';

import React, { Fragment, useState, useRef, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { PhotoIcon, XMarkIcon, SparklesIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon, PlusIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface ExtractQuestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (questions: string[]) => void;
}

export default function ExtractQuestionsModal({ isOpen, onClose, onConfirm }: ExtractQuestionsModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedQuestions, setExtractedQuestions] = useState<string[]>([]);
  const [step, setStep] = useState<'upload' | 'edit'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state on open/close
  useEffect(() => {
    if (isOpen) {
      setFile(null);
      setPreviewUrl(null);
      setIsExtracting(false);
      setExtractedQuestions([]);
      setStep('upload');
    } else {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    }
  }, [isOpen]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) processFile(selectedFile);
  };

  const processFile = (selectedFile: File) => {
    if (!selectedFile.type.startsWith('image/') && selectedFile.type !== 'application/pdf') {
      toast.error('이미지 또는 PDF 파일만 업로드 가능합니다.');
      return;
    }
    setFile(selectedFile);
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
  };

  const handleExtract = async () => {
    if (!file) return;
    setIsExtracting(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/extract/questions', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || '추출에 실패했습니다.');
      }

      const data = await res.json();
      if (data.questions && Array.isArray(data.questions)) {
          setExtractedQuestions(data.questions);
          setStep('edit');
      } else {
          throw new Error('올바르지 않은 응답 형식입니다.');
      }
    } catch (error: any) {
      toast.error(error.message || '질문 추출 중 오류가 발생했습니다.');
      console.error(error);
    } finally {
      setIsExtracting(false);
    }
  };

  const updateQuestion = (index: number, value: string) => {
    const newQs = [...extractedQuestions];
    newQs[index] = value;
    setExtractedQuestions(newQs);
  };

  const removeQuestion = (index: number) => {
    const newQs = [...extractedQuestions];
    newQs.splice(index, 1);
    setExtractedQuestions(newQs);
  };

  const moveQuestion = (index: number, direction: -1 | 1) => {
    if (index + direction < 0 || index + direction >= extractedQuestions.length) return;
    const newQs = [...extractedQuestions];
    const temp = newQs[index];
    newQs[index] = newQs[index + direction];
    newQs[index + direction] = temp;
    setExtractedQuestions(newQs);
  };

  const handleAddEmptyQuestion = () => {
      setExtractedQuestions([...extractedQuestions, '']);
  };

  const handleConfirm = () => {
    const finalQs = extractedQuestions.map(q => q.trim()).filter(q => q.length > 0);
    if (finalQs.length === 0) {
        toast.error('추가할 질문이 없습니다.');
        return;
    }
    onConfirm(finalQs);
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={isExtracting ? () => {} : onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center text-black">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className={`w-full ${step === 'edit' ? 'max-w-5xl' : 'max-w-md'} transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-xl transition-all flex flex-col max-h-[90vh]`}>
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
                  <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900 flex items-center gap-2">
                    <SparklesIcon className="w-5 h-5 text-indigo-500" />
                    AI로 주관식 질문 자동 추출
                  </Dialog.Title>
                  <button onClick={onClose} disabled={isExtracting} className="text-gray-400 hover:text-gray-500 disabled:opacity-50">
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>

                <div className="p-6 overflow-y-auto flex-grow">
                  {step === 'upload' ? (
                    <div className="flex flex-col items-center justify-center">
                      <div 
                        className={`w-full max-w-sm rounded-xl border-2 border-dashed ${file ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-300 text-gray-500 hover:border-indigo-400 hover:bg-gray-50'} p-8 text-center cursor-pointer transition-colors duration-200`}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <PhotoIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                        <span className="mt-2 block text-sm font-semibold text-gray-900">
                          {file ? file.name : "사진/PDF 파일 선택 (클릭)"}
                        </span>
                        <p className="mt-1 text-xs text-gray-500">PNG, JPG, JPEG, PDF</p>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={handleFileSelect} />
                      </div>

                      {file && file.type === 'application/pdf' ? (
                        <div className="mt-6 w-full max-w-sm rounded-xl border border-gray-200 overflow-hidden shadow-sm flex flex-col items-center justify-center p-6 bg-gray-50 h-48">
                           <DocumentTextIcon className="w-12 h-12 text-indigo-400 mb-3" />
                           <span className="text-sm font-medium text-gray-700 text-center break-all">{file.name}</span>
                        </div>
                      ) : previewUrl && (
                        <div className="mt-6 w-full max-w-sm rounded-xl border border-gray-200 overflow-hidden shadow-sm relative">
                           <img src={previewUrl} alt="Preview" className="w-full h-auto max-h-48 object-contain bg-black/5" />
                        </div>
                      )}

                      <div className="mt-8 flex justify-end w-full">
                        <button
                           onClick={handleExtract}
                           disabled={!file || isExtracting}
                           className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                        >
                           {isExtracting ? (
                             <>
                               <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                               </svg>
                               AI가 추출 중입니다...
                             </>
                           ) : (
                             <>
                               <SparklesIcon className="w-5 h-5" />
                               질문 추출하기
                             </>
                           )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col md:flex-row gap-6 h-full">
                      {/* Left Side: Image Preview */}
                      <div className="w-full md:w-1/2 flex flex-col bg-gray-50 rounded-xl border border-gray-200 overflow-hidden relative min-h-[300px] h-full">
                          <div className="p-3 bg-gray-100 border-b border-gray-200 font-medium text-sm text-gray-700 flex justify-between items-center">
                              <span>원본 이미지</span>
                              <span className="text-xs font-normal text-gray-500">참고용</span>
                          </div>
                          <div className="flex-grow p-2 relative overflow-auto">
                              {file && file.type === 'application/pdf' ? (
                                  <iframe src={previewUrl! + "#toolbar=0"} className="w-full h-full min-h-[400px]" title="PDF Preview" />
                              ) : (
                                  previewUrl && <img src={previewUrl} alt="Original document" className="w-full h-auto object-contain" />
                              )}
                          </div>
                      </div>

                      {/* Right Side: Extracted Questions List */}
                      <div className="w-full md:w-1/2 flex flex-col h-full max-h-[60vh] overflow-y-auto pr-2">
                        <div className="mb-4">
                            <h4 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">추출된 주관식 질문</h4>
                            <p className="text-xs text-gray-500 mt-1">AI가 인식한 질문입니다. 오타가 있다면 직접 수정해 주세요.</p>
                        </div>

                        <div className="space-y-3 flex-grow">
                            {extractedQuestions.map((q, idx) => (
                                <div key={idx} className="flex gap-2 items-start bg-white p-3 rounded-lg border border-gray-200 shadow-sm group">
                                    <div className="flex flex-col gap-1 mt-0.5 opacity-50 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => moveQuestion(idx, -1)} disabled={idx === 0} className="p-0.5 hover:bg-gray-100 rounded text-gray-500 disabled:opacity-30"><ArrowUpIcon className="w-4 h-4" /></button>
                                        <button onClick={() => moveQuestion(idx, 1)} disabled={idx === extractedQuestions.length - 1} className="p-0.5 hover:bg-gray-100 rounded text-gray-500 disabled:opacity-30"><ArrowDownIcon className="w-4 h-4" /></button>
                                    </div>
                                    <div className="flex-grow">
                                        <textarea
                                            value={q}
                                            onChange={(e) => updateQuestion(idx, e.target.value)}
                                            rows={2}
                                            className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm resize-none"
                                            placeholder="질문 내용을 입력하세요"
                                        />
                                    </div>
                                    <button onClick={() => removeQuestion(idx)} className="mt-1 p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-md transition-colors" title="삭제"><TrashIcon className="w-5 h-5"/></button>
                                </div>
                            ))}
                            
                            <button 
                                onClick={handleAddEmptyQuestion}
                                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex justify-center items-center gap-2 text-sm font-medium"
                            >
                                <PlusIcon className="w-4 h-4" /> 질문 추가하기
                            </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {step === 'edit' && (
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0">
                    <button
                      onClick={() => setStep('upload')}
                      className="px-4 py-2 font-medium bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      다시 업로드
                    </button>
                    <button
                      onClick={handleConfirm}
                      className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                      결과 적용하기
                    </button>
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
