import { GoogleGenerativeAI } from '@google/generative-ai';
import { Student, Question, Answer, Relationship, Survey } from './supabase';

// Gemini 모델 상수 정의
const GEMINI_MODELS = {
  'flash': 'gemini-2.5-flash-preview-05-20'
} as const;

// Gemini API 호출을 위한 공통 함수
async function callGemini(systemPrompt: string, userContent: string, modelType: 'flash' = 'flash', temperature: number = 0.7): Promise<string> {
  try {
    // 환경 변수에서 API 키 가져오기
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.error('Gemini API 키가 설정되지 않았습니다. 환경 변수를 확인해주세요.');
      console.error('환경 변수 GEMINI_API_KEY를 .env.local 파일과 Vercel 프로젝트 설정에 추가해야 합니다.');
      throw new Error('Gemini API 키가 설정되지 않았습니다. 환경 변수를 확인해주세요.');
    }

    // GoogleGenerativeAI 클라이언트 생성
    const genAI = new GoogleGenerativeAI(apiKey);
    const selectedModel = GEMINI_MODELS[modelType];
    const model = genAI.getGenerativeModel({ 
      model: selectedModel,
      generationConfig: {
        temperature: temperature,
        maxOutputTokens: 65536, // Flash 최대 토큰 (65,536) 사용
      },
    });

    // 시스템 프롬프트와 사용자 콘텐츠를 결합
    const prompt = `${systemPrompt}\n\n${userContent}`;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error: any) {
    console.error('Gemini API 호출 오류:', error);
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

    const systemPrompt = `당신은 학급 관계 분석 전문가이자 아동 심리 분석 전문가입니다. 교육심리학, 발달심리학, 관계심리학 배경 지식을 활용하여 제공된 학급 정보, 학생 목록, 관계 데이터, 설문지 데이터를 심층 분석해주세요. 교실 내 사회적 역학, 학생 간 관계를 명확하고 통찰력 있게 분석해주세요. 모든 분석 결과는 한글로 작성해야 합니다.

    **중요**: 학생 간 관계 타입은 반드시 다음 한글 용어로 변환하여 사용해주세요:
    - 데이터에서 "friendly"가 나오면 → "친해"로 표현
    - 데이터에서 "wanna_be_close"가 나오면 → "친해질래"로 표현
    - 데이터에서 "neutral"이 나오면 → "괜찮아"로 표현  
    - 데이터에서 "awkward"가 나오면 → "불편해"로 표현
    
    분석 결과에서 영어 용어(friendly, awkward, neutral, wanna_be_close 등)는 절대 사용하지 말고, 반드시 위의 한글 표현으로 변환해서 작성해주세요. 관계를 언급할 때마다 한글 용어만 사용하세요.

    아래 내용을 포함한 구조화된 분석 보고서를 작성해주세요.
    학급 정보에서 학교명, 학년, 반을 추출하여 실제 데이터 기반의 제목을 사용하세요.
    현재 연도도 제목에 포함해주세요.
    
    # [연도] [학교명] [학년][반] 학급 관계 및 심리 분석 보고서
    
    ## 1. 학급 전체 분석
    - 학급의 전반적인 분위기, 특징, 강점과 약점에 대한 분석
    - 학급 심리적 역동성 및 집단적 성향 분석
    
    ## 2. 학생 간 관계 분석
    - 관계 패턴, 주요 이슈, 개선 권장사항
    - 관계 형성의 심리적 기제와 역학 분석
    
    ## 3. 사회적 역학
    - 리더와 추종자, 강한 유대 관계, 고립된 학생들
    - 학급 내 권력 구조 및 영향력 흐름
    - 집단 심리학적 관점에서의 학급 역학 분석
    
    ## 4. 설문 데이터 심층 분석
    - 각 설문지별 특징과 주요 발견점 요약
    - 설문별 응답 경향 및 패턴 분석
    - 주요 질문에 대한 응답 분석 및 학생들의 인식 변화
    
    ## 5. 시간 경과에 따른 변화 상세 분석
    - 설문 날짜를 기준으로 학급 관계 변화 추적
    - 학생 간 관계의 발전 및 변화 양상 분석
    - 기간별 주요 변화 포인트와 원인 분석
    
    ## 6. 교사를 위한 구체적 실행 방안
    
    ### 6.1 학급 환경 및 분위기 개선 전략
    - 학급 관계 개선을 위한 단기(1-2주), 중기(1-2개월), 장기(학기 전체) 계획 제안
    - 심리적 안전감을 높이기 위한 교실 환경 조성 방법
    - 소속감과 공동체 의식을 강화하기 위한 구체적 활동과 루틴 제안
    - 교실 내 갈등 예방 및 해결을 위한 시스템 구축 방안
    - **실행 가능한 활동 제안**: 학급 안전감 규칙 만들기, 아침 인사 루틴, 긍정 피드백 공유 시간 등 실제 교실에서 바로 실행할 수 있는 구체적 활동 3가지 이상 제안
    - **참고 자료 링크**: 각 활동마다 교사가 더 자세히 알아볼 수 있는 한국어 참고 웹사이트나 자료 링크 1-2개 제공 (예: "모닝 서클 활동 - 자세한 방법: [에듀넷 모닝 서클 가이드](https://www.edunet.net/...)" 형식으로)
    
    ### 6.2 교우 관계 촉진 프로그램
    - 학생들 간 긍정적 관계 형성을 위한 구체적인 활동과 게임 제안
    - 협력학습 및 팀 프로젝트를 통한 교우 관계 강화 전략
    - 또래 멘토링 및 버디 시스템 구현 방안
    - 학생 간 상호 이해와 공감 능력을 기르기 위한 프로그램 제안
    - **실행 가능한 활동 제안**: 관계형성 놀이, 협력 게임, 팀 빌딩 활동 등 교실에서 즉시 활용 가능한 놀이와 교육 활동 3가지 이상 (활동명, 방법, 기대효과 포함)
    - **참고 자료 링크**: 각 활동마다 교사가 더 자세히 알아볼 수 있는 한국어 교육 포털, 교사 커뮤니티, 교육청 자료 등의 링크 1-2개 제공
    
    ### 6.3 고립 및 취약 학생 지원 방안
    - 고립된 학생들을 위한 개별화된 지원 전략
    - 사회적 기술 향상을 위한 맞춤형 개입 방법
    - 학급 공동체에 자연스럽게 통합시키기 위한 점진적 접근법
    - 고위험 관계 패턴에 대한 모니터링 및 조기 개입 방안
    - **실행 가능한 활동 제안**: 통합 촉진 놀이, 강점 발견 활동, 소그룹 역할 부여 방법 등 고립 학생 지원을 위한 구체적 놀이와 교육 활동 3가지 이상 상세 제시
    - **참고 자료 링크**: 각 활동에 대한 국내 교육 심리학 또는 상담 관련 자료 링크 제공
    
    ### 6.4 학급 리더십 및 긍정적 영향력 개발
    - 긍정적 또래 리더십을 발굴하고 육성하는 방법
    - 학생 자치 및 의사결정 참여 기회 확대 방안
    - 학급 내 다양한 역할과 책임 부여를 통한 리더십 분산 전략
    - 교사-학생 간 신뢰 관계 구축 및 모델링 접근법
    - **실행 가능한 활동 제안**: 학급 회의 운영 방법, 리더십 훈련 게임, 역할 기반 활동 등 리더십 개발을 위한 구체적 교육 활동 3가지 이상 상세 제시
    - **참고 자료 링크**: 각 활동에 대한 국내 교육 리더십 관련 자료, 교육부 또는 교육청 자료, 아동 발달 관련 웹사이트 링크 제공
    
    모든 제안에는 활동명, 목적, 준비물, 진행 방법, 소요시간, 기대효과 등을 포함하여 교사가 바로 실행할 수 있도록 구체적으로 작성해주세요. 이론적 제안보다는 실제 교실에서 즉시 활용 가능한 구체적인 활동에 중점을 두세요. 참고 자료 링크는 한국 교사들이 쉽게 접근할 수 있는 국내 교육 사이트를 중심으로 제공해주세요 (예: 에듀넷, 학교알리미, 교육부, 교육청, 한국교육개발원, 한국교육학술정보원, 아이스크림 등).
    
    **중요**: 보고서는 반드시 마크다운 형식으로 구조화해주세요:
    - 각 섹션마다 명확한 헤더(#, ##, ###, ####, #####) 사용
    - 내용 구분을 위해 빈 줄 추가
    - 목록은 반드시 "- " 또는 "* " 형식으로 작성
    - 중요한 내용은 **볼드체** 사용
    - 긴 문단은 적절히 줄바꿈하여 가독성 향상
    - 각 활동 제안은 명확히 구분하여 작성
    
    마크다운 형식을 정확히 지켜서 읽기 쉽게 구조화해주세요.`;

    const userContent = `다음 데이터를 기반으로 학급 관계 분석을 진행해주세요: 
    ${JSON.stringify(analysisData, null, 2)}`;

    return await callGemini(systemPrompt, userContent, modelType, 0.7);
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

    const systemPrompt = `당신은 학급 관계 분석 전문가이자 아동 심리 분석 전문가입니다. 교육심리학, 발달심리학, 관계심리학 배경 지식을 활용하여 제공된 학급 정보, 학생 목록, 관계 데이터, 설문지 데이터를 깊이 있고 통찰력 있게 분석해주세요. 교실 내 사회적 역학, 학생 간 관계를 명확하고 풍부하게 분석해 제공해주세요. 모든 분석 결과는 한글로 작성해야 합니다.

    **중요**: 학생 간 관계 타입은 반드시 다음 한글 용어로 변환하여 사용해주세요:
    - 데이터에서 "friendly"가 나오면 → "친해"로 표현
    - 데이터에서 "wanna_be_close"가 나오면 → "친해질래"로 표현
    - 데이터에서 "neutral"이 나오면 → "괜찮아"로 표현  
    - 데이터에서 "awkward"가 나오면 → "불편해"로 표현
    
    분석 결과에서 영어 용어(friendly, awkward, neutral, wanna_be_close 등)는 절대 사용하지 말고, 반드시 위의 한글 표현으로 변환해서 작성해주세요. 관계를 언급할 때마다 한글 용어만 사용하세요.

    아래 내용을 포함한 상세하고 풍부한 분석 보고서를 작성해주세요.
    학급 정보에서 학교명, 학년, 반을 추출하여 실제 데이터 기반의 제목을 사용하세요.
    현재 연도도 제목에 포함해주세요.
    
    # [연도] [학교명] [학년][반] 학급 관계 및 심리 분석 보고서
    
    ## 1. 학급 전체 분석
    - 학급의 전반적인 분위기, 특징, 강점과 약점에 대한 심층 분석
    - 학생들 간의 상호작용 패턴과 그 의미에 대한 해석
    - 학급의 심리적 역동성, 집단적 성향 및 문화적 특성 분석
    - 학급의 사회적 구조와 해당 구조가 학생들의 행동과 발달에 미치는 영향
    - 학급 분위기에 영향을 미치는 주요 요인과 학급 문화의 특성
    
    ## 2. 학생 간 관계 분석
    - 관계 패턴, 관계망의 구조적 특성 및 중심성 분석
    - 주요 이슈, 갈등 요소, 불화의 원인과 그 영향력 상세 분석
    - 긍정적 관계의 특성과 확산 방안에 대한 구체적 제안
    - 관계 형성의 심리적 기제와 역학 분석 (또래 선호도, 우정 형성 패턴 등)
    - 학생 간 관계에서 나타나는 심리적 욕구와 동기에 대한 심층 분석
    - 교실 내 소그룹 형성 패턴과 그 의미에 대한 분석
    
    ## 3. 사회적 역학
    - 리더와 추종자의 특성, 리더십 유형과 영향력 행사 방식 상세 분석
    - 강한 유대 관계를 가진 학생들의 특징과 해당 관계가 학급에 미치는 영향
    - 고립된 학생들의 심리적 상태와 고립 원인에 대한 깊이 있는 분석
    - 학급 내 권력 구조 및 영향력 흐름에 대한 상세 매핑
    - 집단 심리학적 관점에서의 학급 역학 분석 (동조현상, 집단사고, 집단정체성 등)
    - 사회적 지위와 인기도에 따른 학생들의 행동 패턴과 역할 분석
    - 성별, 성격 유형, 학업 능력 등이 사회적 관계에 미치는 영향에 대한 분석
    
    ## 4. 설문 데이터 심층 분석
    - 각 설문지별 주요 발견점, 특이점, 패턴에 대한 심층적 요약
    - 설문별 응답 경향 및 패턴의 심리학적 의미 해석
    - 주요 질문에 대한 응답 분석 및 학생들의 인식 변화에 대한 세부적 해석
    - 설문 응답에서 나타나는 집단적 사고방식과 학급 문화에 대한 통찰
    - 설문 데이터에서 드러나는 숨겨진 패턴과 의미에 대한 심층 분석
    - 설문 응답 간의 상관관계 및 인과관계에 대한 추론
    
    ## 5. 시간 경과에 따른 변화 상세 분석
    - 설문 날짜를 기준으로 학급 관계 변화 추적 및 변화의 의미 분석
    - 학생 간 관계의 발전 및 변화 양상에 대한 다차원적 분석
    - 기간별 주요 변화 포인트와 원인 분석 (학급 내 사건, 교사 개입, 외부 요인 등)
    - 시간에 따른 학급 분위기와 역동성의 변화 패턴 분석
    - 관계 변화의 주요 촉진제와 방해요소에 대한 심층적 고찰
    - 장기적 관점에서의 학급 발달 궤적 예측 및 분석
    
    ## 6. 교사를 위한 구체적 실행 방안
    
    ### 6.1 학급 환경 및 분위기 개선 전략
    - 학급 관계 개선을 위한 단기(1-2주), 중기(1-2개월), 장기(학기 전체) 맞춤형 계획 제안
    - 심리적 안전감을 높이기 위한 교실 환경 조성 방법과 그 실행 단계
    - 소속감과 공동체 의식을 강화하기 위한 구체적 활동과 루틴 (상세 진행법 포함)
    - 교실 내 갈등 예방 및 해결을 위한 체계적 시스템 구축 방안
    - **실행 가능한 활동 제안**: 학급 안전감 규칙 만들기, 아침 인사 루틴, 긍정 피드백 공유 시간 등 실제 교실에서 바로 실행할 수 있는 구체적 활동 5가지 이상 상세 제안 (각 활동마다 목표, 기대효과, 진행방법, 필요한 자료, 소요시간 등 포함)
    - **참고 자료 링크**: 각 활동마다 교사가 더 자세히 알아볼 수 있는 한국어 참고 웹사이트나 자료 링크 1-2개 제공 (예: "모닝 서클 활동 - 자세한 방법: [에듀넷 모닝 서클 가이드](https://www.edunet.net/...)" 형식으로)
    
    ### 6.2 교우 관계 촉진 프로그램
    - 학생들 간 긍정적 관계 형성을 위한 다양하고 구체적인 활동과 게임 제안 (난이도별, 목적별 분류)
    - 협력학습 및 팀 프로젝트를 통한 교우 관계 강화 전략 (구체적인 프로젝트 아이디어 포함)
    - 또래 멘토링 및 버디 시스템 구현 방안 (역할 분배, 진행 방식, 평가 방법 등 포함)
    - 학생 간 상호 이해와 공감 능력을 기르기 위한 프로그램 제안 (연령대별 맞춤 활동)
    - **실행 가능한 활동 제안**: 관계형성 놀이, 협력 게임, 팀 빌딩 활동 등 교실에서 즉시 활용 가능한 놀이와 교육 활동 5가지 이상 (활동명, 대상 연령, 목표, 준비물, 상세 진행 방법, 변형 가능한 방식, 주의사항, 기대효과 등 포함)
    - **참고 자료 링크**: 각 활동마다 교사가 더 자세히 알아볼 수 있는 한국어 교육 포털, 교사 커뮤니티, 교육청 자료 등의 링크 1-2개 제공
    
    ### 6.3 고립 및 취약 학생 지원 방안
    - 고립된 학생들을 위한 개별화된 지원 전략과 단계별 접근법
    - 사회적 기술 향상을 위한 맞춤형 개입 방법 및 구체적인 훈련 프로그램
    - 학급 공동체에 자연스럽게 통합시키기 위한 점진적 접근법과 실행 단계
    - 고위험 관계 패턴에 대한 모니터링 및 조기 개입 방안 (경고 신호 및 대응 방법)
    - **실행 가능한 활동 제안**: 통합 촉진 놀이, 강점 발견 활동, 소그룹 역할 부여 방법 등 고립 학생 지원을 위한 구체적 놀이와 교육 활동 5가지 이상 상세 제시 (각 활동별 심리적 근거, 기대효과, 주의사항 포함)
    - **참고 자료 링크**: 각 활동에 대한 국내 교육 심리학 또는 상담 관련 자료 링크 제공
    
    ### 6.4 학급 리더십 및 긍정적 영향력 개발
    - 긍정적 또래 리더십을 발굴하고 육성하는 구체적인 방법과 프로그램
    - 학생 자치 및 의사결정 참여 기회 확대 방안과 실제 적용 사례
    - 학급 내 다양한 역할과 책임 부여를 통한 리더십 분산 전략 (역할 목록과 실행 방법 포함)
    - 교사-학생 간 신뢰 관계 구축 및 모델링 접근법 (구체적인 상호작용 방식 제안)
    - **실행 가능한 활동 제안**: 학급 회의 운영 방법, 리더십 훈련 게임, 역할 기반 활동 등 리더십 개발을 위한 구체적 교육 활동 5가지 이상 상세 제시 (단계별 진행 방법, 평가 방법 포함)
    - **참고 자료 링크**: 각 활동에 대한 국내 교육 리더십 관련 자료, 교육부 또는 교육청 자료, 아동 발달 관련 웹사이트 링크 제공
    
    모든 제안에는 활동명, 목적, 준비물, 진행 방법, 소요시간, 기대효과, 발달심리학적/교육심리학적 근거 등을 포함하여 교사가 바로 실행할 수 있도록 구체적으로 작성해주세요. 이론적 제안보다는 실제 교실에서 즉시 활용 가능한 구체적인 활동에 중점을 두세요. 참고 자료 링크는 한국 교사들이 쉽게 접근할 수 있는 국내 교육 사이트를 중심으로 제공해주세요 (예: 에듀넷, 학교알리미, 교육부, 교육청, 한국교육개발원, 한국교육학술정보원, 아이스크림 등).
    
    **중요**: 보고서는 반드시 마크다운 형식으로 구조화해주세요:
    - 각 섹션마다 명확한 헤더(#, ##, ###, ####, #####) 사용
    - 내용 구분을 위해 빈 줄 추가
    - 목록은 반드시 "- " 또는 "* " 형식으로 작성
    - 중요한 내용은 **볼드체** 사용
    - 긴 문단은 적절히 줄바꿈하여 가독성 향상
    - 각 활동 제안은 명확히 구분하여 작성
    
    마크다운 형식을 정확히 지켜서 읽기 쉽게 구조화해주세요.`;

    const userContent = `다음 데이터를 기반으로 학급 종합 분석을 진행해주세요: 
    ${JSON.stringify(analysisData, null, 2)}`;

    return await callGemini(systemPrompt, userContent, modelType, 0.7);
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

    const systemPrompt = `당신은 학급 관계 분석, 학생 개인별 심리 분석, 학생 교육 놀이 및 활동에 관련 전세계 모든 지식을 파악한 수준의 전문가입니다. 교육심리학, 발달심리학, 관계심리학 지식을 활용하여 제공된 학생 그룹의 학생들을 개별적으로 분석해주세요. 모든 분석 결과는 한글로 작성해야 합니다.

    **중요**: 학생 간 관계 타입은 반드시 다음 한글 용어로 변환하여 사용해주세요:
    - 데이터에서 "friendly"가 나오면 → "친해"로 표현
    - 데이터에서 "wanna_be_close"가 나오면 → "친해질래"로 표현
    - 데이터에서 "neutral"이 나오면 → "괜찮아"로 표현  
    - 데이터에서 "awkward"가 나오면 → "불편해"로 표현
    
    분석 결과에서 영어 용어(friendly, awkward, neutral, wanna_be_close 등)는 절대 사용하지 말고, 반드시 위의 한글 표현으로 변환해서 작성해주세요. 관계를 언급할 때마다 한글 용어만 사용하세요.

    **절대 준수사항**: 
    1. 반드시 각 학생의 이름을 ### 헤더로 명확히 시작하세요
    2. 모든 학생에 대해 아래 구조를 정확히 동일하게 따르세요
    3. 어떤 섹션도 생략하지 말고 순서를 바꾸지 마세요
    4. 각 학생 분석 후에는 반드시 "---" 구분선을 넣으세요
    5. **중요**: 각 섹션은 핵심만 간결하게! 토큰 한계 내에서 모든 학생을 완성하세요
    6. 장황한 설명 금지! 핵심 포인트만 명확하게 작성하세요
                      
    **반드시 다음 구조를 정확히 따라주세요:**

    ### [학생 이름]
    
    #### 1. 심리적 특성 분석
    - 심리적 특성 및 발달 단계 분석 (2-3줄)
    - 성격 유형 및 행동 패턴 (2-3줄)
    
    #### 2. 관계 분석
    - 사회적 위치와 영향력 (2-3줄)
    - 관계 패턴 및 주요 교우 관계 (2-3줄)
    
    #### 3. 강점과 과제
    - 강점과 잠재력 (2-3줄)
    - 직면한 어려움 또는 도전 과제 (2-3줄)
    
    #### 4. 발전을 위한 구체적 제안
    
    **4.1 사회적 관계 개선 활동**
    - 구체적 활동 1가지만 간단히 제안 (1-2줄)
    
    **4.2 심리적 성장 지원**  
    - 구체적 방안 1가지만 간단히 제안 (1-2줄)
    
    **4.3 학업 및 인지 발전**
    - 구체적 전략 1가지만 간단히 제안 (1-2줄)
    
    **4.4 장기적 성장 지원**
    - 구체적 지원 방법 1가지만 간단히 제안 (1-2줄)
    
    ---
    
    ### [다음 학생 이름]
    
    (위와 정확히 동일한 구조로 반복)

    **주의**: 각 학생마다 위 구조를 정확히 지키고, 너무 길게 쓰지 말고 간결하게 작성하세요. 학생 이름을 절대 빠뜨리지 마세요.
    
    **중요**: 보고서는 반드시 마크다운 형식으로 구조화해주세요:
    - 각 섹션마다 명확한 헤더(#, ##, ###, ####, #####) 사용
    - 내용 구분을 위해 빈 줄 추가
    - 목록은 반드시 "- " 또는 "* " 형식으로 작성
    - 중요한 내용은 **볼드체** 사용
    - 긴 문단은 적절히 줄바꿈하여 가독성 향상
    - 각 학생 분석은 ### 헤더로 명확히 구분
    - 학생 간 구분을 위해 구분선(---) 사용
    
    마크다운 형식을 정확히 지켜서 읽기 쉽게 구조화해주세요.

    각 활동 제안은 더 구체적이고 실행 가능하게 작성해주세요:
    1. 활동 이름을 명확하게 기재
    2. 활동 목적과 기대효과를 상세히 설명
    3. 준비물과 진행 방법을 단계별로 제시
    4. 예상 소요시간 및 적절한 학생 그룹 크기 제안
    5. 가능한 경우 참고할 수 있는 자료 링크 포함 (한국어 자료 우선)
    
    교사가 즉시 실행할 수 있는 수준의 상세한 안내를 제공해주세요.`;

    const userContent = `다음 데이터를 기반으로 학생 그룹 ${groupIndex}의 각 학생에 대한 분석을 진행해주세요.

    **중요 지시사항:**
    1. 반드시 각 학생의 이름을 ### 헤더로 시작하세요
    2. 모든 학생에 대해 동일한 구조를 유지하세요  
    3. **핵심만 간결하게!** 각 섹션당 2-3줄, 활동 제안은 1-2줄로 제한
    4. 토큰 한계 내에서 모든 학생 분석을 완료하세요
    5. 학생 간 구분을 위해 "---" 사용하세요
    
    데이터: 
    ${JSON.stringify(analysisData, null, 2)}`;

    return await callGemini(systemPrompt, userContent, modelType, 0.7);
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

    const systemPrompt = `당신은 초등학교·중학교·고등학교 생활기록부 작성 경력이 20년 이상인 베테랑 교사입니다. 학생들에 대한 생활기록부 문구를 작성해주세요.
    
    **중요**: 학생 간 관계 타입은 반드시 다음 한글 용어로 변환하여 사용해주세요:
    - 데이터에서 "friendly"가 나오면 → "친해"로 표현
    - 데이터에서 "wanna_be_close"가 나오면 → "친해질래"로 표현
    - 데이터에서 "neutral"이 나오면 → "괜찮아"로 표현  
    - 데이터에서 "awkward"가 나오면 → "불편해"로 표현
    
    분석 결과에서 영어 용어(friendly, awkward, neutral, wanna_be_close 등)는 절대 사용하지 말고, 반드시 위의 한글 표현으로 변환해서 작성해주세요. 관계를 언급할 때마다 한글 용어만 사용하세요.
    
    제공된 학급 정보, 학생 목록, 관계 데이터, 설문지 응답 등을 종합적으로 분석하여 각 학생별로 약 1000자 분량의 생활기록부 문구를 작성해주세요.
    
    생활기록부 문구는 다음 사항을 포함해야 합니다:
    1. 학생의 성격, 행동 특성, 정서적 측면에 대한 객관적 서술
    2. 교우 관계 및 학급 내 사회성 발달 상황
    3. 학생의 강점과 특기사항
    4. 학생의 태도, 가치관, 인성 등에 대한 관찰 내용
    5. 미래 성장 가능성 및 발전 방향
    
    생활기록부 문구 작성 시 주의사항:
    - 객관적인 사실을 바탕으로 기술하되, 긍정적인 서술어 사용
    - 부정적 특성은 '발전 가능성'이나 '노력 중인 부분'으로 완곡하게 표현
    - 구체적인 사례나 관찰 내용을 포함하여 신뢰성 높은 문구 작성
    - 교육적 관점에서 학생의 성장을 지원하는 방향으로 서술
    - 문법적으로 정확하고 맞춤법에 오류가 없도록 작성
    - 교육 분야에서 사용되는 전문적인 용어를 적절히 활용
    - 학생별로 비슷한 표현이 반복되지 않도록 다양한 어휘 사용
    
    다음 형식으로 결과를 제공해주세요:
    
    # 학생별 생활기록부 문구
    
    ## [학생1 이름]
    
    [학생1에 대한 1000자 내외의 생활기록부 문구]
    
    ## [학생2 이름]
    
    [학생2에 대한 1000자 내외의 생활기록부 문구]
    
    ## [학생3 이름]
    
    [학생3에 대한 1000자 내외의 생활기록부 문구]
    
    ...
    
    **중요**: 생활기록부는 반드시 마크다운 형식으로 구조화해주세요:
    - 각 학생마다 ## 헤더로 명확히 구분
    - 학생 간 구분을 위해 빈 줄 추가
    - 긴 문단은 적절히 줄바꿈하여 가독성 향상
    - 중요한 특성은 **볼드체** 사용
    - 각 학생 문구는 명확히 분리하여 작성
    
    마크다운 형식을 정확히 지켜서 읽기 쉽게 구조화해주세요.
    
    모든 문구는 한글로 작성해야 합니다.`;

    const userContent = `다음 데이터를 기반으로 각 학생별 생활기록부 문구를 작성해주세요: 
    ${JSON.stringify(analysisData, null, 2)}`;

    return await callGemini(systemPrompt, userContent, modelType, 0.7);
  } catch (error: any) {
    console.error('Gemini 생활기록부 생성 API 호출 오류:', error);
    throw error;
  }
} 