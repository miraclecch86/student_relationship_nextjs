import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { analyzeStudentGroup } from '@/lib/openai';
import { Database } from '@/lib/database.types';

export const dynamic = 'force-dynamic'; // 라우트를 동적으로 설정

// 학생 그룹 분석 API
export async function POST(
  request: NextRequest,
  context: any
) {
  // 쿼리 파라미터에서 그룹 번호 가져오기 (기본값: 1)
  const searchParams = request.nextUrl.searchParams;
  const groupIndex = parseInt(searchParams.get('group') || '1', 10);
  
  if (isNaN(groupIndex) || groupIndex < 1) {
    return NextResponse.json(
      { error: '유효하지 않은 그룹 번호입니다. 그룹 번호는 1 이상이어야 합니다.' },
      { status: 400 }
    );
  }
  
  console.log(`[학생분석${groupIndex} API] 호출됨, context.params:`, context.params);
  
  try {
    const { classId } = context.params;
    
    // Supabase 클라이언트 생성
    const cookieStore = cookies();
    console.log(`[학생분석${groupIndex} API] 쿠키 스토어 생성됨`);
    
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });
    console.log(`[학생분석${groupIndex} API] Supabase 클라이언트 생성됨`);

    // 인증 확인
    console.log(`[학생분석${groupIndex} API] 인증 세션 확인 시작`);
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError) {
      console.error(`[학생분석${groupIndex} API] 인증 오류:`, authError);
      return NextResponse.json(
        { error: '인증되지 않은 사용자입니다.' },
        { status: 401 }
      );
    }
    
    if (!session) {
      console.error(`[학생분석${groupIndex} API] 세션이 존재하지 않음`);
      return NextResponse.json(
        { error: '인증되지 않은 사용자입니다.' },
        { status: 401 }
      );
    }
    console.log(`[학생분석${groupIndex} API] 인증 확인 완료, 사용자 ID:`, session.user.id);

    // 학급 소유권 확인
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('user_id')
      .eq('id', classId)
      .single();

    if (classError) {
      console.error(`[학생분석${groupIndex} API] 학급 조회 오류:`, classError);
      return NextResponse.json(
        { error: '학급을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
    if (!classData) {
      console.error(`[학생분석${groupIndex} API] 학급 데이터가 null임`);
      return NextResponse.json(
        { error: '학급을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (classData.user_id !== session.user.id) {
      console.log(`[학생분석${groupIndex} API] 권한 없음. 학급 소유자:`, classData.user_id, '요청자:', session.user.id);
      return NextResponse.json(
        { error: '학급에 대한 권한이 없습니다.' },
        { status: 403 }
      );
    }
    console.log(`[학생분석${groupIndex} API] 학급 권한 확인 완료`);

    // 학생 목록 조회
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('*')
      .eq('class_id', classId);

    if (studentsError) {
      console.error(`[학생분석${groupIndex} API] 학생 목록 조회 오류:`, studentsError);
      return NextResponse.json(
        { error: '학생 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
    if (!students || students.length === 0) {
      console.error(`[학생분석${groupIndex} API] 학생이 없음`);
      return NextResponse.json(
        { error: '학생 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    console.log(`[학생분석${groupIndex} API] 학생 목록 조회 완료, 학생 수:`, students.length);

    // 관계 데이터 조회
    const { data: studentIds } = await supabase
      .from('students')
      .select('id')
      .eq('class_id', classId);

    if (!studentIds || studentIds.length === 0) {
      console.error(`[학생분석${groupIndex} API] 학생 ID 조회 실패`);
      return NextResponse.json(
        { error: '학생 ID를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const ids = studentIds.map(s => s.id);
    console.log(`[학생분석${groupIndex} API] 학생 ID 목록:`, ids);

    const { data: relationships, error: relError } = await supabase
      .from('relations')
      .select('*')
      .in('from_student_id', ids)
      .in('to_student_id', ids)
      .is('survey_id', null);

    if (relError) {
      console.error(`[학생분석${groupIndex} API] 관계 데이터 조회 오류:`, relError);
      return NextResponse.json(
        { error: '관계 데이터를 불러오는 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }
    console.log(`[학생분석${groupIndex} API] 관계 데이터 조회 완료, 관계 수:`, relationships ? relationships.length : 0);

    // OpenAI API를 통해 분석 수행
    try {
      console.log(`[학생분석${groupIndex} API] GPT 분석 시작`);
      
      // 환경 변수 확인
      if (!process.env.OPENAI_API_KEY) {
        console.error(`[학생분석${groupIndex} API] OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.`);
        return NextResponse.json(
          { error: 'OpenAI API 키가 설정되지 않았습니다. 환경 변수를 확인해주세요.' },
          { status: 500 }
        );
      }
      
      console.log(`[학생분석${groupIndex} API] 환경 변수 확인 완료, API 키 길이:`, process.env.OPENAI_API_KEY.length);
      
      // 학급에 속한 모든 설문지 조회
      console.log(`[학생분석${groupIndex} API] 설문지 정보 조회 시작`);
      const { data: surveys, error: surveysError } = await supabase
        .from('surveys')
        .select('*')
        .eq('class_id', classId)
        .order('created_at');

      if (surveysError) {
        console.error(`[학생분석${groupIndex} API] 설문지 목록 조회 오류:`, surveysError);
        // 설문지 오류는 치명적이지 않으므로 계속 진행
        console.log(`[학생분석${groupIndex} API] 설문지 정보 없이 계속 진행`);
      }
      
      console.log(`[학생분석${groupIndex} API] 설문지 조회 완료, 설문지 수:`, surveys ? surveys.length : 0);
            
      // 모든 질문 데이터 조회
      console.log(`[학생분석${groupIndex} API] 전체 질문 데이터 조회 시작`);
      const { data: allQuestions, error: allQuestionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('class_id', classId);
        
      if (allQuestionsError) {
        console.error(`[학생분석${groupIndex} API] 전체 질문 데이터 조회 오류:`, allQuestionsError);
      }
      console.log(`[학생분석${groupIndex} API] 전체 질문 데이터 조회 완료, 질문 수:`, allQuestions ? allQuestions.length : 0);
      
      // 모든 응답 데이터 조회
      console.log(`[학생분석${groupIndex} API] 전체 응답 데이터 조회 시작`);
      const { data: allAnswers, error: allAnswersError } = await supabase
        .from('answers')
        .select('*')
        .in('student_id', ids);
        
      if (allAnswersError) {
        console.error(`[학생분석${groupIndex} API] 전체 응답 데이터 조회 오류:`, allAnswersError);
      }
      console.log(`[학생분석${groupIndex} API] 전체 응답 데이터 조회 완료, 응답 수:`, allAnswers ? allAnswers.length : 0);
      
      // 학급 정보 상세 조회
      console.log(`[학생분석${groupIndex} API] 학급 상세 정보 조회 시작`);
      const { data: classDetails, error: classDetailsError } = await supabase
        .from('classes')
        .select('*')
        .eq('id', classId)
        .single();
        
      if (classDetailsError) {
        console.error(`[학생분석${groupIndex} API] 학급 상세 정보 조회 오류:`, classDetailsError);
      }
      console.log(`[학생분석${groupIndex} API] 학급 상세 정보 조회 완료`);
      
      // GPT 분석을 위해 모든 데이터를 전달
      const analysisResult = await analyzeStudentGroup(
        students,
        relationships || [],
        groupIndex,
        allAnswers || [],
        allQuestions || [],
        {
          classDetails: classDetails || { id: classId },
          surveys: surveys || []
        }
      );
      console.log(`[학생분석${groupIndex} API] GPT 분석 완료, 결과 타입:`, typeof analysisResult);
      
      // 분석 결과 저장
      console.log(`[학생분석${groupIndex} API] 분석 결과 저장 시작`);
      
      // 요약 생성 - 텍스트 응답에서 처음 200자를 요약으로 사용
      let summary = '';
      if (typeof analysisResult === 'string') {
        summary = analysisResult.substring(0, 200) + '...';
      } else {
        // 객체인 경우 (이전 형식과의 호환성 유지)
        try {
          const result = analysisResult as any;
          if (result && typeof result.analysis === 'string') {
            summary = result.analysis.substring(0, 200) + '...';
          } else {
            summary = `학생 그룹 ${groupIndex} 분석 결과 요약 (자세한 내용은 상세 페이지 참조)`;
          }
        } catch (e) {
          summary = `학생 그룹 ${groupIndex} 분석 결과 요약 (자세한 내용은 상세 페이지 참조)`;
          console.warn(`[학생분석${groupIndex} API] 분석 결과 요약 생성 중 오류:`, e);
        }
      }
      
      // 결과 저장 준비 - 문자열로 변환
      const resultToSave = typeof analysisResult === 'string' 
        ? analysisResult 
        : JSON.stringify(analysisResult);
      
      // 데이터 저장 전 형식 디버깅
      console.log(`[학생분석${groupIndex} API] 저장 전 데이터 형식:`, {
        analysisResultType: typeof analysisResult,
        isString: typeof analysisResult === 'string',
        isObject: typeof analysisResult === 'object',
        resultToSaveType: typeof resultToSave
      });
      
      // 결과를 명시적으로 JSON 문자열로 변환하여 저장
      const { data: savedAnalysis, error: saveError } = await supabase
        .from('analysis_results')
        .insert([
          {
            class_id: classId,
            result_data: resultToSave,
            summary: summary,
            type: `students-${groupIndex}` // 분석 유형 지정 (학생 그룹 + 인덱스)
          }
        ])
        .select()
        .single();

      if (saveError) {
        console.error(`[학생분석${groupIndex} API] 분석 결과 저장 오류:`, saveError);
        return NextResponse.json(
          { error: '분석 결과 저장 중 오류가 발생했습니다.' },
          { status: 500 }
        );
      }
      
      if (!savedAnalysis) {
        console.error(`[학생분석${groupIndex} API] 저장된 분석이 null임`);
        return NextResponse.json(
          { error: '분석 결과 저장에 실패했습니다.' },
          { status: 500 }
        );
      }

      console.log(`[학생분석${groupIndex} API] 분석 결과 저장 완료, ID:`, savedAnalysis.id);
      
      return NextResponse.json(savedAnalysis);
    } catch (error: any) {
      console.error(`[학생분석${groupIndex} API] GPT 분석 오류:`, error.message);
      console.error(`[학생분석${groupIndex} API] 오류 스택:`, error.stack);
      return NextResponse.json(
        { error: `GPT 분석 중 오류가 발생했습니다: ${error.message}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error(`[학생분석${groupIndex} API] 예외 발생:`, error);
    return NextResponse.json(
      { error: `서버 오류: ${error.message}`, stack: error.stack },
      { status: 500 }
    );
  }
} 