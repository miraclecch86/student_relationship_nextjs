-- analysis_results 테이블에 session_id 필드 추가
ALTER TABLE public.analysis_results 
ADD COLUMN IF NOT EXISTS session_id TEXT;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_analysis_results_session_id ON public.analysis_results(session_id);

-- 컬럼 설명 추가
COMMENT ON COLUMN public.analysis_results.session_id IS 'Unique identifier for a group of related analyses created in the same session. Used to group multiple analysis types (overview, students) as a single unit.'; 