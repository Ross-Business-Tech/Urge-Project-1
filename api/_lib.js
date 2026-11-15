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

// Forward a chat request to OpenRouter with the server-side key. Only the fields the
// app uses are passed on, and only the app's models are allowed.
export async function openRouter(req, res, { allowWeb = false } = {}) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  if (tooMany(req)) return res.status(429).json({ error: 'Too many requests this hour' });
  const key = cleanKey(process.env.OPENROUTER_API_KEY);
  if (!key) return res.status(401).json({ error: 'OPENROUTER_API_KEY is not set on the server' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const models = (Array.isArray(body.models) ? body.models : [body.model]).filter((m) => ALLOWED_MODELS.has(m));
  if (!models.length || !Array.isArray(body.messages)) return res.status(400).json({ error: 'Bad request' });

  const payload = {
    models,
    messages: body.messages,
    max_tokens: Math.min(Number(body.max_tokens) || 2000, MAX_TOKENS),
  };
  if (typeof body.temperature === 'number') payload.temperature = body.temperature;
  if (allowWeb && Array.isArray(body.plugins)) {
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
