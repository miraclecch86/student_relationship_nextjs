import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ classId: string }> }
) {
  try {
    console.log('=== Announcement Bulk Import API 호출됨 ===');
    const { classId } = await context.params;
    console.log('Class ID:', classId);
    
    const requestBody = await request.json();
    console.log('Request body keys:', Object.keys(requestBody));
    
    const { announcements } = requestBody;
    console.log('Announcements count:', announcements?.length);

    if (!announcements || !Array.isArray(announcements) || announcements.length === 0) {
      console.log('Announcements validation failed');
      return NextResponse.json(
        { error: '가져올 알림장이 없습니다.' },
        { status: 400 }
      );
    }

    console.log('Creating supabase client...');
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    console.log('Sample announcement structure:', announcements[0]);
    
    // 각 알림장을 처리
    const savedAnnouncements = [];
    for (const announcement of announcements) {
      // 먼저 해당 날짜의 일지가 있는지 확인하고 없으면 생성
      let { data: journal } = await supabase
        .from('class_journals')
        .select('id')
        .eq('class_id', classId)
        .eq('journal_date', announcement.journal_date)
        .single();

      if (!journal) {
        console.log(`Creating journal for date: ${announcement.journal_date}`);
        const { data: newJournal, error: journalError } = await supabase
          .from('class_journals')
          .insert({
            class_id: classId,
            journal_date: announcement.journal_date
          })
          .select()
          .single();

        if (journalError) {
          console.error('Journal creation error:', journalError);
          throw new Error(`일지 생성 실패: ${journalError.message}`);
        }
        journal = newJournal;
      }

      // 알림장 저장
      const { data: savedAnnouncement, error: announcementError } = await supabase
        .from('journal_announcements')
        .insert({
          journal_id: journal!.id,
          keywords: announcement.keywords || [],
          teacher_input_content: announcement.content,
          ai_generated_content: announcement.content,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (announcementError) {
        console.error('Announcement insert error:', announcementError);
        throw new Error(`알림장 저장 실패: ${announcementError.message}`);
      }

      savedAnnouncements.push(savedAnnouncement);
    }

    console.log('=== Insert successful ===');
    console.log('Inserted announcements count:', savedAnnouncements.length);

    return NextResponse.json({
      success: true,
      count: savedAnnouncements.length,
      message: `${savedAnnouncements.length}개의 알림장이 성공적으로 가져와졌습니다.`
    });

  } catch (error: any) {
    console.error('=== Announcement bulk import API error ===');
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