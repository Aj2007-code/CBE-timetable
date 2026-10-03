// Supabase proxy. The browser calls /api/sb/rest/v1/<table>?... and this
// function forwards it to Supabase with the key added server-side, so the
// project URL and key never appear in the page, script.js, or Network tab.
//
// Env vars (Vercel -> Project Settings -> Environment Variables):
//   SUPABASE_URL        e.g. https://xxxx.supabase.co
//   SUPABASE_ANON_KEY   the anon/public key
//
// Writes to admin-only tables also require a valid x-admin-token.

const { requireAdmin } = require('../_adminAuth');

// Tables the frontend is allowed to touch, and what is allowed on each.
const TABLES = {
  cbe_attendance:             { methods: ['GET', 'POST'] },
  cbe_attendance_backups:     { methods: ['GET', 'POST'] },
  cbe_hss:                    { methods: ['GET', 'POST'] },
  cbe_day_overrides:          { methods: ['GET', 'POST'] },
  cbe_settings:               { methods: ['GET', 'POST'] },
  cbe_announcement_reactions: { methods: ['GET', 'POST', 'PATCH', 'DELETE'] },
  cbe_pyq_files:              { methods: ['GET'] },
  cbe_reference_books:        { methods: ['GET'] },
  // admin-only writes (anyone can read)
  cbe_announcements:          { methods: ['GET', 'POST', 'DELETE'], adminWrite: true },
  cbe_global_overrides:       { methods: ['GET', 'POST'],           adminWrite: true },
  cbe_course_names:           { methods: ['GET', 'POST'],           adminWrite: true },
};

const BUCKETS = ['pyq', 'books'];

function readBody(req) {
  if (req.body == null) return undefined;
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body;
  return JSON.stringify(req.body);
}

module.exports = async (req, res) => {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!base || !key) {
    res.status(500).json({ error: 'Server not configured' });
    return;
  }

  // "/api/sb/rest/v1/cbe_attendance?roll=eq.X" -> "rest/v1/cbe_attendance", "roll=eq.X"
  const raw = req.url || '';
  const qIdx = raw.indexOf('?');
  const pathPart = (qIdx === -1 ? raw : raw.slice(0, qIdx)).replace(/^\/api\/sb\/?/, '');
  const query = qIdx === -1 ? '' : raw.slice(qIdx);
  const segs = pathPart.split('/').filter(Boolean);

  if (segs.some(s => s === '..' || s === '.')) {
    res.status(400).json({ error: 'Bad path' });
    return;
  }

  // ---- public file downloads: redirect to the public bucket URL ----
  // (redirect instead of streaming so big PDFs aren't limited by the
  //  serverless response size)
  if (segs[0] === 'storage' && segs[1] === 'v1' && segs[2] === 'object' &&
      segs[3] === 'public' && BUCKETS.includes(segs[4]) && req.method === 'GET') {
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.redirect(302, `${base}/${segs.join('/')}`);
    return;
  }

  // ---- database REST ----
  if (!(segs[0] === 'rest' && segs[1] === 'v1' && segs.length === 3)) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const rule = TABLES[segs[2]];
  if (!rule || !rule.methods.includes(req.method)) {
    res.status(403).json({ error: 'Not allowed' });
    return;
  }
  if (rule.adminWrite && req.method !== 'GET' && !requireAdmin(req)) {
    res.status(401).json({ error: 'Admin session required' });
    return;
  }

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
  if (req.headers.prefer) headers.Prefer = req.headers.prefer;

  try {
    const upstream = await fetch(`${base}/rest/v1/${segs[2]}${query}`, {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'DELETE' ? undefined : readBody(req),
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.send(text);
  } catch (e) {
    res.status(502).json({ error: 'Upstream error' });
  }
};
