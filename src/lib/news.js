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
