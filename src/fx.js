// 해적단별 공격 연출. 화면 전체를 덮는 캔버스에 입자와 도형을 그리고, 카드 DOM은 WAAPI로 움직인다.
// playAttackFx(factionId, { from, to, aEl, tEl })는 맞는 순간이 지나면 끝나고, 남은 입자는 그 뒤로도 잠깐 흩어진다.

const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const lerpPt = (P, Q, t) => ({ x: lerp(P.x, Q.x, t), y: lerp(P.y, Q.y, t) });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export const EASE = {
  linear: (t) => t,
  in: (t) => t * t,
  in3: (t) => t * t * t,
  out: (t) => 1 - (1 - t) ** 2,
  out3: (t) => 1 - (1 - t) ** 3,
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
};

// ── 캔버스와 입자 ──

let cv = null;
let g = null;
let W = 0;
let H = 0;
const parts = [];
const drawers = [];
let running = false;
let last = 0;

function ensure() {
  if (cv) return;
  cv = document.createElement('canvas');
  cv.id = 'fxc';
  cv.setAttribute('aria-hidden', 'true');
  Object.assign(cv.style, { position: 'fixed', left: '0', top: '0', pointerEvents: 'none', zIndex: '25' });
  document.body.append(cv);
  resize();
  addEventListener('resize', resize);
}
function resize() {
  const dpr = Math.min(2, devicePixelRatio || 1);
  W = innerWidth;
  H = innerHeight;
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  cv.style.width = `${W}px`;
  cv.style.height = `${H}px`;
  g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function kick() {
  if (running) return;
  running = true;
  last = performance.now();
  requestAnimationFrame(loop);
}
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  g.clearRect(0, 0, W, H);
  // 뒤에 깔리는 도형(마법진 등)을 먼저, 그 위에 입자, 맨 위에 투사체.
  for (const layer of [0, 1]) {
    for (let i = 0; i < drawers.length; i++) {
      const d = drawers[i];
      if ((d.layer || 0) !== layer) continue;
      const t = clamp((now - d.t0) / d.dur, 0, 1);
      g.save();
      d.fn(g, d.ease(t), t, dt);
      g.restore();
    }
    if (layer === 0) drawParts(dt);
  }
  for (let i = drawers.length - 1; i >= 0; i--) {
    const d = drawers[i];
    if (now - d.t0 >= d.dur) {
      drawers.splice(i, 1);
      d.done();
    }
  }
  if (parts.length || drawers.length) requestAnimationFrame(loop);
  else {
    running = false;
    g.clearRect(0, 0, W, H);
  }
}

// 시간 ms 동안 매 프레임 fn(ctx, 이징된 t, 원래 t, dt)를 부른다. 그리면서 입자를 뿜어도 된다.
function phase(ms, fn, ease = EASE.linear, layer = 1) {
  ensure();
  return new Promise((done) => {
    drawers.push({ t0: performance.now(), dur: ms, fn, ease, layer, done });
    kick();
  });
}

// 입자 한 개. 속도는 px/초, 중력 gy는 px/초², drag는 초당 감속 계수.
function emit(o) {
  ensure();
  const life = Array.isArray(o.life) ? rnd(...o.life) : (o.life ?? 0.5);
  const size = Array.isArray(o.size) ? rnd(...o.size) : (o.size ?? 4);
  parts.push({
    kind: o.kind || 'dot', x: o.x, y: o.y, vx: o.vx || 0, vy: o.vy || 0, gy: o.gy || 0, drag: o.drag || 0,
    life, age: 0, size, size1: o.size1 ?? size, color: o.color || '255,255,255', a0: o.a0 ?? 1,
    add: !!o.add, rot: o.rot ?? rnd(0, TAU), vr: o.vr ?? 0, text: o.text, fadeIn: o.fadeIn || 0, stretch: o.stretch ?? 0.035,
  });
  kick();
}
// 한 점에서 부채꼴로 여러 입자를 뿜는다.
function spray(P, n, o) {
  for (let i = 0; i < n; i++) {
    const a = (o.angle ?? 0) + rnd(-(o.spread ?? Math.PI), o.spread ?? Math.PI);
    const sp = Array.isArray(o.speed) ? rnd(...o.speed) : (o.speed ?? 100);
    const r = o.radius ? rnd(0, o.radius) : 0;
    emit({ ...o, x: P.x + Math.cos(a) * r, y: P.y + Math.sin(a) * r, vx: Math.cos(a) * sp + (o.vx || 0), vy: Math.sin(a) * sp + (o.vy || 0), vr: o.vr ?? rnd(-8, 8) });
  }
}

function drawParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.age += dt;
    if (p.age >= p.life) { parts.splice(i, 1); continue; }
    const k = Math.exp(-p.drag * dt);
    p.vx *= k;
    p.vy = p.vy * k + p.gy * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    const f = p.age / p.life;
    let a = p.a0 * (1 - f) ** 1.4;
    if (p.fadeIn && f < p.fadeIn) a *= f / p.fadeIn;
    const s = lerp(p.size, p.size1, f);
    g.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
    drawPart(p, s, a);
  }
  g.globalCompositeOperation = 'source-over';
}

function drawPart(p, s, a) {
  const c = p.color;
  switch (p.kind) {
    case 'glow': {
      const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, s);
      gr.addColorStop(0, `rgba(${c},${a})`);
      gr.addColorStop(0.35, `rgba(${c},${a * 0.6})`);
      gr.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = gr;
      g.beginPath(); g.arc(p.x, p.y, s, 0, TAU); g.fill();
      break;
    }
    case 'smoke': {
      const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, s);
      gr.addColorStop(0, `rgba(${c},${a})`);
      gr.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = gr;
      g.beginPath(); g.arc(p.x, p.y, s, 0, TAU); g.fill();
      break;
    }
    case 'spark': {
      g.strokeStyle = `rgba(${c},${a})`;
      g.lineWidth = s;
      g.lineCap = 'round';
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * p.stretch, p.y - p.vy * p.stretch); g.stroke();
      break;
    }
    case 'ring': {
      g.strokeStyle = `rgba(${c},${a})`;
      g.lineWidth = Math.max(0.5, 5 * (1 - p.age / p.life));
      g.beginPath(); g.ellipse(p.x, p.y, s, s * (p.text === 'flat' ? 0.35 : 1), 0, 0, TAU); g.stroke();
      break;
    }
    case 'bubble': {
      g.strokeStyle = `rgba(${c},${a})`;
      g.lineWidth = 1.5;
      g.beginPath(); g.arc(p.x, p.y, s, 0, TAU); g.stroke();
      g.fillStyle = `rgba(255,255,255,${a * 0.8})`;
      g.beginPath(); g.arc(p.x - s * 0.35, p.y - s * 0.35, s * 0.25, 0, TAU); g.fill();
      break;
    }
    case 'shard': {
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
      g.fillStyle = `rgba(${c},${a})`;
      g.strokeStyle = `rgba(255,255,255,${a})`;
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(0, -s); g.lineTo(s * 0.55, s * 0.7); g.lineTo(-s * 0.45, s * 0.5); g.closePath(); g.fill(); g.stroke();
      g.restore();
      break;
    }
    case 'chip': { // 나무·돌 파편
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
      g.fillStyle = `rgba(${c},${a})`;
      g.fillRect(-s, -s * 0.4, s * 2, s * 0.8);
      g.fillStyle = `rgba(0,0,0,${a * 0.35})`;
      g.fillRect(-s, s * 0.1, s * 2, s * 0.3);
      g.restore();
      break;
    }
    case 'star': {
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
      g.fillStyle = `rgba(${c},${a})`;
      g.beginPath();
      for (let i = 0; i < 8; i++) {
        const r = i % 2 ? s * 0.28 : s;
        const an = (i * Math.PI) / 4;
        g.lineTo(Math.cos(an) * r, Math.sin(an) * r);
      }
      g.closePath(); g.fill();
      g.restore();
      break;
    }
    case 'leaf': {
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
      g.scale(1, Math.abs(Math.cos(p.rot * 1.7)) * 0.8 + 0.2);
      g.fillStyle = `rgba(${c},${a})`;
      g.beginPath(); g.ellipse(0, 0, s, s * 0.45, 0, 0, TAU); g.fill();
      g.strokeStyle = `rgba(20,60,10,${a * 0.6})`;
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(-s, 0); g.lineTo(s, 0); g.stroke();
      g.restore();
      break;
    }
    case 'coin':
      drawCoin(p.x, p.y, s, p.rot * 3, a);
      break;
    case 'gear':
      drawGear(p.x, p.y, s, p.rot, `rgba(${c},${a})`);
      break;
    case 'emoji': {
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.globalAlpha = a;
      g.font = `${s}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(p.text, 0, 0);
      g.restore();
      break;
    }
    default: {
      g.fillStyle = `rgba(${c},${a})`;
      g.beginPath(); g.arc(p.x, p.y, s, 0, TAU); g.fill();
    }
  }
}

// ── 도형 ──

function drawCoin(x, y, r, spin, a = 1) {
  const sx = Math.max(0.12, Math.abs(Math.cos(spin)));
  g.save(); g.translate(x, y); g.scale(sx, 1); g.globalAlpha = a;
  const gr = g.createLinearGradient(-r, -r, r, r);
  gr.addColorStop(0, '#fff6c8'); gr.addColorStop(0.45, '#ffcf3a'); gr.addColorStop(1, '#a8700c');
  g.fillStyle = gr;
  g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
  g.strokeStyle = '#7a4e05'; g.lineWidth = 1.5; g.stroke();
  g.strokeStyle = '#ffe9a0'; g.lineWidth = 1;
  g.beginPath(); g.arc(0, 0, r * 0.62, 0, TAU); g.stroke();
  g.restore();
}

function drawGear(x, y, r, rot, fill) {
  g.save(); g.translate(x, y); g.rotate(rot);
  g.fillStyle = fill;
  g.beginPath();
  const teeth = 8;
  for (let i = 0; i < teeth * 2; i++) {
    const a0 = (i * Math.PI) / teeth;
    const rr = i % 2 ? r * 0.72 : r;
    g.lineTo(Math.cos(a0 - 0.12) * rr, Math.sin(a0 - 0.12) * rr);
    g.lineTo(Math.cos(a0 + 0.12) * rr, Math.sin(a0 + 0.12) * rr);
  }
  g.closePath();
  g.arc(0, 0, r * 0.3, 0, TAU, true);
  g.fill('evenodd');
  g.restore();
}

function drawEmoji(text, x, y, size, rot = 0, a = 1) {
  g.save(); g.translate(x, y); g.rotate(rot); g.globalAlpha = a;
  g.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 0, 0);
  g.restore();
}

// 가운데가 두껍고 양끝이 가는 곡선 띠. 칼자국, 바람 줄기에 쓴다. from~to(0~1) 구간만 그린다.
function ribbon(P, C, Q, width, color, alpha, from = 0, to = 1, glow = 0) {
  const N = 24;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const t = lerp(from, to, i / N);
    const u = 1 - t;
    pts.push({ x: u * u * P.x + 2 * u * t * C.x + t * t * Q.x, y: u * u * P.y + 2 * u * t * C.y + t * t * Q.y, w: Math.sin((Math.PI * i) / N) * width });
  }
  const left = [];
  const right = [];
  for (let i = 0; i <= N; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(N, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L;
    const ny = dx / L;
    left.push([pts[i].x + nx * pts[i].w, pts[i].y + ny * pts[i].w]);
    right.push([pts[i].x - nx * pts[i].w, pts[i].y - ny * pts[i].w]);
  }
  g.beginPath();
  left.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  for (let i = right.length - 1; i >= 0; i--) g.lineTo(...right[i]);
  g.closePath();
  if (glow) { g.shadowBlur = glow; g.shadowColor = `rgba(${color},1)`; }
  g.fillStyle = `rgba(${color},${alpha})`;
  g.fill();
}

// 칼자국: 빠르게 그어졌다가 하얀 심이 가늘어지며 사라진다.
function slash(P, Q, bend, { core = '255,255,255', glow = '160,220,255', width = 7, ms = 300, sparks = true } = {}) {
  const M = lerpPt(P, Q, 0.5);
  const dx = Q.x - P.x;
  const dy = Q.y - P.y;
  const L = Math.hypot(dx, dy) || 1;
  const C = { x: M.x - (dy / L) * bend, y: M.y + (dx / L) * bend };
  let sparked = false;
  return phase(ms, (c, t) => {
    const reveal = clamp(t / 0.28, 0, 1);
    const fade = t < 0.28 ? 1 : 1 - (t - 0.28) / 0.72;
    c.globalCompositeOperation = 'lighter';
    ribbon(P, C, Q, width * 1.9 * (0.6 + fade * 0.4), glow, 0.45 * fade, 0, reveal, 14);
    c.shadowBlur = 0;
    ribbon(P, C, Q, width * fade, core, fade, 0, reveal);
    if (sparks && !sparked && reveal >= 1) {
      sparked = true;
      for (let i = 0; i < 10; i++) {
        const t2 = rnd(0.15, 0.85);
        const u = 1 - t2;
        const x = u * u * P.x + 2 * u * t2 * C.x + t2 * t2 * Q.x;
        const y = u * u * P.y + 2 * u * t2 * C.y + t2 * t2 * Q.y;
        emit({ kind: 'spark', x, y, vx: (dx / L) * rnd(80, 260) + rnd(-60, 60), vy: (dy / L) * rnd(80, 260) + rnd(-60, 60), life: [0.18, 0.35], size: 2, color: glow, add: true, drag: 3 });
      }
    }
  });
}

// 포물선 위의 점
function arcPt(P, Q, h, t) {
  return { x: lerp(P.x, Q.x, t), y: lerp(P.y, Q.y, t) - h * 4 * t * (1 - t) };
}

// ── 공용 효과 ──

function flash(P, r, color = '255,240,210', life = 0.2) {
  emit({ kind: 'glow', x: P.x, y: P.y, size: r * 0.6, size1: r, life, color, add: true });
}
function shockwave(P, r, color = '255,255,255', life = 0.4, flat = false) {
  emit({ kind: 'ring', x: P.x, y: P.y, size: r * 0.15, size1: r, life, color, a0: 0.9, text: flat ? 'flat' : '' });
}
function explosion(P, k = 1) {
  flash(P, 90 * k, '255,236,190', 0.22);
  shockwave(P, 70 * k, '255,230,180', 0.35);
  for (const color of ['255,190,70', '255,120,30', '255,235,160']) {
    spray(P, 10, { kind: 'glow', speed: [60, 300 * k], drag: 4, life: [0.35, 0.7], size: [16, 28], size1: 3, color, add: true });
  }
  spray(P, 16, { kind: 'spark', speed: [250, 620 * k], drag: 2.5, gy: 500, life: [0.25, 0.5], size: 2.2, color: '255,220,130', add: true });
  spray(P, 10, { kind: 'smoke', speed: [30, 110], drag: 2, gy: -40, life: [0.7, 1.1], size: 12, size1: 38 * k, color: '150,140,130', a0: 0.55 });
}

// 카드 DOM 움직임. 끝나면 cleanup()에서 모두 되돌린다.
let live = [];
function move(el, frames, ms, easing = 'ease-out') {
  if (!el) return Promise.resolve();
  const a = el.animate(frames, { duration: ms, easing, fill: 'both' });
  live.push(a);
  return a.finished.catch(() => {});
}
function setT(el, tr) {
  if (el) el.style.transform = tr;
}
function hitReact(el, dir, power = 12, { flashColor = 'brightness(2.4)', rot = 0 } = {}) {
  if (!el) return;
  const x = dir.x * power;
  const y = dir.y * power;
  el.animate([
    { transform: 'none', filter: flashColor },
    { transform: `translate(${x}px,${y}px) rotate(${rot}deg)`, filter: 'brightness(1.5)', offset: 0.25 },
    { transform: `translate(${-x * 0.3}px,${-y * 0.3}px)`, offset: 0.6 },
    { transform: 'none', filter: 'none' },
  ], { duration: 380, easing: 'ease-out' });
}
function screenShake(k = 8) {
  const el = document.getElementById('game') || document.body;
  const frames = [];
  for (let i = 0; i <= 6; i++) {
    const d = k * (1 - i / 6);
    frames.push({ transform: i === 6 ? 'none' : `translate(${rnd(-d, d)}px,${rnd(-d, d)}px)` });
  }
  el.animate(frames, { duration: 320, easing: 'linear' });
}
function tint(el, filter, ms = 700) {
  if (el) el.animate([{ filter }, { filter, offset: 0.4 }, { filter: 'none' }], { duration: ms });
}
function rectOf(el) {
  return el.getBoundingClientRect();
}
function cloneCard(el) {
  const r = rectOf(el);
  const c = el.cloneNode(true);
  Object.assign(c.style, { position: 'fixed', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, margin: '0', zIndex: '26', pointerEvents: 'none', transition: 'none', animation: 'none' });
  c.classList.remove('ready', 'selected');
  document.body.append(c);
  return c;
}

// ── 해적단별 연출 ──
// c: { A(공격자 중심), B(대상 중심), dir(단위 벡터), perp(수직 단위 벡터), dist, ang, aEl, tEl }

const FX = {
  // 붉은 돛: 대포 한 방
  async red(c) {
    const { A, B, dir, aEl, tEl } = c;
    await move(aEl, [{ transform: 'none' }, { transform: `translate(${-dir.x * 10}px,${-dir.y * 10}px) scale(1.06,.94)` }], 150, 'ease-out');
    const M = { x: A.x + dir.x * 34, y: A.y + dir.y * 34 };
    move(aEl, [
      { transform: `translate(${-dir.x * 10}px,${-dir.y * 10}px) scale(1.06,.94)` },
      { transform: `translate(${-dir.x * 26}px,${-dir.y * 26}px) rotate(${-Math.sign(dir.x || 1) * 6}deg)`, offset: 0.2 },
      { transform: 'none' },
    ], 420, 'ease-out');
    flash(M, 46, '255,220,140', 0.16);
    spray(M, 14, { angle: c.ang, spread: 0.5, kind: 'spark', speed: [180, 480], drag: 4, life: [0.12, 0.26], size: 2.5, color: '255,210,100', add: true });
    spray(M, 9, { angle: c.ang, spread: 0.9, kind: 'smoke', speed: [40, 160], drag: 2.5, gy: -30, life: [0.6, 1], size: 8, size1: 30, color: '210,205,200', a0: 0.45 });
    const h = clamp(c.dist * 0.3, 60, 150);
    const T = clamp(c.dist * 1.15, 340, 540);
    await phase(T, (x, t) => {
      const p = arcPt(M, B, h, t);
      emit({ kind: 'smoke', x: p.x, y: p.y, size: 4, size1: 12, life: 0.45, color: '200,195,190', a0: 0.3, drag: 1 });
      const s = 9 + Math.sin(t * Math.PI) * 4; // 높이 뜰수록 가까워 보이게
      x.fillStyle = 'rgba(0,0,0,.25)';
      x.beginPath(); x.ellipse(lerp(M.x, B.x, t), lerp(M.y, B.y, t) + 14, s, s * 0.35, 0, 0, TAU); x.fill();
      const gr = x.createRadialGradient(p.x - s * 0.35, p.y - s * 0.35, 1, p.x, p.y, s);
      gr.addColorStop(0, '#9a9a9a'); gr.addColorStop(0.4, '#3a3a3a'); gr.addColorStop(1, '#0b0b0b');
      x.fillStyle = gr;
      x.beginPath(); x.arc(p.x, p.y, s, 0, TAU); x.fill();
    });
    explosion(B, 1.1);
    spray(B, 12, { kind: 'chip', speed: [180, 420], angle: -Math.PI / 2, spread: 1.4, drag: 1, gy: 1100, life: [0.6, 0.9], size: [3, 6], color: '122,74,34', vr: rnd(-14, 14) });
    hitReact(tEl, dir, 16, { rot: dir.x * 4 });
    screenShake(9);
    await wait(170);
  },

  // 심해 함대: 해일
  async deep(c) {
    const { A, B, dir, aEl, tEl } = c;
    move(aEl, [{ transform: 'none' }, { transform: 'translateY(-8px) scale(1.06)', offset: 0.4 }, { transform: 'none' }], 520);
    const S = { x: A.x + dir.x * 26, y: A.y + dir.y * 26 };
    const flip = dir.x < 0 ? -1 : 1;
    const T = clamp(c.dist * 1.25, 420, 600);
    await phase(T, (x, t) => {
      const p = lerpPt(S, B, t);
      const s = 18 + 34 * t;
      x.translate(p.x, p.y + s * 0.2);
      x.scale(flip, 1);
      x.rotate(Math.sin(t * 14) * 0.03);
      // 물결 몸통
      const gr = x.createLinearGradient(0, -s, 0, s * 0.6);
      gr.addColorStop(0, 'rgba(232,251,255,.95)');
      gr.addColorStop(0.3, 'rgba(95,199,232,.92)');
      gr.addColorStop(1, 'rgba(15,74,107,.85)');
      x.fillStyle = gr;
      x.beginPath();
      x.moveTo(-s * 1.4, s * 0.55);
      x.bezierCurveTo(-s * 0.9, s * 0.2, -s * 0.4, -s * 0.9, s * 0.25, -s * 0.95);
      x.bezierCurveTo(s * 0.8, -s * 0.95, s * 0.95, -s * 0.45, s * 0.6, -s * 0.2);
      x.bezierCurveTo(s * 0.45, -s * 0.45, s * 0.15, -s * 0.4, s * 0.2, -s * 0.05);
      x.bezierCurveTo(s * 0.3, s * 0.25, s * 0.7, s * 0.4, s * 0.9, s * 0.55);
      x.closePath();
      x.fill();
      // 물마루 거품
      x.strokeStyle = 'rgba(255,255,255,.95)';
      x.lineWidth = 3;
      x.lineCap = 'round';
      x.beginPath();
      x.moveTo(-s * 0.6, -s * 0.35);
      x.bezierCurveTo(-s * 0.2, -s * 0.9, s * 0.6, -s * 1.05, s * 0.62, -s * 0.25);
      x.stroke();
      // 뒤로 흘리는 거품과 물보라
      if (Math.random() < 0.8) {
        emit({ kind: 'dot', x: p.x - dir.x * s, y: p.y + s * 0.5, vx: -flip * rnd(20, 80), vy: rnd(-160, -40), gy: 600, life: [0.4, 0.7], size: [2, 4], color: '232,251,255' });
        emit({ kind: 'bubble', x: p.x - dir.x * s * 0.5 + rnd(-10, 10), y: p.y + rnd(0, s * 0.4), vy: rnd(-40, -10), life: 0.6, size: [2, 5], color: '200,240,255' });
      }
    }, EASE.in);
    flash(B, 60, '170,230,255', 0.2);
    shockwave(B, 70, '200,240,255', 0.45);
    spray(B, 34, { kind: 'dot', angle: -Math.PI / 2, spread: 1.35, speed: [160, 460], gy: 1000, drag: 0.5, life: [0.5, 0.9], size: [2.5, 5], color: pick(['127,211,255', '232,251,255', '90,180,230']) });
    spray(B, 20, { kind: 'dot', angle: -Math.PI / 2, spread: 1.35, speed: [160, 460], gy: 1000, drag: 0.5, life: [0.5, 0.9], size: [2.5, 5], color: '232,251,255' });
    spray(B, 10, { kind: 'smoke', speed: [30, 90], drag: 2, life: [0.6, 1], size: 10, size1: 30, color: '190,235,255', a0: 0.4 });
    hitReact(tEl, dir, 18);
    tint(tEl, 'saturate(.6) hue-rotate(160deg) brightness(1.1)', 600);
    await wait(160);
  },

  // 유령선단: 유령 분신
  async ghost(c) {
    const { A, B, dir, aEl, tEl } = c;
    move(aEl, [{ opacity: 1 }, { opacity: 0.25 }, { opacity: 0.9 }, { opacity: 0.35 }, { opacity: 1 }], 760, 'linear');
    const end = { x: dir.x * c.dist * 1.5, y: dir.y * c.dist * 1.5 };
    const clones = [0, 1, 2].map((i) => {
      const k = cloneCard(aEl);
      k.style.filter = `grayscale(1) sepia(1) hue-rotate(${215 + i * 20}deg) saturate(3) brightness(${1.35 - i * 0.12}) drop-shadow(0 0 12px #b48cff)`;
      k.style.mixBlendMode = 'screen';
      k.style.opacity = '0';
      return k;
    });
    let hitDone = false;
    const T = 620;
    await phase(T, (x, t, raw) => {
      clones.forEach((k, i) => {
        const tt = clamp(raw - i * 0.07, 0, 1);
        const e = EASE.in(tt);
        const op = tt <= 0 ? 0 : (0.75 - i * 0.22) * (tt < 0.1 ? tt / 0.1 : 1) * (1 - clamp((tt - 0.7) / 0.3, 0, 1));
        k.style.opacity = String(op);
        k.style.transform = `translate(${end.x * e}px,${end.y * e}px) scale(${1 + e * 0.3}) rotate(${Math.sin(tt * 9) * 3}deg)`;
      });
      const e = EASE.in(raw);
      const P = { x: A.x + end.x * e, y: A.y + end.y * e };
      emit({ kind: 'glow', x: P.x + rnd(-14, 14), y: P.y + rnd(-20, 20), vy: rnd(-60, -20), life: 0.5, size: [6, 10], size1: 1, color: pick(['180,140,255', '140,255,190']), add: true, a0: 0.7 });
      if (!hitDone && e * c.dist * 1.5 >= c.dist) {
        hitDone = true;
        flash(B, 70, '190,150,255', 0.25);
        shockwave(B, 60, '200,170,255', 0.45);
        spray(B, 22, { kind: 'glow', speed: [40, 200], drag: 2, gy: -120, life: [0.5, 0.9], size: [5, 9], size1: 1, color: pick(['180,140,255', '140,255,190']), add: true });
        hitReact(tEl, dir, 8, { flashColor: 'brightness(1.6) hue-rotate(220deg) saturate(2)' });
        tint(tEl, 'grayscale(.6) hue-rotate(220deg) brightness(.8)', 700);
      }
    });
    clones.forEach((k) => k.remove());
    await wait(120);
  },

  // 불꽃 요리단: 불칼 썰기
  async flame(c) {
    const { A, B, dir, aEl, tEl } = c;
    const reach = c.dist * 0.55;
    await move(aEl, [{ transform: 'none' }, { transform: `translate(${dir.x * reach}px,${dir.y * reach}px) rotate(${dir.x * 8}deg) scale(1.06)` }], 170, 'cubic-bezier(.5,0,.9,.5)');
    const r = 40;
    const fire = { core: '255,246,200', glow: '255,120,30', width: 8, ms: 340 };
    const embers = (from, to) => {
      for (let i = 0; i < 14; i++) {
        const p = lerpPt(from, to, Math.random());
        emit({ kind: 'glow', x: p.x, y: p.y, vx: rnd(-50, 50), vy: rnd(-180, -40), gy: 120, drag: 1.5, life: [0.4, 0.8], size: [3, 6], size1: 1, color: pick(['255,200,80', '255,120,30', '255,240,170']), add: true });
      }
    };
    const P1 = { x: B.x - r, y: B.y - r }, Q1 = { x: B.x + r, y: B.y + r };
    slash(P1, Q1, 14, fire); embers(P1, Q1);
    hitReact(tEl, dir, 6);
    await wait(110);
    move(aEl, [
      { transform: `translate(${dir.x * reach}px,${dir.y * reach}px) rotate(${dir.x * 8}deg) scale(1.06)` },
      { transform: `translate(${dir.x * reach * 1.05}px,${dir.y * reach * 1.05}px) rotate(${-dir.x * 10}deg) scale(1.06)` },
    ], 100, 'ease-in');
    const P2 = { x: B.x + r, y: B.y - r }, Q2 = { x: B.x - r, y: B.y + r };
    slash(P2, Q2, -14, fire); embers(P2, Q2);
    flash(B, 70, '255,160,60', 0.25);
    spray(B, 10, { kind: 'glow', speed: [60, 220], drag: 3, gy: -60, life: [0.3, 0.6], size: [10, 16], size1: 1, color: '255,140,40', add: true });
    hitReact(tEl, dir, 14);
    tint(tEl, 'sepia(1) saturate(4) hue-rotate(-25deg) brightness(1.1)', 800);
    await wait(150);
    move(aEl, [
      { transform: `translate(${dir.x * reach * 1.05}px,${dir.y * reach * 1.05}px) rotate(${-dir.x * 10}deg) scale(1.06)` },
      { transform: 'none' },
    ], 280, 'ease-out');
    await wait(120);
  },

  // 정글 원숭이 무리: 바나나 세례
  async monkey(c) {
    const { A, B, dir, aEl, tEl } = c;
    const throwOne = async (i) => {
      await wait(i * 150);
      move(aEl, [{ transform: 'none' }, { transform: `translate(${-dir.x * 4}px,-10px) rotate(${-dir.x * 12}deg)`, offset: 0.4 }, { transform: 'none' }], 200);
      const off = (i - 1) * 14;
      const T0 = { x: B.x + c.perp.x * off, y: B.y + c.perp.y * off };
      const h = clamp(c.dist * 0.22, 40, 110) - i * 10;
      const trail = [];
      await phase(clamp(c.dist * 1.0, 300, 420), (x, t) => {
        const p = arcPt(A, T0, h, t);
        const rot = t * TAU * 2.5;
        trail.push({ ...p, rot });
        if (trail.length > 5) trail.shift();
        trail.forEach((q, k) => drawEmoji('🍌', q.x, q.y, 26, q.rot, ((k + 1) / trail.length) * 0.25));
        drawEmoji('🍌', p.x, p.y, 28, rot);
      });
      const last = i === 2;
      spray(T0, last ? 9 : 5, { kind: 'star', speed: [100, 260], drag: 3, life: [0.3, 0.55], size: [4, 8], size1: 1, color: '255,230,90', vr: 10 });
      flash(T0, last ? 54 : 34, '255,240,150', 0.16);
      spray(T0, 3, { kind: 'leaf', angle: -Math.PI / 2, spread: 1, speed: [120, 220], gy: 900, life: 0.6, size: [5, 7], color: '235,210,70', vr: 12 });
      hitReact(tEl, dir, last ? 14 : 6, { rot: (i - 1) * 4 });
      if (last) shockwave(T0, 46, '255,240,150', 0.3);
    };
    await Promise.all([0, 1, 2].map(throwOne));
    await wait(120);
  },

  // 태엽 기계단: 태엽 펀치
  async clock(c) {
    const { A, B, dir, aEl, tEl } = c;
    const r = rectOf(aEl);
    const K = { x: A.x - dir.x * (r.width * 0.55), y: A.y - dir.y * (r.height * 0.3) - 6 };
    move(aEl, [
      { transform: 'none' },
      { transform: `translate(${-dir.x * 4}px,${-dir.y * 4}px) scale(.96,1.03)`, offset: 0.33 },
      { transform: `translate(${-dir.x * 8}px,${-dir.y * 8}px) scale(.92,1.06)`, offset: 0.66 },
      { transform: `translate(${-dir.x * 12}px,${-dir.y * 12}px) scale(.88,1.1)` },
    ], 500, 'steps(3, end)');
    let step = -1;
    await phase(520, (x, t) => {
      const s = Math.min(3, Math.floor(t * 3.4));
      const local = clamp(t * 3.4 - s, 0, 1);
      const rot = (s + EASE.out3(Math.min(1, local * 2.5))) * (Math.PI / 2) * (dir.x < 0 ? -1 : 1);
      if (s !== step) {
        step = s;
        spray(K, 6, { kind: 'spark', speed: [80, 200], drag: 4, life: 0.2, size: 1.5, color: '255,236,160', add: true });
      }
      x.shadowBlur = 8; x.shadowColor = '#ffe39a';
      drawEmoji('🔑', K.x, K.y, 26, rot - Math.PI / 4);
    });
    // 튕겨 나간다
    const reach = c.dist * 0.78;
    const from = `translate(${-dir.x * 12}px,${-dir.y * 12}px) scale(.88,1.1)`;
    for (let i = 0; i < 6; i++) {
      const o = (i - 2.5) * 9;
      emit({ kind: 'spark', x: A.x + c.perp.x * o, y: A.y + c.perp.y * o, vx: -dir.x * 900, vy: -dir.y * 900, drag: 8, life: 0.22, size: 2, color: '255,255,255', a0: 0.7, stretch: 0.06 });
    }
    await move(aEl, [{ transform: from }, { transform: `translate(${dir.x * reach}px,${dir.y * reach}px) scale(1.14,.9)` }], 110, 'cubic-bezier(.6,0,1,.6)');
    flash(B, 80, '255,250,230', 0.18);
    shockwave(B, 80, '255,236,160', 0.4);
    spray(B, 9, { kind: 'gear', speed: [160, 360], drag: 1, gy: 900, life: [0.6, 0.9], size: [7, 12], color: pick(['230,200,130', '200,175,120', '250,230,170']), vr: rnd(-12, 12) });
    spray(B, 20, { kind: 'spark', speed: [250, 600], drag: 2.5, gy: 500, life: [0.2, 0.4], size: 2, color: '255,236,160', add: true });
    hitReact(tEl, dir, 18, { rot: dir.x * 5 });
    screenShake(7);
    await wait(90);
    move(aEl, [{ transform: `translate(${dir.x * reach}px,${dir.y * reach}px) scale(1.14,.9)` }, { transform: 'none' }], 360, 'cubic-bezier(.3,1.4,.5,1)');
    await wait(160);
  },

  // 떠돌이 검객단: 참격파
  async swords(c) {
    const { A, B, dir, perp, aEl, tEl } = c;
    move(aEl, [
      { transform: 'none' },
      { transform: `translate(${-dir.x * 6}px,${-dir.y * 6}px) rotate(${-dir.x * 16}deg)`, offset: 0.45 },
      { transform: `translate(${dir.x * 10}px,${dir.y * 10}px) rotate(${dir.x * 12}deg)`, offset: 0.7 },
      { transform: 'none' },
    ], 420, 'ease-out');
    await wait(170);
    const S = { x: A.x + dir.x * 30, y: A.y + dir.y * 30 };
    const trail = [];
    const T = clamp(c.dist * 0.75, 230, 330);
    const blade = (x, p, s, a) => {
      x.save(); x.translate(p.x, p.y); x.rotate(c.ang); x.globalAlpha = a;
      x.globalCompositeOperation = 'lighter';
      x.shadowBlur = 16; x.shadowColor = '#7cc8ff';
      const gr = x.createLinearGradient(-s * 0.4, 0, s * 0.5, 0);
      gr.addColorStop(0, 'rgba(120,190,255,0)'); gr.addColorStop(0.6, 'rgba(190,230,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,1)');
      x.fillStyle = gr;
      x.beginPath();
      x.moveTo(-s * 0.1, -s);
      x.quadraticCurveTo(s * 0.9, 0, -s * 0.1, s);
      x.quadraticCurveTo(s * 0.35, 0, -s * 0.1, -s);
      x.fill();
      x.restore();
    };
    await phase(T, (x, t) => {
      const p = lerpPt(S, B, t);
      const s = 30 + 16 * t;
      trail.push(p);
      if (trail.length > 6) trail.shift();
      trail.forEach((q, k) => blade(x, q, s * 0.9, ((k + 1) / trail.length) * 0.3));
      blade(x, p, s, 1);
      if (Math.random() < 0.7) emit({ kind: 'spark', x: p.x + perp.x * rnd(-s, s), y: p.y + perp.y * rnd(-s, s), vx: dir.x * 300, vy: dir.y * 300, drag: 6, life: 0.2, size: 1.2, color: '220,240,255', add: true, stretch: 0.05 });
    }, EASE.in);
    const L = 70;
    slash({ x: B.x - perp.x * L - dir.x * 10, y: B.y - perp.y * L - dir.y * 10 }, { x: B.x + perp.x * L + dir.x * 10, y: B.y + perp.y * L + dir.y * 10 }, 6, { width: 4, ms: 380 });
    flash(B, 60, '220,240,255', 0.16);
    hitReact(tEl, dir, 10, { flashColor: 'brightness(3)' });
    await wait(220);
  },

  // 항해사 길드: 돌풍
  async guild(c) {
    const { A, B, dir, perp, aEl, tEl } = c;
    move(aEl, [{ transform: 'none' }, { transform: `translate(${-dir.x * 6}px,${-dir.y * 6}px) scale(1.05)`, offset: 0.4 }, { transform: 'none' }], 480);
    const spread = clamp(c.dist / 4, 30, 80);
    const lanes = [-1, 0, 1].map((k) => {
      const M = lerpPt(A, B, 0.5);
      return { P: { x: A.x + dir.x * 20, y: A.y + dir.y * 20 }, C: { x: M.x + perp.x * spread * k * 1.3, y: M.y + perp.y * spread * k * 1.3 }, Q: { x: B.x + perp.x * k * 10, y: B.y + perp.y * k * 10 } };
    });
    const T = clamp(c.dist * 1.0, 340, 460);
    await phase(T + 140, (x, t, raw) => {
      x.globalCompositeOperation = 'lighter';
      lanes.forEach((l, k) => {
        const tt = clamp((raw * (T + 140) - k * 70) / T, 0, 1);
        if (tt <= 0) return;
        const head = EASE.inOut(tt);
        const tail = Math.max(0, head - 0.45);
        ribbon(l.P, l.C, l.Q, 6, '191,243,230', 0.5 * (1 - tail), tail, head, 10);
        x.shadowBlur = 0;
        ribbon(l.P, l.C, l.Q, 2.2, '255,255,255', 0.85 * (1 - tail), tail, head);
        if (Math.random() < 0.18 && tt < 1) {
          const u = 1 - head;
          const px = u * u * l.P.x + 2 * u * head * l.C.x + head * head * l.Q.x;
          const py = u * u * l.P.y + 2 * u * head * l.C.y + head * head * l.Q.y;
          emit({ kind: 'leaf', x: px, y: py, vx: dir.x * 160 + rnd(-40, 40), vy: dir.y * 160 + rnd(-40, 40), drag: 2, life: 0.6, size: [4, 6], color: pick(['110,190,90', '160,210,100']), vr: rnd(-14, 14) });
        }
      });
    });
    // 소용돌이
    hitReact(tEl, dir, 24, { rot: dir.x * 8, flashColor: 'brightness(1.6)' });
    spray(B, 10, { kind: 'leaf', speed: [120, 300], drag: 2, life: [0.6, 0.9], size: [4, 7], color: pick(['110,190,90', '160,210,100', '200,220,120']), vr: rnd(-16, 16) });
    phase(460, (x, t) => {
      x.globalCompositeOperation = 'lighter';
      x.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        const r = (46 - t * 22) * (1 + k * 0.18);
        const a0 = t * 9 + (k * TAU) / 3;
        x.strokeStyle = `rgba(210,250,240,${(1 - t) * 0.8})`;
        x.lineWidth = 3 - k * 0.6;
        x.beginPath(); x.ellipse(B.x, B.y, r, r * 0.55, 0, a0, a0 + 1.6); x.stroke();
      }
    });
    await wait(200);
  },

  // 잠수함 외과단: 어뢰
  async surgeon(c) {
    const { A, B, dir, aEl, tEl } = c;
    move(aEl, [{ transform: 'none' }, { transform: 'translateY(6px) scale(.97)', offset: 0.4 }, { transform: 'none' }], 360);
    const S = { x: A.x + dir.x * 20, y: A.y + dir.y * 20 + 18 };
    const T = clamp(c.dist * 1.3, 420, 640);
    let prev = S;
    await phase(T, (x, t) => {
      const wob = Math.sin(t * Math.PI * 3) * 9 * (1 - t);
      const base = lerpPt(S, B, t);
      const p = { x: base.x + c.perp.x * wob, y: base.y + c.perp.y * wob };
      const ang = Math.atan2(p.y - prev.y, p.x - prev.x) || c.ang;
      prev = p;
      // 물살과 거품
      emit({ kind: 'bubble', x: p.x - Math.cos(ang) * 22 + rnd(-3, 3), y: p.y - Math.sin(ang) * 22 + rnd(-3, 3), vx: rnd(-20, 20), vy: rnd(-70, -20), drag: 1, life: [0.5, 0.8], size: [2, 4.5], color: '210,240,255' });
      if (Math.random() < 0.5) emit({ kind: 'smoke', x: p.x - Math.cos(ang) * 24, y: p.y - Math.sin(ang) * 24, life: 0.4, size: 4, size1: 12, color: '200,235,255', a0: 0.35 });
      x.translate(p.x, p.y); x.rotate(ang);
      x.fillStyle = 'rgba(0,0,0,.25)';
      x.beginPath(); x.ellipse(0, 9, 20, 4, 0, 0, TAU); x.fill();
      // 꼬리 날개
      x.fillStyle = '#4d5a6a';
      x.beginPath(); x.moveTo(-16, 0); x.lineTo(-24, -8); x.lineTo(-20, 0); x.lineTo(-24, 8); x.closePath(); x.fill();
      // 몸통
      const gr = x.createLinearGradient(0, -6, 0, 6);
      gr.addColorStop(0, '#eef3f8'); gr.addColorStop(0.5, '#9aa8b8'); gr.addColorStop(1, '#4d5a6a');
      x.fillStyle = gr;
      x.beginPath(); x.moveTo(-18, -5); x.lineTo(10, -5); x.quadraticCurveTo(20, -5, 20, 0); x.quadraticCurveTo(20, 5, 10, 5); x.lineTo(-18, 5); x.closePath(); x.fill();
      x.fillStyle = '#e2483b';
      x.beginPath(); x.moveTo(12, -4.6); x.quadraticCurveTo(20, -5, 20, 0); x.quadraticCurveTo(20, 5, 12, 4.6); x.closePath(); x.fill();
      x.fillStyle = '#ffd84d';
      x.fillRect(-6, -5, 3, 10);
      // 프로펠러
      x.fillStyle = 'rgba(220,230,240,.7)';
      x.beginPath(); x.ellipse(-20, 0, 1.5, 6 * Math.abs(Math.sin(t * 60)), 0, 0, TAU); x.fill();
    }, EASE.in);
    flash(B, 80, '230,250,255', 0.2);
    shockwave(B, 80, '200,240,255', 0.45);
    explosion(B, 0.7);
    spray({ x: B.x, y: B.y + 10 }, 40, { kind: 'dot', angle: -Math.PI / 2, spread: 0.45, speed: [280, 720], gy: 1300, drag: 0.6, life: [0.5, 0.9], size: [2.5, 5.5], color: '160,220,255' });
    spray({ x: B.x, y: B.y + 10 }, 14, { kind: 'bubble', speed: [60, 200], drag: 2, gy: -100, life: [0.5, 0.9], size: [3, 7], color: '220,245,255' });
    if (tEl) tEl.animate([{ transform: 'translateY(-18px) rotate(-3deg)', filter: 'brightness(2)' }, { transform: 'none', filter: 'none' }], { duration: 480, easing: 'ease-out' });
    screenShake(8);
    await wait(170);
  },

  // 황금 상인조합: 금화 세례
  async merchant(c) {
    const { A, B, dir, aEl, tEl } = c;
    const N = 8;
    move(aEl, [{ transform: 'none' }, { transform: `rotate(${-dir.x * 5}deg) scale(1.05)`, offset: 0.2 }, { transform: `rotate(${dir.x * 4}deg) scale(1.05)`, offset: 0.7 }, { transform: 'none' }], 640);
    const one = async (i) => {
      await wait(i * 55);
      const T0 = { x: B.x + rnd(-14, 14), y: B.y + rnd(-18, 18) };
      const h = rnd(40, 100);
      const spin = rnd(14, 22);
      const S = { x: A.x + dir.x * 16, y: A.y - 10 };
      await phase(clamp(c.dist * 0.9, 280, 380), (x, t) => {
        const p = arcPt(S, T0, h, t);
        x.globalCompositeOperation = 'lighter';
        const gl = x.createRadialGradient(p.x, p.y, 0, p.x, p.y, 16);
        gl.addColorStop(0, 'rgba(255,220,100,.35)'); gl.addColorStop(1, 'rgba(255,220,100,0)');
        x.fillStyle = gl; x.beginPath(); x.arc(p.x, p.y, 16, 0, TAU); x.fill();
        x.globalCompositeOperation = 'source-over';
        drawCoin(p.x, p.y, 10, t * spin);
      });
      const last = i === N - 1;
      emit({ kind: 'star', x: T0.x, y: T0.y, life: 0.32, size: last ? 26 : 14, size1: 2, color: '255,245,190', add: true, vr: 6, rot: 0 });
      spray(T0, last ? 10 : 3, { kind: 'spark', speed: [120, 300], drag: 3, life: 0.25, size: 1.6, color: '255,230,120', add: true });
      emit({ kind: 'coin', x: T0.x, y: T0.y, vx: rnd(-140, 140), vy: rnd(-260, -120), gy: 1100, life: 0.8, size: 10, vr: rnd(4, 8) });
      hitReact(tEl, dir, last ? 14 : 4);
      if (last) { flash(B, 70, '255,225,120', 0.22); shockwave(B, 60, '255,230,140', 0.35); }
    };
    await Promise.all(Array.from({ length: N }, (_, i) => one(i)));
    await wait(130);
  },

  // 아이스 에이지: 얼음 숨결
  async frost(c) {
    const { A, B, dir, aEl, tEl } = c;
    move(aEl, [{ transform: 'none' }, { transform: 'scale(1.08,.95)', offset: 0.3 }, { transform: `translate(${dir.x * 6}px,${dir.y * 6}px) scale(.96,1.04)`, offset: 0.6 }, { transform: 'none' }], 760);
    await wait(200);
    const M = { x: A.x + dir.x * 28, y: A.y + dir.y * 28 };
    const D = Math.max(60, c.dist - 28);
    await phase(380, () => {
      for (let i = 0; i < 5; i++) {
        const a = c.ang + rnd(-0.2, 0.2);
        const sp = (D / 0.36) * rnd(0.75, 1.05);
        emit({ kind: 'glow', x: M.x, y: M.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 1.2, life: [0.35, 0.45], size: 4, size1: 16, color: pick(['230,248,255', '150,215,255', '200,235,255']), add: true, a0: 0.7 });
      }
      emit({ kind: 'smoke', x: M.x, y: M.y, vx: Math.cos(c.ang) * D * 2.2, vy: Math.sin(c.ang) * D * 2.2, drag: 2, life: 0.55, size: 8, size1: 30, color: '210,240,255', a0: 0.35 });
      if (Math.random() < 0.5) emit({ kind: 'star', x: M.x, y: M.y, vx: Math.cos(c.ang + rnd(-0.25, 0.25)) * D * 2.4, vy: Math.sin(c.ang + rnd(-0.25, 0.25)) * D * 2.4, drag: 2, life: 0.5, size: 4, size1: 1, color: '255,255,255', vr: 6 });
    });
    // 얼음덩이
    const r = tEl ? rectOf(tEl) : { left: B.x - 40, top: B.y - 55, width: 80, height: 110 };
    const w = r.width * 0.62 + 8;
    const hh = r.height * 0.62 + 8;
    const poly = [[-0.9, -1], [0.2, -1.08], [1, -0.85], [1.06, 0.3], [0.88, 1], [-0.1, 1.06], [-1, 0.9], [-1.08, -0.2]];
    hitReact(tEl, dir, 4, { flashColor: 'brightness(1.8) saturate(.3)' });
    await phase(360, (x, t) => {
      const s = t < 0.25 ? EASE.out3(t / 0.25) : 1;
      x.translate(B.x, B.y); x.scale(s, s);
      const gr = x.createLinearGradient(-w, -hh, w, hh);
      gr.addColorStop(0, 'rgba(240,252,255,.75)'); gr.addColorStop(0.5, 'rgba(140,210,245,.55)'); gr.addColorStop(1, 'rgba(220,245,255,.7)');
      x.fillStyle = gr;
      x.strokeStyle = 'rgba(255,255,255,.95)';
      x.lineWidth = 2;
      x.shadowBlur = 14; x.shadowColor = 'rgba(160,220,255,.9)';
      x.beginPath();
      poly.forEach(([px, py], i) => (i ? x.lineTo(px * w, py * hh) : x.moveTo(px * w, py * hh)));
      x.closePath(); x.fill(); x.shadowBlur = 0; x.stroke();
      x.strokeStyle = 'rgba(255,255,255,.7)';
      x.lineWidth = 1.5;
      x.beginPath(); x.moveTo(-w * 0.7, -hh * 0.6); x.lineTo(-w * 0.2, -hh * 0.85); x.moveTo(-w * 0.75, -hh * 0.35); x.lineTo(-w * 0.45, -hh * 0.5); x.stroke();
      if (t > 0.6) { // 금이 간다
        const k = (t - 0.6) / 0.4;
        x.strokeStyle = `rgba(255,255,255,${k})`;
        x.lineWidth = 1.2;
        x.beginPath(); x.moveTo(0, 0); x.lineTo(w * 0.4 * k, -hh * 0.5 * k); x.moveTo(0, 0); x.lineTo(-w * 0.5 * k, hh * 0.2 * k); x.moveTo(0, 0); x.lineTo(w * 0.2 * k, hh * 0.6 * k); x.stroke();
      }
    });
    flash(B, 80, '220,245,255', 0.2);
    spray(B, 22, { kind: 'shard', radius: 26, speed: [160, 420], drag: 1, gy: 800, life: [0.5, 0.8], size: [5, 11], color: pick(['200,236,255', '150,215,255', '235,250,255']), vr: rnd(-16, 16) });
    spray(B, 14, { kind: 'star', speed: [60, 200], drag: 2.5, life: [0.4, 0.7], size: [3, 6], size1: 1, color: '255,255,255', vr: 6 });
    hitReact(tEl, dir, 12);
    tint(tEl, 'saturate(.3) hue-rotate(170deg) brightness(1.3)', 700);
    await wait(150);
  },

  // 한국과수협회: 과일 비
  async fruit(c) {
    const { A, B, dir, aEl, tEl } = c;
    move(aEl, [0, 1, 2, 3, 4, 5, 6].map((i) => ({ transform: i === 6 ? 'none' : `rotate(${i % 2 ? 7 : -7}deg) translateY(${i % 2 ? -2 : 0}px)` })), 380, 'ease-in-out');
    const ar = rectOf(aEl);
    for (let i = 0; i < 7; i++) emit({ kind: 'leaf', x: A.x + rnd(-ar.width / 2, ar.width / 2), y: ar.top - 6, vx: rnd(-50, 50), vy: rnd(-80, -20), gy: 160, drag: 1.5, life: [0.8, 1.1], size: [4, 7], color: pick(['90,170,60', '130,200,80', '70,140,40']), vr: rnd(-8, 8) });
    await wait(300);
    const fruits = [['🍎', '229,72,59'], ['🍐', '220,230,120'], ['🍊', '255,160,40'], ['🍑', '255,170,150'], ['🍇', '150,80,190']];
    const tr = tEl ? rectOf(tEl) : { top: B.y - 50 };
    const top = Math.max(-30, tr.top - 170);
    await Promise.all(fruits.map(async ([f, col], i) => {
      await wait(i * 80);
      const x0 = B.x + rnd(-30, 30);
      const yEnd = B.y - 6 + rnd(-10, 10);
      const rot0 = rnd(-1, 1);
      await phase(300, (x, t) => {
        const y = lerp(top, yEnd, t);
        x.fillStyle = `rgba(0,0,0,${0.2 * t})`;
        x.beginPath(); x.ellipse(x0, B.y + 30, 12 * t, 4 * t, 0, 0, TAU); x.fill();
        drawEmoji(f, x0, y, 30, rot0 * (1 - t));
      }, EASE.in);
      const P = { x: x0, y: yEnd };
      spray(P, 12, { kind: 'dot', angle: -Math.PI / 2, spread: 1.5, speed: [100, 300], gy: 900, drag: 0.8, life: [0.35, 0.6], size: [2, 4.5], color: col });
      spray(P, 3, { kind: 'glow', speed: [20, 60], life: 0.3, size: 10, size1: 2, color: col, a0: 0.5, add: true });
      emit({ kind: 'emoji', text: f, x: x0, y: yEnd, vx: rnd(-160, 160), vy: rnd(-300, -200), gy: 1200, life: 0.6, size: 28, size1: 24, vr: rnd(-10, 10) });
      const last = i === fruits.length - 1;
      hitReact(tEl, { x: 0, y: 1 }, last ? 12 : 5);
      if (last) { shockwave(B, 56, '255,230,170', 0.35); flash(B, 60, '255,220,180', 0.18); }
    }));
    await wait(130);
  },

  // 에버랜드의 아이들: 돌진
  async zoo(c) {
    const { A, B, dir, perp, aEl, tEl } = c;
    const ar = rectOf(aEl);
    const foot = () => ({ y: ar.bottom - 4 });
    // 앞발로 땅을 긁으며 웅크린다
    move(aEl, [{ transform: 'none' }, { transform: `translate(${-dir.x * 14}px,${-dir.y * 14}px) scale(1.04,.92)` }], 200, 'ease-out');
    for (let i = 0; i < 2; i++) setTimeout(() => spray({ x: A.x - dir.x * 10, y: foot().y }, 5, { kind: 'smoke', angle: Math.atan2(-dir.y, -dir.x), spread: 0.8, speed: [60, 160], drag: 3, life: [0.4, 0.7], size: 6, size1: 18, color: '205,170,120', a0: 0.6 }), i * 100);
    await wait(210);
    const reach = c.dist * 0.74;
    const base = { x: -dir.x * 14, y: -dir.y * 14 };
    await phase(240, (x, t) => {
      const off = { x: lerp(base.x, dir.x * reach, t), y: lerp(base.y, dir.y * reach, t) };
      setT(aEl, `translate(${off.x}px,${off.y - Math.abs(Math.sin(t * Math.PI * 3)) * 6}px) scale(1.06)`);
      const P = { x: A.x + off.x, y: A.y + off.y };
      emit({ kind: 'smoke', x: P.x - dir.x * 26 + rnd(-10, 10), y: P.y + ar.height * 0.4, vx: -dir.x * 80, vy: rnd(-50, -10), drag: 2.5, life: [0.5, 0.8], size: 9, size1: 26, color: '205,170,120', a0: 0.6 });
      for (let k = 0; k < 2; k++) {
        const o = rnd(-30, 30);
        emit({ kind: 'spark', x: P.x + perp.x * o, y: P.y + perp.y * o, vx: -dir.x * 700, vy: -dir.y * 700, drag: 8, life: 0.18, size: 1.6, color: '255,255,255', a0: 0.6, stretch: 0.07 });
      }
    }, EASE.in);
    flash(B, 100, '255,240,210', 0.2);
    shockwave(B, 100, '255,235,200', 0.45);
    shockwave(B, 60, '255,255,255', 0.3);
    spray(B, 14, { kind: 'smoke', speed: [80, 240], drag: 2.5, life: [0.6, 1], size: 12, size1: 38, color: '205,170,120', a0: 0.6 });
    spray(B, 10, { kind: 'chip', speed: [200, 420], angle: -Math.PI / 2, spread: 1.5, gy: 1100, life: [0.6, 0.9], size: [3, 5], color: '120,90,60', vr: rnd(-14, 14) });
    spray(B, 14, { kind: 'spark', speed: [260, 560], drag: 3, life: 0.3, size: 2, color: '255,240,200', add: true });
    hitReact(tEl, dir, 28, { rot: dir.x * 10 });
    screenShake(13);
    aEl.style.transform = '';
    await move(aEl, [
      { transform: `translate(${dir.x * reach}px,${dir.y * reach}px) scale(1.06)` },
      { transform: `translate(${dir.x * reach * 0.85}px,${dir.y * reach * 0.85 - 12}px) scale(1.02)`, offset: 0.3 },
      { transform: 'none' },
    ], 380, 'ease-out');
  },

  // 버섯 포자 군집: 포자 구름
  async mush(c) {
    const { A, B, dir, perp, aEl, tEl } = c;
    move(aEl, [{ transform: 'none' }, { transform: 'scale(1.1,.88)', offset: 0.3 }, { transform: 'scale(.96,1.05)', offset: 0.6 }, { transform: 'none' }], 520);
    const ar = rectOf(aEl);
    const S = { x: A.x, y: ar.top + ar.height * 0.25 };
    const spores = Array.from({ length: 46 }, (_, i) => ({
      d: (i / 46) * 0.35, end: { x: B.x + rnd(-34, 34), y: B.y + rnd(-40, 40) }, amp: rnd(14, 34) * (Math.random() < 0.5 ? -1 : 1), fq: rnd(1.5, 3),
      s: rnd(1.8, 3.6), col: pick(['220,230,130', '235,215,160', '180,230,120', '250,240,190']), orbit: rnd(0, TAU),
    }));
    let hit = false;
    await phase(1050, (x, t, raw) => {
      x.globalCompositeOperation = 'lighter';
      for (const sp of spores) {
        const tt = clamp((raw - sp.d) / 0.5, 0, 1);
        if (raw < sp.d) continue;
        const e = EASE.inOut(tt);
        let p = lerpPt(S, sp.end, e);
        const w = Math.sin(e * Math.PI * sp.fq) * sp.amp * Math.sin(e * Math.PI);
        p = { x: p.x + perp.x * w, y: p.y + perp.y * w - Math.sin(e * Math.PI) * 30 };
        if (tt >= 1) { // 대상 주위를 맴돈다
          const k = (raw - sp.d - 0.5) * 6 + sp.orbit;
          p = { x: sp.end.x + Math.cos(k) * 6, y: sp.end.y + Math.sin(k) * 4 };
        }
        const a = raw > 0.8 ? (1 - raw) / 0.2 : 1;
        const gr = x.createRadialGradient(p.x, p.y, 0, p.x, p.y, sp.s * 3);
        gr.addColorStop(0, `rgba(${sp.col},${0.95 * a})`); gr.addColorStop(0.4, `rgba(${sp.col},${0.4 * a})`); gr.addColorStop(1, `rgba(${sp.col},0)`);
        x.fillStyle = gr;
        x.beginPath(); x.arc(p.x, p.y, sp.s * 3, 0, TAU); x.fill();
      }
      if (!hit && raw > 0.58) {
        hit = true;
        spray(B, 16, { kind: 'smoke', radius: 30, speed: [10, 50], drag: 1, life: [0.7, 1], size: 14, size1: 40, color: pick(['150,130,80', '120,140,70']), a0: 0.45, fadeIn: 0.25 });
        shockwave(B, 50, '220,230,140', 0.4);
        hitReact(tEl, dir, 6, { flashColor: 'brightness(1.3) sepia(.8)' });
        tint(tEl, 'sepia(.9) hue-rotate(35deg) saturate(1.4) brightness(.8)', 900);
      }
    });
    await wait(40);
  },

  // 조사병단: 와이어 기동
  async scout(c) {
    const { A, B, dir, perp, aEl, tEl } = c;
    const P1 = { x: B.x + perp.x * 58 + dir.x * 44, y: B.y + perp.y * 58 + dir.y * 44 };
    const P2 = { x: B.x - perp.x * 58 + dir.x * 44, y: B.y - perp.y * 58 + dir.y * 44 };
    let cur = { ...A };
    let wireOut = 0;
    let wireAlpha = 1;
    const wires = phase(1200, (x) => { // 와이어는 연출 내내 그린다
      x.strokeStyle = `rgba(225,232,240,${wireAlpha})`;
      x.lineWidth = 1.6;
      for (const P of [P1, P2]) {
        const end = lerpPt(cur, P, wireOut);
        x.beginPath(); x.moveTo(cur.x, cur.y); x.lineTo(end.x, end.y); x.stroke();
        if (wireOut >= 1) {
          x.fillStyle = `rgba(160,170,180,${wireAlpha})`;
          x.beginPath(); x.arc(P.x, P.y, 3, 0, TAU); x.fill();
        }
      }
    }, EASE.linear, 0);
    await phase(150, (x, t) => { wireOut = t; }, EASE.out);
    for (const P of [P1, P2]) spray(P, 6, { kind: 'spark', speed: [80, 220], drag: 4, life: 0.2, size: 1.5, color: '255,240,200', add: true });
    const reach = c.dist * 0.9;
    await phase(250, (x, t) => {
      const off = { x: dir.x * reach * t, y: dir.y * reach * t };
      cur = { x: A.x + off.x, y: A.y + off.y };
      setT(aEl, `translate(${off.x}px,${off.y}px) rotate(${t * 360 * (dir.x < 0 ? -1 : 1)}deg) scale(.95)`);
      emit({ kind: 'smoke', x: cur.x - dir.x * 20, y: cur.y - dir.y * 20, vx: -dir.x * 120 + rnd(-30, 30), vy: -dir.y * 120 + rnd(-30, 30), drag: 3, life: [0.4, 0.6], size: 5, size1: 18, color: '245,245,245', a0: 0.6 });
    }, EASE.in);
    const L = 50;
    slash({ x: B.x - perp.x * L - dir.x * 16, y: B.y - perp.y * L - dir.y * 16 }, { x: B.x + perp.x * L + dir.x * 16, y: B.y + perp.y * L + dir.y * 16 }, 12, { glow: '200,255,210', width: 6, ms: 300 });
    hitReact(tEl, dir, 8);
    await wait(70);
    slash({ x: B.x + perp.x * L - dir.x * 22, y: B.y + perp.y * L - dir.y * 22 }, { x: B.x - perp.x * L + dir.x * 22, y: B.y - perp.y * L + dir.y * 22 }, -12, { glow: '200,255,210', width: 6, ms: 300 });
    flash(B, 60, '230,255,235', 0.16);
    hitReact(tEl, dir, 14, { flashColor: 'brightness(3)' });
    await wait(80);
    const back = { x: dir.x * reach, y: dir.y * reach };
    await phase(300, (x, t) => {
      const off = { x: back.x * (1 - t), y: back.y * (1 - t) - Math.sin(t * Math.PI) * 30 };
      cur = { x: A.x + off.x, y: A.y + off.y };
      wireAlpha = 1 - t;
      setT(aEl, `translate(${off.x}px,${off.y}px)`);
    }, EASE.inOut);
    wireAlpha = 0;
    setT(aEl, '');
    void wires;
  },

  // 국가 연금술사: 연성진
  async alchemy(c) {
    const { A, B, dir, aEl, tEl } = c;
    const ar = rectOf(aEl);
    const clap = { x: A.x, y: ar.top - 4 };
    move(aEl, [{ transform: 'none' }, { transform: 'scale(1.12)', offset: 0.3 }, { transform: 'none' }], 300);
    flash(clap, 40, '140,200,255', 0.2);
    spray(clap, 14, { kind: 'spark', speed: [120, 320], drag: 4, life: [0.15, 0.3], size: 1.6, color: '160,215,255', add: true });
    await wait(160);
    const tr = tEl ? rectOf(tEl) : { bottom: B.y + 50, width: 80 };
    const C = { x: B.x, y: tr.bottom - 4 };
    const R = Math.max(44, tr.width * 0.75);
    let pillar = false;
    const arcs = [];
    await phase(820, (x, t) => {
      const fade = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
      x.globalCompositeOperation = 'lighter';
      x.save();
      x.translate(C.x, C.y); x.scale(1, 0.36);
      x.strokeStyle = `rgba(130,195,255,${0.95 * fade})`;
      x.shadowBlur = 14; x.shadowColor = 'rgba(80,160,255,1)';
      x.lineCap = 'round';
      const prog = (a, b) => clamp((t - a) / (b - a), 0, 1);
      const spin = t * 1.2;
      x.lineWidth = 3;
      x.beginPath(); x.arc(0, 0, R, spin, spin + TAU * prog(0, 0.28)); x.stroke();
      x.lineWidth = 2;
      x.beginPath(); x.arc(0, 0, R * 0.8, -spin, -spin - TAU * prog(0.06, 0.3), true); x.stroke();
      x.beginPath(); x.arc(0, 0, R * 0.32, 0, TAU * prog(0.12, 0.34)); x.stroke();
      // 육각별
      const hp = prog(0.18, 0.42);
      if (hp > 0) {
        for (const off of [0, Math.PI / 3]) {
          x.beginPath();
          for (let i = 0; i <= 3; i++) {
            const an = off + spin * 0.6 + (i * TAU) / 3;
            const px = Math.cos(an) * R * 0.8;
            const py = Math.sin(an) * R * 0.8;
            if (i === 0) x.moveTo(px, py);
            else if (i / 3 <= hp) x.lineTo(px, py);
          }
          x.stroke();
        }
      }
      // 고리 사이 룬 눈금
      const rp = prog(0.15, 0.45);
      x.lineWidth = 1.5;
      for (let i = 0; i < 24 * rp; i++) {
        const an = spin + (i * TAU) / 24;
        x.beginPath(); x.moveTo(Math.cos(an) * R * 0.84, Math.sin(an) * R * 0.84); x.lineTo(Math.cos(an) * R * (i % 3 ? 0.92 : 0.97), Math.sin(an) * R * (i % 3 ? 0.92 : 0.97)); x.stroke();
      }
      x.restore();
      // 번개
      if (t > 0.3 && t < 0.75 && Math.random() < 0.5) {
        const an = rnd(0, TAU);
        arcs.push({ x0: C.x + Math.cos(an) * R, y0: C.y + Math.sin(an) * R * 0.36, life: 4, pts: Array.from({ length: 5 }, (_, i) => ({ dx: rnd(-10, 10), dy: -i * rnd(8, 14) })) });
      }
      x.shadowBlur = 10;
      for (let i = arcs.length - 1; i >= 0; i--) {
        const a = arcs[i];
        x.strokeStyle = `rgba(200,230,255,${a.life / 4})`;
        x.lineWidth = 1.5;
        x.beginPath();
        a.pts.forEach((p, k) => (k ? x.lineTo(a.x0 + p.dx, a.y0 + p.dy) : x.moveTo(a.x0, a.y0)));
        x.stroke();
        if (--a.life <= 0) arcs.splice(i, 1);
      }
      if (!pillar && t > 0.42) {
        pillar = true;
        hitReact(tEl, { x: 0, y: -1 }, 16, { flashColor: 'brightness(2.6) saturate(.6)' });
        flash(C, 70, '200,230,255', 0.25);
        shockwave(C, R * 1.3, '170,215,255', 0.45, true);
        phase(480, (y, u) => {
          y.globalCompositeOperation = 'lighter';
          const wdt = R * 0.9 * (1 - u * 0.6);
          const hgt = 260 * EASE.out3(Math.min(1, u * 2.5));
          const gr = y.createLinearGradient(0, C.y, 0, C.y - hgt);
          gr.addColorStop(0, `rgba(255,250,230,${0.9 * (1 - u)})`); gr.addColorStop(0.4, `rgba(160,210,255,${0.55 * (1 - u)})`); gr.addColorStop(1, 'rgba(120,180,255,0)');
          y.fillStyle = gr;
          y.fillRect(C.x - wdt / 2, C.y - hgt, wdt, hgt);
          y.fillStyle = `rgba(255,255,255,${0.8 * (1 - u)})`;
          y.fillRect(C.x - wdt * 0.12, C.y - hgt, wdt * 0.24, hgt);
        });
        spray(C, 26, { kind: 'glow', angle: -Math.PI / 2, spread: 0.3, radius: R * 0.4, speed: [120, 380], drag: 1.5, life: [0.5, 0.9], size: [3, 6], size1: 1, color: pick(['200,230,255', '255,240,200']), add: true });
        spray(B, 10, { kind: 'chip', speed: [120, 300], angle: -Math.PI / 2, spread: 1, gy: 900, life: 0.7, size: [3, 5], color: '160,150,140', vr: rnd(-12, 12) });
      }
    });
    await wait(20);
  },
};

export function hasAttackFx(factionId) {
  return Object.hasOwn(FX, factionId);
}

// 해적단 공격 연출을 재생한다. 맞는 순간과 짧은 여운이 끝나면 resolve된다.
export async function playAttackFx(factionId, { from, to, aEl, tEl }) {
  ensure();
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy) || 1;
  const dir = { x: dx / dist, y: dy / dist };
  const c = { A: from, B: to, dir, perp: { x: -dir.y, y: dir.x }, dist, ang: Math.atan2(dy, dx), aEl, tEl };
  const oldTransition = aEl.style.transition;
  aEl.style.transition = 'none';
  aEl.style.zIndex = '20';
  live = [];
  try {
    await FX[factionId](c);
  } finally {
    for (const a of live) a.cancel();
    live = [];
    aEl.style.transform = '';
    aEl.style.transition = oldTransition;
    aEl.style.zIndex = '';
  }
}
