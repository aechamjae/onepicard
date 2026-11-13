// 모든 해적단 쌍(nC2)을 선후공 번갈아 N판씩 붙여, 해적단별 평균 승률과 한쪽으로 쏠린 상성을 보여 준다.
// 사용: node tools/matchups.js [쌍마다 판수=200]
// 목표: 평균 승률 48~52%, 어떤 상성도 80% 미만.
import { createGame, applyAction } from '../src/engine.js';
import { aiNextAction } from '../src/ai.js';
import { FACTIONS } from '../src/cards.js';

const N = Number(process.argv[2] || 200);
const ids = Object.keys(FACTIONS);
const rates = Object.fromEntries(ids.map((f) => [f, []]));
const skewed = [];
for (let i = 0; i < ids.length; i++) {
  for (let j = i + 1; j < ids.length; j++) {
    const [a, b] = [ids[i], ids[j]];
    let wa = 0;
    for (let n = 0; n < N; n++) {
      const aFirst = n % 2 === 0;
      const s = createGame({ playerFaction: aFirst ? a : b, aiFaction: aFirst ? b : a });
      for (let steps = 0; s.winner === null; steps++) {
        const err = applyAction(s, aiNextAction(s));
        if (err) throw new Error(`AI가 잘못된 행동: ${err}`);
        if (steps > 3000) throw new Error('게임이 끝나지 않음');
      }
      if ((s.winner === 0) === aFirst) wa++;
    }
    const r = wa / N;
    rates[a].push(r);
    rates[b].push(1 - r);
    if (r >= 0.8 || r <= 0.2) skewed.push(r >= 0.5 ? [a, b, r] : [b, a, 1 - r]);
  }
}
const pct = (x) => `${Math.round(x * 100)}%`;
const rows = ids.map((f) => [f, rates[f].reduce((x, y) => x + y, 0) / rates[f].length]).sort((x, y) => y[1] - x[1]);
for (const [f, avg] of rows) {
  const ok = avg >= 0.48 && avg <= 0.52 ? '' : '  ← 범위 밖';
  console.log(`${FACTIONS[f].emblem} ${FACTIONS[f].name}: 평균 ${(avg * 100).toFixed(1)}% (최악 ${pct(Math.min(...rates[f]))}, 최고 ${pct(Math.max(...rates[f]))})${ok}`);
}
console.log(skewed.length ? '80% 넘는 상성:' : '80% 넘는 상성 없음');
for (const [w, l, r] of skewed) console.log(`  ${FACTIONS[w].name} > ${FACTIONS[l].name} ${pct(r)}`);
