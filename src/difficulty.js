// 난이도: AI가 얼마나 실수하는지(ai)와 시작 조건(handicap). handicap 값은 [나, AI] 순서.
export const DIFFICULTIES = {
  easy: {
    name: '쉬움', emoji: '🐣',
    desc: 'AI가 자주 실수하고, 내 배가 더 튼튼하게 시작합니다.',
    ai: 'easy',
    handicap: { hull: [26, 16], extraCards: [1, 0] },
  },
  normal: {
    name: '보통', emoji: '⚓',
    desc: 'AI가 가끔 실수합니다. 조건은 똑같아요.',
    ai: 'normal',
    handicap: { hull: [20, 20], extraCards: [0, 0] },
  },
  hard: {
    name: '어려움', emoji: '💀',
    desc: 'AI가 실수 없이 싸우고, 배도 더 튼튼합니다.',
    ai: 'hard',
    handicap: { hull: [20, 24], extraCards: [0, 1] },
  },
};
