'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  ArrowLeftIcon,
  DocumentTextIcon,
  CheckIcon,
  PencilIcon,
  BookOpenIcon,
  HeartIcon,
  StarIcon
} from '@heroicons/react/24/outline';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import type { Class, ClassJournal, JournalClassMemo } from '@/lib/supabase';
import toast from 'react-hot-toast';

// 학급 정보 조회
async function fetchClassDetails(classId: string): Promise<Class | null> {
  const { data, error } = await (supabase as any)
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
  const { data: existingJournal } = await (supabase as any)
    .from('class_journals')
    .select('*')
    .eq('class_id', classId)
    .eq('journal_date', date)
    .single();

  if (existingJournal) {
    return existingJournal;
  }

  // 없으면 새로 생성
  const { data, error } = await (supabase as any)
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

// 기존 학급 메모 조회
async function fetchClassMemos(classId: string, date: string): Promise<JournalClassMemo[]> {
  const { data, error } = await (supabase as any)
    .from('journal_class_memos')
    .select(`
      *,
      class_journals!inner(*)
    `)
    .eq('class_journals.class_id', classId)
    .eq('class_journals.journal_date', date)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching class memos:', error);
    return [];
  }

  return data || [];
}

// 학급 메모 저장/업데이트
async function saveClassMemo(
  journalId: string,
  content: string,
  memoId?: string
): Promise<JournalClassMemo> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('인증이 필요합니다.');
  }

  if (memoId) {
    // 기존 메모 업데이트
    const { data, error } = await (supabase as any)
      .from('journal_class_memos')
      .update({
        content: content,
        updated_at: new Date().toISOString()
      })
      .eq('id', memoId)
      .select()
      .single();

    if (error) {
      throw new Error('학급 메모 수정 중 오류가 발생했습니다.');
    }

    return data;
  } else {
    // 새 메모 생성
    const { data, error } = await (supabase as any)
      .from('journal_class_memos')
      .insert({
        journal_id: journalId,
        content: content
      })
      .select()
      .single();

    if (error) {
      throw new Error('학급 메모 저장 중 오류가 발생했습니다.');
    }

    return data;
  }
}

// 메모 템플릿
const MEMO_TEMPLATES = [
  {
    title: '학급 분위기',
    icon: HeartIcon,
    placeholder: '오늘 우리 반 아이들의 전반적인 분위기는 어땠나요?\n예: 활기차고 즐거운 하루였습니다. 모든 아이들이 적극적으로 수업에 참여했어요.',
    color: 'pink'
  },
  {
    title: '특별한 사건',
    icon: StarIcon,
    placeholder: '오늘 특별히 기억에 남는 일이 있었나요?\n예: 새로운 전학생이 왔고, 아이들이 따뜻하게 맞아주었습니다.',
    color: 'yellow'
  },
  {
    title: '수업 활동',
    icon: BookOpenIcon,
    placeholder: '오늘의 주요 수업 활동이나 학습 내용을 기록해보세요.\n예: 과학 실험 시간에 아이들이 매우 흥미로워했고, 질문도 많이 했습니다.',
    color: 'blue'
  },
  {
    title: '자유 기록',
    icon: PencilIcon,
    placeholder: '그 외 기록하고 싶은 모든 것을 자유롭게 적어보세요.\n예: 내일 준비물, 학부모 상담 내용, 개인적인 소감 등',
    color: 'purple'
  }
];

export default function ClassNotesPage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  
  const classId = params.classId as string;
  const date = params.date as string;

  const [content, setContent] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);

  // 학급 정보 조회
  const { data: classDetails, isLoading: isClassLoading } = useQuery<Class | null, Error>({
    queryKey: ['classDetails', classId],
    queryFn: () => fetchClassDetails(classId),
    enabled: !!classId,
  });

  // 기존 학급 메모 조회
  const { data: existingMemos, isLoading: isMemosLoading } = useQuery<JournalClassMemo[], Error>({
    queryKey: ['class-memos', classId, date],
    queryFn: () => fetchClassMemos(classId, date),
    enabled: !!classId && !!date,
  });

  // 기존 메모 데이터 로드
  useEffect(() => {
    if (existingMemos && existingMemos.length > 0) {
      const latestMemo = existingMemos[0];
      setContent(latestMemo.content || '');
      setEditingMemoId(latestMemo.id);
    }
  }, [existingMemos]);

  // 템플릿 선택
  const handleTemplateSelect = (index: number) => {
    setSelectedTemplate(index);
    const template = MEMO_TEMPLATES[index];
    setContent(template.placeholder);
  };

  // 저장 뮤테이션
  const saveMutation = useMutation({
    mutationFn: async () => {
      // 먼저 일지 생성/조회
      const journal = await getOrCreateJournal(classId, date);
      
      // 메모 저장/업데이트
      await saveClassMemo(journal.id, content, editingMemoId || undefined);
    },
    onSuccess: () => {
      toast.success('학급 메모가 저장되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['date-journals'] });
      queryClient.invalidateQueries({ queryKey: ['class-memos'] });
      router.push(`/class/${classId}/journal/${date}`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // 저장 핸들러
  const handleSave = async () => {
    if (!content.trim()) {
      toast.error('내용을 입력해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      await saveMutation.mutateAsync();
    } finally {
      setIsSaving(false);
    }
  };

  if (isClassLoading || isMemosLoading) {
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
              <DocumentTextIcon className="h-8 w-8 text-purple-600" />
              <span>오늘의 우리 반</span>
            </h1>
          </div>
        </div>

        {/* 학급 및 날짜 정보 */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8 border border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="bg-purple-100 p-2 rounded-lg">
              <DocumentTextIcon className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-800">{classDetails.name}</h2>
              <p className="text-gray-600">{formattedDate} 학급 전체 메모</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 템플릿 선택 */}
          <div className="lg:col-span-1">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">작성 도우미</h3>
            <div className="space-y-3">
              {MEMO_TEMPLATES.map((template, index) => {
                const Icon = template.icon;
                const isSelected = selectedTemplate === index;
                
                return (
                  <motion.button
                    key={index}
                    onClick={() => handleTemplateSelect(index)}
                    className={`
                      w-full text-left p-4 rounded-lg border transition-all duration-200
                      ${isSelected 
                        ? `bg-${template.color}-50 border-${template.color}-300 text-${template.color}-700` 
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }
                    `}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <div className="flex items-center space-x-3">
                      <Icon className="h-5 w-5" />
                      <span className="font-medium">{template.title}</span>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="text-sm font-medium text-blue-800 mb-2">💡 작성 팁</h4>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>• 구체적인 사례를 포함해보세요</li>
                <li>• 아이들의 감정이나 반응을 기록해보세요</li>
                <li>• 내일 참고할 내용도 적어두세요</li>
                <li>• 개인적인 소감도 자유롭게 적어보세요</li>
              </ul>
            </div>
          </div>

          {/* 메모 작성 영역 */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <PencilIcon className="h-5 w-5 text-purple-600" />
                  <h3 className="text-lg font-semibold text-gray-800">
                    {editingMemoId ? '메모 수정' : '새 메모 작성'}
                  </h3>
                </div>
                <div className="text-sm text-gray-500">
                  {content.length}/2000자
                </div>
              </div>

              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="오늘 우리 반에서 일어난 일들을 자유롭게 기록해보세요...

예시:
- 오늘 아이들이 특히 활발했어요
- 수학 시간에 새로운 개념을 잘 이해했습니다
- 쉬는 시간에 친구들과 사이좋게 놀았어요
- 내일은 체육대회 연습이 있어요"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-gray-900 placeholder-gray-500"
                rows={20}
                maxLength={2000}
              />

              <div className="mt-6 flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  {selectedTemplate !== null && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-700">
                      {MEMO_TEMPLATES[selectedTemplate].title} 템플릿 사용 중
                    </span>
                  )}
                </div>
                
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setContent('');
                      setSelectedTemplate(null);
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    초기화
                  </button>
                  
                  <button
                    onClick={handleSave}
                    disabled={isSaving || !content.trim()}
                    className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                  >
                    <CheckIcon className="h-4 w-4" />
                    <span>{isSaving ? '저장 중...' : editingMemoId ? '메모 수정' : '메모 저장'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 