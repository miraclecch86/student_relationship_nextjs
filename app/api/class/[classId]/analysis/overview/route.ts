import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { analyzeClassOverview } from '@/lib/openai';
import { analyzeClassOverviewWithGemini } from '@/lib/gemini';
import { Database } from '@/lib/database.types';
import { isDemoClass } from '@/utils/demo-permissions';

export const dynamic = 'force-dynamic'; // 라우트를 동적으로 설정

// 종합 분석 API
export async function POST(
  request: NextRequest,
  context: any
) {
  console.log('[종합분석 API] 호출됨, context.params:', context.params);
  
  try {
    const params = await context.params;
    const { classId } = params;
    
    // 요청 본문에서 session_id와 model 추출
    const requestData = await request.json().catch(() => ({}));
    const sessionId = requestData.session_id || null;
    const model = requestData.model || 'gpt'; // 기본값은 gpt
    console.log('[종합분석 API] 세션 ID:', sessionId, ', 모델:', model);
    
    // Supabase 클라이언트 생성
    const supabase = createRouteHandlerClient<Database>({ cookies });
    console.log('[종합분석 API] Supabase 클라이언트 생성됨');

    // 인증 확인
    console.log('[종합분석 API] 인증 세션 확인 시작');
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError) {
      console.error('[종합분석 API] 인증 오류:', authError);
      return NextResponse.json(
        { error: '인증되지 않은 사용자입니다.' },
        { status: 401 }
      );
    }
    
    if (!session) {
      console.error('[종합분석 API] 세션이 존재하지 않음');
      return NextResponse.json(
        { error: '인증되지 않은 사용자입니다.' },
        { status: 401 }
      );
    }
    console.log('[종합분석 API] 인증 확인 완료, 사용자 ID:', session.user.id);

    // 학급 소유권 확인
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('id, name, created_at, user_id, is_demo, is_public')
      .eq('id', classId)
      .single();

    if (classError) {
      console.error('[종합분석 API] 학급 조회 오류:', classError);
      return NextResponse.json(
        { error: '학급을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
    if (!classData) {
      console.error('[종합분석 API] 학급 데이터가 null임');
      return NextResponse.json(
        { error: '학급을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 🌟 데모 학급이 아닌 경우에만 소유권 확인
    if (!isDemoClass(classData) && classData.user_id !== session.user.id) {
      console.log('[종합분석 API] 권한 없음. 학급 소유자:', classData.user_id, '요청자:', session.user.id);
      return NextResponse.json(
        { error: '학급에 대한 권한이 없습니다.' },
        { status: 403 }
      );
    }
    console.log('[종합분석 API] 학급 권한 확인 완료 (데모 학급:', isDemoClass(classData), ')');

    // 학생 목록 조회
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('*')
      .eq('class_id', classId);

    if (studentsError) {
      console.error('[종합분석 API] 학생 목록 조회 오류:', studentsError);
      return NextResponse.json(
        { error: '학생 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
    if (!students || students.length === 0) {
      console.error('[종합분석 API] 학생이 없음');
      return NextResponse.json(
        { error: '학생 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    console.log('[종합분석 API] 학생 목록 조회 완료, 학생 수:', students.length);

    // 관계 데이터 조회
    const { data: studentIds } = await supabase
      .from('students')
      .select('id')
      .eq('class_id', classId);

    if (!studentIds || studentIds.length === 0) {
      console.error('[종합분석 API] 학생 ID 조회 실패');
      return NextResponse.json(
        { error: '학생 ID를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const ids = studentIds.map(s => s.id);
    console.log('[종합분석 API] 학생 ID 목록:', ids);

    const { data: relationships, error: relError } = await supabase
      .from('relations')
      .select('*')
      .in('from_student_id', ids)
      .in('to_student_id', ids)
      .is('survey_id', null);

    if (relError) {
      console.error('[종합분석 API] 관계 데이터 조회 오류:', relError);
      return NextResponse.json(
        { error: '관계 데이터를 불러오는 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }
    console.log('[종합분석 API] 관계 데이터 조회 완료, 관계 수:', relationships ? relationships.length : 0);

    // AI 분석 수행 (선택된 모델에 따라)
    try {
      console.log('[종합분석 API] AI 분석 시작, 선택된 모델:', model);
      
      // 환경 변수 확인
      if (model === 'gpt' && !process.env.OPENAI_API_KEY) {
        console.error('[종합분석 API] OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.');
        return NextResponse.json(
          { error: 'OpenAI API 키가 설정되지 않았습니다. 환경 변수를 확인해주세요.' },
          { status: 500 }
        );
      }
      
      if (model === 'gemini-flash' && !process.env.GEMINI_API_KEY) {
        console.error('[종합분석 API] GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.');
        return NextResponse.json(
          { error: 'Gemini API 키가 설정되지 않았습니다. 환경 변수를 확인해주세요.' },
          { status: 500 }
        );
      }
      
      console.log('[종합분석 API] 환경 변수 확인 완료');
      
      // 학급에 속한 모든 설문지 조회
      console.log('[종합분석 API] 설문지 정보 조회 시작');
      const { data: surveys, error: surveysError } = await supabase
        .from('surveys')
        .select('*')
        .eq('class_id', classId)
        .order('created_at');

      if (surveysError) {
        console.error('[종합분석 API] 설문지 목록 조회 오류:', surveysError);
        // 설문지 오류는 치명적이지 않으므로 계속 진행
        console.log('[종합분석 API] 설문지 정보 없이 계속 진행');
      }
      
      console.log('[종합분석 API] 설문지 조회 완료, 설문지 수:', surveys ? surveys.length : 0);
      
      // 설문지별 관계 데이터 및 질문/응답 데이터 조회
      const surveyData = [];
      
      if (surveys && surveys.length > 0) {
        console.log('[종합분석 API] 설문지별 데이터 조회 시작');
        
        for (const survey of surveys) {
          // 설문지별 관계 데이터 조회
          const { data: surveyRelationships, error: surveyRelError } = await supabase
            .from('relations')
            .select('*')
            .in('from_student_id', ids)
            .in('to_student_id', ids)
            .eq('survey_id', survey.id);
            
          // 설문지별 질문 조회
          const { data: questions, error: questionsError } = await supabase
            .from('questions')
            .select('*')
            .eq('class_id', classId)
            .eq('survey_id', survey.id);
            
          // 설문지의 모든 응답 조회
          const { data: answers, error: answersError } = await supabase
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
        
        console.log('[종합분석 API] 설문지별 데이터 조회 완료');
      }
      
      // 모든 질문 데이터 조회
      console.log('[종합분석 API] 전체 질문 데이터 조회 시작');
      const { data: allQuestions, error: allQuestionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('class_id', classId);
        
      if (allQuestionsError) {
        console.error('[종합분석 API] 전체 질문 데이터 조회 오류:', allQuestionsError);
      }
      console.log('[종합분석 API] 전체 질문 데이터 조회 완료, 질문 수:', allQuestions ? allQuestions.length : 0);
      
      // 모든 응답 데이터 조회
      console.log('[종합분석 API] 전체 응답 데이터 조회 시작');
      const { data: allAnswers, error: allAnswersError } = await supabase
        .from('answers')
        .select('*')
        .in('student_id', ids);
        
      if (allAnswersError) {
        console.error('[종합분석 API] 전체 응답 데이터 조회 오류:', allAnswersError);
      }
      console.log('[종합분석 API] 전체 응답 데이터 조회 완료, 응답 수:', allAnswers ? allAnswers.length : 0);
      
      // 학급 정보 상세 조회
      console.log('[종합분석 API] 학급 상세 정보 조회 시작');
      const { data: classDetails, error: classDetailsError } = await supabase
        .from('classes')
        .select('*')
        .eq('id', classId)
        .single();
        
      if (classDetailsError) {
        console.error('[종합분석 API] 학급 상세 정보 조회 오류:', classDetailsError);
      }
      console.log('[종합분석 API] 학급 상세 정보 조회 완료');
      
      // AI 분석을 위해 모든 데이터를 전달 (선택된 모델에 따라)
      let analysisResult;
      if (model === 'gemini-flash') {
        analysisResult = await analyzeClassOverviewWithGemini(
          students,
          relationships || [],
          allAnswers || [],
          allQuestions || [],
          {
            classDetails: classDetails || { id: classId },
            surveys: surveys || [],
            surveyData: surveyData,
          }
        );
      } else {
        analysisResult = await analyzeClassOverview(
          students,
          relationships || [],
          allAnswers || [],
          allQuestions || [],
          {
            classDetails: classDetails || { id: classId },
            surveys: surveys || [],
            surveyData: surveyData,
          }
        );
      }
      console.log('[종합분석 API] AI 분석 완료, 모델:', model, ', 결과 타입:', typeof analysisResult);
      
      // 분석 결과 저장
      console.log('[종합분석 API] 분석 결과 저장 시작');
      
      // 요약 필드를 빈 문자열로 설정하여 사용자가 직접 입력하도록 유도
      let summary = '';
      
      // 결과 저장 준비 - 문자열로 변환
      const resultToSave = typeof analysisResult === 'string' 
        ? analysisResult 
        : JSON.stringify(analysisResult);
      
      // 데이터 저장 전 형식 디버깅
      console.log('[종합분석 API] 저장 전 데이터 형식:', {
        analysisResultType: typeof analysisResult,
        isString: typeof analysisResult === 'string',
        isObject: typeof analysisResult === 'object',
        resultToSaveType: typeof resultToSave,
        sessionId
      });
      
      // 결과를 명시적으로 JSON 문자열로 변환하여 저장
      
      const { data: savedAnalysis, error: saveError } = await supabase
        .from('analysis_results')
        .insert([
          {
            class_id: classId,
            result_data: resultToSave,
            summary: summary,
            type: 'overview', // 분석 유형 지정
            session_id: sessionId // 세션 ID 추가
          }
        ])
        .select()
        .single();

      if (saveError) {
        console.error('[종합분석 API] 분석 결과 저장 오류:', saveError);
        return NextResponse.json(
          { error: '분석 결과 저장 중 오류가 발생했습니다.' },
          { status: 500 }
        );
      }
      
      if (!savedAnalysis) {
        console.error('[종합분석 API] 저장된 분석이 null임');
        return NextResponse.json(
          { error: '분석 결과 저장에 실패했습니다.' },
          { status: 500 }
        );
      }

      console.log('[종합분석 API] 분석 결과 저장 완료, ID:', savedAnalysis.id);
      
      // 저장된 결과에서 result_data 형식 확인
      console.log('[종합분석 API] 저장된 result_data 타입:', typeof savedAnalysis.result_data);
      
      return NextResponse.json(savedAnalysis);
    } catch (error: any) {
      console.error('[종합분석 API] AI 분석 오류:', error.message);
      console.error('[종합분석 API] 오류 스택:', error.stack);
      return NextResponse.json(
        { error: `AI 분석 중 오류가 발생했습니다: ${error.message}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('[종합분석 API] 예외 발생:', error);
    return NextResponse.json(
      { error: `서버 오류: ${error.message}`, stack: error.stack },
      { status: 500 }
    );
  }
} 