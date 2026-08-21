import { state } from './state.js';
import { escapeHtml } from './storage.js';
import { login, signup, logout, getLeaderboard } from './storage.js';

const els = {
  score: document.getElementById('score'),
  best: document.getElementById('best'),
  menu: document.getElementById('menu'),
  over: document.getElementById('over'),
  finalScore: document.getElementById('finalScore'),
  finalBest: document.getElementById('finalBest'),
  newBest: document.getElementById('newBest'),
  lbHint: document.getElementById('lbHint'),
  muteBtn: document.getElementById('mute'),
  playerBtn: document.getElementById('playerBtn'),
  playerName: document.getElementById('playerName'),
  boardBtn: document.getElementById('boardBtn'),
  authModal: document.getElementById('authModal'),
  authForms: document.getElementById('authForms'),
  authInfo: document.getElementById('authInfo'),
  tabLogin: document.getElementById('tabLogin'),
  tabSignup: document.getElementById('tabSignup'),
  authEmail: document.getElementById('authEmail'),
  authUser: document.getElementById('authUser'),
  authPass: document.getElementById('authPass'),
  authMsg: document.getElementById('authMsg'),
  authSubmit: document.getElementById('authSubmit'),
  lbModal: document.getElementById('lbModal'),
  lbList: document.getElementById('lbList'),
};

let authMode = 'login';

export function updateHUD() {
  els.score.textContent = state.score;
  els.best.textContent = 'BEST ' + state.best;
  els.playerName.textContent = (state.currentUser || 'GUEST').toUpperCase();
}

export function showMenu() {
  els.menu.classList.remove('hidden');
  els.over.classList.add('hidden');
  els.score.classList.add('hud-hidden');
  els.best.classList.add('hud-hidden');
}

export function hideMenu() {
  els.menu.classList.add('hidden');
  els.over.classList.add('hidden');
  els.score.classList.remove('hud-hidden');
  els.best.classList.remove('hud-hidden');
}

export function showGameOver(isNew) {
  els.finalScore.textContent = state.score;
  els.finalBest.textContent = 'BEST ' + state.best;
  els.newBest.style.display = isNew ? 'block' : 'none';
  els.lbHint.style.display = (!state.currentUser && state.score > 0) ? 'block' : 'none';
  els.over.classList.remove('hidden');
}

export function openModal(m) {
  m.classList.remove('hidden');
  state.modalOpen = true;
}

export function closeModals() {
  els.authModal.classList.add('hidden');
  els.lbModal.classList.add('hidden');
  state.modalOpen = false;
}

function setAuthMode(m) {
  authMode = m;
  els.tabLogin.classList.toggle('active', m === 'login');
  els.tabSignup.classList.toggle('active', m === 'signup');
  els.authSubmit.textContent = m === 'login' ? 'LOG IN' : 'CREATE ACCOUNT';
  msg('');
}

function msg(t, ok) {
  els.authMsg.textContent = t;
  els.authMsg.className = ok ? 'ok' : '';
}

export function refreshAuthModal() {
  if (state.currentUser) {
    els.authForms.classList.add('hidden');
    els.authInfo.classList.remove('hidden');
    els.authInfo.innerHTML =
      `<p style="font-size:15px;margin-bottom:6px">Playing as <b>${escapeHtml(state.currentUser)}</b></p>
       <p style="font-size:12px;color:rgba(255,255,255,.55)">Personal Best: ${state.best}</p>
       <button class="btn-main" id="logoutBtn" style="margin-top:18px">LOG OUT</button>`;
    document.getElementById('logoutBtn').addEventListener('click', async () => {
      try {
        await logout();
      } catch (e) {
        console.warn('Logout error:', e);
      }
      updateHUD();
      refreshAuthModal();
    });
  } else {
    els.authForms.classList.remove('hidden');
    els.authInfo.classList.add('hidden');
    els.authEmail.value = '';
    els.authUser.value = '';
    els.authPass.value = '';
    msg('');
  }
}

export async function handleAuth() {
  const email = els.authEmail.value.trim();
  const username = els.authUser.value.trim();
  const pass = els.authPass.value;

  // Validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return msg('Valid email required');
  if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) return msg('Username: 3–16 letters, numbers or _');
  if (pass.length < 6) return msg('Password must be at least 6 characters');

  els.authSubmit.disabled = true;
  els.authSubmit.textContent = '...';

  try {
    if (authMode === 'signup') {
      await signup(email, pass, username);
      msg('Account created! 🎉', true);
      setTimeout(closeModals, 700);
    } else {
      await login(email, pass);
      msg('Welcome back!', true);
      setTimeout(closeModals, 400);
    }
    updateHUD();
  } catch (e) {
    // Supabase errors have a .message property
    const errMsg = e?.message || 'Authentication failed';
    // Friendly error mapping
    if (errMsg.includes('Invalid login credentials')) msg('Wrong email or password');
    else if (errMsg.includes('already registered')) msg('Email already in use');
    else if (errMsg.includes('email_not_confirmed')) msg('Check your email to confirm account');
    else msg(errMsg);
  } finally {
    els.authSubmit.disabled = false;
    els.authSubmit.textContent = authMode === 'login' ? 'LOG IN' : 'CREATE ACCOUNT';
  }
}

export async function renderLeaderboard() {
  els.lbList.innerHTML = '<p class="empty">Loading...</p>';
  try {
    const rows = await getLeaderboard();
    if (!rows || !rows.length) {
      els.lbList.innerHTML = '<p class="empty">No scores yet.<br>Create an account and set one!</p>';
      return;
    }
    els.lbList.innerHTML = rows.map((r, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
      const me = r.username === state.currentUser ? ' me' : '';
      return `<div class="lb-row${me}">
        <span class="lb-rank">${medal}</span>
        <span class="lb-name">${escapeHtml(r.username)}</span>
        <span class="lb-score">${r.score}</span>
      </div>`;
    }).join('');
  } catch (e) {
    console.error('Leaderboard fetch failed:', e);
    els.lbList.innerHTML = '<p class="empty">Failed to load leaderboard.<br>Check connection and try again.</p>';
  }
}

export function initUI(onTap, onMuteToggle) {
  // Close buttons
  document.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', closeModals));
  els.authModal.addEventListener('pointerdown', e => { if (e.target === els.authModal) closeModals(); });
  els.lbModal.addEventListener('pointerdown', e => { if (e.target === els.lbModal) closeModals(); });

  // Auth tabs & submit
  els.tabLogin.addEventListener('click', () => setAuthMode('login'));
  els.tabSignup.addEventListener('click', () => setAuthMode('signup'));
  els.authSubmit.addEventListener('click', handleAuth);

  // Enter key in auth fields
  [els.authEmail, els.authUser, els.authPass].forEach(inp => {
    inp.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter') handleAuth();
    });
  });

  // Top-left buttons
  els.playerBtn.addEventListener('click', () => { refreshAuthModal(); openModal(els.authModal); });
  els.boardBtn.addEventListener('click', () => { renderLeaderboard(); openModal(els.lbModal); });
  els.lbHint.addEventListener('pointerdown', e => e.stopPropagation());
  els.lbHint.addEventListener('click', () => {
    setAuthMode('signup');
    refreshAuthModal();
    openModal(els.authModal);
  });

  // Mute toggle
  els.muteBtn.addEventListener('pointerdown', e => e.stopPropagation());
  els.muteBtn.addEventListener('click', () => {
    const muted = onMuteToggle();
    els.muteBtn.textContent = muted ? '🔇' : '🔊';
  });

  // Global tap / key handler
  let lastTap = 0;
  const tapHandler = (e) => {
    if (state.modalOpen) return;
    if (e.target.closest && e.target.closest('#topLeft, #mute, .modal-wrap, #lbHint')) return;
    const now = performance.now();
    if (now - lastTap < 90) return;
    lastTap = now;
    onTap(e);
  };

  window.addEventListener('pointerdown', tapHandler, { passive: true });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeModals(); return; }
    if (e.target && e.target.tagName === 'INPUT') return;
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      if (!e.repeat) tapHandler(e);
    }
  });
}

export { els };