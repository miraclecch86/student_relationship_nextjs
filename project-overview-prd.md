# 🧠 Project PRD: Student Relationship Visualization App (Overview)

## 📘 프로젝트 개요
이 앱은 교사가 학급 내 학생들의 관계를 시각적으로 파악하고, 주관식 질문과 함께 관계를 설정할 수 있도록 지원하는 웹 기반 도구입니다. 각 학생이 설정한 관계 데이터를 기반으로 관계도(Map)를 시각화하며, 향후에는 심리 분석 및 관계 진단 기능으로 확장될 수 있습니다.

---

## 🛠️ 기술 스택
- **Frontend**: Next.js 14+, App Router, TypeScript
- **Styling**: Tailwind CSS, Framer Motion
- **Backend**: Supabase (Auth, Database, Storage)
- **Graph Visualization**: D3.js
- **배포**: Vercel (초기 배포 환경)

---

## 🧱 프로젝트 페이지 구조 (3대 페이지)

| 페이지명 | 경로 | 설명 |
|----------|------|------|
| 학급 관리 페이지 | `/` | 학급 생성, 수정, 삭제, 저장, 불러오기 수행. 앱 진입 시 최초 노출되는 페이지 |
| 학생 관계도 페이지 | `/class/[classId]` | 해당 학급의 학생 관계를 D3.js로 시각화하며, 관계 필터, 주관식 응답 확인, 관계 통계 표시 |
| 학생 관계 설정 페이지 | `/class/[classId]/student/[studentId]` | 한 학생이 다른 학생과의 관계를 설정하고 주관식 질문에 답변하는 인터페이스 |

각 페이지의 세부 내용은 다음의 PRD 문서를 참고:
- `class-management-prd.md`
- `student-relationship-map-prd.md`
- `student-relationship-editor-prd.md`

---

## 🗂️ 폴더 구조 (Scaffold 기준)
> 자세한 scaffold 구조는 `scaffold-structure.md` 참조

```
📦 app/
├── page.tsx                        // 학급 관리
├── class/[classId]/page.tsx       // 관계도
└── class/[classId]/student/[id]   // 관계 설정
📁 components/                      // ClassCard, StudentNode 등 공용 UI
📁 lib/                             // Supabase 설정, 상수
📁 utils/                           // 그래프 유틸, JSON 입출력
📁 public/                          // 아이콘, 정적 리소스
```

---

## 🔗 데이터 모델 구조 (Supabase 기준)

### ✅ classes 테이블
- id: UUID
- name: string
- created_at: timestamp

### ✅ students 테이블
- id: UUID
- name: string
- gender: enum ('male', 'female')
- class_id: UUID
- position_x / position_y: number (관계도 상 위치 저장용)

### ✅ relations 테이블
- id: UUID
- from_student_id: UUID
- to_student_id: UUID
- relation_type: enum ('친한', '보통', '안친한')

### ✅ questions 테이블
- id: UUID
- question_text: string
- class_id: UUID

### ✅ answers 테이블
- id: UUID
- student_id: UUID
- question_id: UUID
- answer_text: string

---

## 💡 핵심 UX 포인트
- 모든 버튼, 카드, 입력창은 **그림자와 호버 효과** 필수 적용
- D3 노드는 **드래그 가능**, 배치 변경 전까지 위치 고정
- 주관식 질문은 모든 학생에게 공통 추가되며, 응답은 개별 저장됨
- 삭제 기능은 항상 **확인용 모달**을 통해 실행됨
- 관계도 노드 클릭 시 하이라이트 + 연결관계 강조 + 응답 표시

---

## ⏱️ 예상 개발 단계
1. 프로젝트 scaffold 생성 및 페이지 라우팅 구조 확정
2. 학급 관리 페이지부터 구현
3. Supabase 연동 및 데이터 저장 구조 확립
4. 학생 관계 설정 페이지 구현 (질문, 관계 입력 등)
5. 학생 관계도 페이지 구현 (D3 시각화 포함)
6. 전체 테스트 및 D3 상호작용 디버깅

---

## 📎 확장 고려 사항
- Supabase Auth로 로그인 기능 추가
- Supabase Storage로 클래스별 저장 스냅샷 이미지 저장
- 학생 정서 분석 모델 연동 (관계 편향성 분석 등)
- CSV/PDF로 내보내기

---

> 이 문서는 전체 시스템 설계 및 페이지 흐름을 총괄적으로 정리한 메인 PRD 문서입니다. 기능별 세부 구현 시, 각 하위 PRD 문서 및 scaffold 구조를 참조하여 구현할 수 있도록 구성되어 있습니다.