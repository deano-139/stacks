export const CONFIG = {
  BASE: 3.2,
  EPS: 0.15,
  GROW: 0.30,
  MOVE_LIMIT: 3.4,
  GRAVITY: 32,
  CAM_HOLD: 4.5,
  ROTATION_SPEED: 4.5,
};

export const state = {
  mode: 'menu',
  stack: [],
  moving: null,
  debris: [],
  particles: [],
  floaters: [],
  score: 0,
  combo: 0,
  camY: 0,
  camTarget: 0,
  zoom: 1,
  zoomTarget: 1,
  flash: 0,
  shake: 0,
  shakeIntensity: 0,
  hueBase: 200,
  restartAt: 0,
  modalOpen: false,
  best: 0,
  currentUser: null,
  perfectFlash: 0,
  comboStreak: 0,
};

export const dims = { W: 0, H: 0, A: 100, B: 50, C: 62 };