// Supabase proxy. The browser calls /api/sb/rest/v1/<table>?...
// vercel.json rewrites that to /api/sb?__p=rest/v1/<table>&...
// and this function forwards it to Supabase with the key added server-side,
// so the project URL and key never appear in the page or the Network tab.
//
// Env vars: SUPABASE_URL, SUPABASE_ANON_KEY
// Writes to admin-only tables also require a valid x-admin-token.

const { requireAdmin } = require('./_adminAuth');

const TABLES = {
  cbe_attendance:             { methods: ['GET', 'POST'] },
  cbe_attendance_backups:     { methods: ['GET', 'POST'] },
  cbe_hss:                    { methods: ['GET', 'POST'] },
  cbe_day_overrides:          { methods: ['GET', 'POST'] },
  cbe_settings:               { methods: ['GET', 'POST'] },
  cbe_announcement_reactions: { methods: ['GET', 'POST', 'PATCH', 'DELETE'] },
  cbe_pyq_files:              { methods: ['GET'] },
  cbe_reference_books:        { methods: ['GET'] },
  cbe_announcements:          { methods: ['GET', 'POST', 'DELETE'], adminWrite: true },
  cbe_global_overrides:       { methods: ['GET', 'POST'],           adminWrite: true },
  cbe_course_names:           { methods: ['GET', 'POST'],           adminWrite: true },
};
const BUCKETS = ['pyq', 'books'];

function readBody(req) {
  if (req.body == null) return undefined;
  if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) return req.body;
  return JSON.stringify(req.body);
}

module.exports = async (req, res) => {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!base || !key) { res.status(500).json({ error: 'Server not configured' }); return; }

  // The path comes from the rewrite (__p). Vercel may also tack extra routing
  // params onto the query, so only real PostgREST params are forwarded.
  const q = Object.assign({}, req.query || {});
  let p = q.__p != null ? q.__p : q.path;
  if (p == null) p = String(req.url || '').split('?')[0].replace(/^\/api\/sb\/?/, '');
  if (Array.isArray(p)) p = p.join('/');
  p = decodeURIComponent(String(p || ''));

  const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns', 'and', 'or', 'not']);
  const OPVAL = /^(not\.)?(eq|neq|gt|gte|lt|lte|like|ilike|match|imatch|in|is|isdistinct|cs|cd|ov|sl|sr|nxr|nxl|adj|fts|plfts|phfts|wfts)[.(]/;
  const sp = new URLSearchParams();
  Object.keys(q).forEach(k => {
    [].concat(q[k]).forEach(v => {
      if (RESERVED.has(k) || OPVAL.test(String(v))) sp.append(k, v);
    });
  });
  const qs = sp.toString() ? '?' + sp.toString() : '';

  const segs = p.split('/').filter(Boolean);
  if (segs.some(s => s === '..' || s === '.')) { res.status(400).json({ error: 'Bad path' }); return; }

  // public file downloads -> redirect to the public bucket URL
  if (segs[0] === 'storage' && segs[1] === 'v1' && segs[2] === 'object' &&
      segs[3] === 'public' && BUCKETS.includes(segs[4]) && req.method === 'GET') {
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.redirect(302, `${base}/${segs.map(encodeURIComponent).join('/')}`);
    return;
  }

  if (!(segs[0] === 'rest' && segs[1] === 'v1' && segs.length === 3)) {
    res.status(404).json({ error: 'Not found' }); return;
  }
  const rule = TABLES[segs[2]];
  if (!rule || !rule.methods.includes(req.method)) { res.status(403).json({ error: 'Not allowed' }); return; }
  if (rule.adminWrite && req.method !== 'GET' && !requireAdmin(req)) {
    res.status(401).json({ error: 'Admin session required' }); return;
  }

  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  if (req.headers.prefer) headers.Prefer = req.headers.prefer;

  try {
    const upstream = await fetch(`${base}/rest/v1/${segs[2]}${qs}`, {
      method: req.method, headers,
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
