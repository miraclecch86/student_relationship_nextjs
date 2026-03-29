'use client';

import React, { Fragment, useState, useRef, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { DocumentTextIcon, XMarkIcon, SparklesIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { supabase, Question } from '@/lib/supabase';

interface ExtractAnswersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (answers: Record<string, string>) => void;
  studentName: string;
  studentId: string;
  surveyId: string;
  questions: Question[];
}

// 이미지 압축 헬퍼 (Vercel 4.5MB 용량 제한 및 속도 개선)
const compressImageFile = async (file: File): Promise<File> => {
  if (!file.type.startsWith('image/')) return file;
  
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        const MAX_DIM = 2400;

        if (width > height && width > MAX_DIM) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else if (height > MAX_DIM) {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(new File([blob], file.name, { type: 'image/jpeg' }));
          } else {
            resolve(file);
          }
        }, 'image/jpeg', 0.8);
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
};

export default function ExtractAnswersModal({ isOpen, onClose, onConfirm, studentName, studentId, surveyId, questions }: ExtractAnswersModalProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [extractedAnswers, setExtractedAnswers] = useState<Record<string, string>>({});
  const [existingAnswers, setExistingAnswers] = useState<Record<string, string>>({});
  const [step, setStep] = useState<'upload' | 'edit'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setFiles([]);
      setPreviewUrls([]);
      setIsExtracting(false);
      setIsDragging(false);
      setExtractedAnswers({});
      setExistingAnswers({});
      setStep('upload');
      
      const initialAnswers: Record<string, string> = {};
      questions.forEach(q => initialAnswers[q.id] = '');
      setExtractedAnswers(initialAnswers);

      const fetchExisting = async () => {
          const { data, error } = await supabase
             .from('answers')
             .select('*')
             .eq('student_id', studentId)
             .eq('survey_id', surveyId);
          
          if (data && !error) {
              const existing: Record<string, string> = {};
              data.forEach(ans => {
                  const text = ans.answer_text || '';
                  existing[ans.question_id] = text;
                  initialAnswers[ans.question_id] = text; // 기본값을 기존 답변으로 채우기
              });
              setExistingAnswers(existing);
              setExtractedAnswers({ ...initialAnswers });
          }
      };
      
      fetchExisting();
    } else {
      previewUrls.forEach(url => URL.revokeObjectURL(url));
    }
  }, [isOpen, questions, studentId, surveyId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) processFiles(Array.from(e.target.files));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) processFiles(Array.from(e.dataTransfer.files));
  };

  const processFiles = (selectedFiles: File[]) => {
    const validFiles = selectedFiles.filter(file => {
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf';
      const isHwp = file.name.toLowerCase().endsWith('.hwp') || file.name.toLowerCase().endsWith('.hwpx');
      return isImage || isPdf || isHwp;
    });

    if (validFiles.length === 0) {
      toast.error('지원하지 않는 파일 형식입니다. (이미지, PDF, HWP만 가능)');
      return;
    }

    setFiles(prev => [...prev, ...validFiles]);
    const urls = validFiles.map(f => URL.createObjectURL(f));
    setPreviewUrls(prev => [...prev, ...urls]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => {
        URL.revokeObjectURL(prev[index]);
        return prev.filter((_, i) => i !== index);
    });
  };

  const handleExtract = async () => {
    if (files.length === 0) return;
    if (questions.length === 0) {
      toast.error('등록된 질문이 없습니다. 질문을 먼저 추가해주세요.');
      return;
    }

    setIsExtracting(true);
    
    try {
      const formData = new FormData();
      
      // 병렬로 모든 이미지 압축 처리
      const compressedFiles = await Promise.all(files.map(f => compressImageFile(f)));
      compressedFiles.forEach(f => formData.append('files', f));
      
      formData.append('questions', JSON.stringify(questions.map(q => ({ id: q.id, text: q.question_text }))));

      const res = await fetch('/api/extract/answers', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || '답변 추출에 실패했습니다.');
      }

      const data = await res.json();
      if (data.answers && typeof data.answers === 'object') {
          // 1. 기존 답변의 복사본을 베이스로 시작
          const mergedAnswers = { ...existingAnswers }; 
          
          // 2. 새로 추출된 답변에서 빈 값이 아닌 것들만 덮어쓰기
          Object.entries(data.answers as Record<string, string>).forEach(([qId, text]) => {
              if (text && text.trim().length > 0) {
                  mergedAnswers[qId] = text;
              }
          });
          
          // 3. 기존에도 없었고 새로 추출도 안된 항목은 빈 문자열로 보장
          questions.forEach(q => {
              if (!mergedAnswers[q.id]) {
                  mergedAnswers[q.id] = '';
              }
          });

          setExtractedAnswers(mergedAnswers);
          setStep('edit');
      } else {
          throw new Error('올바르지 않은 응답 형식입니다.');
      }
    } catch (error: any) {
      toast.error(error.message || '답변 추출 중 오류가 발생했습니다.');
      console.error(error);
    } finally {
      setIsExtracting(false);
    }
  };

  const updateAnswer = (questionId: string, value: string) => {
    setExtractedAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleConfirm = () => {
    onConfirm(extractedAnswers);
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
              <Dialog.Panel className={`w-full ${step === 'edit' ? 'max-w-5xl h-[85vh]' : 'max-w-md'} transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-xl transition-all flex flex-col max-h-[90vh]`}>
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
                  <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900 flex items-center gap-2">
                    <SparklesIcon className="w-5 h-5 text-indigo-500" />
                    {studentName} 학생 답변 AI 인식
                  </Dialog.Title>
                  <button onClick={onClose} disabled={isExtracting} className="p-1 text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-200 transition-colors disabled:opacity-50">
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>

                <div className="p-6 flex-grow flex flex-col min-h-0 overflow-hidden">
                  {step === 'upload' ? (
                    <div className="flex flex-col items-center justify-center h-full overflow-y-auto">
                      <div 
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`w-full max-w-sm rounded-xl border-2 border-dashed ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'} p-8 text-center cursor-pointer transition-all duration-200 group`}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <DocumentTextIcon className={`mx-auto h-12 w-12 mb-4 ${isDragging ? 'text-indigo-500' : 'text-gray-400 group-hover:text-indigo-400'} transition-colors duration-200`} />
                        <span className="mt-2 block text-base font-semibold text-gray-900">
                          {files.length > 0 ? "파일 추가 첨부하기" : "학생 설문지/사진 여러장 추가"}
                        </span>
                        <p className="mt-2 text-sm text-gray-500">클릭하거나 파일을 여기로 드래그하세요</p>
                        <p className="mt-1 text-xs text-gray-400">지원: PNG, JPG, PDF, HWP</p>
                        <input type="file" multiple ref={fileInputRef} className="hidden" accept="image/*,application/pdf,.hwp,.hwpx" onChange={handleFileSelect} />
                      </div>

                      {files.length > 0 && (
                        <div className="mt-6 w-full max-w-sm flex flex-col gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                          {files.map((f, i) => (
                             <div key={i} className="flex justify-between items-center p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                               <div className="flex items-center gap-3 overflow-hidden">
                                  {f.type.startsWith('image/') ? (
                                      <img src={previewUrls[i]} alt="preview" className="w-8 h-8 object-cover rounded bg-gray-100 border border-gray-200" />
                                  ) : (
                                      <DocumentTextIcon className="w-8 h-8 text-indigo-400" />
                                  )}
                                  <span className="text-sm font-medium text-gray-700 truncate" title={f.name}>{f.name}</span>
                               </div>
                               <button onClick={(e) => { e.stopPropagation(); removeFile(i); }} className="p-1.5 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors">
                                  <XMarkIcon className="w-4 h-4" />
                               </button>
                             </div>
                          ))}
                        </div>
                      )}

                      <div className="mt-8 flex justify-end w-full">
                        <button
                           onClick={handleExtract}
                           disabled={files.length === 0 || isExtracting || questions.length === 0}
                           className="w-full flex justify-center items-center gap-2 px-6 py-3 bg-indigo-600 text-white text-base font-semibold rounded-xl hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
                        >
                           {isExtracting ? (
                             <>
                               <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                               </svg>
                               AI가 답변 인식 중입니다 ({files.length}개)
                             </>
                           ) : (
                             <>
                               <SparklesIcon className="w-5 h-5" />
                               설문 답변 자동 인식하기
                             </>
                           )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col md:flex-row gap-6 h-full min-h-0">
                      {/* Left Side: Previews */}
                      <div className="w-full md:w-1/2 flex flex-col bg-gray-50 rounded-xl border border-gray-200 overflow-hidden min-h-0 h-full">
                          <div className="p-3 bg-gray-100 border-b border-gray-200 font-medium text-sm text-gray-700 flex justify-between items-center shadow-sm z-10 flex-shrink-0">
                              <span>답안지 원본 ({files.length}건)</span>
                              <span className="text-xs font-normal text-gray-500">대조용</span>
                          </div>
                          <div className="flex-grow overflow-y-auto p-4 scroll-smooth custom-scrollbar min-h-0 bg-gray-50">
                              <div className="flex flex-col gap-6">
                                  {files.map((f, i) => (
                                      <div key={i} className="flex flex-col items-center border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm ring-1 ring-black/5">
                                          <div className="w-full bg-indigo-50 p-2 text-xs font-semibold text-indigo-700 border-b border-indigo-100 truncate text-center">
                                              {f.name}
                                          </div>
                                          {f.type === 'application/pdf' ? (
                                              <iframe src={previewUrls[i] + "#toolbar=0"} className="w-full h-[500px]" title={`PDF ${i}`} />
                                          ) : f.type.startsWith('image/') ? (
                                              <img src={previewUrls[i]} alt={`Document ${i}`} className="w-full h-auto object-contain" />
                                          ) : (
                                              <div className="p-12 flex flex-col items-center justify-center text-gray-500 bg-gray-50 w-full">
                                                  <DocumentTextIcon className="w-16 h-16 mb-4 text-indigo-300" />
                                                  <p className="text-sm font-medium">한글(HWP) 문서입니다</p>
                                                  <p className="text-xs text-gray-400 mt-1">미리보기를 지원하지 않습니다</p>
                                              </div>
                                          )}
                                      </div>
                                  ))}
                              </div>
                          </div>
                      </div>

                      {/* Right Side: Extracted Answers List */}
                      <div className="w-full md:w-1/2 flex flex-col h-full bg-white min-h-0">
                        <div className="mb-4 flex-shrink-0">
                            <h4 className="text-lg font-bold text-gray-900 border-b border-gray-200 pb-2">✏️ 인식된 주관식 답변</h4>
                            <p className="text-xs text-gray-500 mt-2">AI가 학생의 답변을 매핑했습니다. 원본 문서를 참고하여 글씨 인식 오류가 없는지 확인해 주세요.</p>
                        </div>

                        <div className="flex-grow overflow-y-auto pr-3 pb-4 custom-scrollbar min-h-0">
                            <div className="space-y-4">
                                    {questions.map((q) => (
                                <div key={q.id} className="flex flex-col gap-2 p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-indigo-300 transition-colors">
                                    <label className="text-sm font-semibold text-gray-800 flex gap-2">
                                        <span className="text-indigo-500">Q.</span>
                                        {q.question_text}
                                    </label>
                                    <textarea
                                        value={extractedAnswers[q.id] || ''}
                                        onChange={(e) => updateAnswer(q.id, e.target.value)}
                                        rows={3}
                                        className="w-full p-2.5 bg-blue-50/20 border border-blue-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-sm resize-none transition-all"
                                        placeholder="작성된 답변이 없거나 인식하지 못했습니다."
                                    />
                                </div>
                            ))}
                            </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {step === 'edit' && (
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
                    <button
                      onClick={() => setStep('upload')}
                      className="px-5 py-2.5 font-medium bg-white text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 hover:text-gray-900 shadow-sm transition-all duration-200"
                    >
                      문서 다시 올리기
                    </button>
                    <button
                      onClick={handleConfirm}
                      className="px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      학생 답변 저장하기
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
