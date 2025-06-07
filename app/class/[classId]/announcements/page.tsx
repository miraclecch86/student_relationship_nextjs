'use client';

import React, { useState, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PlusIcon,
  XMarkIcon,
  TrashIcon,
  PencilIcon,
  SpeakerWaveIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
  DocumentTextIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  ArrowsPointingOutIcon
} from '@heroicons/react/24/outline';
import { format, parseISO, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from 'date-fns';
import { ko } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import type { Class, JournalAnnouncement } from '@/lib/supabase';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

// 학급 정보 조회
async function fetchClassDetails(classId: string): Promise<any> {
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

// 일지 조회/생성
async function getOrCreateJournal(classId: string, date: string): Promise<any> {
  // 먼저 해당 날짜의 일지가 있는지 확인
  const { data: existingJournal } = await (supabase as any)
    .from('class_journals')
    .select('id')
    .eq('class_id', classId)
    .eq('journal_date', date)
    .single();

  if (existingJournal) {
    return existingJournal;
  }

  // 없으면 새로 생성
  const { data: newJournal, error } = await (supabase as any)
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

  return newJournal;
}

// 전체 학급의 알림장 기록 조회
async function fetchAllAnnouncements(classId: string): Promise<any[]> {
  const { data, error } = await (supabase as any)
    .from('journal_announcements')
    .select(`
      *,
      class_journals!inner(*)
    `)
    .eq('class_journals.class_id', classId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching all announcements:', error);
    return [];
  }

  return data || [];
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

  const { data, error } = await (supabase as any)
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

// 알림장 수정
async function updateAnnouncement(
  announcementId: string,
  keywords: string, 
  details: string, 
  generatedContent: string
): Promise<JournalAnnouncement> {
  const keywordsArray = keywords.split(',').map(k => k.trim()).filter(k => k.length > 0);

  const { data, error } = await (supabase as any)
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
  const { error } = await (supabase as any)
    .from('journal_announcements')
    .delete()
    .eq('id', announcementId);

  if (error) {
    throw new Error('알림장 삭제 중 오류가 발생했습니다.');
  }
}

// AI 알림장 생성
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

// 안전 공지 생성 함수 - AI 기반으로 변경
async function generateSafetyNotice(category: string, content: string, classId: string): Promise<string> {
  try {
    const response = await fetch(`/api/class/${classId}/journal/safety-notice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        category,
        content
      }),
    });

    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`);
    }

    const data = await response.json();
    return data.content;
  } catch (error) {
    console.error('AI 안전 수칙 생성 오류, 기본 방식 사용:', error);
    
    // 폴백으로 기존 방식 사용 - 한 문장만
    const safetyMessages: { [key: string]: string[] } = {
      '교실안전': [
        '교실에서는 뛰어다니지 않고 천천히 걸어다닙니다.',
        '의자를 뒤로 젖히지 않고 바른 자세로 앉습니다.',
        '교실 바닥에 물이나 이물질이 있으면 즉시 선생님께 알립니다.',
        '교실 문을 열고 닫을 때 손가락이 끼지 않도록 조심합니다.'
      ],
      '교통안전': [
        '횡단보도를 건널 때는 좌우를 꼼꼼히 살펴봅니다.',
        '신호등을 반드시 지키고 초록불이어도 한 번 더 확인합니다.',
        '차도 근처에서는 절대 뛰어다니지 않습니다.',
        '자전거나 킥보드를 탈 때는 보호장구를 착용합니다.'
      ],
      '운동장안전': [
        '운동 전에는 충분한 준비운동으로 몸을 풀어줍니다.',
        '운동기구 사용 시 선생님의 안전 수칙을 꼭 지킵니다.',
        '친구들과 안전한 거리를 유지하며 활동합니다.',
        '운동장에 위험한 물건이 있는지 미리 확인합니다.'
      ]
    };

    const messages = safetyMessages[category] || [];
    if (messages.length === 0) return '';

    // 한 개의 안전 수칙만 랜덤 선택
    const selectedMessage = messages[Math.floor(Math.random() * messages.length)];
    
    return `🔔 ${category} 안전 수칙: ${selectedMessage}`;
  }
}

export default function AnnouncementsPage() {
  const router = useRouter();
  const params = useParams();
  const classId = params.classId as string;

  const [editingAnnouncement, setEditingAnnouncement] = useState<any | null>(null);
  const [newAnnouncement, setNewAnnouncement] = useState({
    safetyCategory: '', // keywords 대신 안전 공지 카테고리
    details: '',
    generatedContent: '',
    date: format(new Date(), 'yyyy-MM-dd'), // 기본값은 오늘 날짜
    skipAI: false // AI 적용 안하기
  });

  // 월별 접기/펼치기 상태 관리
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  // 알림장 작성/수정 모달 상태
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);

  // 전체화면 보기 상태
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);

  // 전체화면 글씨 크기 상태 (기본값: 1 = 보통)
  const [fontSize, setFontSize] = useState(1);

  // 검색 상태
  const [searchQuery, setSearchQuery] = useState('');

  // AI 생성 상태
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  const queryClient = useQueryClient();

  // 학급 정보 조회
  const { data: classDetails, isLoading: isClassLoading } = useQuery<Class | null, Error>({
    queryKey: ['classDetails', classId],
    queryFn: () => fetchClassDetails(classId),
    enabled: !!classId,
  });

  // 알림장 목록 조회
  const { data: announcements, isLoading: isAnnouncementsLoading } = useQuery<any[], Error>({
    queryKey: ['announcements', classId],
    queryFn: () => fetchAllAnnouncements(classId),
    enabled: !!classId,
  });

  // 월별로 그룹화된 알림장들 (+ 구분 AND 조건)
  const monthlyGroupedAnnouncements = useMemo(() => {
    if (!announcements) return new Map();
    
    // 검색어가 있는 경우 필터링 (+ 구분 AND 조건)
    let filteredAnnouncements = announcements;
    if (searchQuery.trim()) {
      const keywords = searchQuery.toLowerCase().trim().split('+').map(keyword => keyword.trim()).filter(keyword => keyword.length > 0);
      
      filteredAnnouncements = announcements.filter(announcement => {
        const aiContent = announcement.ai_generated_content?.toLowerCase() || '';
        const teacherContent = announcement.teacher_input_content?.toLowerCase() || '';
        const keywordContent = (Array.isArray(announcement.keywords) ? announcement.keywords : [])
          .join(' ').toLowerCase();
        
        // 모든 키워드가 어느 한 내용에라도 포함되어야 함 (AND 조건)
        return keywords.every(keyword => 
          aiContent.includes(keyword) || 
          teacherContent.includes(keyword) ||
          keywordContent.includes(keyword)
        );
      });
    }
    
    const grouped = new Map<string, any[]>();
    
    filteredAnnouncements.forEach(announcement => {
      const journalDate = announcement.class_journals.journal_date;
      const monthKey = format(parseISO(journalDate), 'yyyy-MM');
      
      if (!grouped.has(monthKey)) {
        grouped.set(monthKey, []);
      }
      grouped.get(monthKey)!.push(announcement);
    });
    
    // 각 월의 알림장들을 날짜 순으로 정렬 (빠른 날짜부터)
    grouped.forEach(announcements => {
      announcements.sort((a, b) => {
        const dateA = a.class_journals.journal_date;
        const dateB = b.class_journals.journal_date;
        return dateA.localeCompare(dateB);
      });
    });
    
    return grouped;
  }, [announcements, searchQuery]);

  // 현재 월을 기본으로 확장
  React.useEffect(() => {
    const currentMonth = format(new Date(), 'yyyy-MM');
    setExpandedMonths(prev => new Set([...prev, currentMonth]));
  }, []);

  // 전체화면에서 ESC 키로 닫기
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isFullscreenOpen) {
        handleCloseFullscreen();
      }
    };

    if (isFullscreenOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // 전체화면일 때 스크롤 방지
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isFullscreenOpen]);

  // 월별 토글 핸들러
  const toggleMonth = (monthKey: string) => {
    setExpandedMonths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(monthKey)) {
        newSet.delete(monthKey);
      } else {
        newSet.add(monthKey);
      }
      return newSet;
    });
  };

  // 알림장 추가 뮤테이션
  const addAnnouncementMutation = useMutation({
    mutationFn: async () => {
      const journal = await getOrCreateJournal(classId, newAnnouncement.date);
      return saveAnnouncement(journal.id, newAnnouncement.safetyCategory, newAnnouncement.details, newAnnouncement.generatedContent);
    },
    onSuccess: () => {
      toast.success('알림장이 추가되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      setNewAnnouncement({ safetyCategory: '', details: '', generatedContent: '', date: format(new Date(), 'yyyy-MM-dd'), skipAI: false });
      setEditingAnnouncement(null);
      setIsAnnouncementModalOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // 알림장 수정 뮤테이션
  const updateAnnouncementMutation = useMutation({
    mutationFn: () => 
      updateAnnouncement(editingAnnouncement.id, newAnnouncement.safetyCategory, newAnnouncement.details, newAnnouncement.generatedContent),
    onSuccess: () => {
      toast.success('알림장이 수정되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      setNewAnnouncement({ safetyCategory: '', details: '', generatedContent: '', date: format(new Date(), 'yyyy-MM-dd'), skipAI: false });
      setEditingAnnouncement(null);
      setIsAnnouncementModalOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // 알림장 삭제 뮤테이션
  const deleteAnnouncementMutation = useMutation({
    mutationFn: deleteAnnouncement,
    onSuccess: () => {
      toast.success('알림장이 삭제되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // 새 알림장 작성 모드로 전환
  const handleNewAnnouncement = () => {
    setEditingAnnouncement(null);
    setNewAnnouncement({ safetyCategory: '', details: '', generatedContent: '', date: format(new Date(), 'yyyy-MM-dd'), skipAI: false });
    setIsAnnouncementModalOpen(true);
  };

  // 알림장 수정 핸들러
  const handleEditAnnouncement = (announcement: any) => {
    setEditingAnnouncement(announcement);
    setNewAnnouncement({
      safetyCategory: Array.isArray(announcement.keywords) ? announcement.keywords.join(', ') : announcement.keywords || '',
      details: announcement.teacher_input_content || '',
      generatedContent: announcement.ai_generated_content || '',
      date: announcement.class_journals.journal_date,
      skipAI: false
    });
    setIsAnnouncementModalOpen(true);
  };

  // AI 알림장 생성
  const handleGenerateAnnouncement = async () => {
    if (!newAnnouncement.details.trim()) {
      toast.error('상세 내용을 입력해주세요.');
      return;
    }

    if (!classDetails) {
      toast.error('학급 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    setIsGenerating(true);
    
    try {
      let finalContent = '';
      let safetyContent = '';
      
      // 날짜 포맷팅 (첫 줄용)
      const formattedDate = format(parseISO(newAnnouncement.date), 'yyyy년 M월 d일 (E)요일 알림장', { locale: ko });
      
      // 안전 카테고리가 선택된 경우 - AI 체크와 무관하게 안전 수칙 생성
      if (newAnnouncement.safetyCategory.trim()) {
        setLoadingMessage('안전 수칙을 생성하고 있습니다...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        safetyContent = await generateSafetyNotice(newAnnouncement.safetyCategory, newAnnouncement.details, classId);
      }
      
      // AI 적용 안하기가 체크되지 않은 경우에만 AI 알림장 생성
      if (!newAnnouncement.skipAI) {
        setLoadingMessage('AI가 알림장을 작성하고 있습니다...');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 안전 카테고리가 있으면 키워드로 전달, 없으면 빈 문자열
        const keywords = newAnnouncement.safetyCategory.trim() || '';
        const generated = await generateAnnouncement(keywords, newAnnouncement.details, classDetails.name, newAnnouncement.date, classId);
        finalContent = generated;
      } else {
        // AI 적용 안하기가 체크된 경우 원본 내용 사용
        finalContent = newAnnouncement.details;
      }
      
      // 안전 수칙이 있는 경우 본문에 추가
      if (safetyContent.trim()) {
        finalContent = `${finalContent}\n\n${safetyContent}`;
      }
      
      // 날짜 헤더를 맨 앞에 추가
      finalContent = `${formattedDate}\n\n${finalContent}`;
      
      // 완료
      setLoadingMessage('알림장 생성이 완료되었습니다!');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setNewAnnouncement(prev => ({ ...prev, generatedContent: finalContent }));
      toast.success('알림장이 생성되었습니다!');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알림장 생성 중 오류가 발생했습니다.';
      toast.error(errorMessage);
      console.error('알림장 생성 오류:', error);
    } finally {
      setIsGenerating(false);
      setLoadingMessage('');
    }
  };

  // 알림장 저장 핸들러
  const handleSaveAnnouncement = () => {
    if (!newAnnouncement.generatedContent.trim()) {
      toast.error('먼저 알림장을 생성해주세요.');
      return;
    }

    if (editingAnnouncement) {
      updateAnnouncementMutation.mutate();
    } else {
      addAnnouncementMutation.mutate();
    }
  };

  // 폼 취소 핸들러
  const handleCancelEdit = () => {
    setEditingAnnouncement(null);
    setNewAnnouncement({ safetyCategory: '', details: '', generatedContent: '', date: format(new Date(), 'yyyy-MM-dd'), skipAI: false });
    setIsAnnouncementModalOpen(false);
  };

  // 알림장 삭제 핸들러
  const handleDeleteAnnouncement = (announcementId: string) => {
    if (confirm('정말로 이 알림장을 삭제하시겠습니까?')) {
      deleteAnnouncementMutation.mutate(announcementId);
    }
  };

  // 전체화면 보기 핸들러
  const handleOpenFullscreen = () => {
    if (newAnnouncement.generatedContent.trim()) {
      setIsFullscreenOpen(true);
    }
  };

  const handleCloseFullscreen = () => {
    setIsFullscreenOpen(false);
  };

  // 엑셀 다운로드 함수
  const exportToExcel = () => {
    try {
      // 현재 필터링된 알림장들을 가져옴
      const announcementsToExport = Array.from(monthlyGroupedAnnouncements.values()).flat();
      
      if (announcementsToExport.length === 0) {
        toast.error('내보낼 알림장이 없습니다.');
        return;
      }

      // 엑셀 데이터 준비
      const excelData = announcementsToExport.map((announcement: any, index) => {
        const cleanContent = (announcement.ai_generated_content || announcement.teacher_input_content || '')
          .replace(/\n+/g, ' ') // 줄바꿈을 공백으로 변경
          .trim();

        return {
          '번호': index + 1,
          '날짜': format(parseISO(announcement.class_journals.journal_date), 'yyyy-MM-dd (E)', { locale: ko }),
          '내용': cleanContent,
          '키워드': announcement.keywords ? announcement.keywords.join(', ') : '',
          '작성일': format(parseISO(announcement.created_at), 'yyyy-MM-dd HH:mm', { locale: ko }),
        };
      });

      // 워크북 생성
      const workbook = XLSX.utils.book_new();
      
      // 워크시트 생성
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      
      // 열 너비 조정
      const columnWidths = [
        { wch: 8 },   // 번호
        { wch: 15 },  // 날짜  
        { wch: 60 },  // 내용
        { wch: 20 },  // 키워드
        { wch: 18 },  // 작성일
      ];
      worksheet['!cols'] = columnWidths;

      // 워크북에 워크시트 추가
      XLSX.utils.book_append_sheet(workbook, worksheet, '알림장');

      // 파일명 생성
      const currentDate = format(new Date(), 'yyyy-MM-dd');
      const className = classDetails?.name || '학급';
      const filterInfo = searchQuery ? '_검색결과' : '';
      const filename = `${className}_알림장_${currentDate}${filterInfo}.xlsx`;

      // 파일 다운로드
      XLSX.writeFile(workbook, filename);
      
      toast.success(`엑셀 파일이 다운로드되었습니다: ${filename}`);
    } catch (error) {
      console.error('Excel export error:', error);
      toast.error('엑셀 파일 생성 중 오류가 발생했습니다.');
    }
  };

  // 엑셀 업로드 함수
  const handleExcelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      toast.success('엑셀 파일을 처리 중입니다...');

      // 파일 읽기
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[worksheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

      if (jsonData.length === 0) {
        toast.error('엑셀 파일에 데이터가 없습니다.');
        return;
      }

      // 데이터 검증 및 변환
      const announcementsToImport = [];
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        
        // 필수 필드 확인
        if (!row['날짜'] || !row['내용']) {
          toast.error(`${i + 2}번째 행에 필수 데이터가 누락되었습니다. (날짜, 내용 필수)`);
          return;
        }

        // 날짜 파싱
        let journalDate;
        try {
          // 엑셀 날짜 형식 파싱 (yyyy-MM-dd (요일) 형식)
          const dateStr = row['날짜'].toString();
          const dateMatch = dateStr.match(/(\d{4}-\d{2}-\d{2})/);
          if (dateMatch) {
            journalDate = dateMatch[1];
          } else {
            throw new Error('날짜 형식 오류');
          }
        } catch (error) {
          toast.error(`${i + 2}번째 행의 날짜 형식이 올바르지 않습니다. (yyyy-MM-dd 형식 필요)`);
          return;
        }

        // 키워드 처리
        const keywords = row['키워드'] ? row['키워드'].toString().split(',').map((k: string) => k.trim()).filter((k: string) => k.length > 0) : [];

        announcementsToImport.push({
          journal_date: journalDate,
          content: row['내용'].toString().trim(),
          keywords: keywords
        });
      }

      // 서버에 데이터 전송
      const response = await fetch(`/api/class/${classId}/announcements/bulk-import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ announcements: announcementsToImport }),
      });

      if (!response.ok) {
        throw new Error('데이터 저장 실패');
      }

      const result = await response.json();
      
      toast.success(`${result.count}개의 알림장이 성공적으로 가져와졌습니다.`);
      
      // 데이터 즉시 새로고침 - React Query 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      
      // 파일 입력 초기화
      event.target.value = '';
      
    } catch (error) {
      console.error('Excel import error:', error);
      toast.error('엑셀 파일 가져오기 중 오류가 발생했습니다.');
    }
  };

  // 글씨 크기 증가/감소 함수
  const increaseFontSize = () => {
    setFontSize(prev => Math.min(prev + 0.2, 6)); // 최대 6배
  };

  const decreaseFontSize = () => {
    setFontSize(prev => Math.max(prev - 0.2, 0.5)); // 최소 0.5배
  };

  const resetFontSize = () => {
    setFontSize(1); // 기본 크기로 리셋
  };

  // 글씨 크기 계산 함수
  const getResponsiveFontSize = () => {
    const baseSize = 30; // 기본 크기 30px
    return Math.round(baseSize * fontSize);
  };

  const currentFontSize = getResponsiveFontSize();

  // 로딩 모달 컴포넌트
  const LoadingModal = ({ isOpen, message }: { isOpen: boolean; message: string }) => {
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

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center space-x-2">
            <SpeakerWaveIcon className="h-6 w-6 text-yellow-600" />
            <span>알림장 목록</span>
          </h1>
        </div>

        {/* 학급 정보 */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
              <SpeakerWaveIcon className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-800">{classDetails.name} 알림장</h2>
              <p className="text-sm text-gray-600">학급의 모든 알림장을 확인하고 관리할 수 있습니다</p>
            </div>
          </div>
        </div>

        {/* 메인 콘텐츠 - 알림장 목록만 전체 화면 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          {/* 헤더 - 검색창과 새 알림장 버튼 */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 text-sm text-gray-900 placeholder-gray-500"
                  placeholder="내용이나 키워드로 검색 (여러 단어는 +로 구분)"
                />
              </div>
              {searchQuery && (
                <p className="text-xs text-gray-500 mt-1">
                  "{searchQuery}" 검색 결과
                </p>
              )}
            </div>

            <div className="flex items-center space-x-3">
              <h3 className="text-lg font-semibold text-gray-800">
                {searchQuery ? `검색 결과` : '알림장 목록'}
                {announcements && (
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    ({searchQuery ? 
                      Array.from(monthlyGroupedAnnouncements.values()).reduce((sum, announcements) => sum + announcements.length, 0) :
                      announcements.length
                    }개)
                  </span>
                )}
              </h3>
              
              <button
                onClick={exportToExcel}
                className="flex items-center space-x-2 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>엑셀 다운로드</span>
              </button>
              
              <label className="flex items-center space-x-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors cursor-pointer">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
                <span>엑셀 업로드</span>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleExcelUpload}
                  className="hidden"
                />
              </label>

              <button
                onClick={handleNewAnnouncement}
                className="flex items-center space-x-2 bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 transition-colors"
              >
                <PlusIcon className="h-5 w-5" />
                <span>새 알림장</span>
              </button>
              
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors border border-gray-300 rounded-lg"
                >
                  초기화
                </button>
              )}
            </div>
          </div>
          
          {/* 알림장 목록 */}
          <div className="space-y-4">
            <AnimatePresence>
              {monthlyGroupedAnnouncements.size > 0 ? (
                // 월별로 순서대로 정렬 (최신 월부터)
                Array.from(monthlyGroupedAnnouncements.entries())
                  .sort(([a], [b]) => b.localeCompare(a))
                  .map(([monthKey, announcements]) => {
                    const isExpanded = expandedMonths.has(monthKey);
                    const monthDate = parseISO(`${monthKey}-01`);
                    const monthLabel = format(monthDate, 'yyyy년 M월', { locale: ko });
                    
                    return (
                      <div key={monthKey} className="border border-gray-200 rounded-lg overflow-hidden">
                        {/* 월별 헤더 */}
                        <button
                          onClick={() => toggleMonth(monthKey)}
                          className="w-full p-4 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
                        >
                          <div className="flex items-center space-x-3">
                            <span className="text-lg font-semibold text-gray-800">{monthLabel}</span>
                            <span className="text-sm text-gray-500 bg-gray-200 px-3 py-1 rounded-full">
                              {announcements.length}개
                            </span>
                          </div>
                          <motion.div
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronDownIcon className="h-5 w-5 text-gray-500" />
                          </motion.div>
                        </button>

                        {/* 월별 알림장 목록 */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="bg-white divide-y divide-gray-100">
                                {announcements.map((announcement: any) => (
                                  <motion.div
                                    key={announcement.id}
                                    layout
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="p-2 cursor-pointer transition-all group hover:bg-gray-50"
                                    onClick={() => handleEditAnnouncement(announcement)}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                                        <div className="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
                                          <SpeakerWaveIcon className="h-3 w-3 text-yellow-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          {/* 내용 */}
                                          <div className="text-gray-800 text-xs truncate">
                                            {announcement.ai_generated_content || announcement.teacher_input_content || '내용 없음'}
                                          </div>
                                        </div>
                                      </div>
                                      
                                      {/* 오른쪽: 날짜 */}
                                      <div className="flex items-center space-x-2 flex-shrink-0">
                                        {/* 날짜 */}
                                        <div className="text-yellow-600 text-xs font-semibold">
                                          {format(parseISO(announcement.class_journals.journal_date), 'M/d (E)', { locale: ko })}
                                        </div>
                                      </div>
                                    </div>
                                  </motion.div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    {searchQuery ? (
                      <MagnifyingGlassIcon className="h-8 w-8 text-yellow-600" />
                    ) : (
                      <SpeakerWaveIcon className="h-8 w-8 text-yellow-600" />
                    )}
                  </div>
                  {searchQuery ? (
                    <>
                      <p className="text-gray-600 mb-4">
                        "{searchQuery}"에 대한 검색 결과가 없습니다
                      </p>
                      <button
                        onClick={() => setSearchQuery('')}
                        className="text-yellow-600 hover:text-yellow-800 font-medium"
                      >
                        모든 알림장 보기
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-gray-600 mb-4">아직 알림장이 없습니다</p>
                      <button
                        onClick={handleNewAnnouncement}
                        className="text-yellow-600 hover:text-yellow-800 font-medium"
                      >
                        첫 번째 알림장 작성하기
                      </button>
                    </>
                  )}
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* 알림장 작성/수정 모달 */}
      <AnimatePresence>
        {isAnnouncementModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
            onClick={handleCancelEdit}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                {/* 모달 헤더 */}
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-gray-800">
                    {editingAnnouncement ? '알림장 수정' : '새 알림장 작성'}
                  </h3>
                  <div className="flex items-center space-x-2">
                    {/* 전체화면 보기 버튼 */}
                    {newAnnouncement.generatedContent && (
                      <button
                        onClick={handleOpenFullscreen}
                        className="text-gray-500 hover:text-gray-700 p-1"
                        title="전체화면으로 보기"
                      >
                        <ArrowsPointingOutIcon className="h-6 w-6" />
                      </button>
                    )}
                    {/* 닫기 버튼 */}
                    <button
                      onClick={handleCancelEdit}
                      className="text-gray-500 hover:text-gray-700 p-1"
                    >
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* 입력 섹션 */}
                  <div className="space-y-4">
                    {/* 날짜 선택 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">날짜</label>
                      <input
                        type="date"
                        value={newAnnouncement.date}
                        onChange={(e) => setNewAnnouncement(prev => ({ ...prev, date: e.target.value }))}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 text-gray-900"
                      />
                    </div>

                    {/* 안전 공지 카테고리 선택 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">안전 공지 카테고리 (선택사항)</label>
                      <select
                        value={newAnnouncement.safetyCategory}
                        onChange={(e) => setNewAnnouncement(prev => ({ ...prev, safetyCategory: e.target.value }))}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 text-gray-900"
                      >
                        <option value="">안전 공지를 추가하지 않음</option>
                        <option value="교실안전">교실안전</option>
                        <option value="교통안전">교통안전</option>
                        <option value="운동장안전">운동장안전</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        선택하면 해당 카테고리의 안전 수칙 한 문장이 알림장 마지막에 추가됩니다.
                      </p>
                    </div>

                    {/* 상세 내용 입력 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">활동 상세 내용</label>
                      <textarea
                        value={newAnnouncement.details}
                        onChange={(e) => setNewAnnouncement(prev => ({ ...prev, details: e.target.value }))}
                        placeholder="내일 있을 활동이나 일정을 자세히 설명해주세요."
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 resize-none text-gray-900 placeholder-gray-500"
                        rows={6}
                        maxLength={1000}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        구체적인 일정과 준비사항일수록 더 좋은 알림장이 생성됩니다. ({newAnnouncement.details.length}/1000)
                      </p>
                    </div>

                    {/* AI 적용 안하기 체크박스 */}
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="skipAI"
                        checked={newAnnouncement.skipAI}
                        onChange={(e) => setNewAnnouncement(prev => ({ ...prev, skipAI: e.target.checked }))}
                        className="rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                      />
                      <label htmlFor="skipAI" className="text-sm text-gray-700">
                        AI 적용 안하기
                      </label>
                      <p className="text-xs text-gray-500">
                        (체크하면 안전 수칙만 생성되고 내용은 그대로 저장됩니다)
                      </p>
                    </div>

                    {/* AI 생성 버튼 */}
                    <button
                      onClick={handleGenerateAnnouncement}
                      disabled={isGenerating || !newAnnouncement.details.trim()}
                      className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-6 py-3 rounded-lg hover:from-yellow-600 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-2"
                    >
                      <SparklesIcon className="h-5 w-5" />
                      <span>{isGenerating ? 'AI가 알림장을 생성하고 있습니다...' : 'AI 알림장 생성'}</span>
                    </button>
                  </div>

                  {/* 미리보기 섹션 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">생성된 알림장</label>
                    {newAnnouncement.generatedContent ? (
                      <div>
                        <textarea
                          value={newAnnouncement.generatedContent}
                          onChange={(e) => setNewAnnouncement(prev => ({ ...prev, generatedContent: e.target.value }))}
                          className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 resize-none text-gray-800 leading-relaxed min-h-[300px]"
                          placeholder="생성된 알림장이 여기에 표시됩니다. 내용을 직접 수정할 수 있습니다."
                          rows={12}
                        />
                        <p className="text-xs text-gray-500 mt-2">
                          💡 생성된 내용을 자유롭게 수정하세요. 수정 후 바로 저장할 수 있습니다.
                        </p>
                      </div>
                    ) : (
                      <div className="border border-gray-300 rounded-lg p-4 bg-gray-50 min-h-[300px] flex items-center justify-center">
                        <div className="text-center">
                          <SpeakerWaveIcon className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                          <p className="text-gray-500 text-sm">
                            활동 상세 내용을 입력한 후<br />
                            'AI 알림장 생성' 버튼을 클릭해주세요
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 저장 버튼 */}
                <div className="flex items-center justify-between pt-6 mt-6 border-t">
                  {/* 삭제 버튼 (수정 모드일 때만 표시) */}
                  <div>
                    {editingAnnouncement && (
                      <button
                        onClick={() => handleDeleteAnnouncement(editingAnnouncement.id)}
                        className="px-6 py-2.5 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors font-medium flex items-center space-x-2"
                      >
                        <TrashIcon className="h-4 w-4" />
                        <span>삭제하기</span>
                      </button>
                    )}
                  </div>
                  
                  {/* 취소/저장 버튼 */}
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={handleCancelEdit}
                      className="px-6 py-2.5 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleSaveAnnouncement}
                      disabled={addAnnouncementMutation.isPending || updateAnnouncementMutation.isPending}
                      className="bg-yellow-500 text-white px-6 py-2.5 rounded-lg hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      {editingAnnouncement ? '수정하기' : '저장하기'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 로딩 모달 */}
      <LoadingModal isOpen={isGenerating} message={loadingMessage} />

      {/* 전체화면 보기 모달 */}
      <AnimatePresence>
        {isFullscreenOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex flex-col"
            style={{
              background: '#1a3d2e',
              backgroundColor: '#1a3d2e',
              backgroundImage: `
                repeating-linear-gradient(
                  0deg,
                  transparent,
                  transparent 35px,
                  rgba(255,255,255,0.03) 35px,
                  rgba(255,255,255,0.03) 36px
                ),
                repeating-linear-gradient(
                  90deg,
                  transparent,
                  transparent 35px,
                  rgba(255,255,255,0.02) 35px,
                  rgba(255,255,255,0.02) 36px
                ),
                radial-gradient(circle at 30% 70%, rgba(255,255,255,0.015) 1px, transparent 1px),
                radial-gradient(circle at 70% 30%, rgba(255,255,255,0.015) 1px, transparent 1px)
              `,
              backgroundSize: '40px 40px, 40px 40px, 80px 80px, 80px 80px',
              boxShadow: 'inset 0 0 200px rgba(0,20,10,0.8), inset 0 0 50px rgba(0,0,0,0.5)'
            }}
          >
            {/* 전체화면 헤더 */}
            <div className="flex items-center justify-between p-6 border-b flex-shrink-0" style={{ 
              borderBottomColor: 'rgba(255,255,255,0.15)',
              background: '#16342a',
              boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
            }}>
              <h3 className="text-xl font-semibold flex items-center space-x-2" style={{ color: '#e8f5e8' }}>
                <SpeakerWaveIcon className="h-6 w-6" style={{ color: '#90ee90' }} />
                <span>알림장 전체화면 보기</span>
              </h3>
              <div className="flex items-center space-x-3">
                {/* 글씨 크기 조절 버튼들 */}
                <div className="flex items-center space-x-2 rounded-lg p-2 border" style={{ 
                  background: 'rgba(255,255,255,0.08)', 
                  borderColor: 'rgba(255,255,255,0.2)',
                  backdropFilter: 'blur(10px)'
                }}>
                  <button
                    onClick={decreaseFontSize}
                    className="p-1 rounded transition-colors hover:bg-white hover:bg-opacity-15"
                    style={{ 
                      color: '#f0fff0'
                    }}
                    title="글씨 크기 줄이기"
                    disabled={fontSize <= 0.5}
                  >
                    <span className="text-lg font-bold">A-</span>
                  </button>
                  <button
                    onClick={resetFontSize}
                    className="px-2 py-1 text-xs rounded transition-colors hover:bg-white hover:bg-opacity-15"
                    style={{ 
                      color: '#f0fff0'
                    }}
                    title="기본 크기"
                  >
                    기본
                  </button>
                  <button
                    onClick={increaseFontSize}
                    className="p-1 rounded transition-colors hover:bg-white hover:bg-opacity-15"
                    style={{ 
                      color: '#f0fff0'
                    }}
                    title="글씨 크기 키우기"
                    disabled={fontSize >= 6}
                  >
                    <span className="text-lg font-bold">A+</span>
                  </button>
                </div>
                <button
                  onClick={handleCloseFullscreen}
                  className="p-2 rounded-lg transition-colors hover:bg-white hover:bg-opacity-15"
                  style={{ 
                    color: '#f0fff0'
                  }}
                  title="전체화면 닫기"
                >
                  <XMarkIcon className="h-8 w-8" />
                </button>
              </div>
            </div>

            {/* 전체화면 내용 */}
            <div className="flex-1 overflow-y-auto p-16 md:p-20 lg:p-24">
              <div className="h-full w-full flex items-start">
                <div 
                  className="whitespace-pre-wrap leading-relaxed font-bold w-full"
                  style={{
                    fontSize: `${currentFontSize}px`,
                    color: '#ffffff'
                  }}
                >
                  {newAnnouncement.generatedContent}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
} 