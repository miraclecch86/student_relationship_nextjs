#!/usr/bin/env node

/**
 * 데모 학급 데이터 생성 스크립트
 * 
 * 기반 문서:
 * - GENERATE_DATA_PRD.md: 데이터 생성 규칙과 로직
 * - EXAMPLE_CLASS_DATA_DRAFT.md: 구체적 스토리와 예시
 * 
 * 사용법:
 * node scripts/generate-demo-data.js
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 현재 파일의 디렉토리를 기준으로 .env.local 파일 경로 설정
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env.local');

// 환경 변수 로드 (명시적 경로 지정)
config({ path: envPath });

// 환경 변수 검증
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL이 설정되지 않았습니다.');
  console.error('📋 .env.local 파일을 확인해주세요.');
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.');
  console.error('📋 Supabase 대시보드에서 service_role 키를 복사하여 .env.local에 추가해주세요.');
  process.exit(1);
}

console.log('✅ 환경 변수 로드 완료');
console.log(`🔗 Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
console.log(`🔑 Service Role Key: ${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}...`);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // 서비스 키 사용 (RLS 우회)
);

// 📊 학생 데이터 (Draft 파일 기반)
const STUDENTS = [
  { id: 1, name: "김민준", gender: "남", traits: ["활발함", "장난기", "리더십"] },
  { id: 2, name: "이서아", gender: "여", traits: ["조용함", "신중함", "배려"] },
  { id: 3, name: "박도윤", gender: "남", traits: ["사교적", "긍정적", "운동"] },
  { id: 4, name: "최지우", gender: "여", traits: ["예술적", "섬세함", "상상력"] },
  { id: 5, name: "정시우", gender: "남", traits: ["호기심", "지적", "분석적"] },
  { id: 6, name: "윤하은", gender: "여", traits: ["털털함", "유머", "사교적"] },
  { id: 7, name: "강지호", gender: "남", traits: ["내성적", "독서", "관찰"] },
  { id: 8, name: "백서윤", gender: "여", traits: ["야무짐", "책임감", "논리적"] },
  { id: 9, name: "신준서", gender: "남", traits: ["승부욕", "활동적", "단순함"] },
  { id: 10, name: "송아린", gender: "여", traits: ["감수성", "다정함", "눈물"] },
  { id: 11, name: "한지안", gender: "남", traits: ["엉뚱함", "창의적", "만들기"] },
  { id: 12, name: "임나윤", gender: "여", traits: ["꼼꼼함", "계획적", "모범생"] },
  { id: 13, name: "서예준", gender: "남", traits: ["수줍음", "친절함", "동물"] },
  { id: 14, name: "문채원", gender: "여", traits: ["자기주장", "똑부러짐", "직설"] },
  { id: 15, name: "오주원", gender: "남", traits: ["느긋함", "긍정적", "식탐"] },
  { id: 16, name: "황지민", gender: "여", traits: ["호기심", "새로움", "명랑함"] },
  { id: 17, name: "장건우", gender: "남", traits: ["정의감", "우정", "씩씩함"] },
  { id: 18, name: "안소율", gender: "여", traits: ["차분함", "깊이", "어른스러움"] },
  { id: 19, name: "유현우", gender: "남", traits: ["게임", "경쟁심", "유쾌함"] },
  { id: 20, name: "김다은", gender: "여", traits: ["패션", "꾸미기", "사교적"] },
  { id: 21, name: "고은우", gender: "남", traits: ["개그", "분위기메이커", "산만"] },
  { id: 22, name: "허수아", gender: "여", traits: ["예민함", "섬세함", "혼자"] },
  { id: 23, name: "문지훈", gender: "남", traits: ["운동신경", "과묵함", "듬직함"] },
  { id: 24, name: "나지아", gender: "여", traits: ["공감능력", "상담", "따뜻함"] },
  { id: 25, name: "홍성현", gender: "남", traits: ["발표", "지식", "자랑"] },
  { id: 26, name: "배지유", gender: "여", traits: ["애교", "관심끌기", "질투"] },
  { id: 27, name: "조민규", gender: "남", traits: ["과학", "상상력", "집중력"] },
  { id: 28, name: "왕하린", gender: "여", traits: ["씩씩함", "목소리큼", "리더십"] },
  { id: 29, name: "정재이", gender: "남", traits: ["그림", "조용함", "관찰"] },
  { id: 30, name: "기서현", gender: "여", traits: ["노래", "발표", "주목"] },
  { id: 31, name: "차태준", gender: "남", traits: ["만들기", "손재주", "고집"] },
  { id: 32, name: "표아윤", gender: "여", traits: ["수다", "비밀못지킴", "친화"] },
  { id: 33, name: "석지환", gender: "남", traits: ["공룡박사", "깊이", "자기세계"] },
  { id: 34, name: "엄소은", gender: "여", traits: ["글쓰기", "감성", "독서"] },
  { id: 35, name: "위준영", gender: "남", traits: ["정리정돈", "규칙", "결벽"] },
  { id: 36, name: "진예원", gender: "여", traits: ["춤", "활발함", "어울림"] },
  { id: 37, name: "변민성", gender: "남", traits: ["봉사정신", "도움", "착함"] },
  { id: 38, name: "공지안", gender: "여", traits: ["수학", "논리", "조용한도움"] },
  { id: 39, name: "방시현", gender: "남", traits: ["책임감", "어른스러움", "가족"] },
  { id: 40, name: "선아영", gender: "여", traits: ["엉뚱함", "매력", "핵심"] }
];

// 📅 월별 스토리 데이터
const MONTHLY_STORIES = {
  4: {
    theme: "새로운 시작과 탐색",
    events: ["자기소개", "자리배치", "청소당번"],
    conflicts: [],
    friendships: [[1, 3], [6, 10]],
    relationDistribution: { 친해: 8, 친해지고싶어: 15, 괜찮아: 70, 불편해: 7 }
  },
  5: {
    theme: "첫 공동 활동을 통한 관계 형성과 갈등",
    events: ["봄소풍", "장기자랑", "조별활동"],
    conflicts: [[4, 9]], // 최지우-신준서 갈등
    friendships: [[1, 3, 5], [6, 10], [13, 24], [30, 36]],
    relationDistribution: { 친해: 12, 친해지고싶어: 18, 괜찮아: 62, 불편해: 8 }
  },
  6: {
    theme: "팀워크와 경쟁을 통한 관계 심화",
    events: ["체육대회", "응원단", "팀경쟁"],
    conflicts: [[4, 9], [9, 21]], // 기존 갈등 + 신준서-고은우 새 갈등
    friendships: [[1, 28], [3, 23], [11, 31]],
    relationDistribution: { 친해: 15, 친해지고싶어: 20, 괜찮아: 55, 불편해: 10 }
  },
  7: {
    theme: "재능 발견과 다양한 친구 관계 형성",
    events: ["발표회", "재능발표", "1학기마무리"],
    conflicts: [[4, 9], [9, 21]],
    friendships: [[33, 27], [29, 34], [1, 3, 5]],
    relationDistribution: { 친해: 18, 친해지고싶어: 22, 괜찮아: 50, 불편해: 10 }
  },
  8: {
    theme: "방학 경험 공유와 새로운 자극",
    events: ["개학", "방학이야기", "새로운자리"],
    conflicts: [[4, 9]], // 일부 갈등 완화
    friendships: [[16, 20], [15, 19], [1, 3, 5]],
    relationDistribution: { 친해: 20, 친해지고싶어: 25, 괜찮아: 48, 불편해: 7 }
  },
  9: {
    theme: "리더십과 책임감, 성숙한 관계 형성",
    events: ["임원선거", "역할분담", "추석체험"],
    conflicts: [[4, 9]],
    friendships: [[1, 8], [12, 17], [37, 39]],
    relationDistribution: { 친해: 22, 친해지고싶어: 28, 괜찮아: 45, 불편해: 5 }
  },
  10: {
    theme: "협력과 갈등, 그리고 극적인 화해",
    events: ["학예회준비", "팀구성", "연습"],
    conflicts: [[14, 28]], // 문채원-왕하린 갈등 (후에 화해)
    friendships: [[6, 30], [36, 14, 28], [4, 9]], // 최지우-신준서 관계 회복 시작
    relationDistribution: { 친해: 25, 친해지고싶어: 30, 괜찮아: 40, 불편해: 5 }
  },
  11: {
    theme: "안정과 깊이, 성숙한 우정",
    events: ["독서활동", "도서정리", "단풍관찰"],
    conflicts: [],
    friendships: [[7, 34], [35, 38], [39, 37]],
    relationDistribution: { 친해: 28, 친해지고싶어: 32, 괜찮아: 38, 불편해: 2 }
  },
  12: {
    theme: "화해와 감사, 따뜻한 마무리",
    events: ["연말파티", "롤링페이퍼", "한해정리"],
    conflicts: [],
    friendships: [[4, 9], [40, 32]], // 최지우-신준서 완전 화해
    relationDistribution: { 친해: 30, 친해지고싶어: 35, 괜찮아: 35, 불편해: 0 }
  }
};

// 📝 주관식 질문들
const QUESTIONS = [
  "반에서 좋은 친구는?",
  "좋은 친구가 좋은 이유는?", 
  "반에서 불편한 친구는?",
  "불편한 친구가 불편한 이유는?",
  "선생님에 대한 학생의 생각은?"
];

// 관계 유형 매핑 (4가지 타입으로 단순화)
const RELATION_TYPES = {
  친해: "FRIENDLY",
  친해지고싶어: "WANNA_BE_CLOSE", 
  괜찮아: "NEUTRAL",
  불편해: "AWKWARD"
};

/**
 * 시스템 데모 계정 생성 또는 조회
 */
async function getOrCreateDemoAccount() {
  console.log('🔍 시스템 데모 계정 확인 중...');
  
  // 기존 데모 계정 조회
  const { data: existingUser, error: queryError } = await supabase.auth.admin.listUsers();
  
  if (queryError) {
    console.error('사용자 조회 실패:', queryError);
    throw queryError;
  }

  // 데모 계정 찾기
  const demoUser = existingUser.users.find(user => user.email === 'demo@system.local');
  
  if (demoUser) {
    console.log('✅ 기존 데모 계정 사용:', demoUser.id);
    return demoUser.id;
  }

  // 새 데모 계정 생성
  console.log('🆕 새 데모 계정 생성 중...');
  const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
    email: 'demo@system.local',
    password: 'demo-password-' + Date.now(),
    email_confirm: true,
    user_metadata: {
      name: '데모 시스템 계정',
      role: 'demo_teacher'
    }
  });

  if (createError) {
    console.error('데모 계정 생성 실패:', createError);
    throw createError;
  }

  console.log('✅ 데모 계정 생성 완료:', newUser.user.id);
  return newUser.user.id;
}

/**
 * 데모 학급 생성
 */
async function createDemoClass(userId) {
  console.log('🏫 데모 학급 생성 중...');

  const { data, error } = await supabase
    .from('classes')
    .insert({
      name: '샘솔 초등학교 3학년 1반',
      user_id: userId,
      is_demo: true,
      is_public: true
    })
    .select()
    .single();

  if (error) {
    console.error('학급 생성 실패:', error);
    throw error;
  }

  console.log('✅ 데모 학급 생성 완료:', data.id);
  return data.id;
}

/**
 * 학생 데이터 생성
 */
async function createStudents(classId) {
  console.log('👥 학생 데이터 생성 중...');

  const studentsData = STUDENTS.map((student, index) => ({
    class_id: classId,
    name: student.name,
    gender: student.gender === '남' ? 'male' : 'female',
    display_order: index + 1,
    position_x: Math.random() * 800 + 100, // 임시 좌표
    position_y: Math.random() * 600 + 100
  }));

  const { data, error } = await supabase
    .from('students')
    .insert(studentsData)
    .select();

  if (error) {
    console.error('학생 생성 실패:', error);
    throw error;
  }

  console.log(`✅ ${data.length}명 학생 생성 완료`);
  return data;
}

/**
 * 월별 설문 생성
 */
async function createSurveys(classId) {
  console.log('📋 월별 설문 생성 중...');

  const surveysData = [];
  for (let month = 4; month <= 12; month++) {
    surveysData.push({
      class_id: classId,
      name: `${month}월 관계 설문`,
      description: `${month}월 학생 관계 설문 - ${MONTHLY_STORIES[month].theme}`
    });
  }

  const { data, error } = await supabase
    .from('surveys')
    .insert(surveysData)
    .select();

  if (error) {
    console.error('설문 생성 실패:', error);
    throw error;
  }

  console.log(`✅ ${data.length}개 설문 생성 완료`);
  return data;
}

/**
 * 질문 생성
 */
async function createQuestions(classId, surveys) {
  console.log('❓ 질문 생성 중...');

  const questionsData = [];
  for (const survey of surveys) {
    for (const questionText of QUESTIONS) {
      questionsData.push({
        survey_id: survey.id,
        class_id: classId,
        question_text: questionText,
        question_type: 'open_ended'
      });
    }
  }

  const { data, error } = await supabase
    .from('questions')
    .insert(questionsData)
    .select();

  if (error) {
    console.error('질문 생성 실패:', error);
    throw error;
  }

  console.log(`✅ ${data.length}개 질문 생성 완료`);
  return data;
}

/**
 * 학생 간 관계 생성 (월별)
 */
async function generateRelations(students, surveys) {
  console.log('🤝 학생 관계 생성 중...');

  let totalRelations = 0;

  for (const survey of surveys) {
    const month = parseInt(survey.name.split('월')[0]);
    const story = MONTHLY_STORIES[month];
    
    console.log(`  📅 ${month}월 관계 생성 중... (${story.theme})`);

    const relationsData = [];

    // 각 학생에 대해 다른 모든 학생과의 관계 생성
    for (const fromStudent of students) {
      for (const toStudent of students) {
        if (fromStudent.id === toStudent.id) continue;

        const relationType = generateRelationType(
          STUDENTS.find(s => s.name === fromStudent.name),
          STUDENTS.find(s => s.name === toStudent.name),
          month,
          story
        );

        relationsData.push({
          from_student_id: fromStudent.id,
          to_student_id: toStudent.id,
          relation_type: RELATION_TYPES[relationType],
          survey_id: survey.id
        });
      }
    }

    // 배치 삽입 (1000개씩)
    for (let i = 0; i < relationsData.length; i += 1000) {
      const batch = relationsData.slice(i, i + 1000);
      const { error } = await supabase
        .from('relations')
        .insert(batch);

      if (error) {
        console.error(`${month}월 관계 생성 실패:`, error);
        throw error;
      }
    }

    totalRelations += relationsData.length;
    console.log(`  ✅ ${month}월: ${relationsData.length}개 관계 생성`);
  }

  console.log(`✅ 총 ${totalRelations}개 관계 생성 완료`);
}

/**
 * 관계 유형 생성 로직 (4가지 타입으로 단순화)
 */
function generateRelationType(fromStudent, toStudent, month, story) {
  // 기본값: 괜찮아 (NEUTRAL)
  let relationType = '괜찮아';

  // 성격 기반 친화도 계산
  const compatibility = calculateCompatibility(fromStudent.traits, toStudent.traits);

  // 월별 스토리 이벤트 반영
  const storyInfluence = getStoryInfluence(fromStudent, toStudent, month, story);

  // 확률적 결정 (4가지 타입으로 단순화)
  const random = Math.random();
  const adjusted = random + compatibility + storyInfluence;

  // 4가지 관계 타입으로 분류
  if (adjusted > 0.75) {
    relationType = '친해'; // FRIENDLY
  } else if (adjusted > 0.55) {
    relationType = '친해지고싶어'; // WANNA_BE_CLOSE  
  } else if (adjusted > 0.25) {
    relationType = '괜찮아'; // NEUTRAL
  } else {
    relationType = '불편해'; // AWKWARD
  }

  return relationType;
}

/**
 * 성격 기반 친화도 계산
 */
function calculateCompatibility(traits1, traits2) {
  // 호환되는 성격 조합
  const compatible = [
    ['활발함', '사교적'], ['조용함', '독서'], ['예술적', '감성'],
    ['리더십', '리더십'], ['유머', '개그'], ['책임감', '꼼꼼함']
  ];

  // 충돌하는 성격 조합
  const incompatible = [
    ['활발함', '조용함'], ['산만', '꼼꼼함'], ['자기주장', '수줍음']
  ];

  let score = 0;
  
  for (const trait1 of traits1) {
    for (const trait2 of traits2) {
      // 호환성 체크
      if (compatible.some(pair => 
        (pair[0] === trait1 && pair[1] === trait2) ||
        (pair[1] === trait1 && pair[0] === trait2)
      )) {
        score += 0.1;
      }
      
      // 비호환성 체크
      if (incompatible.some(pair =>
        (pair[0] === trait1 && pair[1] === trait2) ||
        (pair[1] === trait1 && pair[0] === trait2)
      )) {
        score -= 0.15;
      }
    }
  }

  return Math.max(-0.3, Math.min(0.3, score));
}

/**
 * 스토리 영향도 계산
 */
function getStoryInfluence(fromStudent, toStudent, month, story) {
  let influence = 0;

  // 갈등 관계 확인
  for (const conflict of story.conflicts) {
    const [id1, id2] = conflict;
    const student1 = STUDENTS[id1 - 1];
    const student2 = STUDENTS[id2 - 1];
    
    if ((fromStudent.name === student1.name && toStudent.name === student2.name) ||
        (fromStudent.name === student2.name && toStudent.name === student1.name)) {
      influence -= 0.4; // 갈등 관계는 부정적 영향
    }
  }

  // 우정 관계 확인
  for (const friendship of story.friendships) {
    if (friendship.length === 2) {
      const [id1, id2] = friendship;
      const student1 = STUDENTS[id1 - 1];
      const student2 = STUDENTS[id2 - 1];
      
      if ((fromStudent.name === student1.name && toStudent.name === student2.name) ||
          (fromStudent.name === student2.name && toStudent.name === student1.name)) {
        influence += 0.3; // 우정 관계는 긍정적 영향
      }
    } else if (friendship.length > 2) {
      // 그룹 친구 관계
      const studentNames = friendship.map(id => STUDENTS[id - 1].name);
      if (studentNames.includes(fromStudent.name) && studentNames.includes(toStudent.name)) {
        influence += 0.2;
      }
    }
  }

  return influence;
}

/**
 * 주관식 답변 생성
 */
async function generateAnswers(students, questions, surveys) {
  console.log('💭 주관식 답변 생성 중...');

  let totalAnswers = 0;

  for (const survey of surveys) {
    const month = parseInt(survey.name.split('월')[0]);
    const surveyQuestions = questions.filter(q => q.survey_id === survey.id);
    
    console.log(`  📅 ${month}월 답변 생성 중...`);

    const answersData = [];

    for (const student of students) {
      for (const question of surveyQuestions) {
        const answer = generateAnswer(student, question, month, students);
        
        if (answer) { // 빈 답변이 아닌 경우만 추가
          answersData.push({
            student_id: student.id,
            question_id: question.id,
            survey_id: survey.id,
            answer_text: answer
          });
        }
      }
    }

    // 배치 삽입
    for (let i = 0; i < answersData.length; i += 1000) {
      const batch = answersData.slice(i, i + 1000);
      const { error } = await supabase
        .from('answers')
        .insert(batch);

      if (error) {
        console.error(`${month}월 답변 생성 실패:`, error);
        throw error;
      }
    }

    totalAnswers += answersData.length;
    console.log(`  ✅ ${month}월: ${answersData.length}개 답변 생성`);
  }

  console.log(`✅ 총 ${totalAnswers}개 답변 생성 완료`);
}

/**
 * 개별 답변 생성 로직
 */
function generateAnswer(student, question, month, allStudents) {
  const studentData = STUDENTS.find(s => s.name === student.name);
  const questionText = question.question_text;

  // 각 질문 유형별 답변 생성
  switch (questionText) {
    case "반에서 좋은 친구는?":
      return generateFriendAnswer(studentData, month);
    
    case "좋은 친구가 좋은 이유는?":
      return generateFriendReasonAnswer(studentData, month);
    
    case "반에서 불편한 친구는?":
      return generateUncomfortableAnswer(studentData, month);
    
    case "불편한 친구가 불편한 이유는?":
      return generateUncomfortableReasonAnswer(studentData, month);
    
    case "선생님에 대한 학생의 생각은?":
      return generateTeacherAnswer(studentData, month);
    
    default:
      return null;
  }
}

/**
 * 좋은 친구 답변 생성
 */
function generateFriendAnswer(student, month) {
  const story = MONTHLY_STORIES[month];
  
  // 해당 월의 우정 관계에 포함된 친구들 찾기
  const friends = [];
  for (const friendship of story.friendships) {
    if (friendship.includes(student.id)) {
      const friendIds = friendship.filter(id => id !== student.id);
      friends.push(...friendIds.map(id => STUDENTS[id - 1].name));
    }
  }

  // 성격 기반 추가 친구 (확률적)
  const additionalFriends = STUDENTS
    .filter(s => s.id !== student.id)
    .filter(s => Math.random() < calculateCompatibility(student.traits, s.traits) + 0.3)
    .slice(0, 2)
    .map(s => s.name);

  const allFriends = [...new Set([...friends, ...additionalFriends])];

  if (allFriends.length === 0) {
    return Math.random() < 0.1 ? "아직 없어요" : null;
  }

  return allFriends.slice(0, 3).join(", ");
}

/**
 * 친구 좋은 이유 답변 생성
 */
function generateFriendReasonAnswer(student, month) {
  const reasons = {
    활발함: ["같이 놀면 재밌어요", "에너지가 넘쳐서 좋아요"],
    조용함: ["차분해서 편해요", "조용히 이야기 들어줘서 좋아요"], 
    사교적: ["친구를 많이 사귀어서 부러워요", "누구랑도 잘 어울려요"],
    예술적: ["그림을 정말 잘 그려요", "예술적 감각이 뛰어나요"],
    유머: ["웃겨서 같이 있으면 즐거워요", "재미있는 이야기를 많이 해줘요"]
  };

  const trait = student.traits[Math.floor(Math.random() * student.traits.length)];
  const reasonList = reasons[trait] || ["착하고 친절해서 좋아요"];
  
  return reasonList[Math.floor(Math.random() * reasonList.length)];
}

/**
 * 불편한 친구 답변 생성
 */
function generateUncomfortableAnswer(student, month) {
  const story = MONTHLY_STORIES[month];
  
  // 갈등 관계 확인
  const conflicts = [];
  for (const conflict of story.conflicts) {
    const [id1, id2] = conflict;
    if (student.id === id1) conflicts.push(STUDENTS[id2 - 1].name);
    if (student.id === id2) conflicts.push(STUDENTS[id1 - 1].name);
  }

  if (conflicts.length === 0) {
    return Math.random() < 0.8 ? "없어요" : null;
  }

  return conflicts[0]; // 첫 번째 갈등 상대만 언급
}

/**
 * 불편한 이유 답변 생성
 */
function generateUncomfortableReasonAnswer(student, month) {
  const story = MONTHLY_STORIES[month];
  
  // 특정 갈등 상황에 대한 이유
  if (month === 5 && (student.id === 4 || student.id === 9)) {
    return student.id === 4 ? 
      "내 그림 도구를 함부로 만져서 화가 나요" :
      "그냥 오해가 있었어요";
  }

  if (month === 6 && (student.id === 9 || student.id === 21)) {
    return student.id === 9 ? 
      "체육대회 때 실수해서 우리 팀이 졌어요" :
      "너무 승부욕이 강해서 무서워요";
  }

  return "잘 안 맞는 것 같아요";
}

/**
 * 선생님에 대한 생각 답변 생성
 */
function generateTeacherAnswer(student, month) {
  const positive = [
    "우리 선생님 최고예요!",
    "친절하고 재밌어서 좋아요",
    "우리를 잘 챙겨주세요",
    "공정하고 좋으신 것 같아요"
  ];

  const neutral = [
    "그냥 괜찮은 것 같아요",
    "잘 모르겠어요",
    "선생님은 선생님이에요"
  ];

  const negative = [
    "가끔 너무 엄격해요",
    "숙제를 너무 많이 내주세요"
  ];

  // 성격에 따른 확률 조정
  let positiveProb = 0.7;
  if (student.traits.includes('모범생') || student.traits.includes('책임감')) positiveProb = 0.9;
  if (student.traits.includes('자기주장') || student.traits.includes('산만')) positiveProb = 0.5;

  const rand = Math.random();
  if (rand < positiveProb) {
    return positive[Math.floor(Math.random() * positive.length)];
  } else if (rand < positiveProb + 0.2) {
    return neutral[Math.floor(Math.random() * neutral.length)];
  } else {
    return negative[Math.floor(Math.random() * negative.length)];
  }
}

/**
 * 메인 실행 함수
 */
async function main() {
  try {
    console.log('🚀 데모 학급 데이터 생성 시작!\n');

    // 1. 시스템 계정 설정
    const demoAccountId = await getOrCreateDemoAccount();

    // 2. 데모 학급 생성
    const classId = await createDemoClass(demoAccountId);

    // 3. 학생 생성
    const students = await createStudents(classId);

    // 4. 설문 생성
    const surveys = await createSurveys(classId);

    // 5. 질문 생성
    const questions = await createQuestions(classId, surveys);

    // 6. 관계 생성
    await generateRelations(students, surveys);

    // 7. 답변 생성
    await generateAnswers(students, questions, surveys);

    console.log('\n🎉 데모 학급 데이터 생성 완료!');
    console.log(`📊 생성된 데이터:`);
    console.log(`   - 학급: 1개 (공개 데모)`);
    console.log(`   - 학생: ${students.length}명`);
    console.log(`   - 설문: ${surveys.length}개`);
    console.log(`   - 질문: ${questions.length}개`);
    console.log(`   - 관계: ${surveys.length * students.length * (students.length - 1)}개`);
    console.log(`   - 답변: 약 ${surveys.length * students.length * QUESTIONS.length}개\n`);

    console.log('🌟 이제 모든 사용자가 "샘솔 초등학교 3학년 1반" 데모 학급에 접근할 수 있습니다!');

  } catch (error) {
    console.error('❌ 데이터 생성 실패:', error);
    process.exit(1);
  }
}

// 스크립트 실행
main(); 