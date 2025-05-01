-- 단순화된 데이터 가져오기 함수 (테스트용)
CREATE OR REPLACE FUNCTION public.import_user_data_simple(user_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  class_data jsonb;
  class_id uuid;
  class_name text;
  inserted_classes int := 0;
  current_user_id uuid := auth.uid();
  result jsonb;
BEGIN
  -- 데이터 검증
  IF user_data IS NULL OR user_data->'classes' IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'message', '유효하지 않은 데이터 형식입니다.');
  END IF;
  
  -- 새 데이터 삽입 (학급만 간단히 저장)
  IF jsonb_array_length(user_data->'classes') > 0 THEN
    FOR class_data IN SELECT * FROM jsonb_array_elements(user_data->'classes')
    LOOP
      class_name := class_data->>'name';
      IF class_name IS NULL THEN
        class_name := '이름 없는 학급';
      END IF;
      
      -- 클래스 삽입
      INSERT INTO classes (name, user_id)
      VALUES (class_name, current_user_id)
      RETURNING id INTO class_id;
      
      inserted_classes := inserted_classes + 1;
    END LOOP;
  END IF;
  
  -- 결과 반환
  result := jsonb_build_object(
    'status', 'success',
    'source', COALESCE(user_data->'metadata'->>'exported_by', '알 수 없음'),
    'inserted', jsonb_build_object(
      'classes', inserted_classes
    )
  );
  
  RETURN result;
END;
$$; 