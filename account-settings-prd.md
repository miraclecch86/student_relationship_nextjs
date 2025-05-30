## 👤 사용자 계정 설정 페이지 PRD

### 📌 목적
사용자가 로그인 후 자신의 계정 정보를 확인하고, 사용자 이름 등 간단한 프로필 정보를 수정할 수 있는 설정 페이지(`/account`)를 준비한다. 
현재는 기본 구조만 설계하고, 향후 학생/선생님 역할별로 정보 범위를 확장할 수 있도록 구성한다.

---

### ✅ 주요 기능 요약
- 로그인한 사용자만 접근 가능 (auth 필요)
- 사용자 이름(닉네임) 설정 또는 수정 가능
- 사용자 이메일 확인만 가능 (수정 불가)
- 역할(role)이 이미 설정된 경우 읽기 전용으로 표시

---

### 🗂️ 페이지 구성: `/account`

#### 1. 사용자 정보 카드
| 필드명 | 내용 |
|--------|------|
| 이메일 | 사용자의 로그인 이메일 (읽기 전용) |
| 이름 | 입력 가능. 기본값 없음 or 기존 이름 표시 |
| 역할 | `teacher` 또는 `student` (읽기 전용) |

#### 2. 저장 버튼
- 사용자 이름 수정 후 저장 가능
- 저장 시 Supabase `users` 테이블의 `name` 컬럼 업데이트

#### 3. UI/UX 요구사항
- Tailwind CSS 기준 디자인
- 사용자 정보는 카드 형 UI로 표시
- 이름 입력란은 placeholder: "이름을 입력하세요"

---

### 🗃️ Supabase users 테이블 확장 항목
- `name: text` → 사용자 입력 이름
- `role: text` → 이미 저장된 값 표시 (변경 불가)

---

### 🔐 보안 및 제한
- 인증된 사용자만 접근 가능
- 현재 로그인한 사용자의 정보만 수정 가능
- Role이 설정되어 있지 않은 경우에는 `/select-role`로 리디렉션

---

### 💡 향후 확장 가능 항목 (설계만)
- 비밀번호 변경 (이메일/비번 방식 도입 시)
- 프로필 이미지 업로드
- 학교/학급명 연결
- 학생의 경우 학번 또는 반 정보 추가

---

### ✨ 참고
- 현재는 MVP 단계이므로 단순한 사용자 이름 설정 화면으로 구현
- 설정 페이지 구조만 먼저 만들어두고 "추후 확장 가능"하게 설계
