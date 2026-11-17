// Shared helpers for the /api routes served by server.mjs (Render).
// These do the same job as the here.now proxy routes in public/.herenow/proxy.json.

const ALLOWED_MODELS = new Set(['anthropic/claude-sonnet-5.5', 'anthropic/claude-sonnet-4.5']);
const MAX_TOKENS = 8000;

// The key as pasted into the host's settings, minus stray spaces, quotes or a leading "Bearer ".
export const cleanKey = (raw) => String(raw || '').trim().replace(/^["']|["']$/g, '').replace(/^Bearer\s+/i, '').trim();

// Best-effort per-IP limit (each serverless instance keeps its own count).
const hits = new Map();
export function tooMany(req, limit = 60) {
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const hour = Math.floor(Date.now() / 3600000);
  const key = `${ip}:${hour}`;
  const n = (hits.get(key) || 0) + 1;
  hits.set(key, n);
  if (hits.size > 5000) hits.clear();
  return n > limit;
}

// Which AI service the server's key belongs to:
//   sk-or-...  -> OpenRouter
//   sk-...     -> OpenAI
//   anything else (e.g. a U-M GPT Toolkit key from toolkit.umgpt.umich.edu) -> the U-M GPT Toolkit
// The key can be saved as OPENROUTER_API_KEY, OPENAI_API_KEY or AI_API_KEY. Optional settings:
//   AI_BASE_URL      another OpenAI-compatible address (or a U-M ".../azure-openai-api/openai" address)
//   AI_ORGANIZATION  sent as OpenAI-Organization (U-M: your 6-digit shortcode, if your key needs it)
//   AI_MODEL         model to use (otherwise picked from what the service offers)
//   AI_API_VERSION   for Azure-style addresses only
const UMICH_BASE = 'https://api.toolkit.umgpt.umich.edu/v1';
export function aiConfig() {
  const key = cleanKey(process.env.OPENROUTER_API_KEY) || cleanKey(process.env.OPENAI_API_KEY) || cleanKey(process.env.AI_API_KEY);
  if (!key) return { key: '', provider: 'none' };
  const provider = /^sk-or-/.test(key) ? 'openrouter' : /^sk-/.test(key) ? 'openai' : 'umich';
  const base = (process.env.AI_BASE_URL || (provider === 'umich' ? UMICH_BASE : 'https://api.openai.com/v1')).trim().replace(/\/+$/, '');
  return {
    key, provider, base,
    azure: /azure-openai-api|openai\.azure\.com/i.test(base),
    org: (process.env.AI_ORGANIZATION || '').trim(),
    model: (process.env.AI_MODEL || process.env.OPENAI_MODEL || '').trim(),
    apiVersion: (process.env.AI_API_VERSION || '2025-04-01-preview').trim(),
  };
}
const isReasoning = (m) => /^(gpt-5|o\d)/.test(m);

function aiHeaders(cfg) {
  const h = { 'Content-Type': 'application/json' };
  if (cfg.azure) h['api-key'] = cfg.key;
  else h.Authorization = `Bearer ${cfg.key}`;
  if (cfg.org) h['OpenAI-Organization'] = cfg.org;
  return h;
}

// Models the service offers (asked once every 10 minutes). Used to pick a model automatically.
const PREFERRED = ['gpt-5-mini', 'gpt-5', 'gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini', 'gpt-4o', 'gpt-5-nano', 'gpt-4.1-nano'];
let modelCache = { at: 0, list: null, error: '' };
export async function listModels(cfg = aiConfig()) {
  if (cfg.provider === 'none' || cfg.provider === 'openrouter' || cfg.azure) return { list: null, error: '' };
  if (modelCache.list && Date.now() - modelCache.at < 600000) return modelCache;
  try {
    const r = await fetch(`${cfg.base}/models`, { headers: aiHeaders(cfg) });
    const text = await r.text();
    if (!r.ok) { modelCache = { at: Date.now(), list: null, error: `${r.status}: ${text.slice(0, 160)}` }; return modelCache; }
    const data = JSON.parse(text);
    const list = (data.data || data.models || []).map((m) => m.id || m.name || m).filter((x) => typeof x === 'string');
    modelCache = { at: Date.now(), list, error: '' };
  } catch (e) {
    modelCache = { at: Date.now(), list: null, error: String(e.message || e).slice(0, 160) };
  }
  return modelCache;
}
export async function pickModel(cfg = aiConfig()) {
  if (cfg.model) return cfg.model;
  if (cfg.azure) return 'gpt-4o';
  const { list } = await listModels(cfg);
  if (list?.length) {
    for (const want of PREFERRED) {
      const hit = list.find((m) => m === want) || list.find((m) => m.startsWith(want + '-') && !/codex|audio|realtime|transcribe|tts|image|embedding|search/i.test(m));
      if (hit) return hit;
    }
    const chat = list.find((m) => /^(gpt|o\d)/.test(m) && !/codex|audio|realtime|transcribe|tts|image|embedding|search/i.test(m));
    if (chat) return chat;
  }
  return 'gpt-5-mini';
}

// Forward the app's AI request with the server-side key. Only the fields the app uses are passed
// on, only the app's models are allowed, and the answer always comes back in the same
// (chat-completions) shape whichever service answered.
export async function openRouter(req, res, { allowWeb = false } = {}) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  if (tooMany(req)) return res.status(429).json({ error: 'Too many requests this hour' });
  const cfg = aiConfig();
  const { key, provider } = cfg;
  if (!key) return res.status(401).json({ error: 'OPENROUTER_API_KEY is not set on the server' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const models = (Array.isArray(body.models) ? body.models : [body.model]).filter((m) => ALLOWED_MODELS.has(m));
  if (!models.length || !Array.isArray(body.messages)) return res.status(400).json({ error: 'Bad request' });
  const wantsWeb = allowWeb && Array.isArray(body.plugins) && body.plugins.some((p) => p && p.id === 'web');

  if (provider !== 'openrouter') return openAI(res, cfg, await pickModel(cfg), body, wantsWeb);

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

// OpenAI, the U-M GPT Toolkit, or another OpenAI-compatible service. Web search goes through the
// Responses API (built-in web_search tool) and is converted back to the chat-completions shape the
// app reads, including source links. If the service can't search the web, the app is told so
// (code "no_web_search") and falls back to the free news search with the AI reviewing the results.
async function openAI(res, cfg, model, body, wantsWeb) {
  const headers = aiHeaders(cfg);
  const q = cfg.azure ? `?api-version=${encodeURIComponent(cfg.apiVersion)}` : '';
  // Reasoning models spend part of the output budget thinking, so give them room.
  const budget = isReasoning(model) ? 16000 : Math.min(Number(body.max_tokens) || 2000, MAX_TOKENS);

  if (!wantsWeb) {
    const payload = { model, messages: body.messages, max_completion_tokens: budget };
    if (isReasoning(model)) payload.reasoning_effort = 'low';
    else if (typeof body.temperature === 'number') payload.temperature = body.temperature;
    const url = cfg.azure ? `${cfg.base}/deployments/${encodeURIComponent(model)}/chat/completions${q}` : `${cfg.base}/chat/completions`;
    const upstream = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    return res.send(await upstream.text());
  }

  const text = body.messages.map((m) => (typeof m.content === 'string' ? m.content : (m.content || []).map((c) => c.text || '').join('\n'))).join('\n\n');
  const payload = { model, input: text, tools: [{ type: 'web_search' }], max_output_tokens: budget };
  if (isReasoning(model)) payload.reasoning = { effort: 'low' };
  let upstream, raw;
  try {
    upstream = await fetch(`${cfg.base}/responses${q}`, { method: 'POST', headers, body: JSON.stringify(payload) });
    raw = await upstream.text();
  } catch {
    return res.status(501).json({ error: { message: 'This AI service could not be reached for web search', code: 'no_web_search' } });
  }
  if (!upstream.ok) {
    // Bad key, no credit or rate limits are real errors; anything else means web search isn't offered.
    if ([401, 402, 403, 429].includes(upstream.status)) {
      res.status(upstream.status);
      res.setHeader('Content-Type', 'application/json');
      return res.send(raw);
    }
    return res.status(501).json({ error: { message: `Web search is not available from this AI service (${upstream.status})`, code: 'no_web_search' } });
  }
  let data = {};
  try { data = JSON.parse(raw); } catch { return res.status(502).json({ error: 'Unexpected answer from the AI service' }); }
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
