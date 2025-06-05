-- 평가 기록 관련 테이블들만 생성하는 SQL

-- 과목 테이블
CREATE TABLE IF NOT EXISTS public.subjects (
    id uuid primary key default gen_random_uuid(),
    class_id uuid references public.classes(id) on delete cascade not null,
    name text not null,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- subjects 테이블에 RLS 활성화
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects FORCE ROW LEVEL SECURITY;

-- subjects 테이블 정책 설정
DROP POLICY IF EXISTS "Users can view their own subjects" ON public.subjects;
CREATE POLICY "Users can view their own subjects" ON public.subjects
    FOR ALL
    USING (
        class_id IN (
            SELECT id FROM public.classes 
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        class_id IN (
            SELECT id FROM public.classes 
            WHERE user_id = auth.uid()
        )
    );

-- 평가 항목 테이블
CREATE TABLE IF NOT EXISTS public.assessment_items (
    id uuid primary key default gen_random_uuid(),
    subject_id uuid references public.subjects(id) on delete cascade not null,
    name text not null,
    assessment_date date,
    order_index integer not null default 1,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- assessment_items 테이블에 RLS 활성화
ALTER TABLE public.assessment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_items FORCE ROW LEVEL SECURITY;

-- assessment_items 테이블 정책 설정
DROP POLICY IF EXISTS "Users can view their own assessment items" ON public.assessment_items;
CREATE POLICY "Users can view their own assessment items" ON public.assessment_items
    FOR ALL
    USING (
        subject_id IN (
            SELECT s.id FROM public.subjects s
            INNER JOIN public.classes c ON s.class_id = c.id
            WHERE c.user_id = auth.uid()
        )
    )
    WITH CHECK (
        subject_id IN (
            SELECT s.id FROM public.subjects s
            INNER JOIN public.classes c ON s.class_id = c.id
            WHERE c.user_id = auth.uid()
        )
    );

-- 평가 기록 테이블
CREATE TABLE IF NOT EXISTS public.assessment_records (
    id uuid primary key default gen_random_uuid(),
    student_id uuid references public.students(id) on delete cascade not null,
    assessment_item_id uuid references public.assessment_items(id) on delete cascade not null,
    score text not null default '',
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    UNIQUE(student_id, assessment_item_id)
);

-- assessment_records 테이블에 RLS 활성화
ALTER TABLE public.assessment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_records FORCE ROW LEVEL SECURITY;

-- assessment_records 테이블 정책 설정
DROP POLICY IF EXISTS "Users can view their own assessment records" ON public.assessment_records;
CREATE POLICY "Users can view their own assessment records" ON public.assessment_records
    FOR ALL
    USING (
        student_id IN (
            SELECT st.id FROM public.students st
            INNER JOIN public.classes c ON st.class_id = c.id
            WHERE c.user_id = auth.uid()
        )
    )
    WITH CHECK (
        student_id IN (
            SELECT st.id FROM public.students st
            INNER JOIN public.classes c ON st.class_id = c.id
            WHERE c.user_id = auth.uid()
        )
    );

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_subjects_class_id ON public.subjects(class_id);
CREATE INDEX IF NOT EXISTS idx_assessment_items_subject_id ON public.assessment_items(subject_id);
CREATE INDEX IF NOT EXISTS idx_assessment_records_student_id ON public.assessment_records(student_id);
CREATE INDEX IF NOT EXISTS idx_assessment_records_assessment_item_id ON public.assessment_records(assessment_item_id);

-- updated_at 트리거 함수들
CREATE OR REPLACE FUNCTION public.update_subjects_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_assessment_items_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_assessment_records_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- updated_at 트리거 생성
DROP TRIGGER IF EXISTS trigger_update_subjects_updated_at ON public.subjects;
CREATE TRIGGER trigger_update_subjects_updated_at
    BEFORE UPDATE ON public.subjects
    FOR EACH ROW
    EXECUTE FUNCTION public.update_subjects_updated_at();

DROP TRIGGER IF EXISTS trigger_update_assessment_items_updated_at ON public.assessment_items;
CREATE TRIGGER trigger_update_assessment_items_updated_at
    BEFORE UPDATE ON public.assessment_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_assessment_items_updated_at();

DROP TRIGGER IF EXISTS trigger_update_assessment_records_updated_at ON public.assessment_records;
CREATE TRIGGER trigger_update_assessment_records_updated_at
    BEFORE UPDATE ON public.assessment_records
    FOR EACH ROW
    EXECUTE FUNCTION public.update_assessment_records_updated_at();

-- 기존 테이블에 assessment_date 컬럼 추가 (이미 있으면 무시)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'assessment_items' 
        AND column_name = 'assessment_date'
    ) THEN
        ALTER TABLE public.assessment_items ADD COLUMN assessment_date date;
    END IF;
END $$;

-- 주석 추가
COMMENT ON TABLE public.subjects IS '과목 테이블 - 학급별 과목 정보';
COMMENT ON TABLE public.assessment_items IS '평가 항목 테이블 - 과목별 평가 항목';
COMMENT ON TABLE public.assessment_records IS '평가 기록 테이블 - 학생별 평가 점수/내용';

COMMENT ON COLUMN public.subjects.name IS '과목명 (예: 국어, 수학, 영어)';
COMMENT ON COLUMN public.assessment_items.name IS '평가 항목명 (예: 국어1, 발표력, 태도)';
COMMENT ON COLUMN public.assessment_items.assessment_date IS '평가 날짜';
COMMENT ON COLUMN public.assessment_items.order_index IS '표시 순서';
COMMENT ON COLUMN public.assessment_records.score IS '평가 점수나 내용 (텍스트)'; 