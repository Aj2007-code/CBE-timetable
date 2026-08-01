// Vercel serverless function: /api/chat
// Keeps the Groq API key on the server — the browser never sees it.
//
// Required env var (set in Vercel project settings → Environment Variables):
//   GROQ_API_KEY = the free key you get from console.groq.com
//
// Optional: GROQ_MODEL to override the default model (default: llama-3.3-70b-versatile).

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server not configured: missing GROQ_API_KEY' });
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

  // Groq uses OpenAI-style chat format: role is "user" or "assistant" directly.
  // Keep the payload small and bounded: last 12 turns, 4000 chars each.
  const trimmed = messages.slice(-12).map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content || '').slice(0, 4000)
  }));

  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  try {
    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content:
              'You are a concise assistant embedded in an IIT Patna CBE student timetable app. Give short, direct, to-the-point answers — a few sentences at most unless the student explicitly asks for more detail or a list/steps. No filler, no long preambles, no unnecessary caveats. Plain text, not markdown headers.'
          },
          ...trimmed
        ],
        max_tokens: 400
      })
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      res.status(upstream.status).json({ error: 'Upstream error', detail: errText.slice(0, 500) });
      return;
    }

    const data = await upstream.json();
    const reply =
      data &&
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content
        ? data.choices[0].message.content
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
