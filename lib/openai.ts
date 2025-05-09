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
  questions?: Question[]
): Promise<OpenAIResponse> {
  try {
    // 환경 변수에서 API 키 가져오기
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OpenAI API 키가 설정되지 않았습니다.');
    }

    // 분석에 필요한 데이터 준비
    const analysisData = {
      students: students.map(s => ({
        id: s.id,
        name: s.name,
        gender: s.gender
      })),
      relationships: relationships.map(r => ({
        from: students.find(s => s.id === r.from_student_id)?.name || r.from_student_id,
        to: students.find(s => s.id === r.to_student_id)?.name || r.to_student_id,
        type: r.relation_type
      })),
      answers: answers ? answers.map(a => {
        const question = questions?.find(q => q.id === a.question_id);
        return {
          student: students.find(s => s.id === a.student_id)?.name || a.student_id,
          question: question?.question_text || a.question_id,
          answer: a.answer_text
        };
      }) : [],
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
            content: `당신은 학생 관계 분석 전문가입니다. 제공된 학생 목록, 관계 데이터, 설문 응답 데이터를 심층 분석하여 교실 내 사회적 역학과 학생 간 관계를 객관적이고 통찰력 있게 분석해주세요. **모든 분석 결과는 반드시 한글로 제공되어야 합니다.**

            다음 내용을 포함하는 상세하고 구체적인 보고서를 JSON 형식으로 제공해주세요. 각 항목에 대해서는 단순 나열이 아닌, 데이터 기반의 근거와 함께 심층적인 분석 및 실행 가능한 제안을 포함해야 합니다.

            1.  **전반적인 학급 분석 (analysis):** 학급의 전체적인 분위기, 주요 특징, 강점과 약점을 명확히 기술해주세요.
            2.  **학생 간 관계 분석 (relationships):**
                *   **관계 설명 (description):** 주요 긍정적 및 부정적 관계 패턴을 상세히 설명해주세요.
                *   **주요 이슈 (issues):** 관계에서 발견되는 갈등, 소외, 따돌림 등의 주요 이슈를 구체적으로 지적하고, 그 원인을 분석해주세요.
                *   **개선 권장사항 (recommendations):** 발견된 이슈를 해결하고 긍정적인 관계를 증진시키기 위한 구체적이고 실행 가능한 권장 사항을 3가지 이상 제시해주세요.
            3.  **학급 내 사회적 역학 (socialDynamics):**
                *   **역학 설명 (description):** 학급 내 리더, 추종자, 방관자 등 다양한 역할과 그들 간의 역학 관계를 설명해주세요.
                *   **강한 유대 관계 (strongConnections):** 긍정적인 또래 관계를 형성하고 있는 그룹이나 학생들을 명시하고, 그 요인을 분석해주세요.
                *   **고립된 학생들 (isolatedStudents):** 사회적으로 고립되었거나 소외된 학생들을 식별하고, 그 원인과 가능한 지원 방안을 제시해주세요.
            4.  **개별 학생 분석 (individualAnalysis):** (데이터가 충분한 경우 각 학생에 대해)
                *   **이름 (name)**
                *   **사회적 위치 (socialPosition):** 또래 집단 내에서의 사회적 위치(예: 중심, 주변, 고립)와 그 이유를 분석해주세요.
                *   **강점 (strengths):** 해당 학생의 사회적 관계에서의 강점(예: 공감 능력, 리더십, 협동심)을 구체적 사례와 함께 제시해주세요.
                *   **도전 과제 (challenges):** 사회적 관계 형성에 어려움을 겪는 부분이나 개선이 필요한 영역을 명확히 지적해주세요.
                *   **개선 제안 (suggestions):** 해당 학생의 사회성 발달과 긍정적 관계 형성을 돕기 위한 맞춤형 제안을 2가지 이상 제시해주세요.
            5.  **교실 환경 평가 (classroomEnvironment):**
                *   **전반적 평가 (overall):** 현재 교실 환경이 학생들의 정서적 안정과 사회성 발달에 미치는 영향을 종합적으로 평가해주세요.
                *   **긍정적 측면 (positiveAspects):** 현재 교실 환경의 긍정적인 요소들을 구체적으로 언급해주세요.
                *   **개선이 필요한 부분 (challengingAreas):** 학생들의 관계 형성에 부정적인 영향을 미치거나 개선이 필요한 환경적 요소를 지적해주세요.
                *   **환경 개선 제안 (improvementSuggestions):** 보다 긍정적이고 지지적인 교실 환경 조성을 위한 구체적인 개선 방안을 3가지 이상 제시해주세요.
            6.  **시간에 따른 변화 예측 (timelineProjection):**
                *   **단기 전망 (shortTerm):** (1-2개월) 현재 분석 결과를 바탕으로 단기적으로 예상되는 관계 변화와 주요 이슈를 예측해주세요.
                *   **중기 전망 (midTerm):** (3-6개월) 중기적으로 예상되는 학급 역학의 변화와 필요한 지원을 전망해주세요.
                *   **장기 전망 (longTerm):** (학년도 기준) 장기적인 관점에서 학급 관계 발전 방향과 교사의 역할을 제안해주세요.
                *   **주요 이정표 (keyMilestones):** 관계 개선 및 사회성 발달을 위해 설정할 수 있는 주요 목표와 점검 시점을 제시해주세요.
                *   **이전 분석과의 비교 분석:** (해당하는 경우) **각 설문지의 이름 또는 실시 날짜를 명시하며, 이전 분석 결과와의 비교를 통해 시간 경과에 따른 관계 변화 추세를 구체적으로 설명하고, 긍정적/부정적 변화 요인을 분석하여 향후 개선 방향을 제시해주세요.**

            학급 내 사회적 환경을 개선하고 모든 학생이 건강하게 성장할 수 있도록, 분석 결과를 바탕으로 깊이 있는 통찰과 실질적인 도움을 줄 수 있는 권장 사항을 각 분야별로 구체적으로 제공해주세요. 응답은 반드시 JSON 형식이어야 하며, 모든 텍스트는 한글로 작성되어야 합니다.`
          },
          {
            role: 'user',
            content: `다음 데이터를 기반으로 학생들의 관계와 학급 내 사회적 역학을 분석해주세요: 
            ${JSON.stringify(analysisData, null, 2)}`
          }
        ],
        temperature: 0.5,
        max_tokens: 4000,
        response_format: { type: "json_object" }
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

    // JSON 응답 파싱
    let parsedContent: OpenAIResponse;
    try {
      parsedContent = JSON.parse(content);
      
      // 필수 필드 확인 및 기본값 설정
      if (!parsedContent.analysis) {
        parsedContent.analysis = '분석 데이터를 생성하는 중 오류가 발생했습니다.';
      }
      
      if (!parsedContent.relationships) {
        parsedContent.relationships = { 
          description: '관계 분석 데이터를 생성하는 중 오류가 발생했습니다.' 
        };
      } else {
        // relationships 내부 필드가 예상과 다른 경우에 대한 대비
        if (!parsedContent.relationships.description) {
          parsedContent.relationships.description = '관계 분석 데이터가 없습니다.';
        }
        
        // issues, recommendations가 배열이 아닌 경우 처리
        if (parsedContent.relationships.issues && !Array.isArray(parsedContent.relationships.issues)) {
          console.warn('issues 필드가 배열이 아님:', parsedContent.relationships.issues);
          parsedContent.relationships.issues = [];
        }
        
        if (parsedContent.relationships.recommendations && !Array.isArray(parsedContent.relationships.recommendations)) {
          console.warn('recommendations 필드가 배열이 아님:', parsedContent.relationships.recommendations);
          parsedContent.relationships.recommendations = [];
        }
      }
      
      if (!parsedContent.socialDynamics) {
        parsedContent.socialDynamics = { 
          description: '사회적 역학 데이터를 생성하는 중 오류가 발생했습니다.' 
        };
      } else {
        // socialDynamics 내부 필드가 예상과 다른 경우에 대한 대비
        if (!parsedContent.socialDynamics.description) {
          parsedContent.socialDynamics.description = '사회적 역학 데이터가 없습니다.';
        }
        
        // strongConnections, isolatedStudents가 배열이 아닌 경우 처리
        if (parsedContent.socialDynamics.strongConnections && !Array.isArray(parsedContent.socialDynamics.strongConnections)) {
          console.warn('strongConnections 필드가 배열이 아님:', parsedContent.socialDynamics.strongConnections);
          parsedContent.socialDynamics.strongConnections = [];
        }
        
        if (parsedContent.socialDynamics.isolatedStudents && !Array.isArray(parsedContent.socialDynamics.isolatedStudents)) {
          console.warn('isolatedStudents 필드가 배열이 아님:', parsedContent.socialDynamics.isolatedStudents);
          parsedContent.socialDynamics.isolatedStudents = [];
        }
      }
      
      // 확장 필드에 대한 검증
      if (parsedContent.individualAnalysis) {
        if (!Array.isArray(parsedContent.individualAnalysis.students)) {
          console.warn('students 필드가 배열이 아님:', parsedContent.individualAnalysis.students);
          parsedContent.individualAnalysis.students = [];
        } else {
          // 각 학생 데이터의 배열 속성 검증
          parsedContent.individualAnalysis.students.forEach(student => {
            if (!Array.isArray(student.strengths)) {
              student.strengths = [];
            }
            if (!Array.isArray(student.challenges)) {
              student.challenges = [];
            }
            if (!Array.isArray(student.suggestions)) {
              student.suggestions = [];
            }
          });
        }
      }
      
      if (parsedContent.classroomEnvironment) {
        if (!Array.isArray(parsedContent.classroomEnvironment.positiveAspects)) {
          console.warn('positiveAspects 필드가 배열이 아님:', parsedContent.classroomEnvironment.positiveAspects);
          parsedContent.classroomEnvironment.positiveAspects = [];
        }
        
        if (!Array.isArray(parsedContent.classroomEnvironment.challengingAreas)) {
          console.warn('challengingAreas 필드가 배열이 아님:', parsedContent.classroomEnvironment.challengingAreas);
          parsedContent.classroomEnvironment.challengingAreas = [];
        }
        
        if (!Array.isArray(parsedContent.classroomEnvironment.improvementSuggestions)) {
          console.warn('improvementSuggestions 필드가 배열이 아님:', parsedContent.classroomEnvironment.improvementSuggestions);
          parsedContent.classroomEnvironment.improvementSuggestions = [];
        }
      }
      
      if (parsedContent.timelineProjection) {
        if (!Array.isArray(parsedContent.timelineProjection.keyMilestones)) {
          console.warn('keyMilestones 필드가 배열이 아님:', parsedContent.timelineProjection.keyMilestones);
          parsedContent.timelineProjection.keyMilestones = [];
        }
      }
      
    } catch (error) {
      console.error('JSON 파싱 오류:', error);
      // 텍스트 응답을 기본 구조로 변환
      parsedContent = {
        analysis: content,
        relationships: { description: '데이터 파싱 오류' },
        socialDynamics: { description: '데이터 파싱 오류' }
      };
    }

    return parsedContent;

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
      throw new Error('OpenAI API 키가 설정되지 않았습니다.');
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