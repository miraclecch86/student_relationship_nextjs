"use server";

import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/lib/database.types';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function createClass(formData: {
  year: number;
  school: string;
  grade: number;
  classNum: number;
}) {
  const supabase = createServerComponentClient<Database>({ cookies });
  
  let newClassId: string | null = null;
  
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      throw new Error(userError?.message || '로그인이 필요합니다.');
    }
    
    console.log('[Action: createClass] User retrieved successfully, User ID:', user.id);

    const className = `${formData.year} ${formData.school} ${formData.grade}학년 ${formData.classNum}반`;
    
    console.log('[Action: createClass] Attempting to insert class', className, 'with user_id:', user.id);
    
    const { data: insertedData, error: insertError } = await (supabase as any)
      .from('classes')
      .insert([{ 
        name: className,
        user_id: user.id,
      } as any])
      .select('id')
      .single();

    if (insertError || !insertedData?.id) {
      console.error('[Action: createClass] Insert Error or ID missing:', insertError, insertedData);
      throw new Error(insertError?.message || '학급 생성 후 ID를 반환받지 못했습니다.');
    }
    
    newClassId = insertedData.id;
    console.log('[Action: createClass] Class created successfully with ID:', newClassId);

    revalidatePath('/teacher');

  } catch (error) {
    console.error('[Action: createClass] Error caught:', error);
    let errorMessage = '학급 생성 중 오류가 발생했습니다.';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    const params = new URLSearchParams();
    params.set('year', String(formData.year));
    params.set('school', formData.school);
    params.set('grade', String(formData.grade));
    params.set('classNum', String(formData.classNum));
    params.set('error', errorMessage);
    redirect(`/class/create/grade?${params.toString()}`);
  }
  
  if (newClassId) {
     redirect(`/class/create/students?classId=${newClassId}`);
  }
}
