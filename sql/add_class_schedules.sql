-- 학급 일정 테이블 추가 마이그레이션
-- 이 스크립트는 한 번만 실행되어야 합니다.

-- ✅ 학급 일정 테이블 (Class Schedules)
CREATE TABLE IF NOT EXISTS public.class_schedules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
    title text NOT NULL,
    description text,
    schedule_date date NOT NULL,
    start_time time,
    end_time time,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_class_schedules_class_id ON public.class_schedules(class_id);
CREATE INDEX IF NOT EXISTS idx_class_schedules_date ON public.class_schedules(schedule_date);

-- RLS 활성화
ALTER TABLE public.class_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_schedules FORCE ROW LEVEL SECURITY;

-- RLS 정책 설정
CREATE POLICY "Users can view their own class schedules"
ON public.class_schedules FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.classes
        WHERE classes.id = class_schedules.class_id
        AND classes.user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert their own class schedules"
ON public.class_schedules FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.classes
        WHERE classes.id = class_id
        AND classes.user_id = auth.uid()
    )
);

CREATE POLICY "Users can update their own class schedules"
ON public.class_schedules FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.classes
        WHERE classes.id = class_schedules.class_id
        AND classes.user_id = auth.uid()
    )
);

CREATE POLICY "Users can delete their own class schedules"
ON public.class_schedules FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.classes
        WHERE classes.id = class_schedules.class_id
        AND classes.user_id = auth.uid()
    )
);

-- 업데이트 트리거
CREATE OR REPLACE FUNCTION public.update_class_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_class_schedules_updated_at
    BEFORE UPDATE ON public.class_schedules
    FOR EACH ROW
    EXECUTE FUNCTION public.update_class_schedules_updated_at(); 