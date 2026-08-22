import { state, dims, CONFIG } from './state.js';
import { hueFor, iso } from './renderer.js';
import { playStack, playDeath, ensureAudio } from './audio.js';
import { saveBest, saveScoreToCloud } from './storage.js';
import { showGameOver, updateHUD } from './ui.js';

export function initScene() {
  state.stack = [{ x: 0, z: 0, sx: CONFIG.BASE, sz: CONFIG.BASE, hue: hueFor(0) }];
  state.moving = null;
  state.debris = [];
  state.particles = [];
  state.floaters = [];
  state.camY = 0;
  state.camTarget = 0;
  state.zoom = 1;
  state.zoomTarget = 1;
  state.score = 0;
  state.combo = 0;
  state.flash = 0;
  state.shake = 0;
  state.shakeIntensity = 0;
  state.perfectFlash = 0;
}

export function spawnMoving() {
  const level = state.stack.length;
  const prev = state.stack[level - 1];
  const axis = level % 2 === 1 ? 'x' : 'z';
  const side = ((level >> 1) % 2 === 0 ? -1 : 1);
  const b = {
    x: prev.x,
    z: prev.z,
    sx: prev.sx,
    sz: prev.sz,
    axis,
    dir: -side,
    speed: Math.min(3.0 + state.score * 0.12, 9.0),
    hue: hueFor(level),
  };
  if (axis === 'x') b.x = side * CONFIG.MOVE_LIMIT;
  else b.z = side * CONFIG.MOVE_LIMIT;
  return b;
}

function burst(b, level, perfect = false) {
  const c = iso(b.x, level + 1, b.z);
  const particleCount = perfect ? 50 : 26;

  for (let i = 0; i < particleCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = perfect ? 100 + Math.random() * 300 : 60 + Math.random() * 220;
    const type = perfect ? (Math.random() > 0.5 ? 'spark' : 'glow') : 'regular';

    state.particles.push({
      x: c.x + (Math.random() - 0.5) * b.sx * 100 * 0.6,
      y: c.y + (Math.random() - 0.5) * 10,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - (perfect ? 120 : 80),
      t: 0,
      dur: perfect ? 0.6 + Math.random() * 0.5 : 0.45 + Math.random() * 0.45,
      size: perfect ? 3 + Math.random() * 4 : 2 + Math.random() * 3,
      color: `hsl(${b.hue},${perfect ? 85 : 75}%,${62 + Math.random() * 20}%)`,
      type,
    });
  }

  // Add shockwave ring for perfect
  if (perfect) {
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      state.particles.push({
        x: c.x,
        y: c.y,
        vx: Math.cos(a) * 200,
        vy: Math.sin(a) * 200,
        t: 0,
        dur: 0.4,
        size: 4,
        color: `hsl(${b.hue},90%,75%)`,
        type: 'glow',
      });
    }
  }
}

function addFloater(text, b, level, size, color) {
  state.floaters.push({
    text,
    wx: b.x,
    wz: b.z,
    wy: level + 1.3,
    t: 0,
    dur: 1.1,
    size,
    color: color || 'rgba(255,255,255,0.9)',
  });
}

export function drop() {
  if (!state.moving) return;

  const b = state.moving;
  const prev = state.stack[state.stack.length - 1];
  const axis = b.axis;
  const cur = axis === 'x' ? b.x : b.z;
  const prv = axis === 'x' ? prev.x : prev.z;
  const sizeP = axis === 'x' ? prev.sx : prev.sz;
  const delta = cur - prv;
  const overlap = sizeP - Math.abs(delta);
  const level = state.stack.length;

  // MISS: Block falls off completely
  if (overlap <= 0) {
    state.debris.push({
      x: b.x,
      z: b.z,
      sx: b.sx,
      sz: b.sz,
      hue: b.hue,
      y: level,
      vy: 0.5,
      vx: axis === 'x' ? Math.sign(b.dir) * 3 : 0,
      vz: axis === 'z' ? Math.sign(b.dir) * 3 : 0,
      vr: Math.sign(b.dir) * 2.5,
      rot: 0,
    });
    state.moving = null;
    die();
    return;
  }

  // PERFECT: Within epsilon threshold
  if (Math.abs(delta) < CONFIG.EPS) {
    state.combo++;
    state.comboStreak++;

    if (axis === 'x') b.x = prv;
    else b.z = prv;

    // Grow block on combo
    if (state.combo >= 2) {
      const fromSx = b.sx,
        fromSz = b.sz;
      b.sx = Math.min(CONFIG.BASE, b.sx + CONFIG.GROW);
      b.sz = Math.min(CONFIG.BASE, b.sz + CONFIG.GROW);
      if (b.sx !== fromSx || b.sz !== fromSz) {
        b.growAnim = { t: 0, dur: 0.45, fromSx, fromSz };
      }
    }

    // Enhanced perfect feedback
    state.flash = 1.2;
    state.perfectFlash = 1;
    state.shake = state.combo >= 3 ? 8 : 5;
    state.shakeIntensity = state.combo >= 5 ? 1.5 : 1;

    burst(b, level, true);

    const comboText =
      state.combo >= 5
        ? `INSANE ×${state.combo}`
        : state.combo >= 3
        ? `AMAZING ×${state.combo}`
        : state.combo >= 2
        ? `PERFECT ×${state.combo}`
        : 'PERFECT!';

    const fontSize = Math.min(20 + state.combo * 5, 48);
    const color =
      state.combo >= 5
        ? 'rgba(255,215,0,0.95)'
        : state.combo >= 3
        ? 'rgba(255,180,100,0.95)'
        : 'rgba(255,255,255,0.95)';

    addFloater(comboText, b, level, fontSize, color);
    playStack(true, state.combo);

    b.isPerfect = true;
  }
  // SLICE: Partial overlap
  else {
    state.combo = 0;
    state.comboStreak = 0;

    const sizeC = axis === 'x' ? b.sx : b.sz;
    const curL = cur - sizeC / 2,
      curR = cur + sizeC / 2;
    const prvL = prv - sizeP / 2,
      prvR = prv + sizeP / 2;
    const ovL = Math.max(curL, prvL),
      ovR = Math.min(curR, prvR);
    const newSize = ovR - ovL;
    const newC = (ovL + ovR) / 2;
    const cutSize = sizeC - newSize;
    const cutC = delta > 0 ? (ovR + curR) / 2 : (curL + ovL) / 2;
    const sgn = Math.sign(delta) || 1;

    // Enhanced debris physics
    if (axis === 'x') {
      state.debris.push({
        x: cutC,
        z: b.z,
        sx: cutSize,
        sz: b.sz,
        hue: b.hue,
        y: level,
        vy: 0,
        vx: sgn * 2.5,
        vz: 0,
        vr: sgn * 3.5,
        rot: 0,
      });
      b.x = newC;
      b.sx = newSize;
    } else {
      state.debris.push({
        x: b.x,
        z: cutC,
        sx: b.sx,
        sz: cutSize,
        hue: b.hue,
        y: level,
        vy: 0,
        vx: 0,
        vz: sgn * 2.5,
        vr: sgn * 3.5,
        rot: 0,
      });
      b.z = newC;
      b.sz = newSize;
    }

    // Add slice particles
    const slicePos = iso(axis === 'x' ? cutC : b.x, level + 0.5, axis === 'z' ? cutC : b.z);
    for (let i = 0; i < 12; i++) {
      state.particles.push({
        x: slicePos.x,
        y: slicePos.y,
        vx: (Math.random() - 0.5) * 150,
        vy: -50 - Math.random() * 100,
        t: 0,
        dur: 0.4,
        size: 2 + Math.random() * 2,
        color: `hsl(${b.hue},60%,50%)`,
        type: 'regular',
      });
    }

    playStack(false, 0);

  }

  // Commit block to stack
  state.stack.push({
    x: b.x,
    z: b.z,
    sx: b.sx,
    sz: b.sz,
    hue: b.hue,
    growAnim: b.growAnim ? { ...b.growAnim } : undefined,
    isPerfect: b.isPerfect || false,
  });

  state.score++;
  updateHUD();
  state.camTarget = Math.max(0, state.stack.length - CONFIG.CAM_HOLD);
  state.moving = spawnMoving();
}

function die() {
  state.mode = 'dead';
  state.camTarget = Math.max(0, (state.stack.length - 1) / 2);
  state.zoomTarget = Math.max(0.35, Math.min(1, (dims.H * 0.78) / ((state.stack.length + 2) * dims.C)));
  state.shake = 18;
  state.shakeIntensity = 1.5;
  playDeath();

  let isNew = false;

  if (state.score > state.best) {
    state.best = state.score;
    saveBest(state.best);
    isNew = true;
  }

  if (state.currentUser && isNew) {
    saveScoreToCloud(state.currentUser, state.score).catch((err) => {
      console.warn('Cloud score submission failed:', err);
    });
  }

  updateHUD();
  state.restartAt = performance.now() + 750;

  setTimeout(() => {
    if (state.mode !== 'dead') return;
    showGameOver(isNew);
  }, 700);
}