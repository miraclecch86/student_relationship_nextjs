"use server";

import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { Database } from '@/lib/database.types';

export async function createClass({ school, grade, classNum, year }: {
  school: string;
  grade: number;
  classNum: number;
  year: string;
}) {
  const cookieStore = cookies();
  console.log('[Action: createClass] Cookies:', cookieStore.getAll());

  const supabase = createServerComponentClient<Database>({ cookies: () => cookieStore });
  
  const { data: { user }, error: getUserError } = await supabase.auth.getUser();

  if (getUserError) {
    console.error("Error getting user:", getUserError);
    throw new Error(`사용자 정보를 가져오는 중 오류 발생: ${getUserError.message}`);
  }

  if (!user) {
    throw new Error("로그인된 사용자 세션이 존재하지 않습니다. (getUser 반환값 null)");
  }

  console.log(`[Action: createClass] User retrieved successfully, User ID: ${user.id}`);

  const className = `${year} ${school} ${grade}학년 ${classNum}반`;
  console.log(`[Action: createClass] Attempting to insert class '${className}' with user_id: ${user.id}`);

  const { data, error } = await supabase.from("classes").insert({
    name: className,
    user_id: user.id,
  }).select().single();

  if (error) {
    console.error("Error inserting class (Full Error Object):", error);
    if (error.message.includes('violates row-level security policy')) {
        throw new Error(`학급 생성 실패: RLS 정책 위반. 현재 사용자(ID: ${user.id})로 ${className} 학급 생성이 거부되었습니다. 정책을 확인하세요.`);
    }
    throw new Error(`학급 생성 중 데이터베이스 오류가 발생했습니다: ${error.message}`);
  }

  console.log("[Action: createClass] Class created successfully:", data);
  return data;
}
