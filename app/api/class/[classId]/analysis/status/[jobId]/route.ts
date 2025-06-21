import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string; jobId: string }> }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { classId, jobId } = await params;

    console.log(`작업 상태 확인: ${jobId} for class ${classId}`);

    // 작업 상태 조회
    const { data: queueItem, error } = await supabase
      .from('analysis_queue')
      .select('*')
      .eq('id', jobId)
      .eq('class_id', classId)
      .single();

    if (error) {
      console.error('작업 상태 조회 오류:', error);
      return NextResponse.json({ error: '작업을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 상태에 따른 응답
    const response = {
      jobId: queueItem.id,
      status: queueItem.status,
      analysisType: queueItem.analysis_type,
      createdAt: queueItem.created_at,
      startedAt: queueItem.started_at,
      completedAt: queueItem.completed_at,
      ...(queueItem.status === 'completed' && { result: queueItem.result }),
      ...(queueItem.status === 'failed' && { error: queueItem.error_message })
    };

    console.log(`작업 상태: ${queueItem.status}`);

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('Status API 오류:', error);
    return NextResponse.json({ error: 'Status API 오류' }, { status: 500 });
  }
} 