#!/usr/bin/env node

/**
 * 데모 학급 관계/답변 데이터 복구 스크립트
 * 기존 데모 학급에 누락된 관계와 답변 데이터를 생성합니다.
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

// 📊 학생 데이터 (generate-demo-data.js와 동일)
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

// 📅 월별 스토리 데이터 (generate-demo-data.js와 동일)
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
    conflicts: [[4, 9]], 
    friendships: [[1, 3, 5], [6, 10], [13, 24], [30, 36]],
    relationDistribution: { 친해: 12, 친해지고싶어: 18, 괜찮아: 62, 불편해: 8 }
  },
  6: {
    theme: "팀워크와 경쟁을 통한 관계 심화",
    events: ["체육대회", "응원단", "팀경쟁"],
    conflicts: [[4, 9], [9, 21]], 
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
    conflicts: [[4, 9]], 
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
    conflicts: [[14, 28]], 
    friendships: [[6, 30], [36, 14, 28], [4, 9]], 
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
    friendships: [[4, 9], [40, 32]], 
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

// 관계 유형 매핑
const RELATION_TYPES = {
  친해: "FRIENDLY",
  친해지고싶어: "WANNA_BE_CLOSE", 
  괜찮아: "NEUTRAL",
  불편해: "AWKWARD"
};

/**
 * 데모 학급 조회
 */
async function getDemoClass() {
  const { data: demoClass, error } = await supabase
    .from('classes')
    .select('*')
    .eq('is_demo', true)
    .eq('is_public', true)
    .single();

  if (error || !demoClass) {
    throw new Error('데모 학급을 찾을 수 없습니다.');
  }

  return demoClass;
}

/**
 * 학생들과 설문들 조회
 */
async function getClassData(classId) {
  // 학생들 조회
  const { data: students, error: studentsError } = await supabase
    .from('students')
    .select('*')
    .eq('class_id', classId)
    .order('display_order');

  if (studentsError) {
    throw new Error(`학생 조회 실패: ${studentsError.message}`);
  }

  // 설문들 조회
  const { data: surveys, error: surveysError } = await supabase
    .from('surveys')
    .select('*')
    .eq('class_id', classId)
    .order('created_at');

  if (surveysError) {
    throw new Error(`설문 조회 실패: ${surveysError.message}`);
  }

  // 질문들 조회
  const { data: questions, error: questionsError } = await supabase
    .from('questions')
    .select('*')
    .eq('class_id', classId)
    .order('survey_id', 'created_at');

  if (questionsError) {
    throw new Error(`질문 조회 실패: ${questionsError.message}`);
  }

  return { students, surveys, questions };
}

/**
 * 기존 관계/답변 데이터 삭제
 */
async function clearExistingData(classId) {
  console.log('🧹 기존 관계/답변 데이터 정리 중...');

  // 설문 ID들 조회
  const { data: surveys } = await supabase
    .from('surveys')
    .select('id')
    .eq('class_id', classId);

  const surveyIds = surveys?.map(s => s.id) || [];

  if (surveyIds.length > 0) {
    // 기존 관계 삭제
    await supabase
      .from('relations')
      .delete()
      .in('survey_id', surveyIds);

    // 기존 답변 삭제
    await supabase
      .from('answers')
      .delete()
      .in('survey_id', surveyIds);
  }

  console.log('✅ 기존 데이터 정리 완료');
}

/**
 * 학생 간 관계 생성 (월별) - generate-demo-data.js와 동일한 로직
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

// 관계 타입 생성 로직 및 기타 함수들 (generate-demo-data.js와 동일)
function generateRelationType(fromStudent, toStudent, month, story) {
  let relationType = '괜찮아';
  const compatibility = calculateCompatibility(fromStudent.traits, toStudent.traits);
  const storyInfluence = getStoryInfluence(fromStudent, toStudent, month, story);
  const random = Math.random();
  const adjusted = random + compatibility + storyInfluence;

  if (adjusted > 0.75) {
    relationType = '친해';
  } else if (adjusted > 0.55) {
    relationType = '친해지고싶어';  
  } else if (adjusted > 0.25) {
    relationType = '괜찮아';
  } else {
    relationType = '불편해';
  }

  return relationType;
}

function calculateCompatibility(traits1, traits2) {
  const compatible = [
    ['활발함', '사교적'], ['조용함', '독서'], ['예술적', '감성'],
    ['리더십', '리더십'], ['유머', '개그'], ['책임감', '꼼꼼함']
  ];

  const incompatible = [
    ['활발함', '조용함'], ['산만', '꼼꼼함'], ['자기주장', '수줍음']
  ];

  let score = 0;
  
  for (const trait1 of traits1) {
    for (const trait2 of traits2) {
      if (compatible.some(pair => 
        (pair[0] === trait1 && pair[1] === trait2) ||
        (pair[1] === trait1 && pair[0] === trait2)
      )) {
        score += 0.1;
      }
      
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

function getStoryInfluence(fromStudent, toStudent, month, story) {
  let influence = 0;

  for (const conflict of story.conflicts) {
    const [id1, id2] = conflict;
    const student1 = STUDENTS[id1 - 1];
    const student2 = STUDENTS[id2 - 1];
    
    if ((fromStudent.name === student1.name && toStudent.name === student2.name) ||
        (fromStudent.name === student2.name && toStudent.name === student1.name)) {
      influence -= 0.4;
    }
  }

  for (const friendship of story.friendships) {
    if (friendship.length === 2) {
      const [id1, id2] = friendship;
      const student1 = STUDENTS[id1 - 1];
      const student2 = STUDENTS[id2 - 1];
      
      if ((fromStudent.name === student1.name && toStudent.name === student2.name) ||
          (fromStudent.name === student2.name && toStudent.name === student1.name)) {
        influence += 0.3;
      }
    } else if (friendship.length > 2) {
      const studentNames = friendship.map(id => STUDENTS[id - 1].name);
      if (studentNames.includes(fromStudent.name) && studentNames.includes(toStudent.name)) {
        influence += 0.2;
      }
    }
  }

  return influence;
}

/**
 * 주관식 답변 생성 (generate-demo-data.js와 동일한 로직)
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
        
        if (answer) {
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

// 답변 생성 함수들 (generate-demo-data.js와 동일)
function generateAnswer(student, question, month, allStudents) {
  const studentData = STUDENTS.find(s => s.name === student.name);
  const questionText = question.question_text;

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

function generateFriendAnswer(student, month) {
  const story = MONTHLY_STORIES[month];
  const friends = [];
  
  for (const friendship of story.friendships) {
    if (friendship.includes(student.id)) {
      const friendIds = friendship.filter(id => id !== student.id);
      friends.push(...friendIds.map(id => STUDENTS[id - 1].name));
    }
  }

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

function generateUncomfortableAnswer(student, month) {
  const story = MONTHLY_STORIES[month];
  const conflicts = [];
  
  for (const conflict of story.conflicts) {
    const [id1, id2] = conflict;
    if (student.id === id1) conflicts.push(STUDENTS[id2 - 1].name);
    if (student.id === id2) conflicts.push(STUDENTS[id1 - 1].name);
  }

  if (conflicts.length === 0) {
    return Math.random() < 0.8 ? "없어요" : null;
  }

  return conflicts[0];
}

function generateUncomfortableReasonAnswer(student, month) {
  const story = MONTHLY_STORIES[month];
  
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
    console.log('🔧 데모 학급 관계/답변 데이터 복구 시작!\n');

    // 1. 데모 학급 조회
    const demoClass = await getDemoClass();
    console.log(`🏫 데모 학급 발견: ${demoClass.name} (${demoClass.id})`);

    // 2. 학생, 설문, 질문 데이터 조회
    const { students, surveys, questions } = await getClassData(demoClass.id);
    console.log(`📊 학생: ${students.length}명, 설문: ${surveys.length}개, 질문: ${questions.length}개`);

    // 3. 기존 관계/답변 데이터 정리
    await clearExistingData(demoClass.id);

    // 4. 관계 데이터 생성
    await generateRelations(students, surveys);

    // 5. 답변 데이터 생성
    await generateAnswers(students, questions, surveys);

    console.log('\n🎉 데모 학급 관계/답변 데이터 복구 완료!');

  } catch (error) {
    console.error('❌ 복구 실패:', error);
    process.exit(1);
  }
}

main(); 