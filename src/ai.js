// 간단한 탐욕형 AI: 낼 수 있는 카드를 비싼 것부터 내고, 유리한 교환이 아니면 배를 노린다.
import { CARDS } from './cards.js';
import { RULES, canPlay, legalAttackTargets, hasKeyword } from './engine.js';

const value = (c) => c.atk + c.hp;

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
  volley: (me, foe) => foe.board.filter((c) => c.hp <= 2).length >= 2 || foe.board.length >= 4,
};

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
    const decision = TACTIC_AI[id] ? TACTIC_AI[id](me, foe) : true;
    if (decision === false) continue;
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
    const legal = legalAttackTargets(s, pi, a);
    const canHitShip = legal.includes('ship');
    const loot = 1 + (hasKeyword(a, 'plunder') ? 1 : 0);
    if (canHitShip && (foe.hull - a.atk <= 0 || me.treasure + loot >= RULES.treasureToWin)) {
      return { type: 'attack', attacker: a.uid, target: 'ship' };
    }
    let best = null;
    let bestScore = 0;
    for (const uid of legal) {
      if (uid === 'ship') continue;
      const d = foe.board.find((c) => c.uid === uid);
      const kills = a.atk >= d.hp;
      const survives = d.atk < a.hp;
      let score = 0;
      if (kills && survives) score = 10 + value(d);
      else if (kills && value(d) >= value(a)) score = 5 + value(d) - value(a);
      else if (!canHitShip && survives) score = 1; // 수호를 깎아 둔다
      if (score > bestScore) { bestScore = score; best = uid; }
    }
    if (best !== null) return { type: 'attack', attacker: a.uid, target: best };
    if (canHitShip) return { type: 'attack', attacker: a.uid, target: 'ship' };
  }
  return null;
}

export function aiNextAction(s) {
  return choosePlay(s) || chooseAttack(s) || { type: 'end' };
}
