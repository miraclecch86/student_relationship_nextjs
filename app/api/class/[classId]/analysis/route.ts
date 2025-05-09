import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { analyzeStudentRelationships } from '@/lib/openai';
import { Database } from '@/lib/database.types';

// 분석 결과 저장 API
// @ts-ignore - Next.js 15.3.0 타입 호환성 문제 우회
export async function POST(
  request: NextRequest,
  context: any
) {
  try {
    const classId = context.params.classId;
    const supabase = createRouteHandlerClient<Database>({ cookies });

    // 인증 확인
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json(
        { error: '인증되지 않은 사용자입니다.' },
        { status: 401 }
      );
    }

    // 학급 소유권 확인
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('user_id')
      .eq('id', classId)
      .single();

    if (classError || !classData) {
      return NextResponse.json(
        { error: '학급을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (classData.user_id !== session.user.id) {
      return NextResponse.json(
        { error: '학급에 대한 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 학생 목록 조회
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('*')
      .eq('class_id', classId);

    if (studentsError || !students || students.length === 0) {
      return NextResponse.json(
        { error: '학생 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 관계 데이터 조회
    const { data: studentIds } = await supabase
      .from('students')
      .select('id')
      .eq('class_id', classId);

    if (!studentIds || studentIds.length === 0) {
      return NextResponse.json(
        { error: '학생 ID를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const ids = studentIds.map(s => s.id);

    const { data: relationships, error: relError } = await supabase
      .from('relations')
      .select('*')
      .in('from_student_id', ids)
      .in('to_student_id', ids)
      .is('survey_id', null);

    if (relError) {
      return NextResponse.json(
        { error: '관계 데이터를 불러오는 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    // OpenAI API를 통해 분석 수행
    try {
      const analysisResult = await analyzeStudentRelationships(
        students,
        relationships || []
      );
      
      // 분석 결과 저장
      const { data: savedAnalysis, error: saveError } = await supabase
        .from('analysis_results')
        .insert([
          {
            class_id: classId,
            result_data: analysisResult,
            summary: analysisResult.analysis.substring(0, 200) + '...',
          }
        ])
        .select()
        .single();

      if (saveError) {
        console.error('분석 결과 저장 오류:', saveError);
        return NextResponse.json(
          { error: '분석 결과 저장 중 오류가 발생했습니다.' },
          { status: 500 }
        );
      }

      return NextResponse.json(savedAnalysis);
    } catch (error: any) {
      console.error('GPT 분석 오류:', error);
      return NextResponse.json(
        { error: `GPT 분석 중 오류가 발생했습니다: ${error.message}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('분석 API 오류:', error);
    return NextResponse.json(
      { error: `서버 오류: ${error.message}` },
      { status: 500 }
    );
  }
}

// 분석 결과 목록 조회 API
// @ts-ignore - Next.js 15.3.0 타입 호환성 문제 우회
export async function GET(
  request: NextRequest,
  context: any
) {
  try {
    const classId = context.params.classId;
    const supabase = createRouteHandlerClient<Database>({ cookies });

    // 인증 확인
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json(
        { error: '인증되지 않은 사용자입니다.' },
        { status: 401 }
      );
    }

    // 학급 소유권 확인
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('user_id')
      .eq('id', classId)
      .single();

    if (classError || !classData) {
      return NextResponse.json(
        { error: '학급을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (classData.user_id !== session.user.id) {
      return NextResponse.json(
        { error: '학급에 대한 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 분석 결과 목록 조회
    const { data: analysisResults, error: resultsError } = await supabase
      .from('analysis_results')
      .select('*')
      .eq('class_id', classId)
      .order('created_at', { ascending: false });

    if (resultsError) {
      return NextResponse.json(
        { error: '분석 결과를 불러오는 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json(analysisResults || []);
  } catch (error: any) {
    console.error('분석 결과 조회 API 오류:', error);
    return NextResponse.json(
      { error: `서버 오류: ${error.message}` },
      { status: 500 }
    );
  }
} 