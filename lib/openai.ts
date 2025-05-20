import { Student, Question, Answer, Relationship, Survey } from './supabase';

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
    // 환경 변수에서 API 키 가져오기
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error('OpenAI API 키가 설정되지 않았습니다. 환경 변수를 확인해주세요.');
      console.error('환경 변수 OPENAI_API_KEY를 .env.local 파일과 Vercel 프로젝트 설정에 추가해야 합니다.');
      console.error('현재 환경 변수 키 목록:', Object.keys(process.env).filter(key => !key.includes('SECRET')));
      throw new Error('OpenAI API 키가 설정되지 않았습니다. 환경 변수를 확인해주세요.');
    }

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

    // OpenAI API 요청 설정
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o', // 또는 사용 가능한 최신 모델
        messages: [
          {
            role: 'system',
            content: `당신은 학급 관계 분석 전문가이자 아동 심리 분석 전문가입니다. 교육심리학, 발달심리학, 관계심리학 배경 지식을 활용하여 제공된 학급 정보, 학생 목록, 관계 데이터, 설문지 데이터를 심층 분석해주세요. 교실 내 사회적 역학, 학생 간 관계를 명확하고 통찰력 있게 분석해주세요. 모든 분석 결과는 한글로 작성해야 합니다.

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
            
            보고서는 마크다운 형식을 활용하여 구조화하고, 헤더(#, ##, ###)와 목록(-, *)을 적절히 사용하여 가독성을 높여주세요.`
          },
          {
            role: 'user',
            content: `다음 데이터를 기반으로 학급 전체에 대한 분석을 진행해주세요: 
            ${JSON.stringify(analysisData, null, 2)}`
          }
        ],
        temperature: 0.7,
        max_tokens: 10000
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API 오류: ${errorData.error?.message || response.statusText}`);
    }

    const result = await response.json();
    return result.choices[0].message.content;
  } catch (error: any) {
    console.error('analyzeClassOverview API 호출 오류:', error);
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
    // 환경 변수에서 API 키 가져오기
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error('OpenAI API 키가 설정되지 않았습니다. 환경 변수를 확인해주세요.');
      console.error('환경 변수 OPENAI_API_KEY를 .env.local 파일과 Vercel 프로젝트 설정에 추가해야 합니다.');
      console.error('현재 환경 변수 키 목록:', Object.keys(process.env).filter(key => !key.includes('SECRET')));
      throw new Error('OpenAI API 키가 설정되지 않았습니다. 환경 변수를 확인해주세요.');
    }

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

    // OpenAI API 요청
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o', // 또는 사용 가능한 최신 모델
        messages: [
          {
            role: 'system',
            content: `당신은 교육 데이터 분석 전문가입니다. 제공된 설문 데이터(설문지명: ${surveyData.surveyName}, 설명: ${surveyData.surveyDescription})를 심층 분석하여, 주요 응답 경향, 학생들의 인식 변화, 그리고 잠재적인 문제점을 명확히 식별하고, 이를 개선하기 위한 구체적이고 실행 가능한 권장 사항을 최소 3가지 이상 제시해주세요. **모든 분석 결과와 권장 사항은 반드시 한글로 작성해주시고, 이전 설문 결과가 있다면 시간 경과에 따른 변화도 함께 언급해주세요.** 응답은 명확하고 간결한 요약 형태로 제공되어야 합니다.`
          },
          {
            role: 'user',
            content: `다음 설문 데이터를 분석하고 주요 결과와 인사이트를 요약해주세요: 
            ${JSON.stringify(surveyData, null, 2)}`
          }
        ],
        temperature: 0.5,
        max_tokens: 10000,
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API 오류: ${errorData.error?.message || response.statusText}`);
    }

    const result = await response.json();
    const content = result.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('API 응답에 콘텐츠가 없습니다.');
    }

    return content;

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
    // 환경 변수에서 API 키 가져오기
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error('OpenAI API 키가 설정되지 않았습니다. 환경 변수를 확인해주세요.');
      throw new Error('OpenAI API 키가 설정되지 않았습니다. 환경 변수를 확인해주세요.');
    }

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

    // OpenAI API 요청 설정
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o', // 또는 사용 가능한 최신 모델
        messages: [
          {
            role: 'system',
            content: `당신은 학급 관계 분석 전문가이자 아동 심리 분석 전문가입니다. 교육심리학, 발달심리학, 관계심리학 배경 지식을 활용하여 제공된 학급 정보, 학생 목록, 관계 데이터, 설문지 데이터를 심층 분석해주세요. 교실 내 사회적 역학, 학생 간 관계를 명확하고 통찰력 있게 분석해주세요. 모든 분석 결과는 한글로 작성해야 합니다.

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
            
            보고서는 마크다운 형식을 활용하여 구조화하고, 헤더(#, ##, ###)와 목록(-, *)을 적절히 사용하여 가독성을 높여주세요.`
          },
          {
            role: 'user',
            content: `다음 데이터를 기반으로 학급 전체에 대한 분석을 진행해주세요: 
            ${JSON.stringify(analysisData, null, 2)}`
          }
        ],
        temperature: 0.7,
        max_tokens: 10000
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API 오류: ${errorData.error?.message || response.statusText}`);
    }

    const result = await response.json();
    return result.choices[0].message.content;
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
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error('OpenAI API 키가 설정되지 않았습니다. 환경 변수를 확인해주세요.');
      throw new Error('OpenAI API 키가 설정되지 않았습니다. 환경 변수를 확인해주세요.');
    }
    
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

    // OpenAI API 요청
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `당신은 학급 관계 분석, 학생 개인별 심리 분석, 학생 교육 놀이 및 활동에 관련 전세계 모든 지식을 파악한 수준의 전문가입니다. 교육심리학, 발달심리학, 관계심리학 지식을 활용하여 제공된 학생 그룹의 학생들을 개별적으로 분석해주세요. 모든 분석 결과는 한글로 작성해야 합니다.

                      
            ## 개별 학생 분석
            
            # [학생 이름]
            
            ## 1. 심리적 특성 분석
            - 심리적 특성 및 발달 단계 분석
            - 성격 유형 및 행동 패턴
            
            ## 2. 관계 분석
            - 사회적 위치와 영향력
            - 관계 패턴 및 주요 교우 관계
            
            ## 3. 강점과 과제
            - 강점과 잠재력
            - 직면한 어려움 또는 도전 과제
            
            ## 4. 발전을 위한 구체적 제안
            
            ### 4.1 사회적 관계 및 교우 관계 개선을 위한 활동
            - 이 학생의 사회적 관계를 개선하기 위한 구체적 교실 활동
            - 교우 관계 형성 및 유지를 위한 실질적 전략
            - 그룹 활동에서의 참여와 공헌을 촉진하기 위한 방법
            - 갈등 해결 및 의사소통 기술 향상을 위한 접근법
            
            ### 4.2 심리적, 정서적 성장을 위한 지원 방안
            - 학생의 심리적 건강과 정서적 안정을 위한 맞춤형 지원 전략
            - 자신감과 자아존중감 향상을 위한 구체적 활동
            - 스트레스 관리 및 감정 조절 능력 개발을 위한 제안
            - 동기 부여와 회복 탄력성을 강화하기 위한 접근법
            
            ### 4.3 학업 및 인지적 발전을 위한 교육적 접근
            - 학생의 강점을 활용한 학습 전략 제안
            - 자기주도적 학습 능력 향상을 위한 구체적 방법
            - 학습 동기를 높이기 위한 맞춤형 교육적 접근
            - 메타인지 및 비판적 사고 능력 개발을 위한 활동
            
            ### 4.4 장기적 성장을 위한 진로 및 재능 개발 지원
            - 학생의 잠재력과 관심사를 고려한 진로 탐색 기회 제공
            - 특별한 재능과 강점을 발전시키기 위한 교내외 활동 제안
            - 리더십 및 책임감 개발을 위한 역할 부여
            - 자기 성찰 및 목표 설정 능력을 기르기 위한 지도 방안
            
            -------------------------------------
            
            # [다음 학생 이름]
            
            (위와 동일한 구조로 각 학생마다 반복)
            
            보고서는 마크다운 형식을 활용하여 구조화하고, 헤더(#, ##, ###, ####, #####)와 목록(-, *)을 적절히 사용하여 가독성을 높여주세요. 각 학생별 분석을 충분히 상세하게 작성하고, 학생 간에 명확한 구분선이나 큰 제목을 사용하여 분리해주세요.
            
            중요: 각 학생 분석 사이에는 구분선(---)을 넣어 확실히 구분하고, 각 학생의 이름은 ### 헤더 수준으로 명확하게 표시해주세요.

            각 활동 제안은 더 구체적이고 실행 가능하게 작성해주세요:
            1. 활동 이름을 명확하게 기재
            2. 활동 목적과 기대효과를 상세히 설명
            3. 준비물과 진행 방법을 단계별로 제시
            4. 예상 소요시간 및 적절한 학생 그룹 크기 제안
            5. 가능한 경우 참고할 수 있는 자료 링크 포함 (한국어 자료 우선)
            
            교사가 즉시 실행할 수 있는 수준의 상세한 안내를 제공해주세요.`
          },
          {
            role: 'user',
            content: `다음 데이터를 기반으로 학생 그룹 ${groupIndex}의 각 학생에 대한 상세 분석을 진행해주세요: 
            ${JSON.stringify(analysisData, null, 2)}`
          }
        ],
        temperature: 0.7,
        max_tokens: 10000
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API 오류: ${errorData.error?.message || response.statusText}`);
    }

    const result = await response.json();
    return result.choices[0].message.content;
  } catch (error: any) {
    console.error(`analyzeStudentGroup(${groupIndex}) API 호출 오류:`, error);
    throw error;
  }
} 