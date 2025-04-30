import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  const { pathname } = req.nextUrl;

  console.log('[Middleware FINAL] Checking path:', pathname);

  // getUser 대신 getSession을 먼저 사용 (더 안정적일 수 있음)
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  console.log('[Middleware FINAL] Session exists:', !!session);

  // 로그인, 인증 콜백, 역할 선택 경로는 일단 허용 (나중에 로그인 상태면 리디렉션)
  if (pathname.startsWith('/login') || pathname.startsWith('/auth') || pathname === '/select-role') {
    // 만약 유저가 있고 역할도 있는데 이 페이지들에 접근 시도하면 리디렉션
    if (session && session.user?.user_metadata?.role) {
       const userRole = session.user.user_metadata.role;
       if (pathname.startsWith('/login') || pathname === '/select-role') {
          console.log('[Middleware FINAL] Already logged in with role, redirecting from:', pathname);
          return NextResponse.redirect(new URL(userRole === 'teacher' ? '/teacher' : '/student', req.url));
       }
    }
    console.log('[Middleware FINAL] Allowing access to public auth path:', pathname);
    // 세션 갱신은 필요할 수 있으므로 getSession은 호출 (이미 위에서 호출됨)
    // await supabase.auth.getSession(); 
    return res;
  }

  // 위 경로 외에는 세션이 없으면 무조건 로그인 페이지로
  if (sessionError || !session) {
    console.error('[Middleware FINAL] No session or error, redirecting to login from protected path:', pathname, sessionError);
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // --- 세션이 있는 경우 --- 
  const user = session.user;
  let userRole = user.user_metadata?.role;
  console.log('[Middleware FINAL] User exists. User ID:', user.id, 'Metadata Role:', userRole);

  // 역할 확인 (메타데이터 -> profiles 순서)
  if (!userRole) {
    console.log('[Middleware FINAL] Role missing in metadata, checking profiles...');
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('[Middleware FINAL] Error fetching profile:', profileError);
        return NextResponse.redirect(new URL('/login?error=profile_fetch_failed_mw', req.url));
      }
      userRole = profile?.role;
      console.log('[Middleware FINAL] Role from profile:', userRole);
    } catch (err) {
       console.error('[Middleware FINAL] Exception fetching profile:', err);
       return NextResponse.redirect(new URL('/login?error=profile_fetch_exception_mw', req.url));
    }
  }

  console.log('[Middleware FINAL] Final role check:', userRole);

  // 역할 없는 경우
  if (!userRole) {
      console.log('[Middleware FINAL] Role still missing, redirecting to select-role.');
      // 루트 경로에서 역할이 없을 때도 역할 선택으로 보내야 함
      if (pathname === '/') {
           return NextResponse.redirect(new URL('/select-role', req.url));
      } // 다른 보호된 경로에서 역할 없는 경우는 이미 위에서 처리됨 (로그인으로 리디렉션 또는 select-role)
      // select-role 페이지 자체는 허용됨 (위쪽 로직)
      // 따라서 이 블록은 사실상 루트 경로 처리만 남게 될 수 있음. 하지만 안전하게 유지.
      return NextResponse.redirect(new URL('/select-role', req.url));
  }

  // --- 역할이 있는 경우 --- 

  // 1. 루트 경로('/') 처리
  if (pathname === '/') {
      console.log('[Middleware FINAL] Handling root path. Role:', userRole);
      if (userRole === 'teacher') {
          return NextResponse.redirect(new URL('/teacher', req.url));
      } else if (userRole === 'student') {
          return NextResponse.redirect(new URL('/student', req.url));
      }
      // 혹시 모를 다른 역할 처리 (예: admin 등). 여기서는 일단 select-role로 보냄.
      console.warn('[Middleware FINAL] Unknown role on root path:', userRole);
      return NextResponse.redirect(new URL('/select-role', req.url));
  }

  // 2. 역할 기반 접근 제어 (기존 로직에서 '/' 제거)
  if (pathname.startsWith('/teacher') && userRole !== 'teacher') {
     console.log('[Middleware FINAL] Access denied for teacher route. Role:', userRole);
     return NextResponse.redirect(new URL('/login?error=unauthorized_teacher', req.url));
  }
  if (pathname.startsWith('/student') && userRole !== 'student') {
    console.log('[Middleware FINAL] Access denied for student route. Role:', userRole);
     return NextResponse.redirect(new URL('/login?error=unauthorized_student', req.url));
  }

  // 3. 특정 역할 페이지 접근 시 역할 재확인 (예: /select-role 접근 시 역할 있으면 리디렉션 - 이미 상단에서 처리됨)
  // 필요 시 추가: /login 접근 시 역할 있으면 리디렉션 (이미 상단에서 처리됨)

  console.log('[Middleware FINAL] Access allowed for path:', pathname);
  // 모든 검사를 통과하면 요청 진행 허용
  return res;
}

// config는 이전과 동일
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)', 
  ],
} 