# 🧾 프로젝트 개요: 학생 관계 시각화 웹앱

## ✨ 프로젝트 이름 (제안)
**학생 관계도 시각화 플랫폼** 또는 **Class Relationship Visualizer**

## 📌 소개
이 프로젝트는 학급 내 학생들의 대인관계를 시각적으로 보여주고, 학생 개개인이 설정한 친구 관계 및 주관식 응답을 통합적으로 분석하여 교사가 학급 내 분위기를 한눈에 파악할 수 있도록 돕는 웹 기반 도구입니다.

---

## 🧩 주요 기능

- **학급 관리**: 학급 생성, 수정, 삭제, 저장 및 불러오기 기능
- **학생 관계 시각화**: 친한/보통/안친한 관계를 선 색상으로 구분해 D3.js 기반 시각화 제공
- **관계 필터링**: 특정 관계 유형만 필터링하여 보기 가능
- **학생 노드 인터랙션**: 노드 클릭 시 하이라이트 및 관계 강조 + 주관식 응답 노출
- **학생 관계 설정**: 본인을 제외한 학생들과의 관계 설정 + 주관식 응답 저장
- **주관식 질문 관리**: 모든 학생에게 동일하게 질문 추가, 답변은 개별 저장
- **관계 통계/순위**: 관계 유형별 수치를 기반으로 랭킹 정렬

---

## ⚙️ 기술 스택

| 분류 | 기술 |
|------|------|
| 프론트엔드 | Next.js (App Router), TypeScript, Tailwind CSS, Framer Motion |
| 백엔드 | Supabase (PostgreSQL, Auth, Storage) |
| 시각화 | D3.js (force-directed graph) |
| 배포 | Vercel |

---

## 📁 프로젝트 구조
```
/app
  └── page.tsx                         // 학급 관리 페이지
  └── class/[classId]/page.tsx        // 학생 관계도 페이지
  └── class/[classId]/student/[id]    // 학생 관계 설정 페이지
/components
  └── ClassCard.tsx, StudentNode.tsx, QuestionBox.tsx 등
/lib, /utils, /public 구조 포함
```

---

## 🗂️ 관련 PRD 문서
| 기능 | 문서명 |
|------|--------|
| 전체 프로젝트 개요 | `project-overview-prd.md` |
| 학급 관리 페이지 | `class-management-prd.md` |
| 학생 관계도 페이지 | `student-relationship-map-prd.md` |
| 학생 관계 설정 페이지 | `student-relationship-editor-prd.md` |
| 프로젝트 scaffold 구조 | `scaffold-structure.md` |

---

## 🚀 설치 및 실행 방법
1. 저장소 클론
```bash
git clone [저장소 URL]
cd student-relationship-app
```
2. 패키지 설치
```bash
npm install
```
3. Supabase 환경 변수 설정 (`.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```
4. 로컬 실행
```bash
npm run dev
```

---

## 🧠 향후 확장 계획
- 학생/교사용 로그인 기능 (Supabase Auth)
- 관계 변화 통계 시각화
- 심리 분석 기반 관계 위험 탐지
- CSV/PDF 내보내기 기능

---

> 본 프로젝트는 교실 내 정서/관계 기반 지도 및 상담 자료로 활용될 수 있는 가치를 목표로 합니다.