let audioCtx = null;
let muted = false;

export function toggleMute() {
  muted = !muted;
  return muted;
}

export function isMuted() { return muted; }

function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

function tone(freq, dur, type, vol, when) {
  if (!audioCtx || muted) return;
  const t = audioCtx.currentTime + (when || 0);
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(t); o.stop(t + dur);
}

export function playStack(perfect, cmb) {
  ensureAudio();
  if (perfect) {
    const f = 392 * Math.pow(2, Math.min(cmb, 10) / 12);
    tone(f, 0.18, 'sine', 0.25);
    tone(f * 2, 0.22, 'sine', 0.10, 0.03);
  } else {
    tone(190, 0.07, 'square', 0.06);
    tone(140, 0.10, 'triangle', 0.12);
  }
}

export function playDeath() {
  ensureAudio();
  tone(220, 0.25, 'sawtooth', 0.14);
  tone(150, 0.35, 'sawtooth', 0.12, 0.09);
  tone(90, 0.5, 'sawtooth', 0.10, 0.18);
}

export { ensureAudio };