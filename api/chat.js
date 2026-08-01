// Vercel serverless function: /api/chat
// Keeps the Gemini API key on the server — the browser never sees it.
//
// Required env var (set in Vercel project settings → Environment Variables):
//   GEMINI_API_KEY = the free key you get from aistudio.google.com/apikey
//
// Optional: GEMINI_MODEL to override the default model (default: gemini-2.5-flash).

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server not configured: missing GEMINI_API_KEY' });
    return;
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  const messages = Array.isArray(body && body.messages) ? body.messages : [];
  if (!messages.length) {
    res.status(400).json({ error: 'No messages provided' });
    return;
  }

  // Keep the payload small and bounded: last 12 turns, 4000 chars each.
  // Gemini uses role "model" for the assistant side (not "assistant").
  const trimmed = messages.slice(-12).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(m.content || '').slice(0, 4000) }]
  }));

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [{
              text: 'You are a concise assistant embedded in an IIT Patna CBE student timetable app. Give short, direct, to-the-point answers — a few sentences at most unless the student explicitly asks for more detail or a list/steps. No filler, no long preambles, no unnecessary caveats. Plain text, not markdown headers.'
            }]
          },
          contents: trimmed,
          generationConfig: { maxOutputTokens: 400 }
        })
      }
    );

    if (!upstream.ok) {
      const errText = await upstream.text();
      res.status(upstream.status).json({ error: 'Upstream error', detail: errText.slice(0, 500) });
      return;
    }

    const data = await upstream.json();
    const reply =
      data &&
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0]
        ? data.candidates[0].content.parts[0].text
        : '';

    if (!reply) {
      res.status(200).json({ reply: "Hmm, I didn't get a clear answer for that — try rephrasing?" });
      return;
    }

    res.status(200).json({ reply });
  } catch (e) {
    res.status(500).json({ error: 'Request failed', detail: String((e && e.message) || e) });
  }
};