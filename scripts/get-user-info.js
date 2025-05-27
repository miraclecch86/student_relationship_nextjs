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
 * 모든 사용자 정보 조회 (가장 최근 사용자가 본인일 가능성이 높음)
 */
async function getUserInfo() {
  console.log('👤 사용자 정보 조회 중...\n');

  try {
    // 모든 사용자 조회 (생성일 기준 내림차순)
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (usersError) {
      console.error('❌ 사용자 조회 실패:', usersError);
      return;
    }

    if (!users || users.length === 0) {
      console.log('❌ 등록된 사용자가 없습니다.');
      return;
    }

    console.log('📋 등록된 사용자 목록:');
    users.forEach((user, index) => {
      console.log(`${index + 1}. ID: ${user.id}`);
      console.log(`   이메일: ${user.email || '미설정'}`);
      console.log(`   이름: ${user.full_name || '미설정'}`);
      console.log(`   생성일: ${user.created_at}`);
      console.log('');
    });

    // 가장 최근 사용자 추천
    const latestUser = users[0];
    console.log('💡 권장사항:');
    console.log(`가장 최근에 가입한 사용자를 사용하는 것을 추천합니다:`);
    console.log(`USER_ID = '${latestUser.id}'`);
    console.log('');
    console.log('scripts/copy-demo-data.js 파일의 USER_ID 변수를 위 값으로 수정해주세요.');

  } catch (error) {
    console.error('❌ 오류 발생:', error);
  }
}

// 스크립트 실행
getUserInfo(); 