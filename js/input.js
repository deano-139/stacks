import { state, CONFIG } from './state.js';
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
  state.score = 0;
  state.combo = 0;
  state.flash = 0;
  state.shake = 0;
}

export function spawnMoving() {
  const level = state.stack.length;
  const prev = state.stack[level - 1];
  const axis = (level % 2 === 1) ? 'x' : 'z';
  const side = (((level >> 1) % 2) === 0) ? -1 : 1;
  const b = {
    x: prev.x,
    z: prev.z,
    sx: prev.sx,
    sz: prev.sz,
    axis,
    dir: -side,
    speed: Math.min(3.0 + state.score * 0.07, 7.2),
    hue: hueFor(level),
  };
  if (axis === 'x') b.x = side * CONFIG.MOVE_LIMIT;
  else b.z = side * CONFIG.MOVE_LIMIT;
  return b;
}

function burst(b, level) {
  const c = iso(b.x, level + 1, b.z);
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 60 + Math.random() * 220;
    state.particles.push({
      x: c.x + (Math.random() - 0.5) * b.sx * 100 * 0.6,
      y: c.y + (Math.random() - 0.5) * 10,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 80,
      t: 0,
      dur: 0.45 + Math.random() * 0.45,
      size: 2 + Math.random() * 3,
      color: `hsl(${b.hue},75%,${62 + Math.random() * 15}%)`,
    });
  }
}

function addFloater(text, b, level, size) {
  state.floaters.push({
    text,
    wx: b.x,
    wz: b.z,
    wy: level + 1.3,
    t: 0,
    dur: 0.95,
    size,
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

  // --- MISS: Block falls off completely ---
  if (overlap <= 0) {
    state.debris.push({
      x: b.x, z: b.z, sx: b.sx, sz: b.sz, hue: b.hue,
      y: level, vy: 0.5,
      vx: axis === 'x' ? Math.sign(b.dir) * 2 : 0,
      vz: axis === 'z' ? Math.sign(b.dir) * 2 : 0,
      vr: Math.sign(b.dir) * 1.8, rot: 0,
    });
    state.moving = null;
    void die();
    return;
  }

  // --- PERFECT: Within epsilon threshold ---
  if (Math.abs(delta) < CONFIG.EPS) {
    state.combo++;
    if (axis === 'x') b.x = prv;
    else b.z = prv;

    if (state.combo >= 2) {
      const fromSx = b.sx, fromSz = b.sz;
      b.sx = Math.min(CONFIG.BASE, b.sx + CONFIG.GROW);
      b.sz = Math.min(CONFIG.BASE, b.sz + CONFIG.GROW);
      if (b.sx !== fromSx || b.sz !== fromSz) {
        b.growAnim = { t: 0, dur: 0.35, fromSx, fromSz };
      }
    }

    state.flash = 1;
    burst(b, level);
    addFloater(
      state.combo >= 2 ? `PERFECT ×${state.combo}` : 'PERFECT!',
      b, level,
      Math.min(18 + state.combo * 4, 36)
    );
    playStack(true, state.combo);
  }
  // --- SLICE: Partial overlap ---
  else {
    state.combo = 0;
    const sizeC = axis === 'x' ? b.sx : b.sz;
    const curL = cur - sizeC / 2, curR = cur + sizeC / 2;
    const prvL = prv - sizeP / 2, prvR = prv + sizeP / 2;
    const ovL = Math.max(curL, prvL), ovR = Math.min(curR, prvR);
    const newSize = ovR - ovL;
    const newC = (ovL + ovR) / 2;
    const cutSize = sizeC - newSize;
    const cutC = delta > 0 ? (ovR + curR) / 2 : (curL + ovL) / 2;
    const sgn = Math.sign(delta) || 1;

    if (axis === 'x') {
      state.debris.push({
        x: cutC, z: b.z, sx: cutSize, sz: b.sz, hue: b.hue,
        y: level, vy: 0, vx: sgn * 1.6, vz: 0, vr: sgn * 2.2, rot: 0,
      });
      b.x = newC;
      b.sx = newSize;
    } else {
      state.debris.push({
        x: b.x, z: cutC, sx: b.sx, sz: cutSize, hue: b.hue,
        y: level, vy: 0, vx: 0, vz: sgn * 1.6, vr: sgn * 2.2, rot: 0,
      });
      b.z = newC;
      b.sz = newSize;
    }
    playStack(false, 0);
  }

  // Commit block to stack
  state.stack.push({
    x: b.x, z: b.z, sx: b.sx, sz: b.sz,
    hue: b.hue, growAnim: b.growAnim,
  });
  state.score++;
  updateHUD();
  state.camTarget = Math.max(0, state.stack.length - CONFIG.CAM_HOLD);
  state.moving = spawnMoving();
}

async function die() {
  state.mode = 'dead';
  state.shake = 14;
  playDeath();

  let isNew = false;

  // Update local personal best
  if (state.score > state.best) {
    state.best = state.score;
    saveBest(state.best);
    isNew = true;
  }

  // Submit authenticated scores even when the local best is already higher.
  if (state.score > 0) {
    await saveScoreToCloud(state.currentUser, state.score).catch(err => {
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