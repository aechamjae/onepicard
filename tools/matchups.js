// 모든 해적단 쌍(nC2)을 선후공 번갈아 N판씩 붙여, 해적단별 평균 승률과 한쪽으로 쏠린 상성을 보여 준다.
// 사용: node tools/matchups.js [쌍마다 판수=200] [--write]
// --write를 붙이면 결과를 src/matchups.js에 저장해, 게임 안 📊 승률·상성 화면에 보여 준다.
// 목표: 평균 승률 48~52%, 어떤 상성도 70% 이하. 판수가 적으면 오차가 커서(300판 ±3%) 1000판으로 확인한다.
import { writeFileSync } from 'node:fs';
import { createGame, applyAction } from '../src/engine.js';
import { aiNextAction } from '../src/ai.js';
import { FACTIONS } from '../src/cards.js';

const args = process.argv.slice(2);
const N = Number(args.find((a) => !a.startsWith('--')) || 200);
const table = {}; // table[a][b] = a가 b를 이긴 비율
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
    (table[a] ??= {})[b] = Math.round(r * 1000) / 1000;
    (table[b] ??= {})[a] = Math.round((1 - r) * 1000) / 1000;
    rates[a].push(r);
    rates[b].push(1 - r);
    if (r > 0.7 || r < 0.3) skewed.push(r >= 0.5 ? [a, b, r] : [b, a, 1 - r]);
  }
}
const pct = (x) => `${Math.round(x * 100)}%`;
const rows = ids.map((f) => [f, rates[f].reduce((x, y) => x + y, 0) / rates[f].length]).sort((x, y) => y[1] - x[1]);
for (const [f, avg] of rows) {
  const ok = avg >= 0.48 && avg <= 0.52 ? '' : '  ← 범위 밖';
  console.log(`${FACTIONS[f].emblem} ${FACTIONS[f].name}: 평균 ${(avg * 100).toFixed(1)}% (최악 ${pct(Math.min(...rates[f]))}, 최고 ${pct(Math.max(...rates[f]))})${ok}`);
}
console.log(skewed.length ? '70% 넘는 상성:' : '70% 넘는 상성 없음');
for (const [w, l, r] of skewed) console.log(`  ${FACTIONS[w].name} > ${FACTIONS[l].name} ${pct(r)}`);

if (args.includes('--write')) {
  const date = new Date().toISOString().slice(0, 10);
  const body = `// node tools/matchups.js ${N} --write 로 만든 파일이다. 손으로 고치지 말고 밸런스를 바꾸면 다시 만든다.
// AI끼리 해적단 쌍마다 ${N}판(선후공 번갈아)을 붙인 결과. rate[a][b] = a가 b를 이긴 비율.
export const MATCHUPS = ${JSON.stringify({ games: N, date, rate: table }, null, 1)};
`;
  writeFileSync(new URL('../src/matchups.js', import.meta.url), body);
  console.log(`src/matchups.js 저장 (${date}, 쌍마다 ${N}판)`);
}
