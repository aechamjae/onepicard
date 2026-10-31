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
  lifesteal: { name: '흡혈', desc: '이 선원이 준 피해만큼 내 배의 선체를 회복한다.' },
  double: { name: '연타', desc: '한 턴에 두 번 공격할 수 있다.' },
  shield: { name: '보호막', desc: '처음 받는 피해 한 번을 막아 낸다.' },
  thorns: { name: '가시', desc: '이 선원을 공격한 선원은 1 피해를 더 받는다.' },
  stealth: { name: '안개', desc: '먼저 공격하기 전까지는 공격이나 대상 지정 카드로 고를 수 없다.' },
  grow: { name: '성장', desc: '내 턴이 끝날 때마다 공격력 +1, 체력 +1 (최대 2번).' },
  slash: { name: '일섬', desc: '적 선원을 공격할 때 반격 피해(가시 포함)를 받지 않는다.' },
  tailwind: { name: '순풍', desc: '이 카드를 내면 이번 턴에 다음으로 내는 카드의 비용이 1 줄어든다.' },
  submerge: { name: '잠항', desc: '낸 뒤 내 다음 턴이 올 때까지 바닷속에 숨어, 공격이나 대상 지정 카드로 고를 수 없다.' },
  resonance: { name: '공명', desc: '내가 전술 카드를 쓸 때마다 공격력 +1 (최대 2번).' },
  trade: { name: '거래', desc: '낼 때 보물이 있으면 1개를 자동으로 써서 카드에 적힌 추가 효과를 낸다.' },
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
  fogscout: { name: '안개 척후병', type: 'crew', cost: 2, atk: 2, hp: 2, art: '🌫️', keywords: ['stealth'], text: '' },
  puffer: { name: '가시복어 선원', type: 'crew', cost: 3, atk: 2, hp: 4, art: '🐡', keywords: ['thorns'], text: '' },
  twins: { name: '쌍칼 쌍둥이', type: 'crew', cost: 4, atk: 2, hp: 4, art: '👯', keywords: ['double'], text: '' },
  bat: { name: '흡혈 박쥐', type: 'crew', cost: 2, atk: 2, hp: 1, art: '🦇', keywords: ['lifesteal', 'charge'], text: '' },
  amulet: {
    name: '방패 부적', type: 'tactic', cost: 1, art: '🧿', target: 'allyCrew',
    text: '아군 선원 하나에게 보호막을 씌운다. 카드 1장을 뽑는다.',
    effect: (g, t) => { g.shield(t); g.draw(1); },
  },
  kraken: { name: '길들인 대왕문어', type: 'crew', cost: 8, atk: 7, hp: 8, art: '🦑', keywords: ['guard'], text: '' },

  // ── 붉은 돛 해적단 ──
  cutlass: { name: '칼잡이 돌격대', type: 'crew', cost: 2, atk: 2, hp: 3, art: '🗡️', keywords: ['charge'], text: '' },
  powder: {
    name: '화약통 폭파범', type: 'crew', cost: 3, atk: 3, hp: 3, art: '🧨',
    text: '등장: 무작위 적 선원에게 2 피해.',
    onPlay: (g) => { const t = g.randomFoeCrew(); if (t) g.damageCrew(t.uid, 2); },
  },
  duelist: { name: '쌍검 항해사', type: 'crew', cost: 3, atk: 4, hp: 3, art: '⚔️', text: '' },
  raider: { name: '갈고리 약탈꾼', type: 'crew', cost: 4, atk: 4, hp: 4, art: '🪝', keywords: ['plunder', 'sneak'], text: '' },
  raid: {
    name: '기습 약탈', type: 'tactic', cost: 2, art: '🏴‍☠️',
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
  shadowthief: { name: '그림자 도둑', type: 'crew', cost: 3, atk: 3, hp: 2, art: '🥷', keywords: ['stealth', 'plunder'], text: '' },
  redbeard: { name: '붉은 수염 제독', type: 'crew', cost: 5, atk: 5, hp: 5, art: '🦜', keywords: ['charge', 'plunder', 'sneak'], text: '' },

  // ── 심해 함대 ──
  sentinel: { name: '심해 경비병', type: 'crew', cost: 2, atk: 2, hp: 4, art: '🛡️', keywords: ['guard'], text: '' },
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
  turtle: { name: '거북 철갑선', type: 'crew', cost: 5, atk: 4, hp: 7, art: '🐢', keywords: ['guard'], text: '' },
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
  urchin: { name: '성게 수호병', type: 'crew', cost: 3, atk: 1, hp: 5, art: '🦔', keywords: ['guard', 'thorns'], text: '' },
  abyss: {
    name: '심연의 함장', type: 'crew', cost: 7, atk: 6, hp: 8, art: '🐙',
    text: '내 턴이 끝날 때 보물 1개를 얻는다.',
    onTurnEnd: (g) => g.gainTreasure(1),
  },

  // ── 고무팔 해적단 ── (arm: true 인 카드는 늘어나는 팔 그림으로 그린다)
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
  bubble: { name: '고무 거품 기사', type: 'crew', cost: 2, atk: 1, hp: 2, art: '🫧', keywords: ['shield', 'elastic'], text: '' },
  doublepunch: { name: '쌍고무주먹 챔피언', type: 'crew', cost: 5, atk: 3, hp: 4, art: '🥊', arm: true, keywords: ['double', 'elastic'], text: '' },
  octoarm: { name: '여덟팔 곡예왕', type: 'crew', cost: 7, atk: 5, hp: 6, art: '😎', arm: true, keywords: ['reach', 'elastic', 'tension'], text: '' },

  // ── 유령선단 ──
  wisp: { name: '도깨비불', type: 'crew', cost: 1, atk: 1, hp: 1, art: '🕯️', keywords: ['ghost'], text: '' },
  bones: { name: '해골 갑판원', type: 'crew', cost: 2, atk: 2, hp: 2, art: '💀', keywords: ['ghost'], text: '' },
  haunt: { name: '원혼 수부', type: 'crew', cost: 3, atk: 2, hp: 2, art: '👻', keywords: ['ghost'], text: '' },
  lantern: {
    name: '등불 무녀', type: 'crew', cost: 3, atk: 1, hp: 3, art: '🏮',
    text: '등장: 카드 1장을 뽑는다. 유언: 카드 1장을 뽑는다.',
    onPlay: (g) => g.draw(1),
    onDeath: (g) => g.draw(1),
  },
  shroud: { name: '수의 경비병', type: 'crew', cost: 4, atk: 2, hp: 4, art: '🧟', keywords: ['guard', 'ghost'], text: '' },
  banshee: {
    name: '비명 망령', type: 'crew', cost: 4, atk: 3, hp: 3, art: '😱',
    text: '유언: 모든 적 선원에게 1 피해.',
    onDeath: (g) => g.damageAllFoes(1),
  },
  phantom: {
    name: '유령 선장', type: 'crew', cost: 6, atk: 4, hp: 4, art: '☠️', keywords: ['ghost'],
    text: '등장: 무작위 적 선원에게 2 피해.',
    onPlay: (g) => { const t = g.randomFoeCrew(); if (t) g.damageCrew(t.uid, 2); },
  },
  vampire: { name: '흡혈 귀족', type: 'crew', cost: 5, atk: 4, hp: 4, art: '🧛', keywords: ['lifesteal', 'ghost'], text: '' },
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
    name: '고추 투척수', type: 'crew', cost: 2, atk: 2, hp: 2, art: '🌶️',
    text: '등장: 무작위 적 선원에게 불을 붙인다.',
    onPlay: (g) => { const t = g.randomFoeCrew(); if (t) g.burn(t.uid); },
  },
  cook: {
    name: '해적 요리사', type: 'crew', cost: 3, atk: 2, hp: 3, art: '🧑‍🍳',
    text: '등장: 내 배의 선체를 3 회복한다.',
    onPlay: (g) => g.healShip(3),
  },
  flambe: { name: '플람베 검객', type: 'crew', cost: 3, atk: 3, hp: 3, art: '🍳', keywords: ['scorch'], text: '' },
  grill: {
    name: '화로 수호자', type: 'crew', cost: 4, atk: 2, hp: 5, art: '♨️', keywords: ['guard'],
    text: '등장: 무작위 적 선원에게 불을 붙인다.',
    onPlay: (g) => { const t = g.randomFoeCrew(); if (t) g.burn(t.uid); },
  },
  inferno: {
    name: '화염 주방장', type: 'crew', cost: 6, atk: 5, hp: 5, art: '👹', keywords: ['scorch'],
    text: '등장: 모든 적 선원에게 불을 붙인다.',
    onPlay: (g) => g.burnAllFoes(),
  },
  twinflame: { name: '쌍불 요리사', type: 'crew', cost: 4, atk: 2, hp: 3, art: '🔥', keywords: ['double', 'scorch'], text: '' },
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
  chimp: { name: '장난꾸러기 원숭이', type: 'crew', cost: 1, atk: 1, hp: 2, art: '🐒', keywords: ['charge'], text: '' },
  monkey: { name: '꼬마 원숭이', type: 'crew', cost: 1, atk: 1, hp: 1, art: '🐵', keywords: ['charge'], token: true, text: '' },
  banana: {
    name: '바나나 상인', type: 'crew', cost: 2, atk: 2, hp: 3, art: '🍌',
    text: '등장: 꼬마 원숭이(1/1 돌격) 1마리를 부른다.',
    onPlay: (g) => g.summon('monkey', 1),
  },
  vine: { name: '덩굴 타는 약탈꾼', type: 'crew', cost: 3, atk: 3, hp: 2, art: '🌿', keywords: ['sneak'], text: '' },
  fogmonkey: { name: '안개 원숭이', type: 'crew', cost: 2, atk: 2, hp: 1, art: '🙊', keywords: ['stealth'], text: '' },
  tamer: {
    name: '원숭이 조련사', type: 'crew', cost: 3, atk: 2, hp: 3, art: '🎩',
    text: '등장: 다른 아군 선원 모두에게 공격력 +1.',
    onPlay: (g, self) => { g.buffAll(1, 0); g.buff(self.uid, -1, 0); },
  },
  gorilla: { name: '고릴라 갑판장', type: 'crew', cost: 4, atk: 4, hp: 6, art: '🦍', text: '' },
  kingkong: {
    name: '원숭이 왕', type: 'crew', cost: 7, atk: 6, hp: 6, art: '👑',
    text: '등장: 꼬마 원숭이(1/1 돌격) 2마리를 부른다.',
    onPlay: (g) => g.summon('monkey', 2),
  },
  troop: {
    name: '원숭이 떼', type: 'tactic', cost: 3, art: '🙈',
    text: '꼬마 원숭이(1/1 돌격) 2마리를 부른다.',
    effect: (g) => g.summon('monkey', 2),
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
  piston: { name: '피스톤 권투봇', type: 'crew', cost: 3, atk: 1, hp: 2, art: '🤖', keywords: ['grow'], text: '' },
  turret: { name: '증기 포탑', type: 'crew', cost: 5, atk: 1, hp: 4, art: '🗼', keywords: ['guard', 'grow'], text: '' },
  tinker: {
    name: '땜장이', type: 'crew', cost: 3, atk: 2, hp: 2, art: '🛠️',
    text: '등장: 무작위 다른 아군 선원에게 공격력 +2, 체력 +2.',
    onPlay: (g, self) => { const t = g.randomAllyCrew(self.uid); if (t) g.buff(t.uid, 2, 2); },
  },
  shielddrone: { name: '방패 드론', type: 'crew', cost: 2, atk: 1, hp: 1, art: '🛸', keywords: ['shield', 'grow'], text: '' },
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

  // ── 떠돌이 검객단 ──
  prentice: { name: '견습 검객', type: 'crew', cost: 1, atk: 1, hp: 1, art: '🥋', keywords: ['slash'], text: '' },
  bamboo: { name: '죽도 검사', type: 'crew', cost: 2, atk: 2, hp: 1, art: '🎋', keywords: ['slash'], text: '' },
  iai: {
    name: '거합 검객', type: 'crew', cost: 3, atk: 2, hp: 2, art: '🗡️', keywords: ['slash'],
    text: '등장: 무작위 적 선원에게 1 피해.',
    onPlay: (g) => { const t = g.randomFoeCrew(); if (t) g.damageCrew(t.uid, 1); },
  },
  shieldsman: { name: '방패 검사', type: 'crew', cost: 3, atk: 2, hp: 4, art: '🛡️', keywords: ['guard'], text: '' },
  sensei: {
    name: '검술 사범', type: 'crew', cost: 4, atk: 3, hp: 3, art: '🧓',
    text: '등장: 무작위 다른 아군 선원 하나에게 공격력 +1과 일섬을 준다.',
    onPlay: (g, self) => { const t = g.randomAllyCrew(self.uid); if (t) { g.buff(t.uid, 1, 0); g.grant(t.uid, 'slash'); } },
  },
  gale: { name: '질풍 검호', type: 'crew', cost: 5, atk: 3, hp: 2, art: '💨', keywords: ['charge', 'slash'], text: '' },
  nitoryu: { name: '이도류 낭인', type: 'crew', cost: 5, atk: 2, hp: 3, art: '⚔️', keywords: ['double', 'slash'], text: '' },
  swordsaint: {
    name: '전설의 검성', type: 'crew', cost: 7, atk: 5, hp: 6, art: '🏯', keywords: ['slash'],
    text: '등장: 체력이 가장 낮은 적 선원 하나를 단칼에 벤다.',
    onPlay: (g) => {
      const list = g.foe.board.filter((c) => !c.stealth).sort((a, b) => a.hp - b.hp);
      if (list.length) g.slay(list[0].uid);
    },
  },
  slashcut: {
    name: '참격', type: 'tactic', cost: 2, art: '💢', target: 'foeCrew',
    text: '적 선원 하나에게 2 피해. 그 선원이 쓰러지면 카드 1장을 뽑는다.',
    effect: (g, t) => { g.damageCrew(t, 2); if (!g.isAlive(t)) g.draw(1); },
  },
  meditate: {
    name: '정신 수양', type: 'tactic', cost: 1, art: '🧘', target: 'allyCrew',
    text: '아군 선원 하나에게 체력 +2. 카드 1장을 뽑는다.',
    effect: (g, t) => { g.buff(t, 0, 2); g.draw(1); },
  },
  bladestorm: {
    name: '검기 폭풍', type: 'tactic', cost: 5, art: '✴️',
    text: '모든 적 선원에게 2 피해.',
    effect: (g) => g.damageAllFoes(2),
  },

  // ── 항해사 길드 ──
  novice: { name: '견습 항해사', type: 'crew', cost: 1, atk: 1, hp: 2, art: '🧢', keywords: ['tailwind'], text: '' },
  surveyor: {
    name: '바다 측량사', type: 'crew', cost: 2, atk: 2, hp: 3, art: '📏',
    text: '등장: 카드 1장을 뽑는다.',
    onPlay: (g) => g.draw(1),
  },
  sailmender: { name: '돛 수선공', type: 'crew', cost: 2, atk: 2, hp: 4, art: '🪡', keywords: ['tailwind'], text: '' },
  compass: {
    name: '나침반 점술가', type: 'crew', cost: 3, atk: 2, hp: 3, art: '🧭', keywords: ['tailwind'],
    text: '등장: 카드 1장을 뽑는다.',
    onPlay: (g) => g.draw(1),
  },
  lighthouse: { name: '등대지기', type: 'crew', cost: 4, atk: 2, hp: 6, art: '🗼', keywords: ['guard'], text: '' },
  shortcut: { name: '지름길 항해사', type: 'crew', cost: 4, atk: 3, hp: 4, art: '🛶', keywords: ['sneak', 'tailwind'], text: '' },
  guildmaster: {
    name: '길드 마스터', type: 'crew', cost: 6, atk: 4, hp: 6, art: '🎓',
    text: '등장: 카드 2장을 뽑는다.',
    onPlay: (g) => g.draw(2),
  },
  admiral: {
    name: '대항해 제독', type: 'crew', cost: 7, atk: 5, hp: 6, art: '⛵',
    text: '등장: 공격력이 가장 높은 적 선원 하나를 상대 손패로 되돌린다.',
    onPlay: (g) => {
      const list = g.foe.board.filter((c) => !c.stealth).sort((a, b) => b.atk - a.atk);
      if (list.length) g.bounce(list[0].uid);
    },
  },
  unfurl: {
    name: '돛 펼치기', type: 'tactic', cost: 1, art: '🪁', keywords: ['tailwind'],
    text: '카드 1장을 뽑는다.',
    effect: (g) => g.draw(1),
  },
  headwind: {
    name: '역풍', type: 'tactic', cost: 2, art: '🌬️', target: 'foeCrew',
    text: '적 선원 하나를 상대 손패로 되돌린다.',
    effect: (g, t) => g.bounce(t),
  },

  // ── 황금 상인조합 ──
  pennykid: {
    name: '동전 줍는 꼬마', type: 'crew', cost: 1, atk: 1, hp: 2, art: '🪙',
    text: '등장: 보물 1개를 얻는다.',
    onPlay: (g) => g.gainTreasure(1),
  },
  bodyguard: {
    name: '고용 경호원', type: 'crew', cost: 2, atk: 2, hp: 4, art: '🕴️', keywords: ['guard', 'trade'],
    text: '거래: 체력 +2.',
    onPlay: (g, self) => { if (g.trade()) g.buff(self.uid, 0, 2); },
  },
  shady: {
    name: '수상한 행상', type: 'crew', cost: 2, atk: 2, hp: 3, art: '🧳', keywords: ['trade'],
    text: '거래: 카드 2장을 뽑는다.',
    onPlay: (g) => { if (g.trade()) g.draw(2); },
  },
  mercenary: {
    name: '금화 용병', type: 'crew', cost: 3, atk: 3, hp: 3, art: '💂', keywords: ['trade'],
    text: '거래: 수호를 얻는다.',
    onPlay: (g, self) => { if (g.trade()) g.grant(self.uid, 'guard'); },
  },
  usurer: {
    name: '고리대금업자', type: 'crew', cost: 3, atk: 2, hp: 4, art: '🤑',
    text: '내 턴이 끝날 때 보물 1개를 얻는다.',
    onTurnEnd: (g) => g.gainTreasure(1),
  },
  armsdealer: {
    name: '무기 밀매상', type: 'crew', cost: 4, atk: 3, hp: 4, art: '🏹', keywords: ['trade'],
    text: '거래: 적 배에 2 피해.',
    onPlay: (g) => { if (g.trade()) g.damageFoeShip(2); },
  },
  vaultkeeper: {
    name: '금고지기', type: 'crew', cost: 5, atk: 3, hp: 7, art: '🏦', keywords: ['guard', 'trade'],
    text: '거래: 공격력 +3.',
    onPlay: (g, self) => { if (g.trade()) g.buff(self.uid, 3, 0); },
  },
  goldcaptain: {
    name: '황금 선장', type: 'crew', cost: 7, atk: 4, hp: 6, art: '🤴',
    text: '등장: 보물을 최대 4개 써서, 쓴 만큼 공격력·체력이 오른다.',
    onPlay: (g, self) => {
      let n = 0;
      while (n < 4 && g.trade()) n++;
      if (n) g.buff(self.uid, n, n);
    },
  },
  goldrain: {
    name: '금화 세례', type: 'tactic', cost: 2, art: '💸', keywords: ['trade'],
    text: '아군 선원 모두 공격력 +1. 거래: 체력도 +1.',
    effect: (g) => { g.buffAll(1, g.trade() ? 1 : 0); },
  },
  buyout: {
    name: '용병 매수', type: 'tactic', cost: 3, art: '🤝', target: 'foeCrew', keywords: ['trade'],
    text: '적 선원 하나에게 2 피해. 거래: 대신 공격력 4 이하인 그 선원을 내 편으로 데려온다.',
    effect: (g, t) => {
      const c = g.foe.board.find((c) => c.uid === t);
      if (c && c.atk <= 4 && g.me.treasure > 0 && g.me.board.length < 5 && g.trade() && g.steal(t)) return;
      g.damageCrew(t, 2);
    },
  },
  insurance: {
    name: '해상 보험', type: 'tactic', cost: 2, art: '📑', keywords: ['trade'],
    text: '내 배의 선체를 4 회복한다. 거래: 카드 1장을 뽑는다.',
    effect: (g) => { g.healShip(4); if (g.trade()) g.draw(1); },
  },

  // ── 잠수함 외과단 ──
  intern: { name: '수습 의사', type: 'crew', cost: 1, atk: 2, hp: 2, art: '🧑‍⚕️', keywords: ['submerge'], text: '' },
  engineer: { name: '잠수함 기관사', type: 'crew', cost: 2, atk: 3, hp: 3, art: '🔩', keywords: ['submerge'], text: '' },
  headnurse: {
    name: '간호장', type: 'crew', cost: 2, atk: 2, hp: 3, art: '💉',
    text: '등장: 내 배의 선체를 3 회복한다.',
    onPlay: (g) => g.healShip(3),
  },
  walrus: { name: '바다코끼리 조타수', type: 'crew', cost: 3, atk: 3, hp: 5, art: '🦭', keywords: ['guard'], text: '' },
  sedative: {
    name: '마취 저격수', type: 'crew', cost: 3, atk: 2, hp: 3, art: '🎯',
    text: '등장: 공격력이 가장 높은 적 선원 하나는 다음 턴에 공격할 수 없다.',
    onPlay: (g) => {
      const list = g.foe.board.filter((c) => !c.stealth && !c.submerged).sort((a, b) => b.atk - a.atk);
      if (list.length) g.freeze(list[0].uid);
    },
  },
  incisor: {
    name: '절개 검객', type: 'crew', cost: 4, atk: 3, hp: 4, art: '🔪', keywords: ['submerge'],
    text: '등장: 공격력이 가장 높은 적 선원 하나의 공격력과 체력을 뒤바꾸고 1 피해.',
    onPlay: (g) => {
      const list = g.foe.board.filter((c) => !c.stealth && !c.submerged).sort((a, b) => b.atk - a.atk);
      if (list.length) { g.swapStats(list[0].uid); g.damageCrew(list[0].uid, 1); }
    },
  },
  torpedo: { name: '잠수함 포수', type: 'crew', cost: 5, atk: 5, hp: 5, art: '🚤', keywords: ['submerge'], text: '' },
  chiefsurgeon: {
    name: '수석 집도의', type: 'crew', cost: 7, atk: 5, hp: 6, art: '🫀', keywords: ['submerge'],
    text: '등장: 모든 적 선원의 공격력과 체력을 뒤바꾼다.',
    onPlay: (g) => g.foe.board.map((c) => c.uid).forEach((uid) => g.swapStats(uid)),
  },
  takt: {
    name: '텍트', type: 'tactic', cost: 2, art: '🛘', target: 'foeCrew',
    text: '적 선원 하나에게 3 피해.',
    effect: (g, t) => g.damageCrew(t, 3),
  },
  incision: {
    name: '공간 절개', type: 'tactic', cost: 2, art: '✂️', target: 'foeCrew',
    text: '적 선원 하나의 공격력과 체력을 뒤바꾸고 1 피해.',
    effect: (g, t) => { g.swapStats(t); g.damageCrew(t, 1); },
  },
  transplant: {
    name: '장기 이식', type: 'tactic', cost: 1, art: '🫁', target: 'allyCrew',
    text: '아군 선원 하나의 공격력과 체력을 뒤바꾼다. 카드 1장을 뽑는다.',
    effect: (g, t) => { g.swapStats(t); g.draw(1); },
  },
  surgery: {
    name: '응급 수술', type: 'tactic', cost: 2, art: '🩹', target: 'allyCrew',
    text: '아군 선원 하나의 체력을 모두 회복하고 보호막을 씌운다.',
    effect: (g, t) => { const c = g.me.board.find((c) => c.uid === t); if (c) c.hp = c.maxHp; g.shield(t); },
  },

  // ── 폭풍 주술단 ──
  spark: {
    name: '번개 조각', type: 'tactic', cost: 0, art: '⚡', token: true,
    text: '무작위 적 선원에게 1 피해. 적 선원이 없으면 적 배에 1 피해.',
    effect: (g) => { const t = g.randomFoeCrew(); if (t) g.damageCrew(t.uid, 1); else g.damageFoeShip(1); },
  },
  breeze: { name: '바람 견습생', type: 'crew', cost: 1, atk: 1, hp: 2, art: '🌀', keywords: ['resonance'], text: '' },
  cloud: {
    name: '구름 술사', type: 'crew', cost: 2, atk: 1, hp: 3, art: '☁️', keywords: ['resonance'],
    text: '등장: 번개 조각 1장을 손에 넣는다.',
    onPlay: (g) => g.addToHand('spark', 1),
  },
  wavepriest: { name: '파도 무녀', type: 'crew', cost: 3, atk: 1, hp: 5, art: '🌊', keywords: ['guard', 'resonance'], text: '' },
  drummer: { name: '천둥 고수', type: 'crew', cost: 3, atk: 2, hp: 3, art: '🥁', keywords: ['resonance'], text: '' },
  stormcaller: {
    name: '폭풍 주술사', type: 'crew', cost: 4, atk: 3, hp: 4, art: '🧙', keywords: ['resonance'],
    text: '등장: 카드 1장을 뽑는다.',
    onPlay: (g) => g.draw(1),
  },
  twister: {
    name: '회오리 마녀', type: 'crew', cost: 5, atk: 4, hp: 4, art: '🌪️',
    text: '등장: 모든 적 선원에게 1 피해.',
    onPlay: (g) => g.damageAllFoes(1),
  },
  stormlord: {
    name: '폭풍의 군주', type: 'crew', cost: 7, atk: 5, hp: 6, art: '🌩️', keywords: ['resonance'],
    text: '등장: 번개 조각 3장을 손에 넣는다.',
    onPlay: (g) => g.addToHand('spark', 3),
  },
  bolt: {
    name: '낙뢰', type: 'tactic', cost: 3, art: '🌩️', target: 'foeCrew',
    text: '적 선원 하나에게 3 피해.',
    effect: (g, t) => g.damageCrew(t, 3),
  },
  windread: {
    name: '바람결 읽기', type: 'tactic', cost: 1, art: '🍃',
    text: '카드 1장을 뽑는다.',
    effect: (g) => g.draw(1),
  },
  static: {
    name: '정전기', type: 'tactic', cost: 1, art: '✨', target: 'allyCrew',
    text: '아군 선원 하나에게 공격력 +2.',
    effect: (g, t) => g.buff(t, 2, 0),
  },
  downpour: {
    name: '폭풍우', type: 'tactic', cost: 5, art: '⛈️',
    text: '모든 적 선원에게 2 피해.',
    effect: (g) => g.damageAllFoes(2),
  },
};

// skill: 선장 스킬. 한 턴에 한 번, 바람을 써서 쓴다.
export const FACTIONS = {
  stretch: {
    name: '고무팔 해적단',
    emblem: '🤸',
    desc: '고무팔을 쭉 뻗어 여러 적을 한꺼번에 후려치고, 팔을 당겨 모은 탄력으로 한 방을 노린다.',
    skill: {
      name: '고무 펀치', art: '👊', cost: 2, target: 'foeCrew',
      text: '적 선원 하나에게 1 피해. 무작위 아군 선원 탄력 +1.',
      effect: (g, t) => { g.damageCrew(t, 1); const a = g.randomAllyCrew(); if (a) g.setTension(a.uid, Math.min(3, (a.tension || 0) + 1)); },
    },
    deck: { rookie: 2, bigbounce: 1, bubble: 2, boxer: 3, whip: 2, balloon: 2, spring: 2, catapult: 2, pinball: 1, rubberwall: 1, doublepunch: 1, ringmaster: 1, octoarm: 1, slingshot: 1, grab: 2 },
  },
  red: {
    name: '붉은 돛 해적단',
    emblem: '🏴‍☠️',
    desc: '공격형. 돌격과 약탈로 빠르게 보물을 턴다.',
    skill: {
      name: '포문 열어!', art: '💣', cost: 3,
      text: '적 배에 2 피해를 주고 보물 1개를 얻는다.',
      effect: (g) => { g.damageFoeShip(2); g.gainTreasure(1); },
    },
    deck: { deckhand: 1, bat: 1, cutlass: 3, powder: 2, duelist: 2, gunner: 2, shadowthief: 2, raider: 3, redbeard: 2, raid: 2, cannon: 1, rum: 1, grog: 1, bounty: 1 },
  },
  deep: {
    name: '심해 함대',
    emblem: '🐙',
    desc: '수비형. 수호 선원으로 버티고 거대한 함장으로 누른다.',
    skill: {
      name: '산호 갑옷', art: '🪸', cost: 2, target: 'allyCrew',
      text: '아군 선원 하나에게 체력 +2.',
      effect: (g, t) => g.buff(t, 0, 2),
    },
    deck: { lookout: 2, jelly: 2, sentinel: 2, urchin: 2, harpoon: 2, pearl: 1, tide: 2, puffer: 1, turtle: 2, abyss: 1, anchor: 2, volley: 1, tsunami: 1, cannon: 1, repair: 1, map: 1 },
  },
  ghost: {
    name: '유령선단',
    emblem: '👻',
    desc: '끈질긴형. 쓰러져도 망령으로 다시 일어나고, 쓰러질 때 유언을 남긴다.',
    skill: {
      name: '혼 부르기', art: '🕯️', cost: 2,
      text: '떠도는 혼(1/1 망령)을 1명 불러낸다.',
      effect: (g) => g.summon('spirit', 1),
    },
    deck: { wisp: 3, bones: 3, haunt: 3, lantern: 2, shroud: 2, banshee: 2, vampire: 1, phantom: 2, curse: 2, seance: 1, barrel: 1, chest: 1, fogscout: 1 },
  },
  flame: {
    name: '불꽃 요리단',
    emblem: '🔥',
    desc: '지속 피해형. 적에게 불을 붙여 매 턴 태우고, 요리로 배를 고친다.',
    skill: {
      name: '불씨 던지기', art: '🧯', cost: 2, target: 'foeCrew',
      text: '적 선원 하나에게 불을 붙인다.',
      effect: (g, t) => g.burn(t),
    },
    deck: { ember: 3, spicy: 3, cook: 2, flambe: 3, grill: 2, twinflame: 2, inferno: 2, feast: 1, firebomb: 3, hotpot: 1, parrot: 1, broadside: 1 },
  },
  monkey: {
    name: '정글 원숭이단',
    emblem: '🐒',
    desc: '물량형. 원숭이 떼를 불러 갑판을 채우고 한꺼번에 강해진다.',
    skill: {
      name: '휘파람', art: '🎶', cost: 3,
      text: '꼬마 원숭이(1/1 돌격) 1마리를 부른다.',
      effect: (g) => g.summon('monkey', 1),
    },
    deck: { chimp: 3, banana: 3, fogmonkey: 2, vine: 2, tamer: 2, gorilla: 2, twins: 1, kingkong: 1, troop: 2, bananapeel: 2, drum: 2, flag: 1, kraken: 1 },
  },
  clock: {
    name: '태엽 기계단',
    emblem: '⚙️',
    desc: '성장형. 약하게 시작하지만 턴마다 태엽이 감겨 점점 강해진다.',
    skill: {
      name: '태엽 감기', art: '🔑', cost: 2, target: 'allyCrew',
      text: '아군 선원 하나에게 공격력 +1.',
      effect: (g, t) => g.buff(t, 1, 0),
    },
    deck: { cog: 3, shielddrone: 2, windup: 2, piston: 3, turret: 2, tinker: 2, golem: 2, oil: 2, overclock: 2, blueprint: 1, amulet: 1, carpenter: 1, maelstrom: 1 },
  },
  swords: {
    name: '떠돌이 검객단',
    emblem: '⚔️',
    desc: '선원 싸움형. 일섬으로 반격 없이 적 선원을 하나씩 베어 갑판을 정리한다.',
    skill: {
      name: '칼 갈기', art: '🪨', cost: 2, target: 'allyCrew',
      text: '아군 선원 하나에게 일섬을 준다.',
      effect: (g, t) => g.grant(t, 'slash'),
    },
    deck: { prentice: 3, bamboo: 3, iai: 2, shieldsman: 2, sensei: 2, gale: 2, nitoryu: 1, swordsaint: 1, slashcut: 2, meditate: 2, bladestorm: 1, cannon: 1, rum: 1, lookout: 1 },
  },
  guild: {
    name: '항해사 길드',
    emblem: '🧭',
    desc: '유틸형. 순풍으로 비용을 깎고 카드를 많이 뽑아, 필요한 카드를 필요한 때 쓴다.',
    skill: {
      name: '해도 읽기', art: '🗺️', cost: 2,
      text: '카드 1장을 뽑는다.',
      effect: (g) => g.draw(1),
    },
    deck: { novice: 2, surveyor: 2, sailmender: 2, compass: 2, lighthouse: 2, shortcut: 2, guildmaster: 1, admiral: 1, unfurl: 2, headwind: 2, anchor: 1, cannon: 2, map: 1, rum: 1, repair: 1 },
  },
  surgeon: {
    name: '잠수함 외과단',
    emblem: '🩺',
    desc: '수술형. 잠항으로 숨어 있다가, 적 선원의 공격력과 체력을 뒤바꿔 무력하게 만든다.',
    skill: {
      name: '메스', art: '🔪', cost: 2, target: 'foeCrew',
      text: '적 선원 하나에게 1 피해. 무작위 아군 선원 체력 +1.',
      effect: (g, t) => { g.damageCrew(t, 1); const a = g.randomAllyCrew(); if (a) g.buff(a.uid, 0, 1); },
    },
    deck: { intern: 3, engineer: 2, headnurse: 2, walrus: 2, sedative: 2, incisor: 2, torpedo: 2, chiefsurgeon: 1, incision: 2, transplant: 2, surgery: 1, takt: 1, lookout: 1, repair: 1 },
  },
  storm: {
    name: '폭풍 주술단',
    emblem: '🌩️',
    desc: '주문형. 전술 카드를 쓸 때마다 공명하는 선원들이 점점 강해진다.',
    skill: {
      name: '바람 부르기', art: '🌬️', cost: 2,
      text: '번개 조각(0비용: 무작위 적 선원에게 1 피해) 1장을 손에 넣는다.',
      effect: (g) => g.addToHand('spark', 1),
    },
    deck: { breeze: 3, cloud: 2, wavepriest: 2, drummer: 2, stormcaller: 2, twister: 1, stormlord: 1, bolt: 2, windread: 2, static: 2, downpour: 1, cannon: 1, barrel: 2, map: 1 },
  },
  merchant: {
    name: '황금 상인조합',
    emblem: '💰',
    desc: '거래형. 보물을 모으는 대신 써 버려서 선원을 강화하고 적을 매수한다.',
    skill: {
      name: '뇌물', art: '💴', cost: 2, treasureCost: 1, target: 'foeCrew',
      text: '보물 1개를 써서 적 선원 하나를 다음 턴에 공격하지 못하게 한다.',
      effect: (g, t) => g.freeze(t),
    },
    deck: { pennykid: 3, bodyguard: 2, shady: 2, mercenary: 2, usurer: 1, armsdealer: 2, vaultkeeper: 1, goldcaptain: 1, goldrain: 2, buyout: 1, insurance: 1, chest: 1, carpenter: 2, parrot: 1, lookout: 1, cannon: 1 },
  },
};
