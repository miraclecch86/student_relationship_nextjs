export const RELATIONSHIP_TYPES = {
  FRIEND: '친구',
  CLOSE_FRIEND: '친한 친구',
  BEST_FRIEND: '베스트 프렌드',
  ACQUAINTANCE: '알고 지내는 사이',
  MENTOR: '멘토',
  MENTEE: '멘티',
} as const;

export const RELATIONSHIP_COLORS = {
  FRIEND: '#4CAF50',
  CLOSE_FRIEND: '#2196F3',
  BEST_FRIEND: '#9C27B0',
  ACQUAINTANCE: '#FF9800',
  MENTOR: '#F44336',
  MENTEE: '#E91E63',
} as const;

export const WEEKLY_QUESTIONS = [
  '이번 주에 가장 많이 이야기를 나눈 친구는 누구인가요?',
  '함께 공부하거나 과제를 하면 좋은 친구는 누구인가요?',
  '쉬는 시간에 주로 누구와 함께 보내나요?',
  '어려운 일이 있을 때 도움을 청하고 싶은 친구는 누구인가요?',
  '다음 주에 더 친해지고 싶은 친구는 누구인가요?',
] as const; 