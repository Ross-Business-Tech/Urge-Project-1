// Production server for Render (or any Node host): serves the built app from dist/ and the
// /api routes the app calls (news feeds and the AI requests, with the key kept on the server).
//
//   npm run build && npm start        (Render sets PORT and OPENROUTER_API_KEY)
//
// The /api handlers live in api/*.js and are shared with the here.now proxy routes' behaviour.
// No extra packages: plain Node (20+).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import news from './api/news.js';
import extract from './api/extract.js';
import bnews from './api/bnews.js';
import gnews from './api/gnews.js';
import { aiConfig, listModels, pickModel } from './api/_lib.js';
import { passwordProtected, signedIn, loginPage, handleLogin, logout } from './api/auth.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT) || 3000;
const MAX_BODY = 12 * 1024 * 1024; // documents and page images sent for AI reading

const ROUTES = { '/api/news': news, '/api/extract': extract, '/api/bnews': bnews, '/api/gnews': gnews };
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8', '.map': 'application/json', '.wasm': 'application/wasm',
};

// Gives the api/*.js handlers the small response helpers they expect (status/json/send).
function wrap(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => { if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); return res; };
  res.send = (body) => { res.end(body); return res; };
  return res;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(Object.assign(new Error('too large'), { code: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function handleApi(req, res, handler) {
  wrap(res);
  try {
    if (req.method === 'POST') {
      const raw = await readBody(req);
      try { req.body = raw ? JSON.parse(raw) : {}; } catch { return res.status(400).json({ error: 'Body must be JSON' }); }
    }
    await handler(req, res);
  } catch (err) {
    if (res.headersSent) return res.end();
    if (err.code === 413) return res.status(413).json({ error: 'Request too large' });
    console.error('API error', req.url, err.message);
    return res.status(502).json({ error: 'Upstream service unavailable' });
  }
}

function serveFile(res, file, cache) {
  res.setHeader('Content-Type', TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream');
  res.setHeader('Cache-Control', cache);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  fs.createReadStream(file).pipe(res);
}

function serveStatic(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.statusCode = 405; return res.end(); }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.statusCode = 400; return res.end(); }
  const file = path.normalize(path.join(DIST, pathname));
  if (!file.startsWith(DIST + path.sep) && file !== DIST) { res.statusCode = 403; return res.end(); }
  if (path.basename(file).startsWith('.') || pathname.startsWith('/.herenow')) { res.statusCode = 404; return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    // Vite puts content-hashed files in /assets, so they can be cached for a long time.
    return serveFile(res, file, pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache');
  }
  // Single-page app: every other address shows the app.
  return serveFile(res, path.join(DIST, 'index.html'), 'no-cache');
}

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('dist/index.html is missing. Run "npm run build" before "npm start".');
  process.exit(1);
}

async function health(res) {
  const ai = aiConfig();
  const out = { ok: true, passwordProtected: passwordProtected(), aiKeySet: Boolean(ai.key), aiProvider: ai.provider, node: process.version };
  if (ai.key && ai.provider !== 'openrouter') {
    out.aiAddress = ai.base;
    out.aiOrganizationSet = Boolean(ai.org);
    const m = await listModels(ai);
    out.aiModel = await pickModel(ai);
    if (m.list) out.modelsOffered = m.list.slice(0, 40);
    if (m.error) out.modelListError = m.error;
  } else if (ai.provider === 'openrouter') out.aiModel = 'anthropic/claude-sonnet-5.5';
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(out, null, 2));
}

http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://x').pathname;

  // --- Shared-password sign-in (only when SITE_PASSWORD is set in Render)
  if (pathname === '/login') {
    if (req.method === 'POST') {
      let body = '';
      try { body = await readBody(req); } catch { res.statusCode = 413; return res.end(); }
      return handleLogin(req, res, body);
    }
    return signedIn(req) ? (res.writeHead(302, { Location: '/' }), res.end()) : loginPage(res);
  }
  if (pathname === '/logout') return logout(req, res);
  if (!signedIn(req)) {
    if (pathname === '/api/health') return wrap(res).status(200).json({ ok: true, passwordProtected: true });
    if (pathname.startsWith('/api/')) return wrap(res).status(401).json({ error: 'Please sign in again: reload the page and enter the team password.', code: 'login' });
    return loginPage(res, { next: req.method === 'GET' ? req.url : '/' });
  }

  // Status page for checking a deploy. Says whether the AI key is set, never what it is.
  if (pathname === '/api/health') return health(res);
  const route = ROUTES[pathname];
  if (route) return handleApi(req, res, route);
  return serveStatic(req, res);
}).listen(PORT, () => {
  console.log(`Memo Drafter running on port ${PORT}${passwordProtected() ? ' (password protected)' : ' (no SITE_PASSWORD: site is open to anyone with the link)'}${aiConfig().key ? ` (AI: ${aiConfig().provider})` : ' (OPENROUTER_API_KEY not set: AI features are off)'}`);
});
