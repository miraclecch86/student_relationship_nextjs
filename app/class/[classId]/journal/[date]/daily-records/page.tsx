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
    .order('name', { ascending: true });
  
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

// 해시태그가 포함된 텍스트를 렌더링하는 함수
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
    
    // 해시태그 추가 (클릭 가능한 스타일링)
    parts.push(
      <span 
        key={`hashtag-${match.index}`}
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
        {match[0]}
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
    title: '',
    content: '',
    actual_date: recordDate // 기본값은 현재 페이지 날짜
  });

  // 월별 접기/펼치기 상태 관리
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  // 학생 상세정보 모달 상태
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);

  // 검색 상태
  const [searchQuery, setSearchQuery] = useState('');

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

  // 월별로 그룹화된 기록들 (actual_date 기준)
  const monthlyGroupedRecords = useMemo(() => {
    if (!dailyRecords) return new Map();
    
    // 검색어가 있는 경우 필터링
    let filteredRecords = dailyRecords;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filteredRecords = dailyRecords.filter(record => 
        record.title.toLowerCase().includes(query) || 
        record.content.toLowerCase().includes(query)
      );
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
  }, [dailyRecords, searchQuery]);

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

  // 기록 추가 뮤테이션
  const addRecordMutation = useMutation({
    mutationFn: addDailyRecord,
    onSuccess: () => {
      toast.success('기록이 추가되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['daily-records'] });
      setNewRecord({ title: '', content: '', actual_date: recordDate });
      setEditingRecord(null);
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
      setNewRecord({ title: '', content: '', actual_date: recordDate });
      setEditingRecord(null);
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
        setNewRecord({ title: '', content: '', actual_date: recordDate });
        setEditingRecord(null);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // 새 기록 작성 모드로 전환
  const handleNewRecord = () => {
    setEditingRecord(null);
    setNewRecord({ title: '', content: '', actual_date: recordDate });
  };

  // 기록 수정 핸들러
  const handleEditRecord = (record: any) => {
    setEditingRecord(record);
    setNewRecord({
      title: record.title,
      content: record.content,
      actual_date: record.actual_date || record.record_date // 실제 날짜가 없으면 기록 날짜 사용
    });
  };

  // 기록 저장 핸들러
  const handleSaveRecord = () => {
    if (!newRecord.title.trim()) {
      toast.error('제목을 입력해주세요.');
      return;
    }
    if (!newRecord.content.trim()) {
      toast.error('내용을 입력해주세요.');
      return;
    }

    // 저장하기 전에 학생 이름을 해시태그로 변환
    const convertedContent = convertStudentNamesToHashtags(newRecord.content, students);

    const recordData = {
      class_id: classId,
      record_date: recordDate,
      title: newRecord.title.trim(),
      content: convertedContent,
      actual_date: newRecord.actual_date
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
    }
  };

  // 폼 취소 핸들러
  const handleCancelEdit = () => {
    setEditingRecord(null);
    setNewRecord({ title: '', content: '', actual_date: recordDate });
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
              onClick={() => router.push(`/class/${classId}/journal`)}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5" />
              <span>학급 일지로 돌아가기</span>
            </button>
            <div className="h-6 w-px bg-gray-300" />
            <h1 className="text-2xl font-bold text-gray-800 flex items-center space-x-2">
              <CalendarDaysIcon className="h-6 w-6 text-purple-600" />
              <span>오늘의 우리반</span>
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

        {/* 2-Column 레이아웃 */}
        <div className="grid grid-cols-12 gap-6">
          {/* 왼쪽: 기록 목록 */}
          <div className="col-span-5">
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">
                  {searchQuery ? `검색 결과` : '기록 목록'}
                  {dailyRecords && (
                    <span className="text-sm font-normal text-gray-500 ml-2">
                      ({searchQuery ? 
                        Array.from(monthlyGroupedRecords.values()).reduce((sum, records) => sum + records.length, 0) :
                        dailyRecords.length
                      }개)
                    </span>
                  )}
                </h3>
                <button
                  onClick={handleNewRecord}
                  className="flex items-center space-x-2 bg-purple-500 text-white px-3 py-1.5 rounded-lg hover:bg-purple-600 transition-colors text-sm"
                >
                  <PlusIcon className="h-4 w-4" />
                  <span>새 기록</span>
                </button>
              </div>
              
              <div className="space-y-3 max-h-[70vh] overflow-y-auto">
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
                              className="w-full p-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
                            >
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium text-gray-700">{monthLabel}</span>
                                <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded-full">
                                  {records.length}개
                                </span>
                              </div>
                              <motion.div
                                animate={{ rotate: isExpanded ? 180 : 0 }}
                                transition={{ duration: 0.2 }}
                              >
                                <ChevronDownIcon className="h-4 w-4 text-gray-500" />
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
                                  <div className="p-2 space-y-2 bg-white">
                                    {records.map((record: any) => {
                                      const isSelected = editingRecord?.id === record.id;

                                      return (
                                        <motion.div
                                          key={record.id}
                                          layout
                                          initial={{ opacity: 0, y: 10 }}
                                          animate={{ opacity: 1, y: 0 }}
                                          exit={{ opacity: 0, y: -10 }}
                                          className={`p-2 rounded-lg border cursor-pointer transition-all group hover:shadow-sm ${
                                            isSelected 
                                              ? 'border-purple-500 bg-purple-50 border-2' 
                                              : 'border-gray-200 hover:border-gray-300 bg-white'
                                          }`}
                                          onClick={() => handleEditRecord(record)}
                                        >
                                          <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center space-x-2 flex-1 min-w-0">
                                              <div className="w-4 h-4 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                                <CalendarDaysIcon className="h-2.5 w-2.5 text-blue-600" />
                                              </div>
                                              <div className="min-w-0 flex-1">
                                                <h4 className="text-xs font-medium text-gray-800 truncate">{record.title}</h4>
                                              </div>
                                              <div className="flex items-center space-x-1 flex-shrink-0">
                                                <span className="text-xs text-blue-600 font-medium">
                                                  {format(parseISO(record.actual_date || record.record_date), 'M/d', { locale: ko })}
                                                </span>
                                                <span className="text-xs text-gray-500">
                                                  {format(parseISO(record.created_at), 'HH:mm', { locale: ko })}
                                                </span>
                                              </div>
                                            </div>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteRecord(record.id);
                                              }}
                                              className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded transition-all ml-1"
                                            >
                                              <TrashIcon className="h-3 w-3" />
                                            </button>
                                          </div>
                                        </motion.div>
                                      );
                                    })}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })
                  ) : (
                    <div className="text-center py-8">
                      <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        {searchQuery ? (
                          <MagnifyingGlassIcon className="h-6 w-6 text-purple-600" />
                        ) : (
                          <CalendarDaysIcon className="h-6 w-6 text-purple-600" />
                        )}
                      </div>
                      {searchQuery ? (
                        <>
                          <p className="text-sm text-gray-600 mb-3">
                            "{searchQuery}"에 대한 검색 결과가 없습니다
                          </p>
                          <button
                            onClick={() => setSearchQuery('')}
                            className="text-sm text-purple-600 hover:text-purple-800 font-medium"
                          >
                            모든 기록 보기
                          </button>
                        </>
                      ) : (
                        <>
                          <p className="text-sm text-gray-600 mb-3">아직 기록이 없습니다</p>
                          <button
                            onClick={handleNewRecord}
                            className="text-sm text-purple-600 hover:text-purple-800 font-medium"
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

          {/* 오른쪽: 작성/수정 폼 */}
          <div className="col-span-7">
            <div className="bg-white rounded-xl shadow-sm p-6">
              {/* 검색창 */}
              <div className="mb-6 pb-4 border-b">
                <div className="flex items-center space-x-3">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm text-gray-900 placeholder-gray-500"
                      placeholder="제목이나 내용으로 검색..."
                    />
                  </div>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      초기화
                    </button>
                  )}
                </div>
                {searchQuery && (
                  <p className="text-xs text-gray-500 mt-2">
                    "{searchQuery}" 검색 결과가 왼쪽 목록에 표시됩니다.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-800">
                  {editingRecord ? '기록 수정' : '새 기록 작성'}
                </h3>
                {editingRecord && (
                  <button
                    onClick={handleCancelEdit}
                    className="text-sm text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    취소
                  </button>
                )}
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

                {/* 제목 입력 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">제목</label>
                  <input
                    type="text"
                    value={newRecord.title}
                    onChange={(e) => setNewRecord(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900"
                    placeholder="기록의 제목을 입력하세요"
                  />
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
                <div className="flex items-center justify-end space-x-3 pt-4 border-t">
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
        </div>
      </div>

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