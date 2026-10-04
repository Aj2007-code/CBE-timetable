module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).end(); return; }
  const url = process.env.SESSION_LOG_URL;
  if (!url) { res.status(204).end(); return; }   

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
  } catch (e) { }
  res.status(204).end();
};
