-- 학급 일정 테이블에 색상 컬럼 추가
-- 일정 색상 선택 기능

-- 색상 컬럼 추가
ALTER TABLE public.class_schedules ADD COLUMN IF NOT EXISTS color text DEFAULT 'blue';

-- 컬럼 주석 추가
COMMENT ON COLUMN public.class_schedules.color IS '일정 색상 (blue, red, green, yellow, purple, pink, indigo, gray)';

-- 색상 제약 조건 추가 (선택적)
ALTER TABLE public.class_schedules ADD CONSTRAINT check_valid_color 
CHECK (color IN ('blue', 'red', 'green', 'yellow', 'purple', 'pink', 'indigo', 'gray', 'orange', 'teal')); 