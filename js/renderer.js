import { state, dims, CONFIG } from './state.js';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

export function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  dims.W = window.innerWidth; dims.H = window.innerHeight;
  canvas.width = Math.round(dims.W * dpr);
  canvas.height = Math.round(dims.H * dpr);
  canvas.style.width = dims.W + 'px';
  canvas.style.height = dims.H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const S = Math.min(dims.W, dims.H) / 7.5;
  dims.A = S; dims.B = S * 0.5; dims.C = S * 0.62;
}

export function hueFor(level) { return (state.hueBase + level * 6) % 360; }
export function hsl(h, s, l) { return `hsl(${h},${s}%,${l}%)`; }

export function iso(x, y, z) {
  return { 
    x: dims.W/2 + (x - z) * dims.A, 
    y: dims.H * 0.62 + (x + z) * dims.B - (y - state.camY) * dims.C 
  };
}

function fillPoly(pts, fill) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function easeOutBack(t) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function effSize(b) {
  if (!b.growAnim) return { sx: b.sx, sz: b.sz };
  const k = easeOutBack(Math.min(1, b.growAnim.t / b.growAnim.dur));
  return {
    sx: b.growAnim.fromSx + (b.sx - b.growAnim.fromSx) * k,
    sz: b.growAnim.fromSz + (b.sz - b.growAnim.fromSz) * k
  };
}

function drawBox(b, opts) {
  opts = opts || {};
  const y0 = opts.y !== undefined ? opts.y : opts.level;
  const es = effSize(b);
  const x0 = b.x - es.sx/2, x1 = b.x + es.sx/2;
  const z0 = b.z - es.sz/2, z1 = b.z + es.sz/2;
  let pts = [
    iso(x0, y0+1, z0), iso(x1, y0+1, z0), iso(x1, y0+1, z1), iso(x0, y0+1, z1),
    iso(x1, y0, z0), iso(x1, y0, z1), iso(x0, y0, z1)
  ];
  if (opts.rot) {
    const c = iso(b.x, y0 + 0.5, b.z);
    const cos = Math.cos(opts.rot), sin = Math.sin(opts.rot);
    pts = pts.map(p => ({
      x: c.x + (p.x - c.x)*cos - (p.y - c.y)*sin,
      y: c.y + (p.x - c.x)*sin + (p.y - c.y)*cos
    }));
  }
  if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
  const growBoost = b.growAnim ? 12 * (1 - Math.min(1, b.growAnim.t / b.growAnim.dur)) : 0;
  const boost = (opts.moving ? 8 : 0) + growBoost;
  
  fillPoly([pts[1], pts[2], pts[5], pts[4]], hsl(b.hue, 52, 44 + boost));
  fillPoly([pts[3], pts[2], pts[5], pts[6]], hsl(b.hue, 58, 30 + boost));
  fillPoly([pts[0], pts[1], pts[2], pts[3]], hsl(b.hue, 46, 60 + boost));
  
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[1].x, pts[1].y);
  ctx.lineTo(pts[2].x, pts[2].y); ctx.lineTo(pts[3].x, pts[3].y);
  ctx.closePath(); ctx.stroke();
  ctx.globalAlpha = 1;
}

export function draw() {
  const hue = hueFor(Math.max(1, state.stack.length));
  const g = ctx.createLinearGradient(0, 0, 0, dims.H);
  g.addColorStop(0, `hsl(${(hue+45)%360},40%,12%)`);
  g.addColorStop(0.6, `hsl(${hue},45%,7%)`);
  g.addColorStop(1, `hsl(${hue},50%,4%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, dims.W, dims.H);

  ctx.save();
  if (state.shake > 0.3) ctx.translate((Math.random()-0.5)*state.shake, (Math.random()-0.5)*state.shake);

  const startIdx = Math.max(0, Math.floor(state.camY) - 4);
  for (let i = startIdx; i < state.stack.length; i++) drawBox(state.stack[i], { level: i });
  for (const d of state.debris) {
    const fade = Math.min(1, Math.max(0, (d.y - (state.camY - 14)) / 5));
    drawBox(d, { y: d.y, rot: d.rot, alpha: fade });
  }
  if (state.moving) drawBox(state.moving, { level: state.stack.length, moving: true });

  for (const p of state.particles) {
    ctx.globalAlpha = Math.max(0, 1 - p.t / p.dur);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  for (const f of state.floaters) {
    const p = iso(f.wx, f.wy, f.wz);
    const k = f.t / f.dur;
    const alpha = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.font = `900 ${f.size}px 'Segoe UI', sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(255,255,255,0.8)';
    ctx.shadowBlur = 14;
    ctx.fillText(f.text, p.x, p.y - f.t * 55);
    ctx.restore();
  }

  ctx.restore();

  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${state.flash * 0.15})`;
    ctx.fillRect(0, 0, dims.W, dims.H);
  }
}