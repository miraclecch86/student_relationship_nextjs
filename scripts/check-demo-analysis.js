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
 * 데모 분석 결과 확인
 */
async function checkDemoAnalysis() {
  console.log('🔍 데모 학급 분석 결과 확인 중...\n');

  try {
    // 1. 분석 결과 확인
    const { data: analysisResults, error: analysisError } = await supabase
      .from('analysis_results')
      .select('*')
      .eq('class_id', DEMO_CLASS_ID)
      .order('created_at', { ascending: false });

    if (analysisError) {
      console.error('❌ 분석 결과 조회 실패:', analysisError);
      return;
    }

    console.log(`📊 분석 결과: ${analysisResults?.length || 0}개`);
    if (analysisResults && analysisResults.length > 0) {
      analysisResults.forEach((result, index) => {
        console.log(`   ${index + 1}. Type: ${result.type}, Session: ${result.session_id}`);
        console.log(`      ID: ${result.id}`);
        console.log(`      Summary: ${result.summary?.substring(0, 50)}...`);
        console.log(`      Created: ${result.created_at}`);
      });
    }

    // 2. 생활기록부 확인
    const { data: schoolRecords, error: recordError } = await supabase
      .from('school_records')
      .select('*')
      .eq('class_id', DEMO_CLASS_ID)
      .order('created_at', { ascending: false });

    if (recordError) {
      console.error('❌ 생활기록부 조회 실패:', recordError);
      return;
    }

    console.log(`\n📝 생활기록부: ${schoolRecords?.length || 0}개`);
    if (schoolRecords && schoolRecords.length > 0) {
      schoolRecords.forEach((record, index) => {
        console.log(`   ${index + 1}. ID: ${record.id}`);
        console.log(`      Summary: ${record.summary?.substring(0, 50)}...`);
        console.log(`      Created: ${record.created_at}`);
      });
    }

    // 3. 학급 정보 확인
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('*')
      .eq('id', DEMO_CLASS_ID)
      .single();

    if (classError) {
      console.error('❌ 학급 정보 조회 실패:', classError);
      return;
    }

    console.log(`\n🏫 학급 정보:`);
    console.log(`   이름: ${classData.name}`);
    console.log(`   데모: ${classData.is_demo}`);
    console.log(`   공개: ${classData.is_public}`);
    console.log(`   소유자: ${classData.user_id}`);

  } catch (error) {
    console.error('❌ 전체 과정 실패:', error);
  }
}

// 스크립트 실행
checkDemoAnalysis(); 