// Finds dollar amounts, percentages and multiples in the written memo that don't trace back to the deal data.
import { analyze } from '../analysis.js';
import { num } from '../format.js';
import { rubric } from './rubric.js';

const TOKEN = /\$\s?-?[\d,]+(?:\.\d+)?\s?(?:[MKmk]\b|million|thousand)?|-?\d+(?:\.\d+)?\s?%|\b\d+(?:\.\d+)?x\b/g;

// Parses a figure and how precisely it is written ("$6.8M" is exact to $50,000; "8.5%" to 0.05).
function parse(tok) {
  const t = tok.trim().toLowerCase();
  const numStr = (t.match(/-?[\d,]*\.?\d+/) || [''])[0].replace(/,/g, '');
  const n = parseFloat(numStr);
  if (!Number.isFinite(n)) return null;
  const decimals = (numStr.split('.')[1] || '').length;
  const half = 0.5 * Math.pow(10, -decimals);
  if (t.startsWith('$')) {
    const unit = /m(illion)?$/.test(t) ? 1e6 : /k$|thousand$/.test(t) ? 1e3 : 1;
    return { kind: '$', v: n * unit, tol: half * unit * 1.001 };
  }
  if (t.endsWith('%')) return { kind: '%', v: n, tol: half * 1.001 };
  return { kind: 'x', v: n, tol: half * 1.001 };
}

function collect(value, into) {
  if (typeof value === 'number' && Number.isFinite(value)) into.add(value);
  else if (typeof value === 'string' && value.trim() !== '') {
    if (Number.isFinite(Number(value.replace(/[$,%\s]/g, '')))) into.add(num(value));
    // numbers written inside sentences, e.g. "remaining 80% of the project"
    for (const m of value.match(/\d[\d,]*\.?\d*/g) || []) into.add(num(m));
    // figures with units inside sentences, e.g. "projects under $10M"
    for (const tok of value.match(TOKEN) || []) { const p = parse(tok); if (p) into.add(p.v); }
  }
  else if (Array.isArray(value)) value.forEach((x) => collect(x, into));
  else if (value && typeof value === 'object') Object.values(value).forEach((x) => collect(x, into));
}

export function allowedNumbers(deal) {
  const set = new Set();
  collect(deal, set);
  const a = analyze(deal);
  collect(a, set);
  // Values the memo derives and shows: percentages of totals, monthly interest, gaps
  const more = [a.annualInterest / 12, Math.abs(a.srcTotal - a.useTotal), a.loanShareOfProject,
    a.liabilities + a.loan, a.equity - a.loan, a.totalOwed - a.loan];
  // Year-by-year margins and growth between any two years (the memo says e.g. "105% above 2025")
  const fin = (deal.financials || []).filter((r) => num(r.revenue) > 0);
  const ownerPct = num(deal.ownerSharePct);
  for (let i = 0; i < fin.length; i++) {
    more.push(num(fin[i].netIncome) / num(fin[i].revenue));
    if (ownerPct) more.push((num(fin[i].netIncome) * ownerPct) / 100, (num(fin[i].revenue) * ownerPct) / 100); // owner's share
    for (let j = i + 1; j < fin.length; j++) {
      more.push(num(fin[j].revenue) / num(fin[i].revenue) - 1, num(fin[j].netIncome) / (num(fin[i].netIncome) || 1) - 1);
    }
  }
  collect(rubric, set);
  for (const rows of [deal.projectSources, deal.projectUses, deal.urgeUses]) {
    const total = (rows || []).reduce((t, r) => t + num(r.amount), 0);
    for (const r of rows || []) if (total) more.push(num(r.amount) / total);
  }
  more.forEach((x) => collect(x ?? 0, set));
  // Fractions are shown as percentages
  for (const v of [...set]) set.add(v * 100);
  return [...set].filter((v) => v !== 0);
}

export function checkMemoText(text, deal) {
  const allowed = allowedNumbers(deal);
  const found = new Set((text || '').match(TOKEN) || []);
  const bad = [];
  let checked = 0;
  for (const tok of found) {
    const p = parse(tok);
    if (!p || p.v === 0) continue;
    checked++;
    const ok = allowed.some((a) => {
      return Math.abs(a - p.v) <= p.tol;
    });
    if (!ok) bad.push(tok.trim());
  }
  if (!bad.length) return [{ area: 'Memo text', level: 'pass', title: `All ${checked} figures in the memo trace back to your data`, detail: '' }];
  return bad.map((t) => ({ area: 'Memo text', level: 'fail', title: `${t} is in the memo but not in your deal data`, detail: 'Either it was typed into the memo by hand or it is a mistake. Check it against the source.' }));
}
