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