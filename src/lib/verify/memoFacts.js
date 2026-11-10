// Reads back what the memo ACTUALLY says now (including hand edits) so the checks follow the memo.
// Rule: if a flag is fixed in the memo, re-checking must clear it.
//
// Figures are read from the sentences that state them (so retyping a number still works) and from
// the money tables / financials table / repayment list, which carry data-fact attributes.
import { num, has, money, sum } from '../format.js';
import { analyze } from '../analysis.js';
import { allowedNumbers } from './memoText.js';

const AMT = '(\\$?-?[\\d,]+(?:\\.\\d+)?)';
const PCT = '(-?[\\d.]+)';
const NUMBER = '(-?\\d+(?:\\.\\d+)?)';
const yearsOrMonths = (m) => (m[2] === 'year' ? 12 : 1) * Number(m[1]);
const R = (s) => new RegExp(s);

// key: deal field. pats: [regex, capture group (default 1), converter(match)]. shown: what an UNEDITED memo prints.
export const FIELDS = [
  { key: 'loanAmount', label: 'Loan amount', kind: '$', mentions: 6, shown: (d) => num(d.loanAmount), pats: [
    [R(AMT + '\\s+enterprise loan')], [R('\\ba\\s+' + AMT + '\\s+loan\\b')], [R('requests a\\s+' + AMT)],
    [R('would lend\\s+' + AMT + '\\s+to')], [R('annual interest on\\s+' + AMT + '\\s+is')], [R('Loan amount\\s+' + AMT)] ] },
  { key: 'interestRate', label: 'Interest rate', kind: '%', shown: (d) => num(d.interestRate), pats: [
    [R('loan from [^%]{0,80}?\\bat\\s+' + PCT + '% interest')], [R('At\\s+' + PCT + '%, annual interest')], [R('Interest rate\\s+' + PCT + '% per year')] ] },
  { key: 'termMonths', label: 'Loan term (months)', kind: 'n', shown: (d) => num(d.termMonths), pats: [
    [R('requests a\\s+\\$?[\\d,.-]+\\s+(\\d+(?:\\.\\d+)?)-(year|month) loan'), 1, yearsOrMonths],
    [R('Over the\\s+(\\d+(?:\\.\\d+)?)-(year|month) term'), 1, yearsOrMonths],
    [R('\\bTerm\\s+(\\d+(?:\\.\\d+)?) months')] ] },
  { key: 'originationFee', label: 'Origination fee', kind: '%', shown: (d) => num(d.originationFee), pats: [
    [R('with a\\s+' + PCT + '% origination fee')], [R('Origination fee\\s+' + PCT + '%')] ] },
  { key: 'walkScore', label: 'Walk Score', kind: 'n', shown: (d) => num(d.walkScore), pats: [[R('Walk Score of\\s+' + NUMBER)]] },
  { key: 'ownerSharePct', label: "Principal's ownership", kind: '%', shown: (d) => num(d.ownerSharePct), pats: [[R('owns\\s+' + PCT + '% of [^.]{0,120}?, implying')]] },
  { key: 'yearsExperience', label: 'Years of experience', kind: 'n', shown: (d) => num(d.yearsExperience), pats: [
    [R('who brings\\s+' + NUMBER + ' years')], [R('has\\s+' + NUMBER + ' years of experience')] ] },
  { key: 'projectsCompleted', label: 'Projects completed', kind: 'n', shown: (d) => num(d.projectsCompleted), pats: [
    [R('construction experience and\\s+' + NUMBER + ' completed projects')], [R('of experience and has completed\\s+' + NUMBER + ' projects')] ] },
  { key: 'squareFeet', label: 'Size (sq ft)', kind: 'n', shown: (d) => num(d.squareFeet), pats: [[R('of about\\s+' + AMT + ' sq ft')]] },
  { key: 'jobsCreated', label: 'Jobs created', kind: 'n', shown: (d) => num(d.jobsCreated), pats: [[R('about\\s+' + NUMBER + ' jobs')]] },
  { key: 'totalProjectCost', label: 'Total project cost', kind: '$', shown: (d) => num(d.totalProjectCost) || sum(d.projectUses || []), pats: [
    [R(',\\s*a\\s+' + AMT + '\\s+[^$]{0,120}?project\\.')], [R('of total project cost\\s+\\(' + AMT + '\\)')] ] },
  { key: 'totalAssets', label: 'Total assets', kind: '$', shown: (d) => num(d.totalAssets), pats: [[R('reports total assets of\\s+' + AMT)]] },
  { key: 'totalLiabilities', label: 'Total liabilities', kind: '$', shown: (d) => num(d.totalLiabilities), pats: [[R('reports total assets of\\s+' + AMT + ',\\s+liabilities of\\s+' + AMT), 2]] },
  { key: 'totalEquity', label: 'Total equity', kind: '$', shown: (d) => num(d.totalEquity), pats: [[R('reports total assets of\\s+' + AMT + ',\\s+liabilities of\\s+' + AMT + '\\s+and equity of\\s+' + AMT), 3]] },
  { key: 'cash', label: 'Cash on hand', kind: '$', shown: (d) => num(d.cash), pats: [[R('Cash on hand of\\s+' + AMT + '\\.')]] },
  { key: 'exitMonth', label: 'Repayment month', kind: 'n', shown: (d) => num(d.exitMonth), pats: [[R('expected around month\\s+' + NUMBER)]] },
  { key: 'exitProceeds', label: 'Expected repayment proceeds', kind: '$', shown: (d) => num(d.exitProceeds), pats: [[R('expected to produce\\s+' + AMT + ',\\s+or')]] },
];
export const LOAN_MENTIONS = 6;
const TABLES = ['loanUse', 'source', 'use', 'finYear', 'finType', 'finRev', 'finNet'];

const fmt = (f, v) => (f.kind === '$' ? money(v) : f.kind === '%' ? `${v}%` : String(v));
const tolOf = (f) => (f.kind === '$' ? 0.5 : 1e-6);

// text = memo as plain text; rows = [{fact, text}] from data-fact elements
export function factsFromList(rows, text) {
  const t = (text || '').replace(/\s+/g, ' ');
  const fields = {};
  for (const f of FIELDS) {
    fields[f.key] = [];
    for (const [re, group = 1, conv] of f.pats) {
      const m = t.match(re);
      if (m) fields[f.key].push(conv ? conv(m) : num(m[group]));
    }
  }
  const tables = Object.fromEntries(TABLES.map((k) => [k, []]));
  const repay = [];
  let overall = null;
  for (const { fact, text: x } of rows) {
    if (fact in tables) tables[fact].push(['finYear', 'finType'].includes(fact) ? x.trim() : num(x));
    else if (fact === 'repay') repay.push(x.trim());
    else if (fact === 'overall') overall = x.trim().toLowerCase();
  }
  const placeholders = [...t.matchAll(/\[([^\]:]+): to be added\]/g)].map((m) => m[1]);
  return { fields, tables, repay, overall, placeholders, text: t };
}
export const readFactsFromDom = (root) =>
  factsFromList([...root.querySelectorAll('[data-fact]')].map((el) => ({ fact: el.dataset.fact, text: el.textContent })), root.innerText);
// Plain text of rendered HTML the way a browser shows it: inline tags add no space, block tags do
export const htmlToText = (html) => html.replace(/<\/?(?:span|strong|em|b|i|a|u|mark|small)\b[^>]*>/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/\s+/g, ' ');
export function readFactsFromHtml(html) {
  const rows = [];
  for (const m of html.matchAll(/<(\w+)[^>]*\sdata-fact="(\w+)"[^>]*>(.*?)<\/\1>/g)) rows.push({ fact: m[2], text: m[3].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#x27;/g, "'") });
  return factsFromList(rows, htmlToText(html));
}

// The deal as the memo now reads, plus what changed (diffs) and what disagrees with itself (conflicts)
export function applyFacts(deal, facts) {
  const d = structuredClone(deal);
  const diffs = [];
  const conflicts = [];

  for (const f of FIELDS) {
    const vals = facts.fields[f.key];
    if (!vals.length) continue;
    const distinct = [];
    for (const v of vals) if (!distinct.some((x) => Math.abs(x - v) <= tolOf(f))) distinct.push(v);
    if (distinct.length > 1) { conflicts.push({ label: f.label, values: distinct.map((v) => fmt(f, v)), count: vals.length }); continue; }
    const v = distinct[0];
    if (Math.abs(v - f.shown(deal)) <= tolOf(f)) continue; // the memo still says what the form says
    d[f.key] = String(v);
    diffs.push({ label: f.label, memo: fmt(f, v), form: has(deal[f.key]) ? fmt(f, num(deal[f.key])) : 'blank', value: v, kind: f.kind });
  }

  // Money tables (loan uses, project sources, project uses)
  for (const [key, fact, label] of [['urgeUses', 'loanUse', 'Loan uses total'], ['projectSources', 'source', 'Project sources total'], ['projectUses', 'use', 'Project uses total']]) {
    const vals = facts.tables[fact];
    const rows = d[key] || [];
    if (!vals.length || vals.length !== rows.length) continue;
    const memoSum = vals.reduce((a, b) => a + b, 0);
    const formSum = sum(rows);
    d[key] = rows.map((r, i) => ({ ...r, amount: String(vals[i]) }));
    if (Math.abs(memoSum - formSum) > 0.5) diffs.push({ label, memo: money(memoSum), form: money(formSum), value: memoSum, kind: '$' });
  }

  // Financials table
  const idx = (d.financials || []).map((r, i) => (has(r.year) ? i : -1)).filter((i) => i >= 0);
  const T = facts.tables;
  if (idx.length && [T.finYear, T.finType, T.finRev, T.finNet].every((a) => a.length === idx.length)) {
    idx.forEach((ri, j) => {
      const r = d.financials[ri];
      const was = { ...r };
      const next = { year: T.finYear[j], type: T.finType[j], revenue: String(T.finRev[j]), netIncome: String(T.finNet[j]) };
      const label = `${was.year} financials`;
      if (String(was.year).trim() !== next.year) diffs.push({ label: `Year in the financials table (row ${j + 1})`, memo: next.year, form: String(was.year), value: null });
      if (String(was.type).trim() !== next.type) diffs.push({ label: `${was.year} type (Actual/Projected)`, memo: next.type, form: String(was.type), value: null });
      if (Math.abs(num(was.revenue) - T.finRev[j]) > 0.5) diffs.push({ label: `${label}: revenue`, memo: money(T.finRev[j]), form: money(was.revenue), value: T.finRev[j], kind: '$' });
      if (Math.abs(num(was.netIncome) - T.finNet[j]) > 0.5) diffs.push({ label: `${label}: net income`, memo: money(T.finNet[j]), form: money(was.netIncome), value: T.finNet[j], kind: '$' });
      Object.assign(r, next);
    });
  }

  // Repayment options list
  const baseOpts = (d.repaymentOptions || []).map((o) => o.option);
  if (baseOpts.length && facts.repay.length && JSON.stringify(baseOpts.map((x) => String(x).trim())) !== JSON.stringify(facts.repay)) {
    d.repaymentOptions = facts.repay.filter(Boolean).map((option) => ({ option }));
    diffs.push({ label: 'Repayment options', memo: `${d.repaymentOptions.length} listed`, form: `${baseOpts.length} listed`, value: null });
  } else if (!baseOpts.length && !facts.placeholders.includes('Repayment options') && !facts.repay.length && has(deal.firmName)) {
    d.repaymentOptions = [{ option: '(added in the memo)' }];
    diffs.push({ label: 'Repayment options', memo: 'text added', form: 'none', value: null });
  }

  // Blank fields that were typed into the memo (the memo shows a [... to be added] placeholder until then)
  const PLACEHOLDERS = { loanPurpose: ['Loan purpose', 'Reason for the loan'], principalBio: ['Principal bio', 'Principal bio'], projectAddress: ['Address', 'Project address'], collateral: ['Collateral', 'Collateral'],
    committee: ['Investment committee', 'Investment committee'], preparedBy: ['Underwriter', 'Prepared by'], neighborhood: ['Neighborhood description', 'Neighborhood description'], orgStructure: ['Organizational structure', 'Organizational structure'] };
  const filled = (cond, key, label) => { if (!has(d[key]) && cond) { d[key] = '(entered in the memo by hand)'; diffs.push({ label, memo: 'filled in', form: 'blank', value: null }); } };
  for (const [key, [ph, label]] of Object.entries(PLACEHOLDERS)) filled(!facts.placeholders.includes(ph), key, label);
  filled(!/\bthe Borrower\b/.test(facts.text), 'firmName', 'Borrower name');
  filled(!/is led by the principal/.test(facts.text), 'principalName', 'Principal name');
  filled(!/\bthe Project\b/.test(facts.text), 'projectName', 'Project name');

  return { effective: d, diffs, conflicts };
}

export function checkFacts(deal, facts, applied = applyFacts(deal, facts)) {
  const items = [];
  const allowed = allowedNumbers(deal);
  const known = (v) => v == null || allowed.some((a) => Math.abs(a - v) <= 0.5);

  for (const c of applied.conflicts) {
    items.push({ area: 'Memo vs form', level: 'fail', title: `${c.label} differs across the memo: ${c.values.join(' and ')}`, detail: `The memo states it ${c.count} times. Make every mention the same.` });
  }
  if (facts.fields.loanAmount.length && facts.fields.loanAmount.length < LOAN_MENTIONS && !applied.conflicts.some((c) => c.label === 'Loan amount')) {
    items.push({ area: 'Memo vs form', level: 'warn', title: `Found the loan amount in only ${facts.fields.loanAmount.length} of ${LOAN_MENTIONS} places in the memo`, detail: 'A sentence that states the loan amount may have been reworded or deleted, so it could not be fully checked.' });
  }
  for (const x of applied.diffs) {
    items.push({
      area: 'Memo vs form', level: 'warn',
      title: `${x.label} in the memo (${x.memo}) differs from the deal form (${x.form})`,
      detail: known(x.value)
        ? 'The memo was changed by hand, and the checks use what it says now. To finish the fix: correct this on the Deal data tab, then write the memo again.'
        : 'This figure is not anywhere in your deal data, so confirm it against the source. To finish the fix: correct it on the Deal data tab, then write the memo again.',
    });
  }
  const a = analyze(deal);
  if (facts.overall && ['green', 'yellow', 'red'].includes(facts.overall) && facts.overall !== a.overall) {
    items.push({ area: 'Memo vs form', level: 'warn', title: `Overall rating in the memo (${facts.overall}) differs from the computed rating (${a.overall})`, detail: 'The rating was changed by hand. The computed rating comes from the Red/Yellow/Green rules.' });
  }
  if (!items.length) items.push({ area: 'Memo vs form', level: 'pass', title: 'Everything the memo states matches the deal form', detail: '' });
  return items;
}
