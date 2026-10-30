// 게임 규칙 엔진. 화면과 분리되어 있어 node에서도 그대로 돌릴 수 있다.
import { CARDS, FACTIONS } from './cards.js';

export const RULES = {
  startHull: 20,
  treasureToWin: 10,
  maxWind: 10,
  boardLimit: 5,
  handLimit: 8,
  startHand: 4,
  burnDamage: 2,
  growLimit: 2,
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

function makePlayer(name, factionId, isAI, rng) {
  return {
    name, factionId, isAI,
    hull: RULES.startHull, treasure: 0,
    maxWind: 0, wind: 0, fatigue: 0,
    deck: buildDeck(factionId, rng), hand: [], board: [],
  };
}

export function createGame({ playerFaction, aiFaction, rng = Math.random, names = ['나', 'AI'] }) {
  const s = {
    rng, turn: 0, current: 0, winner: null, log: [],
    players: [
      makePlayer(names[0], playerFaction, false, rng),
      makePlayer(names[1], aiFaction, true, rng),
    ],
  };
  drawCards(s, 0, RULES.startHand - 1); // 선공은 1장 적게
  drawCards(s, 1, RULES.startHand); // 후공은 1장 더 + 행운의 동전
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
  p.wind = p.maxWind;
  for (const c of p.board) {
    c.canAttack = !c.frozen;
    c.frozen = false;
    c.attacked = false;
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
    }
  });
}

function makeCrew(uid, defId) {
  const d = CARDS[defId];
  return {
    uid, defId,
    atk: d.atk, hp: d.hp, maxHp: d.hp,
    canAttack: (d.keywords || []).includes('charge'), frozen: false,
    attacked: false, tension: 0, burning: false, revived: false, grown: 0,
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
  return (CARDS[crew.defId].keywords || []).includes(kw);
}

// 선원에게 피해를 준다. 탄성이 있으면 1 줄어든다. 실제로 들어간 피해를 돌려준다.
function hurt(crew, n) {
  const dealt = hasKeyword(crew, 'elastic') ? Math.max(0, n - 1) : n;
  crew.hp -= dealt;
  return dealt;
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
      me.hull = Math.min(RULES.startHull, me.hull + n);
      log(s, `🔧 ${me.name}의 선체 ${me.hull - before} 회복.`);
    },
    damageFoeShip: (n) => {
      foe.hull -= n;
      log(s, `💥 ${foe.name}의 배에 ${n} 피해.`);
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
      if (f) f.crew.canAttack = true;
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
    freeze: (uid) => {
      const f = findCrew(s, uid);
      if (f) f.crew.frozen = true;
    },
    randomFoeCrew: () => (foe.board.length ? foe.board[Math.floor(s.rng() * foe.board.length)] : null),
  };
}

export function legalAttackTargets(s, pi, attacker) {
  const foe = s.players[1 - pi];
  const guards = foe.board.filter((c) => hasKeyword(c, 'guard'));
  if (guards.length) {
    const ids = guards.map((c) => c.uid);
    return attacker && hasKeyword(attacker, 'sneak') ? ['ship', ...ids] : ids;
  }
  return ['ship', ...foe.board.map((c) => c.uid)];
}

export function canPlay(s, pi, handIndex) {
  const p = s.players[pi];
  const card = p.hand[handIndex];
  if (!card) return '그 카드가 없다.';
  const d = CARDS[card.defId];
  if (d.cost > p.wind) return '바람이 부족하다.';
  if (d.type === 'crew' && p.board.length >= RULES.boardLimit) return `선원은 ${RULES.boardLimit}명까지만 둘 수 있다.`;
  if (d.target === 'foeCrew' && s.players[1 - pi].board.length === 0) return '대상이 될 적 선원이 없다.';
  if (d.target === 'allyCrew' && p.board.length === 0) return '대상이 될 아군 선원이 없다.';
  return null;
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
    if (d.target) {
      const owner = d.target === 'foeCrew' ? foe : me;
      if (!owner.board.some((c) => c.uid === action.target)) return '대상을 골라야 한다.';
    }
    me.wind -= d.cost;
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
    }
    checkWinner(s);
    return null;
  }

  if (action.type === 'attack') {
    const attacker = me.board.find((c) => c.uid === action.attacker);
    if (!attacker) return '공격할 선원이 없다.';
    if (!attacker.canAttack) return '이 선원은 지금 공격할 수 없다.';
    if (!legalAttackTargets(s, pi, attacker).includes(action.target)) {
      return foe.board.some((c) => hasKeyword(c, 'guard')) ? '수호 선원부터 공격해야 한다.' : '공격할 수 없는 대상이다.';
    }
    attacker.canAttack = false;
    attacker.attacked = true;
    const power = attacker.atk + (attacker.tension || 0);
    if (attacker.tension) log(s, `🌀 당겨 둔 고무팔이 튕겨 나간다! (공격력 +${attacker.tension})`);
    attacker.tension = 0;
    const aName = CARDS[attacker.defId].name;
    if (action.target === 'ship') {
      const loot = 1 + (hasKeyword(attacker, 'plunder') ? 1 : 0);
      foe.hull -= power;
      me.treasure += loot;
      log(s, `⚔ 「${aName}」이(가) ${foe.name}의 배를 습격! 선체 ${power} 피해, 보물 ${loot}개 획득. (${me.treasure}/${RULES.treasureToWin})`);
    } else {
      const defender = foe.board.find((c) => c.uid === action.target);
      const idx = foe.board.indexOf(defender);
      const dealt = hurt(defender, power);
      hurt(attacker, defender.atk);
      log(s, `⚔ 「${aName}」 vs 「${CARDS[defender.defId].name}」`);
      if (dealt && hasKeyword(attacker, 'scorch') && defender.hp > 0) {
        defender.burning = true;
        log(s, `🔥 「${CARDS[defender.defId].name}」에 불이 붙었다.`);
      }
      if (hasKeyword(attacker, 'reach')) {
        for (const side of [foe.board[idx - 1], foe.board[idx + 1]]) {
          if (side && hurt(side, 1)) log(s, `🤸 뻗은 팔이 「${CARDS[side.defId].name}」도 후려쳤다.`);
        }
      }
      removeDead(s);
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
    checkWinner(s);
    if (s.winner !== null) return null;
    s.current = 1 - pi;
    startTurn(s);
    return null;
  }

  return '알 수 없는 행동.';
}
