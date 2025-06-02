-- 오늘의 우리반 기록 테이블 생성
CREATE TABLE IF NOT EXISTS class_daily_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  record_date DATE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  record_type TEXT NOT NULL CHECK (record_type IN ('사건사고', '즐거운일', '특별활동', '기타')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_class_daily_records_class_id ON class_daily_records(class_id);
CREATE INDEX IF NOT EXISTS idx_class_daily_records_record_date ON class_daily_records(record_date);
CREATE INDEX IF NOT EXISTS idx_class_daily_records_class_date ON class_daily_records(class_id, record_date);

-- RLS (Row Level Security) 활성화
ALTER TABLE class_daily_records ENABLE ROW LEVEL SECURITY;

-- RLS 정책 생성: 같은 사용자의 학급 기록만 접근 가능
CREATE POLICY "Users can only access their own class daily records" ON class_daily_records
  FOR ALL USING (
    class_id IN (
      SELECT id FROM classes WHERE user_id = auth.uid()
    )
  );

-- updated_at 트리거 생성
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_class_daily_records_updated_at 
  BEFORE UPDATE ON class_daily_records 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 코멘트 추가
COMMENT ON TABLE class_daily_records IS '학급별 일일 기록 테이블 (오늘의 우리반)';
COMMENT ON COLUMN class_daily_records.class_id IS '학급 ID (외래키)';
COMMENT ON COLUMN class_daily_records.record_date IS '기록 날짜';
COMMENT ON COLUMN class_daily_records.title IS '기록 제목';
COMMENT ON COLUMN class_daily_records.content IS '기록 내용';
COMMENT ON COLUMN class_daily_records.record_type IS '기록 유형 (사건사고, 즐거운일, 특별활동, 기타)'; 