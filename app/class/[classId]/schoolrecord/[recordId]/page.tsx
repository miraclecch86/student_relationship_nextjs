'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { supabase, Class, Student } from '@/lib/supabase';
import {
  ArrowLeftIcon,
  DocumentTextIcon,
  CalendarIcon,
  UserIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClipboardIcon,
  ClipboardDocumentCheckIcon
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import toast from 'react-hot-toast';

// 생활기록부 결과 타입 정의
interface SchoolRecord {
  id: string;
  class_id: string;
  created_at: string;
  result_data: string; // 마크다운 문자열
  summary: string;
}

// 학급 정보 조회 함수
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

// 학생 목록 조회 함수
async function fetchStudents(classId: string): Promise<Student[]> {
  const { data, error } = await (supabase as any)
    .from('students')
    .select('*')
    .eq('class_id', classId)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });
  
  if (error) {
    console.error('Error fetching students:', error);
    return [];
  }
  
  return data;
}

// 생활기록부 조회 함수
async function fetchSchoolRecord(recordId: string): Promise<SchoolRecord | null> {
  const { data, error } = await (supabase as any)
    .from('school_records')
    .select('*')
    .eq('id', recordId)
    .single();
  
  if (error) {
    console.error('Error fetching school record:', error);
    return null;
  }
  
  return data;
}

export default function SchoolRecordDetailPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.classId as string;
  const recordId = params.recordId as string;
  
  // 학생별 표시 상태 관리
  const [expandedStudents, setExpandedStudents] = useState<{[key: string]: boolean}>({});
  
  // 복사된 학생 상태 관리
  const [copiedStudent, setCopiedStudent] = useState<string | null>(null);
  
  // 학급 정보 조회
  const { data: classDetails, isLoading: isClassLoading } = useQuery({
    queryKey: ['classDetails', classId],
    queryFn: () => fetchClassDetails(classId),
    enabled: !!classId,
  });
  
  // 학생 목록 조회
  const { data: students = [] } = useQuery({
    queryKey: ['students', classId],
    queryFn: () => fetchStudents(classId),
    enabled: !!classId,
  });
  
  // 생활기록부 조회
  const { data: schoolRecord, isLoading: isRecordLoading } = useQuery({
    queryKey: ['schoolRecord', recordId],
    queryFn: () => fetchSchoolRecord(recordId),
    enabled: !!recordId,
  });
  
  // 생활기록부 내용 구문 분석 함수
  const parseSchoolRecord = (content: string) => {
    try {
      // 마크다운 형식으로 직접 사용
      return content;
    } catch (error) {
      console.error('생활기록부 내용 구문 분석 오류:', error);
      return '생활기록부 내용을 불러오는 중 오류가 발생했습니다.';
    }
  };
  
  // 학생별 생활기록부 문구만 추출하는 함수
  const extractStudentRecords = (content: string) => {
    const studentRecords: {[key: string]: string} = {};
    
    try {
      const studentSections = content.split(/^## (.+?)$/gm);
      
      // 첫 번째 요소는 헤더이므로 건너뜀
      for (let i = 1; i < studentSections.length; i += 2) {
        const studentName = studentSections[i].trim();
        const studentContent = studentSections[i + 1]?.trim() || '';
        
        if (studentName && studentContent) {
          studentRecords[studentName] = studentContent;
        }
      }
    } catch (error) {
      console.error('학생별 생활기록부 문구 추출 오류:', error);
    }
    
    return studentRecords;
  };
  
  // 학생 표시 상태 토글 함수
  const toggleStudent = (studentName: string) => {
    setExpandedStudents(prev => ({
      ...prev,
      [studentName]: !prev[studentName]
    }));
  };
  
  // 모든 학생 표시 상태 토글 함수
  const toggleAllStudents = (expand: boolean) => {
    const studentNames = Object.keys(extractStudentRecords(schoolRecord?.result_data || ''));
    const newState = studentNames.reduce((acc, name) => {
      acc[name] = expand;
      return acc;
    }, {} as {[key: string]: boolean});
    
    setExpandedStudents(newState);
  };
  
  // 학생별 문구 복사 함수
  const copyStudentRecord = (studentName: string, content: string) => {
    navigator.clipboard.writeText(content)
      .then(() => {
        setCopiedStudent(studentName);
        toast.success(`${studentName}의 생활기록부 문구가 복사되었습니다.`);
        // 2초 후 복사 상태 초기화
        setTimeout(() => setCopiedStudent(null), 2000);
      })
      .catch((error) => {
        console.error('클립보드 복사 오류:', error);
        toast.error('복사에 실패했습니다.');
      });
  };
  
  // 전체 생활기록부 복사 함수
  const copyAllRecords = () => {
    if (!schoolRecord) return;
    
    navigator.clipboard.writeText(schoolRecord.result_data)
      .then(() => {
        toast.success('전체 생활기록부 내용이 복사되었습니다.');
      })
      .catch((error) => {
        console.error('클립보드 복사 오류:', error);
        toast.error('복사에 실패했습니다.');
      });
  };
  
  if (isClassLoading || isRecordLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100">
        <div className="text-2xl text-amber-500">로딩 중...</div>
      </div>
    );
  }

  if (!schoolRecord) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gray-100">
        <div className="text-2xl text-red-500 mb-4">생활기록부를 찾을 수 없습니다</div>
        <button
          onClick={() => router.push(`/class/${classId}/schoolrecord`)}
          className="px-4 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600"
        >
          생활기록부 목록으로 돌아가기
        </button>
      </div>
    );
  }

  // 생활기록부 내용에서 학생별 문구 추출
  const studentRecords = extractStudentRecords(schoolRecord.result_data);
  const studentNames = Object.keys(studentRecords);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* 헤더 */}
        <header className="mb-8 bg-white p-4 rounded-lg shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push(`/class/${classId}/schoolrecord`)}
                className="px-4 py-2 text-sm bg-amber-500 text-white rounded-md hover:bg-amber-600 shadow focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-1 transition-all duration-200 flex items-center"
              >
                <ArrowLeftIcon className="w-4 h-4 mr-2" />
                목록으로
              </button>
              <h1 className="text-2xl font-bold text-gray-900">{classDetails?.name} 생활기록부</h1>
            </div>
            
            <div className="flex items-center text-sm text-gray-500">
              <CalendarIcon className="w-4 h-4 mr-1" />
              {format(new Date(schoolRecord.created_at), 'yyyy년 MM월 dd일 HH:mm', { locale: ko })}
            </div>
          </div>
          
          <p className="text-gray-600">{schoolRecord.summary || '학생별 생활기록부 문구입니다.'}</p>
          
          <div className="mt-4 flex justify-end space-x-2">
            <button
              onClick={copyAllRecords}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 flex items-center"
            >
              <ClipboardIcon className="w-4 h-4 mr-1" />
              전체 복사
            </button>
            <button
              onClick={() => toggleAllStudents(true)}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 flex items-center"
            >
              <ChevronDownIcon className="w-4 h-4 mr-1" />
              모두 펼치기
            </button>
            <button
              onClick={() => toggleAllStudents(false)}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 flex items-center"
            >
              <ChevronUpIcon className="w-4 h-4 mr-1" />
              모두 접기
            </button>
          </div>
        </header>

        {/* 생활기록부 내용 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">학생별 생활기록부 문구</h2>
          
          {studentNames.length > 0 ? (
            <div className="space-y-4">
              {studentNames.map((studentName) => (
                <div key={studentName} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div 
                    className="flex items-center justify-between p-4 bg-amber-50 cursor-pointer"
                    onClick={() => toggleStudent(studentName)}
                  >
                    <div className="flex items-center">
                      <UserIcon className="w-5 h-5 text-amber-500 mr-2" />
                      <span className="font-medium text-gray-800">{studentName}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // 토글 이벤트 전파 방지
                          copyStudentRecord(studentName, studentRecords[studentName]);
                        }}
                        className="p-1.5 rounded-full bg-gray-50 hover:bg-amber-100 text-gray-500 hover:text-amber-600 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-300"
                        title={`${studentName} 문구 복사`}
                      >
                        {copiedStudent === studentName ? (
                          <ClipboardDocumentCheckIcon className="w-4 h-4" />
                        ) : (
                          <ClipboardIcon className="w-4 h-4" />
                        )}
                      </button>
                      {expandedStudents[studentName] ? (
                        <ChevronUpIcon className="w-5 h-5 text-gray-500" />
                      ) : (
                        <ChevronDownIcon className="w-5 h-5 text-gray-500" />
                      )}
                    </div>
                  </div>
                  
                  {expandedStudents[studentName] && (
                    <div className="p-4 bg-white">
                      <div className="prose max-w-none">
                        <div className="flex justify-end mb-2">
                          <button
                            onClick={() => copyStudentRecord(studentName, studentRecords[studentName])}
                            className="px-3 py-1 text-xs bg-amber-50 text-amber-600 rounded hover:bg-amber-100 flex items-center"
                          >
                            {copiedStudent === studentName ? (
                              <>
                                <ClipboardDocumentCheckIcon className="w-3 h-3 mr-1" />
                                복사됨
                              </>
                            ) : (
                              <>
                                <ClipboardIcon className="w-3 h-3 mr-1" />
                                문구 복사
                              </>
                            )}
                          </button>
                        </div>
                        <ReactMarkdown
                          rehypePlugins={[rehypeRaw]}
                          components={{
                            h1: ({node, ...props}) => <h1 className="text-2xl font-bold mb-4 text-gray-900" {...props} />,
                            h2: ({node, ...props}) => <h2 className="text-xl font-bold mb-3 text-gray-800" {...props} />,
                            h3: ({node, ...props}) => <h3 className="text-lg font-bold mb-2 text-gray-800" {...props} />,
                            h4: ({node, ...props}) => <h4 className="text-base font-bold mb-2 text-gray-800" {...props} />,
                            h5: ({node, ...props}) => <h5 className="text-sm font-bold mb-1 text-gray-800" {...props} />,
                            p: ({node, ...props}) => <p className="mb-4 text-gray-700" {...props} />,
                            ul: ({node, ...props}) => <ul className="list-disc ml-5 mb-4 text-gray-700" {...props} />,
                            ol: ({node, ...props}) => <ol className="list-decimal ml-5 mb-4 text-gray-700" {...props} />,
                            li: ({node, ...props}) => <li className="mb-1" {...props} />,
                            a: ({node, ...props}) => <a className="text-amber-600 hover:underline" {...props} />,
                            blockquote: ({node, ...props}) => <blockquote className="pl-4 border-l-4 border-gray-300 italic text-gray-700 mb-4" {...props} />,
                            hr: ({node, ...props}) => <hr className="my-6 border-gray-300" {...props} />,
                            code: ({node, ...props}) => <code className="bg-gray-100 px-1 rounded text-red-600" {...props} />,
                            pre: ({node, ...props}) => <pre className="bg-gray-100 p-4 rounded overflow-x-auto mb-4" {...props} />,
                            table: ({node, ...props}) => <div className="overflow-x-auto mb-4"><table className="min-w-full text-gray-700" {...props} /></div>,
                            th: ({node, ...props}) => <th className="bg-gray-100 py-2 px-3 font-bold text-left" {...props} />,
                            td: ({node, ...props}) => <td className="border-t border-gray-200 py-2 px-3" {...props} />,
                          }}
                        >
                          {studentRecords[studentName]}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-50 p-6 rounded-lg text-center">
              <DocumentTextIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">학생별 생활기록부 문구가 없습니다. 비정상적인 결과이므로 다시 생성해보세요.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 