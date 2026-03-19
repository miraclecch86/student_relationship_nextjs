-- 데모 학급 지원을 위한 스키마 변경
-- 실행일: 2024-01-XX

-- 1. classes 테이블에 데모 관련 컬럼 추가
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;

-- 2. 데모 학급을 위한 RLS 정책 추가
-- 기존 정책은 유지하되, 공개 데모 학급에 대한 읽기 권한 추가

-- 모든 사용자가 공개 데모 학급을 볼 수 있는 정책 추가
CREATE POLICY "Anyone can view public demo classes"
ON public.classes 
FOR SELECT
USING (is_demo = true AND is_public = true);

-- 🚨 데모 학급 수정 방지 정책 추가
CREATE POLICY "Prevent demo class modifications"
ON public.classes
FOR UPDATE
USING (is_demo = false); -- 데모 학급은 수정 불가

CREATE POLICY "Prevent demo class deletion" 
ON public.classes
FOR DELETE
USING (is_demo = false); -- 데모 학급은 삭제 불가

-- 3. students 테이블에 대한 데모 학급 읽기 정책 추가
CREATE POLICY "Anyone can view students from public demo classes"
ON public.students
FOR SELECT
USING (
  class_id IN (
    SELECT id FROM public.classes 
    WHERE is_demo = true AND is_public = true
  )
);

-- 🚨 데모 학급 학생 수정 방지
CREATE POLICY "Prevent demo class student modifications"
ON public.students
FOR INSERT
WITH CHECK (
  class_id NOT IN (
    SELECT id FROM public.classes 
    WHERE is_demo = true
  )
);

CREATE POLICY "Prevent demo class student updates"
ON public.students
FOR UPDATE
USING (
  class_id NOT IN (
    SELECT id FROM public.classes 
    WHERE is_demo = true
  )
);

CREATE POLICY "Prevent demo class student deletions"
ON public.students
FOR DELETE
USING (
  class_id NOT IN (
    SELECT id FROM public.classes 
    WHERE is_demo = true
  )
);

-- 4. relations 테이블에 대한 데모 학급 읽기 정책 추가
CREATE POLICY "Anyone can view relations from public demo classes"
ON public.relations
FOR SELECT
USING (
  from_student_id IN (
    SELECT s.id FROM public.students s
    JOIN public.classes c ON s.class_id = c.id
    WHERE c.is_demo = true AND c.is_public = true
  )
);

-- 🚨 데모 학급 관계 수정 방지
CREATE POLICY "Prevent demo class relation modifications"
ON public.relations
FOR INSERT
WITH CHECK (
  from_student_id NOT IN (
    SELECT s.id FROM public.students s
    JOIN public.classes c ON s.class_id = c.id
    WHERE c.is_demo = true
  )
);

CREATE POLICY "Prevent demo class relation updates"
ON public.relations
FOR UPDATE
USING (
  from_student_id NOT IN (
    SELECT s.id FROM public.students s
    JOIN public.classes c ON s.class_id = c.id
    WHERE c.is_demo = true
  )
);

CREATE POLICY "Prevent demo class relation deletions"
ON public.relations
FOR DELETE
USING (
  from_student_id NOT IN (
    SELECT s.id FROM public.students s
    JOIN public.classes c ON s.class_id = c.id
    WHERE c.is_demo = true
  )
);

-- 5. surveys 테이블에 대한 데모 학급 읽기 정책 추가
CREATE POLICY "Anyone can view surveys from public demo classes"
ON public.surveys
FOR SELECT
USING (
  class_id IN (
    SELECT id FROM public.classes 
    WHERE is_demo = true AND is_public = true
  )
);

-- 🚨 데모 학급 설문 수정 방지
CREATE POLICY "Prevent demo class survey modifications"
ON public.surveys
FOR INSERT
WITH CHECK (
  class_id NOT IN (
    SELECT id FROM public.classes 
    WHERE is_demo = true
  )
);

CREATE POLICY "Prevent demo class survey updates"
ON public.surveys
FOR UPDATE
USING (
  class_id NOT IN (
    SELECT id FROM public.classes 
    WHERE is_demo = true
  )
);

CREATE POLICY "Prevent demo class survey deletions"
ON public.surveys
FOR DELETE
USING (
  class_id NOT IN (
    SELECT id FROM public.classes 
    WHERE is_demo = true
  )
);

-- 6. questions 테이블에 대한 데모 학급 읽기 정책 추가
CREATE POLICY "Anyone can view questions from public demo classes"
ON public.questions
FOR SELECT
USING (
  class_id IN (
    SELECT id FROM public.classes 
    WHERE is_demo = true AND is_public = true
  )
);

-- 🚨 데모 학급 질문 수정 방지
CREATE POLICY "Prevent demo class question modifications"
ON public.questions
FOR INSERT
WITH CHECK (
  class_id NOT IN (
    SELECT id FROM public.classes 
    WHERE is_demo = true
  )
);

CREATE POLICY "Prevent demo class question updates"
ON public.questions
FOR UPDATE
USING (
  class_id NOT IN (
    SELECT id FROM public.classes 
    WHERE is_demo = true
  )
);

CREATE POLICY "Prevent demo class question deletions"
ON public.questions
FOR DELETE
USING (
  class_id NOT IN (
    SELECT id FROM public.classes 
    WHERE is_demo = true
  )
);

-- 7. answers 테이블에 대한 데모 학급 읽기 정책 추가
CREATE POLICY "Anyone can view answers from public demo classes"
ON public.answers
FOR SELECT
USING (
  student_id IN (
    SELECT s.id FROM public.students s
    JOIN public.classes c ON s.class_id = c.id
    WHERE c.is_demo = true AND c.is_public = true
  )
);

-- 🚨 데모 학급 답변 수정 방지
CREATE POLICY "Prevent demo class answer modifications"
ON public.answers
FOR INSERT
WITH CHECK (
  student_id NOT IN (
    SELECT s.id FROM public.students s
    JOIN public.classes c ON s.class_id = c.id
    WHERE c.is_demo = true
  )
);

CREATE POLICY "Prevent demo class answer updates"
ON public.answers
FOR UPDATE
USING (
  student_id NOT IN (
    SELECT s.id FROM public.students s
    JOIN public.classes c ON s.class_id = c.id
    WHERE c.is_demo = true
  )
);

CREATE POLICY "Prevent demo class answer deletions"
ON public.answers
FOR DELETE
USING (
  student_id NOT IN (
    SELECT s.id FROM public.students s
    JOIN public.classes c ON s.class_id = c.id
    WHERE c.is_demo = true
  )
);

-- 8. 컬럼에 대한 주석 추가
COMMENT ON COLUMN public.classes.is_demo IS 'True if this is a demo/example class for showcasing app features';
COMMENT ON COLUMN public.classes.is_public IS 'True if this demo class should be visible to all users (requires is_demo = true)';

-- 9. 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_classes_demo_public ON public.classes(is_demo, is_public) WHERE is_demo = true;

-- 10. 데모 학급임을 식별하는 뷰 생성 (선택사항)
CREATE OR REPLACE VIEW public.demo_classes WITH (security_invoker = true) AS
SELECT * FROM public.classes 
WHERE is_demo = true AND is_public = true;

-- 🔍 11. 관리자용 뷰 (데모 데이터 관리용)
CREATE OR REPLACE VIEW public.demo_class_stats WITH (security_invoker = true) AS
SELECT 
  c.name as class_name,
  c.created_at,
  COUNT(DISTINCT s.id) as student_count,
  COUNT(DISTINCT sur.id) as survey_count,
  COUNT(DISTINCT q.id) as question_count,
  COUNT(DISTINCT r.id) as relation_count,
  COUNT(DISTINCT a.id) as answer_count
FROM public.classes c
LEFT JOIN public.students s ON c.id = s.class_id
LEFT JOIN public.surveys sur ON c.id = sur.class_id  
LEFT JOIN public.questions q ON c.id = q.class_id
LEFT JOIN public.relations r ON s.id = r.from_student_id
LEFT JOIN public.answers a ON s.id = a.student_id
WHERE c.is_demo = true AND c.is_public = true
GROUP BY c.id, c.name, c.created_at;

-- 실행 확인
-- SELECT 
--   table_name, 
--   column_name, 
--   data_type, 
--   column_default
-- FROM information_schema.columns 
-- WHERE table_name = 'classes' 
--   AND column_name IN ('is_demo', 'is_public');

-- 🧪 보안 테스트 쿼리 (실행 후 확인용)
-- 다음 쿼리들이 모두 실패해야 함:
-- INSERT INTO classes (name, user_id, is_demo) VALUES ('테스트', auth.uid(), false); -- 성공해야 함
-- UPDATE classes SET name = '수정됨' WHERE is_demo = true; -- 실패해야 함  
-- DELETE FROM classes WHERE is_demo = true; -- 실패해야 함 