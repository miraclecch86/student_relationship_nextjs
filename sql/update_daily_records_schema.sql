-- class_daily_records 테이블 스키마 업데이트
-- record_type 컬럼 제거하고 actual_date 컬럼 추가

-- 1. actual_date 컬럼 추가 (기본값으로 record_date 사용)
ALTER TABLE class_daily_records 
ADD COLUMN actual_date DATE DEFAULT CURRENT_DATE;

-- 2. 기존 데이터의 actual_date를 record_date로 설정
UPDATE class_daily_records 
SET actual_date = record_date::DATE 
WHERE actual_date IS NULL;

-- 3. actual_date를 NOT NULL로 설정
ALTER TABLE class_daily_records 
ALTER COLUMN actual_date SET NOT NULL;

-- 4. record_type 컬럼 제거 (기록 유형 필요 없어짐)
ALTER TABLE class_daily_records 
DROP COLUMN IF EXISTS record_type;

-- 5. 코멘트 업데이트
COMMENT ON COLUMN class_daily_records.record_date IS '기록이 작성된 날짜 (YYYY-MM-DD)';
COMMENT ON COLUMN class_daily_records.actual_date IS '실제 사건이 발생한 날짜 (YYYY-MM-DD)';

-- 6. 인덱스 추가 (actual_date로 조회가 많을 것으로 예상)
CREATE INDEX IF NOT EXISTS idx_class_daily_records_actual_date 
ON class_daily_records(class_id, actual_date);

-- 7. 기존 인덱스 확인 및 정리
-- record_date 기반 인덱스는 유지 (기록 작성 날짜로도 조회할 수 있음) 