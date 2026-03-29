import { NextRequest, NextResponse } from 'next/server';
import { extractQuestionsFromImage } from '@/lib/gemini-vision';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
       return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const base64Data = Buffer.from(buffer).toString('base64');
    const mimeType = file.type;

    if (!mimeType.startsWith('image/') && mimeType !== 'application/pdf') {
       return NextResponse.json({ error: 'Only image and PDF files are supported.' }, { status: 400 });
    }

    const questions = await extractQuestionsFromImage(base64Data, mimeType, 'pro');

    return NextResponse.json({ questions });
  } catch (error: any) {
    console.error('Error extracting questions:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to extract questions' },
      { status: 500 }
    );
  }
}
