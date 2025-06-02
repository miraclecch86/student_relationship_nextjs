-- 학급 빠른 메모 테이블 생성
-- 선생님이 빠르게 메모를 남길 수 있는 기능

CREATE TABLE IF NOT EXISTS public.class_quick_memos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_class_quick_memos_class_id ON public.class_quick_memos(class_id);
CREATE INDEX IF NOT EXISTS idx_class_quick_memos_created_at ON public.class_quick_memos(created_at DESC);

-- RLS 정책 활성화
ALTER TABLE public.class_quick_memos ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 학급 메모만 조회/수정 가능
CREATE POLICY "Users can view their own class quick memos" ON public.class_quick_memos
FOR SELECT USING (
  class_id IN (
    SELECT id FROM public.classes WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own class quick memos" ON public.class_quick_memos
FOR INSERT WITH CHECK (
  class_id IN (
    SELECT id FROM public.classes WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own class quick memos" ON public.class_quick_memos
FOR UPDATE USING (
  class_id IN (
    SELECT id FROM public.classes WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own class quick memos" ON public.class_quick_memos
FOR DELETE USING (
  class_id IN (
    SELECT id FROM public.classes WHERE user_id = auth.uid()
  )
);

-- 컬럼 설명 추가
COMMENT ON TABLE public.class_quick_memos IS '학급 빠른 메모 - 선생님이 간단하게 메모를 남기는 기능';
COMMENT ON COLUMN public.class_quick_memos.id IS '메모 고유 ID';
COMMENT ON COLUMN public.class_quick_memos.class_id IS '학급 ID (외래키)';
COMMENT ON COLUMN public.class_quick_memos.content IS '메모 내용';
COMMENT ON COLUMN public.class_quick_memos.created_at IS '생성 일시';
COMMENT ON COLUMN public.class_quick_memos.updated_at IS '수정 일시'; 