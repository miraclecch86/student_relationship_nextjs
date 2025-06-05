'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, Class, ClassDailyRecord } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeftIcon,
  PlusIcon,
  XMarkIcon,
  TrashIcon,
  PencilIcon,
  CalendarDaysIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import toast from 'react-hot-toast';
import StudentDetailForm from '@/components/StudentDetailForm';
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

// 학급 학생 목록 조회
async function fetchClassStudents(classId: string): Promise<any[]> {
  const { data, error } = await (supabase as any)
    .from('students')
    .select('id, name')
    .eq('class_id', classId)
    .order('created_at', { ascending: true }); // 생성된 순서대로 정렬
  
  if (error) {
    console.error('Error fetching students:', error);
    return [];
  }
  
  return data || [];
}

// 전체 학급의 우리반 기록 조회 (모든 기록)
async function fetchAllDailyRecords(classId: string): Promise<any[]> {
  const { data, error } = await (supabase as any)
    .from('class_daily_records')
    .select('*')
    .eq('class_id', classId)
    .order('actual_date', { ascending: false });

  if (error) {
    console.error('Error fetching all daily records:', error);
    return [];
  }

  return data || [];
}

// 우리반 기록 추가
async function addDailyRecord(recordData: any): Promise<any> {
  const { data, error } = await (supabase as any)
    .from('class_daily_records')
    .insert(recordData)
    .select()
    .single();

  if (error) {
    throw new Error('기록 추가 중 오류가 발생했습니다.');
  }

  return data;
}

// 우리반 기록 수정
async function updateDailyRecord(recordId: string, recordData: any): Promise<any> {
  const { data, error } = await (supabase as any)
    .from('class_daily_records')
    .update(recordData)
    .eq('id', recordId)
    .select()
    .single();

  if (error) {
    throw new Error('기록 수정 중 오류가 발생했습니다.');
  }

  return data;
}

// 우리반 기록 삭제
const deleteDailyRecord = async (recordId: string): Promise<void> => {
  const { error } = await (supabase as any)
    .from('class_daily_records')
    .delete()
    .eq('id', recordId);

  if (error) {
    throw new Error('기록 삭제 중 오류가 발생했습니다.');
  }
};

// 텍스트에서 학생 이름을 해시태그로 변환하는 함수
function convertStudentNamesToHashtags(text: string, students: any[]): string {
  if (!text || !students || students.length === 0) return text;
  
  let convertedText = text;
  
  // 학생 이름을 긴 것부터 짧은 것 순으로 정렬 (긴 이름이 먼저 매칭되도록)
  const sortedStudents = [...students].sort((a, b) => b.name.length - a.name.length);
  
  sortedStudents.forEach(student => {
    if (!student.name) return;
    
    // 이미 해시태그가 아닌 학생 이름만 변환 (lookbehind assertion 사용)
    // (?<!#)를 사용하여 # 바로 뒤에 있지 않은 학생 이름만 매칭
    const nameRegex = new RegExp(`(?<!#)${student.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
    
    convertedText = convertedText.replace(nameRegex, `#${student.name}`);
  });
  
  return convertedText;
}

// 학생 이름이 포함된 텍스트를 렌더링하는 함수 (해시태그 없이 표시)
function renderTextWithHashtags(text: string, students: any[], onStudentClick?: (student: any) => void): React.ReactNode {
  if (!text) return text;
  
  const studentNames = students.map((s: any) => s.name);
  const hashtagPattern = new RegExp(`#(${studentNames.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  
  while ((match = hashtagPattern.exec(text)) !== null) {
    // 해시태그 이전 텍스트 추가
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    
    const studentName = match[1];
    const student = students.find(s => s.name === studentName);
    
    // 학생 이름을 해시태그 없이 스타일링하여 표시
    parts.push(
      <span 
        key={`student-${match.index}`}
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mx-0.5 ${
          onStudentClick && student ? 'cursor-pointer hover:bg-blue-200 hover:text-blue-900 transition-colors' : ''
        }`}
        onClick={() => {
          if (onStudentClick && student) {
            onStudentClick(student);
          }
        }}
        title={student ? `${student.name} 상세정보 보기` : undefined}
      >
        {studentName}
      </span>
    );
    
    lastIndex = match.index + match[0].length;
  }
  
  // 마지막 텍스트 추가
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  
  return parts.length > 0 ? parts : text;
}

export default function DailyRecordsPage() {
  const router = useRouter();
  const params = useParams();
  const classId = params.classId as string;
  const dateParam = params.date as string;
  const recordDate = dateParam;

  const [editingRecord, setEditingRecord] = useState<ClassDailyRecord | null>(null);
  const [newRecord, setNewRecord] = useState({
    content: '',
    actual_date: recordDate, // 기본값은 현재 페이지 날짜
    hashtags: [] as string[] // 해시태그 배열 추가
  });

  // 해시태그 옵션 정의
  const hashtagOptions = [
    { id: 'counseling', label: '상담', color: 'bg-blue-100 text-blue-800 border-blue-200' },
    { id: 'incident', label: '사건사고', color: 'bg-red-100 text-red-800 border-red-200' },
    { id: 'praise', label: '칭찬', color: 'bg-green-100 text-green-800 border-green-200' },
    { id: 'discipline', label: '훈육', color: 'bg-orange-100 text-orange-800 border-orange-200' },
    { id: 'health', label: '건강', color: 'bg-purple-100 text-purple-800 border-purple-200' }
  ];

  // 월별 접기/펼치기 상태 관리
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  // 학생 상세정보 모달 상태
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);

  // 기록 작성/수정 모달 상태
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);

  // 검색 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [hashtagFilter, setHashtagFilter] = useState<string[]>([]);
  const [studentFilter, setStudentFilter] = useState<string[]>([]);

  const queryClient = useQueryClient();

  // 학급 정보 조회
  const { data: classDetails, isLoading: isClassLoading } = useQuery<Class | null, Error>({
    queryKey: ['classDetails', classId],
    queryFn: () => fetchClassDetails(classId),
    enabled: !!classId,
  });

  // 학급 학생 목록 조회
  const { data: students = [], isLoading: isStudentsLoading } = useQuery<any[], Error>({
    queryKey: ['students', classId],
    queryFn: () => fetchClassStudents(classId),
    enabled: !!classId,
  });

  // 일별 기록 조회
  const { data: dailyRecords, isLoading: isRecordsLoading } = useQuery<ClassDailyRecord[], Error>({
    queryKey: ['daily-records', classId],
    queryFn: () => fetchAllDailyRecords(classId),
    enabled: !!classId,
  });

  // 해시태그 필터 토글 핸들러
  const toggleHashtagFilter = (hashtagId: string) => {
    setHashtagFilter(prev => 
      prev.includes(hashtagId)
        ? prev.filter(id => id !== hashtagId)
        : [...prev, hashtagId]
    );
  };

  // 학생 필터 토글 핸들러
  const toggleStudentFilter = (studentId: string) => {
    setStudentFilter(prev => 
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  // 월별로 그룹화된 기록들 (actual_date 기준)
  const monthlyGroupedRecords = useMemo(() => {
    if (!dailyRecords) return new Map();
    
    // 검색어가 있는 경우 필터링
    let filteredRecords = dailyRecords;
    if (searchQuery.trim()) {
      // 검색어를 +로 분리하여 각각을 키워드로 처리 (AND 조건)
      const keywords = searchQuery.toLowerCase().trim().split('+').map(keyword => keyword.trim()).filter(keyword => keyword.length > 0);
      
      filteredRecords = dailyRecords.filter(record => {
        const titleContent = record.title.toLowerCase();
        const bodyContent = record.content.toLowerCase();
        
        // 모든 키워드가 제목 또는 내용에 포함되어야 함 (AND 조건)
        return keywords.every(keyword => 
          titleContent.includes(keyword) || bodyContent.includes(keyword)
        );
      });
    }

    // 해시태그 필터링
    if (hashtagFilter.length > 0) {
      filteredRecords = filteredRecords.filter(record => {
        // 선택된 해시태그가 모두 포함되어야 함
        return hashtagFilter.every(filterTag => {
          const tagLabel = hashtagOptions.find(option => option.id === filterTag)?.label;
          return tagLabel && record.content.includes(`#${tagLabel}`);
        });
      });
    }

    // 학생 필터링 (AND 조건: 선택된 모든 학생이 언급되어야 함)
    if (studentFilter.length > 0) {
      filteredRecords = filteredRecords.filter(record => {
        // 선택된 모든 학생이 언급되어야 함
        return studentFilter.every(studentId => {
          const student = students.find(s => s.id === studentId);
          return student && record.content.includes(student.name);
        });
      });
    }
    
    const grouped = new Map<string, any[]>();
    
    filteredRecords.forEach(record => {
      const actualDate = record.actual_date || record.record_date;
      const monthKey = format(parseISO(actualDate), 'yyyy-MM');
      
      if (!grouped.has(monthKey)) {
        grouped.set(monthKey, []);
      }
      grouped.get(monthKey)!.push(record);
    });
    
    // 각 월의 기록들을 날짜 순으로 정렬 (빠른 날짜부터)
    grouped.forEach(records => {
      records.sort((a, b) => {
        const dateA = a.actual_date || a.record_date;
        const dateB = b.actual_date || b.record_date;
        return dateA.localeCompare(dateB);
      });
    });
    
    return grouped;
  }, [dailyRecords, searchQuery, hashtagFilter, studentFilter, hashtagOptions, students]);

  // 현재 월을 기본으로 확장
  useEffect(() => {
    const currentMonth = format(parseISO(recordDate), 'yyyy-MM');
    setExpandedMonths(prev => new Set([...prev, currentMonth]));
  }, [recordDate]);

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

  // 학생 드롭다운 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const dropdown = document.getElementById('student-dropdown');
      const button = document.getElementById('student-filter-button');
      
      if (dropdown && button && 
          !dropdown.contains(event.target as Node) && 
          !button.contains(event.target as Node)) {
        dropdown.style.display = 'none';
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 기록 추가 뮤테이션
  const addRecordMutation = useMutation({
    mutationFn: addDailyRecord,
    onSuccess: () => {
      toast.success('기록이 추가되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['daily-records'] });
      setNewRecord({ content: '', actual_date: recordDate, hashtags: [] });
      setEditingRecord(null);
      setIsRecordModalOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // 기록 수정 뮤테이션
  const updateRecordMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ClassDailyRecord> }) => 
      updateDailyRecord(id, data),
    onSuccess: () => {
      toast.success('기록이 수정되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['daily-records'] });
      setNewRecord({ content: '', actual_date: recordDate, hashtags: [] });
      setEditingRecord(null);
      setIsRecordModalOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // 기록 삭제 뮤테이션
  const deleteRecordMutation = useMutation({
    mutationFn: deleteDailyRecord,
    onSuccess: () => {
      toast.success('기록이 삭제되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['daily-records'] });
      // 삭제된 기록이 현재 편집 중인 기록이면 폼 초기화
      if (editingRecord) {
        setNewRecord({ content: '', actual_date: recordDate, hashtags: [] });
        setEditingRecord(null);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // 새 기록 작성 모드로 전환
  // 해시태그 토글 핸들러
  const toggleHashtag = (hashtagId: string) => {
    setNewRecord(prev => ({
      ...prev,
      hashtags: prev.hashtags.includes(hashtagId)
        ? prev.hashtags.filter(id => id !== hashtagId)
        : [...prev.hashtags, hashtagId]
    }));
  };

  const handleNewRecord = () => {
    setEditingRecord(null);
    setNewRecord({ content: '', actual_date: recordDate, hashtags: [] });
    setIsRecordModalOpen(true);
  };

  // 기록 수정 핸들러
  const handleEditRecord = (record: any) => {
    setEditingRecord(record);
    setNewRecord({
      content: record.content,
      actual_date: record.actual_date || record.record_date, // 실제 날짜가 없으면 기록 날짜 사용
      hashtags: record.hashtags || [] // 기존 해시태그 로드
    });
    setIsRecordModalOpen(true);
  };

  // 기록 저장 핸들러
  const handleSaveRecord = () => {
    if (!newRecord.content.trim()) {
      toast.error('내용을 입력해주세요.');
      return;
    }

    // 저장하기 전에 학생 이름을 해시태그로 변환
    let convertedContent = convertStudentNamesToHashtags(newRecord.content, students);
    
    // 선택된 해시태그들을 본문 끝에 추가
    if (newRecord.hashtags.length > 0) {
      const selectedHashtags = newRecord.hashtags
        .map(id => hashtagOptions.find(option => option.id === id)?.label)
        .filter(Boolean)
        .map(label => `#${label}`)
        .join(' ');
      
      // 본문 끝에 해시태그 추가 (줄바꿈 후)
      convertedContent = `${convertedContent}\n\n${selectedHashtags}`;
    }
    
    // 내용의 앞부분을 제목으로 사용 (50자 제한)
    const autoTitle = convertedContent.slice(0, 50).replace(/\n/g, ' ').trim();

    const recordData = {
      class_id: classId,
      record_date: recordDate,
      title: autoTitle,
      content: convertedContent,
      actual_date: newRecord.actual_date,
      hashtags: newRecord.hashtags // 해시태그 저장
    };

    if (editingRecord) {
      updateRecordMutation.mutate({ id: editingRecord.id, data: recordData });
    } else {
      addRecordMutation.mutate(recordData);
    }
  };

  // 텍스트 변경 핸들러 (실시간 해시태그 변환)
  const handleContentChange = (value: string) => {
    // 실시간 변환 대신 단순히 값만 저장
    setNewRecord(prev => ({ ...prev, content: value }));
  };

  // contentEditable div 참조
  const editableRef = useRef<HTMLDivElement>(null);

  // 커서 위치 저장 및 복원 함수들
  const saveCaretPosition = (element: HTMLElement) => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(element);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      return preCaretRange.toString().length;
    }
    return 0;
  };

  const restoreCaretPosition = (element: HTMLElement, caretPos: number) => {
    const selection = window.getSelection();
    if (selection) {
      let charIndex = 0;
      const range = document.createRange();
      range.setStart(element, 0);
      range.collapse(true);

      const nodeIterator = document.createNodeIterator(
        element,
        NodeFilter.SHOW_TEXT,
        null
      );

      let textNode;
      while (textNode = nodeIterator.nextNode()) {
        const textLength = textNode.textContent?.length || 0;
        if (charIndex + textLength >= caretPos) {
          range.setStart(textNode, caretPos - charIndex);
          break;
        }
        charIndex += textLength;
      }

      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  };

  // contentEditable div에서 사용할 HTML 생성 함수
  const generateEditableHTML = (text: string): string => {
    if (!text) return '';
    
    const studentNames = students.map((s: any) => s.name);
    if (studentNames.length === 0) return text;
    
    const hashtagPattern = new RegExp(`#(${studentNames.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
    
    return text.replace(hashtagPattern, (match, studentName) => {
      return `<span class="hashtag-student inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mx-0.5 cursor-pointer hover:bg-blue-200 hover:text-blue-900 transition-colors" data-student="${studentName}">${match}</span>`;
    });
  };

  // contentEditable div 업데이트
  useEffect(() => {
    if (editableRef.current) {
      const htmlContent = newRecord.content ? generateEditableHTML(newRecord.content) : '';
      if (editableRef.current.innerHTML !== htmlContent) {
        editableRef.current.innerHTML = htmlContent;
      }
    }
  }, [newRecord.content, students]);

  // contentEditable div 클릭 핸들러
  const handleEditableClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('hashtag-student')) {
      e.preventDefault();
      const studentName = target.getAttribute('data-student');
      if (studentName) {
        const student = students.find(s => s.name === studentName);
        if (student) {
          handleStudentClick(student);
        }
      }
    }
  };

  // 기록 삭제 핸들러
  const handleDeleteRecord = (recordId: string) => {
    if (confirm('정말로 이 기록을 삭제하시겠습니까?')) {
      deleteRecordMutation.mutate(recordId);
      // 삭제 후 모달 닫기
      setIsRecordModalOpen(false);
      setEditingRecord(null);
      setNewRecord({ content: '', actual_date: recordDate, hashtags: [] });
    }
  };

  // 폼 취소 핸들러
  const handleCancelEdit = () => {
    setEditingRecord(null);
    setNewRecord({ content: '', actual_date: recordDate, hashtags: [] });
    setIsRecordModalOpen(false);
  };

  // 학생 클릭 핸들러
  const handleStudentClick = (student: any) => {
    setSelectedStudent(student);
    setIsStudentModalOpen(true);
  };

  // 학생 모달 닫기
  const closeStudentModal = () => {
    setIsStudentModalOpen(false);
    setSelectedStudent(null);
  };

  // 엑셀 추출 함수
  const exportToExcel = () => {
    try {
      // 현재 필터링된 기록들을 가져옴
      const recordsToExport = Array.from(monthlyGroupedRecords.values()).flat();
      
      if (recordsToExport.length === 0) {
        toast.error('내보낼 기록이 없습니다.');
        return;
      }

      // 엑셀 데이터 준비
      const excelData = recordsToExport.map((record: any, index) => {
        // 학생 이름의 해시태그만 제거하고 다른 해시태그는 유지
        const studentNames = students.map((s: any) => s.name);
        const studentHashtagPattern = new RegExp(`#(${studentNames.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
        
        const cleanContent = record.content
          .replace(studentHashtagPattern, '$1') // 학생 해시태그만 # 제거
          .replace(/\n+/g, ' ') // 줄바꿈을 공백으로 변경
          .trim();

        // 상황 해시태그만 추출 (학생 이름이 포함된 모든 해시태그 제외)
        const allHashtags = record.content.match(/#[^\s#]+/g) || [];
        const situationHashtags = allHashtags.filter((tag: string) => {
          const tagName = tag.substring(1); // # 제거
          // 학생 이름이 포함된 해시태그는 모두 제외 (조사 등이 붙어도 제외)
          return !studentNames.some(studentName => tagName.includes(studentName));
        }).join(' ');

        return {
          '번호': index + 1,
          '날짜': format(parseISO(record.actual_date || record.record_date), 'yyyy-MM-dd (E)', { locale: ko }),
          '내용': cleanContent,
          '상황 해시태그': situationHashtags,
          '작성일': format(parseISO(record.created_at), 'yyyy-MM-dd HH:mm', { locale: ko }),
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
        { wch: 25 },  // 제목
        { wch: 50 },  // 내용
        { wch: 20 },  // 해시태그
        { wch: 18 },  // 작성일
      ];
      worksheet['!cols'] = columnWidths;

      // 워크북에 워크시트 추가
      XLSX.utils.book_append_sheet(workbook, worksheet, '누가기록');

      // 파일명 생성
      const currentDate = format(new Date(), 'yyyy-MM-dd');
      const className = classDetails?.name || '학급';
      const filterInfo = searchQuery || hashtagFilter.length > 0 || studentFilter.length > 0 ? '_검색결과' : '';
      const filename = `${className}_누가기록_${currentDate}${filterInfo}.xlsx`;

      // 파일 다운로드
      XLSX.writeFile(workbook, filename);
      
      toast.success(`엑셀 파일이 다운로드되었습니다: ${filename}`);
    } catch (error) {
      console.error('Excel export error:', error);
      toast.error('엑셀 파일 생성 중 오류가 발생했습니다.');
    }
  };

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
      const recordsToImport = [];
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        
        // 필수 필드 확인
        if (!row['날짜'] || !row['내용']) {
          toast.error(`${i + 2}번째 행에 필수 데이터가 누락되었습니다. (날짜, 내용 필수)`);
          return;
        }

        // 날짜 파싱
        let recordDate;
        try {
          // 엑셀 날짜 형식 파싱 (yyyy-MM-dd (요일) 형식)
          const dateStr = row['날짜'].toString();
          const dateMatch = dateStr.match(/(\d{4}-\d{2}-\d{2})/);
          if (dateMatch) {
            recordDate = dateMatch[1];
          } else {
            throw new Error('날짜 형식 오류');
          }
        } catch (error) {
          toast.error(`${i + 2}번째 행의 날짜 형식이 올바르지 않습니다. (yyyy-MM-dd 형식 필요)`);
          return;
        }

        // 내용 처리 - 상황 해시태그를 내용에 포함
        let content = row['내용'].toString().trim();
        if (row['상황 해시태그']) {
          const hashtags = row['상황 해시태그'].toString().trim();
          if (hashtags) {
            content += ' ' + hashtags;
          }
        }

                 recordsToImport.push({
           class_id: classId,
           record_date: recordDate,
           actual_date: recordDate,
           title: content.slice(0, 50) + (content.length > 50 ? '...' : ''), // 내용의 첫 50자를 제목으로 사용
           content: content,
           created_at: new Date().toISOString(),
           updated_at: new Date().toISOString()
         });
      }

      // 서버에 데이터 전송
      const response = await fetch(`/api/class/${classId}/journal/bulk-import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ records: recordsToImport }),
      });

      if (!response.ok) {
        throw new Error('데이터 저장 실패');
      }

      const result = await response.json();
      
      toast.success(`${result.count}개의 기록이 성공적으로 가져와졌습니다.`);
      
      // 데이터 즉시 새로고침 - React Query 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['daily-records'] });
      
      // 파일 입력 초기화
      event.target.value = '';
      
    } catch (error) {
      console.error('Excel import error:', error);
      toast.error('엑셀 파일 가져오기 중 오류가 발생했습니다.');
    }
  };

  if (isClassLoading || isStudentsLoading || isRecordsLoading) {
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

  const formattedDate = format(parseISO(recordDate), 'yyyy년 M월 d일 (E)', { locale: ko });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.back()}
              className="flex items-center px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors shadow-sm"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              <span>돌아가기</span>
            </button>
            <div className="h-6 w-px bg-gray-300" />
            <h1 className="text-2xl font-bold text-gray-800 flex items-center space-x-2">
              <CalendarDaysIcon className="h-6 w-6 text-purple-600" />
              <span>누가 기록</span>
            </h1>
          </div>
        </div>

        {/* 날짜 정보 */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <CalendarDaysIcon className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-800">{classDetails.name}</h2>
              <p className="text-sm text-gray-600">{formattedDate}</p>
            </div>
          </div>
        </div>

        {/* 메인 콘텐츠 - 기록 목록만 전체 화면 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          {/* 헤더 - 검색창과 새 기록 버튼 */}
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
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm text-gray-900 placeholder-gray-500"
                  placeholder="검색어를 입력하세요 (여러 단어는 +로 구분)"
                />
              </div>
              {searchQuery && (
                <p className="text-xs text-gray-500 mt-1">
                  "{searchQuery}" 검색 결과 (+ 구분, 모든 단어 포함)
                </p>
              )}
              
              {/* 해시태그 필터 */}
              <div className="mt-3">
                <div className="flex gap-1 items-center overflow-x-auto whitespace-nowrap">
                  {hashtagOptions.map((hashtag) => (
                    <button
                      key={hashtag.id}
                      onClick={() => toggleHashtagFilter(hashtag.id)}
                      className={`px-2 py-1 rounded text-xs font-medium border transition-colors whitespace-nowrap flex-shrink-0 ${
                        hashtagFilter.includes(hashtag.id)
                          ? `${hashtag.color} border-current`
                          : 'bg-gray-50 text-gray-600 border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      #{hashtag.label}
                    </button>
                  ))}
                  {hashtagFilter.length > 0 && (
                    <button
                      onClick={() => setHashtagFilter([])}
                      className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 transition-colors whitespace-nowrap flex-shrink-0"
                    >
                      해시태그 지우기
                    </button>
                  )}
                </div>
              </div>

              {/* 학생 필터 */}
              <div className="mt-3">
                <div className="relative">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 whitespace-nowrap">학생:</span>
                    <div className="relative">
                      <select
                        multiple
                        value={studentFilter}
                        onChange={(e) => {
                          const selectedValues = Array.from(e.target.selectedOptions, option => option.value);
                          setStudentFilter(selectedValues);
                        }}
                        className="hidden"
                        id="student-filter-select"
                      >
                        {students.map((student) => (
                          <option key={student.id} value={student.id}>
                            {student.name}
                          </option>
                        ))}
                      </select>
                      
                      {/* 커스텀 드롭다운 */}
                      <div className="relative inline-block">
                        <button
                          type="button"
                          id="student-filter-button"
                          onClick={() => {
                            const dropdown = document.getElementById('student-dropdown');
                            if (dropdown) {
                              dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
                            }
                          }}
                          className="px-2 py-1 text-sm font-medium text-gray-700 border border-gray-300 rounded bg-white hover:bg-gray-50 transition-colors flex items-center space-x-1 whitespace-nowrap"
                        >
                          <span>
                            {studentFilter.length > 0 
                              ? `${studentFilter.length}명 선택됨`
                              : '학생 선택'
                            }
                          </span>
                          <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        
                        <div
                          id="student-dropdown"
                          style={{ display: 'none' }}
                          className="absolute z-10 mt-1 w-48 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto"
                        >
                          {students.map((student) => (
                            <label
                              key={student.id}
                              className="flex items-center px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm font-medium text-gray-800"
                            >
                              <input
                                type="checkbox"
                                checked={studentFilter.includes(student.id)}
                                onChange={() => toggleStudentFilter(student.id)}
                                className="mr-3 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                              />
                              <span className="text-gray-800 font-medium">{student.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    {/* 선택된 학생들 표시 (한 줄로 표시) */}
                    {studentFilter.length > 0 && (
                      <div className="flex gap-1 items-center overflow-x-auto whitespace-nowrap">
                        {studentFilter.map(studentId => {
                          const student = students.find(s => s.id === studentId);
                          return student ? (
                            <span
                              key={studentId}
                              className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded border border-blue-200 whitespace-nowrap flex-shrink-0"
                            >
                              {student.name}
                              <button
                                onClick={() => toggleStudentFilter(studentId)}
                                className="ml-1 text-blue-600 hover:text-blue-800"
                              >
                                ×
                              </button>
                            </span>
                          ) : null;
                        })}
                        <button
                          onClick={() => setStudentFilter([])}
                          className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 transition-colors whitespace-nowrap flex-shrink-0"
                        >
                          학생 지우기
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <h3 className="text-lg font-semibold text-gray-800">
                {(searchQuery || hashtagFilter.length > 0 || studentFilter.length > 0) ? `검색 결과` : '기록 목록'}
                {dailyRecords && (
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    ({(searchQuery || hashtagFilter.length > 0 || studentFilter.length > 0) ? 
                      Array.from(monthlyGroupedRecords.values()).reduce((sum, records) => sum + records.length, 0) :
                      dailyRecords.length
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
                onClick={handleNewRecord}
                className="flex items-center space-x-2 bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors"
              >
                <PlusIcon className="h-5 w-5" />
                <span>새 기록</span>
              </button>
              
              {(searchQuery || hashtagFilter.length > 0 || studentFilter.length > 0) && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setHashtagFilter([]);
                    setStudentFilter([]);
                  }}
                  className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors border border-gray-300 rounded-lg"
                >
                  초기화
                </button>
              )}
            </div>
          </div>
          
          {/* 기록 목록 */}
          <div className="space-y-4">
            <AnimatePresence>
              {monthlyGroupedRecords.size > 0 ? (
                // 월별로 순서대로 정렬 (1월부터 12월까지)
                Array.from(monthlyGroupedRecords.entries())
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([monthKey, records]) => {
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
                              {records.length}개
                            </span>
                          </div>
                          <motion.div
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronDownIcon className="h-5 w-5 text-gray-500" />
                          </motion.div>
                        </button>

                        {/* 월별 기록 목록 */}
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
                                {records.map((record: any) => (
                                  <motion.div
                                    key={record.id}
                                    layout
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="p-2 cursor-pointer transition-all group hover:bg-gray-50"
                                    onClick={() => handleEditRecord(record)}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                                        <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                                          <CalendarDaysIcon className="h-3 w-3 text-purple-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          {/* 내용 */}
                                          <div className="text-gray-800 text-xs truncate">
                                            {renderTextWithHashtags(record.content, students)}
                                          </div>
                                        </div>
                                      </div>
                                      
                                      {/* 오른쪽: 날짜 */}
                                      <div className="flex items-center space-x-2 flex-shrink-0">
                                        {/* 날짜 */}
                                        <div className="text-purple-600 text-xs font-medium">
                                          {format(parseISO(record.actual_date || record.record_date), 'M/d (E)', { locale: ko })}
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
                  <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    {searchQuery ? (
                      <MagnifyingGlassIcon className="h-8 w-8 text-purple-600" />
                    ) : (
                      <CalendarDaysIcon className="h-8 w-8 text-purple-600" />
                    )}
                  </div>
                  {(searchQuery || hashtagFilter.length > 0) ? (
                    <>
                      <p className="text-gray-600 mb-4">
                        {searchQuery && hashtagFilter.length > 0 
                          ? `"${searchQuery}" 및 선택된 해시태그에 대한 검색 결과가 없습니다`
                          : searchQuery 
                            ? `"${searchQuery}"에 대한 검색 결과가 없습니다`
                            : `선택된 해시태그에 대한 검색 결과가 없습니다`
                        }
                      </p>
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setHashtagFilter([]);
                        }}
                        className="text-purple-600 hover:text-purple-800 font-medium"
                      >
                        모든 기록 보기
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-gray-600 mb-4">아직 기록이 없습니다</p>
                      <button
                        onClick={handleNewRecord}
                        className="text-purple-600 hover:text-purple-800 font-medium"
                      >
                        첫 번째 기록 작성하기
                      </button>
                    </>
                  )}
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* 기록 작성/수정 모달 */}
      <AnimatePresence>
        {isRecordModalOpen && (
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
              className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                {/* 모달 헤더 */}
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-gray-800">
                    {editingRecord ? '기록 수정' : '새 기록 작성'}
                  </h3>
                  <button
                    onClick={handleCancelEdit}
                    className="text-gray-500 hover:text-gray-700 p-1"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* 실제 발생 날짜 선택 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">실제 발생 날짜</label>
                    <input
                      type="date"
                      value={newRecord.actual_date}
                      onChange={(e) => setNewRecord(prev => ({ ...prev, actual_date: e.target.value }))}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      언제 일어난 일인지 날짜를 선택하세요. (오늘 입력하지만 어제 일어난 일일 수도 있어요)
                    </p>
                  </div>

                  {/* 해시태그 선택 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">상황 분류 (해시태그)</label>
                    <div className="flex flex-wrap gap-2">
                      {hashtagOptions.map((hashtag) => (
                        <button
                          key={hashtag.id}
                          type="button"
                          onClick={() => toggleHashtag(hashtag.id)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                            newRecord.hashtags.includes(hashtag.id)
                              ? `${hashtag.color} border-current`
                              : 'bg-gray-50 text-gray-600 border-gray-300 hover:bg-gray-100'
                          }`}
                        >
                          #{hashtag.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      💡 선택한 해시태그는 저장 시 본문 맨 아래에 자동으로 추가됩니다. 검색 시 해시태그로 필터링할 수 있어요.
                    </p>
                  </div>

                  {/* 내용 입력 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">내용</label>
                    <div
                      contentEditable={true}
                      suppressContentEditableWarning={true}
                      className="w-full min-h-[300px] p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none text-gray-900 leading-relaxed"
                      style={{
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        outline: 'none'
                      }}
                      ref={editableRef}
                      onInput={(e) => {
                        const target = e.currentTarget;
                        if (target) {
                          const text = target.innerText || '';
                          handleContentChange(text);
                        }
                      }}
                      onKeyDown={(e) => {
                        // 백스페이스 키 처리 - 해시태그 통째로 삭제
                        if (e.key === 'Backspace' && editableRef.current) {
                          const selection = window.getSelection();
                          if (selection && selection.rangeCount > 0) {
                            const range = selection.getRangeAt(0);
                            const container = range.startContainer;
                            
                            // 커서가 해시태그 span 내부에 있는지 확인
                            let hashtagElement = null;
                            if (container.nodeType === Node.TEXT_NODE) {
                              const parent = container.parentElement;
                              if (parent && parent.classList.contains('hashtag-student')) {
                                hashtagElement = parent;
                              }
                            } else if (container.nodeType === Node.ELEMENT_NODE) {
                              const element = container as HTMLElement;
                              if (element.classList.contains('hashtag-student')) {
                                hashtagElement = element;
                              }
                            }
                            
                            // 해시태그 내부에 있으면 전체 삭제
                            if (hashtagElement) {
                              e.preventDefault();
                              
                              // 해시태그 앞의 텍스트 위치 계산
                              let textLength = 0;
                              const walker = document.createTreeWalker(
                                editableRef.current,
                                NodeFilter.SHOW_TEXT,
                                null
                              );
                              
                              let node;
                              while (node = walker.nextNode()) {
                                if (node.parentElement === hashtagElement) {
                                  break;
                                }
                                textLength += node.textContent?.length || 0;
                              }
                              
                              // 현재 내용에서 해시태그 제거
                              const currentText = editableRef.current.innerText || '';
                              const hashtagText = hashtagElement.textContent || '';
                              const beforeHashtag = currentText.substring(0, textLength);
                              const afterHashtag = currentText.substring(textLength + hashtagText.length);
                              const newText = beforeHashtag + afterHashtag;
                              
                              // 상태 업데이트
                              setNewRecord(prev => ({ ...prev, content: newText }));
                              
                              // DOM 업데이트 후 커서 위치 복원
                              setTimeout(() => {
                                if (editableRef.current) {
                                  restoreCaretPosition(editableRef.current, textLength);
                                }
                              }, 10);
                              
                              return;
                            }
                          }
                        }
                        
                        // 스페이스바, 엔터, 탭, 쉼표, 마침표 등을 눌렀을 때 변환 체크
                        if ([' ', 'Enter', 'Tab', ',', '.', '!', '?'].includes(e.key)) {
                          setTimeout(() => {
                            if (editableRef.current) {
                              // 현재 커서 위치 저장 (실제 텍스트 위치)
                              const selection = window.getSelection();
                              let caretPos = 0;
                              
                              if (selection && selection.rangeCount > 0) {
                                const range = selection.getRangeAt(0);
                                const preCaretRange = range.cloneRange();
                                preCaretRange.selectNodeContents(editableRef.current);
                                preCaretRange.setEnd(range.endContainer, range.endOffset);
                                caretPos = preCaretRange.toString().length;
                              }
                              
                              const currentValue = editableRef.current.innerText || '';
                              const convertedValue = convertStudentNamesToHashtags(currentValue, students);
                              
                              if (currentValue !== convertedValue) {
                                // 변환 전 커서 앞의 텍스트
                                const textBeforeCaret = currentValue.slice(0, caretPos);
                                const convertedTextBeforeCaret = convertStudentNamesToHashtags(textBeforeCaret, students);
                                
                                // 변환된 텍스트로 상태 업데이트
                                setNewRecord(prev => ({ ...prev, content: convertedValue }));
                                
                                // DOM 업데이트 후 커서 위치 복원
                                setTimeout(() => {
                                  if (editableRef.current) {
                                    // 변환된 텍스트에서의 새로운 커서 위치
                                    const newCaretPos = convertedTextBeforeCaret.length;
                                    restoreCaretPosition(editableRef.current, newCaretPos);
                                  }
                                }, 10);
                              }
                            }
                          }, 100);
                        }
                      }}
                      onClick={handleEditableClick}
                      data-placeholder={newRecord.content ? '' : '자세한 내용을 입력하세요...'}
                    />
                    <style jsx>{`
                      [contenteditable]:empty:before {
                        content: attr(data-placeholder);
                        color: #9CA3AF;
                        pointer-events: none;
                      }
                    `}</style>
                    <p className="text-xs text-gray-500 mt-2">
                      💡 학생 이름을 입력하고 스페이스바나 쉼표를 누르면 자동으로 해시태그가 됩니다. 해시태그를 클릭하면 학생 상세정보를 볼 수 있어요.
                    </p>
                  </div>

                  {/* 저장 버튼 */}
                  <div className="flex items-center justify-between pt-4 border-t">
                    {/* 삭제 버튼 (수정 모드일 때만 표시) */}
                    <div>
                      {editingRecord && (
                        <button
                          onClick={() => handleDeleteRecord(editingRecord.id)}
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
                        onClick={handleSaveRecord}
                        disabled={addRecordMutation.isPending || updateRecordMutation.isPending}
                        className="bg-purple-500 text-white px-6 py-2.5 rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                      >
                        {editingRecord ? '수정하기' : '저장하기'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 학생 상세정보 모달 */}
      <AnimatePresence>
        {isStudentModalOpen && selectedStudent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            onClick={closeStudentModal}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[95vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <StudentDetailForm
                studentId={selectedStudent.id}
                classId={classId}
                onClose={closeStudentModal}
                onSave={(updatedStudent) => {
                  // 학생 목록 새로고침
                  queryClient.invalidateQueries({ queryKey: ['students', classId] });
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
} 