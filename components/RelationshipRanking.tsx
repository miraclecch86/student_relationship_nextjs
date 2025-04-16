'use client';

import React, { useMemo } from 'react';
import { NodeData, LinkData } from '@/app/class/[classId]/page';
import { RELATIONSHIP_TYPES } from '@/lib/constants';

interface RelationshipRankingProps {
  students: NodeData[];
  relationships: LinkData[];
}

// RELATIONSHIP_TYPES의 키 타입을 명시적으로 정의
type RelationshipTypeKey = keyof typeof RELATIONSHIP_TYPES;

// 학생별 관계 수를 계산하는 헬퍼 함수 (타입 오류 최종 수정 v3)
const calculateRelationshipCounts = (students: NodeData[], relationships: LinkData[]) => {
  // Record 유틸리티 타입을 사용하여 RelationshipCount 정의
  type RelationshipCount = Record<RelationshipTypeKey, number>;
  const studentStats: { [studentId: string]: { name: string; counts: RelationshipCount } } = {};

  students.forEach(student => {
    // 모든 키에 대해 0으로 초기화
    const initialCounts = {} as RelationshipCount;
    (Object.keys(RELATIONSHIP_TYPES) as RelationshipTypeKey[]).forEach(key => {
      initialCounts[key] = 0;
    });
    studentStats[student.id] = { name: student.name, counts: initialCounts };
  });

  relationships.forEach(link => {
    const sourceId = typeof link.source === 'object' ? (link.source as NodeData).id : link.source;
    const type = link.type as RelationshipTypeKey; // 타입 단언

    // type이 유효한 키이고, sourceId가 존재하면 count 증가
    if (studentStats[sourceId] && type in RELATIONSHIP_TYPES) {
        studentStats[sourceId].counts[type]++;
    }
  });

  return Object.values(studentStats);
};

export default function RelationshipRanking({ students, relationships }: RelationshipRankingProps) {
  const rankingData = useMemo(() => calculateRelationshipCounts(students, relationships), [students, relationships]);

  const getSortedRank = (type: keyof typeof RELATIONSHIP_TYPES, limit: number = 3) => {
    return [...rankingData]
      .sort((a, b) => (b.counts[type] ?? 0) - (a.counts[type] ?? 0))
      .slice(0, limit)
      .filter(item => (item.counts[type] ?? 0) > 0);
  };

  return (
    <div className="bg-white rounded-lg shadow p-3 overflow-y-auto">
      <h3 className="text-base font-semibold mb-2 border-b pb-1 text-gray-700">관계 순위 Top 3</h3>
      <div className="space-y-3">
        {Object.entries(RELATIONSHIP_TYPES).map(([key, label]) => {
          const rankType = key as keyof typeof RELATIONSHIP_TYPES;
          const topStudents = getSortedRank(rankType);
          return (
            <div key={key}>
              <h4 className="text-sm font-medium text-gray-600 mb-1">{label} 많은 학생</h4>
              {topStudents.length > 0 ? (
                <ul className="list-decimal list-inside text-xs space-y-0.5 pl-1">
                  {topStudents.map((student, index) => (
                    <li key={student.name}>
                      <span className="font-medium">{student.name}</span> ({student.counts[rankType]}명)
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-400 italic pl-1">해당 관계 없음</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
} 