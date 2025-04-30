'use client';

import React, { useMemo } from 'react';
// NodeData는 page.tsx에서 정의되므로, 여기서는 일단 any로 처리
// 실제 사용 시 page.tsx에서 정의된 타입을 props로 받거나 import 해야 함
import { Question, Answer /*, NodeData*/ } from '@/lib/supabase'; // NodeData 주석 처리

type NodeData = any; // 임시 타입 정의

interface WeeklyAnswersBoxProps {
  questions: Question[] | undefined;
  answers: Answer[] | undefined;
  selectedStudent: NodeData | null;
  isLoadingAnswers: boolean;
}

// 질문 데이터에 question_text가 포함되어 있다고 가정
interface AnswerWithQuestionText extends Answer {
    questions?: {
        question_text: string;
    } | null;
}

const WeeklyAnswersBox: React.FC<WeeklyAnswersBoxProps> = ({
  questions,
  answers,
  selectedStudent,
  isLoadingAnswers,
}) => {
  // 선택된 학생의 답변만 ID를 키로 하는 Map으로 미리 만들어 둠 (성능 개선)
  const selectedStudentAnswerMap = useMemo(() => {
    const map = new Map<string, string | null>();
    if (answers && selectedStudent) {
      answers
        .filter(answer => answer.student_id === selectedStudent.id)
        .forEach(answer => {
          map.set(answer.question_id, answer.answer_text ?? null);
        });
    }
    return map;
  }, [selectedStudent, answers]);

  return (
    // 부모 컴포넌트에서 width와 margin을 조절하도록 기본 스타일 유지
    // 예: className="bg-white rounded-lg shadow-md p-4 w-full max-w-5xl mx-auto"
    <div className="bg-white rounded-lg shadow-md p-4 h-full flex flex-col overflow-hidden">
      <h3 className="text-md font-bold mb-3 text-[#6366f1] text-center border-b pb-2 flex-shrink-0">
        주관식 질문
      </h3>
      <div className="flex-grow overflow-y-auto pr-2 text-sm space-y-2">
        {/* 질문 목록이 없을 경우 */}
        {!questions || questions.length === 0 ? (
          <p className="text-gray-500 italic flex items-center justify-center h-full">등록된 질문이 없습니다.</p>
        ) : (
          /* 질문 목록을 기준으로 반복 */
          questions.map((question) => (
            <div key={question.id} className="text-black">
              {/* 질문 텍스트 (항상 표시) */}
              <p className="font-semibold text-[#6366f1]">
                {question.question_text}
              </p>
              {/* 답변 영역: 항상 렌더링, 내용만 조건부 */}
              <p className="pl-4">
                {selectedStudent ? (
                  isLoadingAnswers ? (
                    <span className="text-gray-500 italic">답변 로딩 중...</span>
                  ) : (
                    // 학생 선택 시: 실제 답변 또는 없음 메시지
                    selectedStudentAnswerMap.has(question.id) ? 
                     (selectedStudentAnswerMap.get(question.id) || <span className="text-gray-500 italic">답변 없음</span>) :
                     <span className="text-gray-500 italic">답변 없음</span>
                  )
                ) : (
                  // 학생 미선택 시: 플레이스홀더 메시지
                  <span className="text-gray-400 italic">학생을 선택하면 답변이 표시됩니다.</span>
                )}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default WeeklyAnswersBox; 