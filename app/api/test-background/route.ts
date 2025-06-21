import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const body = await request.json();
    const { delay = 5000, shouldFail = false } = body; // 지연시간과 실패 여부

    console.log(`🧪 테스트 백그라운드 작업 시작 (지연: ${delay}ms, 실패: ${shouldFail})`);

    // 큐에 테스트 작업 추가
    const { data: queueItem, error: queueError } = await supabase
      .from('analysis_queue')
      .insert({
        class_id: '00000000-0000-0000-0000-000000000000', // 테스트용 더미 ID
        analysis_type: 'test',
        request_data: { delay, shouldFail },
        status: 'pending'
      })
      .select('id')
      .single();

    if (queueError) {
      console.error('테스트 큐 추가 오류:', queueError);
      return NextResponse.json({ error: '큐 추가 실패' }, { status: 500 });
    }

    const jobId = queueItem.id;

    // 백그라운드에서 테스트 작업 실행
    processTestJobInBackground(jobId, delay, shouldFail);

    return NextResponse.json({ 
      jobId,
      status: 'started',
      message: `테스트 작업이 시작되었습니다. ${delay}ms 후 완료 예정`
    });

  } catch (error: any) {
    console.error('테스트 API 오류:', error);
    return NextResponse.json({ error: '테스트 API 오류' }, { status: 500 });
  }
}

// 테스트 작업 백그라운드 처리
async function processTestJobInBackground(jobId: string, delay: number, shouldFail: boolean) {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    console.log(`🧪 테스트 작업 시작: ${jobId}`);

    // 작업 상태를 'processing'으로 업데이트
    await supabase
      .from('analysis_queue')
      .update({ 
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .eq('id', jobId);

    // 의도적 지연
    console.log(`🧪 ${delay}ms 대기 중...`);
    await new Promise(resolve => setTimeout(resolve, delay));

    // 실패 테스트
    if (shouldFail) {
      throw new Error('의도적 실패 테스트');
    }

    const testResult = {
      message: '테스트 완료!',
      timestamp: new Date().toISOString(),
      delay: delay,
      randomNumber: Math.random()
    };

    console.log(`🧪 테스트 작업 완료: ${jobId}`);

    // 결과 저장
    await supabase
      .from('analysis_queue')
      .update({
        status: 'completed',
        result: testResult,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);

  } catch (error: any) {
    console.error(`🧪 테스트 작업 오류 (${jobId}):`, error);

    // 오류 상태 저장
    await supabase
      .from('analysis_queue')
      .update({
        status: 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);
  }
}

// GET으로 테스트 작업 상태 확인
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const url = new URL(request.url);
    const jobId = url.searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json({ 
        message: '테스트 사용법',
        examples: {
          'POST /api/test-background': '{ "delay": 5000, "shouldFail": false }',
          'GET /api/test-background?jobId=xxx': '작업 상태 확인'
        }
      });
    }

    const { data: queueItem, error } = await supabase
      .from('analysis_queue')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      return NextResponse.json({ error: '작업을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({
      jobId: queueItem.id,
      status: queueItem.status,
      analysisType: queueItem.analysis_type,
      createdAt: queueItem.created_at,
      startedAt: queueItem.started_at,
      completedAt: queueItem.completed_at,
      ...(queueItem.status === 'completed' && { result: queueItem.result }),
      ...(queueItem.status === 'failed' && { error: queueItem.error_message })
    });

  } catch (error: any) {
    console.error('테스트 상태 API 오류:', error);
    return NextResponse.json({ error: '테스트 상태 API 오류' }, { status: 500 });
  }
} 