// 난이도: AI가 얼마나 실수하는지(ai)와 시작 조건(handicap). handicap 값은 [나, AI] 순서.
// 배 체력(선체)은 난이도와 상관없이 모두 20으로 같다. 시작 카드 수만 다르다.
export const DIFFICULTIES = {
  easy: {
    name: '쉬움', emoji: '🐣',
    desc: 'AI가 자주 실수하고, 내가 카드를 1장 더 받고 시작합니다.',
    ai: 'easy',
    handicap: { hull: [20, 20], extraCards: [1, 0] },
  },
  normal: {
    name: '보통', emoji: '😽',
    desc: 'AI가 가끔 실수합니다. 조건은 똑같아요.',
    ai: 'normal',
    handicap: { hull: [20, 20], extraCards: [0, 0] },
  },
  hard: {
    name: '어려움', emoji: '🥵',
    desc: 'AI가 실수 없이 싸우고, 카드를 1장 더 받고 시작합니다.',
    ai: 'hard',
    handicap: { hull: [20, 20], extraCards: [0, 1] },
  },
  insight: {
    name: '견문색', emoji: '👀',
    desc: 'AI가 상대의 반격까지 미리 내다보고 둡니다. 어려움처럼 카드를 1장 더 받고 시작합니다.',
    ai: 'insight',
    handicap: { hull: [20, 20], extraCards: [0, 1] },
  },
};
