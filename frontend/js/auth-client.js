/**
 * auth-client.js
 * Client-side auth state manager. Handles token storage, auto-refresh,
 * authenticated API calls, and UI population.
 *
 * IMPORTANT: Set API_BASE to your deployed API Gateway URL.
 */

// ── Configure this after your first deploy ────────────────────────────
const API_BASE = 'https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com/prod';
// ─────────────────────────────────────────────────────────────────────

const AUTH_KEY = 'vidyasetu_auth_v1';

const AuthClient = (() => {

  // ── Storage helpers ─────────────────────────────────────────────────
  function getAuth() {
    try { return JSON.parse(sessionStorage.getItem(AUTH_KEY)); }
    catch { return null; }
  }

  function setAuth(data) {
    sessionStorage.setItem(AUTH_KEY, JSON.stringify(data));
  }

  function clearAuth() {
    sessionStorage.removeItem(AUTH_KEY);
  }

  // ── Decode JWT payload without verification (client-side only) ──────
  function decodeToken(token) {
    try {
      const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(b64));
    } catch { return null; }
  }

  // ── Check if current access token is still valid ────────────────────
  function isAuthenticated() {
    const auth = getAuth();
    if (!auth?.token) return false;
    const p = decodeToken(auth.token);
    return p && p.exp * 1000 > Date.now();
  }

  // ── Get a valid access token, refreshing transparently if close to expiry ──
  async function getToken() {
    const auth = getAuth();
    if (!auth?.token) return null;

    const p = decodeToken(auth.token);
    if (!p) return null;

    // If token expires in >5 min, return it as-is
    const msLeft = p.exp * 1000 - Date.now();
    if (msLeft > 5 * 60 * 1000) return auth.token;

    // Token about to expire — try to refresh
    if (!auth.refreshToken) return null;

    try {
      const res  = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: auth.refreshToken }),
      });

      if (!res.ok) { clearAuth(); return null; }

      const data = await res.json();
      setAuth(data);
      return data.token;
    } catch {
      // Network error — return existing token and let the server reject it
      return auth.token;
    }
  }

  // ── Authenticated fetch wrapper ──────────────────────────────────────
  async function apiFetch(path, options = {}) {
    const token = await getToken();
    if (!token) throw Object.assign(new Error('Not authenticated'), { status: 401 });

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...(options.headers ?? {}),
      },
    });

    // If 401 despite having a token, session is invalid — force logout
    if (res.status === 401) {
      clearAuth();
      window.location.href = 'auth.html';
      return;
    }

    return res;
  }

  // ── Guard a page: redirect to login if not authenticated ────────────
  function requireAuth() {
    if (!isAuthenticated()) {
      // Store the page they were trying to reach
      sessionStorage.setItem('vidyasetu_return_to', window.location.pathname);
      window.location.href = 'auth.html';
      return false;
    }
    return true;
  }

  // ── Populate all [data-user-*] elements in the DOM ──────────────────
  function populateUserInfo() {
    const auth = getAuth();
    if (!auth?.user) return;

    const { name, email, role } = auth.user;
    const initials = (name ?? email ?? '?')
      .split(' ')
      .map(w => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    // Sidebar elements used by the existing Mentora UI
    const elName   = document.getElementById('currentUser');
    const elAvatar = document.getElementById('userAvatar');
    if (elName)   elName.textContent   = name ?? email;
    if (elAvatar) elAvatar.textContent = initials;

    // Any element with data-user-name / data-user-email / data-user-role
    document.querySelectorAll('[data-user-name]').forEach(el => { el.textContent = name ?? ''; });
    document.querySelectorAll('[data-user-email]').forEach(el => { el.textContent = email ?? ''; });
    document.querySelectorAll('[data-user-role]').forEach(el => { el.textContent = role ?? ''; });

    // Show admin-only elements
    if (role === 'admin') {
      document.querySelectorAll('[data-admin-only]').forEach(el => {
        el.style.display = '';
      });
    }
  }

  // ── Sign out ─────────────────────────────────────────────────────────
  async function signOut() {
    const auth = getAuth();

    // Revoke refresh token server-side (best-effort)
    if (auth?.refreshToken) {
      try {
        const token = await getToken();
        await fetch(`${API_BASE}/api/auth/signout`, {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ refreshToken: auth.refreshToken }),
        });
      } catch { /* ignore — we clear locally regardless */ }
    }

    clearAuth();
    window.location.href = 'auth.html';
  }

  // ── Handle sign-in / sign-up response from the API ──────────────────
  function handleAuthResponse(data) {
    setAuth(data);
    populateUserInfo();
  }

  // ── Auto-setup on every page load ───────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    populateUserInfo();

    // Wire any [data-logout] button
    document.querySelectorAll('[data-logout]').forEach(btn => {
      btn.addEventListener('click', e => { e.preventDefault(); signOut(); });
    });
  });

  return {
    getAuth,
    setAuth,
    clearAuth,
    isAuthenticated,
    getToken,
    apiFetch,
    requireAuth,
    populateUserInfo,
    handleAuthResponse,
    signOut,
    API_BASE,
  };
})();
