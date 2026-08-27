// Shared helper — import this into any /api/*.js endpoint that should be
// admin-only (pyq-admin.js, books-admin.js, etc).
//
// const { requireAdmin } = require('./_adminAuth');
// ...inside your handler, before doing anything else:
//   if (!requireAdmin(req)) {
//     res.status(401).json({ ok:false, error: 'Admin session required' });
//     return;
//   }

const crypto = require('crypto');

const ADMIN_ROLL = "2501CB23";

function verifyAdminToken(token) {
  if (!token) return false;
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const parts = decoded.split('.');
    if (parts.length !== 3) return false;
    const [roll, expiresAtStr, sig] = parts;
    if (roll !== ADMIN_ROLL) return false;

    const expiresAt = Number(expiresAtStr);
    if (!expiresAt || Date.now() > expiresAt) return false;

    const secret = process.env.ADMIN_TOKEN_SECRET || process.env.ADMIN_PASSWORD;
    if (!secret) return false;
    const payload = `${roll}.${expiresAtStr}`;
    const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (e) {
    return false;
  }
}

// Reads the token from the standard place the frontend sends it
// (x-admin-token header) and validates it.
function requireAdmin(req) {
  const token = req.headers['x-admin-token'];
  return verifyAdminToken(token);
}

module.exports = { verifyAdminToken, requireAdmin, ADMIN_ROLL };
