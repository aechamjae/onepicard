// 선원 카드의 비용 대비 능력치 점검. 사용: node tools/cost-check.js [--all]
// 점수 = 공격력 + 체력 + 키워드 값 + 효과 값 − (비용 × 2 + 1). 목표는 −2 ~ +2.
// 키워드 값과 효과 값은 어림값이다. 카드를 새로 만들거나 효과를 바꾸면 EFFECT에 값을 적는다.
import { CARDS, FACTIONS, COMMON } from '../src/cards.js';

export const KW_VALUE = {
  charge: 1, guard: 1, plunder: 1, sneak: 1, reach: 1, elastic: 1, tension: 1, ghost: 2, scorch: 1,
  lifesteal: 1, double: 2, shield: 1, thorns: 1, stealth: 1, grow: 2, slash: 1, tailwind: 1, submerge: 1,
  trade: 0, chill: 1, ripen: 2, devour: 1, blood: 1, spore: 1, odm: 1, devotion: 1, titan: 2,
  exchange: 0, material: 0,
};

// 등장·유언·턴 끝 같은 효과의 값(키워드 말고 카드 글에 적힌 효과).
export const EFFECT = {
  lookout: 2, powder: 2, gunner: 1, harpoon: 2, tide: 1, pearl: 1, abyss: 3, pinball: 2,
  lantern: 3, banshee: 1, phantom: 1, spicy: 2, cook: 1, grill: 2, inferno: 4,
  banana: 2, tamer: 2, kingkong: 4, tinker: 3, iai: 1, sensei: 2, swordsaint: 4,
  surveyor: 2, compass: 2, guildmaster: 4, admiral: 4, navigator: 2, clipper: 3,
  pennykid: 2, bodyguard: 1, shady: 2, mercenary: 1, usurer: 3, armsdealer: 1, vaultkeeper: 2, goldcaptain: 2, changer: 1,
  headnurse: 1, sedative: 2, incisor: 3, chiefsurgeon: 4, anatomist: 2,
  gull: 1, cachalot: 1, ghostrats: 2, skewer: 1, coconut: 1, orangutan: 3,
  frostmage: 2, frostqueen: 4, greenapple: 1, cherry: 2, peach: 1, mango: 2, orchardboss: 3, mandarin: 1, lemon: 2,
  panda: 1, elephant: 2, baitfish: 1, sharkboat: 1, squid: 2, culturist: 2, mykos: 3, troll: 1,
  sasha: 1, jean: 1, hange: 2, armin: 2, erwin: 2,
  fuery: 1, hughes: 1, hawkeye: 3, winry: 3, edward: 2, armstrong: 2, kimblee: 2, mustang: 4,
};

export function score(id) {
  const d = CARDS[id];
  const kw = (d.keywords || []).reduce((n, k) => n + (KW_VALUE[k] ?? 0), 0);
  return d.atk + d.hp + kw + (EFFECT[id] ?? 0) - (d.cost * 2 + 1);
}

const owner = {};
for (const [f, fac] of Object.entries(FACTIONS)) for (const id of Object.keys(fac.deck)) (owner[id] ??= []).push(f);

if (import.meta.url === `file://${process.argv[1]}`) {
  const all = process.argv.includes('--all');
  const rows = Object.keys(CARDS)
    .filter((id) => CARDS[id].type === 'crew' && !CARDS[id].token && owner[id])
    .map((id) => [id, score(id)])
    .filter(([, sc]) => all || sc < -2 || sc > 2)
    .sort((a, b) => a[1] - b[1]);
  for (const [id, sc] of rows) {
    const d = CARDS[id];
    const home = COMMON.has(id) ? '공용' : FACTIONS[owner[id][0]].name;
    console.log(`${sc > 0 ? '+' : ''}${sc}\t${d.name} (${home}) ${d.cost}비용 ${d.atk}/${d.hp} ${(d.keywords || []).join(',')}`);
  }
  if (!all) console.log(rows.length ? `범위 밖 ${rows.length}장` : '모든 선원 카드가 −2 ~ +2 안');
}
