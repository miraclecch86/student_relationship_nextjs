-- Supabase Schema SQL: 학생 관계도 시각화 프로젝트

-- ✅ 1. 학급 테이블
create table classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamp with time zone default now()
);

-- ✅ 2. 학생 테이블
create table students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references classes(id) on delete cascade,
  name text not null,
  gender text check (gender in ('male', 'female')),
  position_x float, -- 관계도 좌표 X
  position_y float, -- 관계도 좌표 Y
  created_at timestamp with time zone default now()
);

-- ✅ 3. 관계 테이블
create table relations (
  id uuid primary key default gen_random_uuid(),
  from_student_id uuid references students(id) on delete cascade,
  to_student_id uuid references students(id) on delete cascade,
  relation_type text check (relation_type in (
    'FRIEND', 'CLOSE_FRIEND', 'BEST_FRIEND', 'ACQUAINTANCE', 'MENTOR', 'MENTEE'
  )),
  created_at timestamp with time zone default now(),
  constraint relations_from_to_student_id_unique unique (from_student_id, to_student_id)
);

-- ✅ 4. 주관식 질문 테이블
create table questions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references classes(id) on delete cascade,
  question_text text not null,
  created_at timestamp with time zone default now()
);

-- ✅ 5. 주관식 응답 테이블
create table answers (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  question_id uuid references questions(id) on delete cascade,
  answer_text text,
  created_at timestamp with time zone default now(),
  constraint answers_student_question_id_unique unique (student_id, question_id)
);

-- =============================================
-- RPC Functions (자동 생성을 위해 추가)
-- =============================================

-- ✅ 6. 학급 및 관련 데이터 삭제 함수
CREATE OR REPLACE FUNCTION public.delete_class(class_id_to_delete uuid)
RETURNS void
LANGUAGE sql
AS $$
  DELETE FROM public.classes WHERE id = class_id_to_delete;
$$;

-- ✅ 7. 학생 및 관련 데이터 삭제 함수
CREATE OR REPLACE FUNCTION public.delete_student(student_id_to_delete uuid)
RETURNS void
LANGUAGE sql
AS $$
  DELETE FROM public.students WHERE id = student_id_to_delete;
$$;

-- ✅ 8. 특정 학급 데이터 초기화 함수 (학생, 관계, 답변 삭제)
CREATE OR REPLACE FUNCTION public.reset_class_data(class_id_to_reset uuid)
RETURNS void
LANGUAGE sql
AS $$
  DELETE FROM public.students WHERE class_id = class_id_to_reset;
$$;

-- ✅ 9. 모든 학급/학생 데이터 교체 함수 (주의: 모든 데이터 삭제 후 삽입)
CREATE OR REPLACE FUNCTION public.replace_all_classes(new_classes jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  class_data jsonb;
BEGIN
  DELETE FROM public.classes;

  IF jsonb_array_length(new_classes) > 0 THEN
    FOR class_data IN SELECT * FROM jsonb_array_elements(new_classes)
    LOOP
      INSERT INTO public.classes (name) VALUES (class_data->>'name');
    END LOOP;
  END IF;

END;
$$;
