import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isDemoClass } from '@/utils/demo-permissions';

export async function DELETE(
    request: NextRequest,
    context: any
) {
    try {
        const params = await context.params;
        const { id: classId } = params;

        if (!classId) {
            return NextResponse.json({ error: '학급 ID가 누락되었습니다.' }, { status: 400 });
        }

        const supabase = await createClient();

        // 학급 정보를 먼저 조회해서 데모 학급인지 확인 및 소유권 확인
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

        // 데모 학급 권한 체크
        if (isDemoClass(classData)) {
            return NextResponse.json(
                { error: '체험판 데모 학급은 삭제할 수 없습니다.' },
                { status: 403 }
            );
        }

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
            console.log('[DELETE API] 권한 없음. 학급 소유자:', classData.user_id, '요청자:', session.user.id);
            return NextResponse.json(
                { error: '학급에 대한 권한이 없습니다.' },
                { status: 403 }
            );
        }

        // 🌟 학급 및 하위 데이터를 관리자 권한으로 삭제 (Cascade가 설정되어 있다면 classes만 지워도 됨)
        // 하지만 Cascade가 없거나 확실하지 않으므로 supabaseAdmin을 통해 삭제 시도
        const { error: deleteError } = await (supabaseAdmin as any)
            .from('classes')
            .delete()
            .eq('id', classId);

        if (deleteError) {
            console.error('[DELETE API] 학급 삭제 오류:', deleteError);
            return NextResponse.json(
                { error: `학급 삭제 중 데이터베이스 오류가 발생했습니다: ${deleteError.message}` },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, message: '학급이 삭제되었습니다.' });

    } catch (error: any) {
        console.error('[DELETE API] 최상위 오류 발생:', error);
        return NextResponse.json(
            { error: `서버 오류: ${error.message}` },
            { status: 500 }
        );
    }
}
