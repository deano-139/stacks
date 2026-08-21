import { state, CONFIG } from './state.js';
import { resize, draw } from './renderer.js';
import { initScene, spawnMoving, drop } from './input.js';
import { ensureAudio } from './audio.js';
import { toggleMute } from './audio.js';
import { restoreSession } from './storage.js';
import { initUI, updateHUD, hideMenu, showMenu } from './ui.js';

function startGame() {
  state.hueBase = Math.floor(Math.random() * 360);
  initScene();
  state.mode = 'play';
  hideMenu();
  state.moving = spawnMoving();
  updateHUD();
}

function handleTap() {
  ensureAudio();
  if (state.mode === 'menu') startGame();
  else if (state.mode === 'play') drop();
  else if (state.mode === 'dead' && performance.now() >= state.restartAt) startGame();
}

function update(dt) {
  if (state.modalOpen) return;

  state.camY += (state.camTarget - state.camY) * Math.min(1, dt * 5);

  // Regrow animations
  for (const blk of state.stack) {
    if (blk.growAnim) {
      blk.growAnim.t += dt;
      if (blk.growAnim.t >= blk.growAnim.dur) delete blk.growAnim;
    }
  }

  // Moving block
  if (state.mode === 'play' && state.moving) {
    const b = state.moving;
    let p = b.axis === 'x' ? b.x : b.z;
    p += b.dir * b.speed * dt;
    if (p > CONFIG.MOVE_LIMIT) { p = CONFIG.MOVE_LIMIT; b.dir = -1; }
    else if (p < -CONFIG.MOVE_LIMIT) { p = -CONFIG.MOVE_LIMIT; b.dir = 1; }
    if (b.axis === 'x') b.x = p; else b.z = p;
  }

  // Debris physics
  for (let i = state.debris.length - 1; i >= 0; i--) {
    const d = state.debris[i];
    d.vy -= CONFIG.GRAVITY * dt;
    d.y += d.vy * dt;
    d.x += d.vx * dt; d.z += d.vz * dt;
    d.rot += d.vr * dt;
    if (d.y < state.camY - 14) state.debris.splice(i, 1);
  }

  // Particles
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.t += dt;
    if (p.t >= p.dur) { state.particles.splice(i, 1); continue; }
    p.vy += 620 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
  }

  // Floaters
  for (let i = state.floaters.length - 1; i >= 0; i--) {
    state.floaters[i].t += dt;
    if (state.floaters[i].t >= state.floaters[i].dur) state.floaters.splice(i, 1);
  }

  state.flash = Math.max(0, state.flash - dt * 2.2);
  state.shake = Math.max(0, state.shake - dt * 30);
}

// --- Bootstrap ---
window.addEventListener('resize', resize);
resize();
restoreSession();
initScene();
updateHUD();
initUI(handleTap, toggleMute);

let last = performance.now();
function loop(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);