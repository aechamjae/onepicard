// 화면 그리기, 연출, 입력 처리. 규칙 판단은 모두 engine.js에 맡긴다.
import { CARDS, FACTIONS, KEYWORDS, COMMON } from './cards.js';
import { RULES, STUN, createGame, applyAction, canPlay, canUseSkill, costOf, legalAttackTargets, hasKeyword, targetable } from './engine.js';
import { aiNextAction } from './ai.js';
import { DIFFICULTIES } from './difficulty.js';
import { openStats, recordResult } from './stats.js';
import { cardCondition, skillCondition } from './conditions.js';
import { playAttackFx, playRubberFx, hasAttackFx } from './fx.js';

// 화면 아래쪽(나)과 위쪽(상대)에 놓일 플레이어. 친구 모드에서는 턴마다 뒤바뀐다.
let ME = 0;
let FOE = 1;
const AI_DELAY = 550;

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let state = null;
let selected = null; // {kind:'hand', index} | {kind:'attacker', uid}
let busy = false; // 연출 중이거나 AI 차례
let session = 0; // 판마다 바뀐다. 홈으로 나가면 진행 중이던 연출과 AI 턴을 멈추는 데 쓴다.
let difficulty = loadDifficulty();
let mode = loadMode(); // 'ai' | 'duo'(친구와 한 폰에서 번갈아)
let rivalMode = loadRivalMode(); // AI 대전에서 상대 해적단: 'random' | 'choose'
let order = loadOrder(); // AI 대전에서 내 순서: 'random' | 'first'(선공) | 'second'(후공)
let firstPick = null; // 두 번 고르는 흐름(친구 모드, AI 상대 직접 고르기)에서 먼저 고른 해적단

function loadMode() {
  try { if (localStorage.getItem('mode') === 'duo') return 'duo'; } catch {}
  return 'ai';
}
// 공격 연출(해적단별 이펙트) 켬/끔. 끄면 모든 공격이 가볍게 돌진만 한다.
let fxOn = (() => { try { return localStorage.getItem('fx') !== 'off'; } catch { return true; } })();
function renderFxBtn() {
  $('fx-btn').textContent = fxOn ? '✨ 연출 켬' : '💤 연출 끔';
  $('fx-btn').setAttribute('aria-pressed', String(fxOn));
}

function loadOrder() {
  try { const v = localStorage.getItem('order'); if (v === 'first' || v === 'second') return v; } catch {}
  return 'random';
}
function loadRivalMode() {
  try { if (localStorage.getItem('rival') === 'choose') return 'choose'; } catch {}
  return 'random';
}
const isDuo = () => mode === 'duo' && !tutorialOn;
let tutorialOn = false; // 튜토리얼 판: 쉬운 AI, 전적에 남기지 않는다
// 해적단을 두 번 고르는가: 친구 모드(1P, 2P) 또는 AI 대전에서 상대를 직접 고를 때(나, 상대).
const twoPicks = () => isDuo() || rivalMode === 'choose';
const randomFaction = (except = null) => {
  const ids = Object.keys(FACTIONS).filter((f) => f !== except);
  return ids[Math.floor(Math.random() * ids.length)];
};
// 화면에 보일 이름: AI 대전은 나/AI, 친구 모드는 1P/2P.
const label = (pi) => (isDuo() ? state.players[pi].name : pi === ME ? '당신' : 'AI');

function loadDifficulty() {
  try {
    const saved = localStorage.getItem('difficulty');
    if (saved in DIFFICULTIES) return saved;
  } catch {}
  return 'normal';
}

const skillOf = (pi) => FACTIONS[state.players[pi].factionId].skill;

// 지금 고른 카드나 스킬이 요구하는 대상 종류('foeCrew' | 'allyCrew' | undefined)
function selectedTargetKind() {
  if (selected?.kind === 'hand') return CARDS[state.players[ME].hand[selected.index].defId].target;
  if (selected?.kind === 'skill') return skillOf(ME).target;
  return undefined;
}

const compactQuery = matchMedia('(orientation: landscape) and (max-height: 520px)');
const isMyTurn = () => state && state.current === ME && state.winner === null && !busy;

// ── 고무팔 그리기 ──

// (x0,y0)→(x1,y1)로 출렁이는 고무팔 경로. 양 끝은 곧고 가운데가 크게 출렁인다.
function armPath(x0, y0, x1, y1, waves, amp) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const steps = Math.max(12, Math.round(waves * 10));
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const off = Math.sin(t * waves * Math.PI * 2) * amp * Math.sin(t * Math.PI);
    d += `${i ? 'L' : 'M'}${(x0 + dx * t + nx * off).toFixed(1)} ${(y0 + dy * t + ny * off).toFixed(1)}`;
  }
  return d;
}

// 카드 그림: 얼굴 + 옆으로 뻗은 고무팔. 탄력이 쌓일수록 팔이 짧게 감겨 당겨진다.
function armArt(face, tension = 0) {
  const x1 = 88 - tension * 13;
  const d = armPath(30, 34, x1, 30, 1.5 + tension, 4 + tension * 2.5);
  return `<svg class="arm-art" viewBox="0 0 100 60" aria-hidden="true">
      <path d="${d}" class="arm-outline"/><path d="${d}" class="arm-skin"/>
      <circle cx="${x1}" cy="30" r="9" class="glove"/><path d="M${x1 - 5} 25 q4 -3 8 0" class="glove-shine"/>
    </svg><span class="face">${face}</span>`;
}

// ── 그리기 ──

// owner: 손패 카드의 주인. 주면 순풍으로 깎인 비용을 보여 준다.
function cardEl(card, factionId, { inHand = false, showText = inHand, owner = null, foe = null } = {}) {
  const d = CARDS[card.defId];
  const el = document.createElement('div');
  el.className = `card ${d.type} f-${factionId}`;
  el.dataset.uid = card.uid;
  const isCrew = d.type === 'crew';
  const tension = card.tension || 0;
  const atk = (card.atk ?? d.atk) + tension;
  const hp = card.hp ?? d.hp;
  const chips = [...(d.keywords || []), ...(card.gained || [])].map((k) => `<span class="chip k-${k}">${KEYWORDS[k].name}</span>`).join('');
  const cost = owner ? costOf(owner, card) : d.cost;
  // 손패: 상황에 따라 달라지는 효과가 지금 어떻게 되는지 꼬리표로 보여 준다.
  const cond = owner && foe ? cardCondition(owner, foe, card) : null;
  const condHtml = cond ? `<div class="cond c-${cond.tone}" title="${cond.long}">${cond.short}</div>` : '';
  el.innerHTML = `
    <div class="frame">
      <div class="art">${d.arm ? armArt(d.art, tension) : `<span class="emoji">${d.art}</span>`}${condHtml}</div>
      <div class="name">${d.name}</div>
      ${chips ? `<div class="chips">${chips}</div>` : ''}
      ${showText && d.text ? `<div class="text">${d.text}</div>` : ''}
      ${!isCrew ? '<div class="ribbon">전술</div>' : ''}
    </div>
    ${inHand ? `<div class="cost${cost < d.cost ? ' cheap' : ''}">${cost}</div>` : ''}
    ${isCrew ? `<div class="gem atk${tension ? ' boost' : ''}">${atk}</div>
      <div class="gem hp${card.maxHp && hp < card.maxHp ? ' hurt' : ''}">${hp}</div>` : ''}
    ${tension ? `<div class="tension">탄력+${tension}</div>` : ''}
    ${statusIcons(card)}
    ${stunKey(card) ? `<div class="stun-tag" title="${stunOf(card).name}: 공격할 수 없다">${stunOf(card).icon} ${stunOf(card).name}</div>` : ''}`;
  if (card.revived) el.classList.add('revived');
  if (stunKey(card)) el.classList.add('stunned', `stun-${stunKey(card)}`);
  if (card.shield) el.classList.add('shielded');
  if (card.stealth) el.classList.add('stealthy');
  return el;
}

// 다음 턴(또는 이번 턴) 공격을 못 하게 된 원인. 얼음, 닻, 바나나 껍질 등.
function stunOf(card) {
  if (card.frozen) return STUN[card.frozenBy || 'ice'];
  if (card.held) return STUN[card.heldBy || 'ice'];
  return null;
}
function stunKey(card) {
  return card.frozen ? card.frozenBy || 'ice' : card.held ? card.heldBy || 'ice' : null;
}

function statusIcons(card) {
  const icons = [];
  if (card.shield) icons.push('<span title="보호막">🛡</span>');
  if (card.stealth) icons.push('<span title="안개 속에 숨음">🌫</span>');
  if (card.burning) icons.push('<span title="불붙음: 턴 시작마다 피해">🔥</span>');
  if (card.revived) icons.push('<span title="망령으로 되살아남">👻</span>');
  if (card.submerged) icons.push('<span title="잠항 중: 공격·대상 지정 불가">🌊</span>');
  if (card.grown) icons.push(`<span title="성장">⚙${card.grown}</span>`);
  return icons.length ? `<div class="status">${icons.join('')}</div>` : '';
}

function hudHtml(p, mine) {
  const f = FACTIONS[p.factionId];
  const hull = Math.max(0, p.hull);
  const pct = Math.min(100, (hull / p.maxHull) * 100);
  const coins = Array.from({ length: RULES.treasureToWin }, (_, i) => `<i class="${i < p.treasure ? 'on' : ''}"></i>`).join('');
  const sails = Array.from({ length: p.maxWind }, (_, i) => `<i class="${i < p.wind ? 'on' : ''}"></i>`).join('');
  return `
    <div class="hud-top">
      <span class="emblem">${f.emblem}</span><span class="hud-name">${f.name}</span>
      <span class="tag">${isDuo() ? p.name : mine ? '나' : 'AI'}</span>
      <span class="counts">🂠 ${p.hand.length} · 덱 ${p.deck.length}</span>
    </div>
    <div class="meter" title="선체">
      <span>🚢</span><div class="bar${pct <= 35 ? ' low' : ''}"><i style="width:${pct}%"></i></div><b>${hull}</b>
    </div>
    <div class="row">
      <span class="pips coins" title="보물">💰 ${coins}<b>${p.treasure}/${RULES.treasureToWin}</b></span>
      <span class="pips sails" title="바람">⛵ ${sails}<b>${p.wind}/${p.maxWind}</b></span>
    </div>`;
}

function validTargets() {
  const none = { foeCrew: [], allyCrew: [], ship: false };
  if (!selected || !isMyTurn()) return none;
  if (selected.kind === 'attacker') {
    const attacker = state.players[ME].board.find((c) => c.uid === selected.uid);
    const legal = legalAttackTargets(state, ME, attacker);
    return { foeCrew: legal.filter((t) => t !== 'ship'), allyCrew: [], ship: legal.includes('ship') };
  }
  const kind = selectedTargetKind();
  return {
    foeCrew: kind === 'foeCrew' ? targetable(state.players[FOE].board).map((c) => c.uid) : [],
    allyCrew: kind === 'allyCrew' ? state.players[ME].board.map((c) => c.uid) : [],
    ship: false,
  };
}

function render(entered = new Set()) {
  const me = state.players[ME];
  const foe = state.players[FOE];
  const myTurn = isMyTurn();
  const targets = validTargets();

  const foeHud = $('foe-hud');
  foeHud.innerHTML = hudHtml(foe, false);
  foeHud.classList.toggle('targetable', targets.ship);
  $('my-hud').innerHTML = hudHtml(me, true);

  const drawBoard = (boardEl, player, decorate) => {
    boardEl.innerHTML = '';
    for (const c of player.board) {
      const el = cardEl(c, player.factionId);
      if (entered.has(c.uid)) el.classList.add('enter');
      decorate(el, c);
      boardEl.append(el);
    }
  };
  // 대상을 고르는 중이면, 고를 수 없는 카드는 흐리게 해서 '칠 수 있는 카드'가 확실히 구분되게 한다.
  const aimingFoe = targets.foeCrew.length > 0 || targets.ship;
  const aimingAlly = targets.allyCrew.length > 0;
  drawBoard($('foe-board'), foe, (el, c) => {
    if (targets.foeCrew.includes(c.uid)) el.classList.add('targetable');
    else if (aimingFoe) el.classList.add('untargetable');
    el.onclick = () => onFoeCrew(c.uid);
  });
  drawBoard($('my-board'), me, (el, c) => {
    if ((myTurn || canQueue()) && c.canAttack) el.classList.add('ready');
    if (selected?.kind === 'attacker' && selected.uid === c.uid) el.classList.add('selected');
    if (targets.allyCrew.includes(c.uid)) el.classList.add('targetable');
    else if (aimingAlly) el.classList.add('untargetable');
    el.onclick = () => onMyCrew(c.uid);
  });

  const hand = $('hand');
  hand.innerHTML = '';
  let anyPlayable = false;
  me.hand.forEach((card, i) => {
    const el = cardEl(card, me.factionId, { inHand: true, owner: me, foe });
    const playable = myTurn && !canPlay(state, ME, i);
    anyPlayable ||= playable;
    el.classList.add(playable ? 'playable' : 'unaffordable');
    if (selected?.kind === 'hand' && selected.index === i) el.classList.add('selected');
    el.onclick = () => onHand(i);
    hand.append(el);
  });

  const anyReady = me.board.some((c) => c.canAttack);
  const sk = skillOf(ME);
  const skillBtn = $('skill-btn');
  const skillErr = canUseSkill(state, ME);
  const skCond = skillCondition(me, foe);
  skillBtn.innerHTML = `<span class="sk-cost">${sk.cost}</span>${sk.art} ${sk.name}${sk.treasureCost ? ` <small>💰${sk.treasureCost}</small>` : ''}${skCond ? `<small class="sk-cond c-${skCond.tone}">${skCond.short}</small>` : ''}`;
  skillBtn.title = `리더 스킬: ${sk.text}${skCond ? ` · ${skCond.long}` : ''}`;
  skillBtn.disabled = !myTurn;
  skillBtn.classList.toggle('usable', myTurn && !skillErr);
  skillBtn.classList.toggle('used', me.skillUsed);
  skillBtn.classList.toggle('selected', selected?.kind === 'skill');

  const endBtn = $('end-btn');
  endBtn.disabled = !myTurn;
  endBtn.classList.toggle('nudge', myTurn && !anyPlayable && !anyReady && !!skillErr);
  $('hint').textContent = hintText(myTurn);

  const log = $('log');
  log.innerHTML = state.log.map((l) => `<li>${l}</li>`).join('');
  log.scrollTop = log.scrollHeight;
}

function hintText(myTurn) {
  if (state.winner !== null) return '';
  if (!myTurn) return state.current === FOE && !isDuo() ? '🤖 AI가 공격을 준비하는 중...' : '';
  if (selected?.kind === 'attacker') {
    const c = state.players[ME].board.find((c) => c.uid === selected.uid);
    return CARDS[c.defId].arm ? '🤸 팔을 뻗을 적 선원이나 적 배를 고르세요!' : '⚔ 공격할 적 선원이나 적 배를 고르세요.';
  }
  if (selected?.kind === 'skill') {
    const sk = skillOf(ME);
    const sc = skillCondition(state.players[ME], state.players[FOE]);
    return `✨「${sk.name}」 ${sk.text}${sc ? ` · 👉 ${sc.long}` : ''} · ${sk.target === 'foeCrew' ? '🎯 대상 적 선원을 고르세요.' : '🎯 대상 아군 선원을 고르세요.'}`;
  }
  if (selected?.kind === 'hand') {
    const card = state.players[ME].hand[selected.index];
    const d = CARDS[card.defId];
    const kws = (d.keywords || []).map((k) => KEYWORDS[k].name).join('·');
    const cond = cardCondition(state.players[ME], state.players[FOE], card);
    const about = `「${d.name}」 ${[kws && `[${kws}]`, d.text].filter(Boolean).join(' ')}${cond ? ` · 👉 ${cond.long}` : ''}`;
    if (!d.target) return `${about} · 한 번 더 누르면 낸다`;
    return `${about} · ${d.target === 'foeCrew' ? '🎯 대상 적 선원을 고르세요.' : '🎯 대상 아군 선원을 고르세요.'}`;
  }
  return '카드를 내거나, 빛나는 선원을 눌러 공격하세요.';
}

// ── 연출 ──

const centerOf = (el) => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};
const crewEl = (uid) => document.querySelector(`.deck-board [data-uid="${uid}"]`);
const hudOf = (pi) => $(pi === ME ? 'my-hud' : 'foe-hud');

function floatText(pt, text, cls = '') {
  const el = document.createElement('div');
  el.className = `float ${cls}`;
  el.textContent = text;
  el.style.left = `${pt.x}px`;
  el.style.top = `${pt.y}px`;
  document.body.append(el);
  setTimeout(() => el.remove(), 950);
}

function burst(pt, emoji = '💥') {
  const el = document.createElement('div');
  el.className = 'burst';
  el.textContent = emoji;
  el.style.left = `${pt.x}px`;
  el.style.top = `${pt.y}px`;
  document.body.append(el);
  setTimeout(() => el.remove(), 420);
}


// 고무팔이 아닌 선원은 몸으로 돌진한다.
function lunge(el, from, to) {
  const dx = (to.x - from.x) * 0.6;
  const dy = (to.y - from.y) * 0.6;
  setTimeout(() => burst(to), 210);
  return el.animate(
    [{ transform: 'none' }, { transform: `translate(${dx}px, ${dy}px) scale(1.1)`, offset: 0.55 }, { transform: 'none' }],
    { duration: 400, easing: 'ease-in-out' },
  ).finished;
}

async function animateAttack(action) {
  const pi = state.current;
  const crew = state.players[pi].board.find((c) => c.uid === action.attacker);
  const attackerEl = crewEl(action.attacker);
  const targetEl = action.target === 'ship' ? hudOf(1 - pi) : crewEl(action.target);
  if (!crew || !attackerEl || !targetEl) return;
  const from = centerOf(attackerEl);
  const to = centerOf(targetEl);
  const factionId = state.players[pi].factionId;
  if (!fxOn) {
    await lunge(attackerEl, from, to);
  } else if (CARDS[crew.defId].arm) {
    await playRubberFx({ from, to, aEl: attackerEl, tEl: targetEl, tension: crew.tension || 0 });
  } else if (hasAttackFx(factionId) && !COMMON.has(crew.defId)) { // 공용 카드는 해적단 연출 없이 가볍게 돌진한다
    await playAttackFx(factionId, { from, to, aEl: attackerEl, tEl: targetEl });
  } else {
    await lunge(attackerEl, from, to);
  }
}

function showBanner(html, ms = 1100) {
  const b = $('banner');
  b.innerHTML = html;
  b.classList.remove('show');
  void b.offsetWidth;
  b.classList.add('show');
  return sleep(ms * 0.8);
}

async function showCast(card, pi) {
  const wrap = document.createElement('div');
  wrap.append(cardEl(card, state.players[pi].factionId, { inHand: true }));
  wrap.insertAdjacentHTML('beforeend', `<span class="who">${pi === ME ? '사용!' : `${label(pi)}이(가) 냈다!`}</span>`);
  await showBanner(wrap.innerHTML, 1000);
}

function snapshot() {
  const crews = new Map();
  state.players.forEach((p, pi) => p.board.forEach((c) => crews.set(c.uid, {
    hp: c.hp, maxHp: c.maxHp, atk: c.atk, pi, elastic: hasKeyword(c, 'elastic'), shield: c.shield,
    stun: stunKey(c), burning: c.burning, stealth: c.stealth, gained: (c.gained || []).length, tension: c.tension || 0,
  })));
  return { crews, hull: state.players.map((p) => p.hull), treasure: state.players.map((p) => p.treasure) };
}

// 행동 전후를 비교해 피해 숫자, 침몰, 보물 획득을 아직 남아 있는 옛 화면 위에 보여 준다.
async function showAftermath(before) {
  let wait = 0;
  const now = new Map();
  state.players.forEach((p) => p.board.forEach((c) => now.set(c.uid, c)));
  for (const [uid, b] of before.crews) {
    const el = crewEl(uid);
    if (!el) continue;
    const c = now.get(uid);
    if (!c) {
      const bounced = state.players[b.pi].hand.some((h) => h.uid === uid);
      el.classList.add(bounced ? 'yeet' : 'dying');
      floatText(centerOf(el), bounced ? '휘익~' : '☠', 'word');
      wait = 430;
    } else if (c.hp < b.hp) {
      floatText(centerOf(el), `-${b.hp - c.hp}`);
      el.classList.add(b.elastic ? 'boing' : 'hit');
      wait = Math.max(wait, 220);
    } else if (b.shield && !c.shield) {
      floatText(centerOf(el), '🛡 막았다!', 'word');
      el.classList.add('boing');
      wait = Math.max(wait, 220);
    } else if (c.hp > b.hp) {
      floatText(centerOf(el), `+${c.hp - b.hp}`, 'heal');
    }
    if (c) wait = Math.max(wait, showChanges(el, b, c));
  }
  state.players.forEach((p, pi) => {
    const hud = hudOf(pi);
    const dh = p.hull - before.hull[pi];
    if (dh < 0) {
      floatText(centerOf(hud), `${dh}`);
      hud.classList.remove('hit');
      void hud.offsetWidth;
      hud.classList.add('hit');
      wait = Math.max(wait, 220);
    } else if (dh > 0) floatText(centerOf(hud), `+${dh}`, 'heal');
    const dt = p.treasure - before.treasure[pi];
    if (dt > 0) {
      const pt = centerOf(hud);
      setTimeout(() => floatText({ x: pt.x + 40, y: pt.y }, `+💰${dt}`, 'gold'), 150);
    }
  });
  if (wait) await sleep(wait);
}

// 피해 말고 바뀐 것(공격력, 상태이상, 불, 보호막, 얻은 키워드…)을 카드 위에 차례로 띄운다.
// 등장 효과나 전술이 어디에 걸렸는지 한눈에 보이게 한다. 기다릴 시간(ms)을 돌려준다.
function showChanges(el, b, c) {
  const notes = [];
  if (c.atk !== b.atk) notes.push([`공격력 ${c.atk > b.atk ? '+' : ''}${c.atk - b.atk}`, c.atk > b.atk ? 'buff' : 'debuff']);
  if (c.maxHp > b.maxHp) notes.push([`최대 체력 +${c.maxHp - b.maxHp}`, 'heal']);
  const st = stunKey(c);
  if (st && st !== b.stun) notes.push([`${STUN[st].icon} ${STUN[st].name}`, `status stun-${st}`]);
  if (c.burning && !b.burning) notes.push(['🔥 불붙음', 'status burn']);
  if (!c.burning && b.burning) notes.push(['💧 불 꺼짐', 'status']);
  if (c.shield && !b.shield) notes.push(['🛡 보호막', 'status']);
  if (c.stealth && !b.stealth) notes.push(['🌫 안개', 'status']);
  if ((c.gained || []).length > b.gained) notes.push([`+ ${KEYWORDS[c.gained[c.gained.length - 1]].name}`, 'buff']);
  if ((c.tension || 0) > b.tension) notes.push([`탄력 +${c.tension - b.tension}`, 'buff']);
  if (!notes.length) return 0;
  el.classList.remove('affected');
  void el.offsetWidth;
  el.classList.add('affected');
  const pt = centerOf(el);
  notes.forEach(([t, cls], i) => setTimeout(() => floatText({ x: pt.x, y: pt.y - 10 - i * 4 }, t, `note ${cls}`), i * 220));
  return 300 + notes.length * 160;
}

// 한 행동을 연출과 함께 실행한다. 성공하면 true.
async function perform(action) {
  const game = session;
  const pi = state.current;
  const before = snapshot();
  if (action.type === 'attack') {
    const a = state.players[pi].board.find((c) => c.uid === action.attacker);
    if (a?.canAttack && legalAttackTargets(state, pi, a).includes(action.target)) await animateAttack(action);
  } else if (action.type === 'skill') {
    if (!canUseSkill(state, pi)) {
      const sk = skillOf(pi);
      await showBanner(`✨ ${sk.art} ${sk.name}<span class="who">${pi === ME ? '리더 스킬!' : `${label(pi)} 리더 스킬!`}</span>`, 900);
    }
  } else if (action.type === 'play') {
    const card = state.players[pi].hand[action.handIndex];
    if (card && !canPlay(state, pi, action.handIndex) && (pi === FOE || CARDS[card.defId].type === 'tactic')) {
      await showCast(card, pi);
    }
  }
  if (game !== session) return false; // 연출 도중 홈으로 나갔다
  const err = applyAction(state, action);
  if (err) {
    toast(err);
    render();
    return false;
  }
  await showAftermath(before);
  if (game !== session) return false;
  const entered = new Set();
  state.players.forEach((p) => p.board.forEach((c) => { if (!before.crews.has(c.uid)) entered.add(c.uid); }));
  render(entered);
  if (state.winner !== null) showGameOver();
  return true;
}

// ── 입력 ──

// 내 행동이 연출 중일 때 다음 공격을 미리 골라 둘 수 있다(연타). 연출이 끝나면 바로 이어서 친다.
let acting = false;
let queued = null;
const canQueue = () => acting && state && state.current === ME && state.winner === null;

async function act(action) {
  if (action.type === 'attack') tutFlags.attacks++;
  busy = true;
  acting = true;
  selected = null;
  render();
  await perform(action);
  acting = false;
  busy = false;
  const next = queued;
  queued = null;
  if (next && isMyTurn()) {
    const a = state.players[ME].board.find((c) => c.uid === next.attacker);
    if (a?.canAttack && legalAttackTargets(state, ME, a).includes(next.target)) { act(next); return; }
    // 미리 눌러 둔 대상이 그사이 쓰러졌으면, 공격자는 고른 채로 두고 새 대상만 누르게 한다.
    selected = a?.canAttack ? { kind: 'attacker', uid: a.uid } : null;
  }
  render();
}

// 연출 중에 다음 공격자를 고른다. 판을 다시 그리지 않고 표시만 바꾼다(그리면 연출이 끊긴다).
function preselect(uid) {
  document.querySelectorAll('.card.selected').forEach((el) => el.classList.remove('selected'));
  selected = { kind: 'attacker', uid };
  crewEl(uid)?.classList.add('selected');
}

function onHand(i) {
  if (!isMyTurn()) return;
  const d = CARDS[state.players[ME].hand[i].defId];
  const again = selected?.kind === 'hand' && selected.index === i;
  if (again && (d.target || !compactQuery.matches)) { selected = null; render(); return; }
  const err = canPlay(state, ME, i);
  if (err) { toast(err); return; }
  // 카드가 작은 화면에서는 첫 번째 누름에 설명을 보여 주고, 두 번째에 낸다.
  if (d.target || (compactQuery.matches && !again)) { selected = { kind: 'hand', index: i }; render(); return; }
  act({ type: 'play', handIndex: i });
}

// 고른 카드나 스킬을 대상에게 쓴다.
function useOn(uid) {
  if (selected.kind === 'skill') act({ type: 'skill', target: uid });
  else act({ type: 'play', handIndex: selected.index, target: uid });
}

function onSkill() {
  if (!isMyTurn()) return;
  if (selected?.kind === 'skill') { selected = null; render(); return; }
  const err = canUseSkill(state, ME);
  if (err) { toast(err); return; }
  if (skillOf(ME).target) { selected = { kind: 'skill' }; render(); return; }
  act({ type: 'skill' });
}

function onMyCrew(uid) {
  const c = state.players[ME].board.find((c) => c.uid === uid);
  if (canQueue() && c?.canAttack && !queued) { preselect(uid); return; }
  if (!isMyTurn()) { inspect(c, ME); return; }
  if (selectedTargetKind() === 'allyCrew') { useOn(uid); return; }
  // 고른 선원을 한 번 더 누르면 그 선원의 상태와 정보를 보여 준다.
  if (selected?.kind === 'attacker' && selected.uid === uid) { selected = null; render(); inspect(c, ME); return; }
  if (!c.canAttack) { inspect(c, ME); return; }
  selected = { kind: 'attacker', uid };
  render();
}

function onFoeCrew(uid) {
  const c = state.players[FOE].board.find((c) => c.uid === uid);
  if (canQueue() && selected?.kind === 'attacker') { queued = { type: 'attack', attacker: selected.uid, target: uid }; return; }
  if (!isMyTurn() || !selected) { inspect(c, FOE); return; }
  if (selected.kind === 'attacker') {
    act({ type: 'attack', attacker: selected.uid, target: uid });
  } else if (selectedTargetKind() === 'foeCrew') {
    if (c.stealth) { toast('안개 속에 숨어 있어 고를 수 없다.'); return; }
    useOn(uid);
  }
}

function onFoeShip() {
  if (canQueue() && selected?.kind === 'attacker') { queued = { type: 'attack', attacker: selected.uid, target: 'ship' }; return; }
  if (!isMyTurn() || selected?.kind !== 'attacker') return;
  act({ type: 'attack', attacker: selected.uid, target: 'ship' });
}

async function endTurn() {
  if (!isMyTurn()) return;
  selected = null;
  busy = true;
  await perform({ type: 'end' });
  if (isDuo()) handOff();
  else await runAI();
}

// 친구 모드: 화면을 가리고, 넘겨받은 사람이 누르면 그 사람 시점으로 뒤집는다.
function handOff() {
  if (state.winner !== null) { busy = false; return; }
  $('handoff-title').textContent = `${state.players[state.current].name} 차례`;
  $('handoff-emoji').textContent = FACTIONS[state.players[state.current].factionId].emblem;
  $('handoff').hidden = false;
}

function takeOver() {
  $('handoff').hidden = true;
  ME = state.current;
  FOE = 1 - ME;
  busy = false;
  render();
  showBanner(`⚓ ${state.players[ME].name} 차례!`, 900);
}

async function runAI() {
  const game = session;
  if (state.winner !== null) { busy = false; return; }
  render();
  await showBanner('🤖 AI의 차례', 900);
  for (let steps = 0; state.current === FOE && state.winner === null; steps++) {
    await sleep(AI_DELAY);
    if (game !== session) return; // 홈으로 나갔다
    const action = steps > 40 ? { type: 'end' } : aiNextAction(state, tutorialOn ? 'easy' : DIFFICULTIES[difficulty].ai);
    const ok = await perform(action);
    if (game !== session) return;
    if (!ok) await perform({ type: 'end' }); // 안전장치
  }
  if (game !== session) return;
  busy = false;
  render();
  if (state.winner === null) showBanner('⚓ 내 차례!', 900);
}

// 카드를 크게 보여 준다. 판 위 선원이면 원래 수치와 달라진 점도 함께 보여 준다.
function inspect(card, pi, factionId = state.players[pi].factionId) {
  if (!card) return;
  if (pi === ME && state.players[ME].board.includes(card)) tutFlags.inspected = true;
  const d = CARDS[card.defId];
  const box = document.createElement('div');
  box.className = 'inspect-box';
  box.append(cardEl(card, factionId, { showText: true, inHand: !('hp' in card) }));
  box.insertAdjacentHTML('beforeend', origHtml(card));
  const kws = [
    ...(d.keywords || []).map((k) => `<li><b>${KEYWORDS[k].name}</b> ${KEYWORDS[k].desc}</li>`),
    ...(card.gained || []).filter((k) => !(d.keywords || []).includes(k)).map((k) => `<li><b>${KEYWORDS[k].name}</b> <i>(효과로 얻음)</i> ${KEYWORDS[k].desc}</li>`),
  ];
  if (card.tension) kws.push(`<li><b>탄력 ${card.tension}</b> 공격력 +${card.tension} (반격 포함, 공격하면 풀림)</li>`);
  const st = stunOf(card);
  if (st) kws.push(`<li><b>${st.icon} ${st.name}</b> ${card.frozen ? '다음 턴에 공격할 수 없다.' : '이번 턴에 공격할 수 없다.'}</li>`);
  if (card.burning) kws.push(`<li><b>🔥 불붙음</b> 주인의 턴이 시작될 때마다 ${RULES.burnDamage} 피해.</li>`);
  if (card.revived) kws.push('<li><b>👻 되살아남</b> 이미 한 번 되살아났다.</li>');
  if (card.submerged) kws.push('<li><b>🌊 잠항 중</b> 내 다음 턴이 올 때까지 공격하거나 대상으로 고를 수 없다.</li>');
  if (card.grown) kws.push(`<li><b>⚙ 성장 ${card.grown}</b> 태엽이 감겨 강해졌다.</li>`);
  if (kws.length) box.insertAdjacentHTML('beforeend', `<ul class="kw-list">${kws.join('')}</ul>`);
  const ov = $('inspect');
  ov.innerHTML = '';
  ov.append(box);
  ov.hidden = false;
}

// 원래 카드 수치. 판 위에서 달라졌으면 지금 수치와 나란히 보여 준다.
function origHtml(card) {
  const d = CARDS[card.defId];
  const base = d.type === 'crew' ? `비용 ${d.cost} · 공격력 ${d.atk} · 체력 ${d.hp}` : `비용 ${d.cost} · 전술 카드`;
  const rows = [`<div><b>원래 카드</b> ${base}</div>`];
  if (d.type === 'crew' && 'hp' in card) {
    const changes = [];
    if (card.atk !== d.atk) changes.push(`공격력 ${d.atk} → ${card.atk}`);
    if (card.maxHp !== d.hp) changes.push(`최대 체력 ${d.hp} → ${card.maxHp}`);
    if (card.hp < card.maxHp) changes.push(`피해 ${card.maxHp - card.hp} 입음`);
    if (changes.length) rows.push(`<div><b>지금</b> ${changes.join(' · ')}</div>`);
  }
  return `<div class="orig">${rows.join('')}</div>`;
}

// 내 덱: 덱에 넣은 카드마다 원래 모습과, 덱에 몇 장 남았는지 보여 준다. 누르면 키워드 설명까지 크게 본다.
function openDeck() {
  const p = state.players[ME];
  const f = FACTIONS[p.factionId];
  const sk = f.skill;
  $('deck-desc').innerHTML = `${f.emblem} <b>${f.name}</b> — ${f.desc} 남은 덱 ${p.deck.length}장 · 손패 ${p.hand.length}장.`
    + `<span class="dex-skill">✨ 리더 스킬 ${sk.art} <b>${sk.name}</b> (바람 ${sk.cost}${sk.treasureCost ? ` · 보물 ${sk.treasureCost}` : ''}) — ${sk.text}</span>`;
  const box = $('deck-cards');
  box.innerHTML = '';
  const ids = Object.keys(f.deck).sort((a, b) => CARDS[a].cost - CARDS[b].cost || CARDS[a].name.localeCompare(CARDS[b].name));
  for (const id of ids) {
    const left = p.deck.filter((c) => c.defId === id).length;
    const inHand = p.hand.filter((c) => c.defId === id).length;
    const wrap = document.createElement('div');
    wrap.className = `dex-item${left ? '' : ' spent'}`;
    const el = cardEl({ uid: id, defId: id }, p.factionId, { inHand: true });
    el.onclick = () => inspect({ uid: id, defId: id }, ME, p.factionId);
    el.style.cursor = 'pointer';
    wrap.append(el);
    wrap.insertAdjacentHTML('beforeend', `<span class="dex-count">덱에 ${left} / ${f.deck[id]}장${inHand ? ` · 손패 ${inHand}` : ''}</span>`);
    box.append(wrap);
  }
  $('deck-ov').hidden = false;
}

let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

// ── 카드 도감 ──

// 덱 장수를 고유·공용으로 나눠 적는다. 예: 덱 30장(고유 25 · 공용 5)
// part가 'own'·'common'이면 그 장수만 돌려준다.
function deckSplit(deck, part) {
  let own = 0, common = 0;
  for (const [id, n] of Object.entries(deck)) (COMMON.has(id) ? (common += n) : (own += n));
  if (part === 'own') return own;
  if (part === 'common') return common;
  return `덱 ${own + common}장(고유 ${own} · 공용 ${common})`;
}

let dexTab = null;

function openDex() {
  const tabs = $('dex-tabs');
  tabs.innerHTML = '';
  const groups = [...Object.keys(FACTIONS), 'neutral'];
  dexTab ??= groups[0];
  for (const g of groups) {
    const b = document.createElement('button');
    b.className = `dex-tab${g === dexTab ? ' on' : ''}`;
    b.setAttribute('role', 'tab');
    b.textContent = g === 'neutral' ? '🃏 공용' : `${FACTIONS[g].emblem} ${FACTIONS[g].name}`;
    b.title = b.textContent;
    b.onclick = () => { dexTab = g; openDex(); };
    tabs.append(b);
  }
  // 공용 = 여러 해적단이 함께 쓰는 카드(COMMON). 진영 = 그 진영 고유 카드와 그 진영이 부르는 토큰.
  const owners = {};
  for (const [f, { deck }] of Object.entries(FACTIONS)) for (const id of Object.keys(deck)) (owners[id] ??= []).push(f);
  const home = (id) => (COMMON.has(id) || owners[id]?.length !== 1 ? 'neutral' : owners[id][0]);
  const tokenHome = { spirit: 'ghost', monkey: 'monkey', spore: 'mush', bunny: 'zoo', blueberry: 'fruit', colossal: 'scout', attacktitan: 'scout', stonewall: 'alchemy' };
  const ids = Object.keys(CARDS).filter((id) => id !== 'coin' && (tokenHome[id] ?? home(id)) === dexTab)
    .sort((a, b) => CARDS[a].cost - CARDS[b].cost);
  const skill = FACTIONS[dexTab]?.skill;
  $('dex-desc').innerHTML = dexTab === 'neutral'
    ? '여러 해적단이 함께 쓰는 카드입니다.'
    : `${FACTIONS[dexTab].desc} ${deckSplit(FACTIONS[dexTab].deck)}.<span class="dex-skill">✨ 리더 스킬 ${skill.art} <b>${skill.name}</b> (바람 ${skill.cost}${skill.treasureCost ? ` · 보물 ${skill.treasureCost}` : ''}) — ${skill.text}</span>`;
  const box = $('dex-cards');
  box.innerHTML = '';
  const addCard = (id, label) => {
    const wrap = document.createElement('div');
    wrap.className = 'dex-item';
    wrap.append(cardEl({ uid: id, defId: id }, dexTab === 'neutral' ? (owners[id]?.[0] ?? 'stretch') : dexTab, { inHand: true }));
    wrap.insertAdjacentHTML('beforeend', `<span class="dex-count">${label}</span>`);
    box.append(wrap);
  };
  const section = (title) => box.insertAdjacentHTML('beforeend', `<h3 class="dex-section">${title}</h3>`);
  if (dexTab !== 'neutral') section(`⚓ 고유 카드 (${deckSplit(FACTIONS[dexTab].deck, 'own')}장)`);
  for (const id of ids) {
    const d = CARDS[id];
    const n = dexTab !== 'neutral' ? FACTIONS[dexTab].deck[id] : null;
    addCard(id, d.token ? '불려 나오는 카드' : n ? `덱에 ${n}장` : (owners[id] ?? []).map((f) => FACTIONS[f].emblem).join(' ') || '어느 덱에도 없음');
  }
  // 해적단 탭: 이 덱에 함께 넣은 공용 카드도 보여 준다.
  if (dexTab !== 'neutral') {
    const deck = FACTIONS[dexTab].deck;
    const commons = Object.keys(deck).filter((id) => COMMON.has(id)).sort((a, b) => CARDS[a].cost - CARDS[b].cost);
    section(`🃏 함께 넣은 공용 카드 (${deckSplit(deck, 'common')}장)`);
    for (const id of commons) addCard(id, `덱에 ${deck[id]}장`);
  }
  $('dex').hidden = false;
}

// ── 시작과 끝 ──

function renderDifficulty() {
  const box = $('diff-list');
  box.innerHTML = '';
  for (const [id, d] of Object.entries(DIFFICULTIES)) {
    const b = document.createElement('button');
    b.className = `diff${id === difficulty ? ' on' : ''}`;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(id === difficulty));
    b.textContent = `${d.emoji} ${d.name}`;
    b.onclick = () => {
      difficulty = id;
      try { localStorage.setItem('difficulty', id); } catch {}
      renderDifficulty();
    };
    box.append(b);
  }
  $('diff-desc').textContent = DIFFICULTIES[difficulty].desc;
}

function renderMode() {
  const box = $('mode-list');
  box.innerHTML = '';
  for (const [id, text] of [['ai', '🤖 AI와 대결'], ['duo', '👥 친구와 대결']]) {
    const b = document.createElement('button');
    b.className = `diff${id === mode ? ' on' : ''}`;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(id === mode));
    b.textContent = text;
    b.onclick = () => {
      mode = id;
      firstPick = null;
      try { localStorage.setItem('mode', id); } catch {}
      showStart();
    };
    box.append(b);
  }
  const rivals = $('rival-list');
  rivals.innerHTML = '';
  for (const [id, text] of [['random', '🎲 무작위'], ['choose', '🎯 직접 고르기']]) {
    const b = document.createElement('button');
    b.className = `diff${id === rivalMode ? ' on' : ''}`;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(id === rivalMode));
    b.textContent = text;
    b.onclick = () => {
      rivalMode = id;
      firstPick = null;
      try { localStorage.setItem('rival', id); } catch {}
      showStart();
    };
    rivals.append(b);
  }
  const orders = $('order-list');
  orders.innerHTML = '';
  for (const [id, text] of [['random', '🎲 무작위'], ['first', '⚔️ 선공'], ['second', '🪙 후공']]) {
    const b = document.createElement('button');
    b.className = `diff${id === order ? ' on' : ''}`;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(id === order));
    b.textContent = text;
    b.title = id === 'second' ? '후공은 카드 1장을 더 받고 행운의 동전을 받아요.' : id === 'first' ? '먼저 시작하지만 시작 카드가 1장 적어요.' : '선공·후공을 무작위로 정해요.';
    b.onclick = () => {
      order = id;
      try { localStorage.setItem('order', id); } catch {}
      showStart();
    };
    orders.append(b);
  }
  $('order-wrap').hidden = isDuo();
  $('diff-wrap').hidden = isDuo();
  $('diff-desc').hidden = isDuo();
  $('rival-wrap').hidden = isDuo();
  const title = $('pick-title');
  title.hidden = !twoPicks();
  if (!twoPicks()) return;
  const [first, second, again] = isDuo() ? ['<b>1P</b>', '<b>2P</b>', '1P 다시 고르기'] : ['내', '<b>상대</b>', '내 해적단 다시 고르기'];
  title.innerHTML = firstPick
    ? `<span>${isDuo() ? '1P' : '나'}: ${FACTIONS[firstPick].emblem} ${FACTIONS[firstPick].name} · 이제 ${second} 해적단을 고르세요</span><button id="repick" class="ghost">${again}</button>`
    : `<span>${first}${isDuo() ? '가 먼저' : ''} 해적단을 고르세요</span>`;
  if (firstPick) $('repick').onclick = () => { firstPick = null; showStart(); };
}

// id가 'random'이면 무작위로 정한다. AI 상대를 무작위로 고를 때는 내 해적단과 겹치지 않게 한다.
function pickFaction(id) {
  if (!twoPicks()) { startGame(id === 'random' ? randomFaction() : id); return; }
  if (!firstPick) { firstPick = id === 'random' ? randomFaction() : id; showStart(); return; }
  const first = firstPick;
  const second = id === 'random' ? randomFaction(isDuo() ? null : first) : id;
  firstPick = null;
  startGame(first, second);
}

function showStart() {
  let seen = false;
  try { seen = !!localStorage.getItem('tutorialSeen'); } catch {}
  $('tut-btn').classList.toggle('fresh', !seen);
  renderDifficulty();
  renderMode();
  const list = $('faction-list');
  list.innerHTML = '';
  const dice = document.createElement('button');
  dice.className = 'faction f-random';
  dice.innerHTML = `
    <span class="emblem">🎲</span>
    <span><div class="fname">무작위</div><div class="fdesc">${Object.keys(FACTIONS).length}개 해적단 중 하나를 무작위로 골라 줍니다.</div></span>`;
  dice.onclick = () => pickFaction('random');
  list.append(dice);
  for (const [id, f] of Object.entries(FACTIONS)) {
    const b = document.createElement('button');
    b.className = `faction f-${id}`;
    b.innerHTML = `
      ${id === 'stretch' ? '<span class="badge">추천 · 고무팔</span>' : ''}
      <span class="emblem">${f.emblem}</span>
      <span><div class="fname">${f.name}</div><div class="fdesc">${f.desc}</div></span>`;
    if (id === firstPick) b.classList.add('picked');
    b.onclick = () => pickFaction(id);
    list.append(b);
  }
  $('start').hidden = false;
  $('handoff').hidden = true;
  $('gameover').hidden = true;
  $('game').hidden = true;
  document.body.classList.remove('playing');
}

// 하던 판을 버리고 시작 화면으로 간다.
function quitToHome() {
  endTutorial();
  session++;
  busy = false;
  acting = false;
  queued = null;
  selected = null;
  $('quit').hidden = true;
  $('inspect').hidden = true;
  $('log-ov').hidden = true;
  $('deck-ov').hidden = true;
  showStart();
}

// rival: 친구 모드의 2P나 직접 고른 AI 상대. 없으면 AI가 다른 해적단 중 하나를 무작위로 고른다.
async function startGame(factionId, rival = null, { tutorial = false } = {}) {
  endTutorial();
  tutorialOn = tutorial;
  session++;
  const others = Object.keys(FACTIONS).filter((f) => f !== factionId);
  const aiFaction = rival ?? others[Math.floor(Math.random() * others.length)];
  // AI 대전: 후공이면 AI가 0번 자리(선공)에 앉는다. 난이도 조건([나, AI])도 자리에 맞춰 뒤집는다.
  const meFirst = tutorial || isDuo() || order === 'first' || (order === 'random' && Math.random() < 0.5);
  const hc = DIFFICULTIES[difficulty].handicap;
  state = createGame(isDuo()
    ? { playerFaction: factionId, aiFaction, names: ['1P', '2P'], handicap: DIFFICULTIES.normal.handicap }
    : meFirst
      ? { playerFaction: factionId, aiFaction, handicap: hc }
      : { playerFaction: aiFaction, aiFaction: factionId, names: ['AI', '나'], handicap: { hull: [hc.hull[1], hc.hull[0]], extraCards: [hc.extraCards[1], hc.extraCards[0]] } });
  ME = meFirst ? 0 : 1;
  FOE = 1 - ME;
  document.body.classList.add('playing');
  goLandscape();
  selected = null;
  busy = false;
  acting = false;
  queued = null;
  $('start').hidden = true;
  $('game').hidden = false;
  const all = new Set(state.players.flatMap((p) => p.board.map((c) => c.uid)));
  render(all);
  const diff = DIFFICULTIES[difficulty];
  if (isDuo()) {
    showBanner(`${FACTIONS[factionId].emblem} 1P VS 2P ${FACTIONS[aiFaction].emblem}<span class="who">1P 먼저!</span>`, 1300);
    return;
  }
  showBanner(`🌊 VS ${FACTIONS[aiFaction].emblem} ${FACTIONS[aiFaction].name}<span class="who">${tutorial ? '🎓 튜토리얼' : `${diff.emoji} ${diff.name}`} · ${meFirst ? '내가 선공' : '내가 후공 🪙'}</span>`, 1300);
  if (!meFirst) {
    // AI가 먼저 둔다. 시작 배너가 끝난 뒤 AI 차례를 진행한다.
    busy = true;
    const game = session;
    await sleep(1400);
    if (game === session) await runAI();
  }
}

// 폰이면 전체 화면으로 바꾸고 가로로 고정해 본다. 지원하지 않는 브라우저(iOS 등)는 조용히 넘어간다.
function goLandscape() {
  if (!matchMedia('(pointer: coarse)').matches || document.fullscreenElement) return;
  const el = document.documentElement;
  if (!el.requestFullscreen) return;
  el.requestFullscreen({ navigationUI: 'hide' })
    .then(() => screen.orientation?.lock?.('landscape'))
    .catch(() => {});
}

function showGameOver() {
  const won = isDuo() || state.winner === ME;
  if (tutorialOn) endTutorial();
  if (!isDuo() && !state.recorded && !state.tutorial) {
    state.recorded = true;
    recordResult(difficulty, state.players[ME].factionId, state.players[FOE].factionId, state.winner === ME);
  }
  const winner = state.players[state.winner];
  $('gameover-emoji').textContent = won ? '🏆' : '🌊';
  $('gameover-title').textContent = isDuo() ? `${winner.name} 승리!` : won ? '승리!' : '패배...';
  $('gameover-text').textContent = winner.treasure >= RULES.treasureToWin
    ? `${label(state.winner)}이(가) 보물 ${RULES.treasureToWin}개를 모두 털었습니다.`
    : `${label(1 - state.winner)}의 배가 침몰했습니다.`;
  const game = session;
  setTimeout(() => { if (game === session) $('gameover').hidden = false; }, 700);
}

// ── 튜토리얼 ──
// 실제로 한 판을 두면서 화면 요소를 하나씩 짚어 준다. do 단계는 직접 해야 넘어간다.

const tutFlags = { attacks: 0, inspected: false };
let tut = null; // { i, timer }
const myBoard = () => state.players[ME].board;
const TUT_STEPS = [
  { title: '어서 와요, 선장님!', text: 'onepicard는 해적단끼리 싸우는 카드게임이에요. 지금부터 실제로 한 판을 두면서 화면에 있는 것들을 하나씩 알려 드릴게요. 그만두고 싶으면 언제든 「건너뛰기」를 누르세요.' },
  { el: '#foe-hud', title: '이기는 방법', text: '위쪽은 상대 배예요. 상대 배의 선체 🚢 를 0으로 만들거나, 보물 💰 12개를 먼저 모으면 이겨요.' },
  { el: '#my-hud', title: '내 배', text: '아래쪽은 내 배예요. 🚢 선체가 0이 되면 져요. 💰 는 지금까지 모은 보물, 오른쪽 위 🂠 는 손패 장수, 「덱」은 남은 카드 수예요.' },
  { el: '#my-hud .sails', title: '바람 ⛵', text: '카드를 내려면 바람을 써요. 내 차례마다 최대치가 1씩 늘고(최대 10) 다시 가득 차요. 첫 턴에는 바람이 1이에요.' },
  { el: '#hand', title: '손패', text: '맨 아래 카드들이 손패예요. 카드 왼쪽 위 파란 숫자가 비용, 즉 필요한 바람이에요. 지금 낼 수 있는 카드는 밝고, 바람이 모자란 카드는 어둡게 보여요.' },
  { el: '#hand .card', title: '카드 읽는 법', text: '왼쪽 아래 빨간 숫자는 공격력, 오른쪽 아래 초록 숫자는 체력이에요. 이름 밑의 작은 꼬리표는 키워드(특수 능력)예요. 「전술」 리본이 달린 카드는 한 번 쓰고 버리는 카드예요.' },
  { el: '#hand', do: true, title: '선원 내기', text: '비용 1인 「말랑 고무손」을 눌러 갑판에 내 보세요. 화면이 작으면 처음 누를 때 설명이 뜨고, 한 번 더 누르면 나가요.', done: () => myBoard().length >= 1 },
  { el: '#my-board', title: '갑판과 선원', text: '낸 선원은 갑판에 서요. 선원은 낸 다음 턴부터 공격할 수 있어요. 「돌격」 키워드가 있으면 바로 칠 수 있어요. 공격할 수 있는 선원은 반짝여요.' },
  { el: '#my-board .card', do: true, title: '선원 정보 보기', text: '갑판에 있는 내 선원을 눌러 보세요. 원래 수치, 지금 받은 피해나 강해진 점, 키워드 설명을 크게 볼 수 있어요. 다 봤으면 아무 데나 눌러 닫으세요.', done: () => tutFlags.inspected && $('inspect').hidden },
  { el: '#skill-btn', title: '리더 스킬 ✨', text: () => `해적단마다 고유 스킬이 있어요. 한 턴에 한 번, 바람을 써서 쓸 수 있어요. 지금 해적단의 스킬은 「${skillOf(ME).name}」: ${skillOf(ME).text}` },
  { el: '#end-btn', do: true, title: '턴 종료', text: '이번 턴에 할 일을 다 했으면 ⚓ 턴 종료를 누르세요. 그러면 상대(AI) 차례가 돼요.', done: () => state.current !== ME },
  { wait: true, title: '상대 차례', text: 'AI가 두는 동안 지켜보세요. 상대가 낸 카드는 화면 가운데에 잠깐 크게 보여요.', done: () => isMyTurn() },
  { el: '#my-hud .sails', title: '바람이 늘었어요', text: '다시 내 차례예요. 바람 최대치가 1 늘어 2가 됐고, 카드도 1장 새로 뽑았어요. 비용 2짜리 「고무주먹 권투사」도 이제 낼 수 있어요.' },
  { el: '#my-board', do: true, title: '공격하기', text: '반짝이는 내 선원을 누른 다음, 적 선원이나 위쪽 상대 배를 눌러 공격해 보세요.', done: () => tutFlags.attacks > 0 && !busy },
  { el: '#foe-hud', title: '습격과 싸움', text: '상대 배를 치는 걸 습격이라고 해요. 선체를 깎고 보물 1개를 얻어요. 선원끼리 싸우면 서로 상대 공격력만큼 체력이 깎여요(반격). 적에게 「수호」 선원이 있으면 그 선원부터 쳐야 해요.' },
  { el: '#my-board', title: '빠르게 연달아 치기', text: '공격 연출이 나오는 동안에도 다음 선원과 대상을 미리 눌러 두면, 앞 공격이 끝나자마자 이어서 쳐요. 고른 선원을 한 번 더 누르면 그 선원의 정보를 볼 수 있어요.' },
  { el: '#deck-btn', title: '내 덱', text: '내 덱에 든 카드의 원래 수치와 남은 장수를 볼 수 있어요.' },
  { el: '#log-btn', title: '일지', text: '지금까지 판에서 일어난 일이 순서대로 적혀 있어요. 피해가 어디서 왔는지 헷갈리면 여기를 보세요.' },
  { el: '#fx-btn', title: '연출 켬/끔', text: '해적단마다 다른 공격 연출을 켜고 끌 수 있어요. 끄면 카드가 가볍게 돌진만 해서 더 빨리 진행돼요.' },
  { el: '#home-btn', title: '홈', text: '이 판을 그만두고 시작 화면으로 돌아가요.' },
  { title: '키워드와 규칙', text: '키워드는 30가지쯤 있어요. 카드를 누르면 그 카드의 키워드 설명이 같이 나오고, 「규칙」에서 전체 목록을 볼 수 있어요. 후공은 카드 1장과 행운의 동전(그 턴 바람 +1)을 더 받아요. 덱이 다 떨어지면 카드를 뽑을 때마다 선체 피해가 점점 커져요.' },
  { title: '시작 화면에서 더 알아보기', text: '해적단은 17개이고 저마다 싸우는 방식이 달라요. 시작 화면의 📖 카드 도감에서 모든 카드를, 📊 승률·상성에서 내 전적과 해적단끼리의 상성을 볼 수 있어요. 난이도(쉬움~견문색), 상대 해적단, 선공·후공을 고를 수 있고, 👥 친구와 대결로 폰 하나를 번갈아 둘 수도 있어요.' },
  { title: '준비 끝!', text: '이제 이 판을 끝까지 둬 보세요. 쉬운 AI라 편하게 연습할 수 있어요. 행운을 빌어요, 선장님!', last: true },
];

function startTutorial() {
  try { localStorage.setItem('tutorialSeen', '1'); } catch {}
  startGame('stretch', 'deep', { tutorial: true });
  state.tutorial = true;
  // 손패를 정해 둔다: 1턴에 낼 말랑 고무손, 2턴에 낼 고무주먹 권투사, 그 밖에 보여 줄 카드들.
  // 원래 손패는 덱으로 돌려보내고, 덱에서 같은 카드를 꺼낸다(없으면 새로 만든다).
  const me = state.players[ME];
  const FIXED = ['rookie', 'boxer', 'bubble', 'grab'];
  me.deck.unshift(...me.hand); // 덱은 끝에서 뽑으니 앞쪽(바닥)으로 보낸다
  me.hand = [];
  let nextUid = Math.max(0, ...state.players.flatMap((p) => [...p.deck, ...p.hand, ...p.board].map((c) => c.uid))) + 1;
  for (const id of FIXED) {
    const di = me.deck.findIndex((c) => c.defId === id);
    me.hand.push(di >= 0 ? me.deck.splice(di, 1)[0] : { uid: nextUid++, defId: id });
  }
  tutFlags.attacks = 0;
  tutFlags.inspected = false;
  render();
  tut = { i: 0, timer: setInterval(tutTick, 250) };
  $('coach').hidden = false;
  setTimeout(showTutStep, 1400); // 시작 배너가 지나간 뒤
}

function endTutorial() {
  if (!tut && !tutorialOn) return;
  if (tut) clearInterval(tut.timer);
  tut = null;
  tutorialOn = false;
  $('coach').hidden = true;
}

function tutNext() {
  if (!tut) return;
  tut.i++;
  if (tut.i >= TUT_STEPS.length) { $('coach').hidden = true; clearInterval(tut.timer); tut = null; return; } // 판은 계속 이어서 둔다
  showTutStep();
}

function showTutStep() {
  if (!tut) return;
  const st = TUT_STEPS[tut.i];
  const text = typeof st.text === 'function' ? st.text() : st.text;
  const bubble = document.querySelector('.coach-bubble');
  bubble.innerHTML = `<h4>${st.title}</h4><p>${text}</p>
    ${st.do ? '<span class="doit">👉 직접 해 보세요</span>' : st.wait ? '<span class="doit">⏳ 기다려 주세요</span>' : ''}
    <div class="nav"><span class="step">${tut.i + 1} / ${TUT_STEPS.length}</span>
      <span>${st.last ? '' : '<button class="skip" type="button">건너뛰기</button>'}
      ${st.do || st.wait ? '' : `<button class="go" type="button">${st.last ? '시작!' : '다음'}</button>`}</span></div>`;
  bubble.querySelector('.go')?.addEventListener('click', tutNext);
  bubble.querySelector('.skip')?.addEventListener('click', () => { $('coach').hidden = true; clearInterval(tut.timer); tut = null; });
  tutPlace();
}

// 스포트라이트와 말풍선 위치를 맞춘다. 판이 다시 그려져도 따라가도록 주기적으로 부른다.
function tutPlace() {
  if (!tut) return;
  const st = TUT_STEPS[tut.i];
  const spot = document.querySelector('.coach-spot');
  const bubble = document.querySelector('.coach-bubble');
  const overlayOpen = ['inspect', 'log-ov', 'deck-ov', 'rules', 'quit', 'gameover'].some((id) => !$(id).hidden);
  const el = st.el && document.querySelector(st.el);
  const r = el?.getBoundingClientRect();
  const visible = r && r.width > 0 && r.height > 0;
  spot.classList.toggle('off', !visible);
  spot.classList.toggle('clear', overlayOpen || !!st.wait);
  if (visible) {
    const pad = 6;
    Object.assign(spot.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
  }
  const bw = bubble.offsetWidth;
  const bh = bubble.offsetHeight;
  let x = (innerWidth - bw) / 2;
  let y = (innerHeight - bh) / 2;
  if (visible) {
    x = Math.min(Math.max(12, r.left + r.width / 2 - bw / 2), innerWidth - bw - 12);
    // 아래에 자리가 있으면 아래, 아니면 위, 둘 다 없으면 옆
    if (r.bottom + 14 + bh < innerHeight) y = r.bottom + 14;
    else if (r.top - 14 - bh > 0) y = r.top - 14 - bh;
    else {
      y = Math.min(Math.max(12, r.top + r.height / 2 - bh / 2), innerHeight - bh - 12);
      x = r.right + 14 + bw < innerWidth ? r.right + 14 : Math.max(12, r.left - 14 - bw);
    }
  }
  if (overlayOpen) { y = 12; x = Math.max(12, innerWidth - bw - 12); } // 카드 크게 보기 등을 가리지 않게
  bubble.style.left = `${x}px`;
  bubble.style.top = `${y}px`;
}

function tutTick() {
  if (!tut || !state) return;
  const st = TUT_STEPS[tut.i];
  if ((st.do || st.wait) && st.done?.()) { tutNext(); return; }
  tutPlace();
}

// ── 연결 ──
$('foe-hud').onclick = onFoeShip;
$('end-btn').onclick = endTurn;
$('skill-btn').onclick = onSkill;
$('restart-btn').onclick = showStart;
$('handoff-btn').onclick = takeOver;
$('home-btn').onclick = () => { $('quit').hidden = false; };
$('quit-yes').onclick = quitToHome;
$('quit-no').onclick = () => { $('quit').hidden = true; };
$('quit').onclick = (e) => { if (e.target.id === 'quit') $('quit').hidden = true; };
$('rules-btn').onclick = () => { $('rules').hidden = false; };
$('rules-btn2').onclick = () => { $('rules').hidden = false; };
$('log-btn').onclick = () => { $('log-ov').hidden = false; $('log').scrollTop = $('log').scrollHeight; };
$('deck-btn').onclick = openDeck;
$('fx-btn').onclick = () => {
  fxOn = !fxOn;
  try { localStorage.setItem('fx', fxOn ? 'on' : 'off'); } catch {}
  renderFxBtn();
};
renderFxBtn();
$('deck-close').onclick = () => { $('deck-ov').hidden = true; };
$('deck-ov').onclick = (e) => { if (e.target.id === 'deck-ov') $('deck-ov').hidden = true; };
$('log-close').onclick = () => { $('log-ov').hidden = true; };
$('log-ov').onclick = (e) => { if (e.target.id === 'log-ov') $('log-ov').hidden = true; };
$('portrait-btn').onclick = () => document.body.classList.add('allow-portrait');
$('rules-close').onclick = () => { $('rules').hidden = true; };
$('rules').onclick = (e) => { if (e.target.id === 'rules') $('rules').hidden = true; };
$('inspect').onclick = () => { $('inspect').hidden = true; };
$('dex-btn').onclick = openDex;
$('tut-btn').onclick = startTutorial;
$('dex-close').onclick = () => { $('dex').hidden = true; };
$('stats-btn').onclick = openStats;
$('stats-close').onclick = () => { $('stats').hidden = true; };
$('stats').onclick = (e) => { if (e.target.id === 'stats') $('stats').hidden = true; };
$('kw-rules').innerHTML = Object.values(KEYWORDS).map((k) => `<li><b>${k.name}</b> ${k.desc}</li>`).join('');
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!$('inspect').hidden) { $('inspect').hidden = true; return; }
  $('deck-ov').hidden = true;
  if (selected) { selected = null; render(); }
});

showStart();
