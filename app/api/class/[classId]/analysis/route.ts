import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { analyzeStudentRelationshipsWithGemini } from '@/lib/gemini';
import { Database } from '@/lib/database.types';
import { isDemoClass } from '@/utils/demo-permissions';

// 분석 결과 저장 API
export async function POST(
  request: NextRequest,
  context: any
) {
  console.log('[POST API] 호출됨, params:', context.params);
  
  try {
    const { classId } = context.params;
    
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

    // Gemini API를 통해 분석 수행
    try {
      console.log('[POST API] AI 분석 시작');
      
      // 환경 변수 확인
      if (!process.env.GEMINI_API_KEY) {
        console.error('[POST API] GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.');
        return NextResponse.json(
          { error: 'Gemini API 키가 설정되지 않았습니다. 환경 변수를 확인해주세요.' },
          { status: 500 }
        );
      }
      
      console.log('[POST API] 환경 변수 확인 완료');
      
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
            
          // 설문지별 질문 조회
          const { data: questions, error: questionsError } = await (supabase as any)
            .from('questions')
            .select('*')
            .eq('class_id', classId)
            .eq('survey_id', survey.id);
            
          // 설문지의 모든 응답 조회
          const { data: answers, error: answersError } = await (supabase as any)
            .from('answers')
            .select('*')
            .in('student_id', ids)
            .eq('survey_id', survey.id);
            
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
    
    // 학급 정보 상세 조회
    console.log('[POST API] 학급 상세 정보 조회 시작');
    const { data: classDetails, error: classDetailsError } = await (supabase as any)
      .from('classes')
      .select('*')
      .eq('id', classId)
      .single();
      
    if (classDetailsError) {
      console.error('[POST API] 학급 상세 정보 조회 오류:', classDetailsError);
    }
    console.log('[POST API] 학급 상세 정보 조회 완료');

    // 일기기록 데이터 조회
    console.log('[POST API] 일기기록 데이터 조회 시작');
    const { data: dailyRecords, error: dailyRecordsError } = await (supabase as any)
      .from('class_daily_records')
      .select('*')
      .eq('class_id', classId)
      .order('record_date', { ascending: false });
      
    if (dailyRecordsError) {
      console.error('[POST API] 일기기록 데이터 조회 오류:', dailyRecordsError);
    }
    console.log('[POST API] 일기기록 데이터 조회 완료, 기록 수:', dailyRecords ? dailyRecords.length : 0);

    // 평가기록 데이터 조회
    console.log('[POST API] 평가기록 데이터 조회 시작');
    const { data: subjects, error: subjectsError } = await (supabase as any)
      .from('subjects')
      .select(`
        *,
        assessment_items (
          *,
          assessment_records (
            *,
            students (name)
          )
        )
      `)
      .eq('class_id', classId);
      
    if (subjectsError) {
      console.error('[POST API] 평가기록 데이터 조회 오류:', subjectsError);
    }
    console.log('[POST API] 평가기록 데이터 조회 완료, 과목 수:', subjects ? subjects.length : 0);

    // 과제체크 데이터 조회
    console.log('[POST API] 과제체크 데이터 조회 시작');
    const { data: homeworkMonths, error: homeworkError } = await (supabase as any)
      .from('homework_months')
      .select(`
        *,
        homework_items (
          *,
          homework_records (
            *,
            students (name)
          )
        )
      `)
      .eq('class_id', classId)
      .order('month_year', { ascending: false });
      
    if (homeworkError) {
      console.error('[POST API] 과제체크 데이터 조회 오류:', homeworkError);
    }
    console.log('[POST API] 과제체크 데이터 조회 완료, 월별 그룹 수:', homeworkMonths ? homeworkMonths.length : 0);
      
      // AI 분석을 위해 모든 데이터를 전달
      const analysisResult = await analyzeStudentRelationshipsWithGemini(
        students,
        relationships || [],
        allAnswers || [],
        allQuestions || [],
        {
          classDetails: classDetails || { id: classId },
          surveys: surveys || [],
          surveyData: surveyData,
          dailyRecords: dailyRecords || [],
          subjects: subjects || [],
          homeworkMonths: homeworkMonths || [],
        }
      );
      console.log('[POST API] AI 분석 완료, 결과 타입:', typeof analysisResult);
      
      // 분석 결과 저장
      console.log('[POST API] 분석 결과 저장 시작');
      
      // 요약 필드를 빈 문자열로 설정하여 사용자가 직접 입력하도록 유도
      let summary = '';
      
      // 결과 저장 준비 - 문자열로 변환
      const resultToSave = typeof analysisResult === 'string' 
        ? analysisResult 
        : JSON.stringify(analysisResult);
      
      // 데이터 저장 전 형식 디버깅
      console.log('[POST API] 저장 전 데이터 형식:', {
        analysisResultType: typeof analysisResult,
        isString: typeof analysisResult === 'string',
        isObject: typeof analysisResult === 'object',
        resultToSaveType: typeof resultToSave
      });
      
      // 결과를 명시적으로 JSON 문자열로 변환하여 저장
      
      const { data: savedAnalysis, error: saveError } = await (supabase as any)
        .from('analysis_results')
        .insert([
          {
            class_id: classId,
            result_data: resultToSave,
            summary: summary,
            type: 'full'
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
      
      // 저장된 결과에서 result_data 형식 확인
      console.log('[POST API] 저장된 result_data 타입:', typeof savedAnalysis.result_data);
      
      return NextResponse.json(savedAnalysis);
    } catch (error: any) {
      console.error('[POST API] AI 분석 오류:', error.message);
      console.error('[POST API] 오류 스택:', error.stack);
      return NextResponse.json(
        { error: `AI 분석 중 오류가 발생했습니다: ${error.message}` },
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
  context: any
) {
  console.log('[GET API] 호출됨, context.params:', context.params);
  
  // URL 파라미터 가져오기
  const { searchParams } = request.nextUrl;
  console.log('[GET API] 검색 파라미터:', searchParams.toString());
  
  // 타입 필터
  const typeFilter = searchParams.get('type');
  console.log('[GET API] 타입 필터:', typeFilter);
  
  // 세션별 그룹화
  const groupBySession = searchParams.get('group_by_session') === 'true';
  console.log('[GET API] 세션별 그룹화:', groupBySession);
  
  try {
    const { classId } = context.params;
    
    // Supabase 클라이언트 생성
    const cookieStore = cookies();
    console.log('[GET API] 쿠키 스토어 생성됨');
    
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });
    console.log('[GET API] Supabase 클라이언트 생성됨');

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

    // 분석 결과 목록 조회
    console.log('[GET API] 분석 결과 목록 조회 시작');
    
    // 모든 결과를 가져옴
    let query = (supabase as any)
      .from('analysis_results')
      .select('*')
      .eq('class_id', classId);
    
    // 타입 필터 적용
    if (typeFilter) {
      query = query.eq('type', typeFilter);
      console.log(`[GET API] 타입 필터 적용: ${typeFilter}`);
    }
    
    // 정렬 적용
    query = query.order('created_at', { ascending: false });
    
    // 쿼리 실행
    const { data: allResults, error: resultsError } = await query;

    if (resultsError) {
      console.error('[GET API] 분석 결과 조회 오류:', resultsError);
      return NextResponse.json(
        { error: '분석 결과를 불러오는 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }
    
    // 세션별 그룹화가 필요한 경우
    if (groupBySession && allResults) {
      console.log('[GET API] 세션별 그룹화 적용');
      
      // 세션별로 그룹화
      const sessionGroups: { [key: string]: any[] } = {};
      const regularResults: any[] = [];
      
      allResults.forEach((result: any) => {
        if (result.session_id) {
          if (!sessionGroups[result.session_id]) {
            sessionGroups[result.session_id] = [];
          }
          sessionGroups[result.session_id].push(result);
        } else {
          // session_id가 없는 기존 결과는 그대로 유지
          regularResults.push(result);
        }
      });
      
      // 각 세션의 첫 번째 분석 결과만 카드로 표시하기 위해 처리
      // 각 세션마다 하나의 카드만 보여주지만, 이 카드의 ID로 세션의 모든 분석에 접근 가능
      const groupedResults = Object.values(sessionGroups).map(group => {
        // 분석 결과들을 생성 날짜 역순으로 정렬 (최신 결과가 먼저 오도록)
        group.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        
        // 세션 내에서 표시될 대표 카드 선택 (우선순위: overview > 첫 번째 결과)
        // 이 카드의 ID를 통해 같은 세션의 다른 분석 결과에 접근 가능
        const overviewResult = group.find(r => r.type === 'overview');
        return overviewResult || group[0];
      });
      
      // 세션별 결과와 일반 결과 합치기
      const finalResults = [...groupedResults, ...regularResults];
      // 날짜 기준 내림차순 정렬
      finalResults.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      console.log('[GET API] 분석 결과 조회 완료, 그룹화 전 결과 수:', allResults.length, '그룹화 후 결과 수:', finalResults.length);
      return NextResponse.json(finalResults);
    }
    
    // 일반 결과 반환
    console.log('[GET API] 분석 결과 조회 완료, 결과 수:', allResults ? allResults.length : 0);
    return NextResponse.json(allResults || []);
  } catch (error: any) {
    console.error('[GET API] 예외 발생:', error);
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
  console.log('[DELETE API] 호출됨, params:', context.params);
  
  // 전체 삭제 여부 확인
  const searchParams = request.nextUrl.searchParams;
  const deleteAll = searchParams.get('deleteAll') === 'true'; // 전체 삭제 여부
  console.log('[DELETE API] 전체 삭제 요청:', deleteAll);
  
  try {
    const { classId } = context.params;
    
    // Supabase 클라이언트 생성
    const cookieStore = cookies();
    console.log('[DELETE API] 쿠키 스토어 생성됨');
    
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });
    console.log('[DELETE API] Supabase 클라이언트 생성됨');

    // 인증 확인
    console.log('[DELETE API] 인증 세션 확인 시작');
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError) {
      console.error('[DELETE API] 인증 오류:', authError);
      return NextResponse.json(
        { error: '인증되지 않은 사용자입니다.' },
        { status: 401 }
      );
    }
    
    if (!session) {
      console.error('[DELETE API] 세션이 존재하지 않음');
      return NextResponse.json(
        { error: '인증되지 않은 사용자입니다.' },
        { status: 401 }
      );
    }
    console.log('[DELETE API] 인증 확인 완료, 사용자 ID:', session.user.id);

    // 학급 소유권 확인
    const { data: classData, error: classError } = await (supabase as any)
      .from('classes')
      .select('id, name, created_at, user_id, is_demo, is_public')
      .eq('id', classId)
      .single();

    if (classError) {
      console.error('[DELETE API] 학급 조회 오류:', classError);
      return NextResponse.json(
        { error: '학급을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
    if (!classData) {
      console.error('[DELETE API] 학급 데이터가 null임');
      return NextResponse.json(
        { error: '학급을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 🌟 데모 학급이 아닌 경우에만 소유권 확인
    if (!isDemoClass(classData) && classData.user_id !== session.user.id) {
      console.log('[DELETE API] 권한 없음. 학급 소유자:', classData.user_id, '요청자:', session.user.id);
      return NextResponse.json(
        { error: '학급에 대한 권한이 없습니다.' },
        { status: 403 }
      );
    }
    console.log('[DELETE API] 학급 권한 확인 완료 (데모 학급:', isDemoClass(classData), ')');

    // 전체 삭제 요청인 경우
    if (deleteAll) {
      console.log('[DELETE API] 모든 분석 결과 삭제 시작');
      
      // 해당 클래스의 모든 분석 결과 삭제
      const { error: deleteError } = await (supabase as any)
        .from('analysis_results')
        .delete()
        .eq('class_id', classId);
      
      if (deleteError) {
        console.error('[DELETE API] 모든 분석 결과 삭제 오류:', deleteError);
        return NextResponse.json(
          { error: '분석 결과를 삭제하는 중 오류가 발생했습니다.' },
          { status: 500 }
        );
      }
      
      console.log('[DELETE API] 모든 분석 결과 삭제 완료');
      return NextResponse.json({ success: true, message: '모든 분석 결과가 삭제되었습니다.' });
    } else {
      console.error('[DELETE API] 삭제할 분석 ID가 지정되지 않음');
      return NextResponse.json(
        { error: '삭제할 분석 ID 또는 전체 삭제 옵션을 지정해야 합니다.' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('[DELETE API] 예외 발생:', error);
    return NextResponse.json(
      { error: `서버 오류: ${error.message}`, stack: error.stack },
      { status: 500 }
    );
  }
} 