// One shared password for the whole site (no database). Set SITE_PASSWORD in Render's
// Environment settings. Anyone who enters it gets a signed cookie that lasts 30 days on that
// device. Changing SITE_PASSWORD signs everyone out.
// FAILS CLOSED: if SITE_PASSWORD is not set (or is too short), nobody can get in at all; every page
// shows a "locked" notice and every /api route is refused.
import crypto from 'node:crypto';

const COOKIE = 'md_session';
const DAYS = 30;
const password = () => String(process.env.SITE_PASSWORD || '').trim();
export const MIN_LENGTH = 8;
export const passwordProtected = () => password().length >= MIN_LENGTH;

// The signing key comes from the password (plus an optional SESSION_SECRET), so a new password
// invalidates every existing cookie.
const key = () => crypto.createHash('sha256').update(`memo-drafter|${password()}|${process.env.SESSION_SECRET || ''}`).digest();
const sign = (v) => crypto.createHmac('sha256', key()).update(v).digest('base64url');
const same = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

function readCookie(req) {
  const m = String(req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : '';
}

export function signedIn(req) {
  if (!passwordProtected()) return false; // locked until a password is set
  const [exp, sig] = readCookie(req).split('.');
  return Boolean(exp && sig && Number(exp) > Date.now() && same(sig, sign(`ok:${exp}`)));
}

const secure = (req) => (String(req.headers['x-forwarded-proto'] || '').includes('https') ? '; Secure' : '');
function setSession(req, res) {
  const exp = String(Date.now() + DAYS * 86400000);
  res.setHeader('Set-Cookie', `${COOKIE}=${exp}.${sign(`ok:${exp}`)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${DAYS * 86400}${secure(req)}`);
}
export function logout(req, res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure(req)}`);
  res.statusCode = 302;
  res.setHeader('Location', '/');
  res.end();
}

// Slow down guessing: 10 wrong tries per 15 minutes per address.
const fails = new Map();
const ipOf = (req) => String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
function blocked(req) {
  const f = fails.get(ipOf(req));
  return f && f.count >= 10 && Date.now() - f.first < 15 * 60000;
}
function noteFail(req) {
  const ip = ipOf(req), now = Date.now();
  const f = fails.get(ip);
  if (!f || now - f.first > 15 * 60000) fails.set(ip, { count: 1, first: now });
  else f.count++;
  if (fails.size > 5000) fails.clear();
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function loginPage(res, { error = '', next = '/' } = {}) {
  if (!passwordProtected()) return lockedPage(res);
  res.statusCode = error ? 401 : 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Frame-Options', 'DENY');
  res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sign in · Memo Drafter</title>
<style>
:root{--brand:#0071e3;--ink:#1d1d1f;--muted:#6e6e73;--line:#d2d2d7;color-scheme:light}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f5f7;font:16px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:var(--ink);padding:16px}
.card{width:100%;max-width:380px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:28px 24px;box-shadow:0 10px 30px rgba(0,0,0,.06)}
.logo{width:42px;height:42px;border-radius:10px;background:linear-gradient(145deg,#2997ff,#0058b9);color:#fff;display:grid;place-items:center;font:700 20px system-ui,-apple-system,sans-serif;margin-bottom:12px}
h1{font:700 22px system-ui,-apple-system,'Segoe UI',sans-serif;color:var(--ink);margin:0 0 4px}p{margin:0 0 18px;color:var(--muted);font-size:14px}
label{display:block;font-size:13px;font-weight:600;color:var(--muted);margin-bottom:4px}
input{width:100%;font:inherit;padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:#fbfcfd}
input:focus{outline:2px solid var(--brand);outline-offset:-1px}
button{margin-top:14px;width:100%;font:inherit;font-weight:600;padding:11px;border-radius:980px;border:0;background:var(--brand);color:#fff;cursor:pointer}
.err{background:#fde8e6;color:#b42318;border-radius:8px;padding:8px 12px;font-size:14px;margin-bottom:14px}
</style></head><body><form class="card" method="post" action="/login">
<div class="logo" aria-hidden="true">M</div><h1>Memo Drafter</h1><p>Enter the team password to continue.</p>
${error ? `<div class="err" role="alert">${esc(error)}</div>` : ''}
<label for="pw">Password</label><input id="pw" name="password" type="password" autocomplete="current-password" required autofocus>
<input type="hidden" name="next" value="${esc(next)}"><button type="submit">Sign in</button>
</form></body></html>`);
}

export async function handleLogin(req, res, body) {
  const form = new URLSearchParams(body || '');
  let next = form.get('next') || '/';
  if (!next.startsWith('/') || next.startsWith('//')) next = '/';
  if (blocked(req)) return loginPage(res, { error: 'Too many wrong tries. Wait 15 minutes and try again.', next });
  if (!passwordProtected()) return lockedPage(res);
  if (same(String(form.get('password') || '').trim(), password())) {
    fails.delete(ipOf(req));
    setSession(req, res);
    res.statusCode = 303;
    res.setHeader('Location', next);
    return res.end();
  }
  noteFail(req);
  return loginPage(res, { error: 'That password isn’t right. Try again.', next });
}

// Shown to everyone while no password is set. (Status 200 so Render's health check still passes;
// nothing of the app is served.)
function lockedPage(res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Frame-Options', 'DENY');
  res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Locked · Memo Drafter</title><meta name="robots" content="noindex">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f5f7;font:16px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1d1d1f;padding:16px}
.card{max-width:420px;background:#fff;border:1px solid #d2d2d7;border-radius:14px;padding:28px 24px}h1{font-size:20px;margin:0 0 8px}p{margin:0;color:#6e6e73;font-size:15px}</style>
</head><body><div class="card"><h1>This site is locked</h1><p>Memo Drafter isn’t available yet. If you run this site, set a team password (SITE_PASSWORD, at least ${MIN_LENGTH} characters) in Render’s Environment settings.</p></div></body></html>`);
}
