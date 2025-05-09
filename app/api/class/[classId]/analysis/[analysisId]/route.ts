import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/lib/database.types';

// 특정 분석 결과 조회 API
// @ts-ignore - Next.js 15.3.0 타입 호환성 문제 우회
export async function GET(
  request: Request,
  context: any
) {
  try {
    const { classId, analysisId } = context.params;
    const supabase = createRouteHandlerClient<Database>({ cookies });

    // 인증 확인
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json(
        { error: '인증되지 않은 사용자입니다.' },
        { status: 401 }
      );
    }

    // 분석 결과 조회
    const { data: analysis, error: analysisError } = await supabase
      .from('analysis_results')
      .select('*, classes!inner(*)')
      .eq('id', analysisId)
      .eq('class_id', classId)
      .single();

    if (analysisError || !analysis) {
      return NextResponse.json(
        { error: '분석 결과를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 학급에 대한 권한 확인
    if (analysis.classes?.user_id !== session.user.id) {
      return NextResponse.json(
        { error: '이 분석 결과에 대한 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 필요없는 classes 정보 제거
    delete analysis.classes;

    return NextResponse.json(analysis);
  } catch (error: any) {
    console.error('분석 결과 상세 조회 API 오류:', error);
    return NextResponse.json(
      { error: `서버 오류: ${error.message}` },
      { status: 500 }
    );
  }
} 