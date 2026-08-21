import { state } from './state.js';
import { loadUsers, escapeHtml, login, logout, hashPass } from './storage.js';

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

export function openModal(m) { m.classList.remove('hidden'); state.modalOpen = true; }
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

function msg(t, ok) { els.authMsg.textContent = t; els.authMsg.className = ok ? 'ok' : ''; }

export function refreshAuthModal() {
  if (state.currentUser) {
    els.authForms.classList.add('hidden');
    els.authInfo.classList.remove('hidden');
    const u = loadUsers()[state.currentUser] || {};
    els.authInfo.innerHTML =
      `<p style="font-size:15px;margin-bottom:6px">Playing as <b>${escapeHtml(state.currentUser)}</b></p>
       <p style="font-size:12px;color:rgba(255,255,255,.55)">Best: ${u.best || 0} · Games: ${u.plays || 0}</p>
       <button class="btn-main" id="logoutBtn" style="margin-top:18px">LOG OUT</button>`;
    document.getElementById('logoutBtn').addEventListener('click', () => {
      logout();
      updateHUD();
      refreshAuthModal();
    });
  } else {
    els.authForms.classList.remove('hidden');
    els.authInfo.classList.add('hidden');
    els.authUser.value = ''; els.authPass.value = ''; msg('');
  }
}

export async function handleAuth() {
  const name = els.authUser.value.trim();
  const pass = els.authPass.value;
  if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) return msg('Username: 3–16 letters, numbers or _');
  if (pass.length < 4) return msg('Password must be at least 4 chars');
  const users = loadUsers();
  if (authMode === 'signup') {
    if (users[name]) return msg('That username is taken');
    const salt = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    users[name] = { salt, hash: await hashPass(pass, salt), best: 0, plays: 0 };
    import('./storage.js').then(m => m.saveUsers(users));
    login(name);
    msg('Account created! 🎉', true);
    setTimeout(closeModals, 700);
  } else {
    const u = users[name];
    if (!u) return msg('No account with that name');
    if ((await hashPass(pass, u.salt)) !== u.hash) return msg('Wrong password');
    login(name);
    closeModals();
  }
  updateHUD();
}

export function renderLeaderboard() {
  const users = loadUsers();
  const rows = Object.entries(users)
    .map(([n, u]) => ({ n, best: u.best || 0 }))
    .filter(r => r.best > 0)
    .sort((a, b) => b.best - a.best)
    .slice(0, 10);
  if (!rows.length) {
    els.lbList.innerHTML = '<p class="empty">No scores yet.<br>Create an account!</p>';
    return;
  }
  els.lbList.innerHTML = rows.map((r, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
    const me = r.n === state.currentUser ? ' me' : '';
    return `<div class="lb-row${me}">
      <span class="lb-rank">${medal}</span>
      <span class="lb-name">${escapeHtml(r.n)}</span>
      <span class="lb-score">${r.best}</span>
    </div>`;
  }).join('');
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
  [els.authUser, els.authPass].forEach(inp => inp.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') handleAuth();
  }));

  // Top-left buttons
  els.playerBtn.addEventListener('click', () => { refreshAuthModal(); openModal(els.authModal); });
  els.boardBtn.addEventListener('click', () => { renderLeaderboard(); openModal(els.lbModal); });
  els.lbHint.addEventListener('pointerdown', e => e.stopPropagation());
  els.lbHint.addEventListener('click', () => { setAuthMode('signup'); refreshAuthModal(); openModal(els.authModal); });

  // Mute
  els.muteBtn.addEventListener('pointerdown', e => e.stopPropagation());
  els.muteBtn.addEventListener('click', () => {
    const muted = onMuteToggle();
    els.muteBtn.textContent = muted ? '🔇' : '🔊';
  });

  // Global input
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