'use client';

import React from 'react';
import { Student } from '@/lib/supabase'; // Student 타입을 가져옵니다.

interface RelationshipTypeRankBoxProps {
  title: string; // 예: "가장 친한 친구", "같이 공부하고 싶은 친구"
  students: Student[] | undefined; // 해당 관계 유형의 상위 학생 목록
  relationshipType: string; // 랭킹 계산에 사용된 관계 유형 (내부 로직용, 표시 X)
}

const RelationshipTypeRankBox: React.FC<RelationshipTypeRankBoxProps> = ({
  title,
  students,
  relationshipType, // 이 prop은 현재 컴포넌트 내에서 직접 사용되진 않지만, 상위 컴포넌트에서 데이터를 전달할 때 필요할 수 있습니다.
}) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-4 h-full flex flex-col">
      <h3 className="text-md font-bold mb-2 text-[#6366f1] text-center border-b pb-2 flex-shrink-0">
        {title}
      </h3>
      {students && students.length > 0 ? (
        <ul className="text-sm flex-grow overflow-y-auto pr-2 flex flex-col gap-0">
          {students.slice(0, 10).map((student, index) => ( 
            <li key={student.id} className="flex items-center justify-between py-0.5 px-1 rounded hover:bg-gray-100 leading-tight">
              <span className="font-medium text-gray-500">{index + 1}위:</span>
              <span className="truncate ml-2 flex-1 text-right font-medium text-gray-500">{student.name}</span>
              {/* 필요하다면 받은 횟수 등을 표시할 수 있습니다. */}
              {/* 예: <span className="text-xs text-gray-500 ml-1">({student.count})</span> */}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500 italic flex-grow flex items-center justify-center">
          아직 순위 데이터가 없습니다.
        </p>
      )}
    </div>
  );
};

export default RelationshipTypeRankBox; 