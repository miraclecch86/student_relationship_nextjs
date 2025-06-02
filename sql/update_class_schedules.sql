-- 학급 일정 테이블 업데이트 마이그레이션
-- 기간 일정 및 하루종일 옵션 추가

-- 종료일 컬럼 추가
ALTER TABLE public.class_schedules ADD COLUMN IF NOT EXISTS end_date date;

-- 하루종일 옵션 컬럼 추가
ALTER TABLE public.class_schedules ADD COLUMN IF NOT EXISTS is_all_day boolean DEFAULT false;

-- 컬럼 주석 추가
COMMENT ON COLUMN public.class_schedules.end_date IS '일정 종료일 (단일일 일정인 경우 NULL)';
COMMENT ON COLUMN public.class_schedules.is_all_day IS '하루종일 일정 여부';

-- 제약 조건 추가: end_date는 schedule_date보다 크거나 같아야 함
ALTER TABLE public.class_schedules ADD CONSTRAINT check_end_date_after_start_date 
CHECK (end_date IS NULL OR end_date >= schedule_date);

-- 제약 조건 추가: 하루종일 일정인 경우 시간 정보가 없어야 함
ALTER TABLE public.class_schedules ADD CONSTRAINT check_all_day_no_time 
CHECK (
    (is_all_day = true AND start_time IS NULL AND end_time IS NULL) OR
    (is_all_day = false OR is_all_day IS NULL)
); 