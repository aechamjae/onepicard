// 카드 정의. 선원(crew)은 바다에 남아 싸우고, 전술(tactic)은 쓰고 버린다.
// target: 'foeCrew' | 'allyCrew' — 내기 전에 대상을 골라야 하는 카드.

export const KEYWORDS = {
  charge: { name: '돌격', desc: '낸 턴에 바로 공격할 수 있다.' },
  guard: { name: '수호', desc: '상대는 수호 선원부터 공격해야 한다.' },
  plunder: { name: '약탈', desc: '적 배를 공격하면 보물을 1개 더 얻는다.' },
  sneak: { name: '잠입', desc: '수호 선원을 무시하고 적 배를 공격할 수 있다.' },
  reach: { name: '뻗기', desc: '적 선원을 공격하면 그 양옆의 적 선원에게도 1 피해.' },
  elastic: { name: '탄성', desc: '받는 피해가 1 줄어든다.' },
  tension: { name: '탄력', desc: '공격하지 않고 턴을 마치면 팔을 당겨 탄력 +1(최대 3). 다음 공격 때 탄력만큼 더 세게 친다.' },
  ghost: { name: '망령', desc: '처음 쓰러지면 체력 1로 한 번 되살아난다.' },
  scorch: { name: '화염', desc: '공격해서 피해를 준 적 선원에게 불을 붙인다. 불붙은 선원은 주인의 턴이 시작될 때마다 2 피해.' },
  grow: { name: '성장', desc: '내 턴이 끝날 때마다 공격력 +1, 체력 +1 (최대 2번).' },
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
  parrot: { name: '앵무새 정찰병', type: 'crew', cost: 1, atk: 1, hp: 1, art: '🦜', keywords: ['charge'], text: '' },
  carpenter: { name: '갑판 목수', type: 'crew', cost: 2, atk: 2, hp: 3, art: '🪚', text: '' },
  barrel: {
    name: '술통 굴리기', type: 'tactic', cost: 1, art: '🛢️', target: 'foeCrew',
    text: '적 선원 하나에게 1 피해. 카드 1장을 뽑는다.',
    effect: (g, t) => { g.damageCrew(t, 1); g.draw(1); },
  },
  chest: {
    name: '숨겨 둔 보물 상자', type: 'tactic', cost: 3, art: '🧰',
    text: '보물 1개를 얻고 카드 1장을 뽑는다.',
    effect: (g) => { g.gainTreasure(1); g.draw(1); },
  },
  broadside: {
    name: '측면 일제 포격', type: 'tactic', cost: 4, art: '🚢',
    text: '적 배에 4 피해.',
    effect: (g) => g.damageFoeShip(4),
  },
  flag: {
    name: '해적 깃발', type: 'tactic', cost: 3, art: '🏴',
    text: '아군 선원 모두에게 공격력 +1, 체력 +1.',
    effect: (g) => g.buffAll(1, 1),
  },
  maelstrom: {
    name: '대소용돌이', type: 'tactic', cost: 6, art: '🌪️',
    text: '바다 위 모든 선원(아군 포함)에게 3 피해.',
    effect: (g) => g.damageAll(3),
  },
  kraken: { name: '길들인 대왕문어', type: 'crew', cost: 8, atk: 7, hp: 8, art: '🦑', keywords: ['guard'], text: '' },

  // ── 붉은 돛 해적단 ──
  cutlass: { name: '칼잡이 돌격대', type: 'crew', cost: 2, atk: 2, hp: 2, art: '🗡️', keywords: ['charge'], text: '' },
  powder: {
    name: '화약통 폭파범', type: 'crew', cost: 3, atk: 3, hp: 2, art: '🧨',
    text: '등장: 무작위 적 선원에게 2 피해.',
    onPlay: (g) => { const t = g.randomFoeCrew(); if (t) g.damageCrew(t.uid, 2); },
  },
  duelist: { name: '쌍검 항해사', type: 'crew', cost: 3, atk: 4, hp: 3, art: '⚔️', text: '' },
  raider: { name: '갈고리 약탈꾼', type: 'crew', cost: 4, atk: 4, hp: 4, art: '🪝', keywords: ['plunder', 'sneak'], text: '' },
  raid: {
    name: '기습 약탈', type: 'tactic', cost: 3, art: '🏴‍☠️',
    text: '적 배에 2 피해를 주고 보물 1개를 얻는다.',
    effect: (g) => { g.damageFoeShip(2); g.gainTreasure(1); },
  },
  gunner: {
    name: '쌍권총 저격수', type: 'crew', cost: 3, atk: 3, hp: 2, art: '🔫',
    text: '등장: 적 배에 2 피해.',
    onPlay: (g) => g.damageFoeShip(2),
  },
  grog: {
    name: '그로그 폭주', type: 'tactic', cost: 2, art: '🍻',
    text: '아군 선원 모두에게 공격력 +1.',
    effect: (g) => g.buffAll(1, 0),
  },
  bounty: {
    name: '현상금 사냥', type: 'tactic', cost: 4, art: '📜', target: 'foeCrew',
    text: '적 선원 하나에게 4 피해. 그 선원이 쓰러지면 보물 1개를 얻는다.',
    effect: (g, t) => { g.damageCrew(t, 4); if (!g.isAlive(t)) g.gainTreasure(1); },
  },
  redbeard: { name: '붉은 수염 제독', type: 'crew', cost: 5, atk: 5, hp: 5, art: '🦜', keywords: ['charge', 'plunder', 'sneak'], text: '' },

  // ── 심해 함대 ──
  sentinel: { name: '심해 경비병', type: 'crew', cost: 2, atk: 1, hp: 4, art: '🛡️', keywords: ['guard'], text: '' },
  harpoon: {
    name: '작살 사수', type: 'crew', cost: 3, atk: 3, hp: 3, art: '🔱',
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
  jelly: { name: '해파리 방벽', type: 'crew', cost: 2, atk: 0, hp: 5, art: '🪼', keywords: ['guard'], text: '' },
  pearl: {
    name: '진주 마녀', type: 'crew', cost: 3, atk: 2, hp: 3, art: '🦪',
    text: '등장: 무작위 다른 아군 선원에게 체력 +3.',
    onPlay: (g, self) => { const t = g.randomAllyCrew(self.uid); if (t) g.buff(t.uid, 0, 3); },
  },
  tsunami: {
    name: '해일', type: 'tactic', cost: 7, art: '⛈️',
    text: '모든 적 선원에게 3 피해.',
    effect: (g) => g.damageAllFoes(3),
  },
  abyss: {
    name: '심연의 함장', type: 'crew', cost: 7, atk: 6, hp: 8, art: '🐙',
    text: '내 턴이 끝날 때 보물 1개를 얻는다.',
    onTurnEnd: (g) => g.gainTreasure(1),
  },

  // ── 고무팔 곡예단 ── (arm: true 인 카드는 늘어나는 팔 그림으로 그린다)
  rookie: { name: '고무줄 견습생', type: 'crew', cost: 1, atk: 1, hp: 1, art: '🤸', arm: true, keywords: ['elastic'], text: '' },
  boxer: { name: '고무주먹 권투사', type: 'crew', cost: 2, atk: 2, hp: 3, art: '😤', arm: true, keywords: ['tension'], text: '' },
  whip: { name: '채찍팔 갑판장', type: 'crew', cost: 3, atk: 3, hp: 2, art: '😼', arm: true, keywords: ['reach'], text: '' },
  balloon: { name: '풍선배 방패수', type: 'crew', cost: 3, atk: 1, hp: 4, art: '🎈', keywords: ['guard', 'elastic'], text: '' },
  spring: { name: '용수철 포수', type: 'crew', cost: 4, atk: 3, hp: 4, art: '😆', arm: true, keywords: ['tension', 'elastic'], text: '' },
  catapult: { name: '새총팔 투척수', type: 'crew', cost: 4, atk: 3, hp: 2, art: '😝', arm: true, keywords: ['reach', 'elastic'], text: '' },
  ringmaster: { name: '거인팔 곡예단장', type: 'crew', cost: 6, atk: 4, hp: 5, art: '🤠', arm: true, keywords: ['reach', 'tension'], text: '' },
  slingshot: {
    name: '고무줄 새총', type: 'tactic', cost: 2, art: '🪃', target: 'allyCrew',
    text: '아군 선원 하나의 팔을 끝까지 당긴다: 탄력 3, 이번 턴에 바로 공격할 수 있다.',
    effect: (g, t) => { g.setTension(t, 3); g.ready(t); },
  },
  grab: {
    name: '휘감아 던지기', type: 'tactic', cost: 3, art: '🌀', target: 'foeCrew',
    text: '긴 팔로 적 선원 하나를 붙잡아 상대 손패로 던져 버린다.',
    effect: (g, t) => g.bounce(t),
  },
  rubberwall: { name: '고무벽 문지기', type: 'crew', cost: 4, atk: 2, hp: 5, art: '🧱', keywords: ['guard', 'elastic'], text: '' },
  pinball: {
    name: '핀볼 곡예사', type: 'crew', cost: 3, atk: 2, hp: 2, art: '🤹', arm: true, keywords: ['reach'],
    text: '등장: 무작위 적 선원에게 1 피해를 두 번.',
    onPlay: (g) => { for (let i = 0; i < 2; i++) { const t = g.randomFoeCrew(); if (t) g.damageCrew(t.uid, 1); } },
  },
  bigbounce: {
    name: '대반동', type: 'tactic', cost: 3, art: '💫',
    text: '아군 선원 모두 탄력 +1. 카드 1장을 뽑는다.',
    effect: (g) => { g.tensionAll(1); g.draw(1); },
  },
  octoarm: { name: '여덟팔 곡예왕', type: 'crew', cost: 7, atk: 5, hp: 6, art: '😎', arm: true, keywords: ['reach', 'elastic', 'tension'], text: '' },

  // ── 유령선단 ──
  wisp: { name: '도깨비불', type: 'crew', cost: 1, atk: 1, hp: 1, art: '🕯️', keywords: ['ghost'], text: '' },
  bones: { name: '해골 갑판원', type: 'crew', cost: 2, atk: 1, hp: 1, art: '💀', keywords: ['ghost'], text: '' },
  haunt: { name: '원혼 수부', type: 'crew', cost: 3, atk: 2, hp: 1, art: '👻', keywords: ['ghost'], text: '' },
  lantern: {
    name: '등불 무녀', type: 'crew', cost: 3, atk: 1, hp: 3, art: '🏮',
    text: '등장: 카드 1장을 뽑는다. 유언: 카드 1장을 뽑는다.',
    onPlay: (g) => g.draw(1),
    onDeath: (g) => g.draw(1),
  },
  shroud: { name: '수의 경비병', type: 'crew', cost: 5, atk: 1, hp: 4, art: '🧟', keywords: ['guard', 'ghost'], text: '' },
  banshee: {
    name: '비명 망령', type: 'crew', cost: 4, atk: 3, hp: 3, art: '😱',
    text: '유언: 모든 적 선원에게 1 피해.',
    onDeath: (g) => g.damageAllFoes(1),
  },
  phantom: {
    name: '유령 선장', type: 'crew', cost: 6, atk: 4, hp: 3, art: '☠️', keywords: ['ghost'],
    text: '등장: 무작위 적 선원에게 2 피해.',
    onPlay: (g) => { const t = g.randomFoeCrew(); if (t) g.damageCrew(t.uid, 2); },
  },
  spirit: { name: '떠도는 혼', type: 'crew', cost: 1, atk: 1, hp: 1, art: '👤', keywords: ['ghost'], token: true, text: '' },
  curse: {
    name: '저주의 인형', type: 'tactic', cost: 2, art: '🪆', target: 'foeCrew',
    text: '적 선원 하나의 공격력 -2. 카드 1장을 뽑는다.',
    effect: (g, t) => { g.buff(t, -2, 0); g.draw(1); },
  },
  seance: {
    name: '강령술', type: 'tactic', cost: 4, art: '🔮',
    text: '떠도는 혼(1/1 망령)을 2명 불러낸다.',
    effect: (g) => g.summon('spirit', 2),
  },

  // ── 불꽃 요리단 ──
  ember: { name: '불씨 견습생', type: 'crew', cost: 1, atk: 1, hp: 2, art: '🔥', keywords: ['scorch'], text: '' },
  spicy: {
    name: '고추 투척수', type: 'crew', cost: 2, atk: 2, hp: 3, art: '🌶️',
    text: '등장: 무작위 적 선원에게 불을 붙인다.',
    onPlay: (g) => { const t = g.randomFoeCrew(); if (t) g.burn(t.uid); },
  },
  cook: {
    name: '해적 요리사', type: 'crew', cost: 3, atk: 2, hp: 3, art: '🧑‍🍳',
    text: '등장: 내 배의 선체를 3 회복한다.',
    onPlay: (g) => g.healShip(3),
  },
  flambe: { name: '플람베 검객', type: 'crew', cost: 3, atk: 3, hp: 4, art: '🍳', keywords: ['scorch'], text: '' },
  grill: {
    name: '화로 수호자', type: 'crew', cost: 4, atk: 2, hp: 5, art: '♨️', keywords: ['guard'],
    text: '등장: 무작위 적 선원에게 불을 붙인다.',
    onPlay: (g) => { const t = g.randomFoeCrew(); if (t) g.burn(t.uid); },
  },
  inferno: {
    name: '화염 주방장', type: 'crew', cost: 6, atk: 5, hp: 6, art: '👹', keywords: ['scorch'],
    text: '등장: 모든 적 선원에게 불을 붙인다.',
    onPlay: (g) => g.burnAllFoes(),
  },
  feast: {
    name: '해적 만찬', type: 'tactic', cost: 3, art: '🍖',
    text: '아군 선원 모두 체력 +1. 내 배의 선체를 3 회복한다.',
    effect: (g) => { g.buffAll(0, 1); g.healShip(3); },
  },
  firebomb: {
    name: '화염병', type: 'tactic', cost: 2, art: '🍾', target: 'foeCrew',
    text: '적 선원 하나에게 2 피해를 주고 불을 붙인다.',
    effect: (g, t) => { g.damageCrew(t, 2); g.burn(t); },
  },
  hotpot: {
    name: '펄펄 끓는 냄비', type: 'tactic', cost: 5, art: '🍲',
    text: '모든 적 선원에게 1 피해를 주고 불을 붙인다.',
    effect: (g) => { g.damageAllFoes(1); g.burnAllFoes(); },
  },

  // ── 정글 원숭이단 ──
  chimp: { name: '장난꾸러기 원숭이', type: 'crew', cost: 1, atk: 1, hp: 1, art: '🐒', keywords: ['charge'], text: '' },
  monkey: { name: '꼬마 원숭이', type: 'crew', cost: 1, atk: 1, hp: 1, art: '🐵', keywords: ['charge'], token: true, text: '' },
  banana: {
    name: '바나나 상인', type: 'crew', cost: 2, atk: 1, hp: 2, art: '🍌',
    text: '등장: 꼬마 원숭이(1/1 돌격) 1마리를 부른다.',
    onPlay: (g) => g.summon('monkey', 1),
  },
  vine: { name: '덩굴 타는 약탈꾼', type: 'crew', cost: 3, atk: 3, hp: 2, art: '🌿', keywords: ['sneak'], text: '' },
  tamer: {
    name: '원숭이 조련사', type: 'crew', cost: 3, atk: 2, hp: 3, art: '🎩',
    text: '등장: 다른 아군 선원 모두에게 공격력 +1.',
    onPlay: (g, self) => { g.buffAll(1, 0); g.buff(self.uid, -1, 0); },
  },
  gorilla: { name: '고릴라 갑판장', type: 'crew', cost: 4, atk: 4, hp: 5, art: '🦍', text: '' },
  kingkong: {
    name: '원숭이 왕', type: 'crew', cost: 7, atk: 5, hp: 6, art: '👑',
    text: '등장: 꼬마 원숭이(1/1 돌격) 2마리를 부른다.',
    onPlay: (g) => g.summon('monkey', 2),
  },
  troop: {
    name: '원숭이 떼', type: 'tactic', cost: 3, art: '🙈',
    text: '꼬마 원숭이(1/1 돌격) 3마리를 부른다.',
    effect: (g) => g.summon('monkey', 3),
  },
  bananapeel: {
    name: '바나나 껍질', type: 'tactic', cost: 1, art: '🥴', target: 'foeCrew',
    text: '적 선원 하나는 미끄러져 다음 턴에 공격할 수 없다.',
    effect: (g, t) => g.freeze(t),
  },
  drum: {
    name: '정글 북소리', type: 'tactic', cost: 2, art: '🥁',
    text: '아군 선원 모두에게 공격력 +1, 체력 +1.',
    effect: (g) => g.buffAll(1, 1),
  },

  // ── 태엽 기계단 ──
  cog: { name: '톱니 일꾼', type: 'crew', cost: 1, atk: 0, hp: 1, art: '⚙️', keywords: ['grow'], text: '' },
  windup: { name: '태엽 쥐', type: 'crew', cost: 2, atk: 1, hp: 1, art: '🐭', keywords: ['grow'], text: '' },
  piston: { name: '피스톤 권투봇', type: 'crew', cost: 3, atk: 1, hp: 3, art: '🤖', keywords: ['grow'], text: '' },
  turret: { name: '증기 포탑', type: 'crew', cost: 5, atk: 1, hp: 4, art: '🗼', keywords: ['guard', 'grow'], text: '' },
  tinker: {
    name: '땜장이', type: 'crew', cost: 3, atk: 2, hp: 2, art: '🛠️',
    text: '등장: 무작위 다른 아군 선원에게 공격력 +2, 체력 +2.',
    onPlay: (g, self) => { const t = g.randomAllyCrew(self.uid); if (t) g.buff(t.uid, 2, 2); },
  },
  golem: { name: '강철 골렘', type: 'crew', cost: 6, atk: 3, hp: 5, art: '🦾', keywords: ['grow'], text: '' },
  oil: {
    name: '기름칠', type: 'tactic', cost: 1, art: '🧴', target: 'allyCrew',
    text: '아군 선원 하나에게 공격력 +1, 체력 +1. 카드 1장을 뽑는다.',
    effect: (g, t) => { g.buff(t, 1, 1); g.draw(1); },
  },
  overclock: {
    name: '과부하', type: 'tactic', cost: 3, art: '⚡', target: 'allyCrew',
    text: '아군 선원 하나에게 공격력 +3. 이번 턴에 바로 공격할 수 있다.',
    effect: (g, t) => { g.buff(t, 3, 0); g.ready(t); },
  },
  blueprint: {
    name: '설계도', type: 'tactic', cost: 2, art: '📐',
    text: '카드 2장을 뽑는다. 내 배에 2 피해.',
    effect: (g) => { g.draw(2); g.damageMyShip(2); },
  },
};

export const FACTIONS = {
  stretch: {
    name: '고무팔 곡예단',
    emblem: '🤸',
    desc: '고무팔을 쭉 뻗어 여러 적을 한꺼번에 후려치고, 팔을 당겨 모은 탄력으로 한 방을 노린다.',
    deck: { deckhand: 1, rookie: 3, boxer: 3, whip: 2, balloon: 2, spring: 2, catapult: 2, pinball: 1, rubberwall: 1, ringmaster: 1, octoarm: 1, slingshot: 2, grab: 2, bigbounce: 1 },
  },
  red: {
    name: '붉은 돛 해적단',
    emblem: '🏴‍☠️',
    desc: '공격형. 돌격과 약탈로 빠르게 보물을 턴다.',
    deck: { deckhand: 2, lookout: 1, cutlass: 3, powder: 2, duelist: 2, gunner: 2, raider: 3, redbeard: 2, raid: 2, cannon: 1, rum: 2, grog: 1, bounty: 1 },
  },
  deep: {
    name: '심해 함대',
    emblem: '🐙',
    desc: '수비형. 수호 선원으로 버티고 거대한 함장으로 누른다.',
    deck: { deckhand: 1, lookout: 2, jelly: 2, sentinel: 3, harpoon: 2, pearl: 1, tide: 2, turtle: 2, abyss: 1, anchor: 2, volley: 1, tsunami: 1, cannon: 1, repair: 2, map: 1 },
  },
  ghost: {
    name: '유령선단',
    emblem: '👻',
    desc: '끈질긴형. 쓰러져도 망령으로 다시 일어나고, 쓰러질 때 유언을 남긴다.',
    deck: { wisp: 3, bones: 3, haunt: 3, lantern: 2, shroud: 2, banshee: 2, phantom: 2, curse: 2, seance: 2, barrel: 2, chest: 1 },
  },
  flame: {
    name: '불꽃 요리단',
    emblem: '🔥',
    desc: '지속 피해형. 적에게 불을 붙여 매 턴 태우고, 요리로 배를 고친다.',
    deck: { ember: 3, spicy: 3, cook: 2, flambe: 3, grill: 2, inferno: 2, feast: 2, firebomb: 3, hotpot: 1, parrot: 2, broadside: 1 },
  },
  monkey: {
    name: '정글 원숭이단',
    emblem: '🐒',
    desc: '물량형. 원숭이 떼를 불러 갑판을 채우고 한꺼번에 강해진다.',
    deck: { chimp: 3, banana: 3, vine: 3, tamer: 2, gorilla: 2, kingkong: 1, troop: 2, bananapeel: 2, drum: 2, parrot: 2, flag: 1, kraken: 1 },
  },
  clock: {
    name: '태엽 기계단',
    emblem: '⚙️',
    desc: '성장형. 약하게 시작하지만 턴마다 태엽이 감겨 점점 강해진다.',
    deck: { cog: 3, windup: 3, piston: 3, turret: 2, tinker: 2, golem: 2, oil: 2, overclock: 2, blueprint: 2, carpenter: 2, maelstrom: 1 },
  },
};
