import { NextRequest, NextResponse } from 'next/server';
import { generateAnnouncementWithGemini } from '@/lib/gemini';

export async function POST(
  request: NextRequest,
  context: any
) {
  try {
    const { keywords, details, className, date } = await request.json();

    // 입력값 검증
    if (!keywords || !details || !className || !date) {
      return NextResponse.json(
        { error: '필수 입력값이 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 환경변수 확인
    if (!process.env.GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.');
      return NextResponse.json(
        { error: 'AI 서비스가 설정되지 않았습니다. 관리자에게 문의하세요.' },
        { status: 500 }
      );
    }

    console.log('알림장 생성 API 호출:', { keywords, details, className, date });

    // AI 알림장 생성
    const generatedContent = await generateAnnouncementWithGemini({
      keywords,
      details,
      className,
      date
    });

    console.log('알림장 생성 성공');

    return NextResponse.json({
      content: generatedContent
    });

  } catch (error: any) {
    console.error('알림장 생성 API 오류:', error);
    
    return NextResponse.json(
      { error: error.message || '알림장 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 