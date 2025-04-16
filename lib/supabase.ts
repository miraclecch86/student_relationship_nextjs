import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Student {
  id: string;
  name: string;
  class_id: string;
  gender?: 'male' | 'female' | null;
  // weekly_form_data?: { [key: string]: string }; // 사용 안 함
  // class_? 는 실제 컬럼이 아니므로 제거하거나 주석 처리 (일단 제거)
  position_x?: number | null; // 노드 위치 저장용
  position_y?: number | null; // 노드 위치 저장용
  created_at?: string; // 스키마에 created_at 이 있으므로 추가 (선택적)
}

export interface Class {
  id: string;
  name: string;
  // teacher_name 제거
  created_at: string;
  // student_count 제거
}

export interface Relationship {
  id: string;
  from_student_id: string; // 스키마에 맞게 수정
  to_student_id: string;   // 스키마에 맞게 수정
  relation_type: '친한' | '보통' | '안친한'; // 스키마의 check 제약 조건 반영
  created_at: string;
  // strength, updated_at 제거
}

export interface Question {
  id: string;
  class_id: string;
  question_text: string;
  created_at: string;
}

export interface Answer {
  id: string;
  student_id: string;
  question_id: string;
  answer_text: string;
  created_at: string;
  // 질문 텍스트를 join해서 가져올 경우
  questions?: { question_text: string } | null;
} 