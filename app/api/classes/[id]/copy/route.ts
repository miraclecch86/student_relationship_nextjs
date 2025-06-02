import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

// Demo 학급 체크 함수 (utils에서 가져오는 대신 여기서 정의)
function isDemoClass(classData: any): boolean {
  return classData?.is_demo === true && classData?.is_public === true;
}

/**
 * 데모 학급 복사 API
 * POST /api/classes/[id]/copy
 */
export async function POST(
  request: NextRequest,
  context: any
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const classId = context.params.id;
    
    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }
    
    // 요청 본문에서 새 학급명 추출
    const body = await request.json();
    const newClassName = body.name;
    
    // 원본 학급 정보 조회
    const { data: originalClass, error: classError } = await (supabase as any)
      .from('classes')
      .select('*')
      .eq('id', classId)
      .single();
      
    if (classError || !originalClass) {
      return NextResponse.json(
        { error: '학급을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
    // 데모 학급인지 확인
    if (!isDemoClass(originalClass)) {
      return NextResponse.json(
        { error: '데모 학급만 복사할 수 있습니다.' },
        { status: 400 }
      );
    }
    
    // 1. 새 학급 생성
    const { data: newClass, error: newClassError } = await (supabase as any)
      .from('classes')
      .insert({
        name: newClassName || `${originalClass.name} (복사본)`,
        user_id: user.id,
        is_demo: false,
        is_public: false
      })
      .select()
      .single();
      
    if (newClassError) {
      return NextResponse.json(
        { error: `학급 생성 실패: ${newClassError.message}` },
        { status: 500 }
      );
    }
    
    // 2. 학생 데이터 복사
    const { data: originalStudents, error: studentsError } = await (supabase as any)
      .from('students')
      .select('*')
      .eq('class_id', classId)
      .order('display_order');
      
    if (studentsError) {
      throw new Error(`학생 데이터 조회 실패: ${studentsError.message}`);
    }
    
    const studentsData = originalStudents.map((student: any) => ({
      class_id: newClass.id,
      name: student.name,
      gender: student.gender,
      position_x: student.position_x,
      position_y: student.position_y,
      display_order: student.display_order
    }));
    
    const { data: newStudents, error: insertStudentsError } = await (supabase as any)
      .from('students')
      .insert(studentsData)
      .select();
      
    if (insertStudentsError) {
      throw new Error(`학생 데이터 복사 실패: ${insertStudentsError.message}`);
    }
    
    // 3. 설문 데이터 복사
    const { data: originalSurveys, error: surveysError } = await (supabase as any)
      .from('surveys')
      .select('*')
      .eq('class_id', classId)
      .order('created_at');
      
    if (surveysError) {
      throw new Error(`설문 데이터 조회 실패: ${surveysError.message}`);
    }
    
    const surveysData = originalSurveys.map((survey: any) => ({
      class_id: newClass.id,
      name: survey.name,
      description: survey.description
    }));
    
    const { data: newSurveys, error: insertSurveysError } = await (supabase as any)
      .from('surveys')
      .insert(surveysData)
      .select();
      
    if (insertSurveysError) {
      throw new Error(`설문 데이터 복사 실패: ${insertSurveysError.message}`);
    }
    
    // 4. 질문 데이터 복사
    const { data: originalQuestions, error: questionsError } = await (supabase as any)
      .from('questions')
      .select('*')
      .eq('class_id', classId);
      
    if (questionsError) {
      throw new Error(`질문 데이터 조회 실패: ${questionsError.message}`);
    }
    
    // 설문 ID 매핑
    const surveyIdMap: Record<string, string> = {};
    for (let i = 0; i < originalSurveys.length; i++) {
      surveyIdMap[originalSurveys[i].id] = newSurveys[i].id;
    }
    
    const questionsData = originalQuestions.map((question: any) => ({
      class_id: newClass.id,
      survey_id: question.survey_id ? surveyIdMap[question.survey_id] : null,
      question_text: question.question_text
    }));
    
    const { data: newQuestions, error: insertQuestionsError } = await (supabase as any)
      .from('questions')
      .insert(questionsData)
      .select();
      
    if (insertQuestionsError) {
      throw new Error(`질문 데이터 복사 실패: ${insertQuestionsError.message}`);
    }
    
    // 5. 관계 데이터 복사 (배치 처리)
    let relationCount = 0;
    const batchSize = 500; // 웹 환경에서는 더 작은 배치 사용
    let from = 0;
    
    // 학생 ID 매핑
    const studentIdMap: Record<string, string> = {};
    for (let i = 0; i < originalStudents.length; i++) {
      studentIdMap[originalStudents[i].id] = newStudents[i].id;
    }
    
    while (true) {
      const { data: relationsBatch, error: relationsError } = await (supabase as any)
        .from('relations')
        .select('*')
        .in('from_student_id', originalStudents.map((s: any) => s.id))
        .range(from, from + batchSize - 1);
        
      if (relationsError) {
        throw new Error(`관계 데이터 조회 실패: ${relationsError.message}`);
      }
      
      if (relationsBatch.length === 0) break;
      
      const relationsData = relationsBatch.map((relation: any) => ({
        from_student_id: studentIdMap[relation.from_student_id],
        to_student_id: studentIdMap[relation.to_student_id],
        relation_type: relation.relation_type,
        survey_id: surveyIdMap[relation.survey_id]
      }));
      
      const { error: insertRelationsError } = await (supabase as any)
        .from('relations')
        .insert(relationsData);
        
      if (insertRelationsError) {
        throw new Error(`관계 데이터 복사 실패: ${insertRelationsError.message}`);
      }
      
      relationCount += relationsBatch.length;
      from += batchSize;
    }
    
    // 6. 답변 데이터 복사 (배치 처리)
    let answerCount = 0;
    from = 0;
    
    // 질문 ID 매핑
    const questionIdMap: Record<string, string> = {};
    for (let i = 0; i < originalQuestions.length; i++) {
      questionIdMap[originalQuestions[i].id] = newQuestions[i].id;
    }
    
    while (true) {
      const { data: answersBatch, error: answersError } = await (supabase as any)
        .from('answers')
        .select('*')
        .in('student_id', originalStudents.map((s: any) => s.id))
        .range(from, from + batchSize - 1);
        
      if (answersError) {
        throw new Error(`답변 데이터 조회 실패: ${answersError.message}`);
      }
      
      if (answersBatch.length === 0) break;
      
      const answersData = answersBatch.map((answer: any) => ({
        student_id: studentIdMap[answer.student_id],
        question_id: questionIdMap[answer.question_id],
        survey_id: surveyIdMap[answer.survey_id],
        answer_text: answer.answer_text
      }));
      
      const { error: insertAnswersError } = await (supabase as any)
        .from('answers')
        .insert(answersData);
        
      if (insertAnswersError) {
        throw new Error(`답변 데이터 복사 실패: ${insertAnswersError.message}`);
      }
      
      answerCount += answersBatch.length;
      from += batchSize;
    }
    
    // 성공 응답
    return NextResponse.json({
      success: true,
      message: '데모 학급이 성공적으로 복사되었습니다!',
      data: {
        newClass: {
          id: newClass.id,
          name: newClass.name
        },
        stats: {
          students: newStudents.length,
          surveys: newSurveys.length,
          questions: newQuestions.length,
          relations: relationCount,
          answers: answerCount
        }
      }
    });
    
  } catch (error) {
    console.error('데모 학급 복사 오류:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : '복사 중 오류가 발생했습니다.' 
      },
      { status: 500 }
    );
  }
} 