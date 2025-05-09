import { NextResponse } from 'next/server';
import { analyzeStudentRelationships } from '@/lib/openai';
import { Student, Relationship, Answer, Question } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { students, relationships, answers, questions } = await request.json();
    
    // 필수 데이터 확인
    if (!students || !Array.isArray(students) || !relationships || !Array.isArray(relationships)) {
      return NextResponse.json({ error: '유효하지 않은 데이터 형식입니다.' }, { status: 400 });
    }
    
    // OpenAI API를 사용하여 관계 분석
    const result = await analyzeStudentRelationships(
      students as Student[], 
      relationships as Relationship[],
      answers as Answer[] | undefined,
      questions as Question[] | undefined
    );
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('관계 분석 API 오류:', error);
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 