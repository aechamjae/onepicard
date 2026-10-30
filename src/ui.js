// 화면 그리기와 입력 처리. 규칙 판단은 모두 engine.js에 맡긴다.
import { CARDS, FACTIONS, KEYWORDS } from './cards.js';
import { RULES, createGame, applyAction, canPlay, legalAttackTargets } from './engine.js';
import { aiNextAction } from './ai.js';

const ME = 0;
const FOE = 1;
const AI_DELAY = 750;

const $ = (id) => document.getElementById(id);

let state = null;
let selected = null; // {kind:'hand', index} | {kind:'attacker', uid}
let aiBusy = false;

// ── 시작 화면 ──
function showStart() {
  const list = $('faction-list');
  list.innerHTML = '';
  for (const [id, f] of Object.entries(FACTIONS)) {
    const b = document.createElement('button');
    b.className = 'faction';
    b.innerHTML = `<span class="emblem">${f.emblem}</span><span><div class="fname">${f.name}</div><div class="fdesc">${f.desc}</div></span>`;
    b.onclick = () => startGame(id);
    list.append(b);
  }
  $('start').hidden = false;
  $('gameover').hidden = true;
  $('game').hidden = true;
}

function startGame(factionId) {
  const others = Object.keys(FACTIONS).filter((f) => f !== factionId);
  const aiFaction = others[Math.floor(Math.random() * others.length)];
  state = createGame({ playerFaction: factionId, aiFaction });
  selected = null;
  $('start').hidden = true;
  $('game').hidden = false;
  render();
}

// ── 그리기 ──
function cardEl(card, { inHand = false } = {}) {
  const d = CARDS[card.defId];
  const el = document.createElement('div');
  el.className = `card ${d.type}`;
  el.dataset.uid = card.uid;
  const kws = (d.keywords || []).map((k) => `<span>${KEYWORDS[k].name}</span>`).join('');
  const atk = d.type === 'crew' ? card.atk ?? d.atk : null;
  const hp = d.type === 'crew' ? card.hp ?? d.hp : null;
  const hurt = card.maxHp && card.hp < card.maxHp ? ' hurt' : '';
  el.innerHTML = `
    ${inHand ? `<div class="cost">${d.cost}</div>` : ''}
    ${card.frozen ? '<div class="frozen" title="다음 턴 공격 불가">⚓</div>' : ''}
    <div class="art">${d.art}</div>
    <div class="name">${d.name}</div>
    ${kws ? `<div class="kw">${kws}</div>` : ''}
    ${d.text ? `<div class="text">${d.text}</div>` : ''}
    ${atk !== null ? `<div class="atk">${atk}</div><div class="hp${hurt}">${hp}</div>` : ''}`;
  el.title = [d.name, d.text, ...(d.keywords || []).map((k) => `${KEYWORDS[k].name}: ${KEYWORDS[k].desc}`)]
    .filter(Boolean).join('\n');
  return el;
}

function shipHtml(p, label) {
  return `
    <span class="who">${FACTIONS[p.factionId].emblem} ${label}</span>
    <span class="stat hull">🚢 선체 <b>${Math.max(0, p.hull)}</b>/${RULES.startHull}</span>
    <span class="stat treasure">💰 보물 <b>${p.treasure}</b>/${RULES.treasureToWin}</span>
    <span class="stat wind">🌬 바람 <b>${p.wind}</b>/${p.maxWind}</span>
    <span class="stat">🂠 손패 ${p.hand.length} · 덱 ${p.deck.length}</span>`;
}

function validTargets() {
  if (!selected) return { foeCrew: [], allyCrew: [], ship: false };
  if (selected.kind === 'attacker') {
    const attacker = state.players[ME].board.find((c) => c.uid === selected.uid);
    const legal = legalAttackTargets(state, ME, attacker);
    return { foeCrew: legal.filter((t) => t !== 'ship'), allyCrew: [], ship: legal.includes('ship') };
  }
  const d = CARDS[state.players[ME].hand[selected.index].defId];
  return {
    foeCrew: d.target === 'foeCrew' ? state.players[FOE].board.map((c) => c.uid) : [],
    allyCrew: d.target === 'allyCrew' ? state.players[ME].board.map((c) => c.uid) : [],
    ship: false,
  };
}

function render() {
  const me = state.players[ME];
  const foe = state.players[FOE];
  const myTurn = state.current === ME && state.winner === null && !aiBusy;
  const targets = validTargets();

  const foeShip = $('foe-ship');
  foeShip.innerHTML = shipHtml(foe, `${FACTIONS[foe.factionId].name} (AI)`);
  foeShip.classList.toggle('targetable', targets.ship);
  foeShip.onclick = () => onFoeShip();

  $('my-ship').innerHTML = shipHtml(me, `${FACTIONS[me.factionId].name} (나)`);

  const foeBoard = $('foe-board');
  foeBoard.innerHTML = '';
  for (const c of foe.board) {
    const el = cardEl(c);
    if (targets.foeCrew.includes(c.uid)) el.classList.add('targetable');
    el.onclick = () => onFoeCrew(c.uid);
    foeBoard.append(el);
  }

  const myBoard = $('my-board');
  myBoard.innerHTML = '';
  for (const c of me.board) {
    const el = cardEl(c);
    if (myTurn && c.canAttack) el.classList.add('ready');
    if (selected?.kind === 'attacker' && selected.uid === c.uid) el.classList.add('selected');
    if (targets.allyCrew.includes(c.uid)) el.classList.add('targetable');
    el.onclick = () => onMyCrew(c.uid);
    myBoard.append(el);
  }

  const hand = $('hand');
  hand.innerHTML = '';
  me.hand.forEach((card, i) => {
    const el = cardEl(card, { inHand: true });
    const playable = myTurn && !canPlay(state, ME, i);
    el.classList.add(playable ? 'playable' : 'unaffordable');
    if (selected?.kind === 'hand' && selected.index === i) el.classList.add('selected');
    el.onclick = () => onHand(i);
    hand.append(el);
  });

  $('end-btn').disabled = !myTurn;
  $('hint').textContent = hintText(myTurn);

  const log = $('log');
  log.innerHTML = state.log.map((l) => `<li>${l}</li>`).join('');
  log.scrollTop = log.scrollHeight;

  if (state.winner !== null) showGameOver();
}

function hintText(myTurn) {
  if (state.winner !== null) return '';
  if (!myTurn) return '🤖 AI가 항해 중...';
  if (selected?.kind === 'attacker') return '공격할 적 선원이나 적 배를 고르세요.';
  if (selected?.kind === 'hand') {
    const d = CARDS[state.players[ME].hand[selected.index].defId];
    return d.target === 'foeCrew' ? '대상 적 선원을 고르세요.' : '대상 아군 선원을 고르세요.';
  }
  return '카드를 내거나, 빛나는 선원으로 공격하세요.';
}

function showGameOver() {
  const won = state.winner === ME;
  const loser = state.players[1 - state.winner];
  const winner = state.players[state.winner];
  $('gameover-title').textContent = won ? '🏆 승리!' : '💀 패배...';
  $('gameover-text').textContent = winner.treasure >= RULES.treasureToWin
    ? `${won ? '당신' : 'AI'}이(가) 보물 ${RULES.treasureToWin}개를 모았습니다.`
    : `${loser === state.players[ME] ? '당신' : 'AI'}의 배가 침몰했습니다.`;
  setTimeout(() => { $('gameover').hidden = false; }, 600);
}

let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

function flash(selector) {
  const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (!el) return;
  el.classList.remove('hit');
  void el.offsetWidth;
  el.classList.add('hit');
}

// ── 입력 ──
const isMyTurn = () => state.current === ME && state.winner === null && !aiBusy;

function act(action) {
  const err = applyAction(state, action);
  selected = null;
  if (err) toast(err);
  render();
  return !err;
}

function onHand(i) {
  if (!isMyTurn()) return;
  if (selected?.kind === 'hand' && selected.index === i) { selected = null; render(); return; }
  const err = canPlay(state, ME, i);
  if (err) { toast(err); return; }
  const d = CARDS[state.players[ME].hand[i].defId];
  if (d.target) { selected = { kind: 'hand', index: i }; render(); return; }
  act({ type: 'play', handIndex: i });
}

function onMyCrew(uid) {
  if (!isMyTurn()) return;
  if (selected?.kind === 'hand' && CARDS[state.players[ME].hand[selected.index].defId].target === 'allyCrew') {
    act({ type: 'play', handIndex: selected.index, target: uid });
    return;
  }
  const c = state.players[ME].board.find((c) => c.uid === uid);
  if (selected?.kind === 'attacker' && selected.uid === uid) { selected = null; render(); return; }
  if (!c.canAttack) { toast(c.frozen ? '닻에 묶여 있다.' : '이 선원은 다음 턴부터 공격할 수 있다.'); return; }
  selected = { kind: 'attacker', uid };
  render();
}

function onFoeCrew(uid) {
  if (!isMyTurn() || !selected) return;
  if (selected.kind === 'attacker') {
    act({ type: 'attack', attacker: selected.uid, target: uid });
  } else if (CARDS[state.players[ME].hand[selected.index].defId].target === 'foeCrew') {
    act({ type: 'play', handIndex: selected.index, target: uid });
  }
}

function onFoeShip() {
  if (!isMyTurn() || selected?.kind !== 'attacker') return;
  if (act({ type: 'attack', attacker: selected.uid, target: 'ship' })) flash('#foe-ship');
}

function endTurn() {
  if (!isMyTurn()) return;
  act({ type: 'end' });
  runAI();
}

function runAI() {
  if (state.winner !== null || state.current !== FOE) return;
  aiBusy = true;
  render();
  let steps = 0;
  const step = () => {
    const action = aiNextAction(state);
    const err = applyAction(state, action);
    if (err || ++steps > 40) applyAction(state, { type: 'end' }); // 안전장치
    if (action.type === 'attack' && action.target === 'ship') flash('#my-ship');
    if (state.current === FOE && state.winner === null && action.type !== 'end') {
      render();
      setTimeout(step, AI_DELAY);
    } else {
      aiBusy = false;
      render();
    }
  };
  setTimeout(step, AI_DELAY);
}

// ── 연결 ──
$('end-btn').onclick = endTurn;
$('restart-btn').onclick = showStart;
$('rules-btn').onclick = () => { $('rules').hidden = false; };
$('rules-close').onclick = () => { $('rules').hidden = true; };
$('rules').onclick = (e) => { if (e.target.id === 'rules') $('rules').hidden = true; };
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && selected) { selected = null; render(); } });

showStart();
