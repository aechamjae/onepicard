// 카드 정의. 선원(crew)은 바다에 남아 싸우고, 전술(tactic)은 쓰고 버린다.
// target: 'foeCrew' | 'allyCrew' — 내기 전에 대상을 골라야 하는 카드.

export const KEYWORDS = {
  charge: { name: '돌격', desc: '낸 턴에 바로 공격할 수 있다.' },
  guard: { name: '수호', desc: '상대는 수호 선원부터 공격해야 한다.' },
  plunder: { name: '약탈', desc: '적 배를 공격하면 보물을 1개 더 얻는다.' },
  sneak: { name: '잠입', desc: '수호 선원을 무시하고 적 배를 공격할 수 있다.' },
  reach: { name: '뻗기', desc: '적 선원을 공격하면 그 양옆의 적 선원에게도 1 피해.' },
  elastic: { name: '탄성', desc: '받는 피해가 1 줄어든다.' },
};

export const CARDS = {
  // ── 공용 ──
  deckhand: { name: '갑판 견습생', type: 'crew', cost: 1, atk: 1, hp: 2, art: '🧹', text: '' },
  lookout: {
    name: '망루 감시병', type: 'crew', cost: 2, atk: 1, hp: 2, art: '🔭',
    text: '등장: 카드 1장을 뽑는다.',
    onPlay: (g) => g.draw(1),
  },
  cannon: {
    name: '포격', type: 'tactic', cost: 2, art: '💥', target: 'foeCrew',
    text: '적 선원 하나에게 3 피해.',
    effect: (g, t) => g.damageCrew(t, 3),
  },
  repair: {
    name: '선체 수리', type: 'tactic', cost: 2, art: '🔧',
    text: '내 배의 선체를 5 회복한다.',
    effect: (g) => g.healShip(5),
  },
  map: {
    name: '보물 지도', type: 'tactic', cost: 3, art: '🗺️',
    text: '카드 2장을 뽑는다.',
    effect: (g) => g.draw(2),
  },
  coin: {
    name: '행운의 동전', type: 'tactic', cost: 0, art: '🪙',
    text: '이번 턴에만 바람 +1. (후공 보너스)',
    effect: (g) => g.gainWind(1),
  },
  rum: {
    name: '럼주 한 잔', type: 'tactic', cost: 1, art: '🍺', target: 'allyCrew',
    text: '아군 선원 하나에게 공격력 +2, 체력 +1.',
    effect: (g, t) => g.buff(t, 2, 1),
  },

  // ── 붉은 돛 해적단 ──
  cutlass: { name: '칼잡이 돌격대', type: 'crew', cost: 2, atk: 2, hp: 1, art: '🗡️', keywords: ['charge'], text: '' },
  powder: {
    name: '화약통 폭파범', type: 'crew', cost: 3, atk: 3, hp: 2, art: '🧨',
    text: '등장: 무작위 적 선원에게 2 피해.',
    onPlay: (g) => { const t = g.randomFoeCrew(); if (t) g.damageCrew(t.uid, 2); },
  },
  duelist: { name: '쌍검 항해사', type: 'crew', cost: 3, atk: 3, hp: 3, art: '⚔️', text: '' },
  raider: { name: '갈고리 약탈꾼', type: 'crew', cost: 4, atk: 3, hp: 4, art: '🪝', keywords: ['plunder', 'sneak'], text: '' },
  raid: {
    name: '기습 약탈', type: 'tactic', cost: 3, art: '🏴‍☠️',
    text: '적 배에 2 피해를 주고 보물 1개를 얻는다.',
    effect: (g) => { g.damageFoeShip(2); g.gainTreasure(1); },
  },
  redbeard: { name: '붉은 수염 제독', type: 'crew', cost: 6, atk: 5, hp: 5, art: '🦜', keywords: ['charge', 'plunder', 'sneak'], text: '' },

  // ── 심해 함대 ──
  sentinel: { name: '심해 경비병', type: 'crew', cost: 2, atk: 1, hp: 3, art: '🛡️', keywords: ['guard'], text: '' },
  harpoon: {
    name: '작살 사수', type: 'crew', cost: 3, atk: 2, hp: 3, art: '🔱',
    text: '등장: 무작위 적 선원에게 2 피해.',
    onPlay: (g) => { const t = g.randomFoeCrew(); if (t) g.damageCrew(t.uid, 2); },
  },
  tide: {
    name: '해류 술사', type: 'crew', cost: 4, atk: 2, hp: 4, art: '🌊',
    text: '등장: 내 배의 선체를 4 회복한다.',
    onPlay: (g) => g.healShip(4),
  },
  anchor: {
    name: '닻 내리기', type: 'tactic', cost: 2, art: '⚓', target: 'foeCrew',
    text: '적 선원 하나는 다음 턴에 공격할 수 없다. 카드 1장을 뽑는다.',
    effect: (g, t) => { g.freeze(t); g.draw(1); },
  },
  volley: {
    name: '일제 사격', type: 'tactic', cost: 5, art: '🎆',
    text: '모든 적 선원에게 2 피해.',
    effect: (g) => g.foe.board.map((c) => c.uid).forEach((uid) => g.damageCrew(uid, 2)),
  },
  turtle: { name: '거북 철갑선', type: 'crew', cost: 5, atk: 3, hp: 6, art: '🐢', keywords: ['guard'], text: '' },
  abyss: {
    name: '심연의 함장', type: 'crew', cost: 7, atk: 6, hp: 8, art: '🐙',
    text: '내 턴이 끝날 때 보물 1개를 얻는다.',
    onTurnEnd: (g) => g.gainTreasure(1),
  },

  // ── 탄성 곡예단 ──
  rookie: { name: '고무줄 견습생', type: 'crew', cost: 1, atk: 1, hp: 1, art: '🤸', keywords: ['elastic'], text: '' },
  boxer: { name: '휘어팔 권투사', type: 'crew', cost: 2, atk: 2, hp: 2, art: '🥊', keywords: ['reach'], text: '' },
  whip: { name: '채찍팔 갑판장', type: 'crew', cost: 3, atk: 3, hp: 2, art: '🪢', keywords: ['reach'], text: '' },
  balloon: { name: '풍선배 방패수', type: 'crew', cost: 3, atk: 1, hp: 4, art: '🎈', keywords: ['guard', 'elastic'], text: '' },
  catapult: { name: '새총팔 투척수', type: 'crew', cost: 4, atk: 3, hp: 2, art: '🏹', keywords: ['reach', 'elastic'], text: '' },
  ringmaster: { name: '거인팔 곡예단장', type: 'crew', cost: 6, atk: 4, hp: 5, art: '🎪', keywords: ['reach', 'elastic'], text: '' },
  slingshot: {
    name: '당겨서 쏘기', type: 'tactic', cost: 2, art: '🪃', target: 'allyCrew',
    text: '아군 선원 하나에게 공격력 +2. 이번 턴에 한 번 더 공격할 수 있다.',
    effect: (g, t) => { g.buff(t, 2, 0); g.ready(t); },
  },
  grab: {
    name: '휘감아 던지기', type: 'tactic', cost: 3, art: '🌀', target: 'foeCrew',
    text: '적 선원 하나를 상대 손패로 되돌린다.',
    effect: (g, t) => g.bounce(t),
  },
};

export const FACTIONS = {
  red: {
    name: '붉은 돛 해적단',
    emblem: '🏴‍☠️',
    desc: '공격형. 돌격과 약탈로 빠르게 보물을 턴다.',
    deck: { deckhand: 2, lookout: 2, cutlass: 3, powder: 2, duelist: 3, raider: 3, redbeard: 2, raid: 2, cannon: 2, rum: 2, map: 1 },
  },
  deep: {
    name: '심해 함대',
    emblem: '🐙',
    desc: '수비형. 수호 선원으로 버티고 거대한 함장으로 누른다.',
    deck: { deckhand: 2, lookout: 2, sentinel: 3, harpoon: 3, tide: 2, turtle: 2, abyss: 1, anchor: 2, volley: 1, cannon: 2, repair: 2, map: 2 },
  },
  stretch: {
    name: '탄성 곡예단',
    emblem: '🤸',
    desc: '변칙형. 늘어나는 팔로 여러 적을 한꺼번에 치고, 고무 몸으로 피해를 튕겨 낸다.',
    deck: { deckhand: 2, lookout: 2, rookie: 3, boxer: 3, whip: 3, balloon: 2, catapult: 2, ringmaster: 2, slingshot: 2, grab: 2, map: 1 },
  },
};
