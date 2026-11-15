// "Scan documents with AI": sends the text and page pictures read by docReader.js to an
// AI model (through the site's here.now proxy route, so no key is in this code) and asks it
// to fill in the Deal data fields, quoting where each value came from.

import { emptyDeal } from './sampleDeal.js';
import { FIELDS } from './sources.js';
import { TABLES } from './csv.js';
import { aiError } from './news.js';

const MODELS = ['anthropic/claude-sonnet-5.5', 'anthropic/claude-sonnet-4.5'];

// The news check fills news items; the memo-writer fills these by hand.
const SKIP = new Set(['news', 'newsSummary', 'newsCheckedAt', 'fundName', 'fundTagline', 'memoDate', 'relationshipManager', 'preparedBy', 'committee', 'underwriterNotes', 'approvers', 'taNeeds', 'risks', 'customSections', 'loanSizingParagraph', 'areaMedianIncome', 'rentHaircutPct', 'underwrittenVacancyPct', 'underwritingNote']);

const NUMBER = new Set([
  'yearsExperience', 'projectsCompleted', 'loanAmount', 'interestRate', 'termMonths', 'originationFee', 'squareFeet',
  'totalProjectCost', 'walkScore', 'jobsCreated', 'totalAssets', 'totalLiabilities', 'totalEquity', 'cash',
  'ownerSharePct', 'exitProceeds', 'exitMonth', 'interestOnlyMonths', 'amortizationYears', 'successFeePct', 'residentialUnits',
  'affordableUnits', 'amiPct', 'propertyTaxRatePct', 'tdcCompleted', 'unitsCompleted', 'commercialSqFtCompleted', 'sqFtCompleted', 'commercialSqFt', 'constructionJobs', 'borrowerVacancyPct', 'guarantorDscr',
]);
const NUMBER_COLS = new Set(['amount', 'revenue', 'netIncome', 'year', 'expenses', 'debtService', 'annualRent', 'marketValue', 'units', 'ami']);
const CHOICES = {
  impactArea: ['Yes', 'No'],
  interestReserve: ['Yes', 'No'],
  siteControl: ['Yes', 'No'],
  previouslyVacant: ['Yes', 'No'],
  constructionType: ['New construction', 'Rehab', 'Both'],
  developerStage: ['Early-emerging', 'Emerging', 'Established'],
  projectType: ['Multifamily residential', 'Multifamily mixed-use', 'Commercial', 'Hotel / hospitality', 'Office', 'Co-working space', 'Other'],
  repaymentStructure: ['Interest-only, principal due at maturity', 'Interest-only period, then amortizing', 'Fully amortizing', 'Accrued interest, all due at maturity'],
};
const COL_CHOICES = { financials: { type: ['Actual', 'Projected'] } };

const HINTS = {
  interestRate: 'percent, e.g. 8.5', originationFee: 'percent, e.g. 1.5', ownerSharePct: 'percent, e.g. 100',
  termMonths: 'months', exitMonth: 'month of the loan term when the money arrives',
  exitProceeds: 'dollars the borrower expects from the project to repay this loan',
  urgeUses: 'how THIS loan will be spent', projectSources: 'all financing for the whole project',
  projectUses: 'all costs of the whole project', financials: 'the borrower firm’s yearly revenue and net income',
  repaymentOptions: 'ways the lender gets repaid, most likely first',
  projectProjections: 'the PROJECT’s yearly revenue, operating expenses and debt service from the pro forma',
  collateralProperties: 'properties pledged as collateral, with annual rent and market value',
  affordableTiers: 'affordable units grouped by income level: number of units and % of area median income (AMI)',
  developerStage: 'Early-emerging (under $1M of development completed), Emerging ($1M-$10M, e.g. small multifamily) or Established ($10M+)',
  tdcCompleted: 'total development cost of all projects the borrower has completed, in dollars',
  collateral: 'liens and pledged property only (not guarantees)', guarantee: 'who personally or corporately guarantees the loan',
  projectTypeOther: 'only when projectType is Other',
  targetPopulation: 'who the project is meant to serve (residents, community)',
  interestOnlyMonths: 'from the term sheet', amortizationYears: 'from the term sheet', successFeePct: 'from the term sheet',
  guarantorDscr: 'debt service coverage of the guarantor’s existing portfolio, e.g. 1.4', team: 'developer, architect, contractor, etc.',
};

export const SCAN_FIELDS = Object.keys(emptyDeal).filter((k) => !SKIP.has(k));

function fieldGuide() {
  return SCAN_FIELDS.map((k) => {
    const label = FIELDS[k]?.[0] || k;
    if (TABLES[k]) {
      const cols = TABLES[k].map((c) => (COL_CHOICES[k]?.[c] ? `${c} (${COL_CHOICES[k][c].join('|')})` : c)).join(', ');
      return `- ${k} [table: rows of {${cols}}]: ${label}${HINTS[k] ? ` (${HINTS[k]})` : ''}`;
    }
    const type = CHOICES[k] ? `one of: ${CHOICES[k].join(' | ')}` : NUMBER.has(k) ? 'number' : 'text';
    return `- ${k} [${type}]: ${label}${HINTS[k] ? ` (${HINTS[k]})` : ''}`;
  }).join('\n');
}

function buildPrompt(names) {
  return `You are helping a community lender's underwriter fill in a loan intake form from the borrower's documents.
The documents follow: ${names.map((n) => `"${n}"`).join(', ')}.

Typical files: a TERM SHEET (loan amount, rate, term, interest-only period, amortization, fees, success fee, collateral, repayment), an UNDERWRITING MODEL spreadsheet (sources and uses, project revenue, operating expenses and debt service by year, vacancy and rent assumptions), plus applications, budgets, financial statements and bios.

Fill in as many of these fields as the documents support:
${fieldGuide()}

Rules:
- Use ONLY what the documents say. Never guess or invent. Leave a field out if the documents don't give it.
- Numbers: digits only, no $, commas, % or words ("1.2 million" -> 1200000; "8.5%" -> 8.5). Text: short and plain, written for an investment memo.
- For every field, give the exact file name it came from and a short quote (under 20 words) copied from that file, so a person can check it.
- If two documents disagree, use the most recent or most official one and explain in "conflicts".
- Return ONLY JSON, no other text, in this shape:
{"summary":"1-2 sentences on what the documents are",
 "fields":{"loanAmount":{"value":"750000","file":"term-sheet.pdf","quote":"Loan amount: $750,000"}},
 "tables":{"projectSources":{"rows":[{"label":"Senior construction loan","amount":"4420000"}],"file":"budget.xlsx","quote":"Senior loan 4,420,000"}},
 "conflicts":[{"field":"loanAmount","note":"The application says $700,000 but the term sheet says $750,000."}]}`;
}

const clean = (s, max = 2000) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const cleanNum = (v) => {
  const s = String(v ?? '').replace(/[$,%\s]/g, '');
  return s !== '' && Number.isFinite(Number(s)) ? String(Number(s)) : '';
};

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

function pickChoice(value, options) {
  const v = clean(value).toLowerCase();
  return options.find((o) => o.toLowerCase() === v) || options.find((o) => v && o.toLowerCase().startsWith(v.slice(0, 6))) || '';
}

// Keep only fields the app knows, in the format the form expects.
export function normalize(parsed, fileNames) {
  const known = new Set(fileNames);
  const fileOf = (f) => (known.has(clean(f, 300)) ? clean(f, 300) : fileNames.find((n) => clean(f, 300).includes(n)) || clean(f, 300));
  const out = [];

  for (const [key, raw] of Object.entries(parsed?.fields || {})) {
    if (!SCAN_FIELDS.includes(key) || TABLES[key] || !raw) continue;
    const r = typeof raw === 'object' ? raw : { value: raw };
    let value = NUMBER.has(key) ? cleanNum(r.value) : CHOICES[key] ? pickChoice(r.value, CHOICES[key]) : clean(r.value);
    if (!value) continue;
    out.push({ key, value, file: fileOf(r.file), quote: clean(r.quote, 240) });
  }

  for (const [key, raw] of Object.entries(parsed?.tables || {})) {
    if (!SCAN_FIELDS.includes(key) || !TABLES[key] || !raw) continue;
    const rows = (Array.isArray(raw.rows) ? raw.rows : Array.isArray(raw) ? raw : []).slice(0, 30).map((row) =>
      Object.fromEntries(TABLES[key].map((c) => {
        const v = row?.[c];
        if (COL_CHOICES[key]?.[c]) return [c, pickChoice(v, COL_CHOICES[key][c]) || COL_CHOICES[key][c][0]];
        return [c, NUMBER_COLS.has(c) ? cleanNum(v) : clean(v, 600)];
      }))
    ).filter((row) => TABLES[key].some((c) => !COL_CHOICES[key]?.[c] && row[c])); // drop rows that are only a dropdown value
    if (!rows.length) continue;
    out.push({ key, value: rows, file: fileOf(raw.file), quote: clean(raw.quote, 240) });
  }

  // Same order as the Deal data page.
  out.sort((a, b) => SCAN_FIELDS.indexOf(a.key) - SCAN_FIELDS.indexOf(b.key));
  const conflicts = (Array.isArray(parsed?.conflicts) ? parsed.conflicts : [])
    .map((c) => ({ field: clean(c?.field, 60), note: clean(c?.note, 400) }))
    .filter((c) => c.note)
    .slice(0, 15);
  return { summary: clean(parsed?.summary, 600), found: out, conflicts };
}

// docs: [{ name, text, images: [{ label, url }] }]
export async function extractDeal(docs) {
  const content = [{ type: 'text', text: buildPrompt(docs.map((d) => d.name)) }];
  for (const d of docs) {
    if (d.text) content.push({ type: 'text', text: `\n=== FILE: ${d.name} ===\n${d.text}\n=== END OF ${d.name} ===` });
    for (const img of d.images || []) {
      content.push({ type: 'text', text: `\n=== FILE: ${d.name} (${img.label}, picture) ===` });
      content.push({ type: 'image_url', image_url: { url: img.url } });
    }
  }

  let res;
  try {
    res = await fetch('./api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        models: MODELS,
        messages: [{ role: 'user', content }],
        max_tokens: 6000,
        temperature: 0,
      }),
    });
  } catch {
    throw new Error('Couldn’t reach the AI. Check your connection and try again.');
  }
  if (!res.ok) throw new Error(await aiError(res, 'AI document reading'));

  const data = await res.json().catch(() => null);
  if (!data) throw new Error('AI document reading isn’t available on this link. It works on the team’s dev site and public site.');
  if (data.error) throw new Error(`The AI couldn’t read the files: ${clean(data.error.message, 200) || 'unknown error'}.`);
  const parsed = parseJson(data?.choices?.[0]?.message?.content);
  if (!parsed) throw new Error('The AI returned something unexpected. Try again.');
  return normalize(parsed, docs.map((d) => d.name));
}
