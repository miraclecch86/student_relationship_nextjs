import { NextRequest, NextResponse } from 'next/server';
import { extractAnswersFromImage } from '@/lib/gemini-vision';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const questionsStr = formData.get('questions') as string | null;

    if (!file) {
       return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!questionsStr) {
       return NextResponse.json({ error: 'No questions provided' }, { status: 400 });
    }

    let questions: { id: string, text: string }[] = [];
    try {
        questions = JSON.parse(questionsStr);
    } catch {
        return NextResponse.json({ error: 'Invalid questions format' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const base64Data = Buffer.from(buffer).toString('base64');
    const mimeType = file.type;

    if (!mimeType.startsWith('image/') && mimeType !== 'application/pdf') {
       return NextResponse.json({ error: 'Only image and PDF files are supported.' }, { status: 400 });
    }

    const answers = await extractAnswersFromImage(base64Data, mimeType, questions, 'pro');

    return NextResponse.json({ answers });
  } catch (error: any) {
    console.error('Error extracting answers:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to extract answers' },
      { status: 500 }
    );
  }
}
