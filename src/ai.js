// 탐욕형 AI: 낼 수 있는 카드를 비싼 것부터 내고, 선장 스킬을 쓰고, 유리한 교환이 아니면 배를 노린다.
// 난이도가 낮을수록 정해진 확률로 아무 행동이나 골라 실수한다.
import { CARDS, FACTIONS } from './cards.js';
import { RULES, canPlay, canUseSkill, legalAttackTargets, hasKeyword, targetable } from './engine.js';

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
      if (coinIdx >= 0 && d.type === 'crew' && d.cost === me.wind + 1 && me.board.length < RULES.boardLimit) {
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
      const thorns = hasKeyword(d, 'thorns') ? 1 : 0;
      const kills = dmg(power, d) >= d.hp;
      const survives = dmg(d.atk + thorns, a) < a.hp;
      let score = 0;
      if (kills && survives) score = 10 + value(d);
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

export function aiNextAction(s, level = 'hard') {
  const { mistake } = AI_LEVELS[level] ?? AI_LEVELS.hard;
  if (mistake && s.rng() < mistake) return randomAction(s);
  return choosePlay(s) || chooseSkill(s) || chooseAttack(s) || { type: 'end' };
}
