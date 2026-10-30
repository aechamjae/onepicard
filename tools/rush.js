// 보물 러시 확인: 무조건 적 배만 때리는 봇(사람이 "생각 없이 보물만 노리는" 플레이)을
// 어려움 AI와 붙여 본다. 이 승률이 높으면 보물 승리가 너무 쉬운 것이다.
// 사용: node tools/rush.js [판수]
import { createGame, applyAction, legalAttackTargets, RULES } from '../src/engine.js';
import { aiNextAction } from '../src/ai.js';
import { FACTIONS } from '../src/cards.js';
import { DIFFICULTIES } from '../src/difficulty.js';

const N = Number(process.argv[2] || 300);
const factions = Object.keys(FACTIONS);

function rushAction(s) {
  const me = s.players[s.current];
  for (const a of me.board.filter((c) => c.canAttack)) {
    const legal = legalAttackTargets(s, s.current, a);
    if (legal.includes('ship')) return { type: 'attack', attacker: a.uid, target: 'ship' };
  }
  const act = aiNextAction(s, 'hard');
  if (act.type !== 'attack') return act;
  // 수호에 막히면 수호부터 친다.
  const a = me.board.find((c) => c.uid === act.attacker);
  return { type: 'attack', attacker: a.uid, target: legalAttackTargets(s, s.current, a)[0] };
}

const rows = [];
for (const mine of factions) {
  let wins = 0, byTreasure = 0, games = 0;
  for (const theirs of factions.filter((f) => f !== mine)) {
    for (let n = 0; n < N; n++) {
      const s = createGame({ playerFaction: mine, aiFaction: theirs, handicap: DIFFICULTIES.hard.handicap });
      for (let steps = 0; s.winner === null; steps++) {
        const err = applyAction(s, s.current === 0 ? rushAction(s) : aiNextAction(s, 'hard'));
        if (err) throw new Error(err);
        if (steps > 3000) throw new Error('게임이 끝나지 않음');
      }
      games++;
      if (s.winner === 0) { wins++; if (s.players[0].treasure >= RULES.treasureToWin) byTreasure++; }
    }
  }
  rows.push(`${FACTIONS[mine].name}: 러시 승률 ${Math.round(wins / games * 100)}% (보물승 ${Math.round(byTreasure / games * 100)}%)`);
}
console.log('💀 어려움 AI 상대, 배만 때리는 봇');
console.log(rows.join('\n'));
