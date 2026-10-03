// POST /api/session-log  -> forwards the body to the Google Apps Script web app.
// Env var: SESSION_LOG_URL  (the https://script.google.com/macros/s/.../exec URL)

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).end(); return; }
  const url = process.env.SESSION_LOG_URL;
  if (!url) { res.status(204).end(); return; }   // not configured -> silently skip

  let body = req.body;
  if (body == null) body = '';
  else if (typeof body !== 'string') body = JSON.stringify(body);
  if (body.length > 20000) { res.status(413).end(); return; }

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body,
    });
  } catch (e) { /* logging is best-effort */ }
  res.status(204).end();
};
