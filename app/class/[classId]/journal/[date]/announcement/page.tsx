'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeftIcon,
  SpeakerWaveIcon,
  SparklesIcon,
  DocumentTextIcon,
  CheckIcon,
  XMarkIcon,
  TrashIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import type { Class, ClassJournal, JournalAnnouncement } from '@/lib/supabase';
import toast from 'react-hot-toast';

// 학급 정보 조회
async function fetchClassDetails(classId: string): Promise<Class | null> {
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .eq('id', classId)
    .single();
  
  if (error) {
    console.error('Error fetching class details:', error);
    return null;
  }
  
  return data;
}

// 해당 날짜의 학급 일지 조회 또는 생성
async function getOrCreateJournal(classId: string, date: string): Promise<ClassJournal> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('인증이 필요합니다.');
  }

  // 먼저 기존 일지가 있는지 확인
  const { data: existingJournal } = await supabase
    .from('class_journals')
    .select('*')
    .eq('class_id', classId)
    .eq('journal_date', date)
    .single();

  if (existingJournal) {
    return existingJournal;
  }

  // 없으면 새로 생성
  const { data, error } = await supabase
    .from('class_journals')
    .insert({
      class_id: classId,
      journal_date: date
    })
    .select()
    .single();

  if (error) {
    throw new Error('일지 생성 중 오류가 발생했습니다.');
  }

  return data;
}

// 알림장 저장
async function saveAnnouncement(
  journalId: string, 
  keywords: string, 
  details: string, 
  generatedContent: string
): Promise<JournalAnnouncement> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('인증이 필요합니다.');
  }

  const keywordsArray = keywords.split(',').map(k => k.trim()).filter(k => k.length > 0);

  const { data, error } = await supabase
    .from('journal_announcements')
    .insert({
      journal_id: journalId,
      keywords: keywordsArray,
      teacher_input_content: details,
      ai_generated_content: generatedContent
    })
    .select()
    .single();

  if (error) {
    throw new Error('알림장 저장 중 오류가 발생했습니다.');
  }

  return data;
}

// AI 알림장 생성 (API Route 사용)
async function generateAnnouncement(
  keywords: string, 
  details: string, 
  className: string, 
  date: string,
  classId: string
): Promise<string> {
  try {
    const formattedDate = format(parseISO(date), 'yyyy년 M월 d일 (E)', { locale: ko });
    
    const response = await fetch(`/api/class/${classId}/journal/announcement`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        keywords,
        details,
        className,
        date: formattedDate
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '알림장 생성에 실패했습니다.');
    }

    const data = await response.json();
    return data.content;
  } catch (error) {
    console.error('AI 알림장 생성 오류:', error);
    throw error;
  }
}

// 기존 알림장 조회
async function fetchExistingAnnouncements(classId: string, date: string): Promise<JournalAnnouncement[]> {
  const { data, error } = await supabase
    .from('journal_announcements')
    .select(`
      *,
      class_journals!inner(*)
    `)
    .eq('class_journals.class_id', classId)
    .eq('class_journals.journal_date', date)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching announcements:', error);
    return [];
  }

  return data || [];
}

// 알림장 업데이트
async function updateAnnouncement(
  announcementId: string,
  keywords: string, 
  details: string, 
  generatedContent: string
): Promise<JournalAnnouncement> {
  const keywordsArray = keywords.split(',').map(k => k.trim()).filter(k => k.length > 0);

  const { data, error } = await supabase
    .from('journal_announcements')
    .update({
      keywords: keywordsArray,
      teacher_input_content: details,
      ai_generated_content: generatedContent,
      updated_at: new Date().toISOString()
    })
    .eq('id', announcementId)
    .select()
    .single();

  if (error) {
    throw new Error('알림장 수정 중 오류가 발생했습니다.');
  }

  return data;
}

// 알림장 삭제
async function deleteAnnouncement(announcementId: string): Promise<void> {
  // 먼저 알림장이 속한 일지 ID를 가져옴
  const { data: announcement, error: fetchError } = await supabase
    .from('journal_announcements')
    .select('journal_id')
    .eq('id', announcementId)
    .single();

  if (fetchError) {
    throw new Error('알림장 정보를 가져오는 중 오류가 발생했습니다.');
  }

  const journalId = announcement.journal_id;

  // 알림장 삭제
  const { error: deleteError } = await supabase
    .from('journal_announcements')
    .delete()
    .eq('id', announcementId);

  if (deleteError) {
    throw new Error('알림장 삭제 중 오류가 발생했습니다.');
  }

  // 해당 일지에 다른 내용이 있는지 확인
  const { data: remainingContent, error: checkError } = await supabase
    .from('class_journals')
    .select(`
      id,
      journal_announcements(id),
      journal_student_status(id),
      journal_class_memos(id)
    `)
    .eq('id', journalId)
    .single();

  if (checkError) {
    console.error('일지 내용 확인 중 오류:', checkError);
    return; // 알림장은 이미 삭제되었으므로 에러를 던지지 않음
  }

  // 다른 내용이 없으면 일지도 삭제
  const hasOtherContent = 
    (remainingContent.journal_announcements?.length || 0) > 0 ||
    (remainingContent.journal_student_status?.length || 0) > 0 ||
    (remainingContent.journal_class_memos?.length || 0) > 0;

  if (!hasOtherContent) {
    const { error: journalDeleteError } = await supabase
      .from('class_journals')
      .delete()
      .eq('id', journalId);

    if (journalDeleteError) {
      console.error('빈 일지 삭제 중 오류:', journalDeleteError);
      // 알림장은 이미 삭제되었으므로 에러를 던지지 않음
    }
  }
}

// 로딩 모달 컴포넌트
function LoadingModal({ isOpen, message }: { isOpen: boolean; message: string }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white rounded-xl p-8 w-80 h-64 mx-4 text-center shadow-2xl pointer-events-auto flex flex-col justify-center"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
          >
            <div className="mb-4">
              <div className="relative">
                <div className="w-16 h-16 mx-auto mb-4">
                  <motion.div
                    className="w-16 h-16 border-4 border-yellow-200 border-t-yellow-600 rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  />
                </div>
                <motion.div
                  className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <SparklesIcon className="h-6 w-6 text-yellow-600" />
                </motion.div>
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">AI 알림장 생성 중</h3>
            <p className="text-gray-600 text-sm min-h-[2.5rem] flex items-center justify-center">{message}</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// 삭제 확인 모달 컴포넌트
function DeleteConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  isDeleting 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onConfirm: () => void; 
  isDeleting: boolean; 
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white rounded-xl p-6 max-w-md mx-4 text-center"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
          >
            <div className="mb-4">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <ExclamationTriangleIcon className="h-8 w-8 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">알림장 삭제</h3>
              <p className="text-gray-600 text-sm">
                정말로 이 알림장을 삭제하시겠습니까?<br />
                삭제된 알림장은 복구할 수 없습니다.
              </p>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={onConfirm}
                disabled={isDeleting}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center space-x-2"
              >
                <TrashIcon className="h-4 w-4" />
                <span>{isDeleting ? '삭제 중...' : '삭제'}</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function AnnouncementPage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  
  const classId = params.classId as string;
  const date = params.date as string;

  const [keywords, setKeywords] = useState('');
  const [details, setDetails] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 학급 정보 조회
  const { data: classDetails, isLoading: isClassLoading } = useQuery<Class | null, Error>({
    queryKey: ['classDetails', classId],
    queryFn: () => fetchClassDetails(classId),
    enabled: !!classId,
  });

  // 기존 알림장 조회
  const { data: existingAnnouncements, isLoading: isAnnouncementsLoading } = useQuery<JournalAnnouncement[], Error>({
    queryKey: ['announcements', classId, date],
    queryFn: () => fetchExistingAnnouncements(classId, date),
    enabled: !!classId && !!date,
  });

  // 기존 알림장 데이터 로드
  useEffect(() => {
    if (existingAnnouncements && existingAnnouncements.length > 0) {
      const latest = existingAnnouncements[0];
      setKeywords(Array.isArray(latest.keywords) ? latest.keywords.join(', ') : latest.keywords || '');
      setDetails(latest.teacher_input_content || '');
      setGeneratedContent(latest.ai_generated_content || '');
      setEditingAnnouncementId(latest.id);
    }
  }, [existingAnnouncements]);

  // 일지 조회/생성 뮤테이션
  const journalMutation = useMutation({
    mutationFn: () => getOrCreateJournal(classId, date),
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // 알림장 저장 뮤테이션
  const saveMutation = useMutation({
    mutationFn: (journalId: string) => saveAnnouncement(journalId, keywords, details, generatedContent),
    onSuccess: () => {
      toast.success('알림장이 저장되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['date-journals'] });
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      router.push(`/class/${classId}/journal/${date}`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // 알림장 수정 뮤테이션
  const updateMutation = useMutation({
    mutationFn: () => updateAnnouncement(editingAnnouncementId!, keywords, details, generatedContent),
    onSuccess: () => {
      toast.success('알림장이 수정되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['date-journals'] });
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      router.push(`/class/${classId}/journal/${date}`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // 알림장 삭제 뮤테이션
  const deleteMutation = useMutation({
    mutationFn: () => deleteAnnouncement(editingAnnouncementId!),
    onSuccess: () => {
      toast.success('알림장이 삭제되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['date-journals'] });
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      router.push(`/class/${classId}/journal/${date}`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // AI 알림장 생성
  const handleGenerateAnnouncement = async () => {
    if (!keywords.trim() || !details.trim()) {
      toast.error('키워드와 상세 내용을 모두 입력해주세요.');
      return;
    }

    if (!classDetails) {
      toast.error('학급 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    setIsGenerating(true);
    setLoadingMessage('키워드와 내용을 분석하고 있습니다...');
    
    try {
      // 1단계: 분석 중
      await new Promise(resolve => setTimeout(resolve, 1000));
      setLoadingMessage('AI가 알림장을 작성하고 있습니다...');
      
      // 2단계: 생성 중
      await new Promise(resolve => setTimeout(resolve, 500));
      setLoadingMessage('내용을 다듬고 있습니다...');
      
      const generated = await generateAnnouncement(keywords, details, classDetails.name, date, classId);
      
      // 3단계: 완료
      setLoadingMessage('알림장 생성이 완료되었습니다!');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setGeneratedContent(generated);
      toast.success('AI 알림장이 생성되었습니다!');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알림장 생성 중 오류가 발생했습니다.';
      toast.error(errorMessage);
      console.error('알림장 생성 오류:', error);
    } finally {
      setIsGenerating(false);
      setLoadingMessage('');
    }
  };

  // 알림장 저장
  const handleSaveAnnouncement = async () => {
    if (!generatedContent.trim()) {
      toast.error('먼저 알림장을 생성해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingAnnouncementId) {
        // 기존 알림장 수정
        await updateMutation.mutateAsync();
      } else {
        // 새 알림장 생성
        const journal = await journalMutation.mutateAsync();
        await saveMutation.mutateAsync(journal.id);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // 삭제 확인 모달 열기
  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  // 삭제 확인
  const handleDeleteConfirm = async () => {
    if (!editingAnnouncementId) return;

    setIsDeleting(true);
    try {
      await deleteMutation.mutateAsync();
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  // 삭제 취소
  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
  };

  if (isClassLoading || isAnnouncementsLoading) {
    return <div className="flex justify-center items-center h-screen">로딩 중...</div>;
  }

  if (!classDetails) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">학급을 찾을 수 없습니다</h1>
          <button
            onClick={() => router.push('/')}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const formattedDate = format(parseISO(date), 'yyyy년 M월 d일 (E)', { locale: ko });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push(`/class/${classId}/journal/${date}`)}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5" />
              <span>날짜 페이지로 돌아가기</span>
            </button>
            <div className="h-6 w-px bg-gray-300" />
            <h1 className="text-3xl font-bold text-gray-800 flex items-center space-x-2">
              <SpeakerWaveIcon className="h-8 w-8 text-yellow-600" />
              <span>알림장 {editingAnnouncementId ? '수정' : '생성'}</span>
            </h1>
          </div>
        </div>

        {/* 학급 및 날짜 정보 */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8 border border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="bg-yellow-100 p-2 rounded-lg">
              <SpeakerWaveIcon className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-800">{classDetails.name}</h2>
              <p className="text-gray-600">{formattedDate} 알림장</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 입력 섹션 */}
          <div className="space-y-6">
            {/* 키워드 입력 */}
            <motion.div
              className="bg-white rounded-xl shadow-sm p-6 border border-gray-200"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="flex items-center space-x-2 mb-4">
                <SparklesIcon className="h-5 w-5 text-yellow-600" />
                <h3 className="text-lg font-semibold text-gray-800">키워드</h3>
              </div>
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="예: 체육대회, 수학시험, 현장학습 등"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                maxLength={100}
              />
              <p className="text-sm text-gray-700 mt-2">
                오늘의 주요 활동이나 사건을 키워드로 입력해주세요. ({keywords.length}/100)
              </p>
            </motion.div>

            {/* 상세 내용 입력 */}
            <motion.div
              className="bg-white rounded-xl shadow-sm p-6 border border-gray-200"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center space-x-2 mb-4">
                <DocumentTextIcon className="h-5 w-5 text-yellow-600" />
                <h3 className="text-lg font-semibold text-gray-800">상세 내용</h3>
              </div>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="오늘 있었던 일들을 자세히 설명해주세요. AI가 이 내용을 바탕으로 학부모님께 전달할 알림장을 작성합니다."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent resize-none text-gray-900 placeholder-gray-500"
                rows={8}
                maxLength={1000}
              />
              <p className="text-sm text-gray-700 mt-2">
                구체적이고 상세한 내용일수록 더 좋은 알림장이 생성됩니다. ({details.length}/1000)
              </p>
            </motion.div>

            {/* AI 생성 버튼 */}
            <motion.button
              onClick={handleGenerateAnnouncement}
              disabled={isGenerating || !keywords.trim() || !details.trim()}
              className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-6 py-4 rounded-lg hover:from-yellow-600 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <SparklesIcon className="h-5 w-5" />
              <span>{isGenerating ? 'AI가 알림장을 생성하고 있습니다...' : 'AI 알림장 생성'}</span>
            </motion.button>
          </div>

          {/* 미리보기 섹션 */}
          <div className="space-y-6">
            <motion.div
              className="bg-white rounded-xl shadow-sm p-6 border border-gray-200"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <DocumentTextIcon className="h-5 w-5 text-yellow-600" />
                  <h3 className="text-lg font-semibold text-gray-800">생성된 알림장</h3>
                </div>
                {generatedContent && (
                  <div className="flex items-center space-x-2">
                    <CheckIcon className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-green-600">생성 완료</span>
                  </div>
                )}
              </div>

              {generatedContent ? (
                <div className="space-y-4">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <pre className="whitespace-pre-wrap text-sm text-gray-900 font-medium leading-relaxed">
                      {generatedContent}
                    </pre>
                  </div>
                  
                  {/* 수정 영역 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-2">
                      내용 수정 (필요시)
                    </label>
                    <textarea
                      value={generatedContent}
                      onChange={(e) => setGeneratedContent(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent resize-none text-gray-900"
                      rows={12}
                    />
                  </div>

                  {/* 저장 버튼 */}
                  <div className="flex space-x-3">
                    <button
                      onClick={handleSaveAnnouncement}
                      disabled={isSaving}
                      className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
                    >
                      <CheckIcon className="h-5 w-5" />
                      <span>{isSaving ? '저장 중...' : editingAnnouncementId ? '알림장 수정' : '알림장 저장'}</span>
                    </button>
                    
                    {editingAnnouncementId && (
                      <button
                        onClick={handleDeleteClick}
                        disabled={isSaving || isDeleting}
                        className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
                      >
                        <TrashIcon className="h-5 w-5" />
                        <span>삭제</span>
                      </button>
                    )}
                    
                    <button
                      onClick={() => setGeneratedContent('')}
                      className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center space-x-2"
                    >
                      <XMarkIcon className="h-5 w-5" />
                      <span>다시 생성</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <SpeakerWaveIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-800 mb-2">
                    알림장이 아직 생성되지 않았습니다
                  </h4>
                  <p className="text-gray-600">
                    키워드와 상세 내용을 입력한 후 'AI 알림장 생성' 버튼을 클릭해주세요.
                  </p>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>

      {/* 로딩 모달 */}
      <LoadingModal isOpen={isGenerating} message={loadingMessage} />

      {/* 삭제 확인 모달 */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
      />
    </div>
  );
} 