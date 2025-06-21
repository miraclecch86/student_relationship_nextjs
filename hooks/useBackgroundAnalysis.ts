import { useState, useCallback, useRef } from 'react';

type AnalysisType = 'basic' | 'overview' | 'students';

interface AnalysisJob {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  analysisType: AnalysisType;
  result?: any;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

interface UseBackgroundAnalysisProps {
  classId: string;
}

interface UseBackgroundAnalysisReturn {
  startAnalysis: (analysisType: AnalysisType, requestData?: any) => Promise<string>;
  getAnalysisStatus: (jobId: string) => Promise<AnalysisJob>;
  startPolling: (jobId: string, onComplete: (result: any) => void, onError: (error: string) => void) => void;
  stopPolling: (jobId: string) => void;
  isPolling: (jobId: string) => boolean;
}

export function useBackgroundAnalysis({ classId }: UseBackgroundAnalysisProps): UseBackgroundAnalysisReturn {
  const [pollingIntervals, setPollingIntervals] = useState<Map<string, NodeJS.Timeout>>(new Map());

  // 분석 작업 시작
  const startAnalysis = useCallback(async (analysisType: AnalysisType, requestData: any = {}): Promise<string> => {
    console.log(`백그라운드 분석 시작: ${analysisType}`);

    const response = await fetch(`/api/class/${classId}/analysis/queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        analysisType,
        ...requestData
      }),
    });

    if (!response.ok) {
      throw new Error('분석 작업 시작 실패');
    }

    const data = await response.json();
    console.log(`분석 작업 시작됨: ${data.jobId}`);
    
    return data.jobId;
  }, [classId]);

  // 분석 상태 확인
  const getAnalysisStatus = useCallback(async (jobId: string): Promise<AnalysisJob> => {
    const response = await fetch(`/api/class/${classId}/analysis/status/${jobId}`);

    if (!response.ok) {
      throw new Error('분석 상태 확인 실패');
    }

    return await response.json();
  }, [classId]);

  // 폴링 시작
  const startPolling = useCallback((
    jobId: string, 
    onComplete: (result: any) => void, 
    onError: (error: string) => void
  ) => {
    console.log(`폴링 시작: ${jobId}`);

    // 기존 폴링이 있다면 중지
    stopPolling(jobId);

    const interval = setInterval(async () => {
      try {
        const status = await getAnalysisStatus(jobId);
        
        console.log(`폴링 상태 확인: ${jobId} - ${status.status}`);

        if (status.status === 'completed') {
          console.log(`분석 완료: ${jobId}`);
          stopPolling(jobId);
          onComplete(status.result);
        } else if (status.status === 'failed') {
          console.error(`분석 실패: ${jobId} - ${status.error}`);
          stopPolling(jobId);
          onError(status.error || '분석 중 오류가 발생했습니다.');
        }
        // pending이나 processing 상태면 계속 폴링
      } catch (error: any) {
        console.error(`폴링 오류: ${jobId}`, error);
        stopPolling(jobId);
        onError('분석 상태 확인 중 오류가 발생했습니다.');
      }
    }, 2000); // 2초마다 확인

    setPollingIntervals(prev => new Map(prev.set(jobId, interval)));
  }, [getAnalysisStatus]);

  // 폴링 중지
  const stopPolling = useCallback((jobId: string) => {
    const interval = pollingIntervals.get(jobId);
    if (interval) {
      console.log(`폴링 중지: ${jobId}`);
      clearInterval(interval);
      setPollingIntervals(prev => {
        const newMap = new Map(prev);
        newMap.delete(jobId);
        return newMap;
      });
    }
  }, [pollingIntervals]);

  // 폴링 중인지 확인
  const isPolling = useCallback((jobId: string): boolean => {
    return pollingIntervals.has(jobId);
  }, [pollingIntervals]);

  return {
    startAnalysis,
    getAnalysisStatus,
    startPolling,
    stopPolling,
    isPolling
  };
}

// 편의 함수들
export function useBasicAnalysis(classId: string) {
  const { startAnalysis, startPolling, stopPolling } = useBackgroundAnalysis({ classId });

  const runBasicAnalysis = useCallback(async (
    onComplete: (result: any) => void,
    onError: (error: string) => void
  ) => {
    try {
      const jobId = await startAnalysis('basic');
      startPolling(jobId, onComplete, onError);
      return jobId;
    } catch (error: any) {
      onError(error.message);
    }
  }, [startAnalysis, startPolling]);

  return { runBasicAnalysis, stopPolling };
}

export function useOverviewAnalysis(classId: string) {
  const { startAnalysis, startPolling, stopPolling } = useBackgroundAnalysis({ classId });

  const runOverviewAnalysis = useCallback(async (
    onComplete: (result: any) => void,
    onError: (error: string) => void
  ) => {
    try {
      const jobId = await startAnalysis('overview');
      startPolling(jobId, onComplete, onError);
      return jobId;
    } catch (error: any) {
      onError(error.message);
    }
  }, [startAnalysis, startPolling]);

  return { runOverviewAnalysis, stopPolling };
}

export function useStudentGroupAnalysis(classId: string) {
  const { startAnalysis, startPolling, stopPolling } = useBackgroundAnalysis({ classId });

  const runStudentGroupAnalysis = useCallback(async (
    studentIds: string[],
    onComplete: (result: any) => void,
    onError: (error: string) => void
  ) => {
    try {
      const jobId = await startAnalysis('students', { studentIds });
      startPolling(jobId, onComplete, onError);
      return jobId;
    } catch (error: any) {
      onError(error.message);
    }
  }, [startAnalysis, startPolling]);

  return { runStudentGroupAnalysis, stopPolling };
} 