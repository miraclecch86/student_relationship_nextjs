import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from './database.types'; // Database 타입을 가져옵니다.

// createClient 대신 createClientComponentClient 사용
// 클라이언트 컴포넌트에서 사용할 싱글톤 인스턴스 생성
export const supabase = createClientComponentClient<Database>(); 

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
  display_order?: number;
}

export interface Class {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
}

export interface Relationship {
  id: string;
  from_student_id: string; // 스키마에 맞게 수정
  to_student_id: string;   // 스키마에 맞게 수정
  relation_type: '친한' | '보통' | '안친한'; // 스키마의 check 제약 조건 반영
  survey_id?: string; // survey_id 추가
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
  answer_text?: string;
  created_at: string;
  // 질문 텍스트를 join해서 가져올 경우
  questions?: { question_text: string } | null;
}

// Survey 타입 정의 추가
export interface Survey {
  id: string;
  class_id: string;
  name: string;
  description?: string;
  created_at: string;
} 

// ✅ 학급 일지 관련 타입 정의 추가

// 학급 일지 마스터 테이블
export interface ClassJournal {
  id: string;
  class_id: string;
  journal_date: string; // YYYY-MM-DD 형식
  created_at: string;
  updated_at: string;
}

// 알림장 테이블
export interface JournalAnnouncement {
  id: string;
  journal_id: string;
  keywords?: string[] | null;
  teacher_input_content?: string | null;
  ai_generated_content?: string | null;
  created_at: string;
  updated_at: string;
}

// 학생 출결 및 상태 테이블 (오늘의 아이들)
export interface JournalStudentStatus {
  id: string;
  journal_id: string;
  student_id: string;
  attendance_status: '출석' | '조퇴' | '결석' | '체험학습';
  memo?: string | null;
  created_at: string;
  updated_at: string;
  // 조인된 학생 정보 (선택적)
  students?: Pick<Student, 'id' | 'name'> | null;
}

// 학급 메모 테이블 (오늘의 우리 반)
export interface JournalClassMemo {
  id: string;
  journal_id: string;
  content?: string | null;
  created_at: string;
  updated_at: string;
}

// 학급 일지 전체 데이터 (조인된 형태)
export interface ClassJournalWithDetails extends ClassJournal {
  journal_announcements?: JournalAnnouncement[] | null;
  journal_student_status?: JournalStudentStatus[] | null;
  journal_class_memos?: JournalClassMemo[] | null;
}

// 출결 상태 상수
export const ATTENDANCE_STATUS = {
  PRESENT: '출석',
  EARLY_LEAVE: '조퇴',
  ABSENT: '결석',
  FIELD_TRIP: '체험학습',
} as const;

export type AttendanceStatusType = typeof ATTENDANCE_STATUS[keyof typeof ATTENDANCE_STATUS]; 