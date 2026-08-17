const { createClient } = require('@supabase/supabase-js');

const PRIMARY_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const FALLBACK_MODEL = 'openai/gpt-oss-20b';

let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function buildSystemPrompt(context, references) {
  let prompt = `You are the in-app assistant for a CBE (Chemical & Biochemical Engineering) 2nd-year student timetable app at IIT Patna.

Rules:
- Be direct and to the point. 1-3 sentences for most answers. Only go longer if the student explicitly asks for detail, a list, or steps.
- No filler openers like "Great question!" or "I'd be happy to help." Just answer.
- Plain text only — no markdown headers, no bullet-heavy formatting unless the answer is genuinely a list.
- If you don't know something (e.g. specific schedule data that wasn't given to you), say so plainly instead of guessing. Never invent class timings, room numbers, or attendance figures.
- You are not limited to app/timetable topics. Answer any question the student asks — coursework, general knowledge, advice, whatever — like a knowledgeable, helpful general assistant. Only nudge back on-topic if the question is actually about the app itself and you're missing the data to answer it.`;

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

  if (references && references.length) {
    prompt += `\n\nRelevant answers from previous student conversations (reuse if they genuinely apply; prefer live context above if they conflict; don't mention that this came from "previous conversations" — just answer naturally):\n` +
      references.map(r => `Q: ${r.question}\nA: ${r.answer}`).join('\n\n');
  }

  return prompt;
}

// Pull the most recent user message to use as the search query for past Q&A.
function getLatestUserQuestion(trimmedMessages) {
  for (let i = trimmedMessages.length - 1; i >= 0; i--) {
    if (trimmedMessages[i].role === 'user') return trimmedMessages[i].content;
  }
  return '';
}

async function getEmbedding(text) {
  const key = process.env.VOYAGE_API_KEY;
  if (!key || !text || !text.trim()) return null;
  try {
    const res = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        input: [text.slice(0, 4000)],
        model: 'voyage-3.5-lite'
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.data && data.data[0] && data.data[0].embedding ? data.data[0].embedding : null;
  } catch (e) {
    return null;
  }
}

async function getRelevantReferences(question) {
  if (!supabase || !question || question.trim().length < 3) return [];

  // Best: semantic search — matches by MEANING, so a differently
  // phrased or informally-worded question still finds the relevant
  // past answer, no matter how old it is.
  const embedding = await getEmbedding(question);
  if (embedding) {
    try {
      const { data, error } = await supabase.rpc('match_ai_knowledge_semantic', {
        query_embedding: embedding,
        match_count: 5
      });
      if (!error && data && data.length) return data;
    } catch (e) {
      // fall through to keyword-based search below
    }
  }

  // Fallback (no embeddings key configured, or semantic search found
  // nothing): plain full-text search on exact-ish wording.
  try {
    const { data, error } = await supabase
      .from('cbe_ai_knowledge')
      .select('question, answer')
      .textSearch('search_vector', question, { type: 'plain', config: 'english' })
      .limit(5);

    if (!error && data && data.length) return data;

    // Last resort: fuzzy trigram match for rephrased/informal wording.
    const { data: fuzzyData, error: fuzzyError } = await supabase.rpc('match_ai_knowledge', {
      search_query: question,
      match_count: 5
    });

    if (fuzzyError || !fuzzyData) return [];
    return fuzzyData;
  } catch (e) {
    return [];
  }
}

async function loadChatHistory(rollNumber, limit) {
  if (!supabase || !rollNumber) return [];
  try {
    const { data, error } = await supabase
      .from('cbe_ai_chat_history')
      .select('role, content')
      .eq('roll_number', rollNumber)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return data.reverse(); // chronological order for the model
  } catch (e) {
    return [];
  }
}

async function saveChatTurn(rollNumber, role, content) {
  if (!supabase || !rollNumber || !content) return;
  try {
    await supabase.from('cbe_ai_chat_history').insert({
      roll_number: rollNumber,
      role,
      content: content.slice(0, 4000)
    });
  } catch (e) {
    // Non-fatal — history logging should never break the chat response.
  }
}

async function saveQA(question, answer, rollNumber) {
  if (!supabase || !question || !answer) return;
  try {
    const embedding = await getEmbedding(question);
    await supabase.from('cbe_ai_knowledge').insert({
      question: question.slice(0, 2000),
      answer: answer.slice(0, 4000),
      roll_number: rollNumber || null,
      embedding: embedding || null
    });
  } catch (e) {
    // Non-fatal — memory logging should never break the chat response.
  }
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
      temperature: 0.4,   
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

  const trimmed = messages.slice(-20).map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content || '').slice(0, 4000)
  }));

  const rollNumber = body && body.context && body.context.rollNumber;

  // If the client only sent a short/fresh conversation (e.g. page just
  // loaded), pull in this student's stored history so the AI picks up
  // where earlier sessions left off, instead of starting from scratch.
  let effectiveMessages = trimmed;
  if (rollNumber && trimmed.length <= 2) {
    const history = await loadChatHistory(rollNumber, 30);
    if (history.length) {
      effectiveMessages = [...history, ...trimmed].slice(-30);
    }
  }

  const latestQuestion = getLatestUserQuestion(trimmed);
  const references = await getRelevantReferences(latestQuestion);
  const systemPrompt = buildSystemPrompt(body && body.context, references);

  try {
    let upstream = await callGroq(apiKey, PRIMARY_MODEL, systemPrompt, effectiveMessages);

    if (!upstream.ok && (upstream.status === 429 || upstream.status >= 500)) {
      upstream = await callGroq(apiKey, FALLBACK_MODEL, systemPrompt, effectiveMessages);
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

    // Save this exchange so future students' questions can benefit from it,
    // and so this specific student's conversation persists across sessions.
    await saveQA(latestQuestion, reply, rollNumber);
    if (rollNumber) {
      await saveChatTurn(rollNumber, 'user', latestQuestion);
      await saveChatTurn(rollNumber, 'assistant', reply);
    }

    res.status(200).json({ reply });
  } catch (e) {
    res.status(500).json({ error: 'Request failed', detail: String((e && e.message) || e) });
  }
};