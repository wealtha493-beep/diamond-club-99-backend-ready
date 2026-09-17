/* Diamond Club 99 — secure administrator authentication client. */
(function () {
  const SESSION_KEY = 'dc_admin_user';
  let cached = null;
  try { cached = JSON.parse(sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY) || 'null'); } catch {}

  async function api(path, options = {}) {
    const res = await fetch('/api' + path, { credentials: 'same-origin', ...options });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw { message: data.error || 'Request failed.' };
    return data;
  }
  function save(user, remember) {
    cached = user;
    const raw = JSON.stringify(user);
    if (remember) { localStorage.setItem(SESSION_KEY, raw); sessionStorage.removeItem(SESSION_KEY); }
    else { sessionStorage.setItem(SESSION_KEY, raw); localStorage.removeItem(SESSION_KEY); }
  }
  function clear() { cached = null; sessionStorage.removeItem(SESSION_KEY); localStorage.removeItem(SESSION_KEY); }

  const DCAdminAuth = {
    isAuthenticated() { return !!cached; },
    currentSession() { return cached || { email: 'Administrator', role: 'admin' }; },
    async login(email, password, remember) {
      const data = await api('/auth/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, remember }) });
      save(data.user, remember);
      return data;
    },
    async validate() {
      try { const data = await api('/auth/me'); if (data.user?.role !== 'admin' && data.role !== 'admin') throw new Error(); save(data.user, true); return data.user; }
      catch { clear(); return null; }
    },
    async logout() { try { await api('/auth/logout', { method: 'POST' }); } finally { clear(); } },
    requireAdminAuth() {
      if (!cached) { location.replace('login.html'); return; }
      this.validate().then(user => { if (!user) location.replace('login.html'); });
    }
  };
  window.DCAdminAuth = DCAdminAuth;
})();
