-- 분석 큐 테이블 생성
CREATE TABLE IF NOT EXISTS analysis_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL,
  analysis_type TEXT NOT NULL, -- 'basic', 'overview', 'students'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  request_data JSONB NOT NULL, -- 요청 데이터
  result JSONB, -- 분석 결과
  error_message TEXT, -- 오류 메시지 (실패시)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT fk_analysis_queue_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_analysis_queue_class_id ON analysis_queue(class_id);
CREATE INDEX IF NOT EXISTS idx_analysis_queue_status ON analysis_queue(status);
CREATE INDEX IF NOT EXISTS idx_analysis_queue_created_at ON analysis_queue(created_at);

-- 오래된 완료된 작업 정리를 위한 함수 (선택사항)
CREATE OR REPLACE FUNCTION cleanup_old_analysis_queue()
RETURNS void AS $$
BEGIN
  DELETE FROM analysis_queue 
  WHERE status IN ('completed', 'failed') 
  AND completed_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql; 

-- RLS 활성화 및 강제 적용
ALTER TABLE public.analysis_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_queue FORCE ROW LEVEL SECURITY;

-- 조회 정책
CREATE POLICY "Users can view their own analysis queue"
ON public.analysis_queue FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.classes
    WHERE classes.id = analysis_queue.class_id
    AND classes.user_id = auth.uid()
  )
);

-- 추가 정책
CREATE POLICY "Users can insert their own analysis queue"
ON public.analysis_queue FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.classes
    WHERE classes.id = class_id
    AND classes.user_id = auth.uid()
  )
);

-- 수정 정책
CREATE POLICY "Users can update their own analysis queue"
ON public.analysis_queue FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.classes
    WHERE classes.id = analysis_queue.class_id
    AND classes.user_id = auth.uid()
  )
);

-- 삭제 정책
CREATE POLICY "Users can delete their own analysis queue"
ON public.analysis_queue FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.classes
    WHERE classes.id = analysis_queue.class_id
    AND classes.user_id = auth.uid()
  )
);