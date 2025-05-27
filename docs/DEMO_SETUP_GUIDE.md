# 📚 데모 학급 설정 완전 가이드

## 🎯 개요

이 가이드는 **샘솔 초등학교 3학년 1반** 공개 데모 학급을 설정하는 완전한 과정을 설명합니다. 모든 사용자가 회원가입 후 즉시 애플리케이션의 모든 기능을 체험할 수 있도록 구성됩니다.

## 🚀 **추천 구현 방식: 플래그 방식**

### ✅ 장점
- ✨ **간단하고 빠른 구현** - 기존 코드 최소 변경
- 🔍 **직관적인 데이터 관리** - 학급 테이블에서 바로 확인 가능  
- 📈 **향후 확장성** - 여러 데모 학급 쉽게 추가 가능
- 🛡️ **기존 auth 시스템 활용** - 새로운 계정 관리 불필요

## 📋 구현 단계

### 1단계: Supabase 스키마 업데이트

```bash
# 1. SQL 파일 실행
psql -h [YOUR_SUPABASE_HOST] -U postgres -d postgres -f sql/add_demo_class_support.sql

# 또는 Supabase Dashboard에서 직접 실행
```

**주요 변경 사항:**
- `classes` 테이블에 `is_demo`, `is_public` 컬럼 추가
- 모든 관련 테이블에 공개 데모 읽기 권한 RLS 정책 추가
- 성능 최적화를 위한 인덱스 생성

### 2단계: 환경 변수 설정

```bash
# .env.local 파일에 추가
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# 기존 변수 확인
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

**⚠️ 중요:** 
- `SUPABASE_SERVICE_ROLE_KEY`는 RLS를 우회하여 데이터를 생성할 수 있는 관리자 키입니다
- Supabase Dashboard > Settings > API에서 확인 가능

### 3단계: 스크립트 실행 권한 설정

```bash
# 스크립트 실행 권한 부여
chmod +x scripts/generate-demo-data.js

# 필요한 패키지 설치 (없다면)
npm install @supabase/supabase-js dotenv
```

### 4단계: 데모 데이터 생성

```bash
# 스크립트 실행
node scripts/generate-demo-data.js
```

**실행 과정:**
1. 🔍 시스템 데모 계정 확인/생성 (`demo@system.local`)
2. 🏫 데모 학급 생성 (`샘솔 초등학교 3학년 1반`)
3. 👥 40명 학생 데이터 생성
4. 📋 9개 월별 설문 생성 (4월~12월)
5. ❓ 45개 질문 생성 (설문당 5개씩)
6. 🤝 14,040개 관계 데이터 생성
7. 💭 약 1,800개 주관식 답변 생성

## 📊 생성되는 데이터 상세

### 학급 정보
- **이름**: "샘솔 초등학교 3학년 1반"
- **설정**: `is_demo: true`, `is_public: true`
- **소유자**: 시스템 데모 계정

### 학생 구성 (40명)
- **성별 비율**: 남학생 20명, 여학생 20명
- **개성**: 각 학생마다 2-3개 성격 특성 (활발함, 조용함, 예술적, 등)
- **이름**: 한국 초등학생 일반적 이름

### 월별 스토리라인
- **4월**: 새로운 시작과 탐색
- **5월**: 첫 갈등 (최지우 ↔ 신준서)
- **6월**: 체육대회, 팀워크
- **7월**: 재능 발견
- **8월**: 방학 후 새로운 자극
- **9월**: 리더십과 성숙
- **10월**: 협력과 화해 (최지우-신준서 관계 회복 시작)
- **11월**: 안정과 깊이
- **12월**: 완전한 화해와 따뜻한 마무리

### 관계 진화 패턴
```
4월: 대부분 '보통' → 12월: 친밀 관계 증가
매우친함: 0% → 10%
친함: 12% → 28%
갈등: 최대 1-2개 관계
```

## 🔧 프론트엔드 수정 사항

### 5단계: UI에서 데모 학급 표시

```typescript
// components/ClassList.tsx 예시
const ClassCard = ({ classData }) => (
  <div className="class-card">
    <h3>{classData.name}</h3>
    {classData.is_demo && (
      <span className="demo-badge">
        🌟 체험용 학급
      </span>
    )}
  </div>
);
```

### 6단계: 읽기 전용 권한 처리

```typescript
// utils/permissions.ts 예시
export const canEditClass = (classData, userId) => {
  if (classData.is_demo) return false; // 데모 학급은 편집 불가
  return classData.user_id === userId;
};
```

### 7단계: 데모 학급 안내 메시지

```typescript
// components/DemoNotice.tsx
const DemoNotice = () => (
  <div className="demo-notice">
    💡 이것은 체험용 학급입니다. 
    실제 데이터 입력을 위해 새 학급을 만들어보세요!
  </div>
);
```

## 🎯 검증 및 테스트

### 데이터 확인
```sql
-- 생성된 데모 학급 확인
SELECT * FROM classes WHERE is_demo = true;

-- 학생 수 확인
SELECT COUNT(*) FROM students s
JOIN classes c ON s.class_id = c.id
WHERE c.is_demo = true;

-- 관계 데이터 확인
SELECT COUNT(*) FROM relations r
JOIN students s ON r.from_student_id = s.id
JOIN classes c ON s.class_id = c.id
WHERE c.is_demo = true;
```

### 접근 권한 테스트
1. 신규 계정으로 로그인
2. 학급 목록에서 "샘솔 초등학교 3학년 1반" 확인
3. 모든 기능 (관계도, 설문 결과, 분석) 접근 테스트
4. 편집 시도 시 적절한 오류 메시지 확인

## 🚨 주의사항

### 보안
- ✅ 서비스 키는 서버 사이드에서만 사용
- ✅ 프로덕션에서는 환경 변수로 관리
- ✅ 데모 데이터 수정/삭제 방지

### 성능
- ✅ 대량 데이터이므로 인덱스 확인
- ✅ 필요시 페이지네이션 적용
- ✅ 캐싱 고려

### 유지보수
- ✅ 정기적 데이터 무결성 점검
- ✅ 데모 데이터 백업
- ✅ 향후 스토리라인 확장 계획

## 🎉 완료 후 기대효과

### 사용자 경험 향상
- **즉시 체험**: 회원가입 후 바로 모든 기능 확인
- **학습 효과**: 실제 데이터로 사용법 익히기
- **구매 전환**: 기능 확인 후 실제 학급 생성 유도

### 개발 및 마케팅
- **데모 시연**: 영업/마케팅 자료로 활용
- **버그 테스트**: 실제 데이터로 QA 수행
- **기능 개발**: 새 기능의 테스트베드

---

## 📞 문제 해결

### 자주 발생하는 문제

**Q: 스크립트 실행 시 "permission denied" 오류**
```bash
# 해결: 권한 부여
chmod +x scripts/generate-demo-data.js
```

**Q: Supabase 연결 오류**
```bash
# 해결: 환경 변수 확인
echo $NEXT_PUBLIC_SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY
```

**Q: 데모 학급이 보이지 않음**
```sql
-- 해결: RLS 정책 확인
SELECT * FROM pg_policies WHERE tablename = 'classes';
```

**Q: 관계 데이터 생성 실패**
```bash
# 해결: 배치 크기 줄이기 (스크립트에서 1000 → 100)
```

---

**🎯 이제 모든 준비가 완료되었습니다! 스크립트를 실행하여 멋진 데모 학급을 만들어보세요!** 