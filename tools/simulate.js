// AI끼리 여러 판을 돌려 오류와 진영 밸런스를 확인한다. 사용: node tools/simulate.js [판수]
import { createGame, applyAction } from '../src/engine.js';
import { aiNextAction } from '../src/ai.js';
import { FACTIONS } from '../src/cards.js';

const N = Number(process.argv[2] || 500);
const stats = {};
const factions = Object.keys(FACTIONS);
const wins = Object.fromEntries(factions.map((f) => [f, [0, 0]])); // [승, 판]
const pairs = factions.flatMap((a) => factions.map((b) => [a, b]));
for (const [a, b] of pairs) {
  const key = `${a}(선공) vs ${b}`;
  stats[key] = { first: 0, second: 0, turns: 0, byTreasure: 0 };
  for (let n = 0; n < N; n++) {
    const s = createGame({ playerFaction: a, aiFaction: b });
    let steps = 0;
    while (s.winner === null) {
      const err = applyAction(s, aiNextAction(s));
      if (err) throw new Error(`AI가 잘못된 행동: ${err}`);
      if (++steps > 2000) throw new Error('게임이 끝나지 않음');
    }
    const st = stats[key];
    st[s.winner === 0 ? 'first' : 'second']++;
    st.turns += s.turn;
    if (a !== b) {
      const w = s.winner === 0 ? a : b;
      wins[a][1]++; wins[b][1]++; wins[w][0]++;
    }
    if (s.players[s.winner].treasure >= 10) st.byTreasure++;
  }
}
for (const [k, v] of Object.entries(stats)) {
  console.log(`${k}: 선공 승 ${(v.first / N * 100).toFixed(0)}% · 평균 ${(v.turns / N).toFixed(1)}턴 · 보물승 ${(v.byTreasure / N * 100).toFixed(0)}%`);
}
for (const [f, [w, n]] of Object.entries(wins)) {
  console.log(`${FACTIONS[f].name}: 타 진영 상대 승률 ${(w / n * 100).toFixed(0)}%`);
}
