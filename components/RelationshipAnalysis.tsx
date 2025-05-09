'use client';

import React, { useState } from 'react';
import { Student, Question, Answer, Relationship } from '@/lib/supabase';
import { analyzeStudentRelationships } from '@/lib/openai';
import { ArrowPathIcon, LightBulbIcon, ExclamationCircleIcon, SparklesIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { RELATIONSHIP_TYPES } from '@/lib/constants';

// app/class/[classId]/page.tsx에서 사용하는 LinkData 타입 정의
interface LinkData {
  source: string; // from_student_id
  target: string; // to_student_id
  type: keyof typeof RELATIONSHIP_TYPES;
}

// RELATIONSHIP_TYPES 키를 relation_type으로 매핑하는 함수
const mapRelationTypeToDb = (type: keyof typeof RELATIONSHIP_TYPES): '친한' | '보통' | '안친한' => {
  const mapping: Record<keyof typeof RELATIONSHIP_TYPES, '친한' | '보통' | '안친한'> = {
    FRIENDLY: '친한',
    WANNA_BE_CLOSE: '친한', // 두 타입 모두 '친한'으로 매핑
    NEUTRAL: '보통',
    AWKWARD: '안친한'
  };
  return mapping[type];
};

interface RelationshipAnalysisProps {
  classId: string;
  students: Student[];
  relationships: LinkData[]; // Relationship 대신 LinkData 타입 사용
  questions?: Question[];
  answers?: Answer[];
}

export default function RelationshipAnalysis({ 
  classId, 
  students, 
  relationships,
  questions,
  answers
}: RelationshipAnalysisProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    analysis: string;
    relationships: {
      description: string;
      issues?: string[];
      recommendations?: string[];
    };
    socialDynamics: {
      description: string;
      strongConnections?: string[];
      isolatedStudents?: string[];
    };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyzeClick = async () => {
    setIsAnalyzing(true);
    setError(null);
    
    try {
      // API 키가 있는지 확인
      const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OpenAI API 키가 설정되지 않았습니다. 환경 변수를 확인해주세요.');
      }
      
      // 분석에 필요한 데이터가 있는지 확인
      if (students.length === 0) {
        throw new Error('분석할 학생 데이터가 없습니다.');
      }
      
      if (relationships.length === 0) {
        throw new Error('분석할 관계 데이터가 없습니다.');
      }
      
      // LinkData를 Relationship 형식으로 변환 (관계 타입 매핑 추가)
      const formattedRelationships: Relationship[] = relationships.map(r => ({
        id: `${r.source}-${r.target}`,
        from_student_id: r.source,
        to_student_id: r.target,
        relation_type: mapRelationTypeToDb(r.type),
        created_at: new Date().toISOString()
      }));
      
      // OpenAI API를 사용하여 학생 관계 분석
      const result = await analyzeStudentRelationships(
        students, 
        formattedRelationships,
        answers,
        questions
      );
      
      setAnalysisResult(result);
      toast.success('관계 분석이 완료되었습니다.');
    } catch (err) {
      console.error('분석 오류:', err);
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
      toast.error('분석 중 오류가 발생했습니다.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-800 flex items-center">
          <SparklesIcon className="w-6 h-6 text-blue-500 mr-2" />
          학생 관계 AI 분석
        </h2>
        <button
          onClick={handleAnalyzeClick}
          disabled={isAnalyzing}
          className={`px-4 py-2 rounded-md text-white font-medium flex items-center ${
            isAnalyzing ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
          } transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-70`}
        >
          {isAnalyzing ? (
            <>
              <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" />
              분석 중...
            </>
          ) : (
            <>
              <LightBulbIcon className="w-5 h-5 mr-2" />
              관계 분석하기
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 border border-red-200 rounded-md bg-red-50 text-red-700 flex items-start">
          <ExclamationCircleIcon className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {!analysisResult && !error && !isAnalyzing && (
        <div className="text-center py-8 text-gray-500 border border-gray-200 rounded-md bg-gray-50">
          <SparklesIcon className="w-12 h-12 mx-auto mb-3 text-blue-300" />
          <p className="mb-2">AI를 활용하여 학생들의 관계를 분석해보세요.</p>
          <p className="text-sm">학급 내 관계 패턴, 사회적 역학 구조 및 개선 방안을 제안받을 수 있습니다.</p>
        </div>
      )}

      {isAnalyzing && (
        <div className="flex flex-col items-center justify-center py-10 border border-blue-100 rounded-md bg-blue-50">
          <ArrowPathIcon className="w-12 h-12 text-blue-500 animate-spin mb-4" />
          <p className="text-blue-800 font-medium mb-1">AI가 학생 관계를 분석하고 있습니다</p>
          <p className="text-sm text-blue-600">학생 데이터와 관계 정보를 바탕으로 상세한 분석을 진행 중입니다. 잠시만 기다려주세요.</p>
        </div>
      )}

      {analysisResult && (
        <div className="space-y-6">
          {/* 전체 분석 요약 */}
          <div className="border border-blue-100 rounded-lg p-4 bg-blue-50">
            <h3 className="text-lg font-semibold text-blue-800 mb-2">전체 분석 요약</h3>
            <p className="text-gray-700 whitespace-pre-line">{analysisResult.analysis}</p>
          </div>

          {/* 관계 분석 */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">관계 분석</h3>
            <p className="text-gray-700 mb-4">{analysisResult.relationships.description}</p>
            
            {analysisResult.relationships.issues && analysisResult.relationships.issues.length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium text-gray-700 mb-2">주요 이슈</h4>
                <ul className="list-disc pl-5 space-y-1">
                  {analysisResult.relationships.issues.map((issue, index) => (
                    <li key={index} className="text-gray-600">{issue}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {analysisResult.relationships.recommendations && analysisResult.relationships.recommendations.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-700 mb-2">권장 사항</h4>
                <ul className="list-disc pl-5 space-y-1">
                  {analysisResult.relationships.recommendations.map((rec, index) => (
                    <li key={index} className="text-gray-600">{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* 사회적 역학 */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">사회적 역학</h3>
            <p className="text-gray-700 mb-4">{analysisResult.socialDynamics.description}</p>
            
            {analysisResult.socialDynamics.strongConnections && analysisResult.socialDynamics.strongConnections.length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium text-gray-700 mb-2">강한 유대 관계</h4>
                <ul className="list-disc pl-5 space-y-1">
                  {analysisResult.socialDynamics.strongConnections.map((connection, index) => (
                    <li key={index} className="text-gray-600">{connection}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {analysisResult.socialDynamics.isolatedStudents && analysisResult.socialDynamics.isolatedStudents.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-700 mb-2">고립된 학생</h4>
                <ul className="list-disc pl-5 space-y-1">
                  {analysisResult.socialDynamics.isolatedStudents.map((student, index) => (
                    <li key={index} className="text-gray-600">{student}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 