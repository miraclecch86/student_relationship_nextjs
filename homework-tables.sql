-- 과제 체크 관련 테이블들

-- 과제 월별 그룹 테이블
CREATE TABLE homework_months (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  month_year VARCHAR(7) NOT NULL, -- 'YYYY-MM' 형식
  name VARCHAR(255) NOT NULL, -- 예: '3월 과제', '9월 첫째주 과제' 등
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(class_id, month_year, name)
);

-- 과제 항목 테이블
CREATE TABLE homework_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  homework_month_id UUID NOT NULL REFERENCES homework_months(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  due_date DATE,
  order_index INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 과제 제출 기록 테이블
CREATE TABLE homework_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  homework_item_id UUID NOT NULL REFERENCES homework_items(id) ON DELETE CASCADE,
  is_submitted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(student_id, homework_item_id)
);

-- 인덱스 생성
CREATE INDEX idx_homework_months_class_id ON homework_months(class_id);
CREATE INDEX idx_homework_items_homework_month_id ON homework_items(homework_month_id);
CREATE INDEX idx_homework_records_student_id ON homework_records(student_id);
CREATE INDEX idx_homework_records_homework_item_id ON homework_records(homework_item_id);

-- RLS (Row Level Security) 정책
ALTER TABLE homework_months ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework_records ENABLE ROW LEVEL SECURITY;

-- homework_months 정책
CREATE POLICY "Teachers can manage their class homework months" ON homework_months
  FOR ALL USING (
    class_id IN (
      SELECT id FROM classes WHERE user_id = auth.uid()
    )
  );

-- homework_items 정책
CREATE POLICY "Teachers can manage their homework items" ON homework_items
  FOR ALL USING (
    homework_month_id IN (
      SELECT hm.id FROM homework_months hm
      JOIN classes c ON hm.class_id = c.id
      WHERE c.user_id = auth.uid()
    )
  );

-- homework_records 정책
CREATE POLICY "Teachers can manage their homework records" ON homework_records
  FOR ALL USING (
    homework_item_id IN (
      SELECT hi.id FROM homework_items hi
      JOIN homework_months hm ON hi.homework_month_id = hm.id
      JOIN classes c ON hm.class_id = c.id
      WHERE c.user_id = auth.uid()
    )
  );

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_homework_months_updated_at BEFORE UPDATE ON homework_months FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_homework_items_updated_at BEFORE UPDATE ON homework_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_homework_records_updated_at BEFORE UPDATE ON homework_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 