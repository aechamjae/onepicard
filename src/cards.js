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
  tailwind: { name: '순풍', desc: '이 카드를 내면 이번 턴에 다음으로 내는 카드의 비용이 1 줄어든다. 순풍 카드를 이어서 내면 할인이 쌓인다(최대 -2).' },
  submerge: { name: '잠항', desc: '낸 뒤 내 다음 턴이 올 때까지 바닷속에 숨어, 공격이나 대상 지정 카드로 고를 수 없다.' },
  resonance: { name: '공명', desc: '내가 전술 카드를 쓸 때마다 공격력 +1 (최대 2번).' },
  trade: { name: '거래', desc: '낼 때 보물이 있으면 1개를 자동으로 써서 카드에 적힌 추가 효과를 낸다.' },
  chill: { name: '냉기', desc: '이 선원과 싸워 피해를 입고 살아남은 적 선원은 얼어붙어 다음 턴에 공격할 수 없다.' },
  ripen: { name: '숙성', desc: '손패에 든 채로 내 턴을 맞을 때마다 비용이 1 줄어든다(최대 -2).' },
  devour: { name: '포식', desc: '낼 때 다른 아군 선원 중 가장 약한 하나를 잡아먹고 그 공격력·체력을 얻는다.' },
  blood: { name: '피 냄새', desc: '체력이 깎인 적 선원을 공격하면 공격력 +2.' },
  spore: { name: '포자', desc: '쓰러지면 적 갑판에 포자(0/1, 공격 불가)를 심는다. 포자는 주인의 턴이 끝날 때 그 배에 1 피해를 주고, 2번 주면 시든다. 한 갑판에 3개까지. 갑판이 가득 차도 선원을 낼 수 있고, 그때 포자 하나를 밟아 없애며 그 선원이 1 피해를 받는다.' },
};

// 카드 효과 안에서 키워드를 확인할 때 쓴다(효과로 얻은 키워드 포함).
const hasKw = (c, k) => (CARDS[c.defId].keywords || []).includes(k) || !!c.gained?.includes(k);

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
    name: '뱃전 대포 난사', type: 'tactic', cost: 4, art: '🚢',
    text: '적 배에 4 피해.',
    effect: (g) => g.damageFoeShip(4),
  },
  flag: {
    name: '해적 깃발', type: 'tactic', cost: 3, art: '🏴',
    text: '아군 선원 모두에게 공격력 +1, 체력 +1.',
    effect: (g) => g.buffAll(1, 1),
  },
  maelstrom: {
    name: '대소용돌이', type: 'tactic', cost: 6, art: '🌀',
    text: '바다 위 모든 선원(아군 포함)에게 3 피해.',
    effect: (g) => g.damageAll(3),
  },
  fogscout: { name: '안개 척후병', type: 'crew', cost: 2, atk: 2, hp: 2, art: '🌫️', keywords: ['stealth'], text: '' },
  puffer: { name: '가시복어 선원', type: 'crew', cost: 3, atk: 2, hp: 4, art: '🐡', keywords: ['thorns'], text: '' },
  twins: { name: '칼춤 남매', type: 'crew', cost: 4, atk: 2, hp: 4, art: '👯', keywords: ['double'], text: '' },
  bat: { name: '흡혈 박쥐', type: 'crew', cost: 2, atk: 2, hp: 1, art: '🦇', keywords: ['lifesteal', 'charge'], text: '' },
  amulet: {
    name: '방패 부적', type: 'tactic', cost: 1, art: '🧿', target: 'allyCrew',
    text: '아군 선원 하나에게 보호막을 씌운다. 카드 1장을 뽑는다.',
    effect: (g, t) => { g.shield(t); g.draw(1); },
  },
  kraken: { name: '놊', type: 'crew', cost: 8, atk: 7, hp: 9, art: '🗿', keywords: ['guard'], text: '원숭이들이 받드는 정글의 거대 석상.' },

  // ── 붉은 돛 해적단 ──
  cutlass: { name: '칼잡이 돌격대', type: 'crew', cost: 2, atk: 2, hp: 3, art: '🪓', keywords: ['charge'], text: '' },
  powder: {
    name: '화약통 폭파범', type: 'crew', cost: 3, atk: 3, hp: 3, art: '🧨',
    text: '등장: 무작위 적 선원에게 2 피해.',
    onPlay: (g) => { const t = g.randomFoeCrew(); if (t) g.damageCrew(t.uid, 2); },
  },
  duelist: { name: '레이피어 결투가', type: 'crew', cost: 3, atk: 4, hp: 4, art: '🤺', text: '' },
  raider: { name: '갈고리 약탈꾼', type: 'crew', cost: 4, atk: 4, hp: 4, art: '🪝', keywords: ['plunder', 'sneak'], text: '' },
  raid: {
    name: '기습 약탈', type: 'tactic', cost: 2, art: '💎',
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
  redbeard: { name: '쪼찌', type: 'crew', cost: 5, atk: 5, hp: 6, art: '🧔', keywords: ['charge', 'plunder', 'sneak'], text: '붉은 수염을 휘날리는 해적 제독.' },

  // ── 심해 함대 ──
  sentinel: { name: '집게발 파수꾼', type: 'crew', cost: 2, atk: 2, hp: 4, art: '🦀', keywords: ['guard'], text: '' },
  harpoon: {
    name: '작살 사수', type: 'crew', cost: 3, atk: 3, hp: 3, art: '🔱',
    text: '등장: 무작위 적 선원에게 2 피해.',
    onPlay: (g) => { const t = g.randomFoeCrew(); if (t) g.damageCrew(t.uid, 2); },
  },
  tide: {
    name: '소라고둥 예언자', type: 'crew', cost: 4, atk: 2, hp: 4, art: '🐚',
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
  jelly: { name: '해파리 방벽', type: 'crew', cost: 2, atk: 0, hp: 6, art: '🪼', keywords: ['guard'], text: '' },
  pearl: {
    name: '진주 마녀', type: 'crew', cost: 3, atk: 2, hp: 3, art: '🦪',
    text: '등장: 무작위 다른 아군 선원에게 체력 +3.',
    onPlay: (g, self) => { const t = g.randomAllyCrew(self.uid); if (t) g.buff(t.uid, 0, 3); },
  },
  tsunami: {
    name: '해일', type: 'tactic', cost: 7, art: '🌊',
    text: '모든 적 선원에게 3 피해.',
    effect: (g) => g.damageAllFoes(3),
  },
  urchin: { name: '성게 수호병', type: 'crew', cost: 3, atk: 1, hp: 5, art: '🦔', keywords: ['guard', 'thorns'], text: '' },
  abyss: {
    name: '고래밥', type: 'crew', cost: 7, atk: 6, hp: 8, art: '🐋',
    text: '심연에서 올라온 거대 고래 함장. 내 턴이 끝날 때 보물 1개를 얻는다.',
    onTurnEnd: (g) => g.gainTreasure(1),
  },

  // ── 고무팔 해적단 ── (arm: true 인 카드는 늘어나는 팔 그림으로 그린다)
  rookie: { name: '말랑 고무손', type: 'crew', cost: 1, atk: 1, hp: 1, art: '🙃', arm: true, keywords: ['elastic'], text: '' },
  boxer: { name: '고무주먹 권투사', type: 'crew', cost: 2, atk: 2, hp: 3, art: '😤', arm: true, keywords: ['tension'], text: '' },
  whip: { name: '채찍팔 갑판장', type: 'crew', cost: 3, atk: 3, hp: 2, art: '😼', arm: true, keywords: ['reach'], text: '' },
  balloon: { name: '풍선배 방패수', type: 'crew', cost: 3, atk: 1, hp: 4, art: '🎈', keywords: ['guard', 'elastic'], text: '' },
  spring: { name: '용수철 포수', type: 'crew', cost: 4, atk: 3, hp: 4, art: '😆', arm: true, keywords: ['tension', 'elastic'], text: '' },
  catapult: { name: '새총팔 투척수', type: 'crew', cost: 4, atk: 3, hp: 2, art: '😝', arm: true, keywords: ['reach', 'elastic'], text: '' },
  ringmaster: { name: '도리', type: 'crew', cost: 6, atk: 4, hp: 6, art: '🤠', arm: true, keywords: ['reach', 'tension'], text: '거인처럼 긴 팔을 가진 곡예단장.' },
  slingshot: {
    name: '고무줄 새총', type: 'tactic', cost: 2, art: '🪃', target: 'allyCrew',
    text: '아군 선원 하나의 팔을 끝까지 당긴다: 탄력 3, 이번 턴에 바로 공격할 수 있다.',
    effect: (g, t) => { g.setTension(t, 3); g.ready(t); },
  },
  grab: {
    name: '휘감아 던지기', type: 'tactic', cost: 3, art: '🎣', target: 'foeCrew',
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
  doublepunch: { name: '바제스', type: 'crew', cost: 5, atk: 3, hp: 4, art: '🥊', arm: true, keywords: ['double', 'elastic'], text: '고무주먹 두 개로 링을 휩쓴 챔피언.' },
  octoarm: { name: '루피', type: 'crew', cost: 7, atk: 5, hp: 7, art: '😎', arm: true, keywords: ['reach', 'elastic', 'tension'], text: '여덟 개의 팔을 휘두르는 곡예왕.' },

  // ── 유령선단 ──
  wisp: { name: '도깨비불', type: 'crew', cost: 1, atk: 1, hp: 1, art: '🕯️', keywords: ['ghost'], text: '' },
  bones: { name: '해골 갑판원', type: 'crew', cost: 2, atk: 2, hp: 2, art: '💀', keywords: ['ghost'], text: '' },
  haunt: { name: '원혼 수부', type: 'crew', cost: 3, atk: 2, hp: 2, art: '⚰️', keywords: ['ghost'], text: '' },
  lantern: {
    name: '등불 무녀', type: 'crew', cost: 3, atk: 1, hp: 3, art: '🏮',
    text: '등장: 카드 1장을 뽑는다. 유언: 카드 1장을 뽑는다.',
    onPlay: (g) => g.draw(1),
    onDeath: (g) => g.draw(1),
  },
  shroud: { name: '수의 경비병', type: 'crew', cost: 4, atk: 2, hp: 4, art: '🧟', keywords: ['guard', 'ghost'], text: '' },
  banshee: {
    name: '울부짖는 밴시', type: 'crew', cost: 4, atk: 3, hp: 3, art: '😱',
    text: '유언: 모든 적 선원에게 1 피해.',
    onDeath: (g) => g.damageAllFoes(1),
  },
  phantom: {
    name: '덱켄', type: 'crew', cost: 6, atk: 4, hp: 4, art: '☠️', keywords: ['ghost'],
    text: '유령선을 이끄는 선장. 등장: 무작위 적 선원에게 2 피해.',
    onPlay: (g) => { const t = g.randomFoeCrew(); if (t) g.damageCrew(t.uid, 2); },
  },
  vampire: { name: '스튜시', type: 'crew', cost: 5, atk: 4, hp: 3, art: '🧛', keywords: ['lifesteal', 'ghost'], text: '피를 탐하는 흡혈 귀족.' },
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
  ember: { name: '잿불 사환', type: 'crew', cost: 1, atk: 1, hp: 2, art: '🪔', keywords: ['scorch'], text: '' },
  spicy: {
    name: '청양고추 폭격수', type: 'crew', cost: 2, atk: 2, hp: 2, art: '🌶️',
    text: '등장: 무작위 적 선원에게 불을 붙인다.',
    onPlay: (g) => { const t = g.randomFoeCrew(); if (t) g.burn(t.uid); },
  },
  cook: {
    name: '해적 요리사', type: 'crew', cost: 3, atk: 2, hp: 3, art: '🧑‍🍳',
    text: '등장: 내 배의 선체를 3 회복한다.',
    onPlay: (g) => g.healShip(3),
  },
  flambe: { name: '플람베 달인', type: 'crew', cost: 3, atk: 3, hp: 3, art: '🍳', keywords: ['scorch'], text: '' },
  grill: {
    name: '화로 수호자', type: 'crew', cost: 4, atk: 2, hp: 5, art: '♨️', keywords: ['guard'],
    text: '등장: 무작위 적 선원에게 불을 붙인다.',
    onPlay: (g) => { const t = g.randomFoeCrew(); if (t) g.burn(t.uid); },
  },
  inferno: {
    name: '제프', type: 'crew', cost: 6, atk: 5, hp: 6, art: '👹', keywords: ['scorch'],
    text: '불꽃 주방을 지휘하는 화염 주방장. 등장: 모든 적 선원에게 불을 붙인다.',
    onPlay: (g) => g.burnAllFoes(),
  },
  twinflame: { name: '불쇼 웍잡이', type: 'crew', cost: 4, atk: 2, hp: 4, art: '🥘', keywords: ['double', 'scorch'], text: '' },
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

  // ── 정글 원숭이 무리 ──
  chimp: { name: '장난꾸러기 원숭이', type: 'crew', cost: 1, atk: 1, hp: 2, art: '🙉', keywords: ['charge'], text: '' },
  monkey: { name: '꼬마 원숭이', type: 'crew', cost: 1, atk: 1, hp: 1, art: '🐵', keywords: ['charge'], token: true, text: '' },
  banana: {
    name: '바나나 상인', type: 'crew', cost: 2, atk: 2, hp: 3, art: '🍌',
    text: '등장: 꼬마 원숭이(1/1 돌격) 1마리를 부른다.',
    onPlay: (g) => g.summon('monkey', 1),
  },
  vine: { name: '덩굴 그네꾼', type: 'crew', cost: 3, atk: 3, hp: 2, art: '🌿', keywords: ['sneak'], text: '' },
  fogmonkey: { name: '안개 원숭이', type: 'crew', cost: 2, atk: 2, hp: 1, art: '🙊', keywords: ['stealth'], text: '' },
  tamer: {
    name: '원숭이 조련사', type: 'crew', cost: 3, atk: 2, hp: 3, art: '🎩',
    text: '등장: 다른 아군 선원 모두에게 공격력 +1.',
    onPlay: (g, self) => { g.buffAll(1, 0); g.buff(self.uid, -1, 0); },
  },
  gorilla: { name: '철주먹 고릴라', type: 'crew', cost: 4, atk: 4, hp: 6, art: '🦍', text: '' },
  kingkong: {
    name: '거프', type: 'crew', cost: 7, atk: 6, hp: 6, art: '👑',
    text: '정글을 다스리는 원숭이 왕. 등장: 꼬마 원숭이(1/1 돌격) 2마리를 부른다.',
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
    name: '정글 북소리', type: 'tactic', cost: 2, art: '🪘',
    text: '아군 선원 모두에게 공격력 +1, 체력 +1.',
    effect: (g) => g.buffAll(1, 1),
  },

  // ── 태엽 기계단 ──
  cog: { name: '톱니 일꾼', type: 'crew', cost: 1, atk: 0, hp: 1, art: '🪛', keywords: ['grow'], text: '' },
  windup: { name: '태엽 쥐', type: 'crew', cost: 2, atk: 1, hp: 1, art: '🐭', keywords: ['grow'], text: '' },
  piston: { name: '피스톤 권투봇', type: 'crew', cost: 3, atk: 1, hp: 2, art: '🤖', keywords: ['grow'], text: '' },
  turret: { name: '증기 포탑', type: 'crew', cost: 5, atk: 1, hp: 5, art: '🗼', keywords: ['guard', 'grow'], text: '' },
  tinker: {
    name: '땜장이', type: 'crew', cost: 3, atk: 2, hp: 2, art: '🛠️',
    text: '등장: 무작위 다른 아군 선원에게 공격력 +2, 체력 +2.',
    onPlay: (g, self) => { const t = g.randomAllyCrew(self.uid); if (t) g.buff(t.uid, 2, 2); },
  },
  shielddrone: { name: '방패 드론', type: 'crew', cost: 2, atk: 1, hp: 1, art: '🛸', keywords: ['shield', 'grow'], text: '' },
  golem: { name: '커티프람', type: 'crew', cost: 6, atk: 3, hp: 5, art: '🦾', keywords: ['grow'], text: '강철로 몸을 짜 맞춘 골렘.' },
  oil: {
    name: '기름칠', type: 'tactic', cost: 1, art: '🧴', target: 'allyCrew',
    text: '아군 선원 하나에게 공격력 +1, 체력 +1. 카드 1장을 뽑는다.',
    effect: (g, t) => { g.buff(t, 1, 1); g.draw(1); },
  },
  overclock: {
    name: '과부하', type: 'tactic', cost: 3, art: '🔋', target: 'allyCrew',
    text: '아군 선원 하나에게 공격력 +3. 이번 턴에 바로 공격할 수 있다.',
    effect: (g, t) => { g.buff(t, 3, 0); g.ready(t); },
  },
  blueprint: {
    name: '설계도', type: 'tactic', cost: 2, art: '📐',
    text: '카드 2장을 뽑는다. 내 배에 2 피해.',
    effect: (g) => { g.draw(2); g.damageMyShip(2); },
  },

  // ── 떠돌이 검객단 ──
  prentice: { name: '목검 수련생', type: 'crew', cost: 1, atk: 1, hp: 1, art: '🥋', keywords: ['slash'], text: '' },
  bamboo: { name: '죽도 검사', type: 'crew', cost: 2, atk: 2, hp: 1, art: '🎋', keywords: ['slash'], text: '' },
  iai: {
    name: '거합 검객', type: 'crew', cost: 3, atk: 2, hp: 2, art: '🗡️', keywords: ['slash'],
    text: '등장: 무작위 적 선원에게 1 피해.',
    onPlay: (g) => { const t = g.randomFoeCrew(); if (t) g.damageCrew(t.uid, 1); },
  },
  shieldsman: { name: '방패 무사', type: 'crew', cost: 3, atk: 2, hp: 5, art: '🛡️', keywords: ['guard'], text: '' },
  sensei: {
    name: '검술 사범', type: 'crew', cost: 4, atk: 3, hp: 3, art: '🧓',
    text: '등장: 무작위 다른 아군 선원 하나에게 공격력 +1과 일섬을 준다.',
    onPlay: (g, self) => { const t = g.randomAllyCrew(self.uid); if (t) { g.buff(t.uid, 1, 0); g.grant(t.uid, 'slash'); } },
  },
  gale: { name: '킬러', type: 'crew', cost: 5, atk: 3, hp: 2, art: '💨', keywords: ['charge', 'slash'], text: '질풍처럼 베고 지나가는 검호.' },
  nitoryu: { name: '오뎅', type: 'crew', cost: 5, atk: 2, hp: 3, art: '🍢', keywords: ['double', 'slash'], text: '두 자루 칼을 쓰는 이도류 낭인.' },
  swordsaint: {
    name: '류마', type: 'crew', cost: 7, atk: 5, hp: 5, art: '🏯', keywords: ['slash'],
    text: '전설로 불리는 검성. 등장: 체력이 가장 낮은 적 선원 하나를 단칼에 벤다.',
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
  novice: { name: '돛줄 소년', type: 'crew', cost: 1, atk: 1, hp: 2, art: '🧢', keywords: ['tailwind'], text: '' },
  surveyor: {
    name: '바다 측량사', type: 'crew', cost: 2, atk: 2, hp: 3, art: '📏',
    text: '등장: 카드 1장을 뽑는다.',
    onPlay: (g) => g.draw(1),
  },
  sailmender: { name: '돛 수선공', type: 'crew', cost: 2, atk: 2, hp: 3, art: '🪡', keywords: ['tailwind'], text: '' },
  compass: {
    name: '나침반 점술가', type: 'crew', cost: 3, atk: 2, hp: 4, art: '🌠', keywords: ['tailwind'],
    text: '등장: 카드 1장을 뽑는다.',
    onPlay: (g) => g.draw(1),
  },
  lighthouse: { name: '등대지기', type: 'crew', cost: 4, atk: 2, hp: 6, art: '🔦', keywords: ['guard'], text: '' },
  shortcut: { name: '지름길 항해사', type: 'crew', cost: 4, atk: 3, hp: 3, art: '🛶', keywords: ['sneak', 'tailwind'], text: '' },
  guildmaster: {
    name: '나미', type: 'crew', cost: 6, atk: 4, hp: 5, art: '🎓', keywords: ['tailwind'],
    text: '항해사 길드를 이끄는 길드 마스터. 등장: 카드 2장을 뽑는다.',
    onPlay: (g) => g.draw(2),
  },
  admiral: {
    name: '에넬', type: 'crew', cost: 7, atk: 5, hp: 5, art: '⛈️',
    text: '대항해를 이끄는 제독. 등장: 공격력이 가장 높은 적 선원 하나를 상대 손패로 되돌린다.',
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
    name: '동전 줍는 꼬마', type: 'crew', cost: 1, atk: 1, hp: 2, art: '🧒',
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
    name: '금화 용병', type: 'crew', cost: 3, atk: 3, hp: 4, art: '💂', keywords: ['trade'],
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
    name: '우소픈', type: 'crew', cost: 7, atk: 4, hp: 6, art: '🤴',
    text: '황금 상인조합의 선장. 등장: 보물을 최대 4개 써서, 쓴 만큼 공격력·체력이 오른다.',
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
    name: '배신의 금화', type: 'tactic', cost: 3, art: '🤝', target: 'foeCrew', keywords: ['trade'],
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
  walrus: { name: '베포', type: 'crew', cost: 3, atk: 3, hp: 5, art: '🐻‍❄️', keywords: ['guard'], text: '잠수함을 모는 북극곰 조타수.' },
  sedative: {
    name: '마취침 명사수', type: 'crew', cost: 3, atk: 2, hp: 3, art: '🎯',
    text: '등장: 공격력이 가장 높은 적 선원 하나는 다음 턴에 공격할 수 없다.',
    onPlay: (g) => {
      const list = g.foe.board.filter((c) => !c.stealth && !c.submerged).sort((a, b) => b.atk - a.atk);
      if (list.length) g.freeze(list[0].uid);
    },
  },
  incisor: {
    name: '메스 레지던트', type: 'crew', cost: 4, atk: 3, hp: 4, art: '🥼', keywords: ['submerge'],
    text: '등장: 공격력이 가장 높은 적 선원 하나의 공격력과 체력을 뒤바꾸고 1 피해.',
    onPlay: (g) => {
      const list = g.foe.board.filter((c) => !c.stealth && !c.submerged).sort((a, b) => b.atk - a.atk);
      if (list.length) { g.swapStats(list[0].uid); g.damageCrew(list[0].uid, 1); }
    },
  },
  torpedo: { name: '어뢰병', type: 'crew', cost: 5, atk: 5, hp: 6, art: '🚤', keywords: ['submerge'], text: '' },
  chiefsurgeon: {
    name: '로우', type: 'crew', cost: 7, atk: 5, hp: 6, art: '🫀', keywords: ['submerge'],
    text: '잠수함 외과단의 수석 집도의. 등장: 모든 적 선원의 공격력과 체력을 뒤바꾼다.',
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
  breeze: { name: '풍경 소리꾼', type: 'crew', cost: 1, atk: 1, hp: 2, art: '🎐', keywords: ['resonance'], text: '' },
  cloud: {
    name: '먹구름 소환사', type: 'crew', cost: 2, atk: 1, hp: 3, art: '☁️', keywords: ['resonance'],
    text: '등장: 번개 조각 1장을 손에 넣는다.',
    onPlay: (g) => g.addToHand('spark', 1),
  },
  wavepriest: { name: '물결 세이렌', type: 'crew', cost: 3, atk: 1, hp: 5, art: '🧜', keywords: ['guard', 'resonance'], text: '' },
  drummer: { name: '천둥 고수', type: 'crew', cost: 3, atk: 2, hp: 3, art: '🥁', keywords: ['resonance'], text: '' },
  stormcaller: {
    name: '폭풍 주술사', type: 'crew', cost: 4, atk: 3, hp: 4, art: '🧙', keywords: ['resonance'],
    text: '등장: 카드 1장을 뽑는다.',
    onPlay: (g) => g.draw(1),
  },
  twister: {
    name: '프로메테우스', type: 'crew', cost: 5, atk: 4, hp: 4, art: '🌞',
    text: '하늘의 불을 훔친 태양의 거인. 등장: 모든 적 선원에게 1 피해.',
    onPlay: (g) => g.damageAllFoes(1),
  },
  stormlord: {
    name: '웨더리아의 군주', type: 'crew', cost: 7, atk: 5, hp: 7, art: '🌦️', keywords: ['resonance'],
    text: '폭풍을 부리는 군주. 등장: 번개 조각 3장을 손에 넣는다.',
    onPlay: (g) => g.addToHand('spark', 3),
  },
  bolt: {
    name: '낙뢰', type: 'tactic', cost: 3, art: '☄️', target: 'foeCrew',
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
    name: '폭풍우', type: 'tactic', cost: 5, art: '🌧️',
    text: '모든 적 선원에게 2 피해.',
    effect: (g) => g.damageAllFoes(2),
  },
  // ── 공용 (신규) ──
  gull: {
    name: '갈매기 전령', type: 'crew', cost: 1, atk: 1, hp: 1, art: '🐦',
    text: '등장: 무작위 적 선원에게 1 피해.',
    onPlay: (g) => { const t = g.randomFoeCrew(); if (t) g.damageCrew(t.uid, 1); },
  },
  veteran: { name: '노련한 갑판수', type: 'crew', cost: 3, atk: 3, hp: 4, art: '🧑‍✈️', text: '' },
  supply: {
    name: '보급 꾸러미', type: 'tactic', cost: 2, art: '📦',
    text: '내 배의 선체를 3 회복하고 카드 1장을 뽑는다.',
    effect: (g) => { g.healShip(3); g.draw(1); },
  },

  // ── 고무팔 해적단 (신규) ──
  kangaroo: { name: '고무다리 도약꾼', type: 'crew', cost: 2, atk: 2, hp: 2, art: '🦘', arm: true, keywords: ['charge', 'elastic'], text: '' },
  bigball: {
    name: '대왕 고무공', type: 'tactic', cost: 4, art: '🏐', target: 'foeCrew',
    text: '적 선원 하나에게 3 피해. 튕겨 나간 공이 그 양옆 적 선원에게도 1 피해.',
    effect: (g, t) => {
      const i = g.foe.board.findIndex((c) => c.uid === t);
      const sides = [g.foe.board[i - 1], g.foe.board[i + 1]].filter(Boolean).map((c) => c.uid);
      g.damageCrew(t, 3);
      sides.forEach((uid) => g.damageCrew(uid, 1));
    },
  },

  // ── 붉은 돛 해적단 (신규) ──
  goldtooth: { name: '금니 해적', type: 'crew', cost: 3, atk: 3, hp: 4, art: '🦷', keywords: ['plunder'], text: '' },
  plank: {
    name: '판자 걷기', type: 'tactic', cost: 2, art: '🪵', target: 'foeCrew',
    text: '공격력 3 이하인 적 선원 하나를 바다에 빠뜨린다(쓰러뜨린다). 공격력이 더 높으면 2 피해.',
    effect: (g, t) => { const c = g.foe.board.find((c) => c.uid === t); if (c && c.atk <= 3) g.slay(t); else g.damageCrew(t, 2); },
  },

  // ── 심해 함대 (신규) ──
  cachalot: {
    name: '향유고래 순양함', type: 'crew', cost: 6, atk: 3, hp: 7, art: '🐳', keywords: ['guard'],
    text: '등장: 내 배의 선체를 3 회복한다.',
    onPlay: (g) => g.healShip(3),
  },
  pressure: {
    name: '수압 압착', type: 'tactic', cost: 2, art: '💧', target: 'foeCrew',
    text: '적 선원 하나에게 남은 체력의 절반(올림)만큼 피해.',
    effect: (g, t) => { const c = g.foe.board.find((c) => c.uid === t); if (c) g.damageCrew(t, Math.ceil(c.hp / 2)); },
  },

  // ── 유령선단 (신규) ──
  ghostrats: {
    name: '유령 쥐떼', type: 'crew', cost: 2, atk: 1, hp: 1, art: '🐀', keywords: ['ghost'],
    text: '유언: 떠도는 혼(1/1 망령) 1명을 불러낸다.',
    onDeath: (g) => g.summon('spirit', 1),
  },
  deadmarch: {
    name: '망자의 행진', type: 'tactic', cost: 4, art: '🪦',
    text: '떠도는 혼(1/1 망령) 1명을 불러내고, 아군 선원 모두 공격력 +1.',
    effect: (g) => { g.summon('spirit', 1); g.buffAll(1, 0); },
  },

  // ── 불꽃 요리단 (신규) ──
  skewer: {
    name: '숯불 꼬치꾼', type: 'crew', cost: 2, atk: 2, hp: 3, art: '🍡',
    text: '등장: 불붙은 적 선원 모두에게 1 피해.',
    onPlay: (g) => g.foe.board.filter((c) => c.burning).map((c) => c.uid).forEach((uid) => g.damageCrew(uid, 1)),
  },
  volcano: {
    name: '화산 소스', type: 'tactic', cost: 2, art: '🌋',
    text: '불붙은 적 선원 모두에게 4 피해.',
    effect: (g) => g.foe.board.filter((c) => c.burning).map((c) => c.uid).forEach((uid) => g.damageCrew(uid, 4)),
  },

  // ── 정글 원숭이 무리 (신규) ──
  coconut: {
    name: '코코넛 투척꾼', type: 'crew', cost: 3, atk: 2, hp: 3, art: '🥥',
    text: '등장: 무작위 적 선원에게 1 피해.',
    onPlay: (g) => { const t = g.randomFoeCrew(); if (t) g.damageCrew(t.uid, 1); },
  },
  orangutan: {
    name: '오랑우탄 장로', type: 'crew', cost: 5, atk: 3, hp: 5, art: '🦧',
    text: '등장: 꼬마 원숭이(1/1 돌격) 1마리를 부르고, 다른 아군 선원 모두 체력 +1.',
    onPlay: (g, self) => { g.summon('monkey', 1); g.buffAll(0, 1); g.buff(self.uid, 0, -1); },
  },

  // ── 태엽 기계단 (신규) ──
  steamspider: { name: '증기 거미', type: 'crew', cost: 3, atk: 3, hp: 3, art: '🕷️', keywords: ['grow', 'sneak'], text: '' },
  rewind: {
    name: '태엽 재감기', type: 'tactic', cost: 2, art: '🔄',
    text: '아군 성장 선원 모두 공격력 +1, 체력 +1. 카드 1장을 뽑는다.',
    effect: (g) => { g.me.board.filter((c) => hasKw(c, 'grow')).forEach((c) => g.buff(c.uid, 1, 1)); g.draw(1); },
  },

  // ── 떠돌이 검객단 (신규) ──
  assassin: { name: '칼바람 자객', type: 'crew', cost: 2, atk: 2, hp: 2, art: '🎌', keywords: ['slash', 'stealth'], text: '' },
  crescent: {
    name: '초승달 베기', type: 'tactic', cost: 2, art: '🌙', target: 'foeCrew',
    text: '적 선원 하나에게 아군 선원 중 가장 높은 공격력만큼 피해.',
    effect: (g, t) => g.damageCrew(t, Math.max(0, ...g.me.board.map((c) => c.atk))),
  },

  // ── 잠수함 외과단 (신규) ──
  anatomist: {
    name: '해부학 교수', type: 'crew', cost: 3, atk: 2, hp: 4, art: '🦴', keywords: ['submerge'],
    text: '등장: 카드 1장을 뽑는다.',
    onPlay: (g) => g.draw(1),
  },
  heartrip: {
    name: '심장 적출', type: 'tactic', cost: 3, art: '💔', target: 'foeCrew',
    text: '적 선원 하나에게 그 선원의 공격력만큼 피해.',
    effect: (g, t) => { const c = g.foe.board.find((c) => c.uid === t); if (c) g.damageCrew(t, c.atk); },
  },

  // ── 폭풍 주술단 (신규) ──
  thunderhawk: { name: '천둥 매', type: 'crew', cost: 3, atk: 2, hp: 3, art: '🦅', keywords: ['charge', 'resonance'], text: '' },
  chainbolt: {
    name: '연쇄 번개', type: 'tactic', cost: 2, art: '🔗',
    text: '무작위 적 선원에게 1 피해를 세 번.',
    effect: (g) => { for (let i = 0; i < 3; i++) { const t = g.randomFoeCrew(); if (t) g.damageCrew(t.uid, 1); } },
  },

  // ── 황금 상인조합 (신규) ──
  changer: {
    name: '환전상', type: 'crew', cost: 2, atk: 2, hp: 4, art: '💱', keywords: ['trade'],
    text: '거래: 이번 턴에 바람 +3.',
    onPlay: (g) => { if (g.trade()) g.gainWind(3); },
  },
  goldbar: {
    name: '금괴 투척', type: 'tactic', cost: 3, art: '🥇', target: 'foeCrew', keywords: ['trade'],
    text: '적 선원 하나에게 3 피해. 거래: 대신 5 피해.',
    effect: (g, t) => g.damageCrew(t, g.trade() ? 5 : 3),
  },

  // ── 항해사 길드 (신규) ──
  courier: { name: '갑판 연락병', type: 'crew', cost: 1, atk: 1, hp: 2, art: '📨', keywords: ['tailwind', 'charge'], text: '' },
  navigator: {
    name: '항로 계산사', type: 'crew', cost: 3, atk: 1, hp: 3, art: '🧮',
    text: '등장: 이번 턴에 먼저 낸 카드 1장마다 공격력 +1.',
    onPlay: (g, self) => g.buff(self.uid, g.played, 0),
  },
  clipper: {
    name: '쾌속 범선', type: 'crew', cost: 6, atk: 3, hp: 4, art: '🛳️',
    text: '등장: 이번 턴에 먼저 낸 카드 1장마다 무작위 적 선원에게 1 피해.',
    onPlay: (g) => { for (let i = 0; i < g.played; i++) { const t = g.randomFoeCrew(); if (t) g.damageCrew(t.uid, 1); } },
  },
  logbook: {
    name: '항해 일지', type: 'tactic', cost: 0, art: '📔', keywords: ['tailwind'],
    text: '카드 1장을 뽑는다.',
    effect: (g) => g.draw(1),
  },
  fullsail: {
    name: '전속 항진', type: 'tactic', cost: 5, art: '🏁',
    text: '아군 선원 모두 공격력 +1, 이번 턴에 바로 공격할 수 있다.',
    effect: (g) => { g.buffAll(1, 0); g.me.board.forEach((c) => g.ready(c.uid)); },
  },

  // ── 아이스 에이지 ── (얼어붙은 적 = 다음 턴 공격 불가 상태인 선원)
  frostpup: { name: '빙판 견습생', type: 'crew', cost: 1, atk: 1, hp: 3, art: '🐧', keywords: ['chill'], text: '' },
  icepick: { name: '얼음송곳 작살꾼', type: 'crew', cost: 2, atk: 2, hp: 3, art: '⛏️', keywords: ['chill'], text: '' },
  snowguard: { name: '눈벽 파수꾼', type: 'crew', cost: 3, atk: 1, hp: 5, art: '⛄', keywords: ['guard', 'chill'], text: '' },
  frostmage: {
    name: '서리 무당', type: 'crew', cost: 3, atk: 2, hp: 3, art: '🥶',
    text: '등장: 공격력이 가장 높은 적 선원 하나를 얼린다.',
    onPlay: (g) => {
      const list = g.foe.board.filter((c) => !c.stealth && !c.submerged).sort((a, b) => b.atk - a.atk);
      if (list.length) g.freeze(list[0].uid);
    },
  },
  polar: { name: '털매머드 갑판장', type: 'crew', cost: 4, atk: 4, hp: 6, art: '🦣', keywords: ['chill'], text: '' },
  iceram: { name: '빙산 충각선', type: 'crew', cost: 5, atk: 5, hp: 5, art: '🏔️', keywords: ['charge', 'chill'], text: '' },
  frostqueen: {
    name: '시르바', type: 'crew', cost: 7, atk: 5, hp: 6, art: '👸', keywords: ['chill'],
    text: '얼음 바다를 다스리는 빙하 여제. 등장: 모든 적 선원을 얼린다.',
    onPlay: (g) => g.freezeAllFoes(),
  },
  icicle: {
    name: '고드름 투척', type: 'tactic', cost: 1, art: '🧊', target: 'foeCrew',
    text: '적 선원 하나에게 1 피해. 얼어붙은 선원이면 대신 3 피해.',
    effect: (g, t) => { const c = g.foe.board.find((c) => c.uid === t); if (c) g.damageCrew(t, c.frozen ? 3 : 1); },
  },
  shatter: {
    name: '얼음 깨기', type: 'tactic', cost: 2, art: '🔨',
    text: '얼어붙은 적 선원 모두에게 3 피해.',
    effect: (g) => g.foe.board.filter((c) => c.frozen).map((c) => c.uid).forEach((uid) => g.damageCrew(uid, 3)),
  },
  blizzard: {
    name: '눈보라', type: 'tactic', cost: 5, art: '🌨️',
    text: '모든 적 선원에게 1 피해를 주고 얼린다.',
    effect: (g) => { g.damageAllFoes(1); g.freezeAllFoes(); },
  },

  // ── 한국과수협회 ──
  greenapple: {
    name: '풋사과 견습생', type: 'crew', cost: 1, atk: 1, hp: 2, art: '🍏',
    text: '등장: 손패에서 가장 비싼 숙성 카드 하나를 한 번 더 익힌다.',
    onPlay: (g) => g.ripenHand(false),
  },
  cherry: {
    name: '체리 쌍둥이', type: 'crew', cost: 2, atk: 2, hp: 3, art: '🍒',
    text: '유언: 블루베리 꼬마(1/1) 1명을 부른다.',
    onDeath: (g) => g.summon('blueberry', 1),
  },
  blueberry: { name: '블루베리 꼬마', type: 'crew', cost: 1, atk: 1, hp: 1, art: '🫐', token: true, text: '' },
  pear: { name: '배나무 파수꾼', type: 'crew', cost: 5, atk: 2, hp: 5, art: '🍐', keywords: ['guard', 'ripen'], text: '' },
  peach: {
    name: '복숭아 치유사', type: 'crew', cost: 5, atk: 3, hp: 4, art: '🍑', keywords: ['ripen'],
    text: '등장: 내 배의 선체를 4 회복한다.',
    onPlay: (g) => g.healShip(4),
  },
  mango: {
    name: '망고 투석기', type: 'crew', cost: 6, atk: 4, hp: 4, art: '🥭', keywords: ['ripen'],
    text: '등장: 적 배에 3 피해.',
    onPlay: (g) => g.damageFoeShip(3),
  },
  watermelon: {
    name: '수박 폭탄', type: 'tactic', cost: 6, art: '🍉', target: 'foeCrew', keywords: ['ripen'],
    text: '적 선원 하나에게 5 피해. 튄 과즙이 그 양옆 적 선원에게도 2 피해.',
    effect: (g, t) => {
      const i = g.foe.board.findIndex((c) => c.uid === t);
      const sides = [g.foe.board[i - 1], g.foe.board[i + 1]].filter(Boolean).map((c) => c.uid);
      g.damageCrew(t, 5);
      sides.forEach((uid) => g.damageCrew(uid, 2));
    },
  },
  compost: {
    name: '과수원 거름', type: 'tactic', cost: 1, art: '🌾',
    text: '카드 1장을 뽑고, 손패의 숙성 카드를 모두 한 번 더 익힌다.',
    effect: (g) => { g.draw(1); g.ripenHand(true); },
  },
  orchardboss: {
    name: '능금 회장', type: 'crew', cost: 9, atk: 5, hp: 8, art: '🌳', keywords: ['ripen'],
    text: '백 년 된 과수원을 이끄는 협회장. 등장: 아군 선원 모두 체력 +2.',
    onPlay: (g) => g.buffAll(0, 2),
  },

  // ── 에버랜드의 아이들 ──
  rabbit: { name: '깡총 토끼', type: 'crew', cost: 1, atk: 1, hp: 3, art: '🐇', text: '' },
  bunny: { name: '아기 토끼', type: 'crew', cost: 1, atk: 1, hp: 1, art: '🐰', token: true, text: '' },
  zebra: { name: '얼룩말', type: 'crew', cost: 2, atk: 2, hp: 3, art: '🦓', keywords: ['charge'], text: '' },
  goat: { name: '아기 염소', type: 'crew', cost: 2, atk: 2, hp: 3, art: '🐐', keywords: ['thorns'], text: '' },
  panda: {
    name: '대나무 판다', type: 'crew', cost: 3, atk: 3, hp: 4, art: '🐼',
    text: '등장: 내 배의 선체를 3 회복한다.',
    onPlay: (g) => g.healShip(3),
  },
  giraffe: { name: '목긴 기린', type: 'crew', cost: 3, atk: 2, hp: 4, art: '🦒', keywords: ['reach'], text: '' },
  leopard: {
    name: '점박이 표범', type: 'crew', cost: 3, atk: 3, hp: 2, art: '🐆', keywords: ['devour', 'charge'],
    text: '',
    onPlay: (g, self) => g.devour(self.uid),
  },
  hippo: { name: '하마 수문장', type: 'crew', cost: 4, atk: 3, hp: 6, art: '🦛', keywords: ['guard'], text: '' },
  rhino: { name: '코뿔소 돌격대', type: 'crew', cost: 4, atk: 4, hp: 3, art: '🦏', keywords: ['charge'], text: '' },
  elephant: {
    name: '코끼리 가족', type: 'crew', cost: 5, atk: 3, hp: 7, art: '🐘', keywords: ['guard'],
    text: '등장: 다른 아군 선원 모두 체력 +1.',
    onPlay: (g, self) => { g.buffAll(0, 1); g.buff(self.uid, 0, -1); },
  },
  tiger: {
    name: '줄무늬 호랑이', type: 'crew', cost: 5, atk: 5, hp: 5, art: '🐯', keywords: ['devour'],
    text: '',
    onPlay: (g, self) => g.devour(self.uid),
  },
  lionking: {
    name: '레오 대장', type: 'crew', cost: 7, atk: 5, hp: 4, art: '🦁', keywords: ['devour', 'charge'],
    text: '사파리를 다스리는 갈기 대장.',
    onPlay: (g, self) => g.devour(self.uid),
  },
  safaribus: {
    name: '사파리 버스', type: 'tactic', cost: 3, art: '🚌',
    text: '아기 토끼(1/1) 2마리를 부른다.',
    effect: (g) => g.summon('bunny', 2),
  },
  freshgrass: {
    name: '신선한 풀', type: 'tactic', cost: 2, art: '🥬',
    text: '아군 선원 모두 체력 +1. 카드 1장을 뽑는다.',
    effect: (g) => { g.buffAll(0, 1); g.draw(1); },
  },

  // ── 상어 사냥단 ──
  baitfish: {
    name: '미끼 물고기', type: 'crew', cost: 1, atk: 1, hp: 1, art: '🐟',
    text: '등장: 무작위 적 선원에게 1 피해.',
    onPlay: (g) => { const t = g.randomFoeCrew(); if (t) g.damageCrew(t.uid, 1); },
  },
  diver: { name: '작살 다이버', type: 'crew', cost: 2, atk: 2, hp: 3, art: '🤿', keywords: ['blood'], text: '' },
  krill: { name: '크릴 방벽', type: 'crew', cost: 2, atk: 1, hp: 3, art: '🦐', keywords: ['guard'], text: '' },
  surfer: { name: '파도 사냥꾼', type: 'crew', cost: 3, atk: 3, hp: 3, art: '🏄', keywords: ['charge', 'blood'], text: '' },
  lobster: { name: '집게 바닷가재', type: 'crew', cost: 3, atk: 3, hp: 5, art: '🦞', keywords: ['thorns'], text: '' },
  sharkboat: {
    name: '상어잡이 보트', type: 'crew', cost: 5, atk: 4, hp: 6, art: '🚣', keywords: ['blood'],
    text: '등장: 무작위 적 선원에게 1 피해.',
    onPlay: (g) => { const t = g.randomFoeCrew(); if (t) g.damageCrew(t.uid, 1); },
  },
  megalodon: { name: '메갈로돈', type: 'crew', cost: 7, atk: 5, hp: 6, art: '🌑', keywords: ['blood', 'double'], text: '심연에서 깨어난 고대 상어.' },
  chum: {
    name: '피바다', type: 'tactic', cost: 2, art: '🩸',
    text: '모든 적 선원에게 1 피해. 카드 1장을 뽑는다.',
    effect: (g) => { g.damageAllFoes(1); g.draw(1); },
  },
  lure: {
    name: '미끼 던지기', type: 'tactic', cost: 1, art: '🎏', target: 'foeCrew',
    text: '적 선원 하나에게 1 피해. 무작위 아군 선원 공격력 +1.',
    effect: (g, t) => { g.damageCrew(t, 1); const a = g.randomAllyCrew(); if (a) g.buff(a.uid, 1, 0); },
  },
  sharknet: {
    name: '상어 그물', type: 'tactic', cost: 2, art: '🪤', target: 'foeCrew',
    text: '적 선원 하나에게 1 피해를 주고 다음 턴에 공격하지 못하게 묶는다.',
    effect: (g, t) => { g.damageCrew(t, 1); g.freeze(t); },
  },

  // ── 버섯 포자 군집 ──
  spore: {
    name: '포자', type: 'crew', cost: 0, atk: 0, hp: 1, art: '🦠', token: true, noAttack: true, keywords: ['thorns'],
    text: '공격할 수 없다. 주인 턴이 끝날 때 그 배에 1 피해, 2번 주면 시든다. 갑판이 가득 차면 선원을 낼 때 밟혀 터지며 1 피해.',
    onTurnEnd: (g, self) => { g.damageMyShip(1); if (--self.life <= 0) g.wither(self.uid); },
  },
  sprout: { name: '균사 새싹', type: 'crew', cost: 1, atk: 2, hp: 2, art: '🌱', keywords: ['spore'], text: '' },
  leafling: { name: '낙엽 은신자', type: 'crew', cost: 2, atk: 3, hp: 2, art: '🍂', keywords: ['stealth', 'spore'], text: '' },
  larva: { name: '버섯 애벌레', type: 'crew', cost: 2, atk: 3, hp: 3, art: '🐛', keywords: ['spore'], text: '' },
  potguard: { name: '화분 수호병', type: 'crew', cost: 3, atk: 2, hp: 5, art: '🪴', keywords: ['guard', 'spore'], text: '' },
  culturist: {
    name: '포자 배양사', type: 'crew', cost: 4, atk: 3, hp: 5, art: '🧫',
    text: '등장: 적 갑판에 포자 2개를 심는다.',
    onPlay: (g) => g.plantSpores(2),
  },
  troll: { name: '이끼 트롤', type: 'crew', cost: 5, atk: 5, hp: 7, art: '🧌', text: '' },
  mykos: {
    name: '미코스', type: 'crew', cost: 7, atk: 6, hp: 8, art: '🌲',
    text: '숲 전체에 뿌리를 뻗은 균사 거목. 등장: 적 갑판에 포자 3개를 심는다.',
    onPlay: (g) => g.plantSpores(3),
  },
  wither: {
    name: '시들게 하기', type: 'tactic', cost: 2, art: '🥀', target: 'foeCrew',
    text: '적 선원 하나에게 3 피해. 그 선원이 쓰러지면 적 갑판에 포자 1개를 심는다.',
    effect: (g, t) => { g.damageCrew(t, 3); if (!g.isAlive(t)) g.plantSpores(1); },
  },
  sporecloud: {
    name: '포자 구름', type: 'tactic', cost: 2, art: '🌁',
    text: '적 갑판에 포자 2개를 심는다. 카드 1장을 뽑는다.',
    effect: (g) => { g.plantSpores(2); g.draw(1); },
  },
  mushsoup: {
    name: '버섯 수프', type: 'tactic', cost: 2, art: '🍵',
    text: '내 배의 선체를 4 회복한다.',
    effect: (g) => g.healShip(4),
  },

  // ── 한국과수협회 (추가) ──
  mandarin: {
    name: '귤껍질 투척수', type: 'crew', cost: 2, atk: 2, hp: 1, art: '🍊',
    text: '등장: 무작위 적 선원에게 1 피해.',
    onPlay: (g) => { const t = g.randomFoeCrew(); if (t) g.damageCrew(t.uid, 1); },
  },
  lemon: {
    name: '레몬 저격수', type: 'crew', cost: 5, atk: 3, hp: 3, art: '🍋', keywords: ['ripen'],
    text: '등장: 공격력이 가장 높은 적 선원 하나의 공격력 -2.',
    onPlay: (g) => {
      const list = g.foe.board.filter((c) => !c.stealth && !c.submerged && !CARDS[c.defId].noAttack).sort((a, b) => b.atk - a.atk);
      if (list.length) g.buff(list[0].uid, -2, 0);
    },
  },
  pineapple: { name: '파인애플 가시병', type: 'crew', cost: 3, atk: 2, hp: 4, art: '🍍', keywords: ['guard', 'thorns'], text: '' },
  kiwi: { name: '키위 자객', type: 'crew', cost: 2, atk: 2, hp: 1, art: '🥝', keywords: ['stealth'], text: '' },

  // ── 아이스 에이지 (추가) ──
  iceseal: { name: '얼음 물범', type: 'crew', cost: 2, atk: 1, hp: 4, art: '🦭', keywords: ['guard', 'chill'], text: '' },

  // ── 상어 사냥단 (추가) ──
  squid: {
    name: '먹물 오징어', type: 'crew', cost: 2, atk: 2, hp: 2, art: '🦑',
    text: '등장: 무작위 적 선원 하나는 먹물에 가려 다음 턴에 공격할 수 없다.',
    onPlay: (g) => { const t = g.randomFoeCrew(); if (t) g.freeze(t.uid); },
  },

  // ── 버섯 포자 군집 (추가) ──
  mosssnail: { name: '이끼 달팽이', type: 'crew', cost: 2, atk: 2, hp: 3, art: '🐌', keywords: ['spore'], text: '' },
};

// 공용 카드: 여러 해적단이 함께 쓰는 카드. 덱마다 공용 카드는 5장, 나머지 25장은 그 해적단 고유 카드로 채운다.
export const COMMON = new Set(['deckhand', 'lookout', 'cannon', 'repair', 'map', 'rum', 'parrot', 'carpenter', 'barrel', 'chest', 'broadside', 'flag', 'maelstrom', 'fogscout', 'puffer', 'twins', 'bat', 'amulet', 'gull', 'veteran', 'supply']);

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
    deck: { rookie: 2, bigbounce: 1, bubble: 2, boxer: 2, whip: 2, balloon: 2, spring: 2, catapult: 2, pinball: 1, rubberwall: 1, doublepunch: 1, ringmaster: 1, octoarm: 1, slingshot: 1, grab: 1, kangaroo: 2, bigball: 1, gull: 1, supply: 1, cannon: 1, veteran: 1, lookout: 1 },
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
    deck: { cutlass: 3, powder: 2, duelist: 2, gunner: 2, shadowthief: 2, raider: 3, redbeard: 2, raid: 2, bounty: 2, goldtooth: 2, plank: 2, grog: 1, bat: 1, cannon: 1, rum: 1, veteran: 1, gull: 1 },
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
    deck: { jelly: 3, sentinel: 2, urchin: 2, harpoon: 2, pearl: 2, tide: 2, turtle: 2, abyss: 1, anchor: 2, volley: 1, tsunami: 1, cachalot: 2, pressure: 3, veteran: 2, cannon: 1, map: 1, gull: 1 },
  },
  ghost: {
    name: '유령선단',
    emblem: '👻',
    desc: '끈질긴형. 쓰러져도 망령으로 다시 일어나고, 쓰러질 때 유언을 남긴다.',
    skill: {
      name: '혼 부르기', art: '🔔', cost: 2,
      text: '떠도는 혼(1/1 망령)을 1명 불러낸다.',
      effect: (g) => g.summon('spirit', 1),
    },
    deck: { wisp: 3, bones: 3, haunt: 3, lantern: 2, shroud: 2, banshee: 2, vampire: 1, phantom: 2, curse: 2, seance: 1, barrel: 1, chest: 1, fogscout: 1, ghostrats: 2, deadmarch: 2, supply: 1, gull: 1 },
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
    deck: { ember: 2, spicy: 3, cook: 2, flambe: 3, grill: 2, twinflame: 2, inferno: 2, feast: 1, firebomb: 3, hotpot: 1, skewer: 2, volcano: 2, parrot: 1, broadside: 1, veteran: 1, supply: 1, gull: 1 },
  },
  monkey: {
    name: '정글 원숭이 무리',
    emblem: '🐒',
    desc: '물량형. 원숭이 떼를 불러 갑판을 채우고 한꺼번에 강해진다.',
    skill: {
      name: '휘파람', art: '🎶', cost: 3,
      text: '꼬마 원숭이(1/1 돌격) 1마리를 부른다.',
      effect: (g) => g.summon('monkey', 1),
    },
    deck: { chimp: 3, banana: 3, fogmonkey: 2, vine: 2, tamer: 2, gorilla: 2, kingkong: 1, kraken: 1, troop: 2, bananapeel: 2, drum: 2, coconut: 1, orangutan: 2, twins: 1, flag: 1, gull: 1, supply: 1, veteran: 1 },
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
    deck: { cog: 3, shielddrone: 2, windup: 2, piston: 3, turret: 2, tinker: 2, golem: 2, oil: 2, overclock: 2, blueprint: 1, amulet: 1, carpenter: 1, maelstrom: 1, steamspider: 2, rewind: 2, veteran: 1, supply: 1 },
  },
  swords: {
    name: '떠돌이 검객단',
    emblem: '⚔️',
    desc: '선원 싸움형. 일섬으로 반격 없이 적 선원을 하나씩 베어 갑판을 정리한다.',
    skill: {
      name: '칼 갈기', art: '🪨', cost: 2, target: 'allyCrew',
      text: '아군 선원 하나에게 일섬을 주고, 붙은 불을 끈다.',
      effect: (g, t) => { g.grant(t, 'slash'); g.extinguish(t); },
    },
    deck: { prentice: 3, bamboo: 3, iai: 2, shieldsman: 2, sensei: 2, gale: 2, nitoryu: 1, swordsaint: 1, slashcut: 2, meditate: 2, bladestorm: 1, cannon: 1, rum: 1, lookout: 1, assassin: 2, crescent: 2, veteran: 1, gull: 1 },
  },
  guild: {
    name: '항해사 길드',
    emblem: '🧭',
    desc: '연쇄형. 순풍 카드로 비용을 깎으며 한 턴에 여러 장을 몰아 내고, 낸 카드 수만큼 강해지는 카드로 마무리한다.',
    skill: {
      name: '해도 읽기', art: '🔍', cost: 2,
      text: '카드 1장을 뽑는다.',
      effect: (g) => g.draw(1),
    },
    deck: { novice: 2, courier: 2, surveyor: 1, sailmender: 2, compass: 2, navigator: 2, lighthouse: 2, shortcut: 2, clipper: 2, guildmaster: 1, admiral: 1, logbook: 1, unfurl: 2, headwind: 2, fullsail: 1, cannon: 2, supply: 1, veteran: 1, map: 1 },
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
    deck: { intern: 3, engineer: 2, headnurse: 1, walrus: 2, sedative: 2, incisor: 2, torpedo: 2, chiefsurgeon: 1, incision: 2, transplant: 2, surgery: 1, takt: 1, anatomist: 2, heartrip: 2, lookout: 1, repair: 1, veteran: 1, gull: 1, supply: 1 },
  },
  storm: {
    name: '폭풍 주술단',
    emblem: '🌩️',
    desc: '주문형. 전술 카드를 쓸 때마다 공명하는 선원들이 점점 강해진다.',
    skill: {
      name: '바람 부르기', art: '📯', cost: 2,
      text: '번개 조각(0비용: 무작위 적 선원에게 1 피해) 1장을 손에 넣는다.',
      effect: (g) => g.addToHand('spark', 1),
    },
    deck: { breeze: 3, cloud: 3, wavepriest: 2, drummer: 2, stormcaller: 2, twister: 1, stormlord: 1, bolt: 2, windread: 2, static: 2, downpour: 1, thunderhawk: 2, chainbolt: 2, cannon: 1, barrel: 1, map: 1, veteran: 1, supply: 1 },
  },
  merchant: {
    name: '황금 상인조합',
    emblem: '💰',
    desc: '거래형. 보물을 모으는 대신 써 버려서 선원을 강화하고 적을 매수한다.',
    skill: {
      name: '뇌물', art: '💴', cost: 1, treasureCost: 1, target: 'foeCrew',
      text: '보물 1개를 써서 적 선원 하나를 다음 턴에 공격하지 못하게 한다.',
      effect: (g, t) => g.freeze(t),
    },
    deck: { pennykid: 3, bodyguard: 2, shady: 2, mercenary: 2, usurer: 1, armsdealer: 2, vaultkeeper: 2, goldcaptain: 1, goldrain: 2, buyout: 2, insurance: 2, changer: 2, goldbar: 2, carpenter: 2, cannon: 1, chest: 1, veteran: 1 },
  },
  frost: {
    name: '아이스 에이지',
    emblem: '❄️',
    desc: '빙결형. 냉기로 적 선원을 얼려 공격을 막고, 얼어붙은 적을 깨부순다.',
    skill: {
      name: '서리 입김', art: '💠', cost: 2, target: 'foeCrew',
      text: '적 선원 하나를 얼린다. 이미 얼어붙어 있으면 대신 2 피해.',
      effect: (g, t) => { const c = g.foe.board.find((c) => c.uid === t); if (c?.frozen) g.damageCrew(t, 2); else g.freeze(t); },
    },
    deck: { frostpup: 3, icepick: 3, snowguard: 3, iceseal: 2, frostmage: 3, polar: 2, iceram: 2, frostqueen: 1, icicle: 3, shatter: 2, blizzard: 1, cannon: 1, carpenter: 1, veteran: 1, gull: 1, supply: 1 },
  },
  fruit: {
    name: '한국과수협회',
    emblem: '🍎',
    desc: '숙성형. 크고 비싼 과일 카드를 손에 묵혀 익힌 뒤 싸게 내어 단숨에 판을 뒤집는다.',
    skill: {
      name: '수확', art: '🧺', cost: 2,
      text: '손패의 숙성 카드를 모두 한 번 더 익힌다. 익힐 카드가 없으면 카드 1장을 뽑는다.',
      effect: (g) => { if (!g.ripenHand(true)) g.draw(1); },
    },
    deck: { greenapple: 3, cherry: 3, mandarin: 2, kiwi: 3, pineapple: 2, pear: 2, peach: 2, lemon: 2, mango: 2, watermelon: 2, compost: 1, orchardboss: 1, veteran: 1, cannon: 1, lookout: 1, supply: 1, amulet: 1 },
  },
  zoo: {
    name: '에버랜드의 아이들',
    emblem: '🎢',
    desc: '동물원형. 튼튼한 초식동물로 갑판을 지키고, 맹수가 작은 동료를 잡아먹어 거대해진다.',
    skill: {
      name: '먹이 주기', art: '🥩', cost: 2,
      text: '아기 토끼(1/1) 1마리를 부른다.',
      effect: (g) => g.summon('bunny', 1),
    },
    deck: { rabbit: 3, zebra: 2, goat: 2, panda: 2, giraffe: 2, leopard: 2, hippo: 2, rhino: 2, elephant: 1, tiger: 2, lionking: 1, safaribus: 2, freshgrass: 2, veteran: 1, gull: 1, cannon: 1, supply: 1, lookout: 1 },
  },
  shark: {
    name: '상어 사냥단',
    emblem: '🦈',
    desc: '사냥형. 미끼로 적 선원에게 상처를 내고, 피 냄새를 맡은 사냥꾼이 달려들어 끝낸다.',
    skill: {
      name: '지느러미 출몰', art: '🔺', cost: 2, target: 'foeCrew',
      text: '적 선원 하나에게 1 피해. 이미 다친 선원이면 2 피해.',
      effect: (g, t) => { const c = g.foe.board.find((c) => c.uid === t); if (c) g.damageCrew(t, c.hp < c.maxHp ? 2 : 1); },
    },
    deck: { baitfish: 3, diver: 3, krill: 2, squid: 2, surfer: 3, lobster: 2, sharkboat: 2, megalodon: 1, chum: 2, lure: 3, sharknet: 2, veteran: 1, cannon: 1, rum: 1, supply: 1, carpenter: 1 },
  },
  mush: {
    name: '버섯 포자 군집',
    emblem: '🍄',
    desc: '잠식형. 단단한 균사 선원으로 버티며 적 갑판에 포자를 심고, 포자가 적 배를 갉아먹는다.',
    skill: {
      name: '번식', art: '🧬', cost: 2,
      text: '적 갑판에 포자 1개를 심는다.',
      effect: (g) => g.plantSpores(1),
    },
    deck: { sprout: 3, leafling: 3, larva: 3, mosssnail: 3, potguard: 2, culturist: 2, troll: 2, mykos: 1, wither: 2, sporecloud: 2, mushsoup: 2, veteran: 1, cannon: 1, puffer: 1, supply: 1, map: 1 },
  },
};
