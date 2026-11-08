// News check: asks an AI model with live web search (through the site's here.now proxy
// route, so no key is in this code) for recent news about the borrower and the project site.

// Newest first; OpenRouter falls back to the next model if one is unavailable.
const MODELS = ['anthropic/claude-sonnet-5.5', 'anthropic/claude-sonnet-4.5'];

export const safeUrl = (u) => {
  try {
    const url = new URL(String(u));
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
};

const clean = (s, max = 600) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

// One-tap manual searches; these work even when the AI search is not set up.
export function manualSearches(deal) {
  const q = (s) => 'https://news.google.com/search?q=' + encodeURIComponent(s);
  const out = [];
  if (deal.firmName) out.push({ label: `News on ${deal.firmName}`, url: q(`"${deal.firmName}"`) });
  if (deal.principalName) out.push({ label: `News on ${deal.principalName}`, url: q(`"${deal.principalName}" ${deal.hqCity || ''} developer`) });
  if (deal.projectAddress) out.push({ label: 'News near the project site', url: q(deal.projectAddress.replace(/\(.*?\)/g, '')) });
  if (deal.projectName) out.push({ label: `News on ${deal.projectName}`, url: q(`"${deal.projectName}"`) });
  return out;
}

function buildPrompt(deal) {
  return `You are helping a real estate lender's underwriter prepare an investment committee memo.
Search the web for recent, relevant news (prefer the last 3 years) on:
1. THE BORROWER: the firm "${deal.firmName || 'unknown'}" and its principal "${deal.principalName || 'unknown'}"${deal.hqCity ? ` (based in ${deal.hqCity})` : ''}. Look for lawsuits, liens, bankruptcies, code violations, project delays or failures, awards, completed projects, press coverage.
2. THE SITE: the area around "${deal.projectAddress || 'unknown'}" (project: "${deal.projectName || 'unknown'}"). Look for zoning or rezoning, nearby developments, major employers opening or closing, infrastructure/transit changes, crime or safety trends, environmental issues, public incentives.

Rules:
- Only report items you actually found, with the real source URL. Never invent articles. If you are not sure an article is about this exact firm or person (common names), say so in "relevance".
- Rate each item: "red" = could hurt repayment or reputation and must be checked; "yellow" = worth a look; "green" = supportive / positive.
- Return ONLY JSON, no other text, in this shape:
{"summary":"2-3 sentence plain-language overview","items":[{"about":"Borrower" or "Site","headline":"...","source":"publication name","date":"YYYY-MM or YYYY-MM-DD if known","url":"https://...","level":"red|yellow|green","summary":"1-2 sentences on what it says","relevance":"1 sentence on why it matters to this loan"}]}
Return at most 10 items. If you found nothing relevant, return an empty items array and say so in the summary.`;
}

function parseJson(text) {
  const t = String(text || '');
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(t.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function searchNews(deal) {
  let res;
  try {
    res = await fetch('./api/news', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        models: MODELS,
        plugins: [{ id: 'web', max_results: 10 }],
        messages: [{ role: 'user', content: buildPrompt(deal) }],
        max_tokens: 3000,
      }),
    });
  } catch {
    throw new Error('Couldn’t reach the news search. Check your connection and try again.');
  }
  if (res.status === 404 || res.status === 405)
    throw new Error('News search isn’t available on this link. It works on the team’s dev site and public site once your instructor adds the AI key.');
  if (res.status === 401 || res.status === 403)
    throw new Error('News search isn’t switched on yet: your instructor needs to add the OPENROUTER_API_KEY variable in here.now.');
  if (res.status === 429) throw new Error('Too many searches in the last hour. Try again later.');
  if (!res.ok) throw new Error(`The news search failed (error ${res.status}). Try again in a minute.`);

  const data = await res.json().catch(() => null);
  const msg = data?.choices?.[0]?.message;
  const parsed = parseJson(msg?.content);
  if (!parsed) throw new Error('The news search returned something unexpected. Try again.');

  const citations = (msg.annotations || [])
    .filter((a) => a.type === 'url_citation')
    .map((a) => safeUrl(a.url_citation?.url))
    .filter(Boolean);

  const items = (Array.isArray(parsed.items) ? parsed.items : []).slice(0, 10).map((it) => ({
    about: clean(it.about, 20) === 'Site' ? 'Site' : 'Borrower',
    headline: clean(it.headline, 200),
    source: clean(it.source, 80),
    date: clean(it.date, 20),
    url: safeUrl(it.url) || '',
    level: ['red', 'yellow', 'green'].includes(it.level) ? it.level : 'yellow',
    summary: clean(it.summary),
    relevance: clean(it.relevance, 300),
  })).filter((it) => it.headline);

  return { summary: clean(parsed.summary, 800), items, citations };
}

// ---------------------------------------------------------------------------
// Keyless news check: Bing News / Google News search feeds (through the site's
// /api/bnews and /api/gnews proxy routes, which need no key) + simple keyword rules for the rating.

const RED_WORDS = /\b(lawsuit|sued|suing|litigation|foreclos\w*|bankrupt\w*|lien|liens|fraud\w*|indict\w*|charged|convicted|default\w*|eviction\w*|violation\w*|condemn\w*|stop.work|investigat\w*|scandal|settle\w*)\b/i;
const YELLOW_WORDS = /\b(delay\w*|stall\w*|clos(e|es|ed|ing|ure)|vacan\w*|crime|shooting|layoff\w*|cuts?|over.budget|dispute\w*|opposition|oppose\w*|protest\w*|rezoning|zoning|contamina\w*|demolish\w*|demolition|tax.increase|price.drop|struggl\w*|crash\w*|thie(f|ves)|theft|robber\w*|stolen|police|fire|flood\w*|homicide|killed|injur\w*|vandal\w*|blight\w*|downturn|losses|resign\w*|fined?|penalt\w*)\b/i;
const GREEN_WORDS = /\b(award\w*|approv\w*|open(s|ed|ing)?|grant\w*|invest(s|ed|ment)|expan\w*|complet\w*|celebrat\w*|groundbreak\w*|launch\w*|honor\w*|wins?|funding|revitaliz\w*|new jobs|hiring|pledg\w*|redevelop\w*|presales?|sold.out|record|milestone|partnership|tenant|lease[sd]?|affordable)\b/i;

function rate(text) {
  const r = text.match(RED_WORDS);
  if (r) return { level: 'red', why: `Mentions “${r[0]}”` };
  const y = text.match(YELLOW_WORDS);
  if (y) return { level: 'yellow', why: `Mentions “${y[0]}”` };
  const g = text.match(GREEN_WORDS);
  if (g) return { level: 'green', why: `Mentions “${g[0]}”` };
  return { level: 'yellow', why: 'No warning words found; read to judge' };
}

const stripTags = (s) => {
  const doc = new DOMParser().parseFromString(`<body>${s || ''}</body>`, 'text/html');
  return doc.body.textContent || '';
};

// Bing News first; Google News as a backup (Google often blocks shared servers).
async function fetchXml(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const e = new Error(String(res.status));
    e.status = res.status;
    throw e;
  }
  const xml = new DOMParser().parseFromString(await res.text(), 'text/xml');
  if (xml.querySelector('parsererror') || !xml.querySelector('channel')) {
    const e = new Error('bad feed');
    e.status = 502;
    throw e;
  }
  return xml;
}

function realLink(link) {
  // Bing wraps article links in a click-tracking URL; pull out the real article address.
  try {
    const u = new URL(link);
    if (u.hostname.endsWith('bing.com') && u.searchParams.get('url')) return safeUrl(u.searchParams.get('url'));
  } catch { /* not a URL */ }
  return safeUrl(link);
}

function items(xml) {
  return [...xml.getElementsByTagName('item')].map((it) => {
    const get = (tag) => it.getElementsByTagName(tag)[0]?.textContent;
    const source = clean(get('News:Source') || get('source'), 80);
    let title = clean(get('title'), 300);
    if (source && title.endsWith(' - ' + source)) title = title.slice(0, -(source.length + 3));
    const d = new Date(get('pubDate') || '');
    return {
      headline: title,
      source,
      date: isNaN(d) ? '' : d.toISOString().slice(0, 10),
      time: isNaN(d) ? 0 : d.getTime(),
      url: realLink(get('link')) || '',
      snippet: clean(stripTags(get('description')), 400),
    };
  });
}

async function feed(query) {
  try {
    return items(await fetchXml('./api/bnews?' + new URLSearchParams({ q: query, format: 'rss', count: '20' })));
  } catch (err) {
    if (err.status === 404 || err.status === 405) throw err;
    return items(await fetchXml('./api/gnews?' + new URLSearchParams({ q: query + ' when:3y', hl: 'en-US', gl: 'US', ceid: 'US:en' })));
  }
}

const norm = (t) => String(t || '').toLowerCase().replace(/[’'`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const mentions = (text, must) => !must || (' ' + norm(text) + ' ').includes(' ' + norm(must) + ' ');

// "100 Sample Avenue, Detroit, MI (fictional)" -> { exact: "100 Sample Avenue", street: "Sample Avenue", city: "Detroit" }
function splitAddress(address) {
  const a = String(address || '').replace(/\(.*?\)/g, '').trim();
  const parts = a.split(',').map((x) => x.trim()).filter(Boolean);
  const exact = parts[0] || '';
  const street = exact.replace(/^\d+[\w-]*\s+/, '');
  return { exact: /^\d/.test(exact) ? exact : '', street, city: parts[1] || '' };
}

export async function searchNewsFree(deal) {
  const city = (deal.hqCity || '').split(',')[0].trim();
  const addr = splitAddress(deal.projectAddress);
  const siteCity = addr.city || city;
  const firm = (deal.firmName || '').replace(/,?\s+(LLC|L\.L\.C\.|Inc\.?|LP|Corp\.?|Co\.?|Ltd\.?)$/i, '').trim();
  // Bing handles quoted names poorly, so search loosely and keep only articles that mention the name.
  const queries = [];
  if (firm) queries.push({ about: 'Borrower', q: firm, must: firm });
  if (deal.principalName) queries.push({ about: 'Borrower', q: `${deal.principalName} ${city}`.trim(), must: deal.principalName });
  if (deal.projectName) queries.push({ about: 'Site', q: `${deal.projectName} ${siteCity}`.trim(), must: deal.projectName });
  if (addr.exact) queries.push({ about: 'Site', q: `${addr.exact} ${siteCity}`.trim(), must: addr.exact.split(/\s+/).slice(0, 2).join(' ') });
  if (addr.street && siteCity) queries.push({ about: 'Site', q: `${addr.street} ${siteCity}`, must: addr.street.split(/\s+/)[0] });
  if (!queries.length) throw new Error('Fill in the borrower name or project address first.');

  const results = await Promise.allSettled(queries.map((x) => feed(x.q)));
  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length === results.length) {
    const st = failed[0].reason?.status;
    if (st === 404 || st === 405) throw new Error('News search only works on the published site (test link, dev site or public site), not here.');
    if (st === 429) throw new Error('Too many searches in the last hour. Try again later.');
    throw new Error('Couldn’t reach the news search. Check your connection and try again.');
  }

  const seen = new Set();
  const items = [];
  const counts = { Borrower: 0, Site: 0 };
  const cutoff = Date.now() - 3 * 365 * 24 * 3600 * 1000;
  results.forEach((r, i) => {
    if (r.status !== 'fulfilled') return;
    const { about, must } = queries[i];
    r.value
      .filter((a) => a.headline && (!a.time || a.time >= cutoff) && mentions(`${a.headline} ${a.snippet}`, must))
      .sort((a, b) => b.time - a.time)
      .slice(0, 5)
      .forEach((a) => {
        const key = a.headline.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        const { level, why } = rate(`${a.headline} ${a.snippet}`);
        counts[about]++;
        items.push({
          about, level, headline: a.headline, source: a.source, date: a.date, url: a.url,
          summary: a.snippet && a.snippet !== a.headline ? a.snippet : '',
          relevance: `(${why}.)`,
        });
      });
  });

  const order = { red: 0, yellow: 1, green: 2 };
  items.sort((a, b) => order[a.level] - order[b.level]);
  const reds = items.filter((i) => i.level === 'red').length;
  const summary = items.length
    ? `Found ${counts.Borrower} article(s) about the borrower and ${counts.Site} about the site in the last 3 years${reds ? `; ${reds} mention warning words such as lawsuits or liens and should be read first` : ''}. Ratings come from keyword rules, not a full read, so open each article to confirm.`
    : 'No news articles found in the last 3 years for the borrower or the site. That is common for small firms; still check court and property records.';
  return { summary, items: items.slice(0, 15), citations: [] };
}
