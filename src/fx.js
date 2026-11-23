// 공격 연출. 화면 전체를 덮는 캔버스 하나에 입자와 도형을 그린다.
// - 좌표는 문서(page) 좌표로 다룬다. 연출 중에 화면이 스크롤돼도 조준이 어긋나지 않는다.
// - 빛·연기 입자는 미리 그려 둔 스프라이트를 찍기만 하고, 그림자 흐림(shadowBlur)은 쓰지 않는다(폰에서 느리다).
// - 카드 DOM은 WAAPI(transform/opacity)로만 움직인다. 매 프레임 style을 바꾸거나 filter를 애니메이션하지 않는다.

const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const lerpPt = (P, Q, t) => ({ x: lerp(P.x, Q.x, t), y: lerp(P.y, Q.y, t) });
// 연출 속도 배율. 해적단마다 원래 길이가 달라서(0.55~1.5초) 0.8초 쪽으로 당겨 비슷하게 맞춘다.
let TIME = 1;
const wait = (ms) => new Promise((r) => setTimeout(r, ms * TIME));
const EASE = {
  linear: (t) => t,
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) ** 2,
  out3: (t) => 1 - (1 - t) ** 3,
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  outBack: (t) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2,
};
const MAX_PARTS = 380;

// ── 캔버스 ──

let cv = null;
let g = null;
let W = 0;
let H = 0;
let dpr = 1;
const parts = [];
const drawers = [];
let running = false;
let last = 0;
let shakeEl = null;

const scroll = () => ({ x: window.scrollX || 0, y: window.scrollY || 0 });
function pageRect(el) {
  const r = el.getBoundingClientRect();
  const s = scroll();
  return { left: r.left + s.x, top: r.top + s.y, right: r.right + s.x, bottom: r.bottom + s.y, width: r.width, height: r.height };
}

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
  W = innerWidth;
  H = innerHeight;
  dpr = Math.min(2, devicePixelRatio || 1);
  if (W * H * dpr * dpr > 3.2e6) dpr = Math.max(1, Math.sqrt(3.2e6 / (W * H))); // 큰 화면은 해상도를 조금 낮춘다
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  cv.style.width = `${W}px`;
  cv.style.height = `${H}px`;
  g = cv.getContext('2d');
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
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, cv.width, cv.height);
  const s = scroll();
  g.setTransform(dpr, 0, 0, dpr, -s.x * dpr, -s.y * dpr); // 문서 좌표 → 화면
  for (const layer of [0, 1]) {
    for (const d of drawers) {
      if (d.layer !== layer) continue;
      const t = clamp((now - d.t0) / d.dur, 0, 1);
      g.save();
      d.fn(g, d.ease(t), t, dt);
      g.restore();
    }
    if (layer === 0) drawParts(dt);
  }
  for (let i = drawers.length - 1; i >= 0; i--) {
    if (now - drawers[i].t0 >= drawers[i].dur) drawers.splice(i, 1)[0].done();
  }
  if (parts.length || drawers.length) requestAnimationFrame(loop);
  else {
    running = false;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cv.width, cv.height);
  }
}

// 시간 ms 동안 매 프레임 fn(ctx, 이징된 t, 원래 t, dt)를 부른다. layer 0은 입자 아래, 1은 위.
function phase(ms, fn, ease = EASE.linear, layer = 1) {
  ensure();
  return new Promise((done) => {
    drawers.push({ t0: performance.now(), dur: ms * TIME, fn, ease, layer, done });
    kick();
  });
}

// ── 스프라이트 ──

const sprites = new Map();
function glowSprite(color, soft) {
  const key = `${soft ? 's' : 'g'}${color}`;
  let c = sprites.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  if (soft) {
    gr.addColorStop(0, `rgba(${color},1)`);
    gr.addColorStop(0.5, `rgba(${color},.45)`);
    gr.addColorStop(1, `rgba(${color},0)`);
  } else {
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.18, `rgba(${color},1)`);
    gr.addColorStop(0.45, `rgba(${color},.45)`);
    gr.addColorStop(1, `rgba(${color},0)`);
  }
  x.fillStyle = gr;
  x.fillRect(0, 0, 64, 64);
  sprites.set(key, c);
  return c;
}
function emojiSprite(text) {
  const key = `e${text}`;
  let c = sprites.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 96;
  const x = c.getContext('2d');
  x.font = '72px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(text, 48, 52);
  sprites.set(key, c);
  return c;
}
function glowAt(x, y, r, color, a = 1, soft = false) {
  g.globalAlpha = clamp(a, 0, 1);
  g.drawImage(glowSprite(color, soft), x - r, y - r, r * 2, r * 2);
  g.globalAlpha = 1;
}
function drawEmoji(text, x, y, size, rot = 0, a = 1) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.globalAlpha = a;
  const s = (size / 72) * 96;
  g.drawImage(emojiSprite(text), -s / 2, -s / 2, s, s);
  g.restore();
}

// ── 입자 ──

// 속도는 px/초, 중력 gy는 px/초², drag는 초당 감속 계수. delay(초)만큼 늦게 나타난다.
function emit(o) {
  ensure();
  if (parts.length >= MAX_PARTS) return;
  const life = Array.isArray(o.life) ? rnd(...o.life) : (o.life ?? 0.5);
  const size = Array.isArray(o.size) ? rnd(...o.size) : (o.size ?? 4);
  parts.push({
    kind: o.kind || 'dot', x: o.x, y: o.y, vx: o.vx || 0, vy: o.vy || 0, gy: o.gy || 0, drag: o.drag || 0,
    life, age: -(o.delay || 0), size, size1: o.size1 ?? size, color: o.color || '255,255,255', a0: o.a0 ?? 1,
    add: !!o.add, rot: o.rot ?? rnd(0, TAU), vr: o.vr ?? 0, flat: !!o.flat, text: o.text, fadeIn: o.fadeIn || 0, stretch: o.stretch ?? 0.035,
  });
  kick();
}
function spray(P, n, o) {
  for (let i = 0; i < n; i++) {
    const a = (o.angle ?? 0) + rnd(-(o.spread ?? Math.PI), o.spread ?? Math.PI);
    const sp = Array.isArray(o.speed) ? rnd(...o.speed) : (o.speed ?? 100);
    const r = o.radius ? rnd(0, o.radius) : 0;
    const color = Array.isArray(o.color) ? pick(o.color) : o.color;
    emit({ ...o, color, x: P.x + Math.cos(a) * r, y: P.y + Math.sin(a) * r, vx: Math.cos(a) * sp + (o.vx || 0), vy: Math.sin(a) * sp + (o.vy || 0), vr: o.vr ?? rnd(-8, 8) });
  }
}

function drawParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.age += dt;
    if (p.age < 0) continue;
    if (p.age >= p.life) { parts.splice(i, 1); continue; }
    const k = Math.exp(-p.drag * dt);
    p.vx *= k;
    p.vy = p.vy * k + p.gy * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    const f = p.age / p.life;
    let a = p.a0 * (1 - f) ** 1.3;
    if (p.fadeIn && f < p.fadeIn) a *= f / p.fadeIn;
    const s = lerp(p.size, p.size1, f);
    g.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
    drawPart(p, s, a);
  }
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
}

function drawPart(p, s, a) {
  const c = p.color;
  switch (p.kind) {
    case 'glow': glowAt(p.x, p.y, s, c, a); break;
    case 'smoke': glowAt(p.x, p.y, s, c, a, true); break;
    case 'spark':
      g.strokeStyle = `rgba(${c},${a})`;
      g.lineWidth = s;
      g.lineCap = 'round';
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * p.stretch, p.y - p.vy * p.stretch); g.stroke();
      break;
    case 'ring':
      g.strokeStyle = `rgba(${c},${a})`;
      g.lineWidth = Math.max(0.6, 6 * (1 - p.age / p.life));
      g.beginPath(); g.ellipse(p.x, p.y, s, s * (p.flat ? 0.35 : 1), 0, 0, TAU); g.stroke();
      break;
    case 'bubble':
      g.strokeStyle = `rgba(${c},${a})`;
      g.lineWidth = 1.4;
      g.beginPath(); g.arc(p.x, p.y, s, 0, TAU); g.stroke();
      g.fillStyle = `rgba(255,255,255,${a * 0.8})`;
      g.beginPath(); g.arc(p.x - s * 0.35, p.y - s * 0.35, s * 0.25, 0, TAU); g.fill();
      break;
    case 'shard':
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
      g.fillStyle = `rgba(${c},${a})`;
      g.strokeStyle = `rgba(255,255,255,${a})`;
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(0, -s); g.lineTo(s * 0.55, s * 0.7); g.lineTo(-s * 0.45, s * 0.5); g.closePath(); g.fill(); g.stroke();
      g.restore();
      break;
    case 'chip':
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
      g.fillStyle = `rgba(${c},${a})`;
      g.fillRect(-s, -s * 0.4, s * 2, s * 0.8);
      g.fillStyle = `rgba(0,0,0,${a * 0.35})`;
      g.fillRect(-s, s * 0.1, s * 2, s * 0.3);
      g.restore();
      break;
    case 'star':
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
      g.fillStyle = `rgba(${c},${a})`;
      starPath(s, s * 0.3, 4);
      g.fill();
      g.restore();
      break;
    case 'leaf':
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
      g.scale(1, Math.abs(Math.cos(p.rot * 1.7)) * 0.8 + 0.2);
      g.fillStyle = `rgba(${c},${a})`;
      g.beginPath(); g.ellipse(0, 0, s, s * 0.45, 0, 0, TAU); g.fill();
      g.strokeStyle = `rgba(20,60,10,${a * 0.6})`;
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(-s, 0); g.lineTo(s, 0); g.stroke();
      g.restore();
      break;
    case 'coin': drawCoin(p.x, p.y, s, p.rot * 3, a); break;
    case 'gear': drawGear(p.x, p.y, s, p.rot, `rgba(${c},${a})`); break;
    case 'banana': drawBanana(p.x, p.y, s, p.rot, a); break;
    case 'emoji': drawEmoji(p.text, p.x, p.y, s, p.rot, a); break;
    default:
      g.fillStyle = `rgba(${c},${a})`;
      g.beginPath(); g.arc(p.x, p.y, s, 0, TAU); g.fill();
  }
}

// ── 도형 ──

function starPath(r1, r0, points) {
  g.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? r0 : r1;
    const an = (i * Math.PI) / points - Math.PI / 2;
    g.lineTo(Math.cos(an) * r, Math.sin(an) * r);
  }
  g.closePath();
}
function rrect(x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
function drawCoin(x, y, r, spin, a = 1) {
  const sx = Math.max(0.12, Math.abs(Math.cos(spin)));
  g.save(); g.translate(x, y); g.scale(sx, 1); g.globalAlpha = a;
  g.fillStyle = '#8a5a08';
  g.beginPath(); g.arc(0, 1.5, r, 0, TAU); g.fill();
  const gr = g.createLinearGradient(-r, -r, r, r);
  gr.addColorStop(0, '#fff6c8'); gr.addColorStop(0.45, '#ffcf3a'); gr.addColorStop(1, '#b07a10');
  g.fillStyle = gr;
  g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
  g.strokeStyle = '#ffe9a0'; g.lineWidth = 1.2;
  g.beginPath(); g.arc(0, 0, r * 0.62, 0, TAU); g.stroke();
  g.restore();
}
function drawGear(x, y, r, rot, fill) {
  g.save(); g.translate(x, y); g.rotate(rot);
  g.fillStyle = fill;
  g.beginPath();
  for (let i = 0; i < 16; i++) {
    const a0 = (i * Math.PI) / 8;
    const rr = i % 2 ? r * 0.72 : r;
    g.lineTo(Math.cos(a0 - 0.12) * rr, Math.sin(a0 - 0.12) * rr);
    g.lineTo(Math.cos(a0 + 0.12) * rr, Math.sin(a0 + 0.12) * rr);
  }
  g.closePath();
  g.arc(0, 0, r * 0.3, 0, TAU, true);
  g.fill('evenodd');
  g.restore();
}
function drawBanana(x, y, s, rot, a = 1) {
  g.save(); g.translate(x, y); g.rotate(rot); g.globalAlpha = a;
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(-s, -s * 0.15);
  g.quadraticCurveTo(0, s * 1.05, s, -s * 0.15);
  g.quadraticCurveTo(0, s * 0.5, -s, -s * 0.15);
  g.closePath();
  const gr = g.createLinearGradient(0, -s * 0.2, 0, s * 0.6);
  gr.addColorStop(0, '#fff27a'); gr.addColorStop(0.6, '#ffd21f'); gr.addColorStop(1, '#d89a00');
  g.fillStyle = gr;
  g.fill();
  g.strokeStyle = '#7a4d00';
  g.lineWidth = 1.6;
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.7)';
  g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(-s * 0.6, s * 0.12); g.quadraticCurveTo(0, s * 0.55, s * 0.6, s * 0.12); g.stroke();
  g.fillStyle = '#5a3a10';
  g.beginPath(); g.arc(-s, -s * 0.15, s * 0.13, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(s * 0.92, -s * 0.12); g.lineTo(s * 1.15, -s * 0.38); g.lineTo(s * 1.05, -s * 0.05); g.closePath(); g.fill();
  g.restore();
}

// 가운데가 두껍고 양끝이 가는 곡선 띠. from~to(0~1) 구간만 그린다.
function ribbon(P, C, Q, width, color, alpha, from = 0, to = 1) {
  const N = 20;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const t = lerp(from, to, i / N);
    const u = 1 - t;
    pts.push({ x: u * u * P.x + 2 * u * t * C.x + t * t * Q.x, y: u * u * P.y + 2 * u * t * C.y + t * t * Q.y, w: Math.sin((Math.PI * i) / N) * width });
  }
  g.beginPath();
  const side = (sign) => {
    const idx = sign > 0 ? [...pts.keys()] : [...pts.keys()].reverse();
    for (const i of idx) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(N, i + 1)];
      const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      g.lineTo(pts[i].x - ((b.y - a.y) / L) * pts[i].w * sign, pts[i].y + ((b.x - a.x) / L) * pts[i].w * sign);
    }
  };
  side(1);
  side(-1);
  g.closePath();
  g.fillStyle = `rgba(${color},${alpha})`;
  g.fill();
}
function quadPt(P, C, Q, t) {
  const u = 1 - t;
  return { x: u * u * P.x + 2 * u * t * C.x + t * t * Q.x, y: u * u * P.y + 2 * u * t * C.y + t * t * Q.y };
}

// 칼자국: 빠르게 그어졌다가 심이 가늘어지며 사라진다.
function slash(P, Q, bend, { core = '255,255,255', glow = '150,210,255', width = 7, ms = 300 } = {}) {
  const M = lerpPt(P, Q, 0.5);
  const dx = Q.x - P.x;
  const dy = Q.y - P.y;
  const L = Math.hypot(dx, dy) || 1;
  const C = { x: M.x - (dy / L) * bend, y: M.y + (dx / L) * bend };
  let sparked = false;
  return phase(ms, (x, t) => {
    const reveal = clamp(t / 0.25, 0, 1);
    const fade = t < 0.25 ? 1 : 1 - (t - 0.25) / 0.75;
    x.globalCompositeOperation = 'lighter';
    ribbon(P, C, Q, width * 3.2, glow, 0.22 * fade, 0, reveal);
    ribbon(P, C, Q, width * 1.8, glow, 0.5 * fade, 0, reveal);
    ribbon(P, C, Q, width * fade, core, fade, 0, reveal);
    if (!sparked && reveal >= 1) {
      sparked = true;
      for (let i = 0; i < 10; i++) {
        const p = quadPt(P, C, Q, rnd(0.15, 0.85));
        emit({ kind: 'spark', x: p.x, y: p.y, vx: (dx / L) * rnd(80, 260) + rnd(-60, 60), vy: (dy / L) * rnd(80, 260) + rnd(-60, 60), life: [0.18, 0.35], size: 2, color: glow, add: true, drag: 3 });
      }
    }
  });
}

const arcPt = (P, Q, h, t) => ({ x: lerp(P.x, Q.x, t), y: lerp(P.y, Q.y, t) - h * 4 * t * (1 - t) });

// ── 공용 효과 ──

function flash(P, r, color = '255,240,210', life = 0.2) {
  emit({ kind: 'glow', x: P.x, y: P.y, size: r * 0.6, size1: r, life, color, add: true });
}
function shockwave(P, r, color = '255,255,255', life = 0.4, { flat = false, delay = 0 } = {}) {
  emit({ kind: 'ring', x: P.x, y: P.y, size: r * 0.15, size1: r, life, color, a0: 0.9, flat, delay });
}
function explosion(P, k = 1) {
  flash(P, 100 * k, '255,236,190', 0.24);
  shockwave(P, 80 * k, '255,230,180', 0.38);
  spray(P, 26, { kind: 'glow', speed: [60, 320 * k], drag: 4, life: [0.35, 0.7], size: [16, 28], size1: 3, color: ['255,190,70', '255,120,30', '255,235,160'], add: true });
  spray(P, 16, { kind: 'spark', speed: [250, 620 * k], drag: 2.5, gy: 500, life: [0.25, 0.5], size: 2.2, color: '255,220,130', add: true });
  spray(P, 10, { kind: 'smoke', speed: [30, 110], drag: 2, gy: -40, life: [0.7, 1.1], size: 12, size1: 40 * k, color: '150,140,130', a0: 0.55 });
}
// 카드 위를 덮는 색 막(번쩍임, 물듦). filter 애니메이션 대신 캔버스에 그린다.
function overlay(el, color, ms, { a0 = 0.8, add = true } = {}) {
  if (!el || !color) return;
  const r = pageRect(el);
  phase(ms, (x, t) => {
    x.globalCompositeOperation = add ? 'lighter' : 'source-over';
    x.fillStyle = `rgba(${color},${a0 * (1 - t) ** 1.5})`;
    rrect(r.left, r.top, r.width, r.height, Math.min(14, r.width * 0.15));
    x.fill();
  });
}

let live = [];
function move(el, frames, ms, easing = 'ease-out') {
  if (!el) return Promise.resolve();
  const a = el.animate(frames, { duration: ms * TIME, easing, fill: 'both' });
  live.push(a);
  return a.finished.catch(() => {});
}
function hitReact(el, dir, power = 12, { rot = 0, flashColor = '255,255,255' } = {}) {
  if (!el) return;
  const x = dir.x * power;
  const y = dir.y * power;
  el.animate([
    { transform: 'none' },
    { transform: `translate(${x}px,${y}px) rotate(${rot}deg) scale(.96)`, offset: 0.22 },
    { transform: `translate(${-x * 0.3}px,${-y * 0.3}px)`, offset: 0.6 },
    { transform: 'none' },
  ], { duration: 380, easing: 'ease-out' });
  overlay(el, flashColor, 220, { a0: 0.7 });
}
function screenShake(k = 8) {
  if (!shakeEl) return;
  const frames = [];
  for (let i = 0; i <= 6; i++) {
    const d = k * (1 - i / 6);
    frames.push({ transform: i === 6 ? 'none' : `translate(${rnd(-d, d)}px,${rnd(-d, d)}px)` });
  }
  shakeEl.animate(frames, { duration: 300, easing: 'linear' });
}

// ── 고무팔 ──

function armPoints(x0, y0, x1, y1, waves, amp) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const steps = Math.max(16, Math.round(waves * 10));
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const off = Math.sin(t * waves * TAU) * amp * Math.sin(t * Math.PI);
    pts.push([x0 + dx * t + nx * off, y0 + dy * t + ny * off]);
  }
  return { pts, nx, ny };
}
function strokePts(pts, ox = 0, oy = 0) {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x + ox, y + oy) : g.moveTo(x + ox, y + oy)));
  g.stroke();
}
function drawArm(x0, y0, x1, y1, waves, amp, thick = 1) {
  const { pts, nx, ny } = armPoints(x0, y0, x1, y1, waves, amp);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = 'rgba(0,0,0,.25)';
  g.lineWidth = 17 * thick;
  strokePts(pts, 0, 5);
  g.strokeStyle = '#6a3512';
  g.lineWidth = 17 * thick;
  strokePts(pts);
  g.strokeStyle = '#f4b47c';
  g.lineWidth = 11 * thick;
  strokePts(pts);
  g.strokeStyle = 'rgba(255,232,205,.85)';
  g.lineWidth = 3.2 * thick;
  strokePts(pts, -nx * 2.6 * thick, -ny * 2.6 * thick);
  g.strokeStyle = 'rgba(160,80,30,.35)';
  g.lineWidth = 2.4 * thick;
  strokePts(pts, nx * 3 * thick, ny * 3 * thick);
}
function drawGlove(x, y, r, ang, sx = 1, sy = 1, a = 1) {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.scale(sx, sy);
  g.globalAlpha = a;
  // 소매
  g.fillStyle = '#5a0f0c';
  rrect(-r * 1.25, -r * 0.62, r * 0.55, r * 1.24, 4);
  g.fill();
  g.fillStyle = '#fff4e0';
  rrect(-r * 1.18, -r * 0.55, r * 0.42, r * 1.1, 3);
  g.fill();
  // 주먹
  g.fillStyle = '#5a0f0c';
  g.beginPath(); g.arc(0, 0, r + 2.5, 0, TAU); g.fill();
  const gr = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
  gr.addColorStop(0, '#ff9a8a'); gr.addColorStop(0.45, '#e8423b'); gr.addColorStop(1, '#9a1a14');
  g.fillStyle = gr;
  g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
  // 엄지
  g.fillStyle = '#c92f28';
  g.beginPath(); g.ellipse(-r * 0.05, -r * 0.78, r * 0.42, r * 0.26, 0.3, 0, TAU); g.fill();
  // 마디
  g.strokeStyle = 'rgba(90,15,12,.7)';
  g.lineWidth = 1.6;
  for (const k of [-0.42, 0, 0.42]) {
    g.beginPath(); g.arc(r * 0.55, k * r, r * 0.28, -1.1, 1.1); g.stroke();
  }
  g.strokeStyle = 'rgba(255,255,255,.75)';
  g.lineWidth = 2.2;
  g.lineCap = 'round';
  g.beginPath(); g.arc(-r * 0.1, -r * 0.05, r * 0.65, -2.6, -1.6); g.stroke();
  g.restore();
}
// 만화풍 충격 별
function pow(P, k, color = '255,243,160', edge = '#e8423b') {
  const rot = rnd(-0.3, 0.3);
  const spikes = Array.from({ length: 12 }, () => rnd(0.75, 1.15));
  return phase(300, (x, t) => {
    const s = 34 * k * (t < 0.3 ? EASE.outBack(t / 0.3) * 0.9 + 0.1 : 1 + (t - 0.3) * 0.25);
    const a = t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45;
    x.translate(P.x, P.y);
    x.rotate(rot);
    x.globalAlpha = a;
    x.beginPath();
    for (let i = 0; i < 24; i++) {
      const r = i % 2 ? s * 0.55 : s * spikes[i / 2];
      const an = (i * Math.PI) / 12;
      x.lineTo(Math.cos(an) * r, Math.sin(an) * r);
    }
    x.closePath();
    x.fillStyle = `rgb(${color})`;
    x.fill();
    x.lineWidth = 3;
    x.strokeStyle = edge;
    x.stroke();
    x.fillStyle = '#ffffff';
    x.beginPath(); x.arc(0, 0, s * 0.3, 0, TAU); x.fill();
  });
}

async function rubber(c, tension) {
  const { A, B, dir, perp, aEl, tEl } = c;
  const ar = pageRect(aEl);
  const S = { x: A.x + dir.x * ar.width * 0.2, y: A.y + dir.y * ar.height * 0.15 }; // 어깨
  const R = 15 + tension * 1.5;
  const T = { x: B.x - dir.x * R * 0.6, y: B.y - dir.y * R * 0.6 };
  const WIND = tension ? 220 : 110;
  const OUT = 250;
  const HOLD = 80;
  const BACK = 230;
  const total = WIND + OUT + HOLD + BACK;
  const waves = 2.5 + tension;
  const trail = [];
  let hit = false;
  move(aEl, [
    { transform: 'none' },
    { transform: `translate(${-dir.x * (4 + tension * 3)}px,${-dir.y * (4 + tension * 3)}px) scale(${1 - tension * 0.03},${1 + tension * 0.03})`, offset: WIND / total },
    { transform: `translate(${dir.x * 8}px,${dir.y * 8}px) scale(1.04)`, offset: (WIND + OUT * 0.6) / total },
    { transform: 'none' },
  ], total);
  await phase(total, (x, _, raw) => {
    const t = raw * total;
    let p;
    let amp;
    let sx = 1;
    let sy = 1;
    if (t < WIND) {
      const u = EASE.out(t / WIND);
      p = -0.1 * u * (tension ? 1 : 0.5);
      amp = 5 + u * (8 + tension * 5); // 감기는 용수철
    } else if (t < WIND + OUT) {
      const u = (t - WIND) / OUT;
      p = EASE.outBack(u);
      amp = Math.abs(1 - p) * 18 + 4 + tension * 2;
      if (u < 0.75) {
        const q = lerpPt(S, T, p);
        emit({ kind: 'spark', x: q.x + perp.x * rnd(-14, 14), y: q.y + perp.y * rnd(-14, 14), vx: -dir.x * 700, vy: -dir.y * 700, drag: 7, life: 0.16, size: 1.6, color: '255,255,255', a0: 0.55, stretch: 0.05 });
      }
    } else if (t < WIND + OUT + HOLD) {
      p = 1;
      amp = 4 + tension * 2;
      const u = (t - WIND - OUT) / HOLD;
      sx = 0.78 + u * 0.22;
      sy = 1.18 - u * 0.18;
    } else {
      const u = (t - WIND - OUT - HOLD) / BACK;
      p = 1 - EASE.in(u);
      amp = Math.sin(u * Math.PI) * (14 + tension * 3) + 4; // 되돌아올 때 출렁
    }
    const tip = lerpPt(S, T, p);
    if (t >= WIND && t < WIND + OUT) {
      trail.push(tip);
      if (trail.length > 4) trail.shift();
    } else trail.length = 0;
    drawArm(S.x, S.y, tip.x, tip.y, waves, amp, 1 + tension * 0.08);
    trail.forEach((q, i) => drawGlove(q.x, q.y, R, c.ang, 1, 1, ((i + 1) / trail.length) * 0.22));
    if (tension && t < WIND) glowAt(tip.x, tip.y, R * 2.2, '255,170,80', 0.25 + 0.25 * Math.sin(t / 40), true);
    drawGlove(tip.x, tip.y, R, c.ang, sx, sy);
    if (!hit && t >= WIND + OUT * 0.72) {
      hit = true;
      const k = 1 + tension * 0.3;
      flash(B, 80 * k, '255,240,200', 0.2);
      pow(B, k);
      for (let i = 0; i <= tension; i++) shockwave(B, 60 + i * 22, i ? '255,180,90' : '255,255,255', 0.38, { delay: i * 0.06 });
      spray(B, 10 + tension * 4, { kind: 'star', speed: [140, 340], drag: 3, life: [0.35, 0.6], size: [5, 9], size1: 1, color: ['255,230,90', '255,255,255', '255,160,80'], vr: 9 });
      spray(B, 10, { kind: 'spark', angle: c.ang, spread: 1.2, speed: [250, 560], drag: 3, life: 0.25, size: 2, color: '255,235,180', add: true });
      hitReact(tEl, dir, 12 + tension * 5, { rot: dir.x * (3 + tension * 2) });
      c.impact();
      screenShake(3 + tension * 3);
    }
  });
}

// ── 해적단별 연출 ──
// c: { A(공격자 중심), B(대상 중심), dir(단위 벡터), perp(수직), dist, ang, aEl, tEl } — 모두 문서 좌표

const FX = {
  // 붉은 돛: 대포 한 방
  async red(c) {
    const { A, B, dir, aEl, tEl } = c;
    const back = `translate(${-dir.x * 10}px,${-dir.y * 10}px) scale(1.06,.94)`;
    await move(aEl, [{ transform: 'none' }, { transform: back }], 150);
    const M = { x: A.x + dir.x * 34, y: A.y + dir.y * 34 };
    move(aEl, [{ transform: back }, { transform: `translate(${-dir.x * 26}px,${-dir.y * 26}px) rotate(${-Math.sign(dir.x || 1) * 6}deg)`, offset: 0.2 }, { transform: 'none' }], 420);
    flash(M, 50, '255,220,140', 0.16);
    spray(M, 14, { angle: c.ang, spread: 0.5, kind: 'spark', speed: [180, 480], drag: 4, life: [0.12, 0.26], size: 2.5, color: '255,210,100', add: true });
    spray(M, 9, { angle: c.ang, spread: 0.9, kind: 'smoke', speed: [40, 160], drag: 2.5, gy: -30, life: [0.6, 1], size: 9, size1: 32, color: '220,215,210', a0: 0.5 });
    const h = clamp(c.dist * 0.3, 60, 150);
    const T = clamp(c.dist * 1.1, 340, 520);
    let n = 0;
    await phase(T, (x, t) => {
      const p = arcPt(M, B, h, t);
      if (n++ % 2 === 0) emit({ kind: 'smoke', x: p.x, y: p.y, size: 4, size1: 13, life: 0.45, color: '210,205,200', a0: 0.35, drag: 1 });
      const s = 9 + Math.sin(t * Math.PI) * 4;
      x.fillStyle = 'rgba(0,0,0,.22)';
      x.beginPath(); x.ellipse(lerp(M.x, B.x, t), lerp(M.y, B.y, t) + 16, s, s * 0.35, 0, 0, TAU); x.fill();
      x.fillStyle = '#0b0b0b';
      x.beginPath(); x.arc(p.x, p.y, s, 0, TAU); x.fill();
      x.fillStyle = '#3a3a3a';
      x.beginPath(); x.arc(p.x - s * 0.15, p.y - s * 0.15, s * 0.75, 0, TAU); x.fill();
      x.fillStyle = 'rgba(255,255,255,.6)';
      x.beginPath(); x.arc(p.x - s * 0.38, p.y - s * 0.38, s * 0.22, 0, TAU); x.fill();
    });
    explosion(B, 1.1);
    spray(B, 12, { kind: 'chip', speed: [180, 420], angle: -Math.PI / 2, spread: 1.4, drag: 1, gy: 1100, life: [0.6, 0.9], size: [3, 6], color: '122,74,34' });
    hitReact(tEl, dir, 16, { rot: dir.x * 4, flashColor: '255,200,120' });
    c.impact();
    screenShake(9);
    await wait(170);
  },

  // 심해 함대: 물대포
  async deep(c) {
    const { A, B, dir, aEl, tEl } = c;
    move(aEl, [{ transform: 'none' }, { transform: 'translateY(-8px) scale(1.06)', offset: 0.4 }, { transform: 'none' }], 520);
    const S = { x: A.x + dir.x * 26, y: A.y + dir.y * 26 };
    // 파도 그림 대신 물줄기: 머리 쪽에 물방울과 거품을 몰아 뿌리며 대상까지 밀려간다.
    const T = clamp(c.dist * 1.1, 380, 540);
    await phase(T, (x, t) => {
      const p = lerpPt(S, B, t);
      const s = 10 + 16 * t;
      glowAt(p.x, p.y, s * 2.2, '90,180,230', 0.55, true);
      glowAt(p.x, p.y, s * 1.1, '232,251,255', 0.7, true);
      for (let i = 0; i < 3; i++) {
        emit({ kind: 'dot', x: p.x + c.perp.x * rnd(-s, s), y: p.y + c.perp.y * rnd(-s, s), vx: dir.x * rnd(60, 160) + rnd(-40, 40), vy: dir.y * rnd(60, 160) + rnd(-140, -20), gy: 700, drag: 1, life: [0.35, 0.6], size: [2, 4.5], color: pick(['127,211,255', '232,251,255', '90,180,230']) });
      }
      emit({ kind: 'smoke', x: p.x, y: p.y, vx: -dir.x * 40, vy: -dir.y * 40, drag: 2, life: 0.45, size: s * 0.6, size1: s * 1.6, color: '200,240,255', a0: 0.35 });
      if (Math.random() < 0.5) emit({ kind: 'bubble', x: p.x + rnd(-8, 8), y: p.y + rnd(-8, 8), vy: rnd(-50, -15), life: 0.6, size: [2, 5], color: '200,240,255' });
    }, EASE.in);
    flash(B, 70, '170,230,255', 0.2);
    shockwave(B, 80, '200,240,255', 0.45);
    spray(B, 46, { kind: 'dot', angle: -Math.PI / 2, spread: 1.35, speed: [160, 460], gy: 1000, drag: 0.5, life: [0.5, 0.9], size: [2.5, 5], color: ['127,211,255', '232,251,255', '90,180,230'] });
    spray(B, 10, { kind: 'smoke', speed: [30, 90], drag: 2, life: [0.6, 1], size: 12, size1: 34, color: '190,235,255', a0: 0.4 });
    hitReact(tEl, dir, 18, { flashColor: '150,220,255' });
    c.impact();
    await wait(160);
  },

  // 유령선단: 유령 분신 (카드 모양 유령을 캔버스에 그린다)
  async ghost(c) {
    const { A, B, dir, aEl, tEl } = c;
    const ar = pageRect(aEl);
    const art = aEl.querySelector('.emoji, .face')?.textContent?.trim() || '👻';
    move(aEl, [{ opacity: 1 }, { opacity: 0.3 }, { opacity: 0.9 }, { opacity: 0.4 }, { opacity: 1 }], 760, 'linear');
    const end = { x: dir.x * c.dist * 1.5, y: dir.y * c.dist * 1.5 };
    const w = ar.width;
    const h = ar.height;
    // 유령 카드는 한 번만 그려 두고 매 프레임 찍는다.
    const pad = 24;
    const spr = document.createElement('canvas');
    spr.width = Math.ceil((w + pad * 2) * 2);
    spr.height = Math.ceil((h + pad * 2) * 2);
    {
      const sg = spr.getContext('2d');
      const keep = g;
      g = sg;
      sg.scale(2, 2);
      sg.translate(pad + w / 2, pad + h / 2);
      glowAt(0, 0, Math.max(w, h) * 0.7, '170,130,255', 0.5, true);
      rrect(-w / 2, -h / 2, w, h, 12);
      const gr = sg.createLinearGradient(0, -h / 2, 0, h / 2);
      gr.addColorStop(0, 'rgba(220,200,255,.55)'); gr.addColorStop(1, 'rgba(120,255,200,.25)');
      sg.fillStyle = gr;
      sg.fill();
      sg.strokeStyle = 'rgba(240,230,255,.95)';
      sg.lineWidth = 2;
      sg.stroke();
      sg.globalAlpha = 0.8;
      const es = ((w * 0.5) / 72) * 96;
      sg.drawImage(emojiSprite(art), -es / 2, -h * 0.3 - es / 2, es, es);
      g = keep;
    }
    const ghostCard = (x, cx, cy, sc, a, wob) => {
      if (a <= 0) return;
      x.save();
      x.translate(cx, cy);
      x.rotate(wob);
      x.scale(sc, sc);
      x.globalAlpha = a;
      x.drawImage(spr, -w / 2 - pad, -h / 2 - pad, w + pad * 2, h + pad * 2);
      x.restore();
    };
    let hitDone = false;
    let n = 0;
    await phase(620, (x, t, raw) => {
      x.globalCompositeOperation = 'lighter';
      for (let i = 2; i >= 0; i--) {
        const tt = clamp(raw - i * 0.07, 0, 1);
        const e = EASE.in(tt);
        const a = tt <= 0 ? 0 : (0.85 - i * 0.25) * (tt < 0.12 ? tt / 0.12 : 1) * (1 - clamp((tt - 0.7) / 0.3, 0, 1));
        ghostCard(x, A.x + end.x * e, A.y + end.y * e, 1 + e * 0.3, a, Math.sin(tt * 9) * 0.05);
      }
      const e = EASE.in(raw);
      const P = { x: A.x + end.x * e, y: A.y + end.y * e };
      if (n++ % 2 === 0) emit({ kind: 'glow', x: P.x + rnd(-14, 14), y: P.y + rnd(-20, 20), vy: rnd(-60, -20), life: 0.5, size: [6, 10], size1: 1, color: pick(['180,140,255', '140,255,190']), add: true, a0: 0.8 });
      if (!hitDone && e * 1.5 >= 1) {
        hitDone = true;
        flash(B, 80, '190,150,255', 0.25);
        shockwave(B, 64, '200,170,255', 0.45);
        spray(B, 22, { kind: 'glow', speed: [40, 200], drag: 2, gy: -120, life: [0.5, 0.9], size: [5, 9], size1: 1, color: ['180,140,255', '140,255,190'], add: true });
        hitReact(tEl, dir, 8, { flashColor: '180,140,255' });
        c.impact();
        overlay(tEl, '60,30,110', 700, { a0: 0.45, add: false });
      }
    });
    await wait(100);
  },

  // 불꽃 요리단: 불칼 썰기
  async flame(c) {
    const { B, dir, aEl, tEl } = c;
    const reach = c.dist * 0.55;
    const P0 = `translate(${dir.x * reach}px,${dir.y * reach}px) rotate(${dir.x * 8}deg) scale(1.06)`;
    const P1 = `translate(${dir.x * reach * 1.05}px,${dir.y * reach * 1.05}px) rotate(${-dir.x * 10}deg) scale(1.06)`;
    await move(aEl, [{ transform: 'none' }, { transform: P0 }], 170, 'cubic-bezier(.5,0,.9,.5)');
    const r = 42;
    const fire = { core: '255,246,200', glow: '255,120,30', width: 8, ms: 340 };
    const embers = (from, to) => {
      for (let i = 0; i < 14; i++) {
        const p = lerpPt(from, to, Math.random());
        emit({ kind: 'glow', x: p.x, y: p.y, vx: rnd(-50, 50), vy: rnd(-180, -40), gy: 120, drag: 1.5, life: [0.4, 0.8], size: [3, 6], size1: 1, color: pick(['255,200,80', '255,120,30', '255,240,170']), add: true });
      }
    };
    const a1 = { x: B.x - r, y: B.y - r };
    const b1 = { x: B.x + r, y: B.y + r };
    slash(a1, b1, 14, fire);
    embers(a1, b1);
    hitReact(tEl, dir, 6, { flashColor: '255,170,80' });
    await wait(110);
    move(aEl, [{ transform: P0 }, { transform: P1 }], 100, 'ease-in');
    const a2 = { x: B.x + r, y: B.y - r };
    const b2 = { x: B.x - r, y: B.y + r };
    slash(a2, b2, -14, fire);
    embers(a2, b2);
    flash(B, 80, '255,160,60', 0.25);
    spray(B, 10, { kind: 'glow', speed: [60, 220], drag: 3, gy: -60, life: [0.3, 0.6], size: [10, 16], size1: 1, color: '255,140,40', add: true });
    hitReact(tEl, dir, 14, { flashColor: '255,140,50' });
    c.impact();
    overlay(tEl, '255,110,20', 800, { a0: 0.45 });
    await wait(150);
    move(aEl, [{ transform: P1 }, { transform: 'none' }], 280);
    await wait(120);
  },

  // 정글 원숭이 무리: 바나나 세례
  async monkey(c) {
    const { A, B, dir, aEl, tEl } = c;
    move(aEl, [0, 1, 2, 3].map((i) => ({ transform: i === 3 ? 'none' : `translate(${-dir.x * 4}px,${i % 2 ? -10 : 0}px) rotate(${i % 2 ? -dir.x * 12 : 0}deg)` })), 450);
    const throwOne = async (i) => {
      await wait(i * 100);
      const off = (i - 1) * 14;
      const T0 = { x: B.x + c.perp.x * off, y: B.y + c.perp.y * off };
      const h = clamp(c.dist * 0.24, 40, 110) - i * 10;
      const trail = [];
      const S = { x: A.x, y: A.y - 14 };
      await phase(clamp(c.dist * 1.0, 300, 420), (x, t) => {
        const p = arcPt(S, T0, h, t);
        const rot = t * TAU * 2.5;
        trail.push({ ...p, rot });
        if (trail.length > 5) trail.shift();
        trail.forEach((q, k) => drawBanana(q.x, q.y, 13, q.rot, ((k + 1) / trail.length) * 0.3));
        glowAt(p.x, p.y, 22, '255,230,90', 0.35, true);
        drawBanana(p.x, p.y, 15, rot);
      });
      const lastOne = i === 2;
      spray(T0, lastOne ? 10 : 6, { kind: 'star', speed: [100, 260], drag: 3, life: [0.3, 0.55], size: [5, 9], size1: 1, color: ['255,230,90', '255,255,255'], vr: 10 });
      flash(T0, lastOne ? 60 : 38, '255,240,150', 0.16);
      emit({ kind: 'banana', x: T0.x, y: T0.y, vx: rnd(-120, 120), vy: rnd(-280, -180), gy: 1100, life: 0.7, size: 13, vr: rnd(-12, 12) });
      hitReact(tEl, dir, lastOne ? 14 : 6, { rot: (i - 1) * 4, flashColor: lastOne ? '255,255,255' : '' });
      if (lastOne) c.impact();
      if (lastOne) { shockwave(T0, 50, '255,240,150', 0.3); pow(T0, 0.8, '255,236,120', '#7a4d00'); }
    };
    await Promise.all([0, 1, 2].map(throwOne));
    await wait(120);
  },

  // 태엽 기계단: 태엽 펀치
  async clock(c) {
    const { A, B, dir, perp, aEl, tEl } = c;
    const r = pageRect(aEl);
    const K = { x: A.x - dir.x * (r.width * 0.55), y: A.y - dir.y * (r.height * 0.3) - 6 };
    const coiled = `translate(${-dir.x * 12}px,${-dir.y * 12}px) scale(.88,1.1)`;
    move(aEl, [
      { transform: 'none' },
      { transform: `translate(${-dir.x * 4}px,${-dir.y * 4}px) scale(.96,1.03)`, offset: 0.33 },
      { transform: `translate(${-dir.x * 8}px,${-dir.y * 8}px) scale(.92,1.06)`, offset: 0.66 },
      { transform: coiled },
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
      glowAt(K.x, K.y, 26, '255,227,154', 0.4, true);
      drawEmoji('🔑', K.x, K.y, 28, rot - Math.PI / 4);
    });
    const reach = c.dist * 0.78;
    for (let i = 0; i < 6; i++) {
      const o = (i - 2.5) * 9;
      emit({ kind: 'spark', x: A.x + perp.x * o, y: A.y + perp.y * o, vx: -dir.x * 900, vy: -dir.y * 900, drag: 8, life: 0.22, size: 2, color: '255,255,255', a0: 0.7, stretch: 0.06 });
    }
    const hitPose = `translate(${dir.x * reach}px,${dir.y * reach}px) scale(1.14,.9)`;
    await move(aEl, [{ transform: coiled }, { transform: hitPose }], 110, 'cubic-bezier(.6,0,1,.6)');
    flash(B, 90, '255,250,230', 0.18);
    shockwave(B, 90, '255,236,160', 0.4);
    pow(B, 0.9, '255,240,190', '#6b5428');
    spray(B, 9, { kind: 'gear', speed: [160, 360], drag: 1, gy: 900, life: [0.6, 0.9], size: [7, 12], color: ['230,200,130', '200,175,120', '250,230,170'], vr: rnd(-12, 12) });
    spray(B, 20, { kind: 'spark', speed: [250, 600], drag: 2.5, gy: 500, life: [0.2, 0.4], size: 2, color: '255,236,160', add: true });
    hitReact(tEl, dir, 18, { rot: dir.x * 5 });
    c.impact();
    screenShake(7);
    await wait(90);
    move(aEl, [{ transform: hitPose }, { transform: 'none' }], 360, 'cubic-bezier(.3,1.4,.5,1)');
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
    ], 420);
    await wait(170);
    const S = { x: A.x + dir.x * 30, y: A.y + dir.y * 30 };
    const trail = [];
    const T = clamp(c.dist * 0.75, 230, 330);
    const blade = (x, p, s, a) => {
      glowAt(p.x, p.y, s * 1.5, '120,190,255', a * 0.5, true);
      x.save();
      x.translate(p.x, p.y);
      x.rotate(c.ang);
      x.globalAlpha = a;
      x.globalCompositeOperation = 'lighter';
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
    let n = 0;
    await phase(T, (x, t) => {
      const p = lerpPt(S, B, t);
      const s = 30 + 16 * t;
      trail.push(p);
      if (trail.length > 6) trail.shift();
      trail.forEach((q, k) => blade(x, q, s * 0.9, ((k + 1) / trail.length) * 0.3));
      blade(x, p, s, 1);
      if (n++ % 2 === 0) emit({ kind: 'spark', x: p.x + perp.x * rnd(-s, s), y: p.y + perp.y * rnd(-s, s), vx: dir.x * 300, vy: dir.y * 300, drag: 6, life: 0.2, size: 1.2, color: '220,240,255', add: true, stretch: 0.05 });
    }, EASE.in);
    const L = 72;
    slash({ x: B.x - perp.x * L - dir.x * 10, y: B.y - perp.y * L - dir.y * 10 }, { x: B.x + perp.x * L + dir.x * 10, y: B.y + perp.y * L + dir.y * 10 }, 6, { width: 4, ms: 380 });
    flash(B, 60, '220,240,255', 0.16);
    hitReact(tEl, dir, 10);
    c.impact();
    await wait(220);
  },

  // 항해사 길드: 돌풍
  async guild(c) {
    const { A, B, dir, perp, aEl, tEl } = c;
    move(aEl, [{ transform: 'none' }, { transform: `translate(${-dir.x * 6}px,${-dir.y * 6}px) scale(1.05)`, offset: 0.4 }, { transform: 'none' }], 480);
    const spread = clamp(c.dist / 4, 30, 80);
    const M = lerpPt(A, B, 0.5);
    const lanes = [-1, 0, 1].map((k) => ({ P: { x: A.x + dir.x * 20, y: A.y + dir.y * 20 }, C: { x: M.x + perp.x * spread * k * 1.3, y: M.y + perp.y * spread * k * 1.3 }, Q: { x: B.x + perp.x * k * 10, y: B.y + perp.y * k * 10 } }));
    const T = clamp(c.dist * 1.0, 340, 460);
    await phase(T + 140, (x, t, raw) => {
      x.globalCompositeOperation = 'lighter';
      lanes.forEach((l, k) => {
        const tt = clamp((raw * (T + 140) - k * 70) / T, 0, 1);
        if (tt <= 0) return;
        const head = EASE.inOut(tt);
        const tail = Math.max(0, head - 0.45);
        ribbon(l.P, l.C, l.Q, 9, '191,243,230', 0.28 * (1 - tail), tail, head);
        ribbon(l.P, l.C, l.Q, 2.4, '255,255,255', 0.85 * (1 - tail), tail, head);
        if (Math.random() < 0.15 && tt < 1) {
          const p = quadPt(l.P, l.C, l.Q, head);
          emit({ kind: 'leaf', x: p.x, y: p.y, vx: dir.x * 160 + rnd(-40, 40), vy: dir.y * 160 + rnd(-40, 40), drag: 2, life: 0.6, size: [4, 6], color: pick(['110,190,90', '160,210,100']), vr: rnd(-14, 14) });
        }
      });
    });
    hitReact(tEl, dir, 24, { rot: dir.x * 8, flashColor: '200,255,240' });
    c.impact();
    spray(B, 10, { kind: 'leaf', speed: [120, 300], drag: 2, life: [0.6, 0.9], size: [4, 7], color: ['110,190,90', '160,210,100', '200,220,120'] });
    phase(460, (x, t) => {
      x.globalCompositeOperation = 'lighter';
      x.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        const r = (48 - t * 22) * (1 + k * 0.18);
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
    const T = clamp(c.dist * 1.25, 420, 620);
    let prev = S;
    let n = 0;
    await phase(T, (x, t) => {
      const wob = Math.sin(t * Math.PI * 3) * 9 * (1 - t);
      const base = lerpPt(S, B, t);
      const p = { x: base.x + c.perp.x * wob, y: base.y + c.perp.y * wob };
      const ang = Math.atan2(p.y - prev.y, p.x - prev.x) || c.ang;
      prev = p;
      if (n++ % 2 === 0) {
        emit({ kind: 'bubble', x: p.x - Math.cos(ang) * 22 + rnd(-3, 3), y: p.y - Math.sin(ang) * 22 + rnd(-3, 3), vx: rnd(-20, 20), vy: rnd(-70, -20), drag: 1, life: [0.5, 0.8], size: [2, 4.5], color: '210,240,255' });
        emit({ kind: 'smoke', x: p.x - Math.cos(ang) * 24, y: p.y - Math.sin(ang) * 24, life: 0.4, size: 5, size1: 14, color: '200,235,255', a0: 0.35 });
      }
      x.translate(p.x, p.y);
      x.rotate(ang);
      x.fillStyle = 'rgba(0,0,0,.25)';
      x.beginPath(); x.ellipse(0, 9, 20, 4, 0, 0, TAU); x.fill();
      x.fillStyle = '#4d5a6a';
      x.beginPath(); x.moveTo(-16, 0); x.lineTo(-24, -8); x.lineTo(-20, 0); x.lineTo(-24, 8); x.closePath(); x.fill();
      const gr = x.createLinearGradient(0, -6, 0, 6);
      gr.addColorStop(0, '#eef3f8'); gr.addColorStop(0.5, '#9aa8b8'); gr.addColorStop(1, '#4d5a6a');
      x.fillStyle = gr;
      x.beginPath(); x.moveTo(-18, -5); x.lineTo(10, -5); x.quadraticCurveTo(20, -5, 20, 0); x.quadraticCurveTo(20, 5, 10, 5); x.lineTo(-18, 5); x.closePath(); x.fill();
      x.fillStyle = '#e2483b';
      x.beginPath(); x.moveTo(12, -4.6); x.quadraticCurveTo(20, -5, 20, 0); x.quadraticCurveTo(20, 5, 12, 4.6); x.closePath(); x.fill();
      x.fillStyle = '#ffd84d';
      x.fillRect(-6, -5, 3, 10);
      x.fillStyle = 'rgba(220,230,240,.7)';
      x.beginPath(); x.ellipse(-20, 0, 1.5, 6 * Math.abs(Math.sin(t * 60)), 0, 0, TAU); x.fill();
    }, EASE.in);
    flash(B, 90, '230,250,255', 0.2);
    shockwave(B, 90, '200,240,255', 0.45);
    explosion(B, 0.7);
    spray({ x: B.x, y: B.y + 10 }, 40, { kind: 'dot', angle: -Math.PI / 2, spread: 0.45, speed: [280, 720], gy: 1300, drag: 0.6, life: [0.5, 0.9], size: [2.5, 5.5], color: ['160,220,255', '230,250,255'] });
    spray({ x: B.x, y: B.y + 10 }, 12, { kind: 'bubble', speed: [60, 200], drag: 2, gy: -100, life: [0.5, 0.9], size: [3, 7], color: '220,245,255' });
    if (tEl) tEl.animate([{ transform: 'translateY(-18px) rotate(-3deg)' }, { transform: 'none' }], { duration: 480, easing: 'ease-out' });
    overlay(tEl, '230,250,255', 260, { a0: 0.7 });
    screenShake(8);
    await wait(170);
  },

  // 황금 상인조합: 금화 세례
  async merchant(c) {
    const { A, B, dir, aEl, tEl } = c;
    const N = 8;
    move(aEl, [{ transform: 'none' }, { transform: `rotate(${-dir.x * 5}deg) scale(1.05)`, offset: 0.2 }, { transform: `rotate(${dir.x * 4}deg) scale(1.05)`, offset: 0.7 }, { transform: 'none' }], 640);
    const one = async (i) => {
      await wait(i * 38);
      const T0 = { x: B.x + rnd(-14, 14), y: B.y + rnd(-18, 18) };
      const h = rnd(40, 100);
      const spin = rnd(14, 22);
      const S = { x: A.x + dir.x * 16, y: A.y - 10 };
      await phase(clamp(c.dist * 0.9, 280, 380), (x, t) => {
        const p = arcPt(S, T0, h, t);
        glowAt(p.x, p.y, 18, '255,220,100', 0.45, true);
        drawCoin(p.x, p.y, 10, t * spin);
      });
      const lastOne = i === N - 1;
      emit({ kind: 'star', x: T0.x, y: T0.y, life: 0.32, size: lastOne ? 28 : 15, size1: 2, color: '255,245,190', add: true, vr: 6, rot: 0 });
      spray(T0, lastOne ? 10 : 3, { kind: 'spark', speed: [120, 300], drag: 3, life: 0.25, size: 1.6, color: '255,230,120', add: true });
      emit({ kind: 'coin', x: T0.x, y: T0.y, vx: rnd(-140, 140), vy: rnd(-260, -120), gy: 1100, life: 0.8, size: 10, vr: rnd(4, 8) });
      hitReact(tEl, dir, lastOne ? 14 : 4, { flashColor: lastOne ? '255,230,140' : '' });
      if (lastOne) c.impact();
      if (lastOne) { flash(B, 80, '255,225,120', 0.22); shockwave(B, 64, '255,230,140', 0.35); }
    };
    await Promise.all(Array.from({ length: N }, (_, i) => one(i)));
    await wait(130);
  },

  // 아이스 에이지: 얼음 숨결 — 아래부터 얼어붙는 수정 덩어리, 금이 가며 조각조각 깨진다
  async frost(c) {
    const { A, B, dir, aEl, tEl } = c;
    move(aEl, [{ transform: 'none' }, { transform: 'scale(1.08,.95)', offset: 0.3 }, { transform: `translate(${dir.x * 6}px,${dir.y * 6}px) scale(.96,1.04)`, offset: 0.6 }, { transform: 'none' }], 560);
    await wait(80);
    const M = { x: A.x + dir.x * 28, y: A.y + dir.y * 28 };
    const D = Math.max(60, c.dist - 28);
    await phase(260, () => {
      for (let i = 0; i < 4; i++) {
        const a = c.ang + rnd(-0.2, 0.2);
        const sp = (D / 0.26) * rnd(0.75, 1.05);
        emit({ kind: 'glow', x: M.x, y: M.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 1.2, life: [0.35, 0.45], size: 5, size1: 18, color: pick(['230,248,255', '150,215,255', '200,235,255']), add: true, a0: 0.7 });
      }
      emit({ kind: 'smoke', x: M.x, y: M.y, vx: Math.cos(c.ang) * D * 2.2, vy: Math.sin(c.ang) * D * 2.2, drag: 2, life: 0.55, size: 8, size1: 30, color: '210,240,255', a0: 0.35 });
      if (Math.random() < 0.5) emit({ kind: 'star', x: M.x, y: M.y, vx: Math.cos(c.ang + rnd(-0.25, 0.25)) * D * 2.4, vy: Math.sin(c.ang + rnd(-0.25, 0.25)) * D * 2.4, drag: 2, life: 0.5, size: 4, size1: 1, color: '255,255,255', vr: 6 });
    });
    // 얼음: 처음에는 금 없이 매끈한 덩어리가 서리 결을 따라 아래부터 차오르고,
    // 다 얼면 맞은 쪽에서 금이 퍼져 나가다가 그 금을 따라 조각나 깨진다.
    const r = tEl ? pageRect(tEl) : { left: B.x - 40, top: B.y - 55, width: 80, height: 110, bottom: B.y + 55 };
    const rx = r.width / 2 + 10;
    const ry = r.height / 2 + 10;
    const NV = 22;
    const verts = Array.from({ length: NV }, (_, i) => {
      const an = (i / NV) * TAU;
      const k = 1 / Math.max(Math.abs(Math.cos(an)), Math.abs(Math.sin(an))) ** 0.75; // 둥근 사각형
      const j = rnd(0.96, 1.05);
      return { x: B.x + Math.cos(an) * rx * k * j * 0.93, y: B.y + Math.sin(an) * ry * k * j * 0.93 };
    });
    const outline = (x) => {
      x.beginPath();
      // 꼭짓점 사이를 곡선으로 이어 모서리를 부드럽게
      for (let i = 0; i <= NV; i++) {
        const p = verts[i % NV];
        const q = verts[(i + 1) % NV];
        const m = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
        if (i === 0) x.moveTo(m.x, m.y);
        else x.quadraticCurveTo(p.x, p.y, m.x, m.y);
      }
      x.closePath();
    };
    // 서리 결: 아래와 가장자리에 몰린 고사리 모양 가지
    const ferns = Array.from({ length: 14 }, () => {
      const v = verts[Math.floor(rnd(0, NV))];
      const an = Math.atan2(B.y - v.y, B.x - v.x) + rnd(-0.5, 0.5);
      const len = rnd(10, 26);
      return { x: v.x, y: v.y, an, len, side: Array.from({ length: 4 }, (_, k) => ({ t: (k + 1) / 5, l: rnd(3, 7) })) };
    });
    const specks = Array.from({ length: 36 }, () => ({ x: B.x + rnd(-rx, rx) * 0.9, y: B.y + rnd(-ry, ry) * 0.9, s: rnd(0.6, 1.8), a: rnd(0.3, 0.8) }));
    // 금은 공격이 들어온 쪽 가장자리에서 시작한다
    const O = { x: B.x - dir.x * rx * 0.55, y: B.y - dir.y * ry * 0.55 };
    const cracks = Array.from({ length: 7 }, (_, i) => {
      const an0 = c.ang + ((i - 3) / 3) * 1.3 + rnd(-0.15, 0.15);
      let p = { ...O };
      const seg = [p];
      for (let k = 0; k < 5; k++) {
        const an = an0 + rnd(-0.45, 0.45);
        p = { x: p.x + Math.cos(an) * rx * 0.32, y: p.y + Math.sin(an) * ry * 0.3 };
        seg.push(p);
      }
      const branch = seg.length > 2 ? { from: seg[2], an: an0 + (Math.random() < 0.5 ? 0.8 : -0.8), len: rx * 0.35 } : null;
      return { seg, branch };
    });
    hitReact(tEl, dir, 4, { flashColor: '210,240,255' });
    spray({ x: B.x, y: r.bottom }, 10, { kind: 'smoke', angle: -Math.PI / 2, spread: 1.4, speed: [20, 60], life: [0.6, 0.9], size: 10, size1: 30, color: '220,245,255', a0: 0.4 });
    const GROW = 230;
    const HOLD = 90;
    const CRACK = 150;
    await phase(GROW + HOLD + CRACK, (x, _, raw) => {
      const t = raw * (GROW + HOLD + CRACK);
      const grow = clamp(t / GROW, 0, 1);
      const eg = EASE.out3(grow);
      const level = r.bottom + 14 - (r.height + 40) * eg; // 얼음 높이
      glowAt(B.x, B.y, Math.max(rx, ry) * 1.3, '150,215,255', 0.3 * eg, true);
      x.save();
      outline(x);
      x.clip();
      // 차오르는 경계는 살짝 물결치게
      x.beginPath();
      x.moveTo(B.x - rx * 2, r.bottom + 40);
      for (let i = 0; i <= 12; i++) {
        const px = B.x - rx * 1.2 + (rx * 2.4 * i) / 12;
        x.lineTo(px, level + Math.sin(i * 1.7 + t / 60) * 4 * (1 - eg));
      }
      x.lineTo(B.x + rx * 2, r.bottom + 40);
      x.closePath();
      x.clip();
      const gr = x.createLinearGradient(B.x - rx, r.top, B.x + rx, r.bottom);
      gr.addColorStop(0, 'rgba(235,250,255,.72)');
      gr.addColorStop(0.45, 'rgba(160,215,245,.5)');
      gr.addColorStop(1, 'rgba(110,180,230,.62)');
      x.fillStyle = gr;
      x.fillRect(B.x - rx * 1.5, r.top - 30, rx * 3, r.height + 80);
      // 안쪽 빛 번짐과 반사
      glowAt(B.x - rx * 0.35, B.y - ry * 0.45, rx * 0.9, '255,255,255', 0.35, true);
      x.strokeStyle = 'rgba(255,255,255,.55)';
      x.lineWidth = 6;
      x.lineCap = 'round';
      x.beginPath(); x.moveTo(B.x - rx * 0.75, B.y - ry * 0.1); x.quadraticCurveTo(B.x - rx * 0.7, B.y - ry * 0.7, B.x - rx * 0.2, B.y - ry * 0.82); x.stroke();
      x.strokeStyle = 'rgba(255,255,255,.3)';
      x.lineWidth = 3;
      x.beginPath(); x.moveTo(B.x + rx * 0.6, B.y + ry * 0.3); x.lineTo(B.x + rx * 0.7, B.y + ry * 0.65); x.stroke();
      // 서리 결
      x.strokeStyle = 'rgba(255,255,255,.75)';
      x.lineWidth = 1.2;
      for (const f of ferns) {
        const L = f.len * eg;
        const ex = f.x + Math.cos(f.an) * L;
        const ey = f.y + Math.sin(f.an) * L;
        x.beginPath(); x.moveTo(f.x, f.y); x.lineTo(ex, ey);
        for (const sd of f.side) {
          const px = f.x + Math.cos(f.an) * L * sd.t;
          const py = f.y + Math.sin(f.an) * L * sd.t;
          for (const sg of [-1, 1]) {
            x.moveTo(px, py);
            x.lineTo(px + Math.cos(f.an + sg * 0.8) * sd.l * eg, py + Math.sin(f.an + sg * 0.8) * sd.l * eg);
          }
        }
        x.stroke();
      }
      for (const sp of specks) {
        x.fillStyle = `rgba(255,255,255,${sp.a})`;
        x.beginPath(); x.arc(sp.x, sp.y, sp.s, 0, TAU); x.fill();
      }
      // 금: 다 얼고 나서 맞은 쪽에서 퍼져 나간다
      if (t > GROW + HOLD) {
        const k = EASE.out((t - GROW - HOLD) / CRACK);
        for (const { seg, branch } of cracks) {
          const total = seg.length - 1;
          const upto = k * total;
          for (const [lw, col] of [[3, 'rgba(120,190,240,.6)'], [1.3, 'rgba(255,255,255,.95)']]) {
            x.lineWidth = lw;
            x.strokeStyle = col;
            x.beginPath();
            x.moveTo(seg[0].x, seg[0].y);
            for (let i = 1; i <= total; i++) {
              if (i <= upto) x.lineTo(seg[i].x, seg[i].y);
              else { const f = upto - (i - 1); if (f > 0) x.lineTo(lerp(seg[i - 1].x, seg[i].x, f), lerp(seg[i - 1].y, seg[i].y, f)); break; }
            }
            if (branch && k > 0.5) {
              const bl = branch.len * (k - 0.5) * 2;
              x.moveTo(branch.from.x, branch.from.y);
              x.lineTo(branch.from.x + Math.cos(branch.an) * bl, branch.from.y + Math.sin(branch.an) * bl);
            }
            x.stroke();
          }
        }
      }
      x.restore();
      // 테두리: 다 언 부분만
      x.save();
      x.beginPath();
      x.rect(B.x - rx * 2, level - 6, rx * 4, r.height + 80);
      x.clip();
      outline(x);
      x.globalCompositeOperation = 'lighter';
      x.strokeStyle = 'rgba(120,200,255,.45)';
      x.lineWidth = 6;
      x.stroke();
      x.globalCompositeOperation = 'source-over';
      x.strokeStyle = 'rgba(255,255,255,.9)';
      x.lineWidth = 1.8;
      x.stroke();
      x.restore();
      if (grow >= 1 && t < GROW + HOLD && Math.random() < 0.2) emit({ kind: 'star', x: B.x + rnd(-rx, rx) * 0.8, y: B.y + rnd(-ry, ry) * 0.8, life: 0.35, size: rnd(4, 7), size1: 0.5, color: '255,255,255', add: true, rot: 0 });
    });
    // 산산조각: 금이 시작된 점에서 부채꼴 조각으로 나뉘어 튄다
    flash(O, 110, '220,245,255', 0.22);
    shockwave(B, 90, '220,245,255', 0.4);
    const facets = verts.map((v, i) => {
      const w = verts[(i + 1) % NV];
      return { pts: [{ x: B.x + rnd(-6, 6), y: B.y + rnd(-6, 6) }, v, w], lit: clamp(0.5 - ((v.x - B.x) / rx) * 0.25 - ((v.y - B.y) / ry) * 0.3, 0, 1) };
    });
    const pieces = facets.map((f) => {
      const gx = (f.pts[0].x + f.pts[1].x + f.pts[2].x) / 3;
      const gy = (f.pts[0].y + f.pts[1].y + f.pts[2].y) / 3;
      const an = Math.atan2(gy - B.y, gx - B.x);
      const sp = rnd(150, 340);
      return { f, gx, gy, vx: Math.cos(an) * sp + dir.x * 90, vy: Math.sin(an) * sp - 150, rot: 0, vr: rnd(-9, 9), rel: f.pts.map((p) => ({ x: p.x - gx, y: p.y - gy })) };
    });
    phase(700, (x, t, raw, dt) => {
      for (const p of pieces) {
        p.vy += 1300 * dt;
        p.gx += p.vx * dt;
        p.gy += p.vy * dt;
        p.rot += p.vr * dt;
        const cs = Math.cos(p.rot);
        const sn = Math.sin(p.rot);
        const sc = 1 - raw * 0.4;
        x.beginPath();
        p.rel.forEach((q, i) => {
          const px = p.gx + (q.x * cs - q.y * sn) * sc;
          const py = p.gy + (q.x * sn + q.y * cs) * sc;
          if (i) x.lineTo(px, py); else x.moveTo(px, py);
        });
        x.closePath();
        const L = 205 + p.f.lit * 50;
        x.fillStyle = `rgba(${Math.round(L * 0.82)},${Math.round(L * 0.95)},255,${(0.5 + p.f.lit * 0.3) * (1 - raw)})`;
        x.fill();
        x.strokeStyle = `rgba(255,255,255,${0.8 * (1 - raw)})`;
        x.lineWidth = 1;
        x.stroke();
      }
    });
    spray(B, 16, { kind: 'shard', radius: 20, speed: [180, 420], drag: 1, gy: 900, life: [0.5, 0.8], size: [3, 7], color: ['200,236,255', '235,250,255'] });
    spray(B, 12, { kind: 'star', speed: [60, 220], drag: 2.5, life: [0.4, 0.7], size: [3, 7], size1: 1, color: '255,255,255', vr: 6 });
    spray(B, 8, { kind: 'smoke', speed: [40, 120], drag: 2, life: [0.6, 0.9], size: 12, size1: 34, color: '225,245,255', a0: 0.45 });
    hitReact(tEl, dir, 12, { flashColor: '220,245,255' });
    c.impact();
    overlay(tEl, '120,200,255', 700, { a0: 0.4 });
    screenShake(5);
    await wait(160);
  },

  // 한국과수협회: 과일 비
  async fruit(c) {
    const { A, B, aEl, tEl } = c;
    move(aEl, [0, 1, 2, 3, 4, 5, 6].map((i) => ({ transform: i === 6 ? 'none' : `rotate(${i % 2 ? 7 : -7}deg) translateY(${i % 2 ? -2 : 0}px)` })), 380, 'ease-in-out');
    const ar = pageRect(aEl);
    for (let i = 0; i < 7; i++) emit({ kind: 'leaf', x: A.x + rnd(-ar.width / 2, ar.width / 2), y: ar.top - 6, vx: rnd(-50, 50), vy: rnd(-80, -20), gy: 160, drag: 1.5, life: [0.8, 1.1], size: [4, 7], color: pick(['90,170,60', '130,200,80', '70,140,40']), vr: rnd(-8, 8) });
    await wait(160);
    const fruits = [['🍎', '229,72,59'], ['🍐', '220,230,120'], ['🍊', '255,160,40'], ['🍑', '255,170,150'], ['🍇', '150,80,190']];
    const tr = tEl ? pageRect(tEl) : { top: B.y - 50 };
    const top = tr.top - 170;
    await Promise.all(fruits.map(async ([f, col], i) => {
      await wait(i * 55);
      const x0 = B.x + rnd(-30, 30);
      const yEnd = B.y - 6 + rnd(-10, 10);
      const rot0 = rnd(-1, 1);
      await phase(250, (x, t) => {
        x.fillStyle = `rgba(0,0,0,${0.2 * t})`;
        x.beginPath(); x.ellipse(x0, B.y + 30, 12 * t, 4 * t, 0, 0, TAU); x.fill();
        drawEmoji(f, x0, lerp(top, yEnd, t), 32, rot0 * (1 - t));
      }, EASE.in);
      const P = { x: x0, y: yEnd };
      spray(P, 12, { kind: 'dot', angle: -Math.PI / 2, spread: 1.5, speed: [100, 300], gy: 900, drag: 0.8, life: [0.35, 0.6], size: [2, 4.5], color: col });
      flash(P, 30, col, 0.2);
      emit({ kind: 'emoji', text: f, x: x0, y: yEnd, vx: rnd(-160, 160), vy: rnd(-300, -200), gy: 1200, life: 0.6, size: 30, size1: 24, vr: rnd(-10, 10) });
      const lastOne = i === fruits.length - 1;
      hitReact(tEl, { x: 0, y: 1 }, lastOne ? 12 : 5, { flashColor: lastOne ? '255,240,200' : '' });
      if (lastOne) c.impact();
      if (lastOne) { shockwave(B, 60, '255,230,170', 0.35); flash(B, 70, '255,220,180', 0.18); }
    }));
    await wait(130);
  },

  // 에버랜드의 아이들: 돌진 (카드는 WAAPI로 한 번에 움직이고, 먼지는 같은 시간표로 계산해 뿌린다)
  async zoo(c) {
    const { A, B, dir, perp, aEl, tEl } = c;
    const ar = pageRect(aEl);
    const crouch = `translate(${-dir.x * 14}px,${-dir.y * 14}px) scale(1.04,.92)`;
    move(aEl, [{ transform: 'none' }, { transform: crouch }], 200);
    for (let i = 0; i < 2; i++) setTimeout(() => spray({ x: A.x - dir.x * 10, y: ar.bottom - 4 }, 5, { kind: 'smoke', angle: Math.atan2(-dir.y, -dir.x), spread: 0.8, speed: [60, 160], drag: 3, life: [0.4, 0.7], size: 7, size1: 20, color: '205,170,120', a0: 0.6 }), i * 100 * TIME);
    await wait(210);
    const reach = c.dist * 0.74;
    const CH = 240;
    const end = `translate(${dir.x * reach}px,${dir.y * reach}px) scale(1.06)`;
    const mid = lerp(-14, reach, 0.25);
    move(aEl, [
      { transform: crouch },
      { transform: `translate(${mid * dir.x}px,${mid * dir.y - 6}px) scale(1.06)`, offset: 0.5 },
      { transform: end },
    ], CH, 'ease-in');
    let n = 0;
    await phase(CH, (x, t) => {
      const d = lerp(-14, reach, t);
      const P = { x: A.x + dir.x * d, y: A.y + dir.y * d };
      if (n++ % 2 === 0) emit({ kind: 'smoke', x: P.x - dir.x * 26 + rnd(-10, 10), y: P.y + ar.height * 0.4, vx: -dir.x * 80, vy: rnd(-50, -10), drag: 2.5, life: [0.5, 0.8], size: 9, size1: 26, color: '205,170,120', a0: 0.6 });
      const o = rnd(-30, 30);
      emit({ kind: 'spark', x: P.x + perp.x * o, y: P.y + perp.y * o, vx: -dir.x * 700, vy: -dir.y * 700, drag: 8, life: 0.18, size: 1.6, color: '255,255,255', a0: 0.6, stretch: 0.07 });
    }, EASE.in);
    flash(B, 110, '255,240,210', 0.2);
    shockwave(B, 110, '255,235,200', 0.45);
    shockwave(B, 64, '255,255,255', 0.3, { delay: 0.05 });
    pow(B, 1.1, '255,236,190', '#8a5a32');
    spray(B, 12, { kind: 'smoke', speed: [80, 240], drag: 2.5, life: [0.6, 1], size: 12, size1: 38, color: '205,170,120', a0: 0.6 });
    spray(B, 10, { kind: 'chip', speed: [200, 420], angle: -Math.PI / 2, spread: 1.5, gy: 1100, life: [0.6, 0.9], size: [3, 5], color: '120,90,60' });
    hitReact(tEl, dir, 28, { rot: dir.x * 10 });
    c.impact();
    screenShake(12);
    await move(aEl, [{ transform: end }, { transform: `translate(${dir.x * reach * 0.85}px,${dir.y * reach * 0.85 - 12}px) scale(1.02)`, offset: 0.3 }, { transform: 'none' }], 380);
  },

  // 버섯 포자 군집: 포자 구름
  async mush(c) {
    const { A, B, dir, perp, aEl, tEl } = c;
    move(aEl, [{ transform: 'none' }, { transform: 'scale(1.1,.88)', offset: 0.3 }, { transform: 'scale(.96,1.05)', offset: 0.6 }, { transform: 'none' }], 520);
    const ar = pageRect(aEl);
    const S = { x: A.x, y: ar.top + ar.height * 0.25 };
    const spores = Array.from({ length: 40 }, (_, i) => ({
      d: (i / 40) * 0.35, end: { x: B.x + rnd(-34, 34), y: B.y + rnd(-40, 40) }, amp: rnd(14, 34) * (Math.random() < 0.5 ? -1 : 1), fq: rnd(1.5, 3),
      s: rnd(5, 10), col: pick(['220,230,130', '235,215,160', '180,230,120', '250,240,190']), orbit: rnd(0, TAU),
    }));
    let hit = false;
    await phase(1000, (x, t, raw) => {
      x.globalCompositeOperation = 'lighter';
      const a = raw > 0.8 ? (1 - raw) / 0.2 : 1;
      for (const sp of spores) {
        if (raw < sp.d) continue;
        const tt = clamp((raw - sp.d) / 0.5, 0, 1);
        const e = EASE.inOut(tt);
        let p = lerpPt(S, sp.end, e);
        const w = Math.sin(e * Math.PI * sp.fq) * sp.amp * Math.sin(e * Math.PI);
        p = { x: p.x + perp.x * w, y: p.y + perp.y * w - Math.sin(e * Math.PI) * 30 };
        if (tt >= 1) {
          const k = (raw - sp.d - 0.5) * 6 + sp.orbit;
          p = { x: sp.end.x + Math.cos(k) * 6, y: sp.end.y + Math.sin(k) * 4 };
        }
        glowAt(p.x, p.y, sp.s, sp.col, 0.9 * a);
      }
      if (!hit && raw > 0.58) {
        hit = true;
        spray(B, 14, { kind: 'smoke', radius: 30, speed: [10, 50], drag: 1, life: [0.7, 1], size: 14, size1: 42, color: ['150,130,80', '120,140,70'], a0: 0.5, fadeIn: 0.25 });
        shockwave(B, 54, '220,230,140', 0.4);
        hitReact(tEl, dir, 6, { flashColor: '220,230,140' });
        c.impact();
        overlay(tEl, '110,90,30', 900, { a0: 0.45, add: false });
      }
    });
    await wait(40);
  },

  // 조사병단: 와이어 기동 (카드는 WAAPI, 와이어 끝점은 같은 시간표로 계산)
  async scout(c) {
    const { A, B, dir, perp, aEl, tEl } = c;
    const P1 = { x: B.x + perp.x * 58 + dir.x * 44, y: B.y + perp.y * 58 + dir.y * 44 };
    const P2 = { x: B.x - perp.x * 58 + dir.x * 44, y: B.y - perp.y * 58 + dir.y * 44 };
    let cur = { ...A };
    let wireOut = 0;
    let wireAlpha = 1;
    phase(1150, (x) => {
      if (wireAlpha <= 0) return;
      x.strokeStyle = `rgba(225,232,240,${wireAlpha})`;
      x.lineWidth = 1.6;
      for (const P of [P1, P2]) {
        const e = lerpPt(cur, P, wireOut);
        x.beginPath(); x.moveTo(cur.x, cur.y); x.lineTo(e.x, e.y); x.stroke();
        if (wireOut >= 1) {
          x.fillStyle = `rgba(170,180,190,${wireAlpha})`;
          x.beginPath(); x.arc(P.x, P.y, 3, 0, TAU); x.fill();
        }
      }
    }, EASE.linear, 0);
    await phase(150, (x, t) => { wireOut = t; }, EASE.out);
    for (const P of [P1, P2]) spray(P, 6, { kind: 'spark', speed: [80, 220], drag: 4, life: 0.2, size: 1.5, color: '255,240,200', add: true });
    const reach = c.dist * 0.9;
    const spin = dir.x < 0 ? -360 : 360;
    const ZIP = 250;
    move(aEl, [{ transform: 'none' }, { transform: `translate(${dir.x * reach}px,${dir.y * reach}px) rotate(${spin}deg) scale(.95)` }], ZIP, 'cubic-bezier(.5,0,.9,.6)');
    let n = 0;
    await phase(ZIP, (x, t) => {
      cur = { x: A.x + dir.x * reach * t, y: A.y + dir.y * reach * t };
      if (n++ % 2 === 0) emit({ kind: 'smoke', x: cur.x - dir.x * 20, y: cur.y - dir.y * 20, vx: -dir.x * 120 + rnd(-30, 30), vy: -dir.y * 120 + rnd(-30, 30), drag: 3, life: [0.4, 0.6], size: 6, size1: 20, color: '245,245,245', a0: 0.65 });
    }, EASE.in);
    const L = 52;
    const style = { glow: '190,255,200', width: 6, ms: 300 };
    slash({ x: B.x - perp.x * L - dir.x * 16, y: B.y - perp.y * L - dir.y * 16 }, { x: B.x + perp.x * L + dir.x * 16, y: B.y + perp.y * L + dir.y * 16 }, 12, style);
    hitReact(tEl, dir, 8, { flashColor: '' });
    await wait(70);
    slash({ x: B.x + perp.x * L - dir.x * 22, y: B.y + perp.y * L - dir.y * 22 }, { x: B.x - perp.x * L + dir.x * 22, y: B.y - perp.y * L + dir.y * 22 }, -12, style);
    flash(B, 64, '230,255,235', 0.16);
    hitReact(tEl, dir, 14);
    c.impact();
    await wait(80);
    const BACK = 300;
    move(aEl, [{ transform: `translate(${dir.x * reach}px,${dir.y * reach}px)` }, { transform: `translate(${dir.x * reach * 0.5}px,${dir.y * reach * 0.5 - 30}px)`, offset: 0.5 }, { transform: 'none' }], BACK, 'ease-in-out');
    await phase(BACK, (x, t) => {
      const d = reach * (1 - t);
      cur = { x: A.x + dir.x * d, y: A.y + dir.y * d - Math.sin(t * Math.PI) * 30 };
      wireAlpha = 1 - t;
    }, EASE.inOut);
    wireAlpha = 0;
  },

  // 국가 연금술사: 연성진
  async alchemy(c) {
    const { A, B, aEl, tEl } = c;
    const ar = pageRect(aEl);
    const clap = { x: A.x, y: ar.top - 4 };
    move(aEl, [{ transform: 'none' }, { transform: 'scale(1.12)', offset: 0.3 }, { transform: 'none' }], 300);
    flash(clap, 46, '140,200,255', 0.2);
    spray(clap, 14, { kind: 'spark', speed: [120, 320], drag: 4, life: [0.15, 0.3], size: 1.6, color: '160,215,255', add: true });
    await wait(160);
    const tr = tEl ? pageRect(tEl) : { bottom: B.y + 50, width: 80 };
    const C = { x: B.x, y: tr.bottom - 4 };
    const R = Math.max(46, tr.width * 0.78);
    let pillar = false;
    const bolts = [];
    await phase(820, (x, t) => {
      const fade = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
      x.globalCompositeOperation = 'lighter';
      glowAt(C.x, C.y, R * 1.3, '80,160,255', 0.35 * fade, true);
      x.save();
      x.translate(C.x, C.y);
      x.scale(1, 0.36);
      x.lineCap = 'round';
      const prog = (a, b) => clamp((t - a) / (b - a), 0, 1);
      const spin = t * 1.2;
      const ring = (rad, w, from, to, rev) => {
        const p = prog(from, to);
        if (p <= 0) return;
        for (const [lw, col] of [[w * 3.5, `rgba(80,160,255,${0.25 * fade})`], [w, `rgba(200,230,255,${0.95 * fade})`]]) {
          x.lineWidth = lw;
          x.strokeStyle = col;
          x.beginPath();
          if (rev) x.arc(0, 0, rad, -spin, -spin - TAU * p, true);
          else x.arc(0, 0, rad, spin, spin + TAU * p);
          x.stroke();
        }
      };
      ring(R, 3, 0, 0.28);
      ring(R * 0.8, 2, 0.06, 0.3, true);
      ring(R * 0.32, 2, 0.12, 0.34);
      const hp = prog(0.18, 0.42);
      if (hp > 0) {
        for (const [lw, col] of [[7, `rgba(80,160,255,${0.25 * fade})`], [2, `rgba(200,230,255,${0.95 * fade})`]]) {
          x.lineWidth = lw;
          x.strokeStyle = col;
          for (const off of [0, Math.PI / 3]) {
            x.beginPath();
            for (let i = 0; i <= 3; i++) {
              const an = off + spin * 0.6 + (i * TAU) / 3;
              if (i === 0) x.moveTo(Math.cos(an) * R * 0.8, Math.sin(an) * R * 0.8);
              else if (i / 3 <= hp) x.lineTo(Math.cos(an) * R * 0.8, Math.sin(an) * R * 0.8);
            }
            x.stroke();
          }
        }
      }
      const rp = prog(0.15, 0.45);
      x.lineWidth = 1.5;
      x.strokeStyle = `rgba(200,230,255,${0.9 * fade})`;
      for (let i = 0; i < 24 * rp; i++) {
        const an = spin + (i * TAU) / 24;
        x.beginPath();
        x.moveTo(Math.cos(an) * R * 0.84, Math.sin(an) * R * 0.84);
        x.lineTo(Math.cos(an) * R * (i % 3 ? 0.92 : 0.97), Math.sin(an) * R * (i % 3 ? 0.92 : 0.97));
        x.stroke();
      }
      x.restore();
      // 번개
      if (t > 0.3 && t < 0.75 && Math.random() < 0.45) {
        const an = rnd(0, TAU);
        bolts.push({ x0: C.x + Math.cos(an) * R, y0: C.y + Math.sin(an) * R * 0.36, life: 4, pts: Array.from({ length: 5 }, (_, i) => ({ dx: rnd(-10, 10), dy: -i * rnd(8, 14) })) });
      }
      for (let i = bolts.length - 1; i >= 0; i--) {
        const b = bolts[i];
        for (const [lw, col] of [[5, `rgba(80,160,255,${(0.3 * b.life) / 4})`], [1.6, `rgba(220,240,255,${b.life / 4})`]]) {
          x.lineWidth = lw;
          x.strokeStyle = col;
          x.beginPath();
          b.pts.forEach((p, k) => (k ? x.lineTo(b.x0 + p.dx, b.y0 + p.dy) : x.moveTo(b.x0, b.y0)));
          x.stroke();
        }
        if (--b.life <= 0) bolts.splice(i, 1);
      }
      if (!pillar && t > 0.42) {
        pillar = true;
        tEl?.animate([{ transform: 'none' }, { transform: 'translateY(-16px)', offset: 0.3 }, { transform: 'none' }], { duration: 480, easing: 'ease-out' });
        overlay(tEl, '200,230,255', 300, { a0: 0.8 });
        c.impact();
        flash(C, 80, '200,230,255', 0.25);
        shockwave(C, R * 1.3, '170,215,255', 0.45, { flat: true });
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
        spray(C, 24, { kind: 'glow', angle: -Math.PI / 2, spread: 0.3, radius: R * 0.4, speed: [120, 380], drag: 1.5, life: [0.5, 0.9], size: [3, 6], size1: 1, color: ['200,230,255', '255,240,200'], add: true });
        spray(B, 10, { kind: 'chip', speed: [120, 300], angle: -Math.PI / 2, spread: 1, gy: 900, life: 0.7, size: [3, 5], color: '160,150,140' });
      }
    });
    await wait(20);
  },
};

export function hasAttackFx(factionId) {
  return Object.hasOwn(FX, factionId);
}

// 배율 1에서 잰, 공격 시작부터 맞는 순간까지의 시간(ms). 맞는 순간이 350ms쯤 오도록 배율을 정한다.
// (연타할 때 답답하지 않게. 너무 빨라 보이지 않도록 배율은 0.55~1.1 사이로 묶는다.)
const IMPACT = { rubber: 415, red: 532, deep: 383, ghost: 515, flame: 294, monkey: 505, clock: 649, swords: 416, guild: 483, surgeon: 513, merchant: 552, frost: 833, fruit: 650, zoo: 466, mush: 600, scout: 503, alchemy: 512 };
const timeScale = (id) => clamp(350 / (IMPACT[id] || 350), 0.55, 1.1);

function setup(from, to, aEl, tEl, sh) {
  ensure();
  shakeEl = sh === undefined ? document.getElementById('game') : sh;
  const s = scroll();
  const A = { x: from.x + s.x, y: from.y + s.y };
  const B = { x: to.x + s.x, y: to.y + s.y };
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const dist = Math.hypot(dx, dy) || 1;
  const dir = { x: dx / dist, y: dy / dist };
  return { A, B, dir, perp: { x: -dir.y, y: dir.x }, dist, ang: Math.atan2(dy, dx), aEl, tEl };
}
// 연출을 재생한다. 맞는 순간(c.impact())에 resolve해서 다음 행동을 바로 받고, 여운은 뒤에서 마저 재생한다.
// impact를 부르지 않는 연출이면 끝날 때 resolve된다.
function run(c, aEl, scale, fn) {
  TIME = scale;
  const old = aEl.style.transition;
  aEl.style.transition = 'none';
  aEl.style.zIndex = '20';
  const mine = [];
  live = mine;
  let hitDone;
  const hit = new Promise((r) => { hitDone = r; });
  c.impact = () => setTimeout(hitDone, 90); // 맞는 순간을 살짝 보여 준 뒤 넘긴다
  const all = (async () => {
    try {
      await fn();
    } finally {
      for (const a of mine) a.cancel();
      if (live === mine) {
        live = [];
        TIME = 1;
      }
      aEl.style.transition = old;
      aEl.style.zIndex = '';
      hitDone();
    }
  })();
  return Promise.race([hit, all]);
}

// 해적단 공격 연출. from/to는 화면(client) 좌표. 맞는 순간에 resolve된다.
export function playAttackFx(factionId, { from, to, aEl, tEl, shakeEl: sh }) {
  const c = setup(from, to, aEl, tEl, sh);
  return run(c, aEl, timeScale(factionId), () => FX[factionId](c));
}

// 고무팔 해적단: 고무팔이 쭉 늘어나 친다. tension(탄력)이 클수록 더 세게 감았다가 터진다.
export function playRubberFx({ from, to, aEl, tEl, tension = 0, shakeEl: sh }) {
  const c = setup(from, to, aEl, tEl, sh);
  return run(c, aEl, timeScale('rubber'), () => rubber(c, tension));
}
