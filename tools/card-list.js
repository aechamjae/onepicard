// 모든 카드의 능력치·키워드·효과와 덱 장수를 CARDS.md로 뽑는다. 사용: node tools/card-list.js
import { writeFileSync } from 'node:fs';
import { CARDS, FACTIONS, KEYWORDS, COMMON } from '../src/cards.js';

const kw = (d) => (d.keywords || []).map((k) => KEYWORDS[k].name).join(', ') || '–';
const stat = (d) => (d.type === 'crew' ? `${d.atk}/${d.hp}` : '전술');
const text = (d) => (d.text || '–').replace(/\|/g, '\\|');
const row = (id, n) => {
  const d = CARDS[id];
  return `| ${d.art} ${d.name} | ${d.token ? '–' : d.cost} | ${stat(d)} | ${kw(d)} | ${text(d)} | ${n} |`;
};
const head = '| 카드 | 비용 | 공/체 | 키워드 | 효과 | 장수 |\n|---|---|---|---|---|---|';
const byCost = (a, b) => CARDS[a].cost - CARDS[b].cost || CARDS[a].name.localeCompare(CARDS[b].name);

// 토큰(불려 나오는 카드)이 어느 해적단 것인지. ui.js 도감과 같은 표.
const tokenHome = { spirit: 'ghost', monkey: 'monkey', spore: 'mush', bunny: 'zoo', blueberry: 'fruit', colossal: 'scout', attacktitan: 'scout', stonewall: 'alchemy' };

const out = [];
out.push(`# onepicard 카드 목록`, '', `해적단 ${Object.keys(FACTIONS).length}개 · 카드 ${Object.keys(CARDS).length}종. \`node tools/card-list.js\`로 만든 파일이라, 카드를 고친 뒤 다시 실행하면 됩니다.`, '');
out.push('## 키워드', '', '| 키워드 | 설명 |', '|---|---|');
for (const k of Object.values(KEYWORDS)) out.push(`| ${k.name} | ${k.desc.replace(/\|/g, '\\|')} |`);
out.push('');

for (const [f, fac] of Object.entries(FACTIONS)) {
  const sk = fac.skill;
  out.push(`## ${fac.emblem} ${fac.name}`, '', fac.desc, '');
  out.push(`**리더 스킬** ${sk.art} ${sk.name} (바람 ${sk.cost}${sk.treasureCost ? ` · 보물 ${sk.treasureCost}` : ''}): ${sk.text}`, '');
  out.push(head);
  const own = Object.keys(fac.deck).filter((id) => !COMMON.has(id)).sort(byCost);
  for (const id of own) out.push(row(id, fac.deck[id]));
  for (const id of Object.keys(CARDS).filter((id) => tokenHome[id] === f).sort(byCost)) out.push(row(id, '토큰'));
  const commons = Object.keys(fac.deck).filter((id) => COMMON.has(id)).sort(byCost);
  out.push('', `공용 카드: ${commons.map((id) => `${CARDS[id].art} ${CARDS[id].name} ${fac.deck[id]}`).join(' · ')}`, '');
}

out.push('## 🃏 공용 카드', '', '장수 칸은 이 카드를 넣은 해적단입니다.', '', head);
for (const id of [...COMMON].sort(byCost)) {
  const users = Object.values(FACTIONS).filter((fac) => fac.deck[id]).map((fac) => `${fac.emblem}${fac.deck[id]}`).join(' ');
  out.push(row(id, users || '없음'));
}
out.push(row('coin', '후공 보너스'), '');

writeFileSync(new URL('../CARDS.md', import.meta.url), out.join('\n'));
console.log(`CARDS.md 저장 (${Object.keys(CARDS).length}종)`);
