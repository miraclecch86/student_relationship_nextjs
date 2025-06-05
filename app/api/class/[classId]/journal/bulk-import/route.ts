import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ classId: string }> }
) {
  try {
    console.log('=== Bulk Import API 호출됨 ===');
    const { classId } = await context.params;
    console.log('Class ID:', classId);
    
    const requestBody = await request.json();
    console.log('Request body keys:', Object.keys(requestBody));
    
    const { records } = requestBody;
    console.log('Records count:', records?.length);

    if (!records || !Array.isArray(records) || records.length === 0) {
      console.log('Records validation failed');
      return NextResponse.json(
        { error: '가져올 기록이 없습니다.' },
        { status: 400 }
      );
    }

    console.log('Creating supabase client...');
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    console.log('Sample record structure:', records[0]);
    
    // 모든 기록을 한 번에 삽입
    console.log('Inserting records to database...');
    const { data, error } = await supabase
      .from('class_daily_records')
      .insert(records)
      .select();

    if (error) {
      console.error('=== Supabase insert error ===');
      console.error('Error details:', error);
      console.error('Error message:', error.message);
      console.error('Error code:', error.code);
      return NextResponse.json(
        { error: `기록 저장 중 오류가 발생했습니다: ${error.message}` },
        { status: 500 }
      );
    }

    console.log('=== Insert successful ===');
    console.log('Inserted records count:', data?.length);

    return NextResponse.json({
      success: true,
      count: data?.length || 0,
      message: `${data?.length || 0}개의 기록이 성공적으로 가져와졌습니다.`
    });

  } catch (error: any) {
    console.error('=== Bulk import API error ===');
    console.error('Error type:', typeof error);
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);
    console.error('Full error:', error);
    return NextResponse.json(
      { error: `서버 오류가 발생했습니다: ${error?.message || error}` },
      { status: 500 }
    );
  }
} 