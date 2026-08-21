export const CONFIG = {
  BASE: 3.2,
  EPS: 0.15,
  GROW: 0.30,
  MOVE_LIMIT: 3.4,
  GRAVITY: 24,
  CAM_HOLD: 4.5,
};

export const state = {
  mode: 'menu', // menu | play | dead
  stack: [],
  moving: null,
  debris: [],
  particles: [],
  floaters: [],
  score: 0,
  combo: 0,
  camY: 0,
  camTarget: 0,
  flash: 0,
  shake: 0,
  hueBase: 200,
  restartAt: 0,
  modalOpen: false,
  best: 0,
  currentUser: null,
};

// Canvas dimensions (updated by resize)
export const dims = { W: 0, H: 0, A: 100, B: 50, C: 62 };