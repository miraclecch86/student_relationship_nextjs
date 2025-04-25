# 📁 scaffold-class-flow.md (학급 생성 및 설문 구조 확장 Scaffold)

## 🧱 디렉토리 구조 (Next.js App Router 기준)

```
/app
  /page.tsx                     → 기존 학급 관리 페이지
  /class
    /create
      /school/page.tsx         → 🆕 학교 선택 페이지
      /grade/page.tsx          → 🆕 학년/반 입력 페이지
      /students/page.tsx       → 🆕 학생 목록 입력 페이지
    /[classId]
      /survey
        /page.tsx              → 🆕 설문 만들기 페이지 (학급 관리 페이지 확장)
        /[surveyId]/page.tsx   → 기존 학생 관계도 페이지 (각 설문지 상세 페이지 역할)
        /[surveyId]/student/[studentId]/page.tsx → 학생 관계 설정 페이지 (유지)

/components
  StudentListSidebar.tsx       → 좌측 학생 목록 UI 컴포넌트 (설문/관계도 공통 사용)
  ClassSurveyForm.tsx          → 설문 생성용 UI (선택)
  ClassCreationStepper.tsx     → 학급 생성 단계 진행 표시 (선택)

/lib
  useClassContext.ts           → 학급 정보 공유 Context (확장)
  useSyncedStudentList.ts      → 학생 목록 동기화 훅 (신규)

/types
  class.ts                     → Class, Student, Survey 타입 정의 및 연동 구조
```

## 🧩 주요 구조 정리

- 학급은 한 번 생성되며, 학생 목록은 학급에 종속됨
- 각 학급 안에는 여러 설문을 만들 수 있고, 설문마다 관계도 페이지가 생성됨
- 학급 관리 페이지에 표시되는 카드 = 설문 카드
- 설문 카드를 클릭하면 해당 설문지의 관계도 페이지(`/class/[classId]/survey/[surveyId]`)로 진입

## 🔁 학생 목록 연동 정책

- 학생 목록은 `/class/create/students`에서 생성 후 저장
- 이후 설문 만들기 페이지와 관계도 페이지 좌측 목록에 항상 동기화됨
- 어느 쪽에서 수정하든 실시간 반영됨
- 목록 항목 클릭 시 관계 설정 페이지 이동 기능은 설문 만들기 페이지에서는 제거됨

## 🛠 개발 및 분기 포인트

- `/class/[classId]/survey/page.tsx`: 설문 목록 및 설문 생성 인터페이스 제공
- `/class/[classId]/survey/[surveyId]/page.tsx`: 설문 상세 관계도 페이지 (기존 관계도 역할 그대로 유지)
- `/components/StudentListSidebar.tsx`: 설문 만들기/관계도 공용, 클릭 이벤트 조건 분기 처리 필요

---

> 이 scaffold는 학급 단위 데이터 구조와 설문 카드 기반 관계도 기능 확장을 위한 파일 구성 기준입니다. Cursor 명령 시 이 구조와 class-creation-flow-prd.md PRD를 함께 제공하면 명확하게 작업 가능합니다.