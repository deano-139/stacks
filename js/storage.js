import { state } from './state.js';
import {
  fetchLeaderboard as sbFetchLeaderboard,
  submitScore,
  signUp as sbSignUp,
  signIn as sbSignIn,
  signOut as sbSignOut,
  getSession,
  fetchPersonalBest
} from './supabase.js';

// --- LOCAL STORAGE (cached copy of the personal best) ---
const KEYS = { BEST: 'stacks_best' };

export function loadBest() {
  try { return +localStorage.getItem(KEYS.BEST) || 0; } catch(e) { return 0; }
}

export function saveBest(val) {
  try { localStorage.setItem(KEYS.BEST, String(val)); } catch(e) {}
}

async function syncBest(username) {
  const localBest = loadBest();
  try {
    const cloudBest = await fetchPersonalBest(username);
    const best = Math.max(localBest, cloudBest);
    state.best = best;
    saveBest(best);

    if (localBest > cloudBest) await saveScoreToCloud(username, localBest);
  } catch (e) {
    state.best = localBest;
    console.warn('Failed to sync personal best:', e.message);
  }
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// --- SUPABASE AUTH ---
export async function login(email, password) {
  const data = await sbSignIn(email, password);
  state.currentUser = data.user.user_metadata?.username || email.split('@')[0];
  await syncBest(state.currentUser);
  return state.currentUser;
}

export async function signup(email, password, username) {
  const data = await sbSignUp(email, password, username);
  state.currentUser = data.session
    ? data.user.user_metadata?.username || username
    : null;
  if (state.currentUser) await syncBest(state.currentUser);
  else state.best = loadBest();
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
      await syncBest(state.currentUser);
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