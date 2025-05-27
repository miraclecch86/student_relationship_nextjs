import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 현재 파일의 디렉토리 경로를 구하기
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 환경 변수 로드 (.env.local 파일 사용)
config({ path: join(__dirname, '..', '.env.local') });

// Supabase 클라이언트 생성 (환경 변수 사용)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEMO_CLASS_ID = '62af0001-6d16-4001-86e5-e39531ec35f7';

/**
 * 데모 학급 데이터를 복사해서 새로운 테스트 학급 생성
 */
async function copyDemoDataToTestClass() {
  console.log('🔄 데모 학급 데이터 복사 시작...\n');

  try {
    // 1. 현재 사용자 확인 (로그인된 사용자로 학급 생성)
    console.log('👤 사용자 확인...');
    // 실제 사용자 ID를 입력해야 합니다. 
    // 브라우저에서 개발자 도구 > Application > Local Storage에서 supabase auth token을 확인하거나
    // 직접 입력해주세요
    const USER_ID = '2ebb3404-5034-4178-8b89-a8dedbb18e44'; // 🔧 실제 사용자 ID로 변경 필요

    // 2. 데모 학급 데이터 조회
    console.log('📊 데모 학급 데이터 조회 중...');
    
    // 학급 정보
    const { data: demoClass, error: classError } = await supabase
      .from('classes')
      .select('*')
      .eq('id', DEMO_CLASS_ID)
      .single();

    if (classError || !demoClass) {
      throw new Error(`데모 학급 조회 실패: ${classError?.message}`);
    }

    // 학생 정보
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('*')
      .eq('class_id', DEMO_CLASS_ID)
      .order('created_at');

    if (studentsError) {
      throw new Error(`학생 데이터 조회 실패: ${studentsError.message}`);
    }

    // 설문 정보
    const { data: surveys, error: surveysError } = await supabase
      .from('surveys')
      .select('*')
      .eq('class_id', DEMO_CLASS_ID)
      .order('created_at');

    if (surveysError) {
      throw new Error(`설문 데이터 조회 실패: ${surveysError.message}`);
    }

    // 질문 정보
    const { data: questions, error: questionsError } = await supabase
      .from('questions')
      .select('*')
      .eq('class_id', DEMO_CLASS_ID)
      .order('created_at');

    if (questionsError) {
      throw new Error(`질문 데이터 조회 실패: ${questionsError.message}`);
    }

    // 학생 ID 목록
    const studentIds = students.map(s => s.id);

    // 답변 정보
    const { data: answers, error: answersError } = await supabase
      .from('answers')
      .select('*')
      .in('student_id', studentIds)
      .order('created_at');

    if (answersError) {
      throw new Error(`답변 데이터 조회 실패: ${answersError.message}`);
    }

    // 관계 정보
    const { data: relations, error: relationsError } = await supabase
      .from('relations')
      .select('*')
      .in('from_student_id', studentIds)
      .in('to_student_id', studentIds)
      .order('created_at');

    if (relationsError) {
      throw new Error(`관계 데이터 조회 실패: ${relationsError.message}`);
    }

    console.log('✅ 데모 학급 데이터 조회 완료:');
    console.log(`   - 학급: ${demoClass.name}`);
    console.log(`   - 학생: ${students?.length || 0}명`);
    console.log(`   - 설문: ${surveys?.length || 0}개`);
    console.log(`   - 질문: ${questions?.length || 0}개`);
    console.log(`   - 답변: ${answers?.length || 0}개`);
    console.log(`   - 관계: ${relations?.length || 0}개`);

    // 3. 새로운 테스트 학급 생성
    console.log('\n🏫 새로운 테스트 학급 생성 중...');
    const newClassName = `${demoClass.name} (AI 테스트용) - ${new Date().toISOString().slice(0, 19)}`;
    
    const { data: newClass, error: newClassError } = await supabase
      .from('classes')
      .insert([{
        name: newClassName,
        user_id: USER_ID,
        is_demo: false,
        is_public: false
      }])
      .select()
      .single();

    if (newClassError || !newClass) {
      throw new Error(`새 학급 생성 실패: ${newClassError?.message}`);
    }

    console.log(`✅ 새 학급 생성 완료: ${newClass.name} (ID: ${newClass.id})`);

    // 4. 학생 데이터 복사
    console.log('\n👥 학생 데이터 복사 중...');
    const studentMapping = {}; // 기존 ID -> 새 ID 매핑
    
    if (students && students.length > 0) {
      const newStudentsData = students.map(student => ({
        name: student.name,
        class_id: newClass.id,
        gender: student.gender,
        position: student.position
      }));

      const { data: newStudents, error: newStudentsError } = await supabase
        .from('students')
        .insert(newStudentsData)
        .select();

      if (newStudentsError || !newStudents) {
        throw new Error(`학생 데이터 복사 실패: ${newStudentsError?.message}`);
      }

      // ID 매핑 생성
      students.forEach((oldStudent, index) => {
        studentMapping[oldStudent.id] = newStudents[index].id;
      });

      console.log(`✅ 학생 데이터 복사 완료: ${newStudents.length}명`);
    }

    // 5. 설문 데이터 복사
    console.log('\n📝 설문 데이터 복사 중...');
    const surveyMapping = {}; // 기존 ID -> 새 ID 매핑
    
    if (surveys && surveys.length > 0) {
      const newSurveysData = surveys.map(survey => ({
        title: survey.title,
        description: survey.description,
        class_id: newClass.id
      }));

      const { data: newSurveys, error: newSurveysError } = await supabase
        .from('surveys')
        .insert(newSurveysData)
        .select();

      if (newSurveysError || !newSurveys) {
        throw new Error(`설문 데이터 복사 실패: ${newSurveysError?.message}`);
      }

      // ID 매핑 생성
      surveys.forEach((oldSurvey, index) => {
        surveyMapping[oldSurvey.id] = newSurveys[index].id;
      });

      console.log(`✅ 설문 데이터 복사 완료: ${newSurveys.length}개`);
    }

    // 6. 질문 데이터 복사
    console.log('\n❓ 질문 데이터 복사 중...');
    const questionMapping = {}; // 기존 ID -> 새 ID 매핑
    
    if (questions && questions.length > 0) {
      const newQuestionsData = questions.map(question => ({
        content: question.content,
        type: question.type,
        class_id: newClass.id,
        survey_id: question.survey_id ? surveyMapping[question.survey_id] : null,
        order_index: question.order_index
      }));

      const { data: newQuestions, error: newQuestionsError } = await supabase
        .from('questions')
        .insert(newQuestionsData)
        .select();

      if (newQuestionsError || !newQuestions) {
        throw new Error(`질문 데이터 복사 실패: ${newQuestionsError?.message}`);
      }

      // ID 매핑 생성
      questions.forEach((oldQuestion, index) => {
        questionMapping[oldQuestion.id] = newQuestions[index].id;
      });

      console.log(`✅ 질문 데이터 복사 완료: ${newQuestions.length}개`);
    }

    // 7. 답변 데이터 복사
    console.log('\n💬 답변 데이터 복사 중...');
    
    if (answers && answers.length > 0) {
      const newAnswersData = answers.map(answer => ({
        content: answer.content,
        student_id: studentMapping[answer.student_id],
        question_id: questionMapping[answer.question_id],
        survey_id: answer.survey_id ? surveyMapping[answer.survey_id] : null
      }));

      const { data: newAnswers, error: newAnswersError } = await supabase
        .from('answers')
        .insert(newAnswersData)
        .select();

      if (newAnswersError || !newAnswers) {
        throw new Error(`답변 데이터 복사 실패: ${newAnswersError?.message}`);
      }

      console.log(`✅ 답변 데이터 복사 완료: ${newAnswers.length}개`);
    }

    // 8. 관계 데이터 복사
    console.log('\n🔗 관계 데이터 복사 중...');
    
    if (relations && relations.length > 0) {
      const newRelationsData = relations.map(relation => ({
        from_student_id: studentMapping[relation.from_student_id],
        to_student_id: studentMapping[relation.to_student_id],
        relation_type: relation.relation_type,
        survey_id: relation.survey_id ? surveyMapping[relation.survey_id] : null,
        question_id: relation.question_id ? questionMapping[relation.question_id] : null
      }));

      const { data: newRelations, error: newRelationsError } = await supabase
        .from('relations')
        .insert(newRelationsData)
        .select();

      if (newRelationsError || !newRelations) {
        throw new Error(`관계 데이터 복사 실패: ${newRelationsError?.message}`);
      }

      console.log(`✅ 관계 데이터 복사 완료: ${newRelations.length}개`);
    }

    console.log('\n🎉 데모 데이터 복사 완료!');
    console.log('📋 생성된 테스트 학급 정보:');
    console.log(`   - 학급 ID: ${newClass.id}`);
    console.log(`   - 학급 이름: ${newClass.name}`);
    console.log(`   - 접속 URL: http://localhost:3000/class/${newClass.id}/dashboard`);
    console.log(`   - 분석 페이지: http://localhost:3000/class/${newClass.id}/analysis`);
    console.log(`   - 생활기록부 페이지: http://localhost:3000/class/${newClass.id}/schoolrecord`);
    console.log('\n💡 이제 이 학급에서 실제 AI 분석을 테스트해보세요!');

  } catch (error) {
    console.error('❌ 데모 데이터 복사 실패:', error);
  }
}

// 스크립트 실행
copyDemoDataToTestClass(); 