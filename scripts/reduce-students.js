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

/**
 * 학급의 학생 수를 줄여서 토큰 사용량 최적화
 */
async function reduceStudents(classId, targetCount = 20) {
  console.log(`🔄 학급 ${classId}의 학생 수를 ${targetCount}명으로 줄이기 시작...`);
  
  try {
    // 1. 현재 학생 목록 조회 (display_order 순)
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, name, display_order')
      .eq('class_id', classId)
      .order('display_order', { ascending: true });
      
    if (studentsError) {
      throw new Error(`학생 목록 조회 실패: ${studentsError.message}`);
    }
    
    console.log(`📊 현재 학생 수: ${students.length}명`);
    
    if (students.length <= targetCount) {
      console.log(`✅ 이미 ${targetCount}명 이하입니다. 작업을 건너뜁니다.`);
      return;
    }
    
    // 2. 제거할 학생들 선택 (뒤쪽부터)
    const studentsToKeep = students.slice(0, targetCount);
    const studentsToRemove = students.slice(targetCount);
    
    console.log(`📝 유지할 학생: ${studentsToKeep.length}명`);
    console.log(`🗑️ 제거할 학생: ${studentsToRemove.length}명`);
    
    const studentIdsToRemove = studentsToRemove.map(s => s.id);
    
    // 3. 관련 데이터 삭제 (순서 중요!)
    
    // 3-1. 답변 데이터 삭제
    console.log('🗑️ 답변 데이터 삭제 중...');
    const { error: answersError } = await supabase
      .from('answers')
      .delete()
      .in('student_id', studentIdsToRemove);
      
    if (answersError) {
      throw new Error(`답변 데이터 삭제 실패: ${answersError.message}`);
    }
    
    // 3-2. 관계 데이터 삭제 (from_student_id 또는 to_student_id가 해당하는 경우)
    console.log('🗑️ 관계 데이터 삭제 중...');
    const { error: relationsError1 } = await supabase
      .from('relations')
      .delete()
      .in('from_student_id', studentIdsToRemove);
      
    if (relationsError1) {
      throw new Error(`관계 데이터 삭제 실패 (from): ${relationsError1.message}`);
    }
    
    const { error: relationsError2 } = await supabase
      .from('relations')
      .delete()
      .in('to_student_id', studentIdsToRemove);
      
    if (relationsError2) {
      throw new Error(`관계 데이터 삭제 실패 (to): ${relationsError2.message}`);
    }
    
    // 3-3. 학생 데이터 삭제
    console.log('🗑️ 학생 데이터 삭제 중...');
    const { error: studentsDeleteError } = await supabase
      .from('students')
      .delete()
      .in('id', studentIdsToRemove);
      
    if (studentsDeleteError) {
      throw new Error(`학생 데이터 삭제 실패: ${studentsDeleteError.message}`);
    }
    
    console.log(`✅ 학생 수가 ${students.length}명에서 ${targetCount}명으로 줄어들었습니다!`);
    console.log('🔧 이제 AI 분석 시 토큰 사용량이 줄어들 것입니다.');
    
  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
    throw error;
  }
}

// 스크립트 실행
if (process.argv.length < 3) {
  console.log('사용법: node reduce-students.js <학급ID> [목표학생수]');
  console.log('예시: node reduce-students.js abc-123-def 20');
  process.exit(1);
}

const classId = process.argv[2];
const targetCount = process.argv[3] ? parseInt(process.argv[3]) : 20;

reduceStudents(classId, targetCount)
  .then(() => {
    console.log('🎉 작업 완료!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 작업 실패:', error);
    process.exit(1);
  }); 