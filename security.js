// ---------- Edit protection ----------
// The password is never stored in plain text: only a salted SHA-256 hash
// is kept (in localStorage once changed, or the built-in default below).
// Changing the password from the app updates the stored hash only -
// it does not require editing any file.

const PASSWORD_SALT = 'sp-cards-fire-map-2026';
const DEFAULT_PASSWORD_HASH = '9c9ca04b1c87c04aae1cbcf3a0c91c854a68f518c312be1b8304a3e4c0cab585';
const PASSWORD_HASH_KEY = 'fireMapPasswordHash';
const AUTH_SESSION_KEY = 'fireMapAuthenticated';

async function hashPassword(password) {
  const data = new TextEncoder().encode(`${PASSWORD_SALT}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function getStoredPasswordHash() {
  return localStorage.getItem(PASSWORD_HASH_KEY) || DEFAULT_PASSWORD_HASH;
}

function isUnlocked() {
  return sessionStorage.getItem(AUTH_SESSION_KEY) === 'true';
}

function setUnlocked(value) {
  if (value) {
    sessionStorage.setItem(AUTH_SESSION_KEY, 'true');
  } else {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
  }
  updateLockUI();
}

// ---------- Password modal ----------
const passwordOverlay = document.getElementById('password-modal-overlay');
const passwordTitle = document.getElementById('password-modal-title');
const passwordText = document.getElementById('password-modal-text');
const passwordInput = document.getElementById('password-input');
const passwordConfirmBtn = document.getElementById('password-confirm');
const passwordCancelBtn = document.getElementById('password-cancel');

let passwordResolve = null;

function askPassword(title, text) {
  passwordTitle.textContent = title;
  passwordText.textContent = text;
  passwordInput.value = '';
  passwordOverlay.classList.add('visible');
  setTimeout(() => passwordInput.focus(), 50);

  return new Promise(resolve => {
    passwordResolve = resolve;
  });
}

function closePasswordModal(result) {
  passwordOverlay.classList.remove('visible');
  const resolve = passwordResolve;
  passwordResolve = null;
  if (resolve) resolve(result);
}

passwordConfirmBtn.addEventListener('click', () => closePasswordModal(passwordInput.value));
passwordCancelBtn.addEventListener('click', () => closePasswordModal(null));
passwordInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') closePasswordModal(passwordInput.value);
  if (e.key === 'Escape') closePasswordModal(null);
});

// ---------- Auth guard ----------
// Wraps an action so it only runs once the correct password has been entered.
// The session stays unlocked (via sessionStorage) until the tab is closed
// or the user re-locks it manually.
async function requireAuth(action) {
  if (isUnlocked()) {
    action();
    return;
  }

  const password = await askPassword(
    'Authentification requise',
    "Saisissez le mot de passe pour modifier la carte."
  );
  if (password === null) return;

  const hash = await hashPassword(password);
  if (hash === getStoredPasswordHash()) {
    setUnlocked(true);
    action();
  } else {
    showStatus('Mot de passe incorrect');
  }
}

// ---------- Change password ----------
async function changePassword() {
  const current = await askPassword(
    'Changer le mot de passe',
    'Saisissez le mot de passe actuel.'
  );
  if (current === null) return;

  const currentHash = await hashPassword(current);
  if (currentHash !== getStoredPasswordHash()) {
    showStatus('Mot de passe actuel incorrect');
    return;
  }

  const next = await askPassword(
    'Changer le mot de passe',
    'Saisissez le nouveau mot de passe (4 caractères minimum).'
  );
  if (next === null) return;
  if (next.length < 4) {
    showStatus('Le nouveau mot de passe est trop court');
    return;
  }

  const confirmPwd = await askPassword(
    'Changer le mot de passe',
    'Confirmez le nouveau mot de passe.'
  );
  if (confirmPwd === null) return;
  if (confirmPwd !== next) {
    showStatus('Les mots de passe ne correspondent pas');
    return;
  }

  localStorage.setItem(PASSWORD_HASH_KEY, await hashPassword(next));
  setUnlocked(true);
  showStatus('Mot de passe mis à jour');
}

// ---------- Lock toggle ----------
const lockToggleBtn = document.getElementById('lock-toggle');

function updateLockUI() {
  const unlocked = isUnlocked();
  lockToggleBtn.textContent = unlocked ? '🔓' : '🔒';
  lockToggleBtn.title = unlocked
    ? "Verrouiller l'édition de la carte"
    : "Déverrouiller l'édition de la carte (mot de passe requis)";
}

lockToggleBtn.addEventListener('click', () => {
  if (isUnlocked()) {
    setUnlocked(false);
    showStatus('Édition verrouillée');
  } else {
    requireAuth(() => showStatus('Édition déverrouillée'));
  }
});

document.getElementById('change-password-btn').addEventListener('click', () => {
  requireAuth(changePassword);
});

updateLockUI();
