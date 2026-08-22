import { state, dims, CONFIG } from './state.js';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

export function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  dims.W = window.innerWidth;
  dims.H = window.innerHeight;
  canvas.width = Math.round(dims.W * dpr);
  canvas.height = Math.round(dims.H * dpr);
  canvas.style.width = dims.W + 'px';
  canvas.style.height = dims.H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const S = Math.min(dims.W, dims.H) / 7.5;
  dims.A = S;
  dims.B = S * 0.5;
  dims.C = S * 0.62;
}

export function hueFor(level) {
  return (state.hueBase + level * 6) % 360;
}

export function hsl(h, s, l) {
  return `hsl(${h},${s}%,${l}%)`;
}

export function iso(x, y, z) {
  const zoom = state.zoom;
  return {
    x: dims.W / 2 + (x - z) * dims.A * zoom,
    y: dims.H * 0.62 + ((x + z) * dims.B - (y - state.camY) * dims.C) * zoom,
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
  const c1 = 1.70158,
    c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function easeOutElastic(t) {
  const c4 = (2 * Math.PI) / 3;
  return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

function effSize(b) {
  if (!b.growAnim) return { sx: b.sx, sz: b.sz };
  const k = easeOutElastic(Math.min(1, b.growAnim.t / b.growAnim.dur));
  return {
    sx: b.growAnim.fromSx + (b.sx - b.growAnim.fromSx) * k,
    sz: b.growAnim.fromSz + (b.sz - b.growAnim.fromSz) * k,
  };
}

function drawBox3D(b, opts) {
  opts = opts || {};
  const y0 = opts.y !== undefined ? opts.y : opts.level;
  const es = effSize(b);
  const x0 = b.x - es.sx / 2,
    x1 = b.x + es.sx / 2;
  const z0 = b.z - es.sz / 2,
    z1 = b.z + es.sz / 2;

  let pts = [
    iso(x0, y0 + 1, z0),
    iso(x1, y0 + 1, z0),
    iso(x1, y0 + 1, z1),
    iso(x0, y0 + 1, z1),
    iso(x1, y0, z0),
    iso(x1, y0, z1),
    iso(x0, y0, z1),
  ];

  if (opts.rot) {
    const c = iso(b.x, y0 + 0.5, b.z);
    const cos = Math.cos(opts.rot),
      sin = Math.sin(opts.rot);
    pts = pts.map((p) => ({
      x: c.x + (p.x - c.x) * cos - (p.y - c.y) * sin,
      y: c.y + (p.x - c.x) * sin + (p.y - c.y) * cos,
    }));
  }

  if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;

  const growBoost = b.growAnim ? 15 * (1 - Math.min(1, b.growAnim.t / b.growAnim.dur)) : 0;
  const boost = (opts.moving ? 10 : 0) + growBoost;
  const perfectBoost = opts.perfect ? 20 : 0;

  // Enhanced 3D shading with better lighting
  const topColor = hsl(b.hue, 50, 65 + boost + perfectBoost);
  const frontColor = hsl(b.hue, 55, 48 + boost + perfectBoost);
  const sideColor = hsl(b.hue, 60, 35 + boost + perfectBoost);
  const darkSide = hsl(b.hue, 65, 25 + boost);

  // Draw shadow on ground
  if (opts.level !== undefined && !opts.moving) {
    const shadowPts = [
      iso(x0, y0, z0),
      iso(x1, y0, z0),
      iso(x1, y0, z1),
      iso(x0, y0, z1),
    ];
    ctx.globalAlpha = (opts.alpha || 1) * 0.3;
    fillPoly(shadowPts, 'rgba(0,0,0,0.5)');
    ctx.globalAlpha = opts.alpha || 1;
  }

  // Front face (brightest)
  fillPoly([pts[1], pts[2], pts[5], pts[4]], frontColor);

  // Right side face (medium)
  fillPoly([pts[3], pts[2], pts[5], pts[6]], sideColor);

  // Top face (highlight)
  fillPoly([pts[0], pts[1], pts[2], pts[3]], topColor);

  // Edge highlights
  ctx.strokeStyle = `rgba(255,255,255,${0.3 + (opts.perfect ? 0.3 : 0)})`;
  ctx.lineWidth = opts.perfect ? 2 : 1.5;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  ctx.lineTo(pts[1].x, pts[1].y);
  ctx.lineTo(pts[2].x, pts[2].y);
  ctx.lineTo(pts[3].x, pts[3].y);
  ctx.closePath();
  ctx.stroke();

  // Bottom edge shadow
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pts[4].x, pts[4].y);
  ctx.lineTo(pts[5].x, pts[5].y);
  ctx.lineTo(pts[6].x, pts[6].y);
  ctx.stroke();

  // Perfect placement glow
  if (opts.perfect) {
    ctx.shadowColor = hsl(b.hue, 80, 70);
    ctx.shadowBlur = 30;
    fillPoly([pts[0], pts[1], pts[2], pts[3]], 'rgba(255,255,255,0.1)');
    ctx.shadowBlur = 0;
  }

  ctx.globalAlpha = 1;
}

export function draw() {
  const hue = hueFor(Math.max(1, state.stack.length));

  // Enhanced gradient background
  const g = ctx.createLinearGradient(0, 0, 0, dims.H);
  g.addColorStop(0, `hsl(${(hue + 45) % 360},45%,14%)`);
  g.addColorStop(0.5, `hsl(${hue},50%,8%)`);
  g.addColorStop(1, `hsl(${hue},55%,4%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, dims.W, dims.H);

  // Add subtle radial glow
  const radialG = ctx.createRadialGradient(dims.W / 2, dims.H / 2, 0, dims.W / 2, dims.H / 2, dims.W);
  radialG.addColorStop(0, `hsla(${hue},60%,50%,0.08)`);
  radialG.addColorStop(1, 'transparent');
  ctx.fillStyle = radialG;
  ctx.fillRect(0, 0, dims.W, dims.H);

  ctx.save();

  // Enhanced camera shake
  if (state.shake > 0.3) {
    const shakeX = (Math.random() - 0.5) * state.shake * state.shakeIntensity;
    const shakeY = (Math.random() - 0.5) * state.shake * state.shakeIntensity;
    ctx.translate(shakeX, shakeY);
  }

  // Draw stack and debris from back to front so cut pieces keep their depth.
  const startIdx = Math.max(0, Math.floor(state.camY) - 4);
  const drawables = [];
  for (let i = startIdx; i < state.stack.length; i++) {
    const block = state.stack[i];
    drawables.push({ block, level: i, depth: block.x + block.z, isStack: true });
  }
  for (const debris of state.debris) {
    drawables.push({ debris, level: debris.y, depth: debris.x + debris.z, isStack: false });
  }
  drawables.sort((a, b) => a.level - b.level || a.depth - b.depth);

  for (const item of drawables) {
    if (item.isStack) {
      drawBox3D(item.block, { level: item.level, perfect: item.block.isPerfect || false });
    } else {
      const fade = Math.min(1, Math.max(0, (item.debris.y - (state.camY - 14)) / 5));
      drawBox3D(item.debris, { y: item.debris.y, rot: item.debris.rot, alpha: fade });
    }
  }

  // Draw moving block
  if (state.moving) {
    drawBox3D(state.moving, { level: state.stack.length, moving: true });
  }

  // Enhanced particles
  for (const p of state.particles) {
    const life = 1 - p.t / p.dur;
    ctx.globalAlpha = Math.max(0, life);
    ctx.fillStyle = p.color;

    if (p.type === 'spark') {
      // Spark particles
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      ctx.shadowBlur = 0;
    } else if (p.type === 'glow') {
      // Glow particles
      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
      gradient.addColorStop(0, p.color);
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.fillRect(p.x - p.size * 2, p.y - p.size * 2, p.size * 4, p.size * 4);
    } else {
      // Regular particles
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
  }
  ctx.globalAlpha = 1;

  // Floaters
  for (const f of state.floaters) {
    const p = iso(f.wx, f.wy, f.wz);
    const k = f.t / f.dur;
    const alpha = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;

    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);

    // Enhanced text rendering
    ctx.font = `900 ${f.size}px 'Outfit', 'Segoe UI', sans-serif`;
    ctx.textAlign = 'center';

    // Text shadow
    ctx.shadowColor = f.color || 'rgba(255,255,255,0.9)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Main text
    ctx.fillStyle = '#fff';
    ctx.fillText(f.text, p.x, p.y - f.t * 70);

    // Outline
    ctx.strokeStyle = f.color || 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.strokeText(f.text, p.x, p.y - f.t * 70);

    ctx.restore();
  }

  ctx.restore();

  // Enhanced flash effect
  if (state.flash > 0) {
    const flashGradient = ctx.createRadialGradient(
      dims.W / 2,
      dims.H / 2,
      0,
      dims.W / 2,
      dims.H / 2,
      dims.W * 0.6
    );
    flashGradient.addColorStop(0, `rgba(255,255,255,${state.flash * 0.25})`);
    flashGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = flashGradient;
    ctx.fillRect(0, 0, dims.W, dims.H);
  }

  // Perfect combo streak flash
  if (state.perfectFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${state.perfectFlash * 0.15})`;
    ctx.fillRect(0, 0, dims.W, dims.H);
  }
}