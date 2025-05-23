-- Supabase Schema SQL: 학생 관계도 시각화 프로젝트

-- ✅ 1. 학급 테이블
create table classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamp with time zone default now()
);

-- classes 테이블에 RLS 활성화
alter table classes enable row level security;

-- classes 테이블 RLS 정책 설정
create policy "Users can view their own classes"
on classes for select
using (auth.uid() = user_id);

create policy "Users can insert their own classes"
on classes for insert
with check (auth.uid() = user_id);

create policy "Users can update their own classes"
on classes for update
using (auth.uid() = user_id);

create policy "Users can delete their own classes"
on classes for delete
using (auth.uid() = user_id);

-- ✅ 2. 학생 테이블
create table students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references classes(id) on delete cascade,
  name text not null,
  gender text check (gender in ('male', 'female')),
  position_x float, -- 관계도 좌표 X
  position_y float, -- 관계도 좌표 Y
  created_at timestamp with time zone default now(),
  display_order integer
);

-- display_order 컬럼 추가 (순서 저장용)
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS display_order integer;

-- RLS 활성화 및 강제 적용 (테이블 생성 후 또는 스키마 적용 시점에 실행)
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students FORCE ROW LEVEL SECURITY; -- 테이블 소유자에게도 RLS 적용

-- 기존 정책 삭제 (존재할 경우)
DROP POLICY IF EXISTS "사용자는 자신의 클래스의 학생만 볼 수 있음" ON public.students;

-- 새 정책 생성 (display_order 고려 및 WITH CHECK 추가)
CREATE POLICY "사용자는 자신의 클래스의 학생만 볼 수 있음" ON public.students
    FOR ALL -- SELECT, INSERT, UPDATE, DELETE 모두 적용
    USING ( -- SELECT, UPDATE, DELETE 시 체크
        class_id IN (
            SELECT id FROM public.classes 
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK ( -- INSERT, UPDATE 시 체크
        class_id IN (
            SELECT id FROM public.classes 
            WHERE user_id = auth.uid()
        )
    );

-- 초기 데이터 마이그레이션 (필요시 별도 실행):
-- UPDATE public.students 
-- SET display_order = subquery.row_number
-- FROM (
--     SELECT 
--         s.id,
--         ROW_NUMBER() OVER (
--             PARTITION BY s.class_id 
--             ORDER BY s.created_at
--         ) as row_number
--     FROM public.students s
--     INNER JOIN public.classes c ON s.class_id = c.id
--     WHERE c.user_id = auth.uid() -- 로그인한 사용자의 데이터만 초기화
-- ) as subquery
-- WHERE public.students.id = subquery.id;

-- ✅ 3. 관계 테이블
create table relations (
  id uuid primary key default gen_random_uuid(),
  from_student_id uuid references students(id) on delete cascade,
  to_student_id uuid references students(id) on delete cascade,
  relation_type text check (relation_type in (
    'FRIEND', 'CLOSE_FRIEND', 'BEST_FRIEND', 'ACQUAINTANCE', 'MENTOR', 'MENTEE'
  )),
  survey_id uuid references surveys(id) on delete cascade, -- 설문 ID 추가 (NULL 허용)
  created_at timestamp with time zone default now(),
  constraint relations_from_to_survey_id_unique unique (from_student_id, to_student_id, survey_id) -- Unique 제약 조건 변경 (survey_id 포함)
);

-- 컬럼 주석 추가
COMMENT ON COLUMN public.relations.survey_id IS 'Identifier for the survey this relation belongs to. NULL indicates a class-level relation.';

-- relations 테이블에 RLS 활성화
alter table relations enable row level security;
alter table relations force row level security;

-- relations 테이블 RLS 정책 설정 (기존 정책 유지)
-- (데이터 필터링은 survey_id 기준으로 어플리케이션 레벨에서 수행)
DROP POLICY IF EXISTS "Users can view their own relations" ON public.relations;
create policy "Users can view their own relations"
on relations for select
using (
  exists (
    select 1 from students
    join classes on students.class_id = classes.id
    where students.id = relations.from_student_id
    and classes.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can insert their own relations" ON public.relations;
create policy "Users can insert their own relations"
on relations for insert
with check (
  exists (
    select 1 from students
    join classes on students.class_id = classes.id
    where students.id = from_student_id
    and classes.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update their own relations" ON public.relations;
create policy "Users can update their own relations"
on relations for update
using (
  exists (
    select 1 from students
    join classes on students.class_id = classes.id
    where students.id = relations.from_student_id
    and classes.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can delete their own relations" ON public.relations;
create policy "Users can delete their own relations"
on relations for delete
using (
  exists (
    select 1 from students
    join classes on students.class_id = classes.id
    where students.id = relations.from_student_id
    and classes.user_id = auth.uid()
  )
);

-- ✅ 4. 주관식 질문 테이블
create table questions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references classes(id) on delete cascade,
  question_text text not null,
  created_at timestamp with time zone default now()
);

-- questions 테이블에 RLS 활성화
alter table questions enable row level security;

-- questions 테이블 RLS 정책 설정
create policy "Users can view their own questions"
on questions for select
using (
  exists (
    select 1 from classes
    where classes.id = questions.class_id
    and classes.user_id = auth.uid()
  )
);

create policy "Users can insert their own questions"
on questions for insert
with check (
  exists (
    select 1 from classes
    where classes.id = class_id
    and classes.user_id = auth.uid()
  )
);

create policy "Users can update their own questions"
on questions for update
using (
  exists (
    select 1 from classes
    where classes.id = questions.class_id
    and classes.user_id = auth.uid()
  )
);

create policy "Users can delete their own questions"
on questions for delete
using (
  exists (
    select 1 from classes
    where classes.id = questions.class_id
    and classes.user_id = auth.uid()
  )
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

-- answers 테이블에 RLS 활성화
alter table answers enable row level security;

-- answers 테이블 RLS 정책 설정
create policy "Users can view their own answers"
on answers for select
using (
  exists (
    select 1 from students
    join classes on students.class_id = classes.id
    where students.id = answers.student_id
    and classes.user_id = auth.uid()
  )
);

create policy "Users can insert their own answers"
on answers for insert
with check (
  exists (
    select 1 from students
    join classes on students.class_id = classes.id
    where students.id = student_id
    and classes.user_id = auth.uid()
  )
);

create policy "Users can update their own answers"
on answers for update
using (
  exists (
    select 1 from students
    join classes on students.class_id = classes.id
    where students.id = answers.student_id
    and classes.user_id = auth.uid()
  )
);

create policy "Users can delete their own answers"
on answers for delete
using (
  exists (
    select 1 from students
    join classes on students.class_id = classes.id
    where students.id = answers.student_id
    and classes.user_id = auth.uid()
  )
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

-- ✅ 10. 사용자 역할 테이블
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null, -- auth.users 참조 및 not null 추가
  role text check (role in ('teacher', 'student')) not null, -- 역할 제한 및 not null 추가
  created_at timestamp with time zone default timezone('utc'::text, now()) not null -- 기본값 설정 및 not null 추가
);

-- user_id에 대한 인덱스 추가 (성능 향상)
create index if not exists idx_user_roles_user_id on public.user_roles(user_id);

-- 테이블 주석 추가 (설명)
comment on table public.user_roles is 'Stores user roles (teacher or student).';

-- RLS(Row Level Security) 활성화 (보안 강화)
alter table public.user_roles enable row level security;

-- 정책 생성: 사용자는 자신의 역할 정보를 볼 수 있음
create policy "Allow individual read access"
on public.user_roles for select
using (auth.uid() = user_id);

-- 정책 생성: 사용자는 자신의 역할 정보를 삽입할 수 있음
create policy "Allow individual insert access"
on public.user_roles for insert
with check (auth.uid() = user_id);

-- 정책 생성: 사용자는 자신의 역할 정보를 수정할 수 있음 (역할 변경 기능 추가 시 필요)
create policy "Allow individual update access"
on public.user_roles for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- =============================================
-- 기존 데이터 마이그레이션
-- =============================================

-- 1. 임시로 RLS 비활성화
alter table classes disable row level security;
alter table students disable row level security;
alter table relations disable row level security;
alter table questions disable row level security;
alter table answers disable row level security;

-- 2. 기존 classes 테이블에 user_id 할당 (특정 사용자 ID로 설정)
-- YOUR_USER_ID를 실제 사용자 ID로 교체해야 함
do $$
declare
  target_user_id uuid := 'YOUR_USER_ID'; -- 여기에 실제 사용자 ID 입력
begin
  -- user_id 컬럼이 없으면 추가
  if not exists (
    select 1 from information_schema.columns 
    where table_name = 'classes' and column_name = 'user_id'
  ) then
    alter table classes add column user_id uuid references auth.users(id);
  end if;

  -- 기존 데이터에 user_id 할당
  update classes set user_id = target_user_id where user_id is null;

  -- user_id를 not null로 설정
  alter table classes alter column user_id set not null;
end $$;

-- 3. RLS 다시 활성화
alter table classes enable row level security;
alter table students enable row level security;
alter table relations enable row level security;
alter table questions enable row level security;
alter table answers enable row level security;

-- 4. 마이그레이션 확인
-- 다음 쿼리로 데이터가 제대로 마이그레이션 되었는지 확인
/*
select 
  c.id as class_id,
  c.name as class_name,
  c.user_id,
  count(distinct s.id) as student_count,
  count(distinct r.id) as relation_count,
  count(distinct q.id) as question_count,
  count(distinct a.id) as answer_count
from classes c
left join students s on s.class_id = c.id
left join relations r on r.from_student_id = s.id
left join questions q on q.class_id = c.id
left join answers a on a.student_id = s.id
group by c.id, c.name, c.user_id;
*/

-- ✅ 11. 설문 테이블 (기존 파일 끝에 추가)
CREATE TABLE IF NOT EXISTS public.surveys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
COMMENT ON TABLE public.surveys IS 'Stores survey information for each class.';
COMMENT ON COLUMN public.surveys.name IS 'Name of the survey.';
COMMENT ON COLUMN public.surveys.description IS 'Optional description for the survey.';
CREATE INDEX IF NOT EXISTS idx_surveys_class_id ON public.surveys(class_id);
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surveys FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view surveys for their classes" ON public.surveys;
CREATE POLICY "Users can view surveys for their classes"
    ON public.surveys FOR SELECT
    USING (class_id IN (SELECT id FROM public.classes WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can insert surveys for their classes" ON public.surveys;
CREATE POLICY "Users can insert surveys for their classes"
    ON public.surveys FOR INSERT
    WITH CHECK (class_id IN (SELECT id FROM public.classes WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can update surveys for their classes" ON public.surveys;
CREATE POLICY "Users can update surveys for their classes"
    ON public.surveys FOR UPDATE
    USING (class_id IN (SELECT id FROM public.classes WHERE user_id = auth.uid()))
    WITH CHECK (class_id IN (SELECT id FROM public.classes WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can delete surveys for their classes" ON public.surveys;
CREATE POLICY "Users can delete surveys for their classes"
    ON public.surveys FOR DELETE
    USING (class_id IN (SELECT id FROM public.classes WHERE user_id = auth.uid()));

-- ✅ 생활기록부 테이블
CREATE TABLE IF NOT EXISTS public.school_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  result_data text NOT NULL,
  summary text,
  created_at timestamp with time zone DEFAULT now()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_school_records_class_id ON public.school_records(class_id);

-- RLS 활성화
ALTER TABLE public.school_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_records FORCE ROW LEVEL SECURITY;

-- 생활기록부 테이블 RLS 정책 설정
CREATE POLICY "Users can view their own school records"
ON public.school_records FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.classes
    WHERE classes.id = school_records.class_id
    AND classes.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own school records"
ON public.school_records FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.classes
    WHERE classes.id = class_id
    AND classes.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own school records"
ON public.school_records FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.classes
    WHERE classes.id = school_records.class_id
    AND classes.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own school records"
ON public.school_records FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.classes
    WHERE classes.id = school_records.class_id
    AND classes.user_id = auth.uid()
  )
);

-- Supabase 테이블 주석 추가
COMMENT ON TABLE public.school_records IS '학생 생활기록부 문구 저장 테이블';
COMMENT ON COLUMN public.school_records.id IS '생활기록부 고유 식별자';
COMMENT ON COLUMN public.school_records.class_id IS '관련 학급 ID';
COMMENT ON COLUMN public.school_records.result_data IS 'AI가 생성한 생활기록부 내용 (마크다운 형식)';
COMMENT ON COLUMN public.school_records.summary IS '사용자 정의 생활기록부 설명';
COMMENT ON COLUMN public.school_records.created_at IS '생성 시간';
