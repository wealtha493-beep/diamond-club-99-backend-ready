import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !JWT_SECRET) {
  console.error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or JWT_SECRET. Copy .env.example to .env and fill them in.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 25, standardHeaders: true, legacyHeaders: false });
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype))
});

const tables = {
  members: { table: 'members', adminOnly: true, memberVisible: false, fields: ['member_id','full_name','email','phone','photo','date_joined','status','account_enabled','address','branch','dues_status','dues_note'] },
  announcements: { table: 'announcements', fields: ['title','category','date','image','excerpt','body','published'] },
  news: { table: 'news', fields: ['title','category','date','image','excerpt','body','published'] },
  affirmations: { table: 'affirmations', fields: ['text','date','active'] },
  projects: { table: 'projects', fields: ['title','status','date','image','description','published'] },
  leadership: { table: 'leadership', fields: ['name','position','photo','description','tenure','display_order','active'] },
  meetings: { table: 'meetings', fields: ['status','title','date','time','location','type','notice','published'] }
};

function cookieOptions(remember = false) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: remember ? 1000 * 60 * 60 * 24 * 30 : undefined
  };
}

function signSession(user) {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email, memberId: user.memberId || null }, JWT_SECRET, { expiresIn: '30d' });
}

function readSession(req) {
  const token = req.cookies.dc_session;
  if (!token) return null;
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

function requireRole(role) {
  return (req, res, next) => {
    const session = readSession(req);
    if (!session || session.role !== role) return res.status(401).json({ error: 'Authentication required.' });
    req.session = session;
    next();
  };
}

function cleanPayload(body, fields) {
  const aliases = { memberId: 'member_id', fullName: 'full_name', dateJoined: 'date_joined', accountEnabled: 'account_enabled', duesStatus: 'dues_status', duesNote: 'dues_note', displayOrder: 'display_order' };
  const out = {};
  for (const key of Object.keys(body || {})) {
    const f = aliases[key] || key;
    if (fields.includes(f)) out[f] = body[key] === '' ? null : body[key];
  }
  return out;
}

function publicMember(row) {
  return {
    id: row.member_id,
    fullName: row.full_name,
    email: row.email || '',
    phone: row.phone || '',
    photo: row.photo || '../assets/images/placeholders/member-self.svg',
    dateJoined: row.date_joined || '',
    membershipStatus: row.status,
    accountEnabled: row.account_enabled,
    address: row.address || '',
    branch: row.branch || '',
    duesStatus: row.dues_status || '',
    duesNote: row.dues_note || '',
    initials: row.full_name.split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase()
  };
}

async function db(table, action, args = {}) {
  let q = supabase.from(table);
  if (action === 'list') q = q.select('*').order(args.order || 'created_at', { ascending: args.ascending ?? false });
  if (action === 'get') q = q.select('*').eq('id', args.id).maybeSingle();
  if (action === 'insert') q = q.insert(args.data).select('*').single();
  if (action === 'update') q = q.update({ ...args.data, updated_at: new Date().toISOString() }).eq('id', args.id).select('*').single();
  if (action === 'delete') q = q.delete().eq('id', args.id);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

async function logActivity(req, action, item = '') {
  try {
    await supabase.from('activity').insert({ action, item, admin_email: req.session?.email || 'System' });
  } catch (e) { console.warn('Activity log failed:', e.message); }
}

async function ensureAdmin() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!email || !password || password === 'change-this-before-production') {
    console.warn('ADMIN_EMAIL/ADMIN_PASSWORD not configured for first-admin bootstrap.');
    return;
  }
  const { data, error } = await supabase.from('admins').select('id').eq('email', email).maybeSingle();
  if (error) throw error;
  if (!data) {
    const password_hash = await bcrypt.hash(password, 12);
    const { error: insertError } = await supabase.from('admins').insert({ email, password_hash });
    if (insertError) throw insertError;
    console.log(`Created initial admin: ${email}`);
  }
}

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'diamond-club-99-backend' }));

app.post('/api/auth/admin/login', loginLimiter, async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const { data, error } = await supabase.from('admins').select('*').eq('email', email).maybeSingle();
    if (error) throw error;
    if (!data || !(await bcrypt.compare(password, data.password_hash))) return res.status(401).json({ error: 'Invalid administrator email or password.' });
    const token = signSession({ id: data.id, role: 'admin', email: data.email });
    res.cookie('dc_session', token, cookieOptions(Boolean(req.body.remember)));
    res.json({ ok: true, user: { email: data.email, role: 'admin' } });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Login failed.' }); }
});

app.post('/api/auth/member/login', loginLimiter, async (req, res) => {
  try {
    const identifier = String(req.body.memberId || '').trim();
    const password = String(req.body.password || '');
    const { data, error } = await supabase.from('members').select('*').or(`member_id.eq.${identifier},email.eq.${identifier}`).maybeSingle();
    if (error) throw error;
    if (!data || !data.account_enabled || data.status !== 'Active' || !data.password_hash || !(await bcrypt.compare(password, data.password_hash))) return res.status(401).json({ error: 'Invalid member ID or password.' });
    const token = signSession({ id: data.id, role: 'member', email: data.email || '', memberId: data.member_id });
    res.cookie('dc_session', token, cookieOptions(Boolean(req.body.remember)));
    res.json({ ok: true, user: publicMember(data), role: 'member' });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Login failed.' }); }
});

app.post('/api/auth/logout', (_req, res) => { res.clearCookie('dc_session', cookieOptions()); res.json({ ok: true }); });

app.get('/api/auth/me', async (req, res) => {
  const s = readSession(req);
  if (!s) return res.status(401).json({ error: 'Not authenticated.' });
  if (s.role === 'admin') {
    const { data } = await supabase.from('admins').select('id,email,role').eq('id', s.sub).maybeSingle();
    if (!data) return res.status(401).json({ error: 'Session expired.' });
    return res.json({ user: data });
  }
  const { data } = await supabase.from('members').select('*').eq('id', s.sub).maybeSingle();
  if (!data || !data.account_enabled || data.status !== 'Active') return res.status(401).json({ error: 'Account unavailable.' });
  return res.json({ user: publicMember(data), role: 'member' });
});

app.get('/api/members/me', requireRole('member'), async (req, res) => {
  const { data, error } = await supabase.from('members').select('*').eq('id', req.session.sub).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Member not found.' });
  res.json(publicMember(data));
});

app.get('/api/settings', requireRole('member'), async (_req, res) => {
  const { data, error } = await supabase.from('settings').select('*').eq('id', 1).single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ clubName: data.club_name, motto: data.motto, contactEmail: data.contact_email, contactPhone: data.contact_phone });
});

// Member-readable content: only published/active records are returned.
for (const [entity, cfg] of Object.entries(tables)) {
  if (entity === 'members') continue;
  app.get(`/api/${entity}`, requireRole('member'), async (_req, res) => {
    try {
      const order = entity === 'leadership' ? 'display_order' : (entity === 'affirmations' ? 'date' : 'created_at');
      const { data, error } = await supabase.from(cfg.table).select('*').order(order, { ascending: entity === 'leadership' });
      if (error) throw error;
      let rows = data || [];
      if (entity === 'affirmations') rows = rows.filter(x => x.active);
      else if (entity === 'leadership') rows = rows.filter(x => x.active);
      else rows = rows.filter(x => x.published !== false);
      if (entity === 'members') rows = [];
      if (entity === 'leadership') rows = rows.map(x => ({ ...x, id: x.id, order: x.display_order }));
      if (entity === 'gallery') {
        rows = await Promise.all(rows.map(async x => {
          const { data: signed } = await supabase.storage.from('club-gallery').createSignedUrl(x.image_path, 24 * 60 * 60);
          return { id: x.id, category: x.category || 'Uncategorized', caption: x.caption, image: signed?.signedUrl || '', published: x.published };
        }));
      }
      if (entity === 'announcements' || entity === 'news') rows = rows.map(x => ({ ...x, id: x.id }));
      if (entity === 'projects') rows = rows.map(x => ({ ...x, id: x.id }));
      if (entity === 'meetings') rows = rows.map(x => ({ ...x, id: x.id }));
      if (entity === 'affirmations') rows = rows.map(x => ({ id: x.id, text: x.text, date: x.date, active: x.active }));
      res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
}

app.get('/api/gallery', requireRole('member'), async (_req, res) => {
  try {
    const { data, error } = await supabase.from('gallery').select('*').eq('published', true).order('created_at', { ascending: false });
    if (error) throw error;
    const rows = await Promise.all((data || []).map(async x => {
      const { data: signed } = await supabase.storage.from('club-gallery').createSignedUrl(x.image_path, 24 * 60 * 60);
      return { id: x.id, category: x.category || 'Uncategorized', caption: x.caption, image: signed?.signedUrl || '', published: x.published };
    }));
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/gallery', requireRole('admin'), async (_req, res) => {
  try {
    const { data, error } = await supabase.from('gallery').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    const rows = await Promise.all((data || []).map(async x => {
      const { data: signed } = await supabase.storage.from('club-gallery').createSignedUrl(x.image_path, 24 * 60 * 60);
      return { id: x.id, category: x.category || 'Uncategorized', caption: x.caption, image: signed?.signedUrl || '', published: x.published };
    }));
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/president', requireRole('member'), async (_req, res) => {
  const { data, error } = await supabase.from('president').select('*').eq('id', 1).single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/api/admin/activity', requireRole('admin'), async (_req, res) => {
  const { data, error } = await supabase.from('activity').select('*').order('created_at', { ascending: false }).limit(100);
  if (error) return res.status(500).json({ error: error.message });
  res.json((data || []).map(x => ({ id: x.id, action: x.action, item: x.item, admin: x.admin_email, timestamp: new Date(x.created_at).getTime() })));
});

app.get('/api/admin/:entity', requireRole('admin'), async (req, res) => {
  const cfg = tables[req.params.entity];
  if (!cfg) return res.status(404).json({ error: 'Unknown collection.' });
  const { data, error } = await supabase.from(cfg.table).select('*').order(req.params.entity === 'leadership' ? 'display_order' : 'created_at', { ascending: req.params.entity === 'leadership' });
  if (error) return res.status(500).json({ error: error.message });
  if (req.params.entity === 'members') return res.json((data || []).map(publicMember));
  if (req.params.entity === 'leadership') return res.json((data || []).map(x => ({ ...x, order: x.display_order })));
  res.json(data || []);
});

app.post('/api/admin/:entity', requireRole('admin'), async (req, res) => {
  const entity = req.params.entity;
  const cfg = tables[entity];
  if (!cfg) return res.status(404).json({ error: 'Unknown collection.' });
  try {
    const payload = cleanPayload(req.body, cfg.fields);
    if (entity === 'members') {
      if (!payload.member_id || !payload.full_name || !req.body.password) return res.status(400).json({ error: 'Member ID, full name and password are required.' });
      payload.password_hash = await bcrypt.hash(String(req.body.password), 12);
      const { data, error } = await supabase.from('members').insert(payload).select('*').single();
      if (error) throw error;
      await logActivity(req, 'added member', data.full_name);
      return res.status(201).json(publicMember(data));
    }
    if (entity === 'leadership') payload.display_order = Number(req.body.order ?? req.body.display_order ?? 0);
    const { data, error } = await supabase.from(cfg.table).insert(payload).select('*').single();
    if (error) throw error;
    await logActivity(req, `created ${entity}`, data.title || data.caption || data.name || '');
    res.status(201).json(entity === 'leadership' ? { ...data, order: data.display_order } : data);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.patch('/api/admin/:entity/:id', requireRole('admin'), async (req, res) => {
  const entity = req.params.entity;
  const cfg = tables[entity];
  if (!cfg) return res.status(404).json({ error: 'Unknown collection.' });
  try {
    const payload = cleanPayload(req.body, cfg.fields);
    if (entity === 'members' && req.body.password) payload.password_hash = await bcrypt.hash(String(req.body.password), 12);
    if (entity === 'leadership' && Object.prototype.hasOwnProperty.call(req.body, 'order')) payload.display_order = Number(req.body.order);
    const keyColumn = entity === 'members' ? 'member_id' : 'id';
    const { data, error } = await supabase.from(cfg.table).update({ ...payload, updated_at: new Date().toISOString() }).eq(keyColumn, req.params.id).select('*').single();
    if (error) throw error;
    await logActivity(req, `updated ${entity}`, data.title || data.caption || data.name || data.full_name || '');
    res.json(entity === 'members' ? publicMember(data) : (entity === 'leadership' ? { ...data, order: data.display_order } : data));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/admin/:entity/:id', requireRole('admin'), async (req, res) => {
  const entity = req.params.entity;
  const cfg = tables[entity];
  if (!cfg) return res.status(404).json({ error: 'Unknown collection.' });
  try {
    if (entity === 'gallery') {
      const { data: item } = await supabase.from('gallery').select('image_path,caption').eq('id', req.params.id).maybeSingle();
      if (item?.image_path) await supabase.storage.from('club-gallery').remove([item.image_path]);
    }
    const keyColumn = entity === 'members' ? 'member_id' : 'id';
    const { error } = await supabase.from(cfg.table).delete().eq(keyColumn, req.params.id);
    if (error) throw error;
    await logActivity(req, `deleted ${entity}`, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/admin/president', requireRole('admin'), async (_req, res) => {
  const { data, error } = await supabase.from('president').select('*').eq('id', 1).single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
app.patch('/api/admin/president', requireRole('admin'), async (req, res) => {
  const payload = cleanPayload(req.body, ['name','position','photo','description','tenure']);
  const { data, error } = await supabase.from('president').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', 1).select('*').single();
  if (error) return res.status(400).json({ error: error.message });
  await logActivity(req, 'updated President information', data.name || '');
  res.json(data);
});

app.get('/api/admin/settings', requireRole('admin'), async (_req, res) => {
  const { data, error } = await supabase.from('settings').select('*').eq('id', 1).single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ clubName: data.club_name, motto: data.motto, contactEmail: data.contact_email, contactPhone: data.contact_phone });
});
app.patch('/api/admin/settings', requireRole('admin'), async (req, res) => {
  const p = req.body || {};
  const { data, error } = await supabase.from('settings').update({ club_name: p.clubName, motto: p.motto, contact_email: p.contactEmail, contact_phone: p.contactPhone, updated_at: new Date().toISOString() }).eq('id', 1).select('*').single();
  if (error) return res.status(400).json({ error: error.message });
  await logActivity(req, 'updated club settings', '');
  res.json({ clubName: data.club_name, motto: data.motto, contactEmail: data.contact_email, contactPhone: data.contact_phone });
});

app.post('/api/admin/gallery/upload', requireRole('admin'), upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Please choose an image.' });
    const caption = String(req.body.caption || '').trim();
    if (!caption) return res.status(400).json({ error: 'Caption is required.' });
    const ext = req.file.mimetype.split('/')[1].replace('jpeg','jpg');
    const filePath = `gallery/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('club-gallery').upload(filePath, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
    if (uploadError) throw uploadError;
    const row = { caption, category: String(req.body.category || 'Uncategorized').trim(), published: req.body.published !== 'false', image_path: filePath };
    const { data, error } = await supabase.from('gallery').insert(row).select('*').single();
    if (error) throw error;
    const { data: signed } = await supabase.storage.from('club-gallery').createSignedUrl(filePath, 24 * 60 * 60);
    await logActivity(req, 'uploaded gallery image', row.caption);
    res.status(201).json({ id: data.id, caption: data.caption, category: data.category, published: data.published, image: signed?.signedUrl || '' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.patch('/api/admin/gallery/:id', requireRole('admin'), upload.single('image'), async (req, res) => {
  try {
    const { data: current, error: currentError } = await supabase.from('gallery').select('*').eq('id', req.params.id).single();
    if (currentError) throw currentError;
    let imagePath = current.image_path;
    if (req.file) {
      const ext = req.file.mimetype.split('/')[1].replace('jpeg','jpg');
      imagePath = `gallery/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('club-gallery').upload(imagePath, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
      if (uploadError) throw uploadError;
      if (current.image_path) await supabase.storage.from('club-gallery').remove([current.image_path]);
    }
    const patch = { caption: String(req.body.caption ?? current.caption).trim(), category: String(req.body.category ?? current.category ?? '').trim(), published: req.body.published === undefined ? current.published : req.body.published !== 'false', image_path: imagePath, updated_at: new Date().toISOString() };
    const { data, error } = await supabase.from('gallery').update(patch).eq('id', req.params.id).select('*').single();
    if (error) throw error;
    const { data: signed } = await supabase.storage.from('club-gallery').createSignedUrl(imagePath, 24 * 60 * 60);
    await logActivity(req, 'updated gallery image', data.caption);
    res.json({ id: data.id, caption: data.caption, category: data.category, published: data.published, image: signed?.signedUrl || '' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Support message endpoint (stores activity only; email integration can be added later).
app.post('/api/support', requireRole('member'), async (req, res) => {
  const subject = String(req.body.subject || '').trim();
  const message = String(req.body.message || '').trim();
  if (!subject || !message) return res.status(400).json({ error: 'Subject and message are required.' });
  try {
    await supabase.from('activity').insert({ action: 'member support request', item: `${subject}: ${message.slice(0, 160)}`, admin_email: req.session.email || req.session.memberId });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Protect the HTML shells server-side as well as in the browser.
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  const normalized = req.path.replace(/\\/g, '/');
  if (normalized.startsWith('/admin/') && normalized.endsWith('.html') && !normalized.endsWith('/login.html')) {
    const s = readSession(req);
    if (!s || s.role !== 'admin') return res.redirect('/admin/login.html');
  }
  if (normalized.startsWith('/members/') && normalized.endsWith('.html') && !normalized.endsWith('/login.html') && !normalized.endsWith('/forgot-password.html')) {
    const s = readSession(req);
    if (!s || s.role !== 'member') return res.redirect('/members/login.html');
  }
  next();
});

app.use(express.static(ROOT, { extensions: ['html'] }));
app.get('/', (_req, res) => res.sendFile(path.join(ROOT, 'diamond-club.html')));
app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: 'Server error.' }); });

await ensureAdmin();
app.listen(PORT, () => console.log(`Diamond Club server running on port ${PORT}`));
