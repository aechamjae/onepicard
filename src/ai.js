// AI: 낼 수 있는 카드를 비싼 것부터 내고, 선장 스킬을 쓰고, 공격은 후보마다 미리 쳐 보고 레이스·갑판을 평가해 고른다.
// 난이도가 낮을수록 정해진 확률로 아무 행동이나 골라 실수한다.
import { CARDS, FACTIONS } from './cards.js';
import { RULES, applyAction, canPlay, canUseSkill, costOf, legalAttackTargets, hasKeyword, targetable } from './engine.js';

export const AI_LEVELS = {
  easy: { mistake: 0.55 },
  normal: { mistake: 0.35 },
  hard: { mistake: 0 },
};

const value = (c) => c.atk + c.hp;
const dmg = (n, target) => {
  if (target.shield) return 0;
  return hasKeyword(target, 'elastic') ? Math.max(0, n - 1) : n;
};

// 카드별 사용 판단. 대상(uid)을 돌려주거나, 대상 없는 카드면 true, 쓰지 않으려면 false.
const TACTIC_AI = {
  cannon: (me, foe) => {
    const killable = foe.board.filter((c) => c.hp <= 3).sort((a, b) => value(b) - value(a));
    if (killable.length) return killable[0].uid;
    const big = foe.board.filter((c) => c.atk >= 4).sort((a, b) => b.atk - a.atk);
    return big.length ? big[0].uid : false;
  },
  repair: (me) => me.hull <= RULES.startHull - 5,
  map: (me) => me.hand.length <= 5,
  rum: (me) => {
    const ready = me.board.filter((c) => c.canAttack).sort((a, b) => b.atk - a.atk);
    return ready.length ? ready[0].uid : false;
  },
  raid: () => true,
  coin: () => false, // 아래 choosePlay에서 따로 판단

  anchor: (me, foe) => {
    const t = foe.board.filter((c) => c.atk >= 3).sort((a, b) => b.atk - a.atk);
    return t.length ? t[0].uid : false;
  },
  slingshot: (me) => {
    // 아직 공격 못 하는 선원 중 가장 센 선원의 팔을 당긴다.
    const sleepy = me.board.filter((c) => !c.canAttack && !c.frozen).sort((a, b) => b.atk - a.atk);
    return sleepy.length ? sleepy[0].uid : false;
  },
  grab: (me, foe) => {
    const t = foe.board.filter((c) => CARDS[c.defId].cost >= 4).sort((a, b) => CARDS[b.defId].cost - CARDS[a.defId].cost);
    return t.length ? t[0].uid : false;
  },
  volley: (me, foe) => foe.board.filter((c) => c.hp <= 2).length >= 2 || foe.board.length >= 4,
  tsunami: (me, foe) => foe.board.length >= 3 || foe.board.filter((c) => c.hp <= 3).length >= 2,
  hotpot: (me, foe) => foe.board.length >= 3,
  maelstrom: (me, foe) => foe.board.reduce((n, c) => n + value(c), 0) >= me.board.reduce((n, c) => n + value(c), 0) + 6,
  barrel: (me, foe) => strongest(foe.board, (c) => (c.hp <= 1 ? 10 : 0) + c.atk),
  bounty: (me, foe) => strongest(foe.board.filter((c) => dmg(4, c) >= c.hp), value),
  firebomb: (me, foe) => strongest(foe.board, value),
  curse: (me, foe) => strongest(foe.board.filter((c) => c.atk >= 3), (c) => c.atk),
  bananapeel: (me, foe) => strongest(foe.board.filter((c) => c.atk >= 3), (c) => c.atk),
  oil: (me) => strongest(me.board, (c) => c.atk),
  overclock: (me, foe) => strongest(me.board.filter((c) => !c.canAttack && !c.frozen), (c) => c.atk) || (foe.hull <= 6 && strongest(me.board, (c) => c.atk)),
  flag: (me) => me.board.length >= 2,
  drum: (me) => me.board.length >= 2,
  grog: (me) => me.board.filter((c) => c.canAttack).length >= 2,
  feast: (me) => me.board.length >= 2 || me.hull <= 15,
  bigbounce: (me) => me.board.length >= 2,
  seance: (me) => me.board.length <= RULES.boardLimit - 2,
  troop: (me) => me.board.length <= RULES.boardLimit - 2,
  blueprint: (me) => me.hand.length <= 4 && me.hull > 6,
  slashcut: (me, foe) => strongest(foe.board.filter((c) => dmg(2, c) >= c.hp), value) || strongest(foe.board.filter((c) => c.atk >= 4), (c) => c.atk),
  meditate: (me) => strongest(me.board, (c) => c.atk + (hasKeyword(c, 'guard') ? 3 : 0)),
  bladestorm: (me, foe) => foe.board.filter((c) => dmg(2, c) >= c.hp).length >= 2 || foe.board.length >= 4,
  unfurl: (me) => me.hand.length <= 6,
  headwind: (me, foe) => strongest(foe.board.filter((c) => CARDS[c.defId].cost >= 3), (c) => CARDS[c.defId].cost + c.atk),
  goldrain: (me) => me.board.length >= 2,
  // 뒤바꾼 뒤 1 피해: 공격력이 1 이하면 쓰러지고, 아니면 공격력이 체력보다 큰 선원일수록 이득이다.
  incision: (me, foe) => strongest(foe.board.filter((c) => c.atk <= 1 || c.atk - c.hp >= 1), (c) => (c.atk <= 1 ? 20 + value(c) : c.atk - c.hp)),
  transplant: (me) => strongest(me.board.filter((c) => c.hp - c.atk >= 2 && !hasKeyword(c, 'guard')), (c) => c.hp - c.atk),
  surgery: (me) => strongest(me.board.filter((c) => c.maxHp - c.hp >= 2), (c) => c.maxHp - c.hp + c.atk),
  spark: () => true,
  bolt: (me, foe) => TACTIC_AI.cannon(me, foe),
  windread: (me) => me.hand.length <= 6,
  static: (me) => TACTIC_AI.rum(me),
  downpour: (me, foe) => TACTIC_AI.bladestorm(me, foe),
  insurance: (me) => me.hull <= RULES.startHull - 4,
  buyout: (me, foe) => {
    if (me.treasure > 0 && me.board.length < RULES.boardLimit) {
      const t = strongest(foe.board.filter((c) => c.atk <= 4 && !CARDS[c.defId].token), value);
      if (t) return t;
    }
    return strongest(foe.board.filter((c) => dmg(2, c) >= c.hp), value);
  },
};

// 점수가 가장 높은 선원의 uid. 없으면 false.
function strongest(list, score) {
  if (!list.length) return false;
  return [...list].sort((a, b) => score(b) - score(a))[0].uid;
}

// 선장 스킬 판단. 대상(uid), true(대상 없음), false(안 씀).
const SKILL_AI = {
  stretch: (me, foe) => strongest(foe.board.filter((c) => dmg(1, c) >= c.hp), value) || strongest(foe.board, (c) => c.atk),
  red: () => true,
  deep: (me) => strongest(me.board, (c) => (hasKeyword(c, 'guard') ? 10 : 0) + c.hp),
  ghost: (me) => me.board.length < RULES.boardLimit,
  flame: (me, foe) => strongest(foe.board.filter((c) => !c.burning), value),
  monkey: (me) => me.board.length < RULES.boardLimit,
  clock: (me) => strongest(me.board, (c) => c.atk),
  swords: (me) => strongest(me.board, (c) => (hasKeyword(c, 'slash') ? 0 : 10) + c.atk),
  guild: (me) => me.hand.length <= 6 && me.deck.length > 0,
  surgeon: (me, foe) => strongest(foe.board.filter((c) => dmg(1, c) >= c.hp), value) || strongest(foe.board, (c) => c.atk),
  storm: (me) => me.hand.length <= 6,
  merchant: (me, foe) => strongest(foe.board.filter((c) => c.atk >= 3 && !c.frozen), (c) => c.atk),
};

// AI가 보는 상대: 안개 속 선원은 고를 수 없으니 뺀다.
const foeView = (foe) => ({ ...foe, board: targetable(foe.board) });

function chooseSkill(s) {
  const pi = s.current;
  const me = s.players[pi];
  if (canUseSkill(s, pi)) return null;
  const sk = FACTIONS[me.factionId].skill;
  const foe = foeView(s.players[1 - pi]);
  let decision = SKILL_AI[me.factionId] ? SKILL_AI[me.factionId](me, foe) : true;
  if (sk.target && decision === true) decision = strongest(sk.target === 'foeCrew' ? foe.board : me.board, value);
  if (decision === false) return null;
  return sk.target ? { type: 'skill', target: decision } : { type: 'skill' };
}

// 지금 할 수 있는 행동을 모두 모아 그중 하나를 무작위로 고른다(실수).
function randomAction(s) {
  const pi = s.current;
  const me = s.players[pi];
  const foe = s.players[1 - pi];
  const pick = (list) => list[Math.floor(s.rng() * list.length)];
  const targetFor = (kind) => pick((kind === 'foeCrew' ? targetable(foe.board) : me.board).map((c) => c.uid));
  const options = [{ type: 'end' }];
  me.hand.forEach((card, i) => {
    if (canPlay(s, pi, i)) return;
    const d = CARDS[card.defId];
    options.push(d.target ? { type: 'play', handIndex: i, target: targetFor(d.target) } : { type: 'play', handIndex: i });
  });
  if (!canUseSkill(s, pi)) {
    const sk = FACTIONS[me.factionId].skill;
    options.push(sk.target ? { type: 'skill', target: targetFor(sk.target) } : { type: 'skill' });
  }
  for (const a of me.board.filter((c) => c.canAttack)) {
    options.push({ type: 'attack', attacker: a.uid, target: pick(legalAttackTargets(s, pi, a)) });
  }
  return pick(options);
}

function choosePlay(s) {
  const pi = s.current;
  const me = s.players[pi];
  const foe = foeView(s.players[1 - pi]);
  const order = me.hand
    .map((card, i) => ({ i, d: CARDS[card.defId], id: card.defId }))
    .sort((a, b) => b.d.cost - a.d.cost);
  for (const { i, d, id } of order) {
    if (id === 'coin') continue;
    if (canPlay(s, pi, i)) {
      // 동전 1개로 낼 수 있게 되는 선원이 있으면 동전을 먼저 쓴다.
      const coinIdx = me.hand.findIndex((c) => c.defId === 'coin');
      if (coinIdx >= 0 && d.type === 'crew' && costOf(me, id) === me.wind + 1 && me.board.length < RULES.boardLimit) {
        return { type: 'play', handIndex: coinIdx };
      }
      continue;
    }
    if (d.type === 'crew') return { type: 'play', handIndex: i };
    let decision = TACTIC_AI[id] ? TACTIC_AI[id](me, foe) : true;
    if (decision === false) continue;
    // 판단 규칙이 없는 대상 지정 카드는 가장 센 대상을 고른다.
    if (d.target && decision === true) decision = strongest(d.target === 'foeCrew' ? foe.board : me.board, value);
    if (d.target && decision === false) continue;
    return d.target ? { type: 'play', handIndex: i, target: decision } : { type: 'play', handIndex: i };
  }
  return null;
}

const doomed = (c) => c.burning && c.hp <= RULES.burnDamage && !c.shield && !(hasKeyword(c, 'ghost') && !c.revived);

// 선원들이 배를 때리기만 하면 몇 턴 뒤에 이기는지(선체·보물 중 빠른 쪽).
function raceTurns(attacker, victim) {
  const crews = attacker.board.filter((c) => c.atk > 0);
  if (!crews.length) return Infinity;
  const power = crews.reduce((n, c) => n + c.atk + (c.tension || 0), 0);
  const loot = crews.reduce((n, c) => n + 1 + (hasKeyword(c, 'plunder') ? 1 : 0), 0);
  return Math.min(Math.ceil(victim.hull / power), Math.ceil((RULES.treasureToWin - attacker.treasure) / loot));
}

function chooseAttack(s) {
  const pi = s.current;
  const me = s.players[pi];
  const foe = s.players[1 - pi];
  // 내가 먼저 움직이니 같은 턴 수면 내가 이긴다. 상대가 더 빠르면 배 대신 공격 선원을 끊는다.
  const losingRace = raceTurns(foe, me) < raceTurns(me, foe);
  const attackers = me.board.filter((c) => c.canAttack).sort((a, b) => b.atk - a.atk);
  for (const a of attackers) {
    const power = a.atk + (a.tension || 0);
    const legal = legalAttackTargets(s, pi, a);
    const canHitShip = legal.includes('ship');
    const loot = 1 + (hasKeyword(a, 'plunder') ? 1 : 0);
    if (canHitShip && (foe.hull - power <= 0 || me.treasure + loot >= RULES.treasureToWin)) {
      return { type: 'attack', attacker: a.uid, target: 'ship' };
    }
    let best = null;
    let bestScore = 0;
    for (const uid of legal) {
      if (uid === 'ship') continue;
      const d = foe.board.find((c) => c.uid === uid);
      // 불붙어 곧 타 죽을 선원은 주인 턴 시작에 쓰러지니 굳이 칠 필요가 없다.
      if (doomed(d)) continue;
      const slash = hasKeyword(a, 'slash');
      const back = slash ? 0 : d.atk + (hasKeyword(d, 'thorns') ? 1 : 0);
      const kills = dmg(power, d) >= d.hp;
      const survives = a.hp - dmg(back, a) > (a.burning ? RULES.burnDamage : 0);
      let score = 0;
      if (kills && doomed(a)) score = 5 + value(d); // 어차피 타 죽을 선원은 마지막으로 하나 데려간다
      else if (kills && survives) score = 10 + value(d);
      else if (kills && value(d) >= value(a)) score = 5 + value(d) - value(a);
      else if (kills && losingRace) score = 3 + d.atk + (hasKeyword(d, 'plunder') ? 2 : 0);
      else if (!canHitShip && survives) score = 1; // 수호를 깎아 둔다
      if (score > bestScore) { bestScore = score; best = uid; }
    }
    if (best !== null) return { type: 'attack', attacker: a.uid, target: best };
    // 탄력이 덜 찼으면 팔을 더 당기며 기다린다.
    if (hasKeyword(a, 'tension') && a.tension < 1 && !canHitShip) continue;
    if (canHitShip) return { type: 'attack', attacker: a.uid, target: 'ship' };
  }
  return null;
}

// ── 공격 탐색 ──
// 공격 후보마다 판을 복제해 실제로 쳐 보고, 남은 공격은 위의 규칙대로 마저 친 뒤 결과를 평가한다.

function cloneState(s) {
  return {
    ...s,
    log: [],
    players: s.players.map((p) => ({
      ...p,
      deck: [...p.deck],
      hand: [...p.hand],
      board: p.board.map((c) => ({ ...c, gained: [...(c.gained || [])] })),
    })),
  };
}

// 상대 턴 시작에 살아 있을 선원들만으로, 배만 때리면 몇 턴에 이기는지. 수호 선원의 체력은 배를 지키는 몫으로 친다.
function clock(attacker, victim) {
  const crews = attacker.board.filter((c) => c.atk > 0 && !doomed(c));
  if (!crews.length) return 99;
  const guardHp = victim.board.filter((c) => hasKeyword(c, 'guard') && !doomed(c)).reduce((n, c) => n + c.hp, 0);
  const power = crews.reduce((n, c) => n + c.atk + (c.tension || 0), 0);
  const loot = crews.reduce((n, c) => n + 1 + (hasKeyword(c, 'plunder') ? 1 : 0), 0);
  return Math.min(
    Math.ceil(Math.max(1, victim.hull + guardHp) / power),
    Math.ceil(Math.max(1, RULES.treasureToWin - attacker.treasure) / loot),
  );
}

// 선원 하나의 값어치. 망령(한 번 더 일어남), 보호막, 유언처럼 숫자에 안 보이는 값도 더한다.
function crewWorth(c) {
  const d = CARDS[c.defId];
  let w = c.atk * 1.2 + c.hp * 0.8;
  if (hasKeyword(c, 'ghost') && !c.revived) w += c.atk * 1.2 + 0.8;
  if (c.shield) w += c.atk;
  if (d.onDeath) w += 2;
  if (d.onTurnEnd) w += 3;
  if (hasKeyword(c, 'grow') && c.grown < RULES.growLimit) w += 2;
  return w;
}

// 내 턴이 끝난 뒤 판을 내 입장에서 점수로 매긴다. 다음은 상대 차례다.
function evaluate(s, pi) {
  if (s.winner !== null) return s.winner === pi ? 1e6 : -1e6;
  const me = s.players[pi];
  const foe = s.players[1 - pi];
  const strength = (p) => p.board.filter((c) => !doomed(c)).reduce((n, c) => n + crewWorth(c), 0);
  // 상대가 먼저 움직이니, 내 시계가 상대 시계보다 짧아야 레이스에서 이긴다.
  const margin = Math.max(-4, Math.min(4, clock(foe, me) - clock(me, foe)));
  return margin * 6 + (margin > 0 ? 10 : 0)
    + strength(me) - strength(foe)
    + (me.hull - foe.hull) * 0.5
    + (me.treasure - foe.treasure) * 0.8;
}

function rollout(s, pi) {
  for (let i = 0; i < 12 && s.winner === null; i++) {
    const a = chooseAttack(s);
    if (!a || applyAction(s, a)) break;
  }
  return evaluate(s, pi);
}

function searchAttack(s) {
  const pi = s.current;
  const me = s.players[pi];
  let best = null;
  let bestScore = rollout(cloneState(s), pi); // 규칙대로만 쳤을 때가 기준
  for (const a of me.board.filter((c) => c.canAttack)) {
    for (const target of legalAttackTargets(s, pi, a)) {
      const action = { type: 'attack', attacker: a.uid, target };
      const t = cloneState(s);
      if (applyAction(t, action)) continue;
      const score = rollout(t, pi);
      if (score > bestScore + 0.01) { bestScore = score; best = action; }
    }
  }
  return best || chooseAttack(s);
}

export function aiNextAction(s, level = 'hard') {
  const { mistake } = AI_LEVELS[level] ?? AI_LEVELS.hard;
  if (mistake && s.rng() < mistake) return randomAction(s);
  return choosePlay(s) || chooseSkill(s) || searchAttack(s) || { type: 'end' };
}
