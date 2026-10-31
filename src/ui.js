// 화면 그리기, 연출, 입력 처리. 규칙 판단은 모두 engine.js에 맡긴다.
import { CARDS, FACTIONS, KEYWORDS } from './cards.js';
import { RULES, createGame, applyAction, canPlay, canUseSkill, costOf, legalAttackTargets, hasKeyword, targetable } from './engine.js';
import { aiNextAction } from './ai.js';
import { DIFFICULTIES } from './difficulty.js';

// 화면 아래쪽(나)과 위쪽(상대)에 놓일 플레이어. 친구 모드에서는 턴마다 뒤바뀐다.
let ME = 0;
let FOE = 1;
const AI_DELAY = 550;

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SVG_NS = 'http://www.w3.org/2000/svg';

let state = null;
let selected = null; // {kind:'hand', index} | {kind:'attacker', uid}
let busy = false; // 연출 중이거나 AI 차례
let difficulty = loadDifficulty();
let mode = loadMode(); // 'ai' | 'duo'(친구와 한 폰에서 번갈아)
let duoPick = null; // 친구 모드에서 1P가 고른 진영

function loadMode() {
  try { if (localStorage.getItem('mode') === 'duo') return 'duo'; } catch {}
  return 'ai';
}
const isDuo = () => mode === 'duo';
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
function cardEl(card, factionId, { inHand = false, showText = inHand, owner = null } = {}) {
  const d = CARDS[card.defId];
  const el = document.createElement('div');
  el.className = `card ${d.type} f-${factionId}`;
  el.dataset.uid = card.uid;
  const isCrew = d.type === 'crew';
  const tension = card.tension || 0;
  const atk = (card.atk ?? d.atk) + tension;
  const hp = card.hp ?? d.hp;
  const chips = [...(d.keywords || []), ...(card.gained || [])].map((k) => `<span class="chip k-${k}">${KEYWORDS[k].name}</span>`).join('');
  const cost = owner ? costOf(owner, card.defId) : d.cost;
  el.innerHTML = `
    <div class="frame">
      <div class="art">${d.arm ? armArt(d.art, tension) : `<span class="emoji">${d.art}</span>`}</div>
      <div class="name">${d.name}</div>
      ${chips ? `<div class="chips">${chips}</div>` : ''}
      ${showText && d.text ? `<div class="text">${d.text}</div>` : ''}
      ${!isCrew ? '<div class="ribbon">전술</div>' : ''}
    </div>
    ${inHand ? `<div class="cost${cost < d.cost ? ' cheap' : ''}">${cost}</div>` : ''}
    ${isCrew ? `<div class="gem atk${tension ? ' boost' : ''}">${atk}</div>
      <div class="gem hp${card.maxHp && hp < card.maxHp ? ' hurt' : ''}">${hp}</div>` : ''}
    ${tension ? `<div class="tension">탄력+${tension}</div>` : ''}
    ${statusIcons(card)}`;
  if (card.revived) el.classList.add('revived');
  if (card.shield) el.classList.add('shielded');
  if (card.stealth) el.classList.add('stealthy');
  return el;
}

function statusIcons(card) {
  const icons = [];
  if (card.frozen) icons.push('<span title="다음 턴 공격 불가">⚓</span>');
  if (card.shield) icons.push('<span title="보호막">🛡</span>');
  if (card.stealth) icons.push('<span title="안개 속에 숨음">🌫</span>');
  if (card.burning) icons.push('<span title="불붙음: 턴 시작마다 피해">🔥</span>');
  if (card.revived) icons.push('<span title="망령으로 되살아남">👻</span>');
  if (card.submerged) icons.push('<span title="잠항 중: 공격·대상 지정 불가">🌊</span>');
  if (card.grown) icons.push(`<span title="성장">⚙${card.grown}</span>`);
  if (card.charged) icons.push(`<span title="공명">🌩${card.charged}</span>`);
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
  drawBoard($('foe-board'), foe, (el, c) => {
    if (targets.foeCrew.includes(c.uid)) el.classList.add('targetable');
    el.onclick = () => onFoeCrew(c.uid);
  });
  drawBoard($('my-board'), me, (el, c) => {
    if (myTurn && c.canAttack) el.classList.add('ready');
    if (selected?.kind === 'attacker' && selected.uid === c.uid) el.classList.add('selected');
    if (targets.allyCrew.includes(c.uid)) el.classList.add('targetable');
    el.onclick = () => onMyCrew(c.uid);
  });

  const hand = $('hand');
  hand.innerHTML = '';
  let anyPlayable = false;
  me.hand.forEach((card, i) => {
    const el = cardEl(card, me.factionId, { inHand: true, owner: me });
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
  skillBtn.innerHTML = `<span class="sk-cost">${sk.cost}</span>${sk.art} ${sk.name}${sk.treasureCost ? ` <small>💰${sk.treasureCost}</small>` : ''}`;
  skillBtn.title = `선장 스킬: ${sk.text}`;
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
    return `✨「${sk.name}」 ${sk.text} · ${sk.target === 'foeCrew' ? '🎯 대상 적 선원을 고르세요.' : '🎯 대상 아군 선원을 고르세요.'}`;
  }
  if (selected?.kind === 'hand') {
    const d = CARDS[state.players[ME].hand[selected.index].defId];
    const kws = (d.keywords || []).map((k) => KEYWORDS[k].name).join('·');
    const about = `「${d.name}」 ${[kws && `[${kws}]`, d.text].filter(Boolean).join(' ')}`;
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

const easeOutBack = (t) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2;
const easeIn = (t) => t * t;

// 고무팔이 대상까지 쭉 늘어났다가 튕겨 돌아온다.
function stretchArm(from, to, tension) {
  const fx = $('fx');
  fx.innerHTML = '';
  const outline = document.createElementNS(SVG_NS, 'path');
  const skin = document.createElementNS(SVG_NS, 'path');
  outline.setAttribute('class', 'arm-outline');
  skin.setAttribute('class', 'arm-skin');
  const fist = document.createElementNS(SVG_NS, 'g');
  fist.innerHTML = '<circle r="17" class="glove"/><path d="M-9 -9 q8 -6 16 0" class="glove-shine"/>';
  fx.append(outline, skin, fist);

  const WIND_UP = tension ? 160 : 0; // 탄력이 있으면 먼저 뒤로 당긴다
  const OUT = 280;
  const HOLD = 90;
  const BACK = 200;
  const total = WIND_UP + OUT + HOLD + BACK;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  let hit = false;

  return new Promise((resolve) => {
    const t0 = performance.now();
    const frame = (now) => {
      const t = Math.max(0, now - t0);
      let p;
      if (WIND_UP && t < WIND_UP) p = -0.12 * (t / WIND_UP);
      else if (t < WIND_UP + OUT) p = easeOutBack((t - WIND_UP) / OUT);
      else if (t < WIND_UP + OUT + HOLD) p = 1;
      else p = 1 - easeIn(Math.min(1, (t - WIND_UP - OUT - HOLD) / BACK));
      if (!hit && t >= WIND_UP + OUT * 0.7) {
        hit = true;
        burst(to, tension ? '💫' : '💥');
      }
      const x = from.x + dx * p;
      const y = from.y + dy * p;
      const amp = Math.abs(1 - p) * 16 + 4 + tension * 2;
      const d = armPath(from.x, from.y, x, y, 2.5 + tension, amp);
      outline.setAttribute('d', d);
      skin.setAttribute('d', d);
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      fist.setAttribute('transform', `translate(${x} ${y}) rotate(${angle})`);
      if (t < total) requestAnimationFrame(frame);
      else { fx.innerHTML = ''; resolve(); }
    };
    requestAnimationFrame(frame);
  });
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
  if (CARDS[crew.defId].arm) {
    attackerEl.classList.add('boing');
    await stretchArm(from, to, crew.tension || 0);
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
  state.players.forEach((p, pi) => p.board.forEach((c) => crews.set(c.uid, { hp: c.hp, pi, elastic: hasKeyword(c, 'elastic'), shield: c.shield })));
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
      wait = 520;
    } else if (c.hp < b.hp) {
      floatText(centerOf(el), `-${b.hp - c.hp}`);
      el.classList.add(b.elastic ? 'boing' : 'hit');
      wait = Math.max(wait, 380);
    } else if (b.shield && !c.shield) {
      floatText(centerOf(el), '🛡 막았다!', 'word');
      el.classList.add('boing');
      wait = Math.max(wait, 380);
    } else if (c.hp > b.hp) {
      floatText(centerOf(el), `+${c.hp - b.hp}`, 'heal');
    }
  }
  state.players.forEach((p, pi) => {
    const hud = hudOf(pi);
    const dh = p.hull - before.hull[pi];
    if (dh < 0) {
      floatText(centerOf(hud), `${dh}`);
      hud.classList.remove('hit');
      void hud.offsetWidth;
      hud.classList.add('hit');
      wait = Math.max(wait, 380);
    } else if (dh > 0) floatText(centerOf(hud), `+${dh}`, 'heal');
    const dt = p.treasure - before.treasure[pi];
    if (dt > 0) {
      const pt = centerOf(hud);
      setTimeout(() => floatText({ x: pt.x + 40, y: pt.y }, `+💰${dt}`, 'gold'), 150);
    }
  });
  if (wait) await sleep(wait);
}

// 한 행동을 연출과 함께 실행한다. 성공하면 true.
async function perform(action) {
  const pi = state.current;
  const before = snapshot();
  if (action.type === 'attack') {
    const a = state.players[pi].board.find((c) => c.uid === action.attacker);
    if (a?.canAttack && legalAttackTargets(state, pi, a).includes(action.target)) await animateAttack(action);
  } else if (action.type === 'skill') {
    if (!canUseSkill(state, pi)) {
      const sk = skillOf(pi);
      await showBanner(`✨ ${sk.art} ${sk.name}<span class="who">${pi === ME ? '선장 스킬!' : `${label(pi)} 선장 스킬!`}</span>`, 900);
    }
  } else if (action.type === 'play') {
    const card = state.players[pi].hand[action.handIndex];
    if (card && !canPlay(state, pi, action.handIndex) && (pi === FOE || CARDS[card.defId].type === 'tactic')) {
      await showCast(card, pi);
    }
  }
  const err = applyAction(state, action);
  if (err) {
    toast(err);
    render();
    return false;
  }
  await showAftermath(before);
  const entered = new Set();
  state.players.forEach((p) => p.board.forEach((c) => { if (!before.crews.has(c.uid)) entered.add(c.uid); }));
  render(entered);
  if (state.winner !== null) showGameOver();
  return true;
}

// ── 입력 ──

async function act(action) {
  busy = true;
  selected = null;
  render();
  await perform(action);
  busy = false;
  render();
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
  if (!isMyTurn()) { inspect(c, ME); return; }
  if (selectedTargetKind() === 'allyCrew') { useOn(uid); return; }
  if (selected?.kind === 'attacker' && selected.uid === uid) { selected = null; render(); return; }
  if (!c.canAttack) { inspect(c, ME); return; }
  selected = { kind: 'attacker', uid };
  render();
}

function onFoeCrew(uid) {
  const c = state.players[FOE].board.find((c) => c.uid === uid);
  if (!isMyTurn() || !selected) { inspect(c, FOE); return; }
  if (selected.kind === 'attacker') {
    act({ type: 'attack', attacker: selected.uid, target: uid });
  } else if (selectedTargetKind() === 'foeCrew') {
    if (c.stealth) { toast('안개 속에 숨어 있어 고를 수 없다.'); return; }
    useOn(uid);
  }
}

function onFoeShip() {
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
  if (state.winner !== null) { busy = false; return; }
  render();
  await showBanner('🤖 AI의 차례', 900);
  for (let steps = 0; state.current === FOE && state.winner === null; steps++) {
    await sleep(AI_DELAY);
    const action = steps > 40 ? { type: 'end' } : aiNextAction(state, DIFFICULTIES[difficulty].ai);
    const ok = await perform(action);
    if (!ok) await perform({ type: 'end' }); // 안전장치
  }
  busy = false;
  render();
  if (state.winner === null) showBanner('⚓ 내 차례!', 900);
}

function inspect(card, pi) {
  if (!card) return;
  const d = CARDS[card.defId];
  const box = document.createElement('div');
  box.className = 'inspect-box';
  box.append(cardEl(card, state.players[pi].factionId, { showText: true }));
  const kws = [...(d.keywords || []), ...(card.gained || [])].map((k) => `<li><b>${KEYWORDS[k].name}</b> ${KEYWORDS[k].desc}</li>`);
  if (card.tension) kws.push(`<li><b>탄력 ${card.tension}</b> 다음 공격 때 공격력 +${card.tension}</li>`);
  if (card.frozen) kws.push('<li><b>⚓ 묶임</b> 다음 턴에 공격할 수 없다.</li>');
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

let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

// ── 카드 도감 ──

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
    b.onclick = () => { dexTab = g; openDex(); };
    tabs.append(b);
  }
  // 공용 = 여러 덱에 들어가거나 어느 덱에도 안 들어가는 카드. 진영 = 그 진영 덱에만 들어가는 카드와 그 진영이 부르는 토큰.
  const owners = {};
  for (const [f, { deck }] of Object.entries(FACTIONS)) for (const id of Object.keys(deck)) (owners[id] ??= []).push(f);
  const home = (id) => (owners[id]?.length === 1 ? owners[id][0] : 'neutral');
  const tokenHome = { spirit: 'ghost', monkey: 'monkey', spark: 'storm' };
  const ids = Object.keys(CARDS).filter((id) => id !== 'coin' && (tokenHome[id] ?? home(id)) === dexTab)
    .sort((a, b) => CARDS[a].cost - CARDS[b].cost);
  const skill = FACTIONS[dexTab]?.skill;
  $('dex-desc').innerHTML = dexTab === 'neutral'
    ? '여러 해적단이 함께 쓰는 카드입니다.'
    : `${FACTIONS[dexTab].desc} 덱 24장.<span class="dex-skill">✨ 선장 스킬 ${skill.art} <b>${skill.name}</b> (바람 ${skill.cost}${skill.treasureCost ? ` · 보물 ${skill.treasureCost}` : ''}) — ${skill.text}</span>`;
  const box = $('dex-cards');
  box.innerHTML = '';
  for (const id of ids) {
    const d = CARDS[id];
    const wrap = document.createElement('div');
    wrap.className = 'dex-item';
    wrap.append(cardEl({ uid: id, defId: id }, dexTab === 'neutral' ? (owners[id]?.[0] ?? 'stretch') : dexTab, { inHand: true }));
    const n = dexTab !== 'neutral' ? FACTIONS[dexTab].deck[id] : null;
    const label = d.token ? '불려 나오는 카드' : n ? `덱에 ${n}장` : (owners[id] ?? []).map((f) => FACTIONS[f].emblem).join(' ');
    wrap.insertAdjacentHTML('beforeend', `<span class="dex-count">${label}</span>`);
    box.append(wrap);
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
      duoPick = null;
      try { localStorage.setItem('mode', id); } catch {}
      showStart();
    };
    box.append(b);
  }
  $('diff-wrap').hidden = isDuo();
  $('diff-desc').hidden = isDuo();
  const title = $('pick-title');
  title.hidden = !isDuo();
  if (isDuo()) {
    title.innerHTML = duoPick
      ? `<span>1P: ${FACTIONS[duoPick].emblem} ${FACTIONS[duoPick].name} · 이제 <b>2P</b>가 고르세요</span><button id="repick" class="ghost">1P 다시 고르기</button>`
      : '<span><b>1P</b>가 먼저 진영을 고르세요</span>';
    if (duoPick) $('repick').onclick = () => { duoPick = null; showStart(); };
  }
}

function pickFaction(id) {
  if (!isDuo()) { startGame(id); return; }
  if (!duoPick) { duoPick = id; showStart(); return; }
  const first = duoPick;
  duoPick = null;
  startGame(first, id);
}

function showStart() {
  renderDifficulty();
  renderMode();
  const list = $('faction-list');
  list.innerHTML = '';
  for (const [id, f] of Object.entries(FACTIONS)) {
    const b = document.createElement('button');
    b.className = `faction f-${id}`;
    b.innerHTML = `
      ${id === 'stretch' ? '<span class="badge">추천 · 고무팔</span>' : ''}
      <span class="emblem">${f.emblem}</span>
      <span><div class="fname">${f.name}</div><div class="fdesc">${f.desc}</div></span>`;
    if (id === duoPick) b.classList.add('picked');
    b.onclick = () => pickFaction(id);
    list.append(b);
  }
  $('start').hidden = false;
  $('handoff').hidden = true;
  $('gameover').hidden = true;
  $('game').hidden = true;
  document.body.classList.remove('playing');
}

// rival: 친구 모드에서 2P가 고른 진영. 없으면 AI가 다른 진영 중 하나를 무작위로 고른다.
async function startGame(factionId, rival = null) {
  const others = Object.keys(FACTIONS).filter((f) => f !== factionId);
  const aiFaction = rival ?? others[Math.floor(Math.random() * others.length)];
  state = createGame(isDuo()
    ? { playerFaction: factionId, aiFaction, names: ['1P', '2P'], handicap: DIFFICULTIES.normal.handicap }
    : { playerFaction: factionId, aiFaction, handicap: DIFFICULTIES[difficulty].handicap });
  ME = 0;
  FOE = 1;
  document.body.classList.add('playing');
  goLandscape();
  selected = null;
  busy = false;
  $('start').hidden = true;
  $('game').hidden = false;
  const all = new Set(state.players.flatMap((p) => p.board.map((c) => c.uid)));
  render(all);
  const diff = DIFFICULTIES[difficulty];
  if (isDuo()) {
    showBanner(`${FACTIONS[factionId].emblem} 1P VS 2P ${FACTIONS[aiFaction].emblem}<span class="who">1P 먼저!</span>`, 1300);
    return;
  }
  showBanner(`🌊 VS ${FACTIONS[aiFaction].emblem} ${FACTIONS[aiFaction].name}<span class="who">${diff.emoji} ${diff.name}</span>`, 1300);
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
  const winner = state.players[state.winner];
  $('gameover-emoji').textContent = won ? '🏆' : '🌊';
  $('gameover-title').textContent = isDuo() ? `${winner.name} 승리!` : won ? '승리!' : '패배...';
  $('gameover-text').textContent = winner.treasure >= RULES.treasureToWin
    ? `${label(state.winner)}이(가) 보물 ${RULES.treasureToWin}개를 모두 털었습니다.`
    : `${label(1 - state.winner)}의 배가 침몰했습니다.`;
  setTimeout(() => { $('gameover').hidden = false; }, 700);
}

// ── 연결 ──
$('foe-hud').onclick = onFoeShip;
$('end-btn').onclick = endTurn;
$('skill-btn').onclick = onSkill;
$('restart-btn').onclick = showStart;
$('handoff-btn').onclick = takeOver;
$('rules-btn').onclick = () => { $('rules').hidden = false; };
$('rules-btn2').onclick = () => { $('rules').hidden = false; };
$('log-btn').onclick = () => { $('log-ov').hidden = false; $('log').scrollTop = $('log').scrollHeight; };
$('log-close').onclick = () => { $('log-ov').hidden = true; };
$('log-ov').onclick = (e) => { if (e.target.id === 'log-ov') $('log-ov').hidden = true; };
$('portrait-btn').onclick = () => document.body.classList.add('allow-portrait');
$('rules-close').onclick = () => { $('rules').hidden = true; };
$('rules').onclick = (e) => { if (e.target.id === 'rules') $('rules').hidden = true; };
$('inspect').onclick = () => { $('inspect').hidden = true; };
$('dex-btn').onclick = openDex;
$('dex-close').onclick = () => { $('dex').hidden = true; };
$('kw-rules').innerHTML = Object.values(KEYWORDS).map((k) => `<li><b>${k.name}</b> ${k.desc}</li>`).join('');
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  $('inspect').hidden = true;
  if (selected) { selected = null; render(); }
});

showStart();
