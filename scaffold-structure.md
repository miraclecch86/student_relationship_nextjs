// 프로젝트 scaffold: 학생 관계 시각화 앱 (Next.js + Supabase 기준)

// 디렉토리 구조
📦 project-root
├── 📁 app/                         // Next.js App Router 기준
│   ├── 📁 page.tsx                // 학급 관리 페이지 (초기 진입)
│   ├── 📁 class
│   │   ├── 📁 [classId]/
│   │   │   ├── page.tsx          // 학생 관계도 페이지
│   │   │   └── 📁 student/
│   │   │       └── [studentId]/page.tsx  // 학생 관계 설정 페이지
│   └── layout.tsx                // 기본 레이아웃 구성
├── 📁 components/                 // 공통 UI 컴포넌트
│   ├── ClassCard.tsx
│   ├── AddClassForm.tsx
│   ├── StudentNode.tsx
│   ├── RelationshipGraph.tsx
│   ├── QuestionManager.tsx
│   ├── WeeklyAnswerBox.tsx
│   ├── SaveLoadModal.tsx
│   └── ConfirmModal.tsx
├── 📁 lib/                         // 외부 API, Supabase 클라이언트
│   ├── supabase.ts
│   └── constants.ts
├── 📁 hooks/                       // 커스텀 훅
│   └── useRelationships.ts
├── 📁 utils/                       // 유틸 함수
│   ├── graphUtils.ts              // D3.js 그래프 배치/처리
│   ├── storage.ts                 // 로컬 저장/불러오기
│   └── formatter.ts               // 문자열 포맷 등
├── 📁 styles/
│   └── globals.css
├── 📁 public/                      // 이미지, 아이콘
│   └── icons/
├── .env.local                     // 환경 변수 (Supabase API 등)
├── tailwind.config.ts
├── tsconfig.json
├── next.config.js
└── README.md
