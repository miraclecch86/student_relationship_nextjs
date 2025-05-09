import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { analyzeStudentRelationships } from '@/lib/openai';
import { Database } from '@/lib/database.types';

// 분석 결과 저장 API
export async function POST(
  request: NextRequest,
  { params }: { params: { classId: string } }
) {
  console.log('[POST API] 호출됨, params:', params);
  
  try {
    const { classId } = params;
    
    // Supabase 클라이언트 생성
    const cookieStore = cookies();
    console.log('[POST API] 쿠키 스토어 생성됨');
    
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });
    console.log('[POST API] Supabase 클라이언트 생성됨');

    // 인증 확인
    console.log('[POST API] 인증 세션 확인 시작');
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError) {
      console.error('[POST API] 인증 오류:', authError);
      return NextResponse.json(
        { error: '인증되지 않은 사용자입니다.' },
        { status: 401 }
      );
    }
    
    if (!session) {
      console.error('[POST API] 세션이 존재하지 않음');
      return NextResponse.json(
        { error: '인증되지 않은 사용자입니다.' },
        { status: 401 }
      );
    }
    console.log('[POST API] 인증 확인 완료, 사용자 ID:', session.user.id);

    // 학급 소유권 확인
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('user_id')
      .eq('id', classId)
      .single();

    if (classError) {
      console.error('[POST API] 학급 조회 오류:', classError);
      return NextResponse.json(
        { error: '학급을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
    if (!classData) {
      console.error('[POST API] 학급 데이터가 null임');
      return NextResponse.json(
        { error: '학급을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (classData.user_id !== session.user.id) {
      console.log('[POST API] 권한 없음. 학급 소유자:', classData.user_id, '요청자:', session.user.id);
      return NextResponse.json(
        { error: '학급에 대한 권한이 없습니다.' },
        { status: 403 }
      );
    }
    console.log('[POST API] 학급 권한 확인 완료');

    // 학생 목록 조회
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('*')
      .eq('class_id', classId);

    if (studentsError) {
      console.error('[POST API] 학생 목록 조회 오류:', studentsError);
      return NextResponse.json(
        { error: '학생 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
    if (!students || students.length === 0) {
      console.error('[POST API] 학생이 없음');
      return NextResponse.json(
        { error: '학생 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    console.log('[POST API] 학생 목록 조회 완료, 학생 수:', students.length);

    // 관계 데이터 조회
    const { data: studentIds } = await supabase
      .from('students')
      .select('id')
      .eq('class_id', classId);

    if (!studentIds || studentIds.length === 0) {
      console.error('[POST API] 학생 ID 조회 실패');
      return NextResponse.json(
        { error: '학생 ID를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const ids = studentIds.map(s => s.id);
    console.log('[POST API] 학생 ID 목록:', ids);

    const { data: relationships, error: relError } = await supabase
      .from('relations')
      .select('*')
      .in('from_student_id', ids)
      .in('to_student_id', ids)
      .is('survey_id', null);

    if (relError) {
      console.error('[POST API] 관계 데이터 조회 오류:', relError);
      return NextResponse.json(
        { error: '관계 데이터를 불러오는 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }
    console.log('[POST API] 관계 데이터 조회 완료, 관계 수:', relationships ? relationships.length : 0);

    // OpenAI API를 통해 분석 수행
    try {
      console.log('[POST API] GPT 분석 시작');
      const analysisResult = await analyzeStudentRelationships(
        students,
        relationships || []
      );
      console.log('[POST API] GPT 분석 완료');
      
      // 분석 결과 저장
      console.log('[POST API] 분석 결과 저장 시작');
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
        console.error('[POST API] 분석 결과 저장 오류:', saveError);
        return NextResponse.json(
          { error: '분석 결과 저장 중 오류가 발생했습니다.' },
          { status: 500 }
        );
      }
      
      if (!savedAnalysis) {
        console.error('[POST API] 저장된 분석이 null임');
        return NextResponse.json(
          { error: '분석 결과 저장에 실패했습니다.' },
          { status: 500 }
        );
      }

      console.log('[POST API] 분석 결과 저장 완료, ID:', savedAnalysis.id);
      return NextResponse.json(savedAnalysis);
    } catch (error: any) {
      console.error('[POST API] GPT 분석 오류:', error);
      return NextResponse.json(
        { error: `GPT 분석 중 오류가 발생했습니다: ${error.message}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('[POST API] 예외 발생:', error);
    return NextResponse.json(
      { error: `서버 오류: ${error.message}`, stack: error.stack },
      { status: 500 }
    );
  }
}

// 분석 결과 목록 조회 API
export async function GET(
  request: NextRequest,
  { params }: { params: { classId: string } }
) {
  console.log('[GET API] 호출됨, params:', params);
  
  try {
    const { classId } = params;
    
    // Supabase 클라이언트 생성
    const cookieStore = cookies();
    console.log('[GET API] 쿠키 스토어 생성됨');
    
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });
    console.log('[GET API] Supabase 클라이언트 생성됨');

    // 인증 확인
    console.log('[GET API] 인증 세션 확인 시작');
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError) {
      console.error('[GET API] 인증 오류:', authError);
      return NextResponse.json(
        { error: '인증되지 않은 사용자입니다.' },
        { status: 401 }
      );
    }
    
    if (!session) {
      console.error('[GET API] 세션이 존재하지 않음');
      return NextResponse.json(
        { error: '인증되지 않은 사용자입니다.' },
        { status: 401 }
      );
    }
    console.log('[GET API] 인증 확인 완료, 사용자 ID:', session.user.id);

    // 학급 소유권 확인
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('user_id')
      .eq('id', classId)
      .single();

    if (classError) {
      console.error('[GET API] 학급 조회 오류:', classError);
      return NextResponse.json(
        { error: '학급을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
    if (!classData) {
      console.error('[GET API] 학급 데이터가 null임');
      return NextResponse.json(
        { error: '학급을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (classData.user_id !== session.user.id) {
      console.log('[GET API] 권한 없음. 학급 소유자:', classData.user_id, '요청자:', session.user.id);
      return NextResponse.json(
        { error: '학급에 대한 권한이 없습니다.' },
        { status: 403 }
      );
    }
    console.log('[GET API] 학급 권한 확인 완료');

    // 분석 결과 목록 조회
    console.log('[GET API] 분석 결과 목록 조회 시작');
    const { data: analysisResults, error: resultsError } = await supabase
      .from('analysis_results')
      .select('*')
      .eq('class_id', classId)
      .order('created_at', { ascending: false });

    if (resultsError) {
      console.error('[GET API] 분석 결과 조회 오류:', resultsError);
      return NextResponse.json(
        { error: '분석 결과를 불러오는 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }
    console.log('[GET API] 분석 결과 조회 완료, 결과 수:', analysisResults ? analysisResults.length : 0);
    
    return NextResponse.json(analysisResults || []);
  } catch (error: any) {
    console.error('[GET API] 예외 발생:', error);
    return NextResponse.json(
      { error: `서버 오류: ${error.message}`, stack: error.stack },
      { status: 500 }
    );
  }
} 