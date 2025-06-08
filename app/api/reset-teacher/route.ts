import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // 기존 사용자 세션 정보 가져오기
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Session error:', sessionError);
      return NextResponse.json(
        { error: 'Session error' },
        { status: 500 }
      );
    }
    
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    
    // 세션에서 선생님 이름과 역할 정보 제거 (재설정을 위해)
    const { error: updateError } = await supabase.auth.updateUser({
      data: { 
        teacher_name: null, 
        role: null, 
        role_verified: false 
      }
    });
    
    if (updateError) {
      console.error('Error clearing teacher info:', updateError);
      return NextResponse.json(
        { error: 'Failed to clear teacher info' },
        { status: 500 }
      );
    }
    
    // 메타데이터만 사용 (profiles 테이블 사용 안함)
    
    // 세션 갱신을 요청하여 변경사항이 즉시 반영되도록 함
    await supabase.auth.refreshSession();
    
    // 타임스탬프 추가하여 캐시 방지
    const timestamp = new Date().getTime();
    
    // 성공적으로 정보를 초기화한 후 선생님 이름 입력 페이지로 리디렉션
    return NextResponse.redirect(new URL(`/teacher-setup?reset=true&t=${timestamp}`, request.url));
    
  } catch (error) {
    console.error('Unexpected error in reset-teacher:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
