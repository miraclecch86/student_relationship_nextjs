import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase-server';
import { Database } from '@/lib/database.types';
import { isDemoClass } from '@/utils/demo-permissions';

// 특정 생활기록부 조회 API
export async function GET(
  request: NextRequest,
  context: any
) {
  console.log('[GET API] 특정 생활기록부 조회 호출됨, params:', context.params);

  try {
    const params = await context.params;
    const { classId, recordId } = params;

    // Supabase 클라이언트 생성
    const supabase = await createClient();

    // 학급 정보를 먼저 조회해서 데모 학급인지 확인
    const { data: classData, error: classError } = await (supabase as any)
      .from('classes')
      .select('id, name, created_at, user_id, is_demo, is_public')
      .eq('id', classId)
      .single();

    if (classError || !classData) {
      console.error('[GET API] 학급 조회 오류:', classError);
      return NextResponse.json(
        { error: '학급을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 🌟 데모 학급이 아닌 경우에만 인증 확인
    if (!isDemoClass(classData)) {
      // 인증 확인
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session) {
        console.error('[GET API] 인증 오류:', authError);
        return NextResponse.json(
          { error: '인증되지 않은 사용자입니다.' },
          { status: 401 }
        );
      }

      // 소유권 확인
      if (classData.user_id !== session.user.id) {
        console.log('[GET API] 권한 없음. 학급 소유자:', classData.user_id, '요청자:', session.user.id);
        return NextResponse.json(
          { error: '학급에 대한 권한이 없습니다.' },
          { status: 403 }
        );
      }
    } else {
      console.log('[GET API] 데모 학급이므로 인증 생략');
    }

    // 생활기록부 조회 (Admin 클라이언트 사용)
    const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!adminKey || !supabaseUrl) {
      throw new Error('Service Role Key needed for School Record retrieval');
    }

    const { createClient: createAdminClient } = require('@supabase/supabase-js');
    const supabaseAdmin = createAdminClient(supabaseUrl, adminKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { data: schoolRecord, error: recordError } = await (supabaseAdmin as any)
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
    const params = await context.params;
    const { classId, recordId } = params;

    // Supabase 클라이언트 생성
    const supabase = await createClient();

    // 학급 정보를 먼저 조회해서 데모 학급인지 확인
    const { data: classData, error: classError } = await (supabase as any)
      .from('classes')
      .select('id, name, created_at, user_id, is_demo, is_public')
      .eq('id', classId)
      .single();

    if (classError || !classData) {
      console.error('[DELETE API] 학급 조회 오류:', classError);
      return NextResponse.json(
        { error: '학급을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 🌟 데모 학급이 아닌 경우에만 인증 확인
    if (!isDemoClass(classData)) {
      // 인증 확인
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session) {
        console.error('[DELETE API] 인증 오류:', authError);
        return NextResponse.json(
          { error: '인증되지 않은 사용자입니다.' },
          { status: 401 }
        );
      }

      // 소유권 확인
      if (classData.user_id !== session.user.id) {
        console.log('[DELETE API] 권한 없음');
        return NextResponse.json(
          { error: '학급에 대한 권한이 없습니다.' },
          { status: 403 }
        );
      }
    } else {
      console.log('[DELETE API] 데모 학급이므로 인증 생략');
    }

    // 생활기록부 삭제 (Admin 클라이언트 사용)
    const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!adminKey || !supabaseUrl) {
      throw new Error('Service Role Key needed for School Record deletion');
    }

    const { createClient: createAdminClient } = require('@supabase/supabase-js');
    const supabaseAdmin = createAdminClient(supabaseUrl, adminKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { error: deleteError } = await (supabaseAdmin as any)
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
    const params = await context.params;
    const { classId, recordId } = params;

    // 요청 본문 파싱
    const body = await request.json();
    const { summary } = body;

    // summary가 undefined인 경우에만 오류 반환 (빈 문자열은 허용)
    if (summary === undefined) {
      return NextResponse.json(
        { error: '설명 내용이 필요합니다.' },
        { status: 400 }
      );
    }

    // Supabase 클라이언트 생성
    const supabase = await createClient();

    // 학급 정보를 먼저 조회해서 데모 학급인지 확인
    const { data: classData, error: classError } = await (supabase as any)
      .from('classes')
      .select('id, name, created_at, user_id, is_demo, is_public')
      .eq('id', classId)
      .single();

    if (classError || !classData) {
      console.error('[PATCH API] 학급 조회 오류:', classError);
      return NextResponse.json(
        { error: '학급을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 🌟 데모 학급이 아닌 경우에만 인증 확인
    if (!isDemoClass(classData)) {
      // 인증 확인
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session) {
        console.error('[PATCH API] 인증 오류:', authError);
        return NextResponse.json(
          { error: '인증되지 않은 사용자입니다.' },
          { status: 401 }
        );
      }

      // 소유권 확인
      if (classData.user_id !== session.user.id) {
        console.log('[PATCH API] 권한 없음');
        return NextResponse.json(
          { error: '학급에 대한 권한이 없습니다.' },
          { status: 403 }
        );
      }
    } else {
      console.log('[PATCH API] 데모 학급이므로 인증 생략');
    }

    // 생활기록부 설명 업데이트 (Admin 클라이언트 사용)
    const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!adminKey || !supabaseUrl) {
      throw new Error('Service Role Key needed for School Record update');
    }

    const { createClient: createAdminClient } = require('@supabase/supabase-js');
    const supabaseAdmin = createAdminClient(supabaseUrl, adminKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { data: updatedRecord, error: updateError } = await (supabaseAdmin as any)
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