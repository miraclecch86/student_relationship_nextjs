-- 사용자별 데이터 저장/불러오기 RPC 함수

-- 1. 사용자별 모든 학급 데이터 내보내기 함수 (학급, 학생, 설문지, 관계 포함)
CREATE OR REPLACE FUNCTION public.export_user_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  current_user_id uuid := auth.uid();
  current_user_email text;
BEGIN
  -- 현재 사용자 이메일 가져오기
  SELECT email INTO current_user_email FROM auth.users WHERE id = current_user_id;

  -- 현재 로그인한 사용자의 데이터만 조회
  WITH user_classes AS (
    SELECT c.id, c.name, c.created_at
    FROM classes c
    WHERE c.user_id = current_user_id
  ),
  user_students AS (
    SELECT s.id, s.name, s.class_id, s.gender, s.position_x, s.position_y, s.display_order, s.created_at
    FROM students s
    JOIN user_classes uc ON s.class_id = uc.id
  ),
  user_surveys AS (
    SELECT sv.id, sv.class_id, sv.name, sv.description, sv.created_at
    FROM surveys sv
    JOIN user_classes uc ON sv.class_id = uc.id
  ),
  user_relations AS (
    SELECT r.from_student_id, r.to_student_id, r.relation_type, r.survey_id, r.created_at
    FROM relations r
    JOIN user_students us ON r.from_student_id = us.id OR r.to_student_id = us.id
  )
  SELECT 
    jsonb_build_object(
      'metadata', jsonb_build_object(
        'exported_by', current_user_email,
        'exported_at', now(),
        'version', '1.0'
      ),
      'classes', COALESCE(jsonb_agg(jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'created_at', c.created_at,
        'students', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', s.id,
            'name', s.name,
            'gender', s.gender,
            'position_x', s.position_x,
            'position_y', s.position_y,
            'display_order', s.display_order,
            'created_at', s.created_at
          )), '[]'::jsonb)
          FROM user_students s
          WHERE s.class_id = c.id
        ),
        'surveys', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', sv.id,
            'name', sv.name,
            'description', sv.description,
            'created_at', sv.created_at,
            'relations', (
              SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'from_student_id', r.from_student_id,
                'to_student_id', r.to_student_id,
                'relation_type', r.relation_type,
                'created_at', r.created_at
              )), '[]'::jsonb)
              FROM user_relations r
              WHERE r.survey_id = sv.id
            )
          )), '[]'::jsonb)
          FROM user_surveys sv
          WHERE sv.class_id = c.id
        )
      )), '[]'::jsonb)
    ) INTO result
  FROM user_classes c;
  
  RETURN result;
END;
$$;

-- 2. 사용자 데이터 가져오기 함수 (기존 데이터 유지하고 새 데이터 추가)
CREATE OR REPLACE FUNCTION public.import_user_data(user_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  class_data jsonb;
  class_id uuid;
  student_data jsonb;
  student_id uuid;
  survey_data jsonb;
  survey_id uuid;
  relation_data jsonb;
  inserted_classes jsonb = '[]'::jsonb;
  inserted_students jsonb = '[]'::jsonb;
  inserted_surveys jsonb = '[]'::jsonb;
  inserted_relations jsonb = '[]'::jsonb;
  current_user_id uuid = auth.uid();
  source_user_email text := user_data->'metadata'->>'exported_by';
  result jsonb;
  import_timestamp timestamptz := now();
BEGIN
  -- 데이터 검증
  IF user_data IS NULL OR user_data->'classes' IS NULL THEN
    RAISE EXCEPTION '유효하지 않은 데이터 형식입니다. 학급 정보가 없습니다.';
  END IF;
  
  -- 소스 정보를 가져오기
  -- 메타데이터가 없는 예전 형식의 파일도 지원
  IF user_data->'metadata' IS NULL THEN
    source_user_email := '알 수 없음';
  END IF;
  
  -- 새 데이터 삽입
  IF jsonb_array_length(user_data->'classes') > 0 THEN
    FOR class_data IN SELECT * FROM jsonb_array_elements(user_data->'classes')
    LOOP
      -- 클래스 삽입 (기존 클래스와 이름이 중복되면 정보 추가)
      DECLARE
        class_name text := class_data->>'name';
        existing_count integer := 0;
        import_suffix text;
      BEGIN
        -- 동일한 이름의 클래스가 있는지 확인
        SELECT COUNT(*) INTO existing_count 
        FROM classes 
        WHERE name = class_name AND user_id = current_user_id;
        
        -- 동일한 이름이 있다면 '(가져옴: 이메일 + 날짜)'를 추가
        IF existing_count > 0 THEN
          import_suffix := '(가져옴';
          IF source_user_email IS NOT NULL AND source_user_email != '' THEN
            import_suffix := import_suffix || ': ' || source_user_email;
          END IF;
          import_suffix := import_suffix || ' ' || to_char(import_timestamp, 'YYYY-MM-DD') || ')';
          class_name := class_name || ' ' || import_suffix;
        END IF;
        
        -- 클래스 삽입
        INSERT INTO classes (name, user_id)
        VALUES (class_name, current_user_id)
        RETURNING id INTO class_id;
        
        inserted_classes = inserted_classes || jsonb_build_object('id', class_id, 'name', class_name);
      END;
      
      -- 학생 데이터 삽입
      IF jsonb_array_length(class_data->'students') > 0 THEN
        FOR student_data IN SELECT * FROM jsonb_array_elements(class_data->'students')
        LOOP
          INSERT INTO students (class_id, name, gender, position_x, position_y, display_order)
          VALUES (
            class_id,
            student_data->>'name',
            (student_data->>'gender')::text,
            (student_data->>'position_x')::float,
            (student_data->>'position_y')::float,
            (student_data->>'display_order')::integer
          )
          RETURNING id INTO student_id;
          
          inserted_students = inserted_students || jsonb_build_object('id', student_id, 'name', student_data->>'name');
        END LOOP;
      END IF;
      
      -- 설문 데이터 삽입
      IF jsonb_array_length(class_data->'surveys') > 0 THEN
        FOR survey_data IN SELECT * FROM jsonb_array_elements(class_data->'surveys')
        LOOP
          -- 설문 이름에 학급 이름 접두사 추가 (중복 방지)
          DECLARE
            survey_name text := survey_data->>'name';
            class_name text;
          BEGIN
            -- 클래스 이름 가져오기
            SELECT name INTO class_name FROM classes WHERE id = class_id;
            
            -- 설문 삽입
            INSERT INTO surveys (class_id, name, description)
            VALUES (
              class_id,
              survey_name,
              survey_data->>'description'
            )
            RETURNING id INTO survey_id;
            
            inserted_surveys = inserted_surveys || jsonb_build_object('id', survey_id, 'name', survey_name);
          END;
          
          -- 새로 생성된 학생 ID와 관계 매핑 테이블을 만들어야 함
          DECLARE
            old_to_new_student_map jsonb = '{}'::jsonb;
            old_student_id uuid;
            new_student_id uuid;
            from_student_id uuid;
            to_student_id uuid;
          BEGIN
            -- 관계 데이터 삽입 (학생 ID를 새로 매핑)
            IF jsonb_array_length(survey_data->'relations') > 0 THEN
              -- 학생 ID 매핑 생성
              FOR student_data IN SELECT * FROM jsonb_array_elements(class_data->'students')
              LOOP
                old_student_id := (student_data->>'id')::uuid;
                SELECT id INTO new_student_id FROM students 
                WHERE class_id = class_id AND name = student_data->>'name'
                ORDER BY created_at DESC LIMIT 1;
                
                IF new_student_id IS NOT NULL THEN
                  old_to_new_student_map = old_to_new_student_map || 
                    jsonb_build_object(old_student_id::text, new_student_id);
                END IF;
              END LOOP;
              
              -- 관계 데이터 삽입
              FOR relation_data IN SELECT * FROM jsonb_array_elements(survey_data->'relations')
              LOOP
                old_student_id := (relation_data->>'from_student_id')::uuid;
                from_student_id := (old_to_new_student_map->>old_student_id::text)::uuid;
                
                old_student_id := (relation_data->>'to_student_id')::uuid;
                to_student_id := (old_to_new_student_map->>old_student_id::text)::uuid;
                
                IF from_student_id IS NOT NULL AND to_student_id IS NOT NULL THEN
                  INSERT INTO relations (from_student_id, to_student_id, relation_type, survey_id)
                  VALUES (
                    from_student_id,
                    to_student_id,
                    (relation_data->>'relation_type')::text,
                    survey_id
                  );
                  
                  inserted_relations = inserted_relations || relation_data;
                END IF;
              END LOOP;
            END IF;
          END;
        END LOOP;
      END IF;
    END LOOP;
  END IF;
  
  -- 결과 반환
  result = jsonb_build_object(
    'status', 'success',
    'source', COALESCE(source_user_email, '알 수 없음'),
    'inserted', jsonb_build_object(
      'classes', jsonb_array_length(inserted_classes),
      'students', jsonb_array_length(inserted_students),
      'surveys', jsonb_array_length(inserted_surveys),
      'relations', jsonb_array_length(inserted_relations)
    )
  );
  
  RETURN result;
END;
$$; 