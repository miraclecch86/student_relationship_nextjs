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
            content: `당신은 학급 관계 분석 전문가입니다. 제공된 학급 정보, 학생 목록, 관계 데이터, 설문지 데이터, 설문 응답 데이터를 심층 분석하여 교실 내 사회적 역학과 학생 간 관계를 명확하고 통찰력 있게 분석해주세요. 모든 분석 결과는 한글로 작성해야 합니다.

            다음 내용을 포함한 구조화된 분석 보고서를 작성해주세요:
            
            # 2025 동부초등학교 2학년 N반 학급 관계 및 사회적 역학 분석 보고서
            
            ## 1. 학급 전체 분석
            - 학급의 전반적인 분위기, 특징, 강점과 약점에 대한 분석
            
            ## 2. 학생 간 관계 분석
            - 관계 패턴, 주요 이슈, 개선 권장사항 
            
            ## 3. 사회적 역학
            - 리더와 추종자, 강한 유대 관계, 고립된 학생들
            
            ## 4. 개별 학생 상세 분석
            - **반드시 모든 학생 개개인에 대한 상세 분석을 제공해주세요**
            - 각 학생별로 다음 정보를 포함:
              - 사회적 위치와 영향력
              - 관계 패턴 및 주요 교우 관계
              - 강점과 잠재력
              - 직면한 어려움 또는 도전 과제
              - 발전을 위한 구체적 교육적 제안
            
            ## 5. 설문 데이터 분석
            - 설문별 응답 경향 및 학생들의 인식 변화
            
            ## 6. 시간 경과에 따른 변화
            - 설문 날짜를 기준으로 학급 관계 변화 추적
            
            ## 7. 교사를 위한 제안
            - 학급 관계 개선을 위한 구체적이고 실행 가능한 교육적 제안
            
            제공된 모든 데이터를 활용하되, 특히 다음 정보에 주목해주세요:
            1. 학급 기본 정보와 모든 학생 정보
            2. 학급 아래 생성된 모든 설문지 정보 (제목, 생성날짜 포함)
            3. 설문지별 학생 관계 설정 정보와 그 변화
            4. 주간식 대답 정보를 포함한 모든 질문-응답 데이터
            
            보고서는 반드시 마크다운 형식을 활용하여 구조화하고, 헤더(#, ##, ###)와 목록(-, *)을 적절히 사용하여 가독성을 높여주세요. 단순히 데이터를 나열하는 것이 아니라, 통찰력 있는 분석과 실행 가능한 교육적 제안을 제공해주세요.
            
            중요: 
            1. 마크다운 서식이 올바르게 적용되도록 # 기호와 텍스트 사이에 반드시 공백을 넣어주세요 (예: '# 제목', '## 소제목')
            2. 글자 색상은 기본 검정색으로 표시되므로 별도의 색상 코드를 넣지 마세요
            3. 필요한 경우 표(table)를 사용하여 데이터를 정리해도 좋습니다
            4. 모든 학생을 분석할 때 ### 수준의 헤더를 사용하여 학생 이름을 제목으로 하고, 구체적인 분석 내용을 제공해주세요`
          },
          {
            role: 'user',
            content: `다음 데이터를 기반으로 학생들의 관계와 학급 내 사회적 역학을 심층 분석해주세요: 
            ${JSON.stringify(analysisData, null, 2)}`
          }
        ],
        temperature: 0.7,
        max_tokens: 4000
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

    // GPT 응답을 그대로 반환
    return content;

  } catch (error) {
    console.error('학생 관계 분석 오류:', error);
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
        max_tokens: 1000,
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