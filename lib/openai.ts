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
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    
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
        model: 'gpt-4-turbo', // 또는 사용 가능한 최신 모델
        messages: [
          {
            role: 'system',
            content: `당신은 학생 관계 분석 전문가입니다. 제공된 학생 목록, 관계 데이터, 설문 응답 데이터를 분석하여 
            교실 내 사회적 역학과 학생 간 관계를 객관적으로 분석해주세요. 문제가 있을 수 있는 영역을 식별하고
            교사가 학급의 사회적 환경을 개선하기 위한 실행 가능한 권장 사항을 제공해주세요.`
          },
          {
            role: 'user',
            content: `다음 데이터를 기반으로 학생들의 관계와 학급 내 사회적 역학을 분석해주세요: 
            ${JSON.stringify(analysisData, null, 2)}`
          }
        ],
        temperature: 0.5,
        max_tokens: 1500,
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
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    
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
        model: 'gpt-4-turbo', // 또는 사용 가능한 최신 모델
        messages: [
          {
            role: 'system',
            content: `당신은 교육 데이터 분석 전문가입니다. 제공된 설문 데이터를 분석하여 주요 트렌드, 
            인사이트 및 권장 사항을 교사가 이해하기 쉬운 형태로 요약해주세요.`
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