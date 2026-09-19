/* Diamond Club 99 — real API data layer. */
(function () {
  const isAdminArea = /\/admin\//.test(location.pathname.replace(/\\/g, '/'));
  const API = '/api';
  window.DC_DATA = window.DC_DATA || {};

  async function request(path, options = {}) {
    const res = await fetch(API + path, { credentials: 'same-origin', ...options });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!res.ok) throw { message: data?.error || `Request failed (${res.status})`, status: res.status };
    return data;
  }

  const endpoints = {
    members: '/admin/members',
    announcements: isAdminArea ? '/admin/announcements' : '/announcements',
    news: isAdminArea ? '/admin/news' : '/news',
    affirmations: isAdminArea ? '/admin/affirmations' : '/affirmations',
    projects: isAdminArea ? '/admin/projects' : '/projects',
    gallery: isAdminArea ? '/admin/gallery' : '/gallery',
    leadership: isAdminArea ? '/admin/leadership' : '/leadership',
    meetings: isAdminArea ? '/admin/meetings' : '/meetings'
  };

  function collection(entity) {
    return {
      async list() { return request(endpoints[entity]); },
      async get(id) { return request(`${endpoints[entity]}/${encodeURIComponent(id)}`); },
      async create(item) {
        return request(endpoints[entity], { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) });
      },
      async update(id, patch) {
        return request(`${endpoints[entity]}/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      },
      async remove(id) {
        await request(`${endpoints[entity]}/${encodeURIComponent(id)}`, { method: 'DELETE' });
        return true;
      }
    };
  }

  const gallery = {
    async list() { return request(endpoints.gallery); },
    async get(id) { return request(`${endpoints.gallery}/${encodeURIComponent(id)}`); },
    async create(item) {
      if (item?.file instanceof File) {
        const fd = new FormData();
        fd.append('image', item.file);
        fd.append('caption', item.caption || '');
        fd.append('category', item.category || 'Uncategorized');
        fd.append('published', String(item.published !== false));
        fd.append('isPublic', String(item.isPublic === true));
        return request('/admin/gallery/upload', { method: 'POST', body: fd });
      }
      return request('/admin/gallery', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) });
    },
    async update(id, patch) {
      if (patch?.file instanceof File) {
        const fd = new FormData();
        fd.append('image', patch.file);
        fd.append('caption', patch.caption || '');
        fd.append('category', patch.category || 'Uncategorized');
        fd.append('published', String(patch.published !== false));
        fd.append('isPublic', String(patch.isPublic === true));
        return request(`/admin/gallery/${encodeURIComponent(id)}`, { method: 'PATCH', body: fd });
      }
      return request(`/admin/gallery/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
    },
    async remove(id) { await request(`/admin/gallery/${encodeURIComponent(id)}`, { method: 'DELETE' }); return true; }
  };

  const president = {
    async get() { return request(isAdminArea ? '/admin/president' : '/president'); },
    async update(patch) { return request('/admin/president', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }); }
  };
  const settings = {
    async get() { return request(isAdminArea ? '/admin/settings' : '/settings'); },
    async update(patch) { return request('/admin/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }); }
  };
  const activity = {
    async list() { return request('/admin/activity'); },
    async log() { return true; } // Server records admin mutations automatically.
  };

  const DCStore = {
    members: collection('members'),
    announcements: collection('announcements'),
    news: collection('news'),
    affirmations: collection('affirmations'),
    projects: collection('projects'),
    gallery,
    leadership: collection('leadership'),
    meetings: collection('meetings'),
    president,
    settings,
    activity,
    ready: Promise.resolve()
  };

  async function loadLiveMemberData() {
    if (isAdminArea) return;
    const [member, announcements, news, affirmations, projects, galleryItems, leadership, meetings, president] = await Promise.all([
      request('/members/me'), request('/announcements'), request('/news'), request('/affirmations'),
      request('/projects'), request('/gallery'), request('/leadership'), request('/meetings'), request('/president')
    ]);
    window.DC_DATA.currentMember = member;
    window.DC_DATA.announcements = announcements;
    window.DC_DATA.news = news;
    window.DC_DATA.projects = projects;
    window.DC_DATA.gallery = galleryItems;
    window.DC_DATA.leadership = leadership;
    window.DC_DATA.meetings = meetings;
    window.DC_DATA.president = president;
    window.DC_DATA.dailyAffirmation = affirmations[0] || null;
    window.dispatchEvent(new CustomEvent('dc:data-ready'));
  }

  DCStore.ready = loadLiveMemberData().catch(err => {
    console.error(err);
    window.dispatchEvent(new CustomEvent('dc:data-error', { detail: err }));
    throw err;
  });

  window.DCStore = DCStore;
})();
