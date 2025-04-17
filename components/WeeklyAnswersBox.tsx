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
  // 선택된 학생의 답변만 필터링
  const selectedStudentAnswers = answers?.filter(
    (answer) => answer.student_id === selectedStudent?.id
  ) as AnswerWithQuestionText[] | undefined;

  // 질문 ID를 키로 하여 질문 텍스트를 빠르게 찾기 위한 Map 생성
  const questionTextMap = useMemo(() => {
    const map = new Map<string, string>();
    questions?.forEach(q => {
      map.set(q.id, q.question_text);
    });
    return map;
  }, [questions]);

  return (
    // 부모 컴포넌트에서 width와 margin을 조절하도록 기본 스타일 유지
    // 예: className="bg-white rounded-lg shadow-md p-4 w-full max-w-5xl mx-auto"
    <div className="bg-white rounded-lg shadow-md p-4 h-full flex flex-col overflow-hidden">
      <h3 className="text-md font-bold mb-3 text-[#6366f1] text-center border-b pb-2 flex-shrink-0">
        주관식 질문
      </h3>
      <div className="flex-grow overflow-y-auto pr-2 text-sm">
        {selectedStudent ? (
          isLoadingAnswers ? (
            <p className="text-gray-500 italic flex items-center justify-center h-full">답변 로딩 중...</p>
          ) : (
            selectedStudentAnswers && selectedStudentAnswers.length > 0 ? (
              <ul className="space-y-2">
                {selectedStudentAnswers.map((answer, index) => {
                  const questionText = questionTextMap.get(answer.question_id) || '질문 확인 불가';
                  return (
                    <li key={answer.id} className="text-black">
                      <p className="font-semibold">
                        [{index + 1}] Q: {questionText}
                      </p>
                      <p className="pl-4 text-black">
                        &rarr; A: {answer.answer_text || <span className="text-gray-500 italic">답변 없음</span>}
                      </p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-gray-500 italic flex items-center justify-center h-full">{selectedStudent.name} 학생의 답변이 없습니다.</p>
            )
          )
        ) : (
          <p className="text-gray-500 italic flex items-center justify-center h-full">학생 목록에서 학생을 선택하세요.</p>
        )}
      </div>
    </div>
  );
};

export default WeeklyAnswersBox; 