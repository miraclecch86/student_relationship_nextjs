-- ✅ 학생 상세 정보 컬럼 추가 마이그레이션 스크립트
-- 기존 students 테이블에 새로운 상세 정보 컬럼들만 추가

-- 학생 번호 컬럼 추가 (이미 있을 수 있으므로 IF NOT EXISTS 사용)
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS student_number integer;

-- 학생 로그인 정보 컬럼들 추가
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS student_login_id text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS student_password_hashed text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS student_password_plain text;

-- 연락처 정보 컬럼들 추가
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS mother_phone_number text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS father_phone_number text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS student_phone_number text;

-- 개인 정보 컬럼들 추가
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS birthday date;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS remarks text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS health_status text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS allergies text;

-- 학습 관련 정보 컬럼들 추가
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS tablet_number text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS previous_school_records text;

-- UNIQUE 제약 조건 추가 (student_login_id)
-- 기존 제약 조건이 있을 수 있으므로 먼저 삭제 후 추가
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_login_id_unique;
ALTER TABLE public.students ADD CONSTRAINT students_login_id_unique UNIQUE (student_login_id);

-- 컬럼 주석 추가
COMMENT ON COLUMN public.students.student_number IS '학생 번호 (학생명 앞에 표시될 번호)';
COMMENT ON COLUMN public.students.student_login_id IS '학생 로그인 아이디 (외부 시스템 접속용, UNIQUE)';
COMMENT ON COLUMN public.students.student_password_hashed IS '해싱된 학생 비밀번호 (평문 저장 금지)';
COMMENT ON COLUMN public.students.student_password_plain IS '평문 학생 비밀번호';
COMMENT ON COLUMN public.students.address IS '학생 주소';
COMMENT ON COLUMN public.students.mother_phone_number IS '어머니 전화번호';
COMMENT ON COLUMN public.students.father_phone_number IS '아버지 전화번호';
COMMENT ON COLUMN public.students.student_phone_number IS '학생 전화번호';
COMMENT ON COLUMN public.students.birthday IS '학생 생일';
COMMENT ON COLUMN public.students.remarks IS '특이사항 (여러 줄 입력 가능)';
COMMENT ON COLUMN public.students.health_status IS '건강상태 (여러 줄 입력 가능)';
COMMENT ON COLUMN public.students.allergies IS '알레르기 정보 (여러 줄 입력 가능)';
COMMENT ON COLUMN public.students.tablet_number IS '태블릿 번호';
COMMENT ON COLUMN public.students.previous_school_records IS '이전 학적 정보 (여러 줄 입력 가능)'; 