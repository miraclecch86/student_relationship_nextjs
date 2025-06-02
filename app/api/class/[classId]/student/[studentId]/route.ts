import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { StudentUpdateData, StudentForClient } from '@/lib/supabase';

interface RouteParams {
  params: Promise<{ classId: string; studentId: string }>;
}

// 학생 상세 정보 조회 (GET)
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { classId, studentId } = await params;
    const supabase = createRouteHandlerClient({ cookies });
    
    // 사용자 인증 확인
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    // 학급 소유권 확인
    const { data: classData, error: classError } = await (supabase as any)
      .from('classes')
      .select('id')
      .eq('id', classId)
      .eq('user_id', session.user.id)
      .single();

    if (classError || !classData) {
      return NextResponse.json({ error: '학급을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 학생 정보 조회 (비밀번호 해시 제외)
    const { data: student, error: studentError } = await (supabase as any)
      .from('students')
      .select(`
        id,
        name,
        class_id,
        gender,
        position_x,
        position_y,
        created_at,
        display_order,
        student_number,
        student_login_id,
        student_password_plain,
        address,
        mother_phone_number,
        father_phone_number,
        student_phone_number,
        birthday,
        remarks,
        health_status,
        allergies,
        tablet_number,
        previous_school_records
      `)
      .eq('id', studentId)
      .eq('class_id', classId)
      .single();

    if (studentError || !student) {
      return NextResponse.json({ error: '학생을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ 
      data: student as StudentForClient
    });
  } catch (error) {
    console.error('학생 정보 조회 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// 학생 상세 정보 업데이트 (PATCH)
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { classId, studentId } = await params;
    const supabase = createRouteHandlerClient({ cookies });
    
    // 사용자 인증 확인
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const updateData: StudentUpdateData = await request.json();

    // 학급 소유권 확인
    const { data: classData, error: classError } = await (supabase as any)
      .from('classes')
      .select('id')
      .eq('id', classId)
      .eq('user_id', session.user.id)
      .single();

    if (classError || !classData) {
      return NextResponse.json({ error: '학급을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 학생 존재 확인
    const { data: existingStudent, error: studentCheckError } = await (supabase as any)
      .from('students')
      .select('id')
      .eq('id', studentId)
      .eq('class_id', classId)
      .single();

    if (studentCheckError || !existingStudent) {
      return NextResponse.json({ error: '학생을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 업데이트할 데이터 준비
    const updateFields: any = {};

    // 기본 정보
    if (updateData.name !== undefined) updateFields.name = updateData.name;
    if (updateData.gender !== undefined) {
      // 빈 문자열을 null로 변환 (런타임에서 빈 문자열이 올 수 있음)
      updateFields.gender = (updateData.gender as any) === '' ? null : updateData.gender;
    }
    if (updateData.student_number !== undefined) updateFields.student_number = updateData.student_number;

    // 로그인 정보
    if (updateData.student_login_id !== undefined) {
      // 빈 문자열을 null로 변환
      const loginId = updateData.student_login_id === '' ? null : updateData.student_login_id;
      
      // 로그인 ID 중복 확인 (다른 학생과 중복되지 않도록, null이 아닌 경우만)
      if (loginId) {
        const { data: duplicateCheck } = await (supabase as any)
          .from('students')
          .select('id')
          .eq('student_login_id', loginId)
          .neq('id', studentId)
          .single();

        if (duplicateCheck) {
          return NextResponse.json({ error: '이미 사용 중인 로그인 아이디입니다.' }, { status: 400 });
        }
      }
      updateFields.student_login_id = loginId;
    }

    // 비밀번호 처리 (undefined가 아닌 경우 모두 처리)
    if (updateData.student_password !== undefined) {
      if (updateData.student_password && updateData.student_password.trim()) {
        // 비밀번호가 입력된 경우
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(updateData.student_password, saltRounds);
        updateFields.student_password_hashed = hashedPassword;
        updateFields.student_password_plain = updateData.student_password.trim();
      } else {
        // 비밀번호가 빈 값인 경우 (삭제)
        updateFields.student_password_hashed = null;
        updateFields.student_password_plain = null;
      }
    }

    // 연락처 정보
    if (updateData.address !== undefined) updateFields.address = updateData.address;
    if (updateData.mother_phone_number !== undefined) updateFields.mother_phone_number = updateData.mother_phone_number;
    if (updateData.father_phone_number !== undefined) updateFields.father_phone_number = updateData.father_phone_number;
    if (updateData.student_phone_number !== undefined) updateFields.student_phone_number = updateData.student_phone_number;

    // 개인 정보
    if (updateData.birthday !== undefined) {
      // 빈 문자열인 경우 null로 처리
      updateFields.birthday = updateData.birthday === '' ? null : updateData.birthday;
    }
    if (updateData.remarks !== undefined) updateFields.remarks = updateData.remarks;
    if (updateData.health_status !== undefined) updateFields.health_status = updateData.health_status;
    if (updateData.allergies !== undefined) updateFields.allergies = updateData.allergies;

    // 학습 관련 정보
    if (updateData.tablet_number !== undefined) updateFields.tablet_number = updateData.tablet_number;
    if (updateData.previous_school_records !== undefined) updateFields.previous_school_records = updateData.previous_school_records;

    // 업데이트할 필드가 없는 경우
    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ error: '업데이트할 데이터가 없습니다.' }, { status: 400 });
    }

    // 학생 정보 업데이트
    const { data: updatedStudent, error: updateError } = await (supabase as any)
      .from('students')
      .update(updateFields)
      .eq('id', studentId)
      .eq('class_id', classId)
      .select(`
        id,
        name,
        class_id,
        gender,
        position_x,
        position_y,
        created_at,
        display_order,
        student_number,
        student_login_id,
        student_password_plain,
        address,
        mother_phone_number,
        father_phone_number,
        student_phone_number,
        birthday,
        remarks,
        health_status,
        allergies,
        tablet_number,
        previous_school_records
      `)
      .single();

    if (updateError) {
      console.error('학생 정보 업데이트 오류:', updateError);
      return NextResponse.json({ error: '학생 정보 업데이트에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ 
      data: updatedStudent as StudentForClient,
      message: '학생 정보가 성공적으로 업데이트되었습니다.'
    });
  } catch (error) {
    console.error('학생 정보 업데이트 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
} 