'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { supabase, Class } from '@/lib/supabase';
import {
  ArrowLeftIcon,
  CalendarIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';

// 분석 결과 타입 정의 (단순화된 버전)
interface AnalysisResult {
  id: string;
  class_id: string;
  created_at: string;
  result_data: any; // GPT 응답 데이터를 그대로 저장
  summary: string;
}

// 학급 정보 조회 함수
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

// 특정 분석 결과 조회 함수
async function fetchAnalysisDetail(classId: string, analysisId: string): Promise<AnalysisResult> {
  try {
    console.log('분석 결과 조회 시작:', { classId, analysisId });
    
    const { data, error } = await supabase
      .from('analysis_results')
      .select('*')
      .eq('id', analysisId)
      .eq('class_id', classId)
      .single();
    
    if (error) {
      console.error('분석 결과 조회 오류:', error);
      throw new Error(`분석 결과를 불러오는데 실패했습니다: ${error.message}`);
    }
    
    if (!data) {
      console.error('분석 결과 데이터 없음');
      throw new Error('분석 결과를 찾을 수 없습니다.');
    }
    
    console.log('분석 결과 원본 데이터:', {
      id: data.id,
      created_at: data.created_at,
      result_data_type: typeof data.result_data,
      summary: data.summary,
      result_data_preview: typeof data.result_data === 'string' 
        ? data.result_data.substring(0, 100) + '...' 
        : JSON.stringify(data.result_data).substring(0, 100) + '...'
    });
    
    // result_data 처리 - 문자열이든 객체든 안전하게 처리
    let analysisContent = '';
    
    if (typeof data.result_data === 'string') {
      try {
        // JSON 문자열인 경우 파싱 시도
        const parsed = JSON.parse(data.result_data);
        if (parsed.analysis) {
          analysisContent = parsed.analysis;
        } else if (typeof parsed === 'string') {
          analysisContent = parsed;
        } else {
          // 전체 JSON을 문자열로 변환
          analysisContent = JSON.stringify(parsed, null, 2);
        }
      } catch (e) {
        // 파싱 실패 시 문자열 그대로 사용
        analysisContent = data.result_data;
      }
    } else if (typeof data.result_data === 'object' && data.result_data !== null) {
      // 객체인 경우 analysis 필드를 우선 사용하고, 없으면 전체를 문자열화
      if (data.result_data.analysis && typeof data.result_data.analysis === 'string') {
        analysisContent = data.result_data.analysis;
      } else {
        analysisContent = JSON.stringify(data.result_data, null, 2);
      }
    } else {
      analysisContent = '분석 데이터를 찾을 수 없습니다.';
    }
    
    // 결과 데이터를 분석 내용으로 대체하여 반환
    return {
      ...data,
      result_data: {
        originalData: data.result_data,
        analysisContent: analysisContent
      }
    };
  } catch (error) {
    console.error('분석 상세 정보 요청 오류:', error);
    throw error;
  }
}

export default function AnalysisDetailPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.classId as string;
  const analysisId = params.analysisId as string;
  
  // 학급 정보 조회
  const { data: classDetails } = useQuery({
    queryKey: ['classDetails', classId],
    queryFn: () => fetchClassDetails(classId),
    enabled: !!classId,
  });
  
  // 분석 결과 상세 조회
  const { 
    data: analysis,
    isLoading,
    isError,
    error
  } = useQuery({
    queryKey: ['analysisDetail', classId, analysisId],
    queryFn: () => fetchAnalysisDetail(classId, analysisId),
    enabled: !!classId && !!analysisId,
    retry: 1,
  });
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100">
        <ArrowPathIcon className="w-8 h-8 animate-spin text-indigo-500" />
        <div className="text-xl text-indigo-500 ml-3">로딩 중...</div>
      </div>
    );
  }
  
  if (isError) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gray-100">
        <div className="text-2xl text-red-500 mb-4">오류가 발생했습니다</div>
        <p className="text-gray-700 mb-4">
          {error instanceof Error ? error.message : '분석 결과를 불러올 수 없습니다.'}
        </p>
        <button
          onClick={() => router.push(`/class/${classId}/analysis`)}
          className="px-4 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600"
        >
          분석 목록으로 돌아가기
        </button>
      </div>
    );
  }
  
  if (!classDetails) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gray-100">
        <div className="text-2xl text-red-500 mb-4">학급 정보를 찾을 수 없습니다</div>
        <button
          onClick={() => router.push('/teacher')}
          className="px-4 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600"
        >
          학급 목록으로 돌아가기
        </button>
      </div>
    );
  }
  
  if (!analysis) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gray-100">
        <div className="text-2xl text-red-500 mb-4">분석 결과를 찾을 수 없습니다</div>
        <button
          onClick={() => router.push(`/class/${classId}/analysis`)}
          className="px-4 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600"
        >
          분석 목록으로 돌아가기
        </button>
      </div>
    );
  }
  
  const createdAt = new Date(analysis.created_at);
  const formattedDate = format(createdAt, 'yyyy년 MM월 dd일 HH:mm', { locale: ko });
  
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-screen-xl mx-auto px-4 py-8">
        {/* 헤더 */}
        <header className="mb-6 bg-white p-4 rounded-lg shadow-md">
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={() => router.push(`/class/${classId}/analysis`)}
              className="px-4 py-2 text-sm bg-indigo-500 text-white rounded-md hover:bg-indigo-600 shadow focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-1 transition-all duration-200 flex items-center"
            >
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              분석 목록
            </button>
            <h1 className="text-2xl font-bold text-black">{classDetails.name} 학급 분석 결과</h1>
          </div>
          <div className="flex items-center mt-3 text-gray-500">
            <CalendarIcon className="w-4 h-4 mr-2" />
            <span className="text-sm">{formattedDate}</span>
          </div>
        </header>
        
        {/* GPT 분석 결과 (단일 컨텐츠로 표시) */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 border-b pb-3 mb-4">GPT 분석 결과</h2>
          
          {/* 분석 내용 (마크다운 렌더링 적용) - 인라인 스타일 사용 */}
          <div style={{ 
            color: '#000', 
            fontSize: '15px',
            backgroundColor: '#fff',
            padding: '16px',
            borderRadius: '8px',
          }}>
            <div style={{ 
              color: '#000',
              fontSize: '15px',
              lineHeight: '1.6',
              fontWeight: '450'
            }}>
              <ReactMarkdown
                components={{
                  h1: ({ node, ...props }) => <h1 style={{ fontSize: '1.7rem', fontWeight: '800', marginTop: '1.5rem', marginBottom: '1rem', color: '#000' }} {...props} />,
                  h2: ({ node, ...props }) => <h2 style={{ fontSize: '1.4rem', fontWeight: '700', marginTop: '1.3rem', marginBottom: '0.8rem', color: '#000' }} {...props} />,
                  h3: ({ node, ...props }) => <h3 style={{ fontSize: '1.15rem', fontWeight: '600', marginTop: '1.1rem', marginBottom: '0.7rem', color: '#000' }} {...props} />,
                  p: ({ node, ...props }) => <p style={{ marginBottom: '0.8rem', lineHeight: '1.6', color: '#000', fontSize: '15px' }} {...props} />,
                  ul: ({ node, ...props }) => <ul style={{ marginLeft: '1.5rem', marginBottom: '1rem', color: '#000' }} {...props} />,
                  ol: ({ node, ...props }) => <ol style={{ marginLeft: '1.5rem', marginBottom: '1rem', color: '#000' }} {...props} />,
                  li: ({ node, ...props }) => <li style={{ marginBottom: '0.4rem', color: '#000', fontSize: '15px' }} {...props} />,
                  strong: ({ node, ...props }) => <strong style={{ fontWeight: '700', color: '#000' }} {...props} />,
                  table: ({ node, ...props }) => <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '1.2rem', marginTop: '0.8rem' }} {...props} />,
                  th: ({ node, ...props }) => <th style={{ border: '1px solid #bbb', padding: '0.7rem', backgroundColor: '#f5f5f5', fontWeight: '600', color: '#000', fontSize: '15px' }} {...props} />,
                  td: ({ node, ...props }) => <td style={{ border: '1px solid #bbb', padding: '0.7rem', color: '#000', fontSize: '15px' }} {...props} />,
                  blockquote: ({ node, ...props }) => <blockquote style={{ borderLeft: '4px solid #ddd', paddingLeft: '1rem', marginLeft: '0', marginRight: '0', fontStyle: 'italic', color: '#333' }} {...props} />
                }}
              >
                {analysis.result_data?.analysisContent || '분석 내용을 찾을 수 없습니다.'}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 