// Small AI writing helpers used on the Deal data page. They go through the site's /api/news route
// (the server holds the AI key), so they work on the Render site once the key is set.
import { aiError, searchNewsFree } from './news.js';

const MODELS = ['anthropic/claude-sonnet-5.5', 'anthropic/claude-sonnet-4.5'];

async function ask(prompt, { web = false } = {}) {
  let res;
  try {
    res = await fetch('./api/news', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ models: MODELS, messages: [{ role: 'user', content: prompt }], max_tokens: 1500, ...(web ? { plugins: [{ id: 'web', max_results: 8 }] } : {}) }),
    });
  } catch {
    throw new Error('Couldn’t reach the AI. Check your connection and try again.');
  }
  if (web && res.status === 501) {
    const why = await res.clone().json().catch(() => null);
    if (why?.error?.code === 'no_web_search') return { noWeb: true };
  }
  if (!res.ok) throw new Error(await aiError(res, 'The AI'));
  const data = await res.json().catch(() => null);
  const text = String(data?.choices?.[0]?.message?.content || '').trim();
  if (!text) throw new Error('The AI returned an empty answer. Try again.');
  return { text: text.replace(/^```\w*\n?|```$/g, '').trim() };
}

// Turns the loan sizing points (one per row) into one memo paragraph.
export async function loanSizingParagraph(deal) {
  const points = (deal.loanSizingPoints || []).map((r) => String(r.point || '').trim()).filter(Boolean);
  if (!points.length) throw new Error('Add at least one loan sizing point first.');
  const { text } = await ask(`Write ONE paragraph (3-6 sentences) for the "Loan Sizing & Structuring" section of a lender's investment committee memo.
Lender: ${deal.fundName || 'the fund'}. Borrower: ${deal.firmName || 'the borrower'}. Loan: $${Number(deal.loanAmount || 0).toLocaleString('en-US')}.
Use ONLY these points; do not add facts or numbers that are not in them:
${points.map((p) => `- ${p}`).join('\n')}
Plain, professional underwriting language. Return only the paragraph, no heading, no bullets.`);
  return text;
}

// Describes what is around the project site: amenities, NEW developments, and who they serve.
export async function describeArea(deal) {
  const where = deal.projectAddress || 'unknown';
  const base = `You are helping a real estate lender's underwriter describe the area around a project site for an investment memo.
Project: "${deal.projectName || 'the project'}" (${deal.projectType || deal.assetType || 'real estate project'}) at ${where}.
${deal.targetPopulation ? `The project is meant to serve: ${deal.targetPopulation}.` : ''}
Write 1-2 short paragraphs (no bullets, no heading) covering: what is around the site (transit, grocery, schools, parks, employers, restaurants, gyms, hotels); anything NEW or planned nearby (new buildings, businesses opening); and whether nearby places serve a particular demographic relevant to this project (and why that matters). Name places only if you are confident they are real and near this address; otherwise describe in general terms. Do not invent numbers.
Only describe THIS address. If you cannot find it, say in one sentence that the exact address could not be confirmed and describe the neighborhood in general terms; never describe a different street or street number instead.
Write in the third person for a memo (never "I" or "you"). No links, URLs or markdown.`;
  const first = await ask(`${base}\nSearch the web for current information about this address and neighborhood.`, { web: true });
  if (!first.noWeb) return plain(first.text);
  // The AI service can't search the web: give it recent local news found by the free search instead.
  let headlines = '';
  try {
    const free = await searchNewsFree({ ...deal, firmName: '', principalName: '' });
    headlines = free.items.filter((i) => i.about === 'Site').slice(0, 10).map((i) => `- ${i.headline} (${i.source}, ${i.date})`).join('\n');
  } catch { /* no news; the AI writes from general knowledge */ }
  const { text } = await ask(`${base}
${headlines ? `Recent local news about the area (use it for anything new or planned):\n${headlines}` : 'No recent local news was found; rely on general knowledge and say what the underwriter should confirm.'}`);
  return plain(text);
}


// Memo text, not web text: "([redfin.com](https://…))" -> "(redfin.com)"; bare links and bold markers removed.
export function plain(t) {
  return String(t)
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '$1')
    .replace(/\(\s*\(([^()]+)\)\s*\)/g, '($1)')
    .replace(/\s*\(?https?:\/\/[^\s)]+\)?/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}
