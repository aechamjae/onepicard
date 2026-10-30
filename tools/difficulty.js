// 난이도 확인: 사람 실력을 흉내 낸 봇(실수 확률이 다른 세 단계)을 각 난이도의 AI와 붙여 본다.
// 사용: node tools/difficulty.js [판수]
import { createGame, applyAction } from '../src/engine.js';
import { aiNextAction, AI_LEVELS } from '../src/ai.js';
import { FACTIONS } from '../src/cards.js';
import { DIFFICULTIES } from '../src/difficulty.js';

const N = Number(process.argv[2] || 600);
const humans = { 초보: 0.45, 보통: 0.25, 고수: 0 };
for (const [name, mistake] of Object.entries(humans)) AI_LEVELS[name] = { mistake };

const factions = Object.keys(FACTIONS);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
for (const [diffId, diff] of Object.entries(DIFFICULTIES)) {
  const row = [];
  for (const human of Object.keys(humans)) {
    let wins = 0;
    for (let n = 0; n < N; n++) {
      const mine = pick(factions);
      const theirs = pick(factions.filter((f) => f !== mine));
      const s = createGame({ playerFaction: mine, aiFaction: theirs, handicap: diff.handicap });
      for (let steps = 0; s.winner === null; steps++) {
        const action = aiNextAction(s, s.current === 0 ? human : diff.ai);
        const err = applyAction(s, action);
        if (err) throw new Error(`잘못된 행동: ${err} ${JSON.stringify(action)}`);
        if (steps > 3000) throw new Error('게임이 끝나지 않음');
      }
      if (s.winner === 0) wins++;
    }
    row.push(`${human} ${Math.round((wins / N) * 100)}%`);
  }
  console.log(`${diff.emoji} ${diff.name}: 사람 승률 → ${row.join(' · ')}`);
}
