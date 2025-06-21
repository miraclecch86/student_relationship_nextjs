'use client';

import { useState, useEffect } from 'react';

interface AnalysisProgressProps {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  analysisType: 'basic' | 'overview' | 'students';
  startedAt?: string;
}

const ANALYSIS_TYPE_NAMES = {
  basic: '기본 관계 분석',
  overview: '종합 현황 분석',
  students: '학생 그룹 분석'
};

export default function AnalysisProgress({ status, analysisType, startedAt }: AnalysisProgressProps) {
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (status === 'processing' && startedAt) {
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
        setElapsedTime(elapsed);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [status, startedAt]);

  const getStatusInfo = () => {
    switch (status) {
      case 'pending':
        return {
          icon: '⏳',
          message: '분석 대기 중...',
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200'
        };
      case 'processing':
        return {
          icon: '🔄',
          message: `분석 진행 중... (${elapsedTime}초 경과)`,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200'
        };
      case 'completed':
        return {
          icon: '✅',
          message: '분석 완료!',
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200'
        };
      case 'failed':
        return {
          icon: '❌',
          message: '분석 실패',
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200'
        };
      default:
        return {
          icon: '❓',
          message: '알 수 없는 상태',
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200'
        };
    }
  };

  const statusInfo = getStatusInfo();
  const analysisName = ANALYSIS_TYPE_NAMES[analysisType];

  return (
    <div className={`p-4 rounded-lg border-2 ${statusInfo.bgColor} ${statusInfo.borderColor}`}>
      <div className="flex items-center space-x-3">
        <div className="text-2xl">
          {status === 'processing' ? (
            <div className="animate-spin text-2xl">{statusInfo.icon}</div>
          ) : (
            statusInfo.icon
          )}
        </div>
        <div className="flex-1">
          <h3 className={`font-semibold ${statusInfo.color}`}>
            {analysisName}
          </h3>
          <p className={`text-sm ${statusInfo.color}`}>
            {statusInfo.message}
          </p>
        </div>
      </div>
      
      {status === 'processing' && (
        <div className="mt-3">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full animate-pulse"
              style={{ width: '100%' }}
            />
          </div>
          <p className="text-xs text-blue-600 mt-1">
            AI가 데이터를 분석하고 있습니다...
          </p>
        </div>
      )}

      {status === 'failed' && (
        <div className="mt-3">
          <p className="text-xs text-red-600">
            분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
          </p>
        </div>
      )}

      {status === 'pending' && (
        <div className="mt-3">
          <p className="text-xs text-yellow-600">
            분석 작업이 대기열에 추가되었습니다.
          </p>
        </div>
      )}
    </div>
  );
}

// 여러 분석 작업을 관리하는 컴포넌트
interface MultiAnalysisProgressProps {
  jobs: Array<{
    jobId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    analysisType: 'basic' | 'overview' | 'students';
    startedAt?: string;
  }>;
}

export function MultiAnalysisProgress({ jobs }: MultiAnalysisProgressProps) {
  if (jobs.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-gray-800">
        🔍 분석 진행 상황
      </h2>
      {jobs.map((job) => (
        <AnalysisProgress
          key={job.jobId}
          status={job.status}
          analysisType={job.analysisType}
          startedAt={job.startedAt}
        />
      ))}
    </div>
  );
} 