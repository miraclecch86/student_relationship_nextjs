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
    
    // 세션에서 사용자 역할 정보 제거 (데이터 필드를 null로 설정)
    const { error: updateError } = await supabase.auth.updateUser({
      data: { role: null, role_verified: false }
    });
    
    if (updateError) {
      console.error('Error clearing role data:', updateError);
      return NextResponse.json(
        { error: 'Failed to clear role data' },
        { status: 500 }
      );
    }
    
    // profiles 테이블에서도 역할 정보 초기화
    if (session.user?.id) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          role: null,
          role_verified: false 
        })
        .eq('id', session.user.id);
        
      if (profileError) {
        console.error('Error updating profile:', profileError);
      }
    }
    
    // 세션 갱신을 요청하여 변경사항이 즉시 반영되도록 함
    await supabase.auth.refreshSession();
    
    // 타임스탬프 추가하여 캐시 방지
    const timestamp = new Date().getTime();
    
    // 성공적으로 역할 정보를 초기화한 후 역할 선택 페이지로 리디렉션
    return NextResponse.redirect(new URL(`/select-role?reset=true&t=${timestamp}`, request.url));
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
