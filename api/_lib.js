// Shared helpers for the /api routes served by server.mjs (Render).
// These do the same job as the here.now proxy routes in public/.herenow/proxy.json.

const ALLOWED_MODELS = new Set(['anthropic/claude-sonnet-5.5', 'anthropic/claude-sonnet-4.5']);
const MAX_TOKENS = 8000;

// The key as pasted into the host's settings, minus stray spaces, quotes or a leading "Bearer ".
export const cleanKey = (raw) => String(raw || '').trim().replace(/^["']|["']$/g, '').replace(/^Bearer\s+/i, '').trim();

// Best-effort per-IP limit (each serverless instance keeps its own count).
const hits = new Map();
function tooMany(req, limit = 60) {
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const hour = Math.floor(Date.now() / 3600000);
  const key = `${ip}:${hour}`;
  const n = (hits.get(key) || 0) + 1;
  hits.set(key, n);
  if (hits.size > 5000) hits.clear();
  return n > limit;
}

// Which AI service the server's key belongs to. OpenRouter keys start with "sk-or-"; any other
// key (e.g. an OpenAI / Codex key, "sk-proj-...") is sent to OpenAI directly. The key can be saved
// as OPENROUTER_API_KEY or OPENAI_API_KEY.
export function aiConfig() {
  const key = cleanKey(process.env.OPENROUTER_API_KEY) || cleanKey(process.env.OPENAI_API_KEY);
  if (!key) return { key: '', provider: 'none' };
  return { key, provider: /^sk-or-/.test(key) ? 'openrouter' : 'openai', model: process.env.OPENAI_MODEL || 'gpt-5-mini' };
}
const isReasoning = (m) => /^(gpt-5|o\d)/.test(m);

// Forward the app's AI request with the server-side key. Only the fields the app uses are passed
// on, only the app's models are allowed, and the answer always comes back in the same
// (chat-completions) shape whichever service answered.
export async function openRouter(req, res, { allowWeb = false } = {}) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  if (tooMany(req)) return res.status(429).json({ error: 'Too many requests this hour' });
  const { key, provider, model } = aiConfig();
  if (!key) return res.status(401).json({ error: 'OPENROUTER_API_KEY is not set on the server' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const models = (Array.isArray(body.models) ? body.models : [body.model]).filter((m) => ALLOWED_MODELS.has(m));
  if (!models.length || !Array.isArray(body.messages)) return res.status(400).json({ error: 'Bad request' });
  const wantsWeb = allowWeb && Array.isArray(body.plugins) && body.plugins.some((p) => p && p.id === 'web');

  if (provider === 'openai') return openAI(res, key, model, body, wantsWeb);

  const payload = {
    models,
    messages: body.messages,
    max_tokens: Math.min(Number(body.max_tokens) || 2000, MAX_TOKENS),
  };
  if (typeof body.temperature === 'number') payload.temperature = body.temperature;
  if (wantsWeb) {
    payload.plugins = body.plugins
      .filter((p) => p && p.id === 'web')
      .map((p) => ({ id: 'web', max_results: Math.min(Number(p.max_results) || 5, 10) }));
  }

  const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  res.status(upstream.status);
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
  return res.send(await upstream.text());
}

// OpenAI directly. Web search goes through the Responses API (built-in web_search tool) and is
// converted back to the chat-completions shape the app reads, including source links.
async function openAI(res, key, model, body, wantsWeb) {
  const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  // Reasoning models spend part of the output budget thinking, so give them room.
  const budget = isReasoning(model) ? 16000 : Math.min(Number(body.max_tokens) || 2000, MAX_TOKENS);

  if (!wantsWeb) {
    const payload = { model, messages: body.messages, max_completion_tokens: budget };
    if (isReasoning(model)) payload.reasoning_effort = 'low';
    else if (typeof body.temperature === 'number') payload.temperature = body.temperature;
    const upstream = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers, body: JSON.stringify(payload) });
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    return res.send(await upstream.text());
  }

  const text = body.messages.map((m) => (typeof m.content === 'string' ? m.content : (m.content || []).map((c) => c.text || '').join('\n'))).join('\n\n');
  const payload = { model, input: text, tools: [{ type: 'web_search' }], max_output_tokens: budget };
  if (isReasoning(model)) payload.reasoning = { effort: 'low' };
  const upstream = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers, body: JSON.stringify(payload) });
  const raw = await upstream.text();
  if (!upstream.ok) {
    res.status(upstream.status);
    res.setHeader('Content-Type', 'application/json');
    return res.send(raw);
  }
  let data = {};
  try { data = JSON.parse(raw); } catch { return res.status(502).json({ error: 'Unexpected answer from OpenAI' }); }
  const parts = (data.output || []).filter((o) => o.type === 'message').flatMap((o) => o.content || []).filter((c) => c.type === 'output_text');
  const content = parts.map((c) => c.text).join('\n');
  const annotations = parts.flatMap((c) => c.annotations || []).filter((a) => a.type === 'url_citation' && a.url)
    .map((a) => ({ type: 'url_citation', url_citation: { url: a.url, title: a.title || '' } }));
  return res.status(200).json({ choices: [{ message: { role: 'assistant', content, annotations } }] });
}

// Fetch a news RSS feed, passing on the browser's query string.
export async function rss(req, res, base) {
  if (req.method !== 'GET') return res.status(405).send('Use GET');
  if (tooMany(req, 200)) return res.status(429).send('Too many requests this hour');
  const qs = new URL(req.url, 'http://x').search;
  // Pass on the visitor's browser details: news sites often return empty feeds to requests
  // that look like bots.
  const upstream = await fetch(base + qs, {
    headers: {
      'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
      'Accept-Language': req.headers['accept-language'] || 'en-US,en;q=0.9',
      Accept: 'application/rss+xml, application/xml;q=0.9, */*;q=0.8',
    },
  });
  res.status(upstream.status);
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/xml');
  res.setHeader('Cache-Control', 's-maxage=900');
  return res.send(await upstream.text());
}
