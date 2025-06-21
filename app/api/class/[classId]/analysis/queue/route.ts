import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { analyzeStudentRelationshipsWithGemini, analyzeClassOverviewWithGemini, analyzeStudentGroupWithGemini } from '@/lib/gemini';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { classId } = await params;
    const body = await request.json();
    const { analysisType, ...requestData } = body; // 'basic', 'overview', 'students'

    console.log(`큐에 분석 작업 추가: ${analysisType} for class ${classId}`);

    // 큐에 작업 추가
    const { data: queueItem, error: queueError } = await supabase
      .from('analysis_queue')
      .insert({
        class_id: classId,
        analysis_type: analysisType,
        request_data: requestData,
        status: 'pending'
      })
      .select('id')
      .single();

    if (queueError) {
      console.error('큐 추가 오류:', queueError);
      return NextResponse.json({ error: '큐 추가 실패' }, { status: 500 });
    }

    const jobId = queueItem.id;

    // 백그라운드에서 분석 실행 (non-blocking)
    processAnalysisInBackground(jobId, classId, analysisType, requestData);

    return NextResponse.json({ 
      jobId,
      status: 'started',
      message: '분석 작업이 시작되었습니다.'
    });

  } catch (error: any) {
    console.error('큐 API 오류:', error);
    return NextResponse.json({ error: '큐 API 오류' }, { status: 500 });
  }
}

// 백그라운드 분석 처리 함수
async function processAnalysisInBackground(
  jobId: string,
  classId: string,
  analysisType: string,
  requestData: any
) {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    console.log(`백그라운드 분석 시작: ${jobId} (${analysisType})`);

    // 작업 상태를 'processing'으로 업데이트
    await supabase
      .from('analysis_queue')
      .update({ 
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .eq('id', jobId);

    // 🧪 개발환경 시뮬레이션: 의도적 지연 추가
    const isDevelopment = process.env.NODE_ENV === 'development';
    if (isDevelopment) {
      console.log(`🧪 개발환경 시뮬레이션: 10초 지연 시작`);
      await new Promise(resolve => setTimeout(resolve, 10000)); // 10초 지연
    }

    let result;

    // 분석 타입에 따라 적절한 함수 호출
    switch (analysisType) {
      case 'basic':
        result = await performBasicAnalysis(classId, requestData);
        break;
      case 'overview':
        result = await performOverviewAnalysis(classId, requestData);
        break;
      case 'students':
        result = await performStudentGroupAnalysis(classId, requestData);
        break;
      default:
        throw new Error(`알 수 없는 분석 타입: ${analysisType}`);
    }

    console.log(`백그라운드 분석 완료: ${jobId}`);

    // 결과 저장
    await supabase
      .from('analysis_queue')
      .update({
        status: 'completed',
        result: result,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);

  } catch (error: any) {
    console.error(`백그라운드 분석 오류 (${jobId}):`, error);

    // 오류 상태 저장
    await supabase
      .from('analysis_queue')
      .update({
        status: 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);
  }
}

// 기본 분석 수행 (기존 route.ts 로직)
async function performBasicAnalysis(classId: string, requestData: any) {
  const supabase = createRouteHandlerClient({ cookies });

  // 데이터 조회 (기존 코드와 동일)
  const [
    { data: classData },
    { data: students },
    { data: baseRelationships },
    { data: surveys },
    { data: dailyRecords },
    { data: subjects },
    { data: homeworkMonths }
  ] = await Promise.all([
    supabase.from('classes').select('*').eq('id', classId).single(),
    supabase.from('students').select('*').eq('class_id', classId),
    supabase.from('relationships').select('*').eq('class_id', classId),
    supabase.from('surveys').select('*, survey_responses(*)').eq('class_id', classId).order('created_at', { ascending: false }),
    supabase.from('class_daily_records').select('*').eq('class_id', classId).order('record_date', { ascending: false }).limit(50),
    supabase.from('subjects').select(`*, assessment_items(*, assessment_records(*))`).eq('class_id', classId),
    supabase.from('homework_months').select(`*, homework_items(*, homework_records(*))`).eq('class_id', classId).order('month_year', { ascending: false }).limit(6)
  ]);

  const analysisData = {
    class: classData,
    students: students || [],
    baseRelationships: baseRelationships || [],
    surveys: surveys || [],
    dailyRecords: dailyRecords || [],
    assessmentData: subjects || [],
    homeworkData: homeworkMonths || []
  };

  return await analyzeStudentRelationshipsWithGemini(
    students || [],
    baseRelationships || [],
    undefined,
    undefined,
    {
      classDetails: classData,
      surveys: surveys || [],
      dailyRecords: dailyRecords || [],
      subjects: subjects || [],
      homeworkMonths: homeworkMonths || []
    },
    'flash'
  );
}

// 종합 분석 수행 (기존 overview/route.ts 로직)
async function performOverviewAnalysis(classId: string, requestData: any) {
  const supabase = createRouteHandlerClient({ cookies });

  // 데이터 조회 (기존 코드와 동일)
  const [
    { data: classData },
    { data: students },
    { data: baseRelationships },
    { data: surveys },
    { data: dailyRecords },
    { data: subjects },
    { data: homeworkMonths }
  ] = await Promise.all([
    supabase.from('classes').select('*').eq('id', classId).single(),
    supabase.from('students').select('*').eq('class_id', classId),
    supabase.from('relationships').select('*').eq('class_id', classId),
    supabase.from('surveys').select('*, survey_responses(*)').eq('class_id', classId).order('created_at', { ascending: false }),
    supabase.from('class_daily_records').select('*').eq('class_id', classId).order('record_date', { ascending: false }).limit(50),
    supabase.from('subjects').select(`*, assessment_items(*, assessment_records(*))`).eq('class_id', classId),
    supabase.from('homework_months').select(`*, homework_items(*, homework_records(*))`).eq('class_id', classId).order('month_year', { ascending: false }).limit(6)
  ]);

  const analysisData = {
    class: classData,
    students: students || [],
    baseRelationships: baseRelationships || [],
    surveys: surveys || [],
    dailyRecords: dailyRecords || [],
    assessmentData: subjects || [],
    homeworkData: homeworkMonths || []
  };

  return await analyzeClassOverviewWithGemini(
    students || [],
    baseRelationships || [],
    undefined,
    undefined,
    {
      classDetails: classData,
      surveys: surveys || [],
      dailyRecords: dailyRecords || [],
      subjects: subjects || [],
      homeworkMonths: homeworkMonths || []
    },
    'flash'
  );
}

// 학생 그룹 분석 수행 (기존 students/route.ts 로직)
async function performStudentGroupAnalysis(classId: string, requestData: any) {
  const supabase = createRouteHandlerClient({ cookies });
  const { studentIds } = requestData;

  // 데이터 조회 (기존 코드와 동일)
  const [
    { data: classData },
    { data: students },
    { data: baseRelationships },
    { data: surveys },
    { data: dailyRecords },
    { data: subjects },
    { data: homeworkMonths }
  ] = await Promise.all([
    supabase.from('classes').select('*').eq('id', classId).single(),
    supabase.from('students').select('*').eq('class_id', classId),
    supabase.from('relationships').select('*').eq('class_id', classId),
    supabase.from('surveys').select('*, survey_responses(*)').eq('class_id', classId).order('created_at', { ascending: false }),
    supabase.from('class_daily_records').select('*').eq('class_id', classId).order('record_date', { ascending: false }).limit(50),
    supabase.from('subjects').select(`*, assessment_items(*, assessment_records(*))`).eq('class_id', classId),
    supabase.from('homework_months').select(`*, homework_items(*, homework_records(*))`).eq('class_id', classId).order('month_year', { ascending: false }).limit(6)
  ]);

  const analysisData = {
    class: classData,
    students: students || [],
    baseRelationships: baseRelationships || [],
    surveys: surveys || [],
    selectedStudentIds: studentIds,
    dailyRecords: dailyRecords || [],
    assessmentData: subjects || [],
    homeworkData: homeworkMonths || []
  };

  return await analyzeStudentGroupWithGemini(
    students?.filter(s => studentIds.includes(s.id)) || [],
    baseRelationships || [],
    1, // groupIndex
    undefined,
    undefined,
    {
      classDetails: classData,
      surveys: surveys || [],
      allStudents: students || [],
      dailyRecords: dailyRecords || [],
      subjects: subjects || [],
      homeworkMonths: homeworkMonths || []
    },
    'flash'
  );
} 