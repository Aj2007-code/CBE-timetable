// Vercel serverless function: /api/chat
// Keeps the Groq API key on the server — the browser never sees it.
//
// Required env var (set in Vercel project settings → Environment Variables):
//   GROQ_API_KEY = the free key you get from console.groq.com
//
// Optional: GROQ_MODEL to override the default model (default: llama-3.3-70b-versatile).
//
// Frontend contract (unchanged): POST { messages: [{role, content}], context?: {...} }
// -> { reply: "..." }
//
// NEW: an optional `context` object can be sent from the frontend with live app
// data (current class, attendance %, HSS elective, day/time, etc). If present,
// it's woven into the system prompt so answers are grounded in real data instead
// of the model guessing or making things up.

const PRIMARY_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const FALLBACK_MODEL = 'llama-3.1-8b-instant'; // used only if the primary model call fails

function buildSystemPrompt(context) {
  let prompt = `You are the in-app assistant for a CBE (Chemical & Biochemical Engineering) 2nd-year student timetable app at IIT Patna.

Rules:
- Be direct and to the point. 1-3 sentences for most answers. Only go longer if the student explicitly asks for detail, a list, or steps.
- No filler openers like "Great question!" or "I'd be happy to help." Just answer.
- Plain text only — no markdown headers, no bullet-heavy formatting unless the answer is genuinely a list.
- If you don't know something (e.g. specific schedule data that wasn't given to you), say so plainly instead of guessing. Never invent class timings, room numbers, or attendance figures.
- Stay scoped to helping with the timetable app, courses, attendance, and general student queries. For unrelated requests, answer briefly and redirect if it seems off-topic for the app.`;

  if (context && typeof context === 'object') {
    const parts = [];
    if (context.currentClass) parts.push(`Current/next class: ${context.currentClass}`);
    if (context.day) parts.push(`Today: ${context.day}`);
    if (context.time) parts.push(`Current time: ${context.time}`);
    if (context.hss) parts.push(`Student's HSS elective: ${context.hss}`);
    if (context.attendance) parts.push(`Attendance summary: ${context.attendance}`);
    if (context.rollNumber) parts.push(`Student roll number: ${context.rollNumber}`);

    if (parts.length) {
      prompt += `\n\nLive context for this student right now (use this to answer accurately — do not contradict it):\n` + parts.map(p => `- ${p}`).join('\n');
    }
  }

  return prompt;
}

async function callGroq(apiKey, model, systemPrompt, trimmedMessages) {
  return fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...trimmedMessages],
      max_tokens: 400,
      temperature: 0.4,   // lower = more focused/factual, less rambly
      top_p: 0.9
    })
  });
}

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

  const trimmed = messages.slice(-12).map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content || '').slice(0, 4000)
  }));

  const systemPrompt = buildSystemPrompt(body && body.context);

  try {
    let upstream = await callGroq(apiKey, PRIMARY_MODEL, systemPrompt, trimmed);

    // If the primary model is rate-limited or unavailable, try the fallback once
    // instead of surfacing an error straight to the student.
    if (!upstream.ok && (upstream.status === 429 || upstream.status >= 500)) {
      upstream = await callGroq(apiKey, FALLBACK_MODEL, systemPrompt, trimmed);
    }

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
        ? data.choices[0].message.content.trim()
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