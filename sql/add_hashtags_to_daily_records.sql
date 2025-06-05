-- class_daily_records 테이블에 hashtags 필드 추가
-- 해시태그 기능을 위한 마이그레이션

-- hashtags 필드 추가 (JSON 배열로 저장)
ALTER TABLE class_daily_records 
ADD COLUMN IF NOT EXISTS hashtags TEXT[] DEFAULT '{}';

-- actual_date 필드도 없다면 추가 (실제 사건 발생 날짜)
ALTER TABLE class_daily_records 
ADD COLUMN IF NOT EXISTS actual_date DATE;

-- actual_date가 NULL인 기존 레코드는 record_date로 설정
UPDATE class_daily_records 
SET actual_date = record_date 
WHERE actual_date IS NULL;

-- actual_date를 NOT NULL로 변경
ALTER TABLE class_daily_records 
ALTER COLUMN actual_date SET NOT NULL;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_class_daily_records_hashtags ON class_daily_records USING GIN(hashtags);
CREATE INDEX IF NOT EXISTS idx_class_daily_records_actual_date ON class_daily_records(class_id, actual_date);

-- 코멘트 추가
COMMENT ON COLUMN class_daily_records.hashtags IS '해시태그 배열 (상담, 싸움, 칭찬, 훈육 등)';
COMMENT ON COLUMN class_daily_records.actual_date IS '실제 사건이 발생한 날짜 (YYYY-MM-DD)'; 