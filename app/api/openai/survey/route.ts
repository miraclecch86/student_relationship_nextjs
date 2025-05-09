import { NextResponse } from 'next/server';
import { analyzeSurveyResults } from '@/lib/openai';
import { Student, Answer, Question, Survey } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { survey, students, answers, questions } = await request.json();
    
    // 필수 데이터 확인
    if (!survey || !students || !Array.isArray(students) || !answers || !Array.isArray(answers) || !questions || !Array.isArray(questions)) {
      return NextResponse.json({ error: '유효하지 않은 데이터 형식입니다.' }, { status: 400 });
    }
    
    // OpenAI API를 사용하여 설문 분석
    const result = await analyzeSurveyResults(
      survey as Survey,
      students as Student[],
      answers as Answer[],
      questions as Question[]
    );
    
    return NextResponse.json({ analysis: result });
  } catch (error) {
    console.error('설문 분석 API 오류:', error);
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 