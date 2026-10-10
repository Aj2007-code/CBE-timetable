const crypto = require('crypto');
const { ADMIN_ROLL } = require('./_adminAuth');

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

const attempts = new Map();

function tooManyAttempts(ip) {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now - rec.first > WINDOW_MS) {
    attempts.set(ip, { count: 1, first: now });
    return false;
  }
  rec.count++;
  return rec.count > MAX_ATTEMPTS;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown')
    .split(',')[0].trim();
  if (tooManyAttempts(ip)) {
    res.status(429).json({ ok: false, error: 'Too many attempts. Try again later.' });
    return;
  }

  const { roll, password } = req.body || {};

  if (!roll || String(roll).toUpperCase() !== ADMIN_ROLL || !password) {
    res.status(401).json({ ok: false, error: 'Invalid credentials' });
    return;
  }

  const expected = process.env.ADMIN_PASSWORD || '';
  if (!expected) {
    res.status(500).json({ ok: false, error: 'Server not configured' });
    return;
  }

  const a = Buffer.from(String(password));
  const b = Buffer.from(expected);
  const match = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!match) {
    res.status(401).json({ ok: false, error: 'Invalid credentials' });
    return;
  }

  const secret = process.env.ADMIN_TOKEN_SECRET || expected;
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = `${ADMIN_ROLL}.${expiresAt}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const token = Buffer.from(`${payload}.${sig}`).toString('base64');

  res.status(200).json({ ok: true, token, expiresAt });
};
