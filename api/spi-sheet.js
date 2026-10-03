// POST /api/spi-sheet  -> forwards the SPI result to the Google Apps Script web app.
// Env var: SPI_SHEET_URL

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ ok: false }); return; }
  const url = process.env.SPI_SHEET_URL;
  if (!url) { res.status(500).json({ ok: false, error: 'Server not configured' }); return; }

  let body = req.body;
  if (typeof body !== 'string') body = JSON.stringify(body || {});
  if (body.length > 20000) { res.status(413).json({ ok: false }); return; }

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    res.status(r.ok ? 200 : 502).json({ ok: r.ok });
  } catch (e) {
    res.status(502).json({ ok: false });
  }
};
