import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { analyzeStudentGroup } from '@/lib/openai';
import { analyzeStudentGroupWithGemini } from '@/lib/gemini';
import { Database } from '@/lib/database.types';
import { Student, Relationship, Answer, Question, Survey } from '@/lib/supabase';
import { isDemoClass } from '@/utils/demo-permissions';

// UUID 생성 함수
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// 데이터베이스 테이블 조회 헬퍼 함수
async function queryTable(supabase: any, tableName: string, query: any) {
  // 먼저 복수형 테이블 이름 시도
  const pluralResult = await supabase.from(tableName + 's').select('*').eq(...query);
  
  if (!pluralResult.error) {
    console.log(`[학생 그룹 분석 API] ${tableName}s 테이블 조회 성공`);
    return { data: pluralResult.data, error: null };
  }
  
  // 단수형 테이블 이름 시도
  const singularResult = await supabase.from(tableName).select('*').eq(...query);
  
  if (!singularResult.error) {
    console.log(`[학생 그룹 분석 API] ${tableName} 테이블 조회 성공`);
    return { data: singularResult.data, error: null };
  }
  
  // 대체 복수형 시도 (일부 테이블 이름)
  if (tableName === 'relationship') {
    const altResult = await supabase.from('relations').select('*').eq(...query);
    
    if (!altResult.error) {
      console.log(`[학생 그룹 분석 API] relations 테이블 조회 성공`);
      return { data: altResult.data, error: null };
    }
  }
  
  // 모든 시도가 실패한 경우
  console.error(`[학생 그룹 분석 API] ${tableName} 테이블 조회 실패`);
  return { data: null, error: singularResult.error };
}

// 추가 데이터 수집 함수
async function collectAdditionalData(classId: string, studentIds: string[], supabase: any) {
  try {
    // 학급에 속한 모든 설문지 조회
    const { data: surveys, error: surveysError } = await supabase
      .from('surveys')
      .select('*')
      .eq('class_id', classId)
      .order('created_at', { ascending: false }); // 최신 설문지 우선
    
    if (surveysError) {
      console.error('[학생 그룹 분석 API] 설문지 목록 조회 오류:', surveysError);
      return { surveys: [] };
    }
    
    // 설문지가 없는 경우
    if (!surveys || surveys.length === 0) {
      return { surveys: [] };
    }
    
    // 각 설문지별로 추가 데이터 수집
    const surveyData = await Promise.all(surveys.map(async (survey: any) => {
      // 설문지별 관계 데이터 조회
      const { data: surveyRelationships } = await queryTable(
        supabase, 
        'relationship',
        ['class_id', classId]
      );
      
      // 설문지별 질문 조회
      const { data: surveyQuestions } = await queryTable(
        supabase,
        'question',
        ['survey_id', survey.id]
      );
      
      // 설문지별 답변 조회
      const { data: surveyAnswers } = await supabase
        .from('answers')
        .select('*')
        .eq('survey_id', survey.id)
        .in('student_id', studentIds);
      
      return {
        survey,
        relationships: surveyRelationships || [],
        questions: surveyQuestions || [],
        answers: surveyAnswers || []
      };
    }));
    
    return {
      surveys: surveys || [],
      surveyData: surveyData || []
    };
  } catch (error) {
    console.error('[학생 그룹 분석 API] 추가 데이터 수집 중 오류:', error);
    return { surveys: [] };
  }
}

export const dynamic = 'force-dynamic'; // 라우트를 동적으로 설정

// 학생 그룹별 분석 API
export async function POST(
  request: NextRequest,
  context: any
) {
  try {
    const classId = context.params.classId;
    console.log('[학생 그룹 분석 API] 분석 시작, classId:', classId);
    
    // Supabase 클라이언트 생성
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });
    console.log('[학생 그룹 분석 API] Supabase 클라이언트 생성됨');
    
    // 테이블 목록 조회하여 디버깅에 사용
    console.log('[학생 그룹 분석 API] 테이블 구조 확인 시도');
    
    // 직접 쿼리로 테이블 목록 확인
    const { data: tableData, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');
    
    if (tableError) {
      console.error('[학생 그룹 분석 API] 테이블 정보 조회 실패:', tableError);
    } else {
      console.log('[학생 그룹 분석 API] 테이블 목록:', tableData);
    }
    
    // 인증 확인
    console.log('[학생 그룹 분석 API] 인증 세션 확인 시작');
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError) {
      console.error('[학생 그룹 분석 API] 인증 오류:', authError);
      return NextResponse.json(
        { error: '인증되지 않은 사용자입니다.' },
        { status: 401 }
      );
    }
    
    if (!session) {
      console.error('[학생 그룹 분석 API] 세션이 존재하지 않음');
      return NextResponse.json(
        { error: '인증되지 않은 사용자입니다.' },
        { status: 401 }
      );
    }
    console.log('[학생 그룹 분석 API] 인증 확인 완료, 사용자 ID:', session.user.id);
    
    // URL에서 그룹 인덱스 파라미터 가져오기 
    const { searchParams } = new URL(request.url);
    const groupIndex = parseInt(searchParams.get('group') || '1');
    
    // 유효한 그룹 인덱스 확인 (1-8)
    if (groupIndex < 1 || groupIndex > 8) {
      return NextResponse.json(
        { error: '유효하지 않은 그룹 인덱스입니다. 1에서 8 사이의 값이어야 합니다.' }, 
        { status: 400 }
      );
    }
    
    // 세션 ID 가져오기 (있는 경우)
    const sessionId = searchParams.get('sessionId') || generateUUID();
    
    // 요청 본문에서 model 추출
    const requestData = await request.json().catch(() => ({}));
    const model = requestData.model || 'gpt'; // 기본값은 gpt
    console.log('[학생 그룹 분석 API] 선택된 모델:', model);
    
    // 학급 존재 확인
    console.log('[학생 그룹 분석 API] 학급 정보 조회 시작:', classId);
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('*')
      .eq('id', classId)
      .single();
    
    if (classError) {
      console.error('[학생 그룹 분석 API] 학급 정보 조회 오류:', classError);
      
      // 직접 학급 정보 쿼리를 수정하여 시도
      const { data: classesTest, error: classesTestError } = await supabase
        .from('classes')
        .select('id, name')
        .limit(5);
        
      if (classesTestError) {
        console.error('[학생 그룹 분석 API] 학급 테이블 테스트 실패:', classesTestError);
      } else {
        console.log('[학생 그룹 분석 API] 학급 테이블 테스트 결과:', classesTest);
      }
      
      return NextResponse.json(
        { error: '학급을 찾을 수 없습니다.' }, 
        { status: 404 }
      );
    }
    
    if (!classData) {
      console.error('[학생 그룹 분석 API] 학급 데이터가 빈값입니다.');
      return NextResponse.json(
        { error: '학급 정보를 찾을 수 없습니다.' }, 
        { status: 404 }
      );
    }

    // 🌟 데모 학급이 아닌 경우에만 소유권 확인
    if (!isDemoClass(classData) && classData.user_id !== session.user.id) {
      console.log('[학생 그룹 분석 API] 권한 없음. 학급 소유자:', classData.user_id, '요청자:', session.user.id);
      return NextResponse.json(
        { error: '학급에 대한 권한이 없습니다.' },
        { status: 403 }
      );
    }
    console.log('[학생 그룹 분석 API] 학급 권한 확인 완료 (데모 학급:', isDemoClass(classData), ')');
    
    // 학생 목록 가져오기
    let allStudents;
    
    // 학생 테이블 조회
    const { data: students, error: studentsError } = await queryTable(
      supabase,
      'student',
      ['class_id', classId]
    );
    
    allStudents = students;
    
    // 학생 데이터 조회 실패
    if (!allStudents || studentsError) {
      console.error('[학생 그룹 분석 API] 학생 목록 조회 오류:', studentsError);
      return NextResponse.json(
        { error: '학생 목록을 가져오는 중 오류가 발생했습니다.' }, 
        { status: 500 }
      );
    }
    
    // 학생이 없는 경우
    if (allStudents.length === 0) {
      return NextResponse.json(
        { error: '분석할 학생이 없습니다.' }, 
        { status: 400 }
      );
    }
    
    // 학생 정렬
    allStudents.sort((a: any, b: any) => {
      // 먼저 display_order로 정렬
      if (a.display_order !== undefined && b.display_order !== undefined) {
        return a.display_order - b.display_order;
      }
      // display_order가 없으면 created_at으로 정렬
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
    
    // 학생을 8개 그룹으로 나누기 (각 그룹당 최대 5명)
    const studentsPerGroup = 5; // 각 그룹당 5명의 학생
    const startIndex = (groupIndex - 1) * studentsPerGroup;
    const endIndex = startIndex + studentsPerGroup;
    const groupStudents = allStudents.slice(startIndex, endIndex);
    
    // 해당 그룹에 학생이 없는 경우
    if (groupStudents.length === 0) {
      console.log(`[학생 그룹 분석 API] 그룹 ${groupIndex}에 학생이 없습니다.`);
      
      // 빈 분석 결과 저장
      const { data: emptyAnalysis, error: insertError } = await supabase
        .from('analysis_results')
        .insert({
          class_id: classId,
          result_data: `# 학생 그룹 ${groupIndex} 분석\n\n이 그룹에 해당하는 학생이 없습니다.`,
          summary: '',
          type: `students-${groupIndex}`,
          session_id: sessionId
        })
        .select()
        .single();
      
      if (insertError) {
        console.error(`[학생 그룹 분석 API] 빈 분석 결과 저장 오류:`, insertError);
        return NextResponse.json(
          { error: '분석 결과를 저장하는 중 오류가 발생했습니다.' }, 
          { status: 500 }
        );
      }
      
      return NextResponse.json(emptyAnalysis);
    }
    
    // 학급 관계 데이터 가져오기
    const { data: relationships } = await queryTable(
      supabase,
      'relationship',
      ['class_id', classId]
    );
    
    // 학생 ID 목록 추출
    const studentIds = groupStudents.map((s: Student) => s.id);
    
    // 추가 데이터 수집
    const additionalData = await collectAdditionalData(classId, studentIds, supabase);
    
    // AI 분석 실행 (선택된 모델에 따라)
    try {
      console.log('[학생 그룹 분석 API] AI 분석 시작, 선택된 모델:', model);
      
      // 환경 변수 확인
      if (model === 'gpt' && !process.env.OPENAI_API_KEY) {
        console.error('[학생 그룹 분석 API] OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.');
        return NextResponse.json(
          { error: 'OpenAI API 키가 설정되지 않았습니다. 환경 변수를 확인해주세요.' },
          { status: 500 }
        );
      }
      
      if (model === 'gemini-flash' && !process.env.GEMINI_API_KEY) {
        console.error('[학생 그룹 분석 API] GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.');
        return NextResponse.json(
          { error: 'Gemini API 키가 설정되지 않았습니다. 환경 변수를 확인해주세요.' },
          { status: 500 }
        );
      }
      
      console.log('[학생 그룹 분석 API] 환경 변수 확인 완료');
      
      let analysisResult;
      if (model === 'gemini-flash') {
        analysisResult = await analyzeStudentGroupWithGemini(
          groupStudents, // 현재 그룹에 속한 학생들만 전달
          relationships || [],
          groupIndex,
          (additionalData?.surveyData || []).map((data: any) => data.answers || []).flat() || [],
          (additionalData?.surveyData || []).map((data: any) => data.questions || []).flat() || [],
          {
            classDetails: classData,
            allStudents: allStudents, // 전체 학생 목록 전달
            ...additionalData
          }
        );
      } else {
        analysisResult = await analyzeStudentGroup(
          groupStudents, // 현재 그룹에 속한 학생들만 전달
          relationships || [],
          groupIndex,
          (additionalData?.surveyData || []).map((data: any) => data.answers || []).flat() || [],
          (additionalData?.surveyData || []).map((data: any) => data.questions || []).flat() || [],
          {
            classDetails: classData,
            allStudents: allStudents, // 전체 학생 목록 전달
            ...additionalData
          }
        );
      }
      
      // 요약 필드를 빈 문자열로 설정하여 사용자가 직접 입력하도록 유도
      let summary = '';
      
      // 분석 결과 저장
      const { data: newAnalysis, error: insertError } = await supabase
        .from('analysis_results')
        .insert({
          class_id: classId,
          result_data: analysisResult,
          summary: summary,
          type: `students-${groupIndex}`,
          session_id: sessionId
        })
        .select()
        .single();
      
      if (insertError) {
        console.error(`[학생 그룹 분석 API] 분석 결과 저장 오류:`, insertError);
        return NextResponse.json(
          { error: '분석 결과를 저장하는 중 오류가 발생했습니다.' }, 
          { status: 500 }
        );
      }
      
      return NextResponse.json(newAnalysis);
    } catch (error) {
      console.error(`[학생 그룹 분석 API] AI 분석 오류 (모델: ${model}):`, error);
      return NextResponse.json(
        { error: `AI 분석 중 오류가 발생했습니다 (모델: ${model})` }, 
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[학생 그룹 분석 API] 예외 발생:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' }, 
      { status: 500 }
    );
  }
} 