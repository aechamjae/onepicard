// 게임 규칙 엔진. 화면과 분리되어 있어 node에서도 그대로 돌릴 수 있다.
import { CARDS, FACTIONS } from './cards.js';

export const RULES = {
  startHull: 20,
  treasureToWin: 12,
  maxWind: 10,
  boardLimit: 5,
  handLimit: 8,
  startHand: 4,
  burnDamage: 2,
  growLimit: 2,
  resonanceLimit: 2,
  discountLimit: 2,
  ripenLimit: 2,
  bankLimit: 2,
  sporeDamage: 1,
};

let uidSeq = 1;

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildDeck(factionId, rng) {
  const deck = [];
  for (const [defId, n] of Object.entries(FACTIONS[factionId].deck)) {
    for (let i = 0; i < n; i++) deck.push({ uid: uidSeq++, defId });
  }
  return shuffle(deck, rng);
}

function makePlayer(name, factionId, isAI, rng, hull) {
  return {
    name, factionId, isAI,
    hull, maxHull: hull, treasure: 0,
    maxWind: 0, wind: 0, bank: 0, fatigue: 0, skillUsed: false, discount: 0, played: 0,
    deck: buildDeck(factionId, rng), hand: [], board: [],
  };
}

// handicap: 난이도에 따른 시작 조건. hull = [나, AI] 시작 선체, extraCards = [나, AI] 추가 시작 카드.
export function createGame({
  playerFaction, aiFaction, rng = Math.random, names = ['나', 'AI'],
  handicap = { hull: [RULES.startHull, RULES.startHull], extraCards: [0, 0] },
}) {
  const s = {
    rng, turn: 0, current: 0, winner: null, log: [],
    players: [
      makePlayer(names[0], playerFaction, false, rng, handicap.hull[0]),
      makePlayer(names[1], aiFaction, true, rng, handicap.hull[1]),
    ],
  };
  drawCards(s, 0, RULES.startHand - 1 + handicap.extraCards[0]); // 선공은 1장 적게
  drawCards(s, 1, RULES.startHand + handicap.extraCards[1]); // 후공은 1장 더 + 행운의 동전
  s.players[1].hand.push({ uid: uidSeq++, defId: 'coin' });
  startTurn(s);
  return s;
}

function log(s, msg) {
  s.log.push(msg);
  if (s.log.length > 60) s.log.shift();
}

function drawCards(s, pi, n) {
  const p = s.players[pi];
  for (let i = 0; i < n; i++) {
    if (p.deck.length === 0) {
      p.fatigue++;
      p.hull -= p.fatigue;
      log(s, `${p.name}의 덱이 비었다! 식량 부족으로 선체 ${p.fatigue} 피해.`);
      continue;
    }
    const card = p.deck.pop();
    if (p.hand.length >= RULES.handLimit) {
      log(s, `${p.name}의 손패가 가득 차 「${CARDS[card.defId].name}」이(가) 바다에 빠졌다.`);
      continue;
    }
    p.hand.push(card);
  }
}

function startTurn(s) {
  s.turn++;
  const p = s.players[s.current];
  p.maxWind = Math.min(RULES.maxWind, p.maxWind + 1);
  p.wind = p.maxWind + (p.bank || 0); // 광합성으로 모아 둔 바람
  if (p.bank) log(s, `🌻 모아 둔 햇빛으로 바람 +${p.bank}.`);
  p.bank = 0;
  p.skillUsed = false;
  // 숙성: 손패의 숙성 카드가 익어 비용이 줄어든다(새로 뽑는 카드는 이번 턴에 익지 않는다).
  p.hand = p.hand.map((c) => ((CARDS[c.defId].keywords || []).includes('ripen') && (c.ripe || 0) < RULES.ripenLimit ? { ...c, ripe: (c.ripe || 0) + 1 } : c));
  p.discount = 0;
  p.played = 0; // 이번 턴에 낸 카드 수(연쇄)
  for (const c of p.board) {
    c.canAttack = !c.frozen && !CARDS[c.defId].noAttack;
    c.frozen = false;
    c.submerged = false;
    c.attacked = false;
    c.doubled = false;
  }
  log(s, `── ${p.name}의 턴 (바람 ${p.wind}) ──`);
  for (const c of p.board.filter((c) => c.burning)) {
    hurt(c, RULES.burnDamage);
    log(s, `🔥 「${CARDS[c.defId].name}」이(가) 화상으로 ${RULES.burnDamage} 피해.`);
  }
  removeDead(s);
  drawCards(s, s.current, 1);
  checkWinner(s);
}

function checkWinner(s) {
  if (s.winner !== null) return;
  for (let i = 0; i < 2; i++) {
    const p = s.players[i];
    if (p.treasure >= RULES.treasureToWin) {
      s.winner = i;
      log(s, `💰 ${p.name}이(가) 보물 ${RULES.treasureToWin}개를 모아 승리했다!`);
      return;
    }
  }
  for (let i = 0; i < 2; i++) {
    if (s.players[i].hull <= 0) {
      s.winner = 1 - i;
      log(s, `🌊 ${s.players[i].name}의 배가 침몰했다! ${s.players[1 - i].name} 승리!`);
      return;
    }
  }
}

// 쓰러진 선원을 치운다. 망령은 한 번 되살아나고, 유언(onDeath)은 치운 뒤에 발동한다.
function removeDead(s) {
  s.players.forEach((p, pi) => {
    const dead = [];
    for (const c of p.board.filter((c) => c.hp <= 0)) {
      if (hasKeyword(c, 'ghost') && !c.revived) {
        c.revived = true;
        c.hp = 1;
        c.burning = false;
        log(s, `👻 「${CARDS[c.defId].name}」이(가) 망령이 되어 다시 일어났다!`);
      } else {
        dead.push(c);
      }
    }
    if (!dead.length) return;
    p.board = p.board.filter((c) => !dead.includes(c));
    for (const c of dead) {
      log(s, `☠ ${p.name}의 「${CARDS[c.defId].name}」이(가) 쓰러졌다.`);
      const d = CARDS[c.defId];
      if (d.onDeath) d.onDeath(effectApi(s, pi));
      if (hasKeyword(c, 'spore')) plantSpores(s, 1 - pi, 1);
    }
  });
}

// 포자: 상대 갑판 빈자리에 공격할 수 없는 포자를 심는다.
function plantSpores(s, pi, n) {
  const p = s.players[pi];
  let planted = 0;
  for (; planted < n && p.board.length < RULES.boardLimit; planted++) p.board.push(makeCrew(uidSeq++, 'spore'));
  if (planted) log(s, `🦠 ${p.name}의 갑판에 포자 ${planted}개가 피어났다.`);
}

function makeCrew(uid, defId) {
  const d = CARDS[defId];
  return {
    uid, defId,
    atk: d.atk, hp: d.hp, maxHp: d.hp,
    canAttack: (d.keywords || []).includes('charge'), frozen: false,
    attacked: false, tension: 0, burning: false, revived: false, grown: 0,
    shield: (d.keywords || []).includes('shield'), stealth: (d.keywords || []).includes('stealth'), doubled: false,
    submerged: (d.keywords || []).includes('submerge'),
    gained: [], // 카드 효과로 얻은 키워드
  };
}

export function findCrew(s, uid) {
  for (let pi = 0; pi < 2; pi++) {
    const c = s.players[pi].board.find((c) => c.uid === uid);
    if (c) return { crew: c, owner: pi };
  }
  return null;
}

export function hasKeyword(crew, kw) {
  return (CARDS[crew.defId].keywords || []).includes(kw) || !!crew.gained?.includes(kw);
}

// 순풍으로 깎인 실제 비용.
// card는 손패 카드 객체(숙성 반영) 또는 defId.
export function costOf(p, card) {
  const defId = typeof card === 'string' ? card : card.defId;
  const ripe = typeof card === 'string' ? 0 : card.ripe || 0;
  return Math.max(0, CARDS[defId].cost - (p.discount || 0) - ripe);
}

// 선원에게 피해를 준다. 탄성이 있으면 1 줄어든다. 실제로 들어간 피해를 돌려준다.
function hurt(crew, n) {
  if (n <= 0) return 0;
  if (crew.shield) {
    crew.shield = false; // 보호막이 대신 맞고 깨진다
    return 0;
  }
  const dealt = hasKeyword(crew, 'elastic') ? Math.max(0, n - 1) : n;
  crew.hp -= dealt;
  return dealt;
}

function heal(s, p, n) {
  if (n <= 0) return;
  const before = p.hull;
  p.hull = Math.min(p.maxHull, p.hull + n);
  if (p.hull > before) log(s, `🦇 ${p.name}의 선체 ${p.hull - before} 회복.`);
}

// 카드 효과가 쓰는 도구 모음. pi는 카드를 낸 플레이어.
function effectApi(s, pi) {
  const me = s.players[pi];
  const foe = s.players[1 - pi];
  return {
    me, foe,
    draw: (n) => drawCards(s, pi, n),
    gainWind: (n) => { me.wind += n; },
    healShip: (n) => {
      const before = me.hull;
      me.hull = Math.min(me.maxHull, me.hull + n);
      log(s, `🔧 ${me.name}의 선체 ${me.hull - before} 회복.`);
    },
    damageFoeShip: (n) => {
      foe.hull -= n;
      log(s, `💥 ${foe.name}의 배에 ${n} 피해.`);
    },
    // 이번 턴에 이 카드보다 먼저 낸 카드 수
    get played() { return me.played; },
    // 거래: 보물이 있으면 1개를 써서 true. 없으면 false.
    trade: () => {
      if (me.treasure < 1) return false;
      me.treasure--;
      log(s, `💰 ${me.name}이(가) 보물 1개를 내고 거래했다. (${me.treasure}/${RULES.treasureToWin})`);
      return true;
    },
    grant: (uid, kw) => {
      const f = findCrew(s, uid);
      if (!f) return;
      if (!hasKeyword(f.crew, kw)) f.crew.gained.push(kw);
      if (kw === 'charge') f.crew.canAttack = true;
    },
    // 적 선원을 내 편으로 데려온다. 내 갑판이 가득 차면 실패.
    steal: (uid) => {
      const f = findCrew(s, uid);
      if (!f || f.owner === pi || me.board.length >= RULES.boardLimit) return false;
      foe.board = foe.board.filter((c) => c !== f.crew);
      f.crew.canAttack = false;
      f.crew.tension = 0;
      me.board.push(f.crew);
      log(s, `🤝 「${CARDS[f.crew.defId].name}」이(가) 금화에 넘어와 ${me.name} 편이 되었다!`);
      return true;
    },
    // 공격력과 체력을 뒤바꾼다. 체력이 0이 되면 쓰러진다.
    swapStats: (uid) => {
      const f = findCrew(s, uid);
      if (!f) return;
      const c = f.crew;
      [c.atk, c.hp] = [c.hp, c.atk];
      c.maxHp = c.hp;
      log(s, `🩺 「${CARDS[c.defId].name}」의 공격력과 체력이 뒤바뀌었다. (${c.atk}/${c.hp})`);
      removeDead(s);
    },
    addToHand: (defId, n = 1) => {
      for (let i = 0; i < n; i++) {
        if (me.hand.length >= RULES.handLimit) break;
        me.hand.push({ uid: uidSeq++, defId });
      }
    },
    slay: (uid) => {
      const f = findCrew(s, uid);
      if (!f) return;
      f.crew.hp = 0;
      log(s, `⚔ 「${CARDS[f.crew.defId].name}」이(가) 단칼에 베였다.`);
      removeDead(s);
    },
    gainTreasure: (n) => {
      me.treasure += n;
      log(s, `💰 ${me.name}이(가) 보물 ${n}개를 얻었다. (${me.treasure}/${RULES.treasureToWin})`);
    },
    damageCrew: (uid, n) => {
      const f = findCrew(s, uid);
      if (!f) return;
      const dealt = hurt(f.crew, n);
      log(s, `「${CARDS[f.crew.defId].name}」에게 ${dealt} 피해.`);
      removeDead(s);
    },
    damageMyShip: (n) => {
      me.hull -= n;
      log(s, `💥 ${me.name}의 배에 ${n} 피해.`);
    },
    damageAllFoes: (n) => {
      for (const c of [...foe.board]) hurt(c, n);
      log(s, `모든 적 선원에게 ${n} 피해.`);
      removeDead(s);
    },
    damageAll: (n) => {
      for (const c of [...me.board, ...foe.board]) hurt(c, n);
      log(s, `바다 위 모든 선원에게 ${n} 피해.`);
      removeDead(s);
    },
    isAlive: (uid) => !!findCrew(s, uid),
    plantSpores: (n) => plantSpores(s, 1 - pi, n),
    // 숙성: 손패의 숙성 카드를 익힌다. all이 아니면 가장 비싼 카드 하나만.
    ripenHand: (all = true) => {
      const list = me.hand.filter((c) => (CARDS[c.defId].keywords || []).includes('ripen') && (c.ripe || 0) < RULES.ripenLimit)
        .sort((a, b) => CARDS[b.defId].cost - CARDS[a.defId].cost);
      const picked = all ? list : list.slice(0, 1);
      me.hand = me.hand.map((c) => (picked.includes(c) ? { ...c, ripe: (c.ripe || 0) + 1 } : c));
      if (picked.length) log(s, `🍎 손패의 숙성 카드 ${picked.length}장이 익었다.`);
      return picked.length;
    },
    bankWind: (n) => {
      const before = me.bank || 0;
      me.bank = Math.min(RULES.bankLimit, before + n);
      if (me.bank > before) log(s, `🌻 다음 턴 바람 +${me.bank} (모아 둔 햇빛).`);
    },
    // 포식: 다른 아군 선원 중 가장 약한 하나를 잡아먹고 그 공격력·체력을 얻는다.
    devour: (selfUid) => {
      const self = me.board.find((c) => c.uid === selfUid);
      const prey = me.board.filter((c) => c.uid !== selfUid).sort((a, b) => a.atk + a.hp - (b.atk + b.hp))[0];
      if (!self || !prey) return;
      me.board = me.board.filter((c) => c !== prey);
      self.atk += prey.atk;
      self.hp += prey.hp;
      self.maxHp += prey.hp;
      log(s, `🍖 「${CARDS[self.defId].name}」이(가) 「${CARDS[prey.defId].name}」을(를) 잡아먹고 ${self.atk}/${self.hp}이 되었다.`);
    },
    buff: (uid, atk, hp) => {
      const f = findCrew(s, uid);
      if (!f) return;
      f.crew.atk = Math.max(0, f.crew.atk + atk);
      f.crew.hp += hp;
      f.crew.maxHp += hp;
    },
    buffAll: (atk, hp) => {
      for (const c of me.board) {
        c.atk += atk;
        c.hp += hp;
        c.maxHp += hp;
      }
    },
    tensionAll: (n) => {
      for (const c of me.board) c.tension = Math.min(3, (c.tension || 0) + n);
    },
    burn: (uid) => {
      const f = findCrew(s, uid);
      if (!f) return;
      f.crew.burning = true;
      log(s, `🔥 「${CARDS[f.crew.defId].name}」에 불이 붙었다.`);
    },
    burnAllFoes: () => {
      for (const c of foe.board) c.burning = true;
      if (foe.board.length) log(s, '🔥 적 선원 모두에게 불이 붙었다.');
    },
    summon: (defId, n = 1) => {
      for (let i = 0; i < n && me.board.length < RULES.boardLimit; i++) {
        me.board.push(makeCrew(uidSeq++, defId));
        log(s, `${me.name}: 「${CARDS[defId].name}」 합류.`);
      }
    },
    randomAllyCrew: (exceptUid) => {
      const list = me.board.filter((c) => c.uid !== exceptUid);
      return list.length ? list[Math.floor(s.rng() * list.length)] : null;
    },
    setTension: (uid, n) => {
      const f = findCrew(s, uid);
      if (f) f.crew.tension = n;
    },
    ready: (uid) => {
      const f = findCrew(s, uid);
      if (f && !CARDS[f.crew.defId].noAttack) f.crew.canAttack = true;
    },
    bounce: (uid) => {
      const f = findCrew(s, uid);
      if (!f) return;
      const owner = s.players[f.owner];
      owner.board = owner.board.filter((c) => c !== f.crew);
      const name = CARDS[f.crew.defId].name;
      if (owner.hand.length >= RULES.handLimit) {
        log(s, `🌀 「${name}」이(가) 바다 멀리 던져졌다.`);
      } else {
        owner.hand.push({ uid: f.crew.uid, defId: f.crew.defId });
        log(s, `🌀 「${name}」이(가) ${owner.name}의 손패로 되돌아갔다.`);
      }
    },
    shield: (uid) => {
      const f = findCrew(s, uid);
      if (f) f.crew.shield = true;
    },
    extinguish: (uid) => {
      const f = findCrew(s, uid);
      if (!f || !f.crew.burning) return;
      f.crew.burning = false;
      log(s, `💧 「${CARDS[f.crew.defId].name}」의 불이 꺼졌다.`);
    },
    freeze: (uid) => {
      const f = findCrew(s, uid);
      if (!f) return;
      f.crew.frozen = true;
      log(s, `❄ 「${CARDS[f.crew.defId].name}」이(가) 얼어붙었다.`);
    },
    freezeAllFoes: () => {
      for (const c of foe.board) c.frozen = true;
      if (foe.board.length) log(s, '❄ 적 선원 모두가 얼어붙었다.');
    },
    // 동전 던지기. 클로버 점쟁이가 있으면 뒷면일 때 한 번 더 던진다.
    flip: () => {
      let heads = s.rng() < 0.5;
      if (!heads && me.board.some((c) => CARDS[c.defId].reroll)) {
        log(s, '🍀 뒷면… 점쟁이가 다시 던진다!');
        heads = s.rng() < 0.5;
      }
      log(s, heads ? '🪙 앞면! 도박 성공.' : '🪙 뒷면… 도박 실패.');
      return heads;
    },
    dice: () => {
      const n = 1 + Math.floor(s.rng() * 6);
      log(s, `🎲 주사위 눈 ${n}!`);
      return n;
    },
    randomFoeCrew: () => (foe.board.length ? foe.board[Math.floor(s.rng() * foe.board.length)] : null),
  };
}

// 안개 속에 숨었거나 잠항 중인 선원은 공격이나 대상 지정 카드로 고를 수 없다.
export const targetable = (board) => board.filter((c) => !c.stealth && !c.submerged);

export function legalAttackTargets(s, pi, attacker) {
  const visible = targetable(s.players[1 - pi].board);
  const guards = visible.filter((c) => hasKeyword(c, 'guard'));
  if (guards.length) {
    const ids = guards.map((c) => c.uid);
    return attacker && hasKeyword(attacker, 'sneak') ? ['ship', ...ids] : ids;
  }
  return ['ship', ...visible.map((c) => c.uid)];
}

// 대상 지정이 필요한 카드·스킬이 지금 쓸 수 있는 대상이 있는지 확인한다.
function targetError(s, pi, kind) {
  if (kind === 'foeCrew' && !targetable(s.players[1 - pi].board).length) return '대상이 될 적 선원이 없다.';
  if (kind === 'allyCrew' && !s.players[pi].board.length) return '대상이 될 아군 선원이 없다.';
  return null;
}

function validTarget(s, pi, kind, uid) {
  if (kind === 'foeCrew') return targetable(s.players[1 - pi].board).some((c) => c.uid === uid);
  return s.players[pi].board.some((c) => c.uid === uid);
}

export function canUseSkill(s, pi) {
  const p = s.players[pi];
  const sk = FACTIONS[p.factionId].skill;
  if (p.skillUsed) return '선장 스킬은 한 턴에 한 번만 쓸 수 있다.';
  if (sk.cost > p.wind) return '바람이 부족하다.';
  if (sk.treasureCost && p.treasure < sk.treasureCost) return '보물이 부족하다.';
  return sk.target ? targetError(s, pi, sk.target) : null;
}

export function canPlay(s, pi, handIndex) {
  const p = s.players[pi];
  const card = p.hand[handIndex];
  if (!card) return '그 카드가 없다.';
  const d = CARDS[card.defId];
  if (costOf(p, card) > p.wind) return '바람이 부족하다.';
  if (d.type === 'crew' && p.board.length >= RULES.boardLimit) return `선원은 ${RULES.boardLimit}명까지만 둘 수 있다.`;
  return d.target ? targetError(s, pi, d.target) : null;
}

// action: {type:'play', handIndex, target?} | {type:'attack', attacker, target:'ship'|uid} | {type:'end'}
// 성공하면 null, 실패하면 이유 문자열을 돌려준다.
export function applyAction(s, action) {
  if (s.winner !== null) return '게임이 끝났다.';
  const pi = s.current;
  const me = s.players[pi];
  const foe = s.players[1 - pi];

  if (action.type === 'play') {
    const err = canPlay(s, pi, action.handIndex);
    if (err) return err;
    const card = me.hand[action.handIndex];
    const d = CARDS[card.defId];
    if (d.target && !validTarget(s, pi, d.target, action.target)) return '대상을 골라야 한다.';
    me.wind -= costOf(me, card);
    // 순풍 카드는 쌓인 순풍을 그대로 이어받고, 다른 카드는 다 써 버린다.
    const tailwind = (d.keywords || []).includes('tailwind');
    if (!tailwind) me.discount = 0;
    me.hand.splice(action.handIndex, 1);
    const g = effectApi(s, pi);
    if (d.type === 'crew') {
      const crew = makeCrew(card.uid, card.defId);
      me.board.push(crew);
      log(s, `${me.name}: 「${d.name}」 승선.`);
      if (d.onPlay) d.onPlay(g, crew);
    } else {
      log(s, `${me.name}: 「${d.name}」 사용.`);
      d.effect(g, action.target);
      const charged = me.board.filter((c) => hasKeyword(c, 'resonance') && (c.charged || 0) < RULES.resonanceLimit);
      for (const c of charged) { c.atk++; c.charged = (c.charged || 0) + 1; }
      if (charged.length) log(s, `🌩 공명! 선원 ${charged.length}명의 공격력 +1.`);
    }
    if (tailwind) {
      me.discount = Math.min(RULES.discountLimit, me.discount + 1);
      log(s, `🍃 순풍이 분다! 다음 카드 비용 -${me.discount}.`);
    }
    me.played++;
    checkWinner(s);
    return null;
  }

  if (action.type === 'skill') {
    const err = canUseSkill(s, pi);
    if (err) return err;
    const sk = FACTIONS[me.factionId].skill;
    if (sk.target && !validTarget(s, pi, sk.target, action.target)) return '대상을 골라야 한다.';
    me.wind -= sk.cost;
    if (sk.treasureCost) me.treasure -= sk.treasureCost;
    me.skillUsed = true;
    log(s, `✨ ${me.name}: 선장 스킬 「${sk.name}」!`);
    sk.effect(effectApi(s, pi), action.target);
    checkWinner(s);
    return null;
  }

  if (action.type === 'attack') {
    const attacker = me.board.find((c) => c.uid === action.attacker);
    if (!attacker) return '공격할 선원이 없다.';
    if (!attacker.canAttack || CARDS[attacker.defId].noAttack) return '이 선원은 지금 공격할 수 없다.';
    if (!legalAttackTargets(s, pi, attacker).includes(action.target)) {
      return foe.board.some((c) => hasKeyword(c, 'guard')) ? '수호 선원부터 공격해야 한다.' : '공격할 수 없는 대상이다.';
    }
    attacker.canAttack = false;
    attacker.attacked = true;
    if (attacker.stealth) {
      attacker.stealth = false;
      log(s, `🌫 「${CARDS[attacker.defId].name}」이(가) 안개 속에서 튀어나왔다!`);
    }
    let power = attacker.atk + (attacker.tension || 0);
    if (attacker.tension) log(s, `🌀 당겨 둔 고무팔이 튕겨 나간다! (공격력 +${attacker.tension})`);
    attacker.tension = 0;
    const aName = CARDS[attacker.defId].name;
    if (action.target === 'ship') {
      const loot = 1 + (hasKeyword(attacker, 'plunder') ? 1 : 0);
      foe.hull -= power;
      me.treasure += loot;
      if (hasKeyword(attacker, 'lifesteal')) heal(s, me, power);
      log(s, `⚔ 「${aName}」이(가) ${foe.name}의 배를 습격! 선체 ${power} 피해, 보물 ${loot}개 획득. (${me.treasure}/${RULES.treasureToWin})`);
    } else {
      const defender = foe.board.find((c) => c.uid === action.target);
      const idx = foe.board.indexOf(defender);
      if (hasKeyword(attacker, 'blood') && defender.hp < defender.maxHp) {
        power += 2;
        log(s, `🩸 피 냄새를 맡았다! (공격력 +2)`);
      }
      const dealt = hurt(defender, power);
      const slash = hasKeyword(attacker, 'slash');
      const thorns = hasKeyword(defender, 'thorns') && !slash ? 1 : 0;
      const back = slash ? 0 : hurt(attacker, defender.atk + thorns);
      if (thorns) log(s, `🌵 가시에 찔렸다!`);
      if (slash) log(s, `⚔ 일섬! 반격을 받지 않았다.`);
      if (hasKeyword(attacker, 'lifesteal')) heal(s, me, dealt);
      if (hasKeyword(defender, 'lifesteal')) heal(s, foe, back);
      log(s, `⚔ 「${aName}」 vs 「${CARDS[defender.defId].name}」`);
      if (dealt && hasKeyword(attacker, 'scorch') && defender.hp > 0) {
        defender.burning = true;
        log(s, `🔥 「${CARDS[defender.defId].name}」에 불이 붙었다.`);
      }
      // 냉기: 서로 피해를 주고받은 뒤 살아남은 상대를 얼린다.
      if (dealt && hasKeyword(attacker, 'chill') && defender.hp > 0) {
        defender.frozen = true;
        log(s, `❄ 「${CARDS[defender.defId].name}」이(가) 얼어붙었다.`);
      }
      if (back && hasKeyword(defender, 'chill') && attacker.hp > 0) {
        attacker.frozen = true;
        log(s, `❄ 「${aName}」이(가) 얼어붙었다.`);
      }
      if (hasKeyword(attacker, 'reach')) {
        for (const side of [foe.board[idx - 1], foe.board[idx + 1]]) {
          if (side && hurt(side, 1)) log(s, `🤸 뻗은 팔이 「${CARDS[side.defId].name}」도 후려쳤다.`);
        }
      }
      removeDead(s);
    }
    // 연타: 한 턴에 한 번 더 공격할 수 있다.
    if (hasKeyword(attacker, 'double') && !attacker.doubled && attacker.hp > 0) {
      attacker.doubled = true;
      attacker.canAttack = true;
    }
    checkWinner(s);
    return null;
  }

  if (action.type === 'end') {
    const g = effectApi(s, pi);
    for (const c of me.board) {
      if (hasKeyword(c, 'tension') && !c.attacked && c.tension < 3) c.tension++;
      if (hasKeyword(c, 'grow') && c.grown < RULES.growLimit) {
        c.grown++;
        c.atk++;
        c.hp++;
        c.maxHp++;
      }
    }
    for (const c of [...me.board]) {
      const d = CARDS[c.defId];
      if (d.onTurnEnd) d.onTurnEnd(g);
    }
    // 광합성: 광합성 선원 1명마다 남은 바람 1을 다음 턴으로 넘긴다.
    const leaves = me.board.filter((c) => hasKeyword(c, 'photo')).length;
    if (leaves && me.wind > 0) g.bankWind(Math.min(leaves, me.wind));
    checkWinner(s);
    if (s.winner !== null) return null;
    s.current = 1 - pi;
    startTurn(s);
    return null;
  }

  return '알 수 없는 행동.';
}
