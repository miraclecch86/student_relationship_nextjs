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
            - 학급 관계 개선을 위한 단기, 중기, 장기 계획 제안
            - 교우 관계 개선을 위한 구체적인 활동과 프로그램 제안
            - 고립 학생 지원을 위한 맞춤형 심리적 접근 전략
            - 학급 리더십 강화 방안
            
            보고서는 마크다운 형식을 활용하여 구조화하고, 헤더(#, ##)와 목록(-, *)을 적절히 사용하여 가독성을 높여주세요.`
          },
          {
            role: 'user',
            content: `다음 데이터를 기반으로 학급 전체에 대한 분석을 진행해주세요: 
            ${JSON.stringify(analysisData, null, 2)}`
          }
        ],
        temperature: 0.7,
        max_tokens: 3000
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
            - 학급 관계 개선을 위한 단기, 중기, 장기 계획 제안
            - 교우 관계 개선을 위한 구체적인 활동과 프로그램 제안
            - 고립 학생 지원을 위한 맞춤형 심리적 접근 전략
            - 학급 리더십 강화 방안
            
            보고서는 마크다운 형식을 활용하여 구조화하고, 헤더(#, ##)와 목록(-, *)을 적절히 사용하여 가독성을 높여주세요.`
          },
          {
            role: 'user',
            content: `다음 데이터를 기반으로 학급 전체에 대한 분석을 진행해주세요: 
            ${JSON.stringify(analysisData, null, 2)}`
          }
        ],
        temperature: 0.7,
        max_tokens: 3000
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
  students: Student[],
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
    }>
  }
): Promise<string> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error('OpenAI API 키가 설정되지 않았습니다. 환경 변수를 확인해주세요.');
      throw new Error('OpenAI API 키가 설정되지 않았습니다. 환경 변수를 확인해주세요.');
    }
    
    // 그룹별로 학생을 나누기 (예: 10명씩)
    const GROUP_SIZE = 10;
    const sortedStudents = [...students].sort((a, b) => 
      (a.display_order || 0) - (b.display_order || 0)
    );
    
    const startIdx = (groupIndex - 1) * GROUP_SIZE;
    const endIdx = startIdx + GROUP_SIZE;
    const studentGroup = sortedStudents.slice(startIdx, endIdx);
    
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
      allStudents: students.map(s => ({
        id: s.id,
        name: s.name,
        gender: s.gender
      })),
      
      // 필터링된 관계
      relationships: filteredRelationships.map(r => ({
        from: students.find(s => s.id === r.from_student_id)?.name || r.from_student_id,
        fromId: r.from_student_id,
        to: students.find(s => s.id === r.to_student_id)?.name || r.to_student_id,
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
        startIdx,
        endIdx: Math.min(endIdx, students.length),
        total: Math.ceil(students.length / GROUP_SIZE)
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
            content: `당신은 학급 관계 분석 전문가이자, 학생 개인별 심리 분석 전문가입니다. 교육심리학, 발달심리학, 관계심리학 지식을 활용하여 제공된 학생 그룹의 학생들을 개별적으로 분석해주세요. 모든 분석 결과는 한글로 작성해야 합니다.

            아래 각 학생에 대해 다음 내용을 포함하는 상세 분석을 제공해주세요:
            
            ### [학생 이름]
            - 심리적 특성 및 발달 단계 분석
            - 사회적 위치와 영향력
            - 관계 패턴 및 주요 교우 관계
            - 강점과 잠재력
            - 직면한 어려움 또는 도전 과제
            - 성격 유형 및 행동 패턴
            - 발전을 위한 구체적 교육적, 심리적 제안
            
            보고서는 마크다운 형식을 활용하여 구조화하고, 헤더(#, ##, ###)와 목록(-, *)을 적절히 사용하여 가독성을 높여주세요. 각 학생별 분석을 충분히 상세하게 작성해주세요.`
          },
          {
            role: 'user',
            content: `다음 데이터를 기반으로 학생 그룹 ${groupIndex}의 각 학생에 대한 상세 분석을 진행해주세요: 
            ${JSON.stringify(analysisData, null, 2)}`
          }
        ],
        temperature: 0.7,
        max_tokens: 3000
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