import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/lib/database.types';

// 특정 분석 결과 조회 API
export async function GET(
  request: NextRequest,
  { params }: { params: { classId: string; analysisId: string } }
) {
  try {
    console.log('특정 분석 결과 조회 API 호출됨, params:', params);
    const { classId, analysisId } = params;
    
    // Supabase 클라이언트 생성
    const cookieStore = cookies();
    console.log('쿠키 스토어 생성됨');
    
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });
    console.log('Supabase 클라이언트 생성됨');

    // 인증 확인
    console.log('인증 세션 확인 시작');
    try {
      const sessionResult = await supabase.auth.getSession();
      console.log('세션 조회 결과:', {
        hasError: !!sessionResult.error,
        hasSession: !!sessionResult.data.session
      });
      
      const { data: { session }, error: authError } = sessionResult;
      
      if (authError) {
        console.error('인증 오류 발생:', authError);
        return NextResponse.json(
          { error: '인증되지 않은 사용자입니다.' },
          { status: 401 }
        );
      }
      
      if (!session) {
        console.error('세션이 존재하지 않음');
        return NextResponse.json(
          { error: '인증되지 않은 사용자입니다.' },
          { status: 401 }
        );
      }
      console.log('인증 확인 완료, 사용자 ID:', session.user.id);
      
      // 분석 결과 조회
      console.log(`분석 결과 조회 시작: classId=${classId}, analysisId=${analysisId}`);
      try {
        const queryString = `*, classes!inner(*)`;
        console.log(`실행할 쿼리: .from('analysis_results').select('${queryString}').eq('id', '${analysisId}').eq('class_id', '${classId}').single()`);
        
        const queryResult = await supabase
          .from('analysis_results')
          .select(queryString)
          .eq('id', analysisId)
          .eq('class_id', classId)
          .single();
        
        console.log('쿼리 실행 결과:', {
          status: queryResult.status,
          statusText: queryResult.statusText,
          hasError: !!queryResult.error,
          errorMessage: queryResult.error?.message,
          errorCode: queryResult.error?.code,
          hasData: !!queryResult.data
        });
        
        const { data: analysis, error: analysisError } = queryResult;

        if (analysisError) {
          console.error('분석 결과 조회 오류:', {
            message: analysisError.message,
            code: analysisError.code,
            details: analysisError.details
          });
          return NextResponse.json(
            { error: `분석 결과를 찾을 수 없습니다: ${analysisError.message}` },
            { status: 404 }
          );
        }
        
        if (!analysis) {
          console.error('분석 결과가 null임');
          return NextResponse.json(
            { error: '분석 결과를 찾을 수 없습니다.' },
            { status: 404 }
          );
        }
        console.log('분석 결과 조회 완료');

        // 학급에 대한 권한 확인
        console.log('학급 권한 확인 중');
        if (!analysis.classes) {
          console.error('분석에 연결된 classes 정보가 없음');
          return NextResponse.json(
            { error: '학급 정보를 찾을 수 없습니다.' },
            { status: 404 }
          );
        }
        
        if (analysis.classes?.user_id !== session.user.id) {
          console.log('권한 없음. 학급 소유자:', analysis.classes?.user_id, '요청자:', session.user.id);
          return NextResponse.json(
            { error: '이 분석 결과에 대한 권한이 없습니다.' },
            { status: 403 }
          );
        }
        console.log('학급 권한 확인 완료');

        // 필요없는 classes 정보 제거
        delete analysis.classes;
        console.log('분석 결과 리턴 전 최종 데이터:', { id: analysis.id, class_id: analysis.class_id });

        return NextResponse.json(analysis);
      } catch (queryError: any) {
        console.error('Supabase 쿼리 실행 중 예외 발생:', queryError);
        return NextResponse.json(
          { error: `분석 조회 오류: ${queryError.message}` },
          { status: 500 }
        );
      }
    } catch (sessionError: any) {
      console.error('세션 조회 중 예외 발생:', sessionError);
      return NextResponse.json(
        { error: `인증 오류: ${sessionError.message}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('분석 결과 상세 조회 API 오류:', error);
    return NextResponse.json(
      { error: `서버 오류: ${error.message}`, stack: error.stack },
      { status: 500 }
    );
  }
} 