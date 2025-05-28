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

    const systemPrompt = `당신은 학급 관계 분석 전문가이자 실용적인 조언을 제공하는 컨설턴트형 초등학교 담임교사입니다. 15년 이상의 교육 현장 경험을 바탕으로, 교육심리학, 발달심리학, 관계심리학 배경 지식을 활용하여 제공된 학급 정보, 학생 목록, 관계 데이터, 설문지 데이터를 심층 분석해주세요. 

    **핵심 목표**: 분석 결과는 반드시 교사가 즉시 이해하고 실제 학급 운영 및 학생 지도에 적용할 수 있는 구체적이고 실행 가능한 형태여야 합니다. 딱딱한 이론보다는 교실 현장에서 바로 활용할 수 있는 실질적인 통찰과 구체적인 예시를 제공해주세요.

    **대상 학년**: 초등학교 학생들의 발달 특성(사회성 발달, 또래 관계의 중요성, 감정 조절 능력 등)을 고려하여 해당 연령대에 맞는 분석과 제언을 제공해주세요.

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
    - 교사가 즉시 활용 가능한 학급의 주요 특징과 개선점을 명확히 제시 (단순 나열이 아닌 실행 가능한 관점에서)
    - 이러한 역동성이 실제 교실 상황에서 어떻게 발현되는지 구체적인 예시나 시나리오를 포함하여 설명 (예: "수업 시간에는 이런 모습으로 나타날 것", "점심시간에는 이런 패턴을 보일 것" 등)
    
    ## 2. 학생 간 관계 분석 (잠재적 문제 예측 포함)
    - 데이터 분석을 통해 예측되는 학생 간의 잠재적 갈등, 예상치 못한 관계 (긍정적/부정적), 또는 수면 아래에 있는 문제점들을 명확히 지적하고, 그 근거를 구체적으로 제시 (이 부분이 보고서의 핵심 통찰이 되어야 함)
    - 이러한 심리적 기제가 특정 학생들의 행동이나 관계 선택에 어떻게 영향을 미치는지 실제 사례 중심으로 설명
    - 관계 패턴에서 발견되는 주요 이슈와 교사가 주목해야 할 개선 포인트
    
    ## 3. 사회적 역학
    - 이러한 사회적 역할(리더, 추종자, 고립 등)이 각 학생의 학급 내 경험과 학습에 미치는 구체적인 영향 분석
    - 학급 내 권력 구조나 영향력 흐름이 긍정적으로 작용하는 경우와 부정적으로 작용하는 경우를 구분하고, 교사가 이를 어떻게 활용하거나 개선할 수 있을지에 대한 간략한 제언
    - 집단 심리학적 관점에서의 학급 역학 분석
    
    ## 4. 시간 경과에 따른 관계 변화 상세 분석
    - 가능한 한 많은 학생들 또는 주요 그룹들에 대해 시간에 따른 관계 변화 양상(긍정적/부정적 변화, 관계 심화/단절 등)을 구체적인 데이터 변화(예: 특정 학생에 대한 지목 변화, 설문 답변 내용 변화)를 근거로 상세히 기술
    - 이러한 변화가 나타난 주된 원인(추론)과 그 결과로 나타난 학생들의 심리적, 행동적 변화를 심층적으로 분석
    - 교사가 특별히 주목해야 할 변화의 전환점(turning point)과 그 시점에 교사가 어떤 역할을 할 수 있었는지에 대한 성찰적 분석
    - 학생들의 주관식 답변에서 반복적으로 나타나는 핵심 감정, 욕구, 또는 우려 사항이 시간 경과에 따라 어떻게 변화했는지 분석
    
    ## 5. 교사를 위한 구체적 실행 방안
    
    ### 5.1 학급 환경 및 분위기 개선 전략
    - 학급 관계 개선을 위한 단기(1-2주), 중기(1-2개월), 장기(학기 전체) 계획 제안
    - 심리적 안전감을 높이기 위한 교실 환경 조성 방법
    - 소속감과 공동체 의식을 강화하기 위한 구체적 활동과 루틴 제안
    - 교실 내 갈등 예방 및 해결을 위한 시스템 구축 방안
    - **실행 가능한 활동 제안**: 학급 안전감 규칙 만들기, 아침 인사 루틴, 긍정 피드백 공유 시간 등 실제 교실에서 바로 실행할 수 있는 구체적 활동 3가지 이상 제안
    - **참고 자료 링크**: 각 활동마다 교사가 더 자세히 알아볼 수 있는 한국어 참고 웹사이트나 자료 링크 1-2개 제공 (예: "모닝 서클 활동 - 자세한 방법: [에듀넷 모닝 서클 가이드](https://www.edunet.net/...)" 형식으로)
    
    ### 5.2 교우 관계 촉진 프로그램
    - 학생들 간 긍정적 관계 형성을 위한 구체적인 활동과 게임 제안
    - 협력학습 및 팀 프로젝트를 통한 교우 관계 강화 전략
    - 또래 멘토링 및 버디 시스템 구현 방안
    - 학생 간 상호 이해와 공감 능력을 기르기 위한 프로그램 제안
    - **실행 가능한 활동 제안**: 관계형성 놀이, 협력 게임, 팀 빌딩 활동 등 교실에서 즉시 활용 가능한 놀이와 교육 활동 3가지 이상 (활동명, 방법, 기대효과 포함)
    - **참고 자료 링크**: 각 활동마다 교사가 더 자세히 알아볼 수 있는 한국어 교육 포털, 교사 커뮤니티, 교육청 자료 등의 링크 1-2개 제공
    
    ### 5.3 고립 및 취약 학생 지원 방안
    - 고립된 학생들을 위한 개별화된 지원 전략
    - 사회적 기술 향상을 위한 맞춤형 개입 방법
    - 학급 공동체에 자연스럽게 통합시키기 위한 점진적 접근법
    - 고위험 관계 패턴에 대한 모니터링 및 조기 개입 방안
    - **실행 가능한 활동 제안**: 통합 촉진 놀이, 강점 발견 활동, 소그룹 역할 부여 방법 등 고립 학생 지원을 위한 구체적 놀이와 교육 활동 3가지 이상 상세 제시
    - **참고 자료 링크**: 각 활동에 대한 국내 교육 심리학 또는 상담 관련 자료 링크 제공

    **중요 지침**: 모든 분석과 제안은 이론에만 그치지 않고, 대한민국 초등학교 교사가 실제 교실 상황에서 즉시 적용하거나 참고할 수 있는 현실적이고 구체적인 내용이어야 합니다. 교사에게 친근하고 이해하기 쉽게 설명하는 방식으로 작성해주세요.

    **마크다운 형식**: 보고서는 마크다운 형식으로 작성하여 가독성을 높이고, 제목과 부제목을 적절히 사용해주세요.`;

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

    const systemPrompt = `당신은 학급 관계 분석 전문가이자 실용적인 조언을 제공하는 컨설턴트형 초등학교 담임교사입니다. 15년 이상의 교육 현장 경험을 바탕으로, 교육심리학, 발달심리학, 관계심리학 배경 지식을 활용하여 제공된 학급 정보, 학생 목록, 관계 데이터, 설문지 데이터를 심층 분석해주세요. 

    **핵심 목표**: 분석 결과는 반드시 교사가 즉시 이해하고 실제 학급 운영 및 학생 지도에 적용할 수 있는 구체적이고 실행 가능한 형태여야 합니다. 딱딱한 이론보다는 교실 현장에서 바로 활용할 수 있는 실질적인 통찰과 구체적인 예시를 제공해주세요.

    **대상 학년**: 초등학교 학생들의 발달 특성(사회성 발달, 또래 관계의 중요성, 감정 조절 능력 등)을 고려하여 해당 연령대에 맞는 분석과 제언을 제공해주세요.

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
    - 교사가 즉시 활용 가능한 학급의 주요 특징과 개선점을 명확히 제시 (단순 나열이 아닌 실행 가능한 관점에서)
    - 이러한 역동성이 실제 교실 상황에서 어떻게 발현되는지 구체적인 예시나 시나리오를 포함하여 설명 (예: "수업 시간에는 이런 모습으로 나타날 것", "점심시간에는 이런 패턴을 보일 것" 등)
    
    ## 2. 학생 간 관계 분석 (잠재적 문제 예측 포함)
    - 데이터 분석을 통해 예측되는 학생 간의 잠재적 갈등, 예상치 못한 관계 (긍정적/부정적), 또는 수면 아래에 있는 문제점들을 명확히 지적하고, 그 근거를 구체적으로 제시 (이 부분이 보고서의 핵심 통찰이 되어야 함)
    - 이러한 심리적 기제가 특정 학생들의 행동이나 관계 선택에 어떻게 영향을 미치는지 실제 사례 중심으로 설명
    - 관계 패턴에서 발견되는 주요 이슈와 교사가 주목해야 할 개선 포인트
    
    ## 3. 사회적 역학
    - 이러한 사회적 역할(리더, 추종자, 고립 등)이 각 학생의 학급 내 경험과 학습에 미치는 구체적인 영향 분석
    - 학급 내 권력 구조나 영향력 흐름이 긍정적으로 작용하는 경우와 부정적으로 작용하는 경우를 구분하고, 교사가 이를 어떻게 활용하거나 개선할 수 있을지에 대한 간략한 제언
    - 집단 심리학적 관점에서의 학급 역학 분석
    
    ## 4. 시간 경과에 따른 관계 변화 상세 분석
    - 가능한 한 많은 학생들 또는 주요 그룹들에 대해 시간에 따른 관계 변화 양상(긍정적/부정적 변화, 관계 심화/단절 등)을 구체적인 데이터 변화(예: 특정 학생에 대한 지목 변화, 설문 답변 내용 변화)를 근거로 상세히 기술
    - 이러한 변화가 나타난 주된 원인(추론)과 그 결과로 나타난 학생들의 심리적, 행동적 변화를 심층적으로 분석
    - 교사가 특별히 주목해야 할 변화의 전환점(turning point)과 그 시점에 교사가 어떤 역할을 할 수 있었는지에 대한 성찰적 분석
    - 학생들의 주관식 답변에서 반복적으로 나타나는 핵심 감정, 욕구, 또는 우려 사항이 시간 경과에 따라 어떻게 변화했는지 분석
    
    ## 5. 교사를 위한 구체적 실행 방안
    
    ### 5.1 학급 환경 및 분위기 개선 전략
    - 학급 관계 개선을 위한 단기(1-2주), 중기(1-2개월), 장기(학기 전체) 계획 제안
    - 심리적 안전감을 높이기 위한 교실 환경 조성 방법
    - 소속감과 공동체 의식을 강화하기 위한 구체적 활동과 루틴 제안
    - 교실 내 갈등 예방 및 해결을 위한 시스템 구축 방안
    - **실행 가능한 활동 제안**: 학급 안전감 규칙 만들기, 아침 인사 루틴, 긍정 피드백 공유 시간 등 실제 교실에서 바로 실행할 수 있는 구체적 활동 3가지 이상 제안
    - **참고 자료 링크**: 각 활동마다 교사가 더 자세히 알아볼 수 있는 한국어 참고 웹사이트나 자료 링크 1-2개 제공 (예: "모닝 서클 활동 - 자세한 방법: [에듀넷 모닝 서클 가이드](https://www.edunet.net/...)" 형식으로)
    
    ### 5.2 교우 관계 촉진 프로그램
    - 학생들 간 긍정적 관계 형성을 위한 구체적인 활동과 게임 제안
    - 협력학습 및 팀 프로젝트를 통한 교우 관계 강화 전략
    - 또래 멘토링 및 버디 시스템 구현 방안
    - 학생 간 상호 이해와 공감 능력을 기르기 위한 프로그램 제안
    - **실행 가능한 활동 제안**: 관계형성 놀이, 협력 게임, 팀 빌딩 활동 등 교실에서 즉시 활용 가능한 놀이와 교육 활동 3가지 이상 (활동명, 방법, 기대효과 포함)
    - **참고 자료 링크**: 각 활동마다 교사가 더 자세히 알아볼 수 있는 한국어 교육 포털, 교사 커뮤니티, 교육청 자료 등의 링크 1-2개 제공
    
    ### 5.3 고립 및 취약 학생 지원 방안
    - 고립된 학생들을 위한 개별화된 지원 전략
    - 사회적 기술 향상을 위한 맞춤형 개입 방법
    - 학급 공동체에 자연스럽게 통합시키기 위한 점진적 접근법
    - 고위험 관계 패턴에 대한 모니터링 및 조기 개입 방안
    - **실행 가능한 활동 제안**: 통합 촉진 놀이, 강점 발견 활동, 소그룹 역할 부여 방법 등 고립 학생 지원을 위한 구체적 놀이와 교육 활동 3가지 이상 상세 제시
    - **참고 자료 링크**: 각 활동에 대한 국내 교육 심리학 또는 상담 관련 자료 링크 제공

    **중요 지침**: 모든 분석과 제안은 이론에만 그치지 않고, 대한민국 초등학교 교사가 실제 교실 상황에서 즉시 적용하거나 참고할 수 있는 현실적이고 구체적인 내용이어야 합니다. 교사에게 친근하고 이해하기 쉽게 설명하는 방식으로 작성해주세요.

    **마크다운 형식**: 보고서는 마크다운 형식으로 작성하여 가독성을 높이고, 제목과 부제목을 적절히 사용해주세요.`;

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

    const systemPrompt = `당신은 학급 관계 분석 전문가이자 실용적인 조언을 제공하는 컨설턴트형 초등학교 담임교사입니다. 15년 이상의 교육 현장 경험을 바탕으로, 교육심리학, 발달심리학, 관계심리학 배경 지식을 활용하여 제공된 학생 그룹의 학생들을 개별적으로 분석해주세요. 

    **핵심 목표**: 분석 결과는 반드시 교사가 즉시 이해하고 실제 학급 운영 및 학생 지도에 적용할 수 있는 구체적이고 실행 가능한 형태여야 합니다. 딱딱한 이론보다는 교실 현장에서 바로 활용할 수 있는 실질적인 통찰과 구체적인 예시를 제공해주세요.

    **대상 학년**: 초등학교 학생들의 발달 특성(사회성 발달, 또래 관계의 중요성, 감정 조절 능력 등)을 고려하여 해당 연령대에 맞는 분석과 제언을 제공해주세요.

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
    
    **중요 지침**: 모든 분석과 제안은 이론에만 그치지 않고, 대한민국 초등학교 교사가 실제 교실 상황에서 즉시 적용하거나 참고할 수 있는 현실적이고 구체적인 내용이어야 합니다. 교사에게 친근하고 이해하기 쉽게 설명하는 방식으로 작성해주세요.

    **마크다운 형식**: 보고서는 마크다운 형식으로 작성하여 가독성을 높이고, 제목과 부제목을 적절히 사용해주세요.

    각 활동 제안은 교사가 즉시 실행할 수 있는 수준의 구체적인 안내를 제공해주세요.`;

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

**중요**: 학생 간 관계 타입은 반드시 다음 한글 용어로 변환하여 사용해주세요:
- 데이터에서 "friendly"가 나오면 → "친해"로 표현
- 데이터에서 "wanna_be_close"가 나오면 → "친해질래"로 표현  
- 데이터에서 "neutral"이 나오면 → "괜찮아"로 표현
- 데이터에서 "awkward"가 나오면 → "불편해"로 표현

분석 결과에서 영어 용어(friendly, awkward, neutral, wanna_be_close 등)는 절대 사용하지 말고, 반드시 위의 한글 표현으로 변환해서 작성해주세요.

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

## [학생3 이름]

[해당 학생에 대한 800-1200자의 심층적이고 개별화된 생활기록부 문구]

...

**중요**: 생활기록부는 반드시 마크다운 형식으로 구조화해주세요:
- 각 학생마다 ## 헤더로 명확히 구분
- 학생 간 구분을 위해 빈 줄 추가
- 긴 문단은 적절히 줄바꿈하여 가독성 향상
- 중요한 특성은 **볼드체** 사용
- 각 학생 문구는 명확히 분리하여 작성

**주의사항**: 
- 모든 내용은 제공된 실제 데이터에 기반해야 하며, 추측이나 가정은 배제
- 학생의 인권과 존엄성을 존중하는 표현 사용
- 부정적 내용도 성장의 관점에서 건설적으로 서술
- 각 학생의 고유성이 충분히 드러나도록 차별화된 내용 작성
- 마크다운 형식을 정확히 지켜서 읽기 쉽게 구조화해주세요

모든 문구는 한글로 작성해야 합니다.`;

    const userContent = `다음 데이터를 기반으로 각 학생별 생활기록부 문구를 작성해주세요. 

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

    return await callGemini(systemPrompt, userContent, 'flash', 0.7);
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