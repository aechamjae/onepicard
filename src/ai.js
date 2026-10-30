// 간단한 탐욕형 AI: 낼 수 있는 카드를 비싼 것부터 내고, 유리한 교환이 아니면 배를 노린다.
import { CARDS } from './cards.js';
import { RULES, canPlay, legalAttackTargets, hasKeyword } from './engine.js';

const value = (c) => c.atk + c.hp;
const dmg = (n, target) => (hasKeyword(target, 'elastic') ? Math.max(0, n - 1) : n);

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

function choosePlay(s) {
  const pi = s.current;
  const me = s.players[pi];
  const foe = s.players[1 - pi];
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

function chooseAttack(s) {
  const pi = s.current;
  const me = s.players[pi];
  const foe = s.players[1 - pi];
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
      const kills = dmg(power, d) >= d.hp;
      const survives = dmg(d.atk, a) < a.hp;
      let score = 0;
      if (kills && survives) score = 10 + value(d);
      else if (kills && value(d) >= value(a)) score = 5 + value(d) - value(a);
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

export function aiNextAction(s) {
  return choosePlay(s) || chooseAttack(s) || { type: 'end' };
}
