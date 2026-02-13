import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase-server';
import { generateSchoolRecordWithGemini } from '@/lib/gemini';
import { Database } from '@/lib/database.types';
import { isDemoClass } from '@/utils/demo-permissions';

export const dynamic = 'force-dynamic';

// 생활기록부 생성 API
export async function POST(
  request: NextRequest,
  context: any
) {
  const params = await context.params;
  console.log('[POST API] 생활기록부 생성 호출됨, params:', params);

  try {
    const { classId } = params;

    console.log('[POST API] Gemini 모델을 사용하여 생활기록부 생성');

    // Supabase 클라이언트 생성
    const supabase = await createClient();
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
    const { data: classData, error: classError } = await (supabase as any)
      .from('classes')
      .select('id, name, created_at, user_id, is_demo, is_public')
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

    // 🌟 데모 학급이 아닌 경우에만 소유권 확인
    if (!isDemoClass(classData) && classData.user_id !== session.user.id) {
      console.log('[POST API] 권한 없음. 학급 소유자:', classData.user_id, '요청자:', session.user.id);
      return NextResponse.json(
        { error: '학급에 대한 권한이 없습니다.' },
        { status: 403 }
      );
    }
    console.log('[POST API] 학급 권한 확인 완료 (데모 학급:', isDemoClass(classData), ')');

    // 학생 목록 조회
    const { data: students, error: studentsError } = await (supabase as any)
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
    const { data: studentIds } = await (supabase as any)
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

    const ids = studentIds.map((s: any) => s.id);
    console.log('[POST API] 학생 ID 목록:', ids);

    const { data: relationships, error: relError } = await (supabase as any)
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

    // 학급에 속한 모든 설문지 조회
    console.log('[POST API] 설문지 정보 조회 시작');
    const { data: surveys, error: surveysError } = await (supabase as any)
      .from('surveys')
      .select('*')
      .eq('class_id', classId)
      .order('created_at');

    if (surveysError) {
      console.error('[POST API] 설문지 목록 조회 오류:', surveysError);
      // 설문지 오류는 치명적이지 않으므로 계속 진행
      console.log('[POST API] 설문지 정보 없이 계속 진행');
    }

    console.log('[POST API] 설문지 조회 완료, 설문지 수:', surveys ? surveys.length : 0);

    // 설문지별 관계 데이터 및 질문/응답 데이터 조회
    const surveyData = [];

    if (surveys && surveys.length > 0) {
      console.log('[POST API] 설문지별 데이터 조회 시작');

      for (const survey of surveys) {
        // 설문지별 관계 데이터 조회
        const { data: surveyRelationships, error: surveyRelError } = await (supabase as any)
          .from('relations')
          .select('*')
          .in('from_student_id', ids)
          .in('to_student_id', ids)
          .eq('survey_id', survey.id);

        // 설문지별 질문 조회 - 모든 질문 가져오기
        const { data: questions, error: questionsError } = await (supabase as any)
          .from('questions')
          .select('*')
          .eq('class_id', classId);

        // 설문지의 모든 응답 조회
        const { data: answers, error: answersError } = await (supabase as any)
          .from('answers')
          .select('*')
          .in('student_id', ids);

        surveyData.push({
          survey: survey,
          relationships: surveyRelationships || [],
          questions: questions || [],
          answers: answers || []
        });
      }

      console.log('[POST API] 설문지별 데이터 조회 완료');
    }

    // 모든 질문 데이터 조회
    console.log('[POST API] 전체 질문 데이터 조회 시작');
    const { data: allQuestions, error: allQuestionsError } = await (supabase as any)
      .from('questions')
      .select('*')
      .eq('class_id', classId);

    if (allQuestionsError) {
      console.error('[POST API] 전체 질문 데이터 조회 오류:', allQuestionsError);
    }
    console.log('[POST API] 전체 질문 데이터 조회 완료, 질문 수:', allQuestions ? allQuestions.length : 0);

    // 모든 응답 데이터 조회
    console.log('[POST API] 전체 응답 데이터 조회 시작');
    const { data: allAnswers, error: allAnswersError } = await (supabase as any)
      .from('answers')
      .select('*')
      .in('student_id', ids);

    if (allAnswersError) {
      console.error('[POST API] 전체 응답 데이터 조회 오류:', allAnswersError);
    }
    console.log('[POST API] 전체 응답 데이터 조회 완료, 응답 수:', allAnswers ? allAnswers.length : 0);

    // Gemini AI를 사용한 학생별 생활기록부 생성
    console.log('[POST API] 생활기록부 생성 시작');

    // 환경 변수 확인
    if (!process.env.GEMINI_API_KEY) {
      console.error('[POST API] GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.');
      return NextResponse.json(
        { error: 'Gemini API 키가 설정되지 않았습니다. 환경 변수를 확인해주세요.' },
        { status: 500 }
      );
    }

    console.log('[POST API] 환경 변수 확인 완료');

    // 분석 데이터 준비
    const additionalAnalysisData = {
      classDetails: classData,
      surveys: surveys || [],
      surveyData: surveyData
    };

    let analysis = '';
    try {
      console.log('[POST API] Gemini AI 분석 시작');
      console.log('[POST API] 분석 데이터 준비 완료:', {
        studentCount: students.length,
        relationshipCount: relationships ? relationships.length : 0,
        answersCount: allAnswers ? allAnswers.length : 0,
        questionsCount: allQuestions ? allQuestions.length : 0,
        surveysCount: surveys ? surveys.length : 0
      });

      console.log('[POST API] Gemini 모델로 생활기록부 생성 시작');
      analysis = await generateSchoolRecordWithGemini(
        students,
        relationships || [],
        allAnswers || [],
        allQuestions || [],
        additionalAnalysisData,
        'pro'
      );
      console.log('[POST API] Gemini 생성 완료, 결과 길이:', analysis.length);

      if (!analysis || analysis.trim().length === 0) {
        console.error('[POST API] AI에서 빈 결과 반환됨');
        return NextResponse.json(
          { error: 'AI에서 생활기록부 내용을 생성하지 못했습니다.' },
          { status: 500 }
        );
      }

    } catch (aiError: any) {
      console.error('[POST API] AI 생성 중 오류 발생:', aiError);
      return NextResponse.json(
        { error: `생활기록부 생성 중 오류가 발생했습니다: ${aiError.message}` },
        { status: 500 }
      );
    }

    console.log('[POST API] 생활기록부 생성 완료');

    // Supabase에 결과 저장 (RLS 우회를 위해 Admin 클라이언트 사용)
    console.log('[POST API] 생활기록부 결과 저장 시작');

    // 🌟 클라이언트 요청 중단 확인
    if (request.signal.aborted) {
      console.log('[POST API] 클라이언트 요청 중단됨 (저장 건너뜀)');
      return NextResponse.json(
        { error: '사용자에 의해 요청이 중단되었습니다.' },
        { status: 499 } // Client Closed Request
      );
    }

    // Admin 클라이언트 초기화
    const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!adminKey || !supabaseUrl) {
      console.error('[POST API] Critical: Service Role Key missing');
      throw new Error('Server configuration error: Service Role Key missing');
    }

    const { createClient: createAdminClient } = require('@supabase/supabase-js');
    const supabaseAdmin = createAdminClient(supabaseUrl, adminKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { data: savedRecord, error: saveError } = await (supabaseAdmin as any)
      .from('school_records')
      .insert({
        class_id: classId,
        result_data: analysis,
        summary: ''
      })
      .select()
      .single();

    if (saveError) {
      console.error('[POST API] 생활기록부 저장 오류:', saveError);
      return NextResponse.json(
        { error: '생활기록부 저장 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    if (!savedRecord) {
      console.error('[POST API] 생활기록부 저장 실패: 결과가 null입니다.');
      return NextResponse.json(
        { error: '생활기록부 저장에 실패했습니다.' },
        { status: 500 }
      );
    }

    console.log('[POST API] 생활기록부 저장 완료, ID:', savedRecord.id);

    // 성공 응답 반환
    return NextResponse.json(savedRecord);

  } catch (error: any) {
    console.error('[POST API] 최상위 오류 발생:', error);
    return NextResponse.json(
      { error: `서버 오류: ${error.message}` },
      { status: 500 }
    );
  }
}

// 생활기록부 목록 조회 API
export async function GET(
  request: NextRequest,
  context: any
) {
  const params = await context.params;
  console.log('[GET API] 생활기록부 목록 조회 호출됨, params:', params);

  try {
    const { classId } = params;

    // Supabase 클라이언트 생성
    const supabase = await createClient();

    // 학급 정보를 먼저 조회해서 데모 학급인지 확인
    console.log('[GET API] 학급 정보 조회 중...');
    const { data: classData, error: classError } = await (supabase as any)
      .from('classes')
      .select('id, name, created_at, user_id, is_demo, is_public')
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

    // 🌟 데모 학급이 아닌 경우에만 인증 확인
    if (!isDemoClass(classData)) {
      // 인증 확인
      console.log('[GET API] 인증 세션 확인 시작 (일반 학급)');
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
      console.log('[GET API] 인증 확인 완료, 사용자 ID:', session.user.id);
    } else {
      console.log('[GET API] 데모 학급이므로 인증 생략');
    }

    // 생활기록부 목록 조회
    console.log('[GET API] 생활기록부 목록 조회 시작');

    // 데모 학급이거나 일반 학급이어도 RLS 우회를 위해 Admin 클라이언트 사용
    // (분석 결과와 동일하게 처리)
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

    const { data: records, error: recordsError } = await (supabaseAdmin as any)
      .from('school_records')
      .select('*')
      .eq('class_id', classId)
      .order('created_at', { ascending: false });

    if (recordsError) {
      console.error('[GET API] 생활기록부 조회 오류:', recordsError);
      return NextResponse.json(
        { error: '생활기록부를 불러오는 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    console.log('[GET API] 생활기록부 조회 완료, 결과 수:', records ? records.length : 0);
    return NextResponse.json(records || []);
  } catch (error: any) {
    console.error('[GET API] 예외 발생:', error);
    return NextResponse.json(
      { error: `서버 오류: ${error.message}` },
      { status: 500 }
    );
  }
}

// 생활기록부 일괄 삭제 API
export async function DELETE(
  request: NextRequest,
  context: any
) {
  const params = await context.params;
  console.log('[DELETE API] 생활기록부 삭제 호출됨, params:', params);

  try {
    const { classId } = params;
    const url = new URL(request.url);
    const allParam = url.searchParams.get('all');
    const isDeleteAll = allParam === 'true';

    console.log('[DELETE API] 삭제 모드:', isDeleteAll ? '모든 생활기록부 삭제' : '특정 생활기록부 삭제');

    // Supabase 클라이언트 생성
    const supabase = await createClient();

    // 학급 정보를 먼저 조회해서 데모 학급인지 확인 (권한 체크를 위해)
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

    // 🌟 데모 학급 처리
    if (isDemoClass(classData)) {
      console.log('[DELETE API] 데모 학급이므로 인증 및 권한 확인 생략');
    } else {
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
    }

    if (classError || !classData) {
      console.error('[DELETE API] 학급 조회 오류:', classError);
      return NextResponse.json(
        { error: '학급을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (isDeleteAll) {
      // 학급의 모든 생활기록부 삭제 (관리자 권한으로)
      const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

      if (!adminKey || !supabaseUrl) {
        throw new Error('Service Role Key needed for deletion');
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
        .eq('class_id', classId);

      if (deleteError) {
        console.error('[DELETE API] 모든 생활기록부 삭제 오류:', deleteError);
        return NextResponse.json(
          { error: '생활기록부 삭제 중 오류가 발생했습니다.' },
          { status: 500 }
        );
      }

      console.log('[DELETE API] 모든 생활기록부 삭제 완료');
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