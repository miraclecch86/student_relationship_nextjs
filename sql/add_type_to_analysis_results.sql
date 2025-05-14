-- analysis_results 테이블에 type 필드 추가
ALTER TABLE public.analysis_results 
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'full' NOT NULL;

-- type 필드에 대한 제약 조건 추가
ALTER TABLE public.analysis_results 
ADD CONSTRAINT analysis_results_type_check 
CHECK (type IN ('full', 'overview', 'students-1', 'students-2', 'students-3'));

-- 컬럼 설명 추가
COMMENT ON COLUMN public.analysis_results.type IS 'Type of analysis: full (old complete analysis), overview (general class analysis), students-1/2/3 (student-specific analysis by groups)';

-- 기존 레코드 업데이트 (기존 레코드는 모두 'full' 타입으로 설정)
-- UPDATE public.analysis_results SET type = 'full' WHERE type IS NULL;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_analysis_results_type ON public.analysis_results(type); 