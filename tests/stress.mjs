// Stress tests for the memo checks. Run with:  npm run stress
// Uses made-up deals only. No AI or network needed.
import { sampleDeal, emptyDeal } from '../src/lib/sampleDeal.js';
import { analyze } from '../src/lib/analysis.js';
import { verifyAll } from '../src/lib/verify/index.js';
import { rateIndependent, checkRatings, RANK } from '../src/lib/verify/ratings.js';
import { checkMemoText } from '../src/lib/verify/memoText.js';
import { randomDeal, MISTAKES } from '../src/lib/randomDeal.js';
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

// ---------------------------------------------------------------- 5. Random deals (the randomizer)
const arg = (name, dflt) => { const i = process.argv.indexOf('--' + name); return i > -1 ? Number(process.argv[i + 1]) : dflt; };
const COUNT = arg('count', 500);
const SEED = arg('seed', 1);
section(`5. ${COUNT} random deals (seed base ${SEED}; use --count N --seed S)`);
const gen = (i, opts) => randomDeal(SEED * 1000003 + i, opts);
const clean = Array.from({ length: COUNT }, (_, i) => gen(i, { profile: 'any' }));
const seeds = (list) => list.slice(0, 4).map((r) => '#' + r.seed).join(', ');

test('same seed always gives the same deal', () => JSON.stringify(randomDeal(77)) === JSON.stringify(randomDeal(77)) && JSON.stringify(randomDeal(77)) !== JSON.stringify(randomDeal(78)));
test('clean random deals: zero failed checks', () => {
  const bad = clean.filter((r) => verifyAll(r.deal).counts.fail > 0);
  return bad.length === 0 || `${bad.length} deals failed, e.g. seeds ${seeds(bad)}: ${verifyAll(bad[0].deal).items.find((i) => i.level === 'fail').title}`;
});
test('app ratings match the written rules (no drift)', () => {
  const bad = clean.filter((r) => checkRatings(r.deal).some((i) => i.level === 'fail'));
  return bad.length === 0 || `${bad.length} deals disagree, e.g. seeds ${seeds(bad)}`;
});
test('overall never better than the worst merit', () => {
  const bad = clean.filter((r) => { const m = rateIndependent(r.deal); const w = [m.experience, m.mission, m.leverage, m.cash].filter(Boolean).reduce((x, l) => Math.max(x, RANK[l]), 0); return RANK[analyze(r.deal).overall] < w; });
  return bad.length === 0 || `${bad.length} deals, e.g. seeds ${seeds(bad)}`;
});
test('real memo text passes the memo-text check (no false alarms)', () => {
  const bad = [];
  for (const r of clean) { const f = checkMemoText(memoText(r.deal), r.deal).filter((i) => i.level === 'fail'); if (f.length) bad.push({ seed: r.seed, t: f[0].title }); }
  return bad.length === 0 || `${bad.length} false alarms, e.g. ${bad.slice(0, 3).map((b) => `#${b.seed} ${b.t}`).join(' | ')}`;
});
for (const [prof, want] of [['strong', 'green'], ['mid', 'yellow'], ['weak', 'red']]) {
  test(`${prof} deals rate ${want.toUpperCase()}`, () => {
    const n = Math.max(30, Math.round(COUNT / 5));
    const got = Array.from({ length: n }, (_, i) => analyze(gen(i + 9000, { profile: prof }).deal).overall);
    const pct = got.filter((x) => x === want).length / n;
    console.log(`      (${Math.round(pct * 100)}% of ${n} ${prof} deals rated ${want})`);
    return pct >= 0.9 || `only ${Math.round(pct * 100)}% rated ${want}`;
  });
}
test('worsening a random deal never improves a rating', () => {
  const patches = [
    (d) => { d.totalEquity = String(Math.round(Number(d.totalEquity) * 0.5)); },
    (d) => { d.totalLiabilities = String(Number(d.totalLiabilities) * 2 + 500000); },
    (d) => { d.cash = String(Math.round(Number(d.cash) * 0.2)); },
    (d) => { d.exitProceeds = String(Math.round(Number(d.exitProceeds) * 0.6)); },
    (d) => { d.yearsExperience = String(Math.max(0, Number(d.yearsExperience) - 5)); },
    (d) => { d.interestRate = String(Number(d.interestRate) + 6); },
    (d) => { d.bipocOwned = 'No'; d.impactArea = 'No'; d.growthPlan = ''; d.jobsCreated = '0'; },
  ];
  let bad = 0, first = '';
  for (const r of clean.slice(0, Math.min(COUNT, 200))) {
    const a = analyze(r.deal);
    for (const [k, p] of patches.entries()) {
      const d = structuredClone(r.deal); p(d); const b = analyze(d);
      const worseOnly = RANK[b.overall] >= RANK[a.overall] && a.merits.every((m) => RANK[b.merits.find((x) => x.label === m.label).level] >= RANK[m.level]);
      if (!worseOnly) { bad++; first ||= `seed #${r.seed}, change ${k}`; }
    }
  }
  return bad === 0 || `${bad} cases improved, first: ${first}`;
});
{
  const types = Object.keys(MISTAKES);
  const stats = Object.fromEntries(types.map((t) => [t, { planted: 0, caught: 0 }]));
  const missed = [];
  const n = Math.max(40, Math.round(COUNT / 2));
  for (let i = 0; i < n; i++) {
    const r = gen(i + 50000, { profile: 'any', mistakes: 1 + (i % 3) });
    const found = verifyAll(r.deal).items;
    for (const p of r.planted) {
      stats[p.type].planted++;
      if (found.some((it) => it.level === p.level && p.re.test(it.title))) stats[p.type].caught++;
      else missed.push(`#${r.seed} ${p.type}`);
    }
  }
  test(`every planted mistake is caught (${n} deals, 1-3 mistakes each)`, () => {
    for (const t of types) console.log(`      ${t.padEnd(22)} ${stats[t].caught}/${stats[t].planted} caught`);
    return missed.length === 0 || `${missed.length} missed, e.g. ${missed.slice(0, 4).join(', ')}`;
  });
}
test('hand-edited memo numbers are caught on random deals', () => {
  let miss = 0;
  for (const r of clean.slice(0, Math.min(COUNT, 100))) {
    const edited = memoText(r.deal).replace(new RegExp('\\$' + Number(r.deal.loanAmount).toLocaleString('en-US') + '(?![\\d,])'), '$' + (Number(r.deal.loanAmount) + 12345).toLocaleString('en-US'));
    if (!checkMemoText(edited, r.deal).some((i) => i.level === 'fail')) miss++;
  }
  return miss === 0 || `${miss}/100 edits not caught`;
});
test('chaotic deals (blanks, extremes, odd text): no crash, no NaN/undefined in the memo', () => {
  const bad = [];
  for (let i = 0; i < Math.max(60, Math.round(COUNT / 4)); i++) {
    const r = gen(i + 80000, { profile: 'chaotic' });
    const v = verifyAll(r.deal, memoText(r.deal));
    const err = v.items.find((it) => it.area === 'Checks');
    const text = memoText(r.deal);
    const junk = text.match(/NaN|undefined|\[object|Infinity/);
    if (err) bad.push(`#${r.seed} checker error: ${err.detail}`);
    else if (junk) bad.push(`#${r.seed} memo shows "${junk[0]}"`);
  }
  return bad.length === 0 || `${bad.length} problems, e.g. ${bad.slice(0, 3).join(' | ')}`;
});
{
  const hidden = clean.filter((r) => { const a = analyze(r.deal); return a.flags.some((f) => f.level === 'red') && a.overall !== 'red'; });
  console.log(`      (info: ${hidden.length}/${COUNT} random deals have a Red item but a non-Red overall rating; ${hidden.filter((r) => checkRatings(r.deal).some((i) => i.level === 'warn')).length} flagged as warnings)`);
}

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
