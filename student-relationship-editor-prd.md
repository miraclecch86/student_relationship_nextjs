# 학생 관계 설정 페이지 PRD (Product Requirement Document)

## 1. 개요
이 문서는 학생 관계 설정 페이지의 기능, 인터페이스, 데이터 흐름, 디자인 요구 사항을 정의합니다. 해당 페이지는 학생 관계도 페이지에서 특정 학생 이름 카드를 클릭했을 때 진입합니다.

참고 이미지: `학생관계설정.png`

## 2. 목적
- 한 명의 학생이 반 친구들과의 관계를 설정할 수 있도록 UI 제공
- 주관식 질문을 추가하고, 모든 학생이 해당 질문에 개별적으로 응답할 수 있도록 함

---

## 3. 기술 스택
- Frontend: Next.js, TypeScript, Tailwind CSS, Framer Motion
- Backend: Supabase (PostgreSQL, Auth, Storage)
- 상태 관리: React Context, useState
- 배포: Vercel

---

## 4. 페이지 구조 및 주요 기능

### 상단 헤더
- 페이지 타이틀: `관계 설정`
- 현재 설정 중인 학생의 이름과 성별 표시
- 성별 선택 탭 (남학생 / 여학생) → 라디오 선택처럼 단일 선택 가능

### 돌아가기 버튼 (상단 및 하단 동일 동작)
- 관계 설정 및 주관식 응답 내용을 Supabase에 저장 후 이전 페이지(학생 관계도 페이지)로 이동

### 관계 설정 카드 리스트
- 본인을 제외한 모든 학생들의 관계 설정 카드 자동 생성
- 각 카드에 표시되는 항목:
  - 이름, 성별 (간단한 아이콘 또는 색상 구분 가능)
  - 관계 선택: 친한 / 보통 / 안친한 중 하나만 선택 가능
  - 선택된 관계는 색상 강조 (초록 / 노랑 / 빨강)
- 관계는 단일 선택만 가능하며, 중복 선택 불가
- 관계 선택은 학생별로 독립 작동 (예: A → B 선택과 B → A는 별도 저장)
- 초기 상태에서는 아무 관계도 선택되지 않음

### 주관식 질문 추가 영역
- 입력창에 질문을 작성하고 `+추가` 버튼 클릭 시 아래에 리스트 형태로 추가됨
- 추가된 질문은 **전체 학생에게 공통 적용**됨
- 질문 삭제 시 **모든 학생의 해당 질문 및 응답 삭제됨**
- 삭제 시 반드시 확인 팝업(modal) 표시

### 주관식 응답 영역
- 질문 리스트 아래, 현재 학생이 선택한 질문에 대한 응답을 작성하는 입력창 표시
- 응답 내용은 Supabase에 해당 학생의 student_id와 함께 저장됨
- 입력한 응답은 다른 학생들과 공유되지 않음

---

## 5. UI/UX 세부 사양

### 전체 스타일
- 카드, 버튼, 입력창은 모두 **그림자 효과 적용**
- 모든 클릭 가능한 요소에는 **hover 시 색상 및 강조 효과 적용**

### 카드 동작
- 관계 선택 시 배경색 변경 (초록/노랑/빨강)
- 선택된 버튼은 눌린 상태(pressed)로 시각적 피드백 제공
- 카드 간 여백 및 정렬은 `학생관계설정.png` 이미지와 100% 동일하게 구현

### 삭제 인터랙션
- 주관식 질문 삭제 시 modal로 재확인
  - 메시지: "해당 질문은 모든 학생의 응답과 함께 삭제됩니다. 진행하시겠습니까?"
- 확인 클릭 시 삭제 진행

### 돌아가기 버튼
- 상단과 하단에 동일하게 위치
- 디자인과 위치는 `학생관계설정.png` 이미지 기준 100% 동일하게 구현
- 클릭 시:
  1. 관계 설정 저장
  2. 주관식 응답 저장
  3. `/class/[classId]` 페이지로 이동

---

## 6. 데이터 처리 방식 (Supabase)

### 관계 설정
- `relations` 테이블에 다음 항목 저장:
  - `from_student_id`, `to_student_id`, `relation_type` ('친한', '보통', '안친한')
- 관계는 단방향 저장 (서로가 선택하면 양방향 선으로 시각화됨)

### 질문 및 응답 저장
- `questions` 테이블:
  - class_id, question_text
- `answers` 테이블:
  - question_id, student_id, answer_text
- 질문 삭제 시, 해당 question_id와 관련된 모든 answers도 삭제됨

---

## 7. 기타 고려 사항
- 관계는 본인을 제외한 학생들에게만 설정 가능
- 질문 삭제 시 관련 데이터가 일괄 삭제되는 점을 반드시 사용자에게 안내
- 돌아가기 시 자동 저장되어야 하며, 저장 실패 시 에러 메시지 제공

---

> 이 페이지는 학생 한 명의 관계 및 응답 데이터를 관리하는 핵심 설정 UI로, 교사와 학생의 사용성을 고려하여 직관적이고 오류 없는 흐름을 목표로 해야 합니다.

