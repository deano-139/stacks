import { state } from './state.js';
import {
  fetchLeaderboard as sbFetchLeaderboard,
  submitScore,
  signUp as sbSignUp,
  signIn as sbSignIn,
  signOut as sbSignOut,
  getSession
} from './supabase.js';

// --- LOCAL STORAGE (personal best stays local) ---
const KEYS = { BEST: 'stacks_best' };

export function loadBest() {
  try { return +localStorage.getItem(KEYS.BEST) || 0; } catch(e) { return 0; }
}

export function saveBest(val) {
  try { localStorage.setItem(KEYS.BEST, String(val)); } catch(e) {}
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// --- SUPABASE AUTH ---
export async function login(email, password) {
  const data = await sbSignIn(email, password);
  state.currentUser = data.user.user_metadata?.username || email.split('@')[0];
  state.best = loadBest();
  return state.currentUser;
}

export async function signup(email, password, username) {
  const data = await sbSignUp(email, password, username);
  state.currentUser = data.session
    ? data.user.user_metadata?.username || username
    : null;
  state.best = loadBest();
  return state.currentUser;
}

export async function logout() {
  await sbSignOut();
  state.currentUser = null;
  state.best = loadBest();
}

export async function restoreSession() {
  state.best = loadBest();
  try {
    const session = await getSession();
    if (session?.user) {
      state.currentUser = session.user.user_metadata?.username
        || session.user.email?.split('@')[0] || 'PLAYER';
    }
  } catch(e) { /* no session */ }
}

// --- SUPABASE LEADERBOARD ---
export async function getLeaderboard() {
  return await sbFetchLeaderboard();
}

export async function saveScoreToCloud(username, score) {
  try {
    return await submitScore(username, score);
  } catch(e) {
    console.warn('Failed to save score to cloud:', e.message);
    throw e;
  }
}