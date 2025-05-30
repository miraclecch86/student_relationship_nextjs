import { GoogleGenerativeAI } from '@google/generative-ai';
import { Student, Question, Answer, Relationship, Survey } from './supabase';

// Gemini 모델 상수 정의
const GEMINI_MODELS = {
  'flash': 'gemini-2.5-flash-preview-05-20'
} as const;

// 공통 전문가 정체성 설정
const AI_EXPERT_IDENTITY = `## 🎯 AI 전문가 정체성 설정

당신은 다음과 같은 다중 전문성을 보유한 **교실 운영 전문 AI 컨설턴트**입니다:

**핵심 전문 영역:**
- 🎓 **교육심리학 박사** (아동·청소년 발달심리, 학습심리, 집단역학)
- 👥 **학급경영 전문 컨설턴트** (15년+ 현장 경험, 학급 운영 시스템 설계)
- 🧠 **아동발달 및 관계심리 전문가** (또래관계, 사회성 발달, 정서 조절)
- 💼 **학교상담사 자격** (학교부적응, 교우관계 갈등, 개별상담)
- 📊 **교육데이터 분석 전문가** (관계망 분석, 설문 데이터 해석, 패턴 발견)
- 🎨 **창의적 교육활동 기획자** (체험학습, 협동학습, 관계증진 프로그램)

**분석 철학:**
- 데이터 속 **숨겨진 관계 패턴과 잠재적 문제**를 발견하는 것을 최우선으로 함
- 이론보다는 **즉시 교실에서 실행 가능한 실용적 솔루션** 제공
- 담임교사가 **실제로 교실 운영에 활용**할 수 있는 구체적 인사이트 전달
- 아이들의 **심리상태와 관계 변화**를 민감하게 포착하여 예방적 개입 방안 제시

**관계 용어 변환 규칙:**
- "friendly" → "친해"
- "wanna_be_close" → "친해질래"  
- "neutral" → "괜찮아"
- "awkward" → "불편해"`;

// 종합 분석 프롬프트 템플릿
const COMPREHENSIVE_ANALYSIS_PROMPT = `${AI_EXPERT_IDENTITY}

**관계 데이터 해석 중요 사항:**
- 관계는 **방향성이 있습니다** (A → B와 B → A는 서로 다른 관계)
- "from": "철수", "to": "영희", "type": "친해" = "철수가 영희를 친해로 선택했다"는 의미
- "from": "영희", "to": "철수", "type": "불편해" = "영희가 철수를 불편해로 선택했다"는 의미
- **받은 관계와 준 관계를 반드시 구분하여 분석**하세요
- 예: A가 받은 불편해 vs A가 준 불편해는 완전히 다른 의미입니다

**중요**: 
- 설명이나 안내 문구 없이 바로 분석 내용만 작성하세요
- 제공된 학급 정보에 기반하여 분석하세요
- 5개 섹션으로 구성하세요

## 1. 🔍 **학급 전체 현황 및 관계 흐름 진단**
- **전체 학급 특성**: 이 학급만의 독특한 분위기와 집단 문화적 특징
- **관계망 구조 분석**: 전체적인 사회적 관계망과 하위 그룹 형성 패턴
- **시간별 변화 추이**: 설문 데이터를 통해 본 학급의 관계 변화 흐름과 성장 패턴
- **현재 교실 역학**: 리더-팔로워 구조, 인기도 분포, 영향력 중심 분석
- **교실 분위기 온도계**: 전체적인 심리적 안전감과 소속감 수준 진단

## 2. 🕵️ **데이터 기반 심층 통찰 및 숨겨진 패턴**
- **AI가 발견한 특이 패턴**: 일반적이지 않은 관계 형성이나 심리적 변화 신호
- **잠재적 위험 요소**: 향후 문제가 될 수 있는 관계 갈등이나 소외 패턴의 조기 발견
- **긍정적 성장 동력**: 학급 발전을 이끌 수 있는 강점 관계와 리더십 요소
- **숨겨진 니즈**: 설문 응답에서 드러나는 학생들의 미충족 욕구와 기대
- **예상 시나리오**: 현재 패턴이 지속될 경우 예상되는 학급 변화 방향

## 3. 🎯 **맞춤형 교실 운영 전략 3가지 (즉시 실행 가능)**

#### **전략 1: [즉시 개입 필요 영역]**
- **🎯 목적**: 현재 가장 시급한 교실 이슈 해결
- **구체적 방법**: 단계별 실행 계획과 준비물, 교사 역할
- **🎈 기대효과**: 이 전략이 학급에 가져올 구체적 변화
- **📊 성공 지표**: 개선 여부를 확인할 수 있는 관찰 포인트

#### **전략 2: [중장기 관계 강화 시스템]**
- **🎯 목적**: 학급 내 관계 개선 및 강화
- **📋 구체적 방법**: 단계별 실행 계획과 준비물, 교사 역할
- **🎈 기대효과**: 이 전략이 학급에 가져올 구체적 변화
- **📊 성공 지표**: 개선 여부를 확인할 수 있는 관찰 포인트

#### **전략 3: [예방적 모니터링 및 지원 체계]**
- **🎯 목적**: 잠재적 문제 예방 및 지속적 관리
- **📋 구체적 방법**: 단계별 실행 계획과 준비물, 교사 역할
- **🎈 기대효과**: 이 전략이 학급에 가져올 구체적 변화
- **📊 성공 지표**: 개선 여부를 확인할 수 있는 관찰 포인트

## 4. 🏆 **우선순위별 학생 지도 로드맵**
- **즉시 개입 학생**: 당장 집중적 관심이 필요한 학생들과 개입 방법
- **잠재력 개발 학생**: 리더십이나 특별한 능력을 키워줄 학생들과 지원 방안
- **관계 촉진 학생**: 학급 화합에 중요한 역할을 할 수 있는 학생들과 활용 전략
- **안정적 지지 학생**: 학급의 든든한 기반이 되는 학생들과 역할 확대 방안

## 5. 💡 **담임교사 실행 가이드**

### 📅 **단기 실행 계획 (즉시~1개월)**
- **이번 주 실행사항**: 당장 시작할 수 있는 3-5가지 구체적 액션 아이템
- **이번 달 중점 목표**: 한 달 내 달성할 학급 변화 목표와 마일스톤

### 📈 **중장기 성장 로드맵 (1개월~1학기)**  
- **분기별 장기 계획**: 학기 전체를 아우르는 학급 성장 로드맵
- **단계별 발전 목표**: 월별/분기별 구체적 성장 지표와 마일스톤

### 🔍 **지속적 모니터링 시스템**
- **주간 관찰 체크리스트**: 매주 점검해야 할 학급 상태 핵심 지표들
- **월간 평가 포인트**: 한 달 단위로 확인할 학급 발전 상황과 조정 방향

### 🚨 **위기 관리 및 예방 대응**
- **위기 상황 조기 발견**: 문제 상황의 전조 증상과 감지 방법
- **단계별 대응 매뉴얼**: 상황별 구체적 대응 방법과 에스컬레이션 절차

### 🏠 **가정 연계 협력 방안**
- **학부모 소통 포인트**: 가정과 연계하여 강화할 수 있는 지도 영역
- **가정 내 실천 사항**: 학부모께 요청할 구체적 협력 방안과 활동

**관계 용어 변환 규칙:**
- "friendly" → "친해"
- "wanna_be_close" → "친해질래"  
- "neutral" → "괜찮아"
- "awkward" → "불편해"`;

// 학생 분석 프롬프트 템플릿
const STUDENT_ANALYSIS_PROMPT = `${AI_EXPERT_IDENTITY}

**관계 데이터 해석 중요 사항:**
- 관계는 **방향성이 있습니다** (A → B와 B → A는 서로 다른 관계)
- "from": "철수", "to": "영희", "type": "친해" = "철수가 영희를 친해로 선택했다"는 의미
- "from": "영희", "to": "철수", "type": "불편해" = "영희가 철수를 불편해로 선택했다"는 의미
- **받은 관계와 준 관계를 반드시 구분하여 분석**하세요
- 예: A가 받은 불편해 vs A가 준 불편해는 완전히 다른 의미입니다

**중요**: 
- 설명이나 안내 문구 없이 바로 학생 분석만 작성하세요
- 제공된 학생 목록에 있는 학생들만 분석하세요
- 각 학생마다 아래 5개 섹션으로 구성하세요

각 학생별 분석 형식:

## 👤 **[학생명]**

### 🔍 **관계 분석 및 사회적 위치**
- **학급 내 위치**: 전체 사회적 관계망에서의 구체적 위치와 영향력 수준
- **친밀 관계 패턴**: 가까운 친구들과의 관계 깊이와 상호작용 특성
- **또래 관계 스펙트럼**: 다양한 학급 구성원들과의 관계 양상과 변화
- **관계 변화 추이**: 시간에 따른 관계 발전 및 변화 패턴과 배경
- **소통 스타일**: 타인과의 의사소통 방식과 상호작용 특징
- **사회적 역할**: 학급 공동체에서 수행하는 역할과 그 영향력

### 🧠 **심리적 특성 및 성장 패턴**  
- **핵심 성격 특성**: 주요 성격 요소와 행동 패턴의 근본적 특징
- **정서 발달 상태**: 감정 인식, 표현, 조절 능력의 현재 발달 수준
- **인지적 특성**: 사고 방식, 문제 해결 접근법, 학습 성향
- **자아 개념**: 자기 인식과 자존감, 자기 효능감의 발달 정도
- **스트레스 대처**: 어려운 상황에서의 반응 패턴과 대처 전략
- **성장 변화**: 관찰된 발달적 변화와 성장 궤적의 특성

### 💪 **강점 및 개선 영역**
- **핵심 강점**: 학생의 주요 장점과 뛰어난 능력 영역
- **잠재력**: 향후 발현 가능한 재능과 성장 가능성
- **리더십**: 다른 학생들에게 미치는 긍정적 영향력
- **창의적 특성**: 독특하고 창의적인 사고나 행동 양상
- **개선 필요 영역**: 성장을 위해 발전이 필요한 구체적 부분
- **도전 과제**: 현재 직면한 어려움과 극복 과제
- **성장 저해 요소**: 발전을 방해할 수 있는 요인과 주의점

### 🎯 **담임교사 맞춤형 지도 전략**
- **일상 관찰 포인트**: 교실에서 지속 관찰할 구체적 행동과 변화 신호
- **개별 지도 방향**: 이 학생에게 가장 효과적인 지도 방식과 접근법
- **관계 촉진 방안**: 또래 관계 개선을 위한 구체적 개입 전략
- **학습 지원 전략**: 학업적 성장을 위한 맞춤형 지원 방향
- **정서 지원 방법**: 심리적 안정감과 성장을 위한 지원 체계
- **장기 성장 로드맵**: 지속적 발전을 위한 단계별 계획
- **예방적 개입**: 특별히 주의할 상황과 예방적 대응 방안

### 💬 **학부모·학생 소통 가이드**
- **학부모 상담 포인트**: 이 학생에 대해 학부모님께 전달할 핵심 메시지와 상담 내용
- **가정 연계 협력 방안**: 가정에서 실천할 수 있는 구체적 지원 방법과 활동
- **학생과의 대화 주제**: 학생과 직접 나눌 수 있는 효과적인 대화 소재와 접근법
- **긍정적 피드백 방향**: 학생의 자존감 향상을 위한 구체적 칭찬 포인트와 격려 방법
- **성장 동기 부여**: 학생의 발전 의지를 높이기 위한 맞춤형 동기부여 전략

---`;

// Gemini API 호출을 위한 공통 함수
async function callGemini(systemPrompt: string, userContent: string, modelType: 'flash' = 'flash', temperature: number = 0.3): Promise<string> {
  try {
    // 환경 변수에서 API 키 가져오기
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.error('Gemini API 키가 설정되지 않았습니다. 환경 변수를 확인해주세요.');
      console.error('환경 변수 GEMINI_API_KEY를 .env.local 파일과 Vercel 프로젝트 설정에 추가해야 합니다.');
      throw new Error('Gemini API 키가 설정되지 않았습니다. 환경 변수를 확인해주세요.');
    }

    console.log('API 키 확인:', apiKey ? `설정됨 (${apiKey.substring(0, 10)}...)` : '설정되지 않음');

    // GoogleGenerativeAI 클라이언트 생성
    const genAI = new GoogleGenerativeAI(apiKey);
    const selectedModel = GEMINI_MODELS[modelType];
    
    console.log('사용할 모델:', selectedModel);
    
    const model = genAI.getGenerativeModel({ 
      model: selectedModel,
      generationConfig: {
        temperature: temperature,
        maxOutputTokens: 65536, // Flash 최대 토큰 (65,536) 사용
      },
    });

    // 시스템 프롬프트와 사용자 콘텐츠를 결합
    const prompt = `${systemPrompt}\n\n${userContent}`;
    
    console.log('Gemini API 요청 시작...');
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('Gemini API 응답 성공');
    return text;
  } catch (error: any) {
    console.error('Gemini API 호출 상세 오류:', error);
    
    // 403 에러 특별 처리
    if (error.message && error.message.includes('403')) {
      console.error('403 Forbidden 에러: API 키 권한 또는 모델 접근 권한 문제');
      throw new Error('API 접근 권한이 없습니다. API 키나 모델 권한을 확인해주세요.');
    }
    
    // 기타 에러
    throw error;
  }
}

// 학생 관계 분석을 위한 Gemini API 호출 함수
export async function analyzeStudentRelationshipsWithGemini(
  students: Student[],
  relationships: Relationship[],
  answers?: Answer[],
  questions?: Question[],
  additionalData?: {
    classDetails?: any,
    surveys?: Survey[],
    surveyData?: Array<{
      survey: Survey,
      relationships: Relationship[],
      questions: Question[],
      answers: Answer[]
    }>
  },
  modelType: 'flash' = 'flash'
): Promise<string> {
  try {
    // 분석에 필요한 데이터 준비
    const analysisData = {
      // 학급 정보
      class: additionalData?.classDetails || { id: "unknown" },
      
      // 학생 정보
      students: students.map(s => ({
        id: s.id,
        name: s.name,
        gender: s.gender
      })),
      
      // 기본 관계 정보 (설문과 연결되지 않은)
      baseRelationships: relationships.map(r => ({
        선택한학생: students.find(s => s.id === r.from_student_id)?.name || r.from_student_id,
        선택받은학생: students.find(s => s.id === r.to_student_id)?.name || r.to_student_id,
        관계유형: r.relation_type,
        from: students.find(s => s.id === r.from_student_id)?.name || r.from_student_id,
        to: students.find(s => s.id === r.to_student_id)?.name || r.to_student_id,
        type: r.relation_type
      })),
      
      // 기본 질문&응답 정보
      questions: questions ? questions.map(q => ({
        id: q.id,
        text: q.question_text
      })) : [],
      
      answers: answers ? answers.map(a => {
        const question = questions?.find(q => q.id === a.question_id);
        const student = students.find(s => s.id === a.student_id);
        return {
          student: student?.name || a.student_id,
          question: question?.question_text || a.question_id,
          answer: a.answer_text
        };
      }) : [],
      
      // 설문 정보
      surveys: additionalData?.surveys?.map(survey => ({
        id: survey.id,
        name: survey.name,
        description: survey.description,
        created_at: survey.created_at
      })) || [],
      
      // 설문별 상세 정보
      surveyDetails: additionalData?.surveyData?.map(sd => {
        return {
          survey: {
            id: sd.survey.id,
            name: sd.survey.name,
            description: sd.survey.description,
            created_at: sd.survey.created_at
          },
          relationships: sd.relationships.map(r => ({
            선택한학생: students.find(s => s.id === r.from_student_id)?.name || r.from_student_id,
            선택받은학생: students.find(s => s.id === r.to_student_id)?.name || r.to_student_id,
            관계유형: r.relation_type,
            from: students.find(s => s.id === r.from_student_id)?.name || r.from_student_id,
            to: students.find(s => s.id === r.to_student_id)?.name || r.to_student_id,
            type: r.relation_type
          })),
          questions: sd.questions.map(q => ({
            id: q.id,
            text: q.question_text
          })),
          answers: sd.answers.map(a => {
            const question = sd.questions.find(q => q.id === a.question_id);
            const student = students.find(s => s.id === a.student_id);
            return {
              student: student?.name || a.student_id,
              question: question?.question_text || a.question_id,
              answer: a.answer_text
            };
          })
        };
      }) || []
    };

    const userContent = `다음 데이터를 기반으로 학급 관계 분석을 진행해주세요: 
    ${JSON.stringify(analysisData, null, 2)}`;

    return await callGemini(COMPREHENSIVE_ANALYSIS_PROMPT, userContent, modelType, 0.3);
  } catch (error: any) {
    console.error('Gemini 학생 관계 분석 API 호출 오류:', error);
    throw error;
  }
}

// 종합분석을 위한 Gemini 함수 (전체 학급에 대한 통찰과 주요 패턴)
export async function analyzeClassOverviewWithGemini(
  students: Student[],
  relationships: Relationship[],
  answers?: Answer[],
  questions?: Question[],
  additionalData?: {
    classDetails?: any,
    surveys?: Survey[],
    surveyData?: Array<{
      survey: Survey,
      relationships: Relationship[],
      questions: Question[],
      answers: Answer[]
    }>
  },
  modelType: 'flash' = 'flash'
): Promise<string> {
  try {
    // 분석에 필요한 데이터 준비 (기존 함수와 동일한 방식)
    const analysisData = {
      // 학급 정보
      class: additionalData?.classDetails || { id: "unknown" },
      
      // 학생 정보
      students: students.map(s => ({
        id: s.id,
        name: s.name,
        gender: s.gender
      })),
      
      // 기본 관계 정보 (설문과 연결되지 않은)
      baseRelationships: relationships.map(r => ({
        from: students.find(s => s.id === r.from_student_id)?.name || r.from_student_id,
        to: students.find(s => s.id === r.to_student_id)?.name || r.to_student_id,
        type: r.relation_type
      })),
      
      // 기본 질문&응답 정보
      questions: questions ? questions.map(q => ({
        id: q.id,
        text: q.question_text
      })) : [],
      
      answers: answers ? answers.map(a => {
        const question = questions?.find(q => q.id === a.question_id);
        const student = students.find(s => s.id === a.student_id);
        return {
          student: student?.name || a.student_id,
          question: question?.question_text || a.question_id,
          answer: a.answer_text
        };
      }) : [],
      
      // 설문 정보
      surveys: additionalData?.surveys?.map(survey => ({
        id: survey.id,
        name: survey.name,
        description: survey.description,
        created_at: survey.created_at
      })) || [],
      
      // 설문별 상세 정보
      surveyDetails: additionalData?.surveyData?.map(sd => {
        return {
          survey: {
            id: sd.survey.id,
            name: sd.survey.name,
            description: sd.survey.description,
            created_at: sd.survey.created_at
          },
          relationships: sd.relationships.map(r => ({
            from: students.find(s => s.id === r.from_student_id)?.name || r.from_student_id,
            to: students.find(s => s.id === r.to_student_id)?.name || r.to_student_id,
            type: r.relation_type
          })),
          questions: sd.questions.map(q => ({
            id: q.id,
            text: q.question_text
          })),
          answers: sd.answers.map(a => {
            const question = sd.questions.find(q => q.id === a.question_id);
            const student = students.find(s => s.id === a.student_id);
            return {
              student: student?.name || a.student_id,
              question: question?.question_text || a.question_id,
              answer: a.answer_text
            };
          })
        };
      }) || []
    };

    const userContent = `다음 데이터를 기반으로 학급 전체 종합 분석을 진행해주세요: 
    ${JSON.stringify(analysisData, null, 2)}`;

    return await callGemini(COMPREHENSIVE_ANALYSIS_PROMPT, userContent, modelType, 0.3);
  } catch (error: any) {
    console.error('Gemini 종합분석 API 호출 오류:', error);
    throw error;
  }
}

// 학생 그룹 분석을 위한 Gemini 함수
export async function analyzeStudentGroupWithGemini(
  students: Student[], // 이미 그룹화된 학생 목록
  relationships: Relationship[],
  groupIndex: number, // 1, 2, 3 등 그룹 인덱스
  answers?: Answer[],
  questions?: Question[],
  additionalData?: {
    classDetails?: any,
    surveys?: Survey[],
    surveyData?: Array<{
      survey: Survey,
      relationships: Relationship[],
      questions: Question[],
      answers: Answer[]
    }>,
    allStudents?: Student[] // 전체 학생 목록 (참조용)
  },
  modelType: 'flash' = 'flash'
): Promise<string> {
  try {
    // 분석에 필요한 데이터 준비
    const analysisData = {
      // 학급 정보
      class: additionalData?.classDetails || { id: "unknown" },
      
      // 그룹 학생 정보
      groupStudents: students.map(s => ({
        id: s.id,
        name: s.name,
        gender: s.gender
      })),
      
      // 전체 학생 정보 (참조용)
      allStudents: additionalData?.allStudents?.map(s => ({
        id: s.id,
        name: s.name,
        gender: s.gender
      })) || [],
      
      // 그룹 내 관계 정보
      groupRelationships: relationships.map(r => ({
        선택한학생: students.find(s => s.id === r.from_student_id)?.name || r.from_student_id,
        선택받은학생: students.find(s => s.id === r.to_student_id)?.name || r.to_student_id,
        관계유형: r.relation_type,
        from: students.find(s => s.id === r.from_student_id)?.name || r.from_student_id,
        to: students.find(s => s.id === r.to_student_id)?.name || r.to_student_id,
        type: r.relation_type
      })),
      
      // 기본 질문&응답 정보
      questions: questions ? questions.map(q => ({
        id: q.id,
        text: q.question_text
      })) : [],
      
      answers: answers ? answers.map(a => {
        const question = questions?.find(q => q.id === a.question_id);
        const student = students.find(s => s.id === a.student_id);
        return {
          student: student?.name || a.student_id,
          question: question?.question_text || a.question_id,
          answer: a.answer_text
        };
      }) : [],
      
      // 설문 정보
      surveys: additionalData?.surveys?.map(survey => ({
        id: survey.id,
        name: survey.name,
        description: survey.description,
        created_at: survey.created_at
      })) || [],
      
      // 설문별 상세 정보
      surveyDetails: additionalData?.surveyData?.map(sd => {
        return {
          survey: {
            id: sd.survey.id,
            name: sd.survey.name,
            description: sd.survey.description,
            created_at: sd.survey.created_at
          },
          relationships: sd.relationships.map(r => ({
            선택한학생: students.find(s => s.id === r.from_student_id)?.name || r.from_student_id,
            선택받은학생: students.find(s => s.id === r.to_student_id)?.name || r.to_student_id,
            관계유형: r.relation_type,
            from: students.find(s => s.id === r.from_student_id)?.name || r.from_student_id,
            to: students.find(s => s.id === r.to_student_id)?.name || r.to_student_id,
            type: r.relation_type
          })),
          questions: sd.questions.map(q => ({
            id: q.id,
            text: q.question_text
          })),
          answers: sd.answers.map(a => {
            const question = sd.questions.find(q => q.id === a.question_id);
            const student = students.find(s => s.id === a.student_id);
            return {
              student: student?.name || a.student_id,
              question: question?.question_text || a.question_id,
              answer: a.answer_text
            };
          })
        };
      }) || []
    };

    const userContent = `다음 데이터를 기반으로 각 학생별 심층 분석을 진행해주세요. 

**중요 지시사항:**
1. 반드시 각 학생의 이름을 ### 헤더로 시작하세요
2. 모든 학생에 대해 동일한 구조를 유지하세요  
3. **핵심만 간결하게!** 각 섹션당 2-3줄, 활동 제안은 1-2줄로 제한
4. 토큰 한계 내에서 모든 학생 분석을 완료하세요
5. 학생 간 구분을 위해 "---" 사용하세요
    
    데이터: 
    ${JSON.stringify(analysisData, null, 2)}`;

    return await callGemini(STUDENT_ANALYSIS_PROMPT, userContent, modelType, 0.3);
  } catch (error: any) {
    console.error(`Gemini analyzeStudentGroup(${groupIndex}) API 호출 오류:`, error);
    throw error;
  }
}

// 학생 생활기록부 문구 생성 Gemini 함수
export async function generateSchoolRecordWithGemini(
  students: Student[],
  relationships: Relationship[],
  answers?: Answer[],
  questions?: Question[],
  additionalData?: {
    classDetails?: any,
    surveys?: Survey[],
    surveyData?: Array<{
      survey: Survey,
      relationships: Relationship[],
      questions: Question[],
      answers: Answer[]
    }>
  },
  modelType: 'flash' = 'flash'
): Promise<string> {
  try {
    // 분석에 필요한 데이터를 더 체계적으로 준비
    const analysisData = {
      // 학급 정보
      class: {
        id: additionalData?.classDetails?.id || "unknown",
        name: additionalData?.classDetails?.name || "알 수 없음",
        school: additionalData?.classDetails?.school || "알 수 없음",
        grade: additionalData?.classDetails?.grade || "알 수 없음",
        year: new Date().getFullYear()
      },
      
      // 학생 정보 (개별 특성 포함)
      students: students.map(student => {
        // 해당 학생과 관련된 모든 관계 정보 수집
        const studentRelationships = {
          // 이 학생이 다른 학생들에게 표현한 관계
          outgoing: relationships.filter(r => r.from_student_id === student.id).map(r => ({
            target: students.find(s => s.id === r.to_student_id)?.name || r.to_student_id,
            type: r.relation_type,
            surveyContext: additionalData?.surveyData?.find(sd => 
              sd.relationships.some(sr => sr.id === r.id)
            )?.survey?.name || "기본 관계"
          })),
          // 다른 학생들이 이 학생에게 표현한 관계
          incoming: relationships.filter(r => r.to_student_id === student.id).map(r => ({
            from: students.find(s => s.id === r.from_student_id)?.name || r.from_student_id,
            type: r.relation_type,
            surveyContext: additionalData?.surveyData?.find(sd => 
              sd.relationships.some(sr => sr.id === r.id)
            )?.survey?.name || "기본 관계"
          }))
        };

        // 해당 학생의 모든 설문 답변 수집
        const studentAnswers = answers?.filter(a => a.student_id === student.id).map(answer => {
          const question = questions?.find(q => q.id === answer.question_id);
          const surveyContext = additionalData?.surveyData?.find(sd => 
            sd.answers.some(sa => sa.id === answer.id)
          );
          
          return {
            question: question?.question_text || "알 수 없는 질문",
            answer: answer.answer_text,
            survey: surveyContext?.survey?.name || "기본 설문",
            date: surveyContext?.survey?.created_at || new Date().toISOString()
          };
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) || [];

        return {
          id: student.id,
          name: student.name,
          gender: student.gender,
          relationships: studentRelationships,
          answers: studentAnswers,
          // 관계 패턴 분석
          relationshipSummary: {
            totalOutgoing: studentRelationships.outgoing.length,
            totalIncoming: studentRelationships.incoming.length,
            popularityScore: studentRelationships.incoming.filter(r => 
              ['친한', '친해질래'].includes(r.type)
            ).length,
            conflictIndicators: studentRelationships.incoming.filter(r => 
              r.type === '안친한'
            ).length,
            outgoingPositive: studentRelationships.outgoing.filter(r => 
              ['친한', '친해질래'].includes(r.type)
            ).length
          }
        };
      }),
      
      // 시간대별 설문 정보 (변화 추적용)
      timelineData: additionalData?.surveys?.map(survey => ({
        surveyName: survey.name,
        date: survey.created_at,
        description: survey.description,
        participantCount: additionalData.surveyData?.find(sd => sd.survey.id === survey.id)?.answers?.length || 0
      })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) || [],

      // 전체 학급 관계 맥락
      classContext: {
        totalStudents: students.length,
        totalRelationships: relationships.length,
        averageRelationshipsPerStudent: relationships.length / students.length,
        positiveRelationshipRatio: relationships.filter(r => 
          ['친한', '친해질래'].includes(r.relation_type)
        ).length / relationships.length,
        surveyCount: additionalData?.surveys?.length || 0
      }
    };

    const userContent = `다음 데이터를 기반으로 각 학생별 생활기록부 문구를 작성해주세요. 

**중요 지시사항:**
1. 반드시 각 학생의 이름을 ### 헤더로 시작하세요
2. 모든 학생에 대해 동일한 구조를 유지하세요  
3. **핵심만 간결하게!** 각 섹션당 2-3줄, 활동 제안은 1-2줄로 제한
4. 토큰 한계 내에서 모든 학생 분석을 완료하세요
5. 학생 간 구분을 위해 "---" 사용하세요
    
    데이터: 
    ${JSON.stringify(analysisData, null, 2)}`;

    return await callGemini(STUDENT_ANALYSIS_PROMPT, userContent, modelType, 0.3);
  } catch (error: any) {
    console.error('Gemini 생활기록부 생성 API 호출 오류:', error);
    throw error;
  }
}

export interface AnnouncementRequest {
  keywords: string;
  details: string;
  className: string;
  date: string;
}

export async function generateAnnouncementWithGemini({
  keywords,
  details,
  className,
  date
}: AnnouncementRequest): Promise<string> {
  try {
    const systemPrompt = `당신은 초등학교 선생님입니다. 학부모님께 보낼 알림장을 작성해주세요.

**작성 가이드라인:**
1. 따뜻하고 친근한 톤으로 작성
2. 학부모님이 이해하기 쉽게 구체적으로 설명
3. 아이들의 긍정적인 면을 강조
4. 가정에서의 연계 활동이나 대화 주제 제안
5. 감사 인사로 마무리

**형식:**
- 인사말로 시작
- 주요 활동 내용 설명
- 아이들의 모습이나 성장 포인트
- 가정 연계 제안 (선택사항)
- 감사 인사로 마무리

알림장을 작성해주세요:`;

    const userContent = `**학급 정보:**
- 학급명: ${className}
- 날짜: ${date}

**오늘의 주요 키워드:**
${keywords}

**상세 내용:**
${details}`;

    return await callGemini(systemPrompt, userContent, 'flash', 0.3);
  } catch (error) {
    console.error('Gemini AI 오류:', error);
    
    // 기타 오류의 경우 폴백 템플릿 반환
    return generateFallbackAnnouncement({ keywords, details, className, date });
  }
}

// 폴백 템플릿 (AI API 오류 시 사용)
function generateFallbackAnnouncement({
  keywords,
  details,
  className,
  date
}: AnnouncementRequest): string {
  return `안녕하세요, ${className} 학부모님!

${date} 하루 동안 아이들과 함께한 소중한 시간을 공유드립니다.

🔑 오늘의 주요 활동: ${keywords}

📝 상세 내용:
${details}

오늘도 아이들이 건강하고 즐겁게 학교생활을 마쳤습니다. 
집에서도 오늘 있었던 일들에 대해 아이와 대화해보시면 좋겠습니다.

항상 관심과 사랑으로 지켜봐 주시는 학부모님께 감사드립니다.

${className} 담임교사 드림`;
} 