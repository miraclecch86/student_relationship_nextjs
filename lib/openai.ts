import { Student, Question, Answer, Relationship, Survey } from './supabase';

// OpenAI 모델 상수 정의
const OPENAI_MODEL = 'gpt-4o';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// API 응답 타입 정의
interface OpenAIResponse {
  analysis: string;
  relationships: {
    description: string;
    issues?: string[];
    recommendations?: string[];
  };
  socialDynamics: {
    description: string;
    strongConnections?: string[];
    isolatedStudents?: string[];
  };
  individualAnalysis?: {
    students: Array<{
      name: string;
      socialPosition: string;
      strengths: string[];
      challenges: string[];
      suggestions: string[];
    }>;
    message?: string;
  };
  classroomEnvironment?: {
    overall: string;
    positiveAspects: string[];
    challengingAreas: string[];
    improvementSuggestions: string[];
  };
  timelineProjection?: {
    shortTerm: string;
    midTerm: string;
    longTerm: string;
    keyMilestones: string[];
  };
}

// OpenAI API 호출을 위한 공통 함수
async function callOpenAI(model: string = OPENAI_MODEL, systemPrompt: string, userContent: string, temperature: number = 0.7, maxTokens: number = 10000): Promise<string> {
  try {
    // 환경 변수에서 API 키 가져오기
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error('OpenAI API 키가 설정되지 않았습니다. 환경 변수를 확인해주세요.');
      console.error('환경 변수 OPENAI_API_KEY를 .env.local 파일과 Vercel 프로젝트 설정에 추가해야 합니다.');
      console.error('현재 환경 변수 키 목록:', Object.keys(process.env).filter(key => !key.includes('SECRET')));
      throw new Error('OpenAI API 키가 설정되지 않았습니다. 환경 변수를 확인해주세요.');
    }

    // OpenAI API 요청 설정
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userContent
          }
        ],
        temperature: temperature,
        max_tokens: maxTokens
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API 오류: ${errorData.error?.message || response.statusText}`);
    }

    const result = await response.json();
    return result.choices[0].message.content;
  } catch (error: any) {
    console.error('OpenAI API 호출 오류:', error);
    throw error;
  }
}

// 학생 관계 분석을 위한 OpenAI API 호출 함수
export async function analyzeStudentRelationships(
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
  }
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

    const systemPrompt = `당신은 학급 관계 분석 전문가이자 아동 심리 분석 전문가입니다. 교육심리학, 발달심리학, 관계심리학 배경 지식을 활용하여 제공된 학급 정보, 학생 목록, 관계 데이터, 설문지 데이터를 깊이 있고 통찰력 있게 분석해주세요. 교실 내 사회적 역학, 학생 간 관계를 명확하고 풍부하게 분석해 제공해주세요. 모든 분석 결과는 한글로 작성해야 합니다.

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
    
    보고서는 마크다운 형식을 활용하여 구조화하고, 헤더(#, ##, ###, ####, #####)와 목록(-, *)을 적절히 사용하여 가독성을 높여주세요. 각 섹션별로 핵심 요약을 먼저 제시한 후 상세 내용을 전개하는 방식으로 구성하여 쉽게 읽을 수 있게 해주세요. 중요한 인사이트나 제안은 **강조 표시**를 활용하여 눈에 띄게 만들어주세요.`;

    const userContent = `다음 데이터를 기반으로 학급 전체에 대한 분석을 진행해주세요: 
    ${JSON.stringify(analysisData, null, 2)}`;

    return await callOpenAI(OPENAI_MODEL, systemPrompt, userContent, 0.7, 10000);
  } catch (error: any) {
    console.error('analyzeStudentRelationships API 호출 오류:', error);
    throw error;
  }
}

// 설문 결과에 대한 요약 분석 함수
export async function analyzeSurveyResults(
  survey: Survey,
  students: Student[],
  answers: Answer[],
  questions: Question[]
): Promise<string> {
  try {
    // 분석에 필요한 데이터 준비
    const surveyData = {
      surveyName: survey.name,
      surveyDescription: survey.description,
      questions: questions.map(q => q.question_text),
      responses: students.map(student => {
        const studentAnswers = answers.filter(a => a.student_id === student.id)
          .map(a => {
            const question = questions.find(q => q.id === a.question_id);
            return {
              question: question?.question_text || '',
              answer: a.answer_text || ''
            };
          });
        
        return {
          student: student.name,
          answers: studentAnswers
        };
      })
    };

    const systemPrompt = `당신은 교육 데이터 분석 전문가입니다. 제공된 설문 데이터(설문지명: ${surveyData.surveyName}, 설명: ${surveyData.surveyDescription})를 심층 분석하여, 주요 응답 경향, 학생들의 인식 변화, 그리고 잠재적인 문제점을 명확히 식별하고, 이를 개선하기 위한 구체적이고 실행 가능한 권장 사항을 최소 3가지 이상 제시해주세요. **모든 분석 결과와 권장 사항은 반드시 한글로 작성해주시고, 이전 설문 결과가 있다면 시간 경과에 따른 변화도 함께 언급해주세요.** 응답은 명확하고 간결한 요약 형태로 제공되어야 합니다.`;

    const userContent = `다음 설문 데이터를 분석하고 주요 결과와 인사이트를 요약해주세요: 
    ${JSON.stringify(surveyData, null, 2)}`;

    return await callOpenAI(OPENAI_MODEL, systemPrompt, userContent, 0.5, 10000);
  } catch (error) {
    console.error('설문 분석 오류:', error);
    throw error;
  }
}

// 종합분석을 위한 함수 (전체 학급에 대한 통찰과 주요 패턴)
export async function analyzeClassOverview(
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
  }
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
    
    보고서는 마크다운 형식을 활용하여 구조화하고, 헤더(#, ##, ###, ####, #####)와 목록(-, *)을 적절히 사용하여 가독성을 높여주세요. 각 섹션별로 핵심 요약을 먼저 제시한 후 상세 내용을 전개하는 방식으로 구성하여 쉽게 읽을 수 있게 해주세요. 중요한 인사이트나 제안은 **강조 표시**를 활용하여 눈에 띄게 만들어주세요.`;

    const userContent = `다음 데이터를 기반으로 학급 전체에 대한 분석을 진행해주세요: 
    ${JSON.stringify(analysisData, null, 2)}`;

    return await callOpenAI(OPENAI_MODEL, systemPrompt, userContent, 0.7, 10000);
  } catch (error: any) {
    console.error('analyzeClassOverview API 호출 오류:', error);
    throw error;
  }
}

// 학생 그룹별 분석 함수 (특정 학생 그룹에 집중)
export async function analyzeStudentGroup(
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
  }
): Promise<string> {
  try {
    // 학생 목록이 이미 그룹화되어 있으므로 추가 그룹화 처리 제거
    const studentGroup = students;
    
    if (studentGroup.length === 0) {
      return `# 학생 그룹 ${groupIndex} 분석\n\n이 그룹에 해당하는 학생이 없습니다.`;
    }
    
    // 선택된 학생 그룹에 대한 정보와 관계만 필터링
    const studentIds = studentGroup.map(s => s.id);
    const filteredRelationships = relationships.filter(r => 
      studentIds.includes(r.from_student_id) || studentIds.includes(r.to_student_id)
    );
    
    const filteredAnswers = answers ? answers.filter(a => 
      studentIds.includes(a.student_id)
    ) : [];
    
    // 전체 학생 목록 (참조용)
    const allStudents = additionalData?.allStudents || students;
    
    // 분석 데이터 준비
    const analysisData = {
      class: additionalData?.classDetails || { id: "unknown" },
      
      // 선택된 학생 그룹
      students: studentGroup.map(s => ({
        id: s.id,
        name: s.name,
        gender: s.gender,
        display_order: s.display_order
      })),
      
      // 전체 학생 정보 (참조용)
      allStudents: allStudents.map(s => ({
        id: s.id,
        name: s.name,
        gender: s.gender
      })),
      
      // 필터링된 관계
      relationships: filteredRelationships.map(r => ({
        from: allStudents.find(s => s.id === r.from_student_id)?.name || r.from_student_id,
        fromId: r.from_student_id,
        to: allStudents.find(s => s.id === r.to_student_id)?.name || r.to_student_id,
        toId: r.to_student_id,
        type: r.relation_type
      })),
      
      // 필터링된 질문&응답
      questions: questions ? questions.map(q => ({
        id: q.id,
        text: q.question_text
      })) : [],
      
      answers: filteredAnswers.map(a => {
        const question = questions?.find(q => q.id === a.question_id);
        const student = students.find(s => s.id === a.student_id);
        return {
          student: student?.name || a.student_id,
          question: question?.question_text || a.question_id,
          answer: a.answer_text
        };
      }),
      
      // 그룹 정보
      groupInfo: {
        index: groupIndex,
        startIdx: (groupIndex - 1) * 5, // 기본 그룹 크기인 5를 사용
        endIdx: (groupIndex - 1) * 5 + studentGroup.length,
        total: Math.ceil((allStudents.length) / 5) // 전체 그룹 수
      }
    };

    const systemPrompt = `너는 대한민국 초등학교의 15년 차 베테랑 담임교사다. 너의 임무는 각 학생의 학교생활기록부의 [행동특성 및 종합의견] 항목을 매우 심층적이고 개별화된 내용으로 작성하는 것이다. 

너는 학생의 다양한 데이터(친구 관계, 설문 응답, 교사 관찰 내용 등)를 종합적으로 분석하고, 단순한 사실 나열을 넘어 학생의 잠재력, 성장 과정, 그리고 개선이 필요한 부분까지도 긍정적이고 건설적인 시각으로 구체적인 사례를 들어 서술한다. 기계적이거나 일반적인 표현은 절대 사용하지 않으며, 학생 한 명 한 명에게 진심을 담아 작성한다.

## 작성 지침

### 1. 데이터의 맥락적 활용
- **모든 정보를 단순 나열하지 말고, 각 정보 간의 연관성을 깊이 있게 분석하고 통합하여 학생 특성을 다각도로 해석하고 서술하세요.**
- **예시**: "친구 관계 데이터에서 김○○가 다수의 학생에게 '친해지고 싶다'는 응답을 받았고, 동시에 설문에서 본인은 '혼자 있는 것이 편하다'고 답한 점을 연결하여 분석 → '겉으로는 차분해 보이지만 내면에는 친구들과 깊이 소통하고 싶은 마음이 가득한 학생으로, 친구들도 그런 진정성을 느끼고 다가가고 싶어하는 매력을 지니고 있음'"
- **학생 설문 답변과 실제 관계 패턴, 교사 관찰 내용 간의 일치점/불일치점을 통해 학생 내면을 심층적으로 이해하고 이를 반영하세요.**
- **시간의 흐름에 따른 변화도 추적하여 성장 스토리를 구성하세요.**

### 2. 내용의 차별성 및 구체성 확보
- **추상적 표현을 지양하고, 구체적인 행동/발언/경험을 근거로 제시하세요.**
  - ❌ "활발한 성격을 보인다" 
  - ✅ "쉬는 시간마다 친구들에게 먼저 다가가 '같이 놀자'고 제안하며, 새로 전학 온 친구에게도 망설임 없이 손을 내밀어 자연스럽게 무리에 합류시키는 모습을 보인다"
- **학생 고유의 강점, 약점(개선점), 성장 과정, 잠재력이 드러나도록 개별화된 내용을 생성하세요.**
- **다른 학생과 내용이 중복되거나 유사하지 않도록 창의적으로 작성하세요.**
- **개선점은 건설적이고 긍정적인 언어로 표현하되, 구체적인 성장 방향을 제시하세요.**

### 3. 기타 요건
- **문장 스타일**: 정중하면서도 따뜻한 교사의 시선으로, 객관적 관찰과 애정어린 분석이 조화된 문체
- **어조**: 긍정적이고 건설적이며, 학생의 성장 가능성에 대한 믿음이 담긴 어조
- **분량**: 약 800-1200자 (학생당)
- **시간 흐름 반영**: 여러 시점의 데이터가 있다면 학생의 변화와 성장 과정을 시간순으로 서술
- **개별성 강조**: 각 학생만의 독특한 특성과 개성이 잘 드러나도록 서술

### 4. 서술 구조 (각 학생마다)
1. **도입**: 학생의 가장 인상적인 특성이나 변화 포착
2. **관계적 특성**: 친구 관계에서 보이는 패턴과 그 의미
3. **내면적 특성**: 설문 답변과 행동 관찰을 통해 본 내면의 모습
4. **성장 스토리**: 시간에 따른 변화와 발전 과정
5. **잠재력과 방향성**: 미래 성장 가능성과 지원 방향

## 결과물 (Output)

한국어로 작성된 각 학생별 생활기록부 문구를 다음 형식으로 제공:

# 학생별 생활기록부 문구

## [학생1 이름]

[해당 학생에 대한 800-1200자의 심층적이고 개별화된 생활기록부 문구]

## [학생2 이름]  

[해당 학생에 대한 800-1200자의 심층적이고 개별화된 생활기록부 문구]

...

**주의사항**: 
- 모든 내용은 제공된 실제 데이터에 기반해야 하며, 추측이나 가정은 배제
- 학생의 인권과 존엄성을 존중하는 표현 사용
- 부정적 내용도 성장의 관점에서 건설적으로 서술
- 각 학생의 고유성이 충분히 드러나도록 차별화된 내용 작성`;

    const userContent = `다음 데이터를 기반으로 학생 그룹 ${groupIndex}의 각 학생에 대한 상세 분석을 진행해주세요: 
    ${JSON.stringify(analysisData, null, 2)}`;

    return await callOpenAI(OPENAI_MODEL, systemPrompt, userContent, 0.7, 10000);
  } catch (error: any) {
    console.error(`analyzeStudentGroup(${groupIndex}) API 호출 오류:`, error);
    throw error;
  }
}

// 학생 생활기록부 문구 생성 함수
export async function generateSchoolRecord(
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
  }
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

    const systemPrompt = `너는 대한민국 초등학교의 15년 차 베테랑 담임교사다. 너의 임무는 각 학생의 학교생활기록부의 [행동특성 및 종합의견] 항목을 매우 심층적이고 개별화된 내용으로 작성하는 것이다. 

너는 학생의 다양한 데이터(친구 관계, 설문 응답, 교사 관찰 내용 등)를 종합적으로 분석하고, 단순한 사실 나열을 넘어 학생의 잠재력, 성장 과정, 그리고 개선이 필요한 부분까지도 긍정적이고 건설적인 시각으로 구체적인 사례를 들어 서술한다. 기계적이거나 일반적인 표현은 절대 사용하지 않으며, 학생 한 명 한 명에게 진심을 담아 작성한다.

## 작성 지침

### 1. 데이터의 맥락적 활용
- **모든 정보를 단순 나열하지 말고, 각 정보 간의 연관성을 깊이 있게 분석하고 통합하여 학생 특성을 다각도로 해석하고 서술하세요.**
- **예시**: "친구 관계 데이터에서 김○○가 다수의 학생에게 '친해지고 싶다'는 응답을 받았고, 동시에 설문에서 본인은 '혼자 있는 것이 편하다'고 답한 점을 연결하여 분석 → '겉으로는 차분해 보이지만 내면에는 친구들과 깊이 소통하고 싶은 마음이 가득한 학생으로, 친구들도 그런 진정성을 느끼고 다가가고 싶어하는 매력을 지니고 있음'"
- **학생 설문 답변과 실제 관계 패턴, 교사 관찰 내용 간의 일치점/불일치점을 통해 학생 내면을 심층적으로 이해하고 이를 반영하세요.**
- **시간의 흐름에 따른 변화도 추적하여 성장 스토리를 구성하세요.**

### 2. 내용의 차별성 및 구체성 확보
- **추상적 표현을 지양하고, 구체적인 행동/발언/경험을 근거로 제시하세요.**
  - ❌ "활발한 성격을 보인다" 
  - ✅ "쉬는 시간마다 친구들에게 먼저 다가가 '같이 놀자'고 제안하며, 새로 전학 온 친구에게도 망설임 없이 손을 내밀어 자연스럽게 무리에 합류시키는 모습을 보인다"
- **학생 고유의 강점, 약점(개선점), 성장 과정, 잠재력이 드러나도록 개별화된 내용을 생성하세요.**
- **다른 학생과 내용이 중복되거나 유사하지 않도록 창의적으로 작성하세요.**
- **개선점은 건설적이고 긍정적인 언어로 표현하되, 구체적인 성장 방향을 제시하세요.**

### 3. 기타 요건
- **문장 스타일**: 정중하면서도 따뜻한 교사의 시선으로, 객관적 관찰과 애정어린 분석이 조화된 문체
- **어조**: 긍정적이고 건설적이며, 학생의 성장 가능성에 대한 믿음이 담긴 어조
- **분량**: 약 800-1200자 (학생당)
- **시간 흐름 반영**: 여러 시점의 데이터가 있다면 학생의 변화와 성장 과정을 시간순으로 서술
- **개별성 강조**: 각 학생만의 독특한 특성과 개성이 잘 드러나도록 서술

### 4. 서술 구조 (각 학생마다)
1. **도입**: 학생의 가장 인상적인 특성이나 변화 포착
2. **관계적 특성**: 친구 관계에서 보이는 패턴과 그 의미
3. **내면적 특성**: 설문 답변과 행동 관찰을 통해 본 내면의 모습
4. **성장 스토리**: 시간에 따른 변화와 발전 과정
5. **잠재력과 방향성**: 미래 성장 가능성과 지원 방향

## 결과물 (Output)

한국어로 작성된 각 학생별 생활기록부 문구를 다음 형식으로 제공:

# 학생별 생활기록부 문구

## [학생1 이름]

[해당 학생에 대한 800-1200자의 심층적이고 개별화된 생활기록부 문구]

## [학생2 이름]  

[해당 학생에 대한 800-1200자의 심층적이고 개별화된 생활기록부 문구]

...

**주의사항**: 
- 모든 내용은 제공된 실제 데이터에 기반해야 하며, 추측이나 가정은 배제
- 학생의 인권과 존엄성을 존중하는 표현 사용
- 부정적 내용도 성장의 관점에서 건설적으로 서술
- 각 학생의 고유성이 충분히 드러나도록 차별화된 내용 작성`;

    const userContent = `다음 데이터를 기반으로 각 학생별 생활기록부 문구를 작성해주세요. 

**중요**: 각 학생의 데이터를 맥락적으로 분석하여 단순 나열이 아닌 깊이 있는 해석을 제공해주세요.

분석 데이터:
${JSON.stringify(analysisData, null, 2)}

각 학생의 관계 패턴, 설문 응답의 시간적 변화, 그리고 학급 내 위치를 종합적으로 고려하여 개별화된 생활기록부를 작성해주세요.`;

    return await callOpenAI(OPENAI_MODEL, systemPrompt, userContent, 0.7, 10000);
  } catch (error: any) {
    console.error('생활기록부 생성 API 호출 오류:', error);
    throw error;
  }
}