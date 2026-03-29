import { NextRequest, NextResponse } from 'next/server';
import { extractQuestionsFromImage } from '@/lib/gemini-vision';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
       return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    try {
        const fileParts = await Promise.all(files.map(async (file) => {
            const buffer = await file.arrayBuffer();
            const base64Data = Buffer.from(buffer).toString('base64');
            let mimeType = file.type;
            
            if (file.name.toLowerCase().endsWith('.hwp')) mimeType = 'application/x-hwp';
            if (file.name.toLowerCase().endsWith('.hwpx')) mimeType = 'application/hwp+zip';

            if (!mimeType.startsWith('image/') && mimeType !== 'application/pdf' && !mimeType.includes('hwp')) {
                throw new Error(`지원하지 않는 파일 형식입니다: ${file.name}`);
            }
            return { data: base64Data, mimeType };
        }));

        const questions = await extractQuestionsFromImage(fileParts, 'flash');

        return NextResponse.json({ questions });
    } catch (validationError: any) {
        return NextResponse.json({ error: validationError.message }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error extracting questions:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to extract questions' },
      { status: 500 }
    );
  }
}
