// 📊 승률·상성 화면. 내 전적은 이 브라우저(localStorage)에만 쌓이고,
// AI 상성표는 tools/matchups.js --write 로 미리 계산해 둔 src/matchups.js를 보여 준다.
import { FACTIONS } from './cards.js';
import { DIFFICULTIES } from './difficulty.js';
import { MATCHUPS } from './matchups.js';

const $ = (id) => document.getElementById(id);
const KEY = 'record';
const pct = (x) => `${Math.round(x * 100)}%`;
const fname = (f) => `${FACTIONS[f].emblem} ${FACTIONS[f].name}`;

// record[난이도][내 해적단][상대 해적단] = [승, 판]
function loadRecord() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}

// AI 대전이 끝날 때 한 번 부른다. 친구 모드는 기록하지 않는다.
export function recordResult(diff, mine, rival, won) {
  const rec = loadRecord();
  const cell = ((rec[diff] ??= {})[mine] ??= {})[rival] ??= [0, 0];
  cell[0] += won ? 1 : 0;
  cell[1] += 1;
  try { localStorage.setItem(KEY, JSON.stringify(rec)); } catch {}
}

let tab = 'mine';
let diffFilter = 'all';
let openRow = null; // 내 전적에서 펼친 해적단
let pickRow = null; // 상성표에서 고른 해적단

export function openStats() {
  const tabs = $('stats-tabs');
  tabs.innerHTML = '';
  if (tab === 'ai') tab = 'avg'; // 예전 탭 이름
  for (const [id, label] of [['mine', '🧑 내 전적'], ['avg', '🤖 평균 승률'], ['sd', '📏 표준편차'], ['mx', '🧮 상성표']]) {
    const b = document.createElement('button');
    b.className = `dex-tab${id === tab ? ' on' : ''}`;
    b.setAttribute('role', 'tab');
    b.textContent = label;
    b.onclick = () => { tab = id; openStats(); };
    tabs.append(b);
  }
  const body = $('stats-body');
  body.innerHTML = '';
  if (tab === 'mine') renderMine(body); else renderMatrix(body, tab);
  $('stats').hidden = false;
}

function barRow(label, wins, games, { onClick = null, on = false, tag = 'button' } = {}) {
  const r = games ? wins / games : 0;
  const el = document.createElement(tag);
  el.className = `stats-row${on ? ' on' : ''}`;
  el.innerHTML = `<span class="nm">${label}</span>
    <span class="bar${r < 0.5 ? ' lo' : ''}"><i style="width:${r * 100}%"></i></span>
    <span class="num"><b>${pct(r)}</b> ${wins}승 ${games - wins}패</span>`;
  if (onClick) el.onclick = onClick;
  return el;
}

function renderMine(body) {
  const chips = document.createElement('div');
  chips.className = 'stats-chips';
  for (const [id, label] of [['all', '전체'], ...Object.entries(DIFFICULTIES).map(([id, d]) => [id, `${d.emoji} ${d.name}`])]) {
    const b = document.createElement('button');
    b.className = `stats-chip${id === diffFilter ? ' on' : ''}`;
    b.textContent = label;
    b.onclick = () => { diffFilter = id; openStats(); };
    chips.append(b);
  }
  body.append(chips);

  // 고른 난이도만 합친다: sum[내 해적단][상대] = [승, 판]
  const rec = loadRecord();
  const sum = {};
  for (const [d, mines] of Object.entries(rec)) {
    if (diffFilter !== 'all' && d !== diffFilter) continue;
    for (const [m, rivals] of Object.entries(mines)) {
      if (!FACTIONS[m]) continue; // 지워진 해적단 기록은 건너뛴다
      for (const [r, [w, n]] of Object.entries(rivals)) {
        if (!FACTIONS[r]) continue;
        const c = ((sum[m] ??= {})[r] ??= [0, 0]);
        c[0] += w; c[1] += n;
      }
    }
  }
  const total = (m) => Object.values(sum[m]).reduce(([a, b], [w, n]) => [a + w, b + n], [0, 0]);
  const mines = Object.keys(sum).sort((a, b) => total(b)[1] - total(a)[1]);
  if (!mines.length) {
    body.insertAdjacentHTML('beforeend', '<p class="stats-empty">아직 이 난이도로 AI와 겨룬 기록이 없어요.<br>AI 대전을 끝까지 하면 여기에 쌓입니다.</p>');
    return;
  }
  const [allW, allN] = mines.map(total).reduce(([a, b], [w, n]) => [a + w, b + n], [0, 0]);
  const rows = document.createElement('div');
  rows.className = 'stats-rows';
  rows.append(barRow('⚓ 모든 판', allW, allN, { tag: 'div' }));
  for (const m of mines) {
    const [w, n] = total(m);
    rows.append(barRow(fname(m), w, n, { on: openRow === m, onClick: () => { openRow = openRow === m ? null : m; openStats(); } }));
    if (openRow !== m) continue;
    const detail = document.createElement('div');
    detail.className = 'stats-detail';
    const rivals = Object.entries(sum[m]).sort(([, a], [, b]) => b[0] / b[1] - a[0] / a[1] || b[1] - a[1]);
    for (const [r, [rw, rn]] of rivals) detail.append(barRow(`vs ${fname(r)}`, rw, rn, { tag: 'div' }));
    rows.append(detail);
  }
  body.append(rows);
  body.insertAdjacentHTML('beforeend', '<p class="stats-foot">해적단을 누르면 상대별 전적이 펼쳐집니다. 친구와 대결과 중간에 그만둔 판은 기록하지 않아요. 기록은 이 기기의 브라우저에만 저장됩니다.</p>');
  const actions = document.createElement('div');
  actions.className = 'stats-actions';
  const reset = document.createElement('button');
  reset.className = 'ghost';
  reset.textContent = '🗑️ 기록 지우기';
  reset.onclick = () => {
    if (!confirm('내 전적을 모두 지울까요? 되돌릴 수 없어요.')) return;
    try { localStorage.removeItem(KEY); } catch {}
    openRow = null;
    openStats();
  };
  actions.append(reset);
  body.append(actions);
}

// 표준편차표: 해적단마다 상대별 승률이 얼마나 퍼져 있는지(상대를 얼마나 타는지) 보여 준다.
function renderSpread(body, ids, rate, has, avg, ranked) {
  const sd = (xs) => {
    const m = xs.reduce((x, y) => x + y, 0) / xs.length;
    return Math.sqrt(xs.reduce((n, x) => n + (x - m) ** 2, 0) / xs.length);
  };
  const rows = ranked.map((f) => {
    const list = ids.filter((o) => o !== f && has(f, o)).map((o) => rate[f][o]);
    return { f, avg: avg(f), sd: sd(list), lo: Math.min(...list), hi: Math.max(...list) };
  }).sort((a, b) => b.sd - a.sd);
  if (!rows.length) return;
  const maxSd = Math.max(...rows.map((r) => r.sd));
  const games = MATCHUPS.games || 0;
  const err = games ? Math.sqrt(0.25 / games) : 0; // 승률 50% 근처에서 한 상성 값의 표준오차
  const spreadAvg = sd(rows.map((r) => r.avg));
  body.insertAdjacentHTML('beforeend', `<h3 class="stats-h">상성 표준편차</h3>
    <p class="sub" style="margin:0">해적단마다 상대 16곳에 대한 승률이 평균에서 얼마나 벌어져 있는지예요. 클수록 상대를 많이 타는(가위바위보 같은) 해적단이고, 작을수록 누구와 붙어도 비슷해요.</p>`);
  const wrap = document.createElement('div');
  wrap.className = 'sd-wrap';
  wrap.innerHTML = `<table class="sd">
    <thead><tr><th>해적단</th><th>표준편차</th><th>평균</th><th>최악</th><th>최고</th></tr></thead>
    <tbody>${rows.map((r) => `<tr>
      <td class="nm">${fname(r.f)}</td>
      <td class="sdv"><span class="sdbar"><i style="width:${(r.sd / maxSd) * 100}%"></i></span><b>${(r.sd * 100).toFixed(1)}</b>%p</td>
      <td>${(r.avg * 100).toFixed(1)}%</td>
      <td class="${r.lo < 0.3 ? 'warn' : ''}">${pct(r.lo)}</td>
      <td class="${r.hi > 0.7 ? 'warn' : ''}">${pct(r.hi)}</td>
    </tr>`).join('')}</tbody></table>`;
  body.append(wrap);
  body.insertAdjacentHTML('beforeend', `<p class="stats-foot">해적단 평균 승률끼리의 표준편차는 <b>${(spreadAvg * 100).toFixed(1)}%p</b>예요(작을수록 해적단 사이 힘이 고르다). 쌍마다 ${games}판이라 상성 값 하나에는 ±${(err * 100).toFixed(1)}%p쯤(표준오차) 측정 오차가 있어요. 30% 미만·70% 초과는 붉게 표시했어요.</p>`);
}

// 50%를 가운데로, 낮으면 붉게 높으면 푸르게.
function cellColor(r) {
  const t = Math.min(1, Math.abs(r - 0.5) / 0.3);
  const hue = r >= 0.5 ? 145 : 4;
  return `hsl(${hue} ${30 + 45 * t}% ${30 + 8 * t}%)`;
}

function renderMatrix(body, part) {
  const ids = Object.keys(FACTIONS);
  const rate = MATCHUPS.rate || {};
  const has = (a, b) => rate[a]?.[b] !== undefined;
  const avg = (f) => {
    const list = ids.filter((o) => o !== f && has(f, o)).map((o) => rate[f][o]);
    return list.length ? list.reduce((x, y) => x + y, 0) / list.length : null;
  };

  const ranked = ids.filter((f) => avg(f) !== null).sort((a, b) => avg(b) - avg(a));
  const foot = () => {
    const missing = ids.filter((f) => avg(f) === null);
    body.insertAdjacentHTML('beforeend', `<p class="stats-foot">👀 견문색 AI끼리 해적단 쌍마다 ${MATCHUPS.games}판을 선후공 번갈아 붙인 결과예요 (${MATCHUPS.date} 기준). 사람이 둘 때와는 다를 수 있어요.${missing.length ? ` 아직 측정하지 않은 해적단: ${missing.map((f) => FACTIONS[f].name).join(', ')}.` : ''}</p>`);
  };
  if (part === 'sd') { renderSpread(body, ids, rate, has, avg, ranked); foot(); return; }
  if (part === 'mx') { renderGrid(body, ids, rate, has); foot(); return; }

  body.insertAdjacentHTML('beforeend', '<h3 class="stats-h">해적단 평균 승률</h3>');
  const rows = document.createElement('div');
  rows.className = 'stats-rows';
  for (const f of ranked) {
    const r = avg(f);
    const el = barRow(fname(f), 0, 0, { tag: 'div' });
    el.querySelector('.bar').className = `bar${r < 0.5 ? ' lo' : ''}`;
    el.querySelector('.bar i').style.width = `${r * 100}%`;
    el.querySelector('.num').innerHTML = `<b>${(r * 100).toFixed(1)}%</b>`;
    rows.append(el);
  }
  body.append(rows);
  foot();
}

function renderGrid(body, ids, rate, has) {
  body.insertAdjacentHTML('beforeend', '<h3 class="stats-h">상성표</h3><p class="sub" style="margin:0">가로줄 해적단이 세로줄 해적단을 이긴 비율이에요. 왼쪽 엠블럼을 누르면 그 해적단의 강한 상대와 약한 상대를 보여 줍니다.</p>');
  const pick = document.createElement('p');
  pick.className = 'mx-pick';
  if (pickRow && FACTIONS[pickRow]) {
    const vs = ids.filter((o) => o !== pickRow && has(pickRow, o)).sort((a, b) => rate[pickRow][b] - rate[pickRow][a]);
    const fmt = (o) => `${FACTIONS[o].emblem} ${pct(rate[pickRow][o])}`;
    pick.innerHTML = vs.length
      ? `${fname(pickRow)} · 강한 상대 <b class="up">${vs.slice(0, 3).map(fmt).join(' ')}</b> · 약한 상대 <b class="down">${vs.slice(-3).reverse().map(fmt).join(' ')}</b>`
      : `${fname(pickRow)} · 아직 측정하지 않았어요.`;
  }
  body.append(pick);

  const wrap = document.createElement('div');
  wrap.className = 'mx-wrap';
  const table = document.createElement('table');
  table.className = 'mx';
  const head = document.createElement('tr');
  head.innerHTML = '<th class="corner">나 ↓<br>상대 →</th>' + ids.map((f) => `<th title="${FACTIONS[f].name}" class="${f === pickRow ? 'on' : ''}">${FACTIONS[f].emblem}</th>`).join('');
  table.append(head);
  for (const a of ids) {
    const tr = document.createElement('tr');
    if (pickRow) tr.className = a === pickRow ? 'on' : 'dim';
    const th = document.createElement('th');
    th.textContent = FACTIONS[a].emblem;
    th.title = FACTIONS[a].name;
    th.onclick = () => { pickRow = pickRow === a ? null : a; openStats(); };
    tr.append(th);
    for (const b of ids) {
      const td = document.createElement('td');
      if (a === b) { td.className = 'self'; td.textContent = '·'; }
      else if (!has(a, b)) { td.textContent = '–'; td.title = '아직 측정 안 함'; }
      else {
        const r = rate[a][b];
        td.textContent = Math.round(r * 100);
        td.style.background = cellColor(r);
        td.title = `${FACTIONS[a].name} vs ${FACTIONS[b].name}: ${pct(r)}`;
      }
      tr.append(td);
    }
    table.append(tr);
  }
  wrap.append(table);
  body.append(wrap);
}
