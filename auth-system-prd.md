# 🔐 Auth System PRD (업그레이드 버전)

## 1. 개요
이 PRD는 구글/카카오 소셜 로그인을 통한 사용자 인증 기능을 학생 관계 시각화 앱에 통합하기 위한 요구 사항을 정의합니다. 로그인 후에는 사용자 역할(선생님/학생)에 따라 분기 처리하며, 향후 학생 입력 기능을 대비한 구조도 포함됩니다.

---

## 2. 인증 플로우 개요

1. **앱 최초 진입 시** `/login` 경로에서 로그인 페이지 표시
2. **소셜 로그인 선택 (Google, Kakao)**
3. 로그인 성공 시:
   - Supabase `user_metadata`에 role 정보 존재 → 역할 기반 리다이렉트
     - 선생님: `/`
     - 학생: `/student` (학생 페이지는 현재 미구현 상태)
   - role 정보 없음 → `/select-role` 페이지로 이동하여 역할 선택
4. 역할 선택 후 Supabase DB에 저장 (`user_roles` 테이블)

---

## 3. 파일 및 디렉토리 구조 제안 (Next.js 기준)

```
📦 app/
├── login/page.tsx                // 소셜 로그인 버튼 UI
├── select-role/page.tsx          // 사용자 역할 선택 페이지
├── student/page.tsx              // 학생 전용 페이지 (추후 구현)
├── page.tsx                      // 선생님 기본 진입: 학급 관리 페이지

📁 lib/
├── supabase.ts                   // Supabase 설정
├── auth.ts                       // 로그인 처리 및 역할 판별 로직

📁 components/
├── SocialLoginButton.tsx        // 구글/카카오 로그인 버튼 컴포넌트
├── RoleSelector.tsx             // 역할 선택 UI
```

---

## 4. Supabase 테이블 설계

### `user_roles`
| 필드명       | 타입     | 설명                      |
|--------------|----------|---------------------------|
| id           | UUID     | 기본 PK                   |
| user_id      | UUID     | Supabase auth의 user ID   |
| role         | string   | 'teacher' 또는 'student'   |
| created_at   | timestamp| 생성일                    |

※ 역할은 `user_metadata`에도 저장해두면 매번 쿼리하지 않고 client에서 확인 가능함

---

## 5. 리다이렉션 시나리오

| 상황 | 조건 | 리다이렉트 대상 |
|------|------|------------------|
| 로그인 성공 후 | role 미설정 | `/select-role` |
| 로그인 성공 후 | role == 'teacher' | `/` |
| 로그인 성공 후 | role == 'student' | `/student` (비어 있음) |
| 로그인 실패 시 | - | `/login` |

---

## 6. UI 요구 사항

### 로그인 페이지 (`/login`)
- 앱 로고 및 간단한 소개
- 버튼: `Google 로그인`, `Kakao 로그인`
- 로그인 실패 시 오류 메시지 출력

### 역할 선택 페이지 (`/select-role`)
- 문구: "당신의 역할을 선택해주세요."
- 버튼: `선생님`, `학생`
- 클릭 시 Supabase DB에 저장 + metadata 업데이트 후 리다이렉트

---

## 7. 확장 고려 사항
- `user_profiles` 테이블 도입: 이름, 소속 학교 등 추가 정보 저장
- 학생이 로그인 후 관계 설정 데이터 입력 시, 선생님 학급과 연결
- 선생님 인증은 추후 교육청 인증 API 연동 등으로 고도화 가능

---

## 8. 보안 및 제약사항
- 로그인 실패에 대한 핸들링 필요 (ex: popup 차단, 인증 실패)
- Kakao 로그인 시 리다이렉션 URI 정확히 입력되어야 함
- Google 로그인은 Supabase OAuth 제공 + 콘솔 설정 필요

---

> 이 PRD는 `auth-system-prd`의 확장 버전으로, 소셜 로그인과 역할 기반 사용자 흐름을 포함합니다. 구현 시 Cursor 에이전트에게 본 문서를 기반으로 프로젝트 scaffold 생성을 요청하세요.
