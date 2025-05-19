import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/lib/database.types';

// 특정 분석 결과 조회 API
export async function GET(
  request: NextRequest,
  context: any
) {
  try {
    console.log('특정 분석 결과 조회 API 호출됨, context.params:', context.params);
    const { classId, analysisId } = context.params;
    
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

// 분석 결과 삭제 API
export async function DELETE(
  request: NextRequest,
  context: any
) {
  try {
    console.log('분석 결과 삭제 API 호출됨, context.params:', context.params);
    const { classId, analysisId } = context.params;
    
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
      
      try {
        // 먼저 분석 결과가 사용자의 것인지 확인
        console.log(`분석 결과 및 권한 확인: analysisId=${analysisId}`);
        const { data: analysis, error: dataError } = await supabase
          .from('analysis_results')
          .select('*, classes:class_id(user_id)')
          .eq('id', analysisId)
          .single();
          
        if (dataError) {
          console.error('분석 결과 조회 오류:', dataError);
          return NextResponse.json(
            { error: '분석 결과를 찾을 수 없습니다.' },
            { status: 404 }
          );
        }
        
        if (!analysis) {
          console.error('분석 결과가 없음');
          return NextResponse.json(
            { error: '분석 결과를 찾을 수 없습니다.' },
            { status: 404 }
          );
        }
        
        if (analysis.classes?.user_id !== session.user.id) {
          console.log('권한 없음. 학급 소유자:', analysis.classes?.user_id, '요청자:', session.user.id);
          return NextResponse.json(
            { error: '이 분석 결과를 삭제할 권한이 없습니다.' },
            { status: 403 }
          );
        }
        console.log('학급 권한 확인 완료');
        
        // 분석 결과 삭제
        console.log(`분석 결과 삭제 시작: analysisId=${analysisId}`);
        const { error: deleteError } = await supabase
          .from('analysis_results')
          .delete()
          .eq('id', analysisId);
          
        if (deleteError) {
          console.error('분석 결과 삭제 오류:', deleteError);
          return NextResponse.json(
            { error: '분석 결과 삭제 중 오류가 발생했습니다.' },
            { status: 500 }
          );
        }
        
        console.log('분석 결과 삭제 성공');
        return NextResponse.json({ success: true });
        
      } catch (queryError: any) {
        console.error('Supabase 쿼리 실행 중 예외 발생:', queryError);
        return NextResponse.json(
          { error: `분석 삭제 오류: ${queryError.message}` },
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
    console.error('분석 결과 삭제 API 오류:', error);
    return NextResponse.json(
      { error: `서버 오류: ${error.message}`, stack: error.stack },
      { status: 500 }
    );
  }
}

// 분석 결과 업데이트 API
export async function PATCH(
  request: NextRequest,
  context: any
) {
  try {
    console.log('분석 결과 업데이트 API 호출됨, context.params:', context.params);
    const { classId, analysisId } = context.params;
    
    // 요청 본문 파싱
    let updateData;
    try {
      updateData = await request.json();
      console.log('업데이트 데이터:', updateData);
    } catch (e) {
      console.error('요청 본문 파싱 오류:', e);
      return NextResponse.json(
        { error: '유효하지 않은 요청 형식입니다.' },
        { status: 400 }
      );
    }
    
    // 필수 필드 검증
    if (!updateData.summary && updateData.summary !== '') {
      console.error('필수 필드 누락: summary');
      return NextResponse.json(
        { error: '설명(summary) 필드가 필요합니다.' },
        { status: 400 }
      );
    }
    
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
      
      try {
        // 먼저 분석 결과가 사용자의 것인지 확인
        console.log(`분석 결과 및 권한 확인: analysisId=${analysisId}`);
        const { data: analysis, error: dataError } = await supabase
          .from('analysis_results')
          .select('*, classes:class_id(user_id)')
          .eq('id', analysisId)
          .single();
          
        if (dataError) {
          console.error('분석 결과 조회 오류:', dataError);
          return NextResponse.json(
            { error: '분석 결과를 찾을 수 없습니다.' },
            { status: 404 }
          );
        }
        
        if (!analysis) {
          console.error('분석 결과가 없음');
          return NextResponse.json(
            { error: '분석 결과를 찾을 수 없습니다.' },
            { status: 404 }
          );
        }
        
        if (analysis.classes?.user_id !== session.user.id) {
          console.log('권한 없음. 학급 소유자:', analysis.classes?.user_id, '요청자:', session.user.id);
          return NextResponse.json(
            { error: '이 분석 결과를 업데이트할 권한이 없습니다.' },
            { status: 403 }
          );
        }
        console.log('학급 권한 확인 완료');
        
        // 분석 결과 업데이트
        console.log(`분석 결과 업데이트 시작: analysisId=${analysisId}`);
        const { data: updatedAnalysis, error: updateError } = await supabase
          .from('analysis_results')
          .update({ summary: updateData.summary })
          .eq('id', analysisId)
          .select()
          .single();
          
        if (updateError) {
          console.error('분석 결과 업데이트 오류:', updateError);
          return NextResponse.json(
            { error: '분석 결과 업데이트 중 오류가 발생했습니다.' },
            { status: 500 }
          );
        }
        
        if (!updatedAnalysis) {
          console.error('업데이트된 분석 결과가 반환되지 않음');
          return NextResponse.json(
            { error: '분석 결과 업데이트 중 오류가 발생했습니다.' },
            { status: 500 }
          );
        }
        
        console.log('분석 결과 업데이트 성공:', updatedAnalysis.id);
        return NextResponse.json(updatedAnalysis);
        
      } catch (queryError: any) {
        console.error('Supabase 쿼리 실행 중 예외 발생:', queryError);
        return NextResponse.json(
          { error: `분석 업데이트 오류: ${queryError.message}` },
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
    console.error('분석 결과 업데이트 API 오류:', error);
    return NextResponse.json(
      { error: `서버 오류: ${error.message}`, stack: error.stack },
      { status: 500 }
    );
  }
} 