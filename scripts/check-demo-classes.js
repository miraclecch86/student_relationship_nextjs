#!/usr/bin/env node

/**
 * 데모 학급 상태 확인 스크립트
 * 중복된 데모 학급이 있는지 확인하고 정리합니다.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 환경 변수 로드
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env.local');
config({ path: envPath });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * 데모 학급들 조회 및 분석
 */
async function checkDemoClasses() {
  console.log('🔍 데모 학급 상태 확인 중...\n');

  // 모든 데모 학급 조회
  const { data: demoClasses, error } = await supabase
    .from('classes')
    .select('*')
    .eq('is_demo', true)
    .eq('is_public', true)
    .order('created_at');

  if (error) {
    console.error('❌ 데모 학급 조회 실패:', error);
    return;
  }

  console.log(`📊 총 ${demoClasses.length}개의 데모 학급 발견\n`);

  // 각 데모 학급의 상세 정보 조회
  for (let i = 0; i < demoClasses.length; i++) {
    const cls = demoClasses[i];
    console.log(`🏫 데모 학급 #${i + 1}:`);
    console.log(`   ID: ${cls.id}`);
    console.log(`   이름: ${cls.name}`);
    console.log(`   생성일: ${cls.created_at}`);
    console.log(`   사용자 ID: ${cls.user_id}`);

    // 학생 수 확인
    const { count: studentCount } = await supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('class_id', cls.id);

    // 설문 수 확인
    const { count: surveyCount } = await supabase
      .from('surveys')
      .select('id', { count: 'exact', head: true })
      .eq('class_id', cls.id);

    // 관계 수 확인 (수정된 쿼리)
    const surveyIds = await getSurveyIds(cls.id);
    let relationCount = 0;
    let answerCount = 0;

    if (surveyIds.length > 0) {
      // 관계 수 확인
      const { count: relCount } = await supabase
        .from('relations')
        .select('id', { count: 'exact', head: true })
        .in('survey_id', surveyIds);
      
      relationCount = relCount || 0;

      // 답변 수 확인
      const { count: ansCount } = await supabase
        .from('answers')
        .select('id', { count: 'exact', head: true })
        .in('survey_id', surveyIds);
      
      answerCount = ansCount || 0;
    }

    console.log(`   학생: ${studentCount}명`);
    console.log(`   설문: ${surveyCount}개`);
    console.log(`   설문 ID들: [${surveyIds.join(', ')}]`);
    console.log(`   관계: ${relationCount}개`);
    console.log(`   답변: ${answerCount}개`);
    console.log('');
  }

  return demoClasses;
}

/**
 * 특정 학급의 설문 ID들 조회
 */
async function getSurveyIds(classId) {
  const { data: surveys } = await supabase
    .from('surveys')
    .select('id')
    .eq('class_id', classId);
  
  return surveys?.map(s => s.id) || [];
}

/**
 * 중복된 데모 학급 삭제
 */
async function cleanupDuplicateDemoClasses() {
  console.log('🧹 중복된 데모 학급 정리 중...\n');

  const demoClasses = await checkDemoClasses();
  
  if (demoClasses.length <= 1) {
    console.log('✅ 중복된 데모 학급이 없습니다.');
    return;
  }

  // 첫 번째(오래된) 것을 남기고 나머지 삭제 (사용자가 첫 번째가 괜찮다고 함)
  const toKeep = demoClasses[0]; // 첫 번째 (가장 오래된) 것 보존
  const toDelete = demoClasses.slice(1); // 나머지 삭제

  console.log(`🎯 보존할 데모 학급: ${toKeep.name} (${toKeep.id}) - 생성일: ${toKeep.created_at}`);
  console.log(`🗑️  삭제할 데모 학급: ${toDelete.length}개\n`);

  for (const cls of toDelete) {
    console.log(`🗑️  삭제 중: ${cls.name} (${cls.id})`);
    
    try {
      // RPC 함수로 학급 및 모든 관련 데이터 삭제
      const { error } = await supabase.rpc('delete_class', { 
        class_id_to_delete: cls.id 
      });

      if (error) {
        console.error(`   ❌ 삭제 실패: ${error.message}`);
      } else {
        console.log(`   ✅ 삭제 완료`);
      }
    } catch (error) {
      console.error(`   ❌ 삭제 중 오류: ${error.message}`);
    }
  }

  console.log('\n🎉 데모 학급 정리 완료!');
}

/**
 * 메인 실행 함수
 */
async function main() {
  try {
    const args = process.argv.slice(2);
    
    if (args.includes('--cleanup')) {
      await cleanupDuplicateDemoClasses();
    } else {
      await checkDemoClasses();
      console.log('💡 중복된 데모 학급을 삭제하려면 다음 명령어를 실행하세요:');
      console.log('   node scripts/check-demo-classes.js --cleanup');
    }
  } catch (error) {
    console.error('❌ 스크립트 실행 실패:', error);
    process.exit(1);
  }
}

main(); 