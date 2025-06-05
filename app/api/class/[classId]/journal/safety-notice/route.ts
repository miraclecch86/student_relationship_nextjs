import { NextRequest, NextResponse } from 'next/server';
import { generateSafetyNoticeWithGemini } from '@/lib/gemini';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const { classId } = await params;
    console.log('안전 수칙 API 호출됨, classId:', classId);
    
    const body = await request.json();
    console.log('요청 본문:', body);
    
    const { category, content } = body;

    if (!category || !content) {
      console.log('필수 파라미터 누락:', { category, content });
      return NextResponse.json(
        { error: '카테고리와 내용을 모두 입력해주세요.' },
        { status: 400 }
      );
    }

    console.log('Gemini 안전 수칙 생성 시작...');
    
    // Gemini를 사용해 안전 수칙 생성
    const safetyNotice = await generateSafetyNoticeWithGemini({
      category,
      content
    });

    console.log('안전 수칙 생성 완료:', safetyNotice.substring(0, 100) + '...');

    return NextResponse.json({ content: safetyNotice });
  } catch (error: any) {
    console.error('안전 수칙 생성 API 상세 오류:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    return NextResponse.json(
      { error: error.message || '안전 수칙 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 