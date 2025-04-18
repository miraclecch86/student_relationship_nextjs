export const RELATIONSHIP_TYPES = {
  FRIENDLY: '친해',
  WANNA_BE_CLOSE: '친해질래',
  NEUTRAL: '괜찮아',
  AWKWARD: '불편해',
} as const;

export const RELATIONSHIP_COLORS = {
  FRIENDLY: '#22c55e',      // bg-green-500
  WANNA_BE_CLOSE: '#3b82f6', // bg-blue-500
  NEUTRAL: '#a855f7',       // bg-purple-500
  AWKWARD: '#f97316',       // bg-orange-500
} as const;

export const WEEKLY_QUESTIONS = [
  '이번 주에 가장 많이 이야기를 나눈 친구는 누구인가요?',
  '함께 공부하거나 과제를 하면 좋은 친구는 누구인가요?',
  '쉬는 시간에 주로 누구와 함께 보내나요?',
  '어려운 일이 있을 때 도움을 청하고 싶은 친구는 누구인가요?',
  '다음 주에 더 친해지고 싶은 친구는 누구인가요?',
] as const; 