// Stress tests for the memo checks. Run with:  npm run stress
// Uses made-up deals only. No AI or network needed.
import { sampleDeal, emptyDeal } from '../src/lib/sampleDeal.js';
import { analyze } from '../src/lib/analysis.js';
import { verifyAll } from '../src/lib/verify/index.js';
import { rateIndependent, checkRatings, RANK } from '../src/lib/verify/ratings.js';
import { checkMemoText } from '../src/lib/verify/memoText.js';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

// Renders the real memo screen to plain text (no browser needed)
const vite = await createServer({ root: new URL('..', import.meta.url).pathname, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const Memo = (await vite.ssrLoadModule('/src/components/Memo.jsx')).default;
const memoText = (deal) => renderToStaticMarkup(React.createElement(Memo, { deal })).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, ' ');

const results = [];
let group = '';
const section = (name) => { group = name; console.log(`\n${name}`); };
function test(name, fn) {
  let ok = false, note = '';
  try { const r = fn(); ok = r === true || r === undefined; if (!ok) note = String(r); } catch (e) { note = 'threw: ' + (e.message || e); }
  results.push({ group, name, ok, note });
  console.log(`  ${ok ? '✔' : '✖'} ${name}${ok ? '' : '  -> ' + note}`);
}
const base = () => structuredClone(sampleDeal);
const mut = (patch) => ({ ...base(), ...patch });
const items = (deal, text) => verifyAll(deal, text).items;
const has = (deal, level, re, text) => items(deal, text).some((i) => i.level === level && re.test(i.title));

// ---------------------------------------------------------------- 1. Golden deals
section('1. Golden deals (known answers)');
test('sample deal: no failed checks', () => verifyAll(base()).counts.fail === 0 || 'fails: ' + items(base()).filter((i) => i.level === 'fail').map((i) => i.title));
const strong = mut({ yearsExperience: '15', totalLiabilities: '400000', totalEquity: '2000000', cash: '900000', exitProceeds: '2000000', exitMonth: '24', walkScore: '90',
  financials: [{ year: '2024', type: 'Actual', revenue: '1000000', netIncome: '100000' }, { year: '2025', type: 'Actual', revenue: '1100000', netIncome: '120000' }, { year: '2026', type: 'Projected', revenue: '1200000', netIncome: '130000' }] });
test('strong deal rates GREEN overall', () => analyze(strong).overall === 'green' || analyze(strong).overall);
const weak = mut({ yearsExperience: '2', totalLiabilities: '4000000', totalEquity: '500000', cash: '10000', exitProceeds: '500000' });
test('weak deal rates RED overall', () => analyze(weak).overall === 'red' || analyze(weak).overall);
test('mid deal rates YELLOW overall', () => analyze(base()).overall === 'yellow' || analyze(base()).overall);
test('blank form: no crash, flags missing data', () => has(emptyDeal, 'warn', /required field/));

// ---------------------------------------------------------------- 2. Planted errors
section('2. Planted mistakes (each must be caught)');
test('sources ≠ uses', () => has(mut({ projectSources: [{ label: 'Bank', amount: '5000000' }] }), 'fail', /do not balance/));
test('loan uses ≠ loan amount', () => has(mut({ urgeUses: [{ label: 'x', amount: '100000' }] }), 'warn', /Loan uses/));
test('balance sheet does not balance', () => has(mut({ totalEquity: '5000000' }), 'fail', /Balance sheet/));
test('repayment after maturity', () => has(mut({ exitMonth: '48' }), 'fail', /after the loan matures/));
test('thin cushion before maturity', () => has(mut({ exitMonth: '35' }), 'warn', /cushion/));
test('Walk Score of 150', () => has(mut({ walkScore: '150' }), 'fail', /Walk Score/));
test('interest rate typo (85%)', () => has(mut({ interestRate: '85' }), 'warn', /Interest rate looks wrong/));
test('term typo (360 months)', () => has(mut({ termMonths: '360' }), 'warn', /Term looks wrong/));
test('negative cash', () => has(mut({ cash: '-5000' }), 'fail', /Negative amount/));
test('duplicate financial year', () => has(mut({ financials: [{ year: '2024', type: 'Actual', revenue: '1', netIncome: '1' }, { year: '2024', type: 'Actual', revenue: '1', netIncome: '1' }] }), 'fail', /twice/));
test('net income higher than revenue', () => has(mut({ financials: [{ year: '2024', type: 'Actual', revenue: '100', netIncome: '900' }] }), 'fail', /Net income is higher/));
test('only one repayment option', () => has(mut({ repaymentOptions: [{ option: 'Sale of the building' }] }), 'warn', /Only 1/));
test('no worst-case repayment path', () => has(mut({ repaymentOptions: [{ option: 'Cash flow' }, { option: 'Refinance' }, { option: 'Grant' }] }), 'warn', /No worst-case/));
test('loan bigger than whole project', () => has(mut({ loanAmount: '9000000' }), 'warn', /larger than the whole project/));

// ---------------------------------------------------------------- 3. Memo text vs data
section('3. Numbers typed into the memo (must trace to the data)');
const goodText = 'The $750,000 loan carries 8.5% interest for 36 months. Debt to equity is 2.50x. Total project cost is $6.8M.';
test('correct figures pass', () => checkMemoText(goodText, base())[0].level === 'pass' || JSON.stringify(checkMemoText(goodText, base())));
test('altered loan amount ($570,000) is caught', () => checkMemoText(goodText.replace('$750,000', '$570,000'), base()).some((i) => i.level === 'fail' && i.title.includes('$570,000')));
test('invented figure ($9,999,999) is caught', () => checkMemoText(goodText + ' Expected sale price $9,999,999.', base()).some((i) => i.level === 'fail'));
test('wrong interest rate (9.5%) is caught', () => checkMemoText(goodText.replace('8.5%', '9.5%'), base()).some((i) => i.level === 'fail'));
test('"$6.8M" matches 6,800,000 (rounding allowed)', () => checkMemoText('Project cost $6.8M.', base())[0].level === 'pass');

test('the real, unedited memo passes (sample deal)', () => { const r = checkMemoText(memoText(base()), base()).filter((i) => i.level === 'fail'); return r.length === 0 || r.map((i) => i.title).join('; '); });
test('real memo + one hand-edit ($750,000 -> $570,000) is caught', () => checkMemoText(memoText(base()).replace('$750,000', '$570,000'), base()).some((i) => i.level === 'fail' && i.title.includes('$570,000')));

// ---------------------------------------------------------------- 4. Mutation tests
section('4. Mutation: making a deal worse must never improve a rating');
const worse = {
  'less equity': { totalEquity: '450000', totalAssets: '1950000' },
  'more liabilities': { totalLiabilities: '4500000', totalAssets: '5400000' },
  'less cash': { cash: '5000' },
  'smaller repayment proceeds': { exitProceeds: '600000' },
  'less experience': { yearsExperience: '2', projectsCompleted: '1' },
  'no mission signals': { bipocOwned: 'No', growthPlan: '', jobsCreated: '0', impactArea: 'No' },
  'higher interest rate': { interestRate: '20' },
};
for (const [name, patch] of Object.entries(worse)) {
  test(`${name}`, () => {
    const a = analyze(base()), b = analyze(mut(patch));
    if (RANK[b.overall] < RANK[a.overall]) return `overall improved ${a.overall} -> ${b.overall}`;
    for (const m of a.merits) { const mb = b.merits.find((x) => x.label === m.label); if (RANK[mb.level] < RANK[m.level]) return `${m.label} improved`; }
    return true;
  });
}

// ---------------------------------------------------------------- 5. Differential grid
section('5. 300 random deals: app ratings vs the written rules');
let seed = 12345;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pick = (lo, hi) => Math.round(lo + rnd() * (hi - lo));
const grid = Array.from({ length: 300 }, () => mut({
  yearsExperience: String(pick(0, 20)), projectsCompleted: String(pick(0, 12)),
  loanAmount: String(pick(100, 3000) * 1000), interestRate: String(pick(4, 14)), termMonths: String(pick(6, 60)),
  totalLiabilities: String(pick(0, 6000) * 1000), totalEquity: String(pick(100, 4000) * 1000), cash: String(pick(0, 1500) * 1000),
  exitProceeds: String(pick(200, 5000) * 1000), exitMonth: String(pick(3, 70)), walkScore: String(pick(0, 100)),
  bipocOwned: rnd() > 0.5 ? 'Yes' : 'No', impactArea: rnd() > 0.5 ? 'Yes' : 'No', jobsCreated: String(pick(0, 60)), growthPlan: rnd() > 0.5 ? 'Plan' : '',
}));
test('every rating matches the rubric (no drift)', () => {
  const drift = grid.filter((d) => checkRatings(d).some((i) => i.level === 'fail' && i.area === 'Ratings'));
  return drift.length === 0 || `${drift.length}/300 deals disagree`;
});
test('overall never better than worst independent merit', () => {
  const bad = grid.filter((d) => { const m = rateIndependent(d); const fin = [m.leverage, m.cash].filter(Boolean); const w = [m.experience, m.mission, ...fin].filter(Boolean).reduce((x, l) => Math.max(x, RANK[l]), 0); return RANK[analyze(d).overall] < w; });
  return bad.length === 0 || `${bad.length}/300 deals`;
});
test('real memos for all 300 deals pass the memo-text check (no false alarms)', () => {
  const bad = [];
  for (const d of grid) { const f = checkMemoText(memoText(d), d).filter((i) => i.level === 'fail'); if (f.length) bad.push(f[0].title); }
  return bad.length === 0 || `${bad.length}/300 false alarms, e.g. ${[...new Set(bad)].slice(0, 4).join(' | ')}`;
});
test('checker detects deals where overall hides a red item', () => {
  const hidden = grid.filter((d) => { const a = analyze(d); return a.flags.some((f) => f.level === 'red') && a.overall !== 'red'; });
  const caught = hidden.filter((d) => checkRatings(d).some((i) => i.level === 'warn'));
  console.log(`      (${hidden.length} of 300 random deals have a red item with a non-red overall; ${caught.length} caught as warnings)`);
  return caught.length > 0 || 'none caught';
});

// ---------------------------------------------------------------- 6. Junk input
section('6. Junk input must never crash the checks');
for (const [name, v] of [['letters', 'abc'], ['negative', '-1'], ['huge', '1e12'], ['symbols', '$$$%%%'], ['blank', ''], ['null', null]]) {
  test(`all numeric fields = ${name}`, () => {
    const d = base();
    for (const k of ['loanAmount', 'interestRate', 'termMonths', 'totalEquity', 'totalLiabilities', 'cash', 'exitProceeds', 'exitMonth', 'walkScore', 'yearsExperience']) d[k] = v;
    const r = verifyAll(d, 'text $1,000 and 5%');
    return !r.items.some((i) => i.area === 'Checks') || r.items.find((i) => i.area === 'Checks').detail;
  });
}
test('blank + sample text does not crash', () => verifyAll(emptyDeal, goodText).items.length > 0);

// ---------------------------------------------------------------- Scorecard
const passed = results.filter((r) => r.ok).length;
console.log(`\n=== Scorecard: ${passed} / ${results.length} passed ===`);
for (const r of results.filter((x) => !x.ok)) console.log(`  ✖ [${r.group}] ${r.name}: ${r.note}`);
await vite.close();
process.exit(passed === results.length ? 0 : 1);
