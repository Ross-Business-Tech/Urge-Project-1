// "Polished wording": when the memo is written, the AI rewrites the underwriter's free-text
// answers (bullets, fragments, shorthand) into complete, professional memo sentences.
// Guard rails:
//  - facts stay as typed: a rewrite is only kept if it has exactly the same numbers as the original
//    (nothing added, dropped or changed); otherwise that field keeps the underwriter's own words;
//  - the verification report still checks every figure in the memo against the original deal data;
//  - if the AI isn't available, the memo simply uses the text as typed (bullets still become
//    paragraphs, see prose.js).
import { aiError } from './news.js';

const MODELS = ['anthropic/claude-sonnet-5.5', 'anthropic/claude-sonnet-4.5'];

// Free-text fields that read as sentences in the memo. (Short phrases that the memo slots into its
// own sentences, like the target population or repayment sources, are left as typed.)
const FIELDS = ['loanPurpose', 'principalBio', 'orgStructure', 'neighborhood', 'growthPlan', 'underwritingNote', 'guarantorPortfolio',
  'collateral', 'guarantee', 'taNeeds', 'underwriterNotes', 'loanSizingParagraph'];
const ROWS = { risks: ['risk', 'mitigant'], team: ['bio'], customSections: ['body'] };
const MAX_CHARS = 14000;

const numbers = (t) => (String(t).match(/\d[\d,]*(?:\.\d+)?/g) || []).map((n) => n.replace(/,/g, '').replace(/\.0+$/, '')).sort();
const sameNumbers = (a, b) => JSON.stringify(numbers(a)) === JSON.stringify(numbers(b));

function collect(deal) {
  const items = [];
  for (const k of FIELDS) if (String(deal[k] || '').trim().length > 2) items.push({ id: k, text: deal[k] });
  for (const [k, cols] of Object.entries(ROWS)) {
    (deal[k] || []).forEach((row, i) => cols.forEach((c) => { if (String(row?.[c] || '').trim().length > 2) items.push({ id: `${k}.${i}.${c}`, text: row[c] }); }));
  }
  let total = 0;
  return items.filter((x) => (total += x.text.length) <= MAX_CHARS);
}

export const hasTextToPolish = (deal) => collect(deal).length > 0;

function parseJson(t) {
  const s = String(t || ''), a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
}

// One AI request for a batch of fields: returns { id: rewritten text }.
async function rewrite(deal, batch) {
  const prompt = `You are editing the underwriter's notes for a community lender's investment committee memo (fund: ${deal.fundName || 'the fund'}; borrower: ${deal.firmName || 'the borrower'}).
Rewrite EACH text below into polished, professional memo prose:
- Turn bullet points, fragments and shorthand into complete, grammatical sentences (one paragraph unless the text clearly needs more).
- Keep every fact, name, place, date, number and dollar amount EXACTLY as written: use the same digits, never spell numbers out, never round, never add or remove a number.
- Do not add any new facts, numbers, opinions, judgments or recommendations, and do not leave anything out.
- Keep about the same length. No headings, no bullet points, no quotation marks around the whole text.
Return ONLY a JSON object that maps each id to its rewritten text.

${JSON.stringify(Object.fromEntries(batch.map((x) => [x.id, x.text])), null, 1)}`;

  let res;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 120000); // never leave the memo waiting forever
  try {
    res = await fetch('./api/news', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ models: MODELS, messages: [{ role: 'user', content: prompt }], max_tokens: 4000 }),
      signal: ctl.signal,
    });
  } catch {
    throw new Error(ctl.signal.aborted ? 'the AI took too long to answer' : 'the AI could not be reached');
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(await aiError(res, 'AI polishing'));
  const data = await res.json().catch(() => null);
  const out = parseJson(data?.choices?.[0]?.message?.content);
  if (!out || typeof out !== 'object') throw new Error('the AI returned something unexpected');
  return out;
}

// Small batches, sent at the same time: faster, and one slow or failed batch only leaves
// its own fields as typed.
const BATCH_CHARS = 3000;
function batches(items) {
  const out = [];
  let cur = [], size = 0;
  for (const it of items) {
    if (cur.length && size + it.text.length > BATCH_CHARS) { out.push(cur); cur = []; size = 0; }
    cur.push(it); size += it.text.length;
  }
  if (cur.length) out.push(cur);
  return out;
}

// Returns { deal: polished copy, changed: number of fields rewritten, kept: fields left as typed }.
export async function polishDeal(deal) {
  const items = collect(deal);
  if (!items.length) return { deal, changed: 0, kept: 0 };
  const results = await Promise.allSettled(batches(items).map((b) => rewrite(deal, b)));
  const ok = results.filter((r) => r.status === 'fulfilled');
  if (!ok.length) throw results[0].reason;
  const out = Object.assign({}, ...ok.map((r) => r.value));

  const d = structuredClone(deal);
  let changed = 0, kept = 0;
  for (const { id, text } of items) {
    const next = typeof out[id] === 'string' ? out[id].trim() : '';
    const good = next && sameNumbers(text, next) && next.length <= text.length * 3 + 300;
    if (!good) { kept++; continue; }
    if (next === String(text).trim()) continue;
    const parts = id.split('.');
    if (parts.length === 1) d[id] = next;
    else d[parts[0]] = d[parts[0]].map((r, i) => (i === Number(parts[1]) ? { ...r, [parts[2]]: next } : r));
    changed++;
  }
  return { deal: d, changed, kept };
}

export const __test = { numbers, sameNumbers, collect, batches };
