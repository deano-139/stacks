import { state } from './state.js';

const KEYS = { BEST: 'stacks_best', USERS: 'stacks_users', SESSION: 'stacks_session' };

export function loadBest() { 
  try { return +localStorage.getItem(KEYS.BEST) || 0; } catch(e) { return 0; } 
}

export function saveBest(val) { 
  try { localStorage.setItem(KEYS.BEST, String(val)); } catch(e) {} 
}

export function loadUsers() { 
  try { return JSON.parse(localStorage.getItem(KEYS.USERS) || '{}'); } catch(e) { return {}; } 
}

export function saveUsers(u) { 
  try { localStorage.setItem(KEYS.USERS, JSON.stringify(u)); } catch(e) {} 
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function makeSalt() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

export async function hashPass(pass, salt) {
  const str = salt + ':' + pass;
  if (window.crypto && crypto.subtle) {
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch(e) { /* fall through */ }
  }
  let h1 = 0x811c9dc5 >>> 0, h2 = 0x9747b28c >>> 0;
  for (let round = 0; round < 4; round++) {
    for (let i = 0; i < str.length; i++) {
      h1 = Math.imul(h1 ^ (str.charCodeAt(i) + round), 0x01000193) >>> 0;
      h2 = (Math.imul(h2 ^ str.charCodeAt(i), 0x85ebca6b) + (h1 >>> 3)) >>> 0;
    }
  }
  return h1.toString(16) + '-' + h2.toString(16);
}

export function login(name) {
  state.currentUser = name;
  try { localStorage.setItem(KEYS.SESSION, name); } catch(e) {}
  const u = loadUsers()[name];
  state.best = (u && u.best) || 0;
}

export function logout() {
  state.currentUser = null;
  try { localStorage.removeItem(KEYS.SESSION); } catch(e) {}
  state.best = loadBest();
}

export function restoreSession() {
  try {
    const s = localStorage.getItem(KEYS.SESSION);
    if (s && loadUsers()[s]) {
      state.currentUser = s;
      state.best = loadUsers()[s].best || 0;
    } else {
      state.best = loadBest();
    }
  } catch(e) { state.best = loadBest(); }
}