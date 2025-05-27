#!/usr/bin/env node

/**
 * 데모 학급 복사 스크립트
 * 
 * 공개 데모 학급을 사용자의 계정으로 복사하여
 * 자유롭게 수정하고 분석할 수 있도록 해주는 기능
 * 
 * 사용법:
 * node scripts/copy-demo-class.js [target_user_id] [new_class_name]
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// 환경 변수 로드
config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // 서비스 키 사용
);

/**
 * 데모 학급 조회
 */
async function getDemoClass() {
  console.log('🔍 데모 학급 조회 중...');
  
  const { data: demoClass, error } = await supabase
    .from('classes')
    .select('*')
    .eq('is_demo', true)
    .eq('is_public', true)
    .single();
    
  if (error) {
    throw new Error(`데모 학급 조회 실패: ${error.message}`);
  }
  
  if (!demoClass) {
    throw new Error('데모 학급을 찾을 수 없습니다.');
  }
  
  console.log(`✅ 데모 학급 발견: ${demoClass.name}`);
  return demoClass;
}

/**
 * 새 학급 생성 (복사본)
 */
async function createCopiedClass(demoClass, targetUserId, newClassName) {
  console.log('🏫 새 학급 생성 중...');
  
  const { data: newClass, error } = await supabase
    .from('classes')
    .insert({
      name: newClassName || `${demoClass.name} (복사본)`,
      user_id: targetUserId,
      is_demo: false,
      is_public: false
    })
    .select()
    .single();
    
  if (error) {
    throw new Error(`학급 생성 실패: ${error.message}`);
  }
  
  console.log(`✅ 새 학급 생성 완료: ${newClass.name} (${newClass.id})`);
  return newClass;
}

/**
 * 학생 데이터 복사
 */
async function copyStudents(demoClassId, newClassId) {
  console.log('👥 학생 데이터 복사 중...');
  
  // 원본 학생 데이터 조회
  const { data: originalStudents, error: fetchError } = await supabase
    .from('students')
    .select('*')
    .eq('class_id', demoClassId);
    
  if (fetchError) {
    throw new Error(`학생 데이터 조회 실패: ${fetchError.message}`);
  }
  
  // 새 학급으로 복사
  const studentsData = originalStudents.map(student => ({
    class_id: newClassId,
    name: student.name,
    gender: student.gender,
    position_x: student.position_x,
    position_y: student.position_y,
    display_order: student.display_order
  }));
  
  const { data: newStudents, error: insertError } = await supabase
    .from('students')
    .insert(studentsData)
    .select();
    
  if (insertError) {
    throw new Error(`학생 데이터 복사 실패: ${insertError.message}`);
  }
  
  console.log(`✅ ${newStudents.length}명 학생 복사 완료`);
  return newStudents;
}

/**
 * 설문 데이터 복사
 */
async function copySurveys(demoClassId, newClassId) {
  console.log('📋 설문 데이터 복사 중...');
  
  // 원본 설문 데이터 조회
  const { data: originalSurveys, error: fetchError } = await supabase
    .from('surveys')
    .select('*')
    .eq('class_id', demoClassId);
    
  if (fetchError) {
    throw new Error(`설문 데이터 조회 실패: ${fetchError.message}`);
  }
  
  // 새 학급으로 복사
  const surveysData = originalSurveys.map(survey => ({
    class_id: newClassId,
    name: survey.name,
    description: survey.description
  }));
  
  const { data: newSurveys, error: insertError } = await supabase
    .from('surveys')
    .insert(surveysData)
    .select();
    
  if (insertError) {
    throw new Error(`설문 데이터 복사 실패: ${insertError.message}`);
  }
  
  console.log(`✅ ${newSurveys.length}개 설문 복사 완료`);
  return newSurveys;
}

/**
 * 질문 데이터 복사 (설문 ID 매핑)
 */
async function copyQuestions(originalSurveys, newSurveys, newClassId) {
  console.log('❓ 질문 데이터 복사 중...');
  
  // 원본 질문 데이터 조회
  const { data: originalQuestions, error: fetchError } = await supabase
    .from('questions')
    .select('*')
    .eq('class_id', originalSurveys[0].class_id);
    
  if (fetchError) {
    throw new Error(`질문 데이터 조회 실패: ${fetchError.message}`);
  }
  
  // 설문 ID 매핑 테이블 생성
  const surveyIdMap = {};
  for (let i = 0; i < originalSurveys.length; i++) {
    surveyIdMap[originalSurveys[i].id] = newSurveys[i].id;
  }
  
  // 새 학급으로 복사
  const questionsData = originalQuestions.map(question => ({
    class_id: newClassId,
    survey_id: surveyIdMap[question.survey_id],
    question_text: question.question_text,
    question_type: question.question_type
  }));
  
  const { data: newQuestions, error: insertError } = await supabase
    .from('questions')
    .insert(questionsData)
    .select();
    
  if (insertError) {
    throw new Error(`질문 데이터 복사 실패: ${insertError.message}`);
  }
  
  console.log(`✅ ${newQuestions.length}개 질문 복사 완료`);
  return newQuestions;
}

/**
 * 관계 데이터 복사 (학생 ID 매핑)
 */
async function copyRelations(originalStudents, newStudents, originalSurveys, newSurveys) {
  console.log('🤝 관계 데이터 복사 중...');
  
  // 학생 ID 매핑 테이블 생성
  const studentIdMap = {};
  for (let i = 0; i < originalStudents.length; i++) {
    studentIdMap[originalStudents[i].id] = newStudents[i].id;
  }
  
  // 설문 ID 매핑 테이블 생성
  const surveyIdMap = {};
  for (let i = 0; i < originalSurveys.length; i++) {
    surveyIdMap[originalSurveys[i].id] = newSurveys[i].id;
  }
  
  // 원본 관계 데이터를 배치로 조회
  let allRelations = [];
  let from = 0;
  const batchSize = 1000;
  
  while (true) {
    const { data: relationsBatch, error } = await supabase
      .from('relations')
      .select('*')
      .in('from_student_id', originalStudents.map(s => s.id))
      .range(from, from + batchSize - 1);
      
    if (error) {
      throw new Error(`관계 데이터 조회 실패: ${error.message}`);
    }
    
    if (relationsBatch.length === 0) break;
    
    allRelations = allRelations.concat(relationsBatch);
    from += batchSize;
    
    console.log(`  📊 ${allRelations.length}개 관계 조회됨...`);
  }
  
  // 새 학급으로 복사 (배치 처리)
  console.log(`  🔄 ${allRelations.length}개 관계 복사 중...`);
  
  for (let i = 0; i < allRelations.length; i += batchSize) {
    const batch = allRelations.slice(i, i + batchSize);
    
    const relationsData = batch.map(relation => ({
      from_student_id: studentIdMap[relation.from_student_id],
      to_student_id: studentIdMap[relation.to_student_id],
      relation_type: relation.relation_type,
      survey_id: surveyIdMap[relation.survey_id]
    }));
    
    const { error: insertError } = await supabase
      .from('relations')
      .insert(relationsData);
      
    if (insertError) {
      throw new Error(`관계 데이터 복사 실패 (배치 ${Math.floor(i/batchSize) + 1}): ${insertError.message}`);
    }
    
    console.log(`  ✅ 배치 ${Math.floor(i/batchSize) + 1}/${Math.ceil(allRelations.length/batchSize)} 완료`);
  }
  
  console.log(`✅ 총 ${allRelations.length}개 관계 복사 완료`);
  return allRelations.length;
}

/**
 * 답변 데이터 복사 (학생/질문 ID 매핑)
 */
async function copyAnswers(originalStudents, newStudents, originalQuestions, newQuestions, originalSurveys, newSurveys) {
  console.log('💭 답변 데이터 복사 중...');
  
  // ID 매핑 테이블들 생성
  const studentIdMap = {};
  for (let i = 0; i < originalStudents.length; i++) {
    studentIdMap[originalStudents[i].id] = newStudents[i].id;
  }
  
  const questionIdMap = {};
  for (let i = 0; i < originalQuestions.length; i++) {
    questionIdMap[originalQuestions[i].id] = newQuestions[i].id;
  }
  
  const surveyIdMap = {};
  for (let i = 0; i < originalSurveys.length; i++) {
    surveyIdMap[originalSurveys[i].id] = newSurveys[i].id;
  }
  
  // 원본 답변 데이터를 배치로 조회
  let allAnswers = [];
  let from = 0;
  const batchSize = 1000;
  
  while (true) {
    const { data: answersBatch, error } = await supabase
      .from('answers')
      .select('*')
      .in('student_id', originalStudents.map(s => s.id))
      .range(from, from + batchSize - 1);
      
    if (error) {
      throw new Error(`답변 데이터 조회 실패: ${error.message}`);
    }
    
    if (answersBatch.length === 0) break;
    
    allAnswers = allAnswers.concat(answersBatch);
    from += batchSize;
    
    console.log(`  📊 ${allAnswers.length}개 답변 조회됨...`);
  }
  
  // 새 학급으로 복사 (배치 처리)
  console.log(`  🔄 ${allAnswers.length}개 답변 복사 중...`);
  
  for (let i = 0; i < allAnswers.length; i += batchSize) {
    const batch = allAnswers.slice(i, i + batchSize);
    
    const answersData = batch.map(answer => ({
      student_id: studentIdMap[answer.student_id],
      question_id: questionIdMap[answer.question_id],
      survey_id: surveyIdMap[answer.survey_id],
      answer_text: answer.answer_text
    }));
    
    const { error: insertError } = await supabase
      .from('answers')
      .insert(answersData);
      
    if (insertError) {
      throw new Error(`답변 데이터 복사 실패 (배치 ${Math.floor(i/batchSize) + 1}): ${insertError.message}`);
    }
    
    console.log(`  ✅ 배치 ${Math.floor(i/batchSize) + 1}/${Math.ceil(allAnswers.length/batchSize)} 완료`);
  }
  
  console.log(`✅ 총 ${allAnswers.length}개 답변 복사 완료`);
  return allAnswers.length;
}

/**
 * 메인 실행 함수
 */
async function main() {
  try {
    const targetUserId = process.argv[2];
    const newClassName = process.argv[3];
    
    if (!targetUserId) {
      console.error('❌ 사용법: node scripts/copy-demo-class.js [target_user_id] [new_class_name]');
      process.exit(1);
    }
    
    console.log('🚀 데모 학급 복사 시작!\n');
    console.log(`📋 대상 사용자: ${targetUserId}`);
    console.log(`📋 새 학급명: ${newClassName || '자동 생성'}\n`);
    
    // 1. 데모 학급 조회
    const demoClass = await getDemoClass();
    
    // 2. 새 학급 생성
    const newClass = await createCopiedClass(demoClass, targetUserId, newClassName);
    
    // 3. 원본 데이터 조회 (참조용)
    console.log('📊 원본 데이터 조회 중...');
    const { data: originalStudents } = await supabase
      .from('students')
      .select('*')
      .eq('class_id', demoClass.id)
      .order('display_order');
      
    const { data: originalSurveys } = await supabase
      .from('surveys')
      .select('*')
      .eq('class_id', demoClass.id)
      .order('created_at');
      
    const { data: originalQuestions } = await supabase
      .from('questions')
      .select('*')
      .eq('class_id', demoClass.id);
    
    // 4. 데이터 복사
    const newStudents = await copyStudents(demoClass.id, newClass.id);
    const newSurveys = await copySurveys(demoClass.id, newClass.id);
    const newQuestions = await copyQuestions(originalSurveys, newSurveys, newClass.id);
    const relationCount = await copyRelations(originalStudents, newStudents, originalSurveys, newSurveys);
    const answerCount = await copyAnswers(originalStudents, newStudents, originalQuestions, newQuestions, originalSurveys, newSurveys);
    
    console.log('\n🎉 데모 학급 복사 완료!');
    console.log(`📊 복사된 데이터:`);
    console.log(`   - 학급: ${newClass.name}`);
    console.log(`   - 학생: ${newStudents.length}명`);
    console.log(`   - 설문: ${newSurveys.length}개`);
    console.log(`   - 질문: ${newQuestions.length}개`);
    console.log(`   - 관계: ${relationCount}개`);
    console.log(`   - 답변: ${answerCount}개\n`);
    
    console.log('🌟 이제 새 학급에서 마음껏 수정하고 분석해보세요!');
    console.log(`🔗 학급 ID: ${newClass.id}`);
    
  } catch (error) {
    console.error('❌ 복사 실패:', error.message);
    process.exit(1);
  }
}

// 스크립트 실행
main(); 