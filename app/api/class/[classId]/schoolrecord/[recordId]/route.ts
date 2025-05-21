import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/lib/database.types';

// 특정 생활기록부 조회 API
export async function GET(
  request: NextRequest,
  context: any
) {
  console.log('[GET API] 특정 생활기록부 조회 호출됨, params:', context.params);
  
  try {
    const { classId, recordId } = context.params;
    
    // Supabase 클라이언트 생성
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });

    // 인증 확인
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      console.error('[GET API] 인증 오류:', authError);
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
      console.error('[GET API] 학급 조회 오류:', classError);
      return NextResponse.json(
        { error: '학급을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (classData.user_id !== session.user.id) {
      console.log('[GET API] 권한 없음');
      return NextResponse.json(
        { error: '학급에 대한 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 생활기록부 조회
    const { data: schoolRecord, error: recordError } = await supabase
      .from('school_records')
      .select('*')
      .eq('id', recordId)
      .eq('class_id', classId)
      .single();
      
    if (recordError) {
      console.error('[GET API] 생활기록부 조회 오류:', recordError);
      return NextResponse.json(
        { error: '생활기록부를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
    if (!schoolRecord) {
      console.error('[GET API] 생활기록부 데이터가 null임');
      return NextResponse.json(
        { error: '생활기록부를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(schoolRecord);
    
  } catch (error: any) {
    console.error('[GET API] 최상위 오류 발생:', error);
    return NextResponse.json(
      { error: `서버 오류: ${error.message}` },
      { status: 500 }
    );
  }
}

// 특정 생활기록부 삭제 API
export async function DELETE(
  request: NextRequest,
  context: any
) {
  console.log('[DELETE API] 특정 생활기록부 삭제 호출됨, params:', context.params);
  
  try {
    const { classId, recordId } = context.params;
    
    // Supabase 클라이언트 생성
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });

    // 인증 확인
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      console.error('[DELETE API] 인증 오류:', authError);
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
      console.error('[DELETE API] 학급 조회 오류:', classError);
      return NextResponse.json(
        { error: '학급을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (classData.user_id !== session.user.id) {
      console.log('[DELETE API] 권한 없음');
      return NextResponse.json(
        { error: '학급에 대한 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 생활기록부 삭제
    const { error: deleteError } = await supabase
      .from('school_records')
      .delete()
      .eq('id', recordId)
      .eq('class_id', classId);
      
    if (deleteError) {
      console.error('[DELETE API] 생활기록부 삭제 오류:', deleteError);
      return NextResponse.json(
        { error: '생활기록부 삭제 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error('[DELETE API] 최상위 오류 발생:', error);
    return NextResponse.json(
      { error: `서버 오류: ${error.message}` },
      { status: 500 }
    );
  }
}

// 특정 생활기록부 설명 수정 API
export async function PATCH(
  request: NextRequest,
  context: any
) {
  console.log('[PATCH API] 생활기록부 설명 수정 호출됨, params:', context.params);
  
  try {
    const { classId, recordId } = context.params;
    
    // 요청 본문 파싱
    const body = await request.json();
    const { summary } = body;
    
    if (!summary) {
      return NextResponse.json(
        { error: '설명 내용이 필요합니다.' },
        { status: 400 }
      );
    }
    
    // Supabase 클라이언트 생성
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });

    // 인증 확인
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      console.error('[PATCH API] 인증 오류:', authError);
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
      console.error('[PATCH API] 학급 조회 오류:', classError);
      return NextResponse.json(
        { error: '학급을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (classData.user_id !== session.user.id) {
      console.log('[PATCH API] 권한 없음');
      return NextResponse.json(
        { error: '학급에 대한 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 생활기록부 설명 업데이트
    const { data: updatedRecord, error: updateError } = await supabase
      .from('school_records')
      .update({ summary })
      .eq('id', recordId)
      .eq('class_id', classId)
      .select()
      .single();
      
    if (updateError) {
      console.error('[PATCH API] 생활기록부 설명 업데이트 오류:', updateError);
      return NextResponse.json(
        { error: '생활기록부 설명 업데이트 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(updatedRecord);
    
  } catch (error: any) {
    console.error('[PATCH API] 최상위 오류 발생:', error);
    return NextResponse.json(
      { error: `서버 오류: ${error.message}` },
      { status: 500 }
    );
  }
} 