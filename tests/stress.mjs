// Stress tests for the memo checks. Run with:  npm run stress
// Uses made-up deals only. No AI or network needed.
import { sampleDeal, emptyDeal } from '../src/lib/sampleDeal.js';
import { analyze } from '../src/lib/analysis.js';
import { verifyAll } from '../src/lib/verify/index.js';
import { rateIndependent, checkRatings, RANK } from '../src/lib/verify/ratings.js';
import { checkMemoText } from '../src/lib/verify/memoText.js';
import { randomDeal, MISTAKES, MAX_MISTAKES, CHAOS } from '../src/lib/randomDeal.js';
import { readFactsFromHtml, applyFacts, htmlToText } from '../src/lib/verify/memoFacts.js';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

// Renders the real memo screen to plain text (no browser needed)
const vite = await createServer({ root: new URL('..', import.meta.url).pathname, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const Memo = (await vite.ssrLoadModule('/src/components/Memo.jsx')).default;
const memoHtml = (deal) => renderToStaticMarkup(React.createElement(Memo, { deal }));
const memoText = (deal) => htmlToText(renderToStaticMarkup(React.createElement(Memo, { deal })));

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

// ---------------------------------------------------------------- 3b. Fixing the memo by hand, then re-checking
section('3b. Hand-fixing the memo and re-checking (the report must follow the memo)');
const bad = mut({ loanAmount: '800000' }); // loan uses add to $750,000, so loan != uses
const html0 = memoHtml(bad);
const recheck = (html, deal = bad) => verifyAll(deal, htmlToText(html), readFactsFromHtml(html));
const editLoan = (html, fn) => { let n = 0; return html.replace(/\$800,000/g, () => fn(n++)); }; // every printed mention of the $800,000 loan
const editFact = (html, fact, fn) => html.replace(new RegExp(`(<(\\w+)[^>]*\\sdata-fact="${fact}"[^>]*>)(.*?)(</\\2>)`, 'g'), (m, open, tag, inner, close) => open + fn(inner) + close);
test('the loan amount is found in all 6 places the memo states it', () => readFactsFromHtml(html0).fields.loanAmount.length === 6 || readFactsFromHtml(html0).fields.loanAmount.length);
test('before any edit: "loan uses do not equal the loan amount" is reported', () => recheck(html0).items.some((i) => /Loan uses do not equal/.test(i.title)));
test('changing the loan amount everywhere to match the uses clears that flag', () => {
  const r = recheck(editLoan(html0, () => '$750,000'));
  return (!r.items.some((i) => /Loan uses do not equal/.test(i.title)) && r.items.some((i) => i.level === 'pass' && /Loan uses equal/.test(i.title))) || 'flag still there';
});
test('...and says the memo now differs from the deal form (warning, not a failure)', () => {
  const r = recheck(editLoan(html0, () => '$750,000'));
  return (r.items.some((i) => i.level === 'warn' && /differs from the deal form/.test(i.title)) && r.counts.fail === 0) || JSON.stringify(r.items.filter((i) => i.level !== 'pass').map((i) => i.level + ' ' + i.title));
});
test('changing only ONE mention of the loan amount is caught', () => {
  const r = recheck(editLoan(html0, (n) => (n === 0 ? '$750,000' : '$800,000')));
  return r.items.some((i) => i.level === 'fail' && /differs across the memo/.test(i.title));
});
test('fixing the loan-uses table instead (so it adds to $800,000) also clears the flag', () => {
  let n = 0;
  const r = recheck(editFact(html0, 'loanUse', (t) => (n++ === 0 ? '$' + (Number(t.replace(/[^0-9]/g, '')) + 50000).toLocaleString('en-US') : t)));
  return !r.items.some((i) => /Loan uses do not equal/.test(i.title)) || 'flag still there';
});
test('an amount not in the data at all ($999,999 everywhere) is flagged as "not anywhere in your data"', () => {
  const r = recheck(editLoan(html0, () => '$999,999'));
  return r.items.some((i) => i.area === 'Memo vs form' && /not anywhere in your deal data/.test(i.detail)) || 'not flagged';
});
test('typing the amount without $ or commas (750000) is still read', () => {
  const r = recheck(editLoan(html0, () => '750000'));
  return r.items.some((i) => /Loan uses equal/.test(i.title)) || 'not read';
});
test('rewording one sentence is reported as "found in only 5 of 6 places"', () => {
  const r = recheck(html0.replace('enterprise loan', 'financing request').replace(/\$800,000/, (m) => m));
  return r.items.some((i) => /only 5 of 6/.test(i.title)) || JSON.stringify(r.items.filter((i) => i.area === 'Memo vs form').map((i) => i.title));
});
test('negative cash shown in the memo can be corrected by typing in the memo', () => {
  const d = mut({ cash: '-5000' });
  const h = memoHtml(d);
  if (!/Cash on hand of \$-5,000\./.test(htmlToText(h))) return 'negative cash is not shown in the memo';
  const before = recheck(h, d).items.some((i) => /Negative amount/.test(i.title) && i.level === 'fail');
  const after = recheck(h.replace('$-5,000', '$150,000'), d).items.some((i) => /Negative amount/.test(i.title) && i.level === 'fail');
  return (before && !after) || `before ${before}, after ${after}`;
});
test('re-checking an untouched memo changes nothing', () => JSON.stringify(recheck(html0).counts) === JSON.stringify(verifyAll(bad, memoText(bad), readFactsFromHtml(html0)).counts));

// ---------------------------------------------------------------- 3c. Reading the memo back
section('3c. Reading an untouched memo back reproduces the form exactly');
const gen0 = (i, o) => randomDeal(990000 + i, o);
test('300 clean deals: nothing differs, nothing conflicts', () => {
  const bad = [];
  for (let i = 0; i < 300; i++) { const d = gen0(i, { profile: 'any' }).deal; const ap = applyFacts(d, readFactsFromHtml(memoHtml(d))); if (ap.diffs.length || ap.conflicts.length) bad.push(`#${990000 + i}: ${[...ap.diffs.map((x) => x.label + ' ' + x.memo + '/' + x.form), ...ap.conflicts.map((c) => c.label + ' ' + c.values)].join('; ')}`); }
  return bad.length === 0 || `${bad.length} deals, e.g. ${bad.slice(0, 3).join(' | ')}`;
});
test('150 chaotic deals (blanks, extremes): nothing differs, nothing conflicts', () => {
  const bad = [];
  for (let i = 0; i < 150; i++) { const d = gen0(i + 5000, { profile: 'chaotic' }).deal; const ap = applyFacts(d, readFactsFromHtml(memoHtml(d))); if (ap.diffs.length || ap.conflicts.length) bad.push(`#${990000 + 5000 + i}: ${[...ap.diffs.map((x) => x.label + ' ' + x.memo + '/' + x.form), ...ap.conflicts.map((c) => c.label + ' ' + c.values)].join('; ')}`); }
  return bad.length === 0 || `${bad.length} deals, e.g. ${bad.slice(0, 3).join(' | ')}`;
});

// ---------------------------------------------------------------- 3d. The rule: fixing it in the memo clears the flag
section('3d. Fix it in the memo, re-check, and the flag must go away (every kind of mistake)');
for (const [type, m] of Object.entries(MISTAKES)) {
  test(`${type}: flagged with the mistake in the form; gone once the memo is correct`, () => {
    let shown = 0, stuck = [];
    for (let i = 0; i < 60; i++) {
      const good = gen0(i + 20000, { profile: 'any' }).deal;
      const mistaken = structuredClone(good); m.apply(mistaken);
      const htmlGood = memoHtml(good);
      const before = verifyAll(mistaken, memoText(mistaken), readFactsFromHtml(memoHtml(mistaken))).items;
      if (!before.some((it) => it.level === m.level && m.re.test(it.title))) return `seed #${990000 + 20000 + i}: not flagged to begin with`;
      shown++;
      // the underwriter corrects the memo: it now reads like the correct deal, while the form still holds the mistake
      const after = verifyAll(mistaken, htmlToText(htmlGood), readFactsFromHtml(htmlGood)).items;
      if (after.some((it) => it.level !== 'pass' && it.area !== 'Memo vs form' && m.re.test(it.title))) stuck.push(`#${990000 + 20000 + i}`);
    }
    return stuck.length === 0 || `still flagged after fixing the memo in ${stuck.length}/${shown} deals, e.g. ${stuck.slice(0, 3).join(', ')}`;
  });
}
test(`all ${MAX_MISTAKES} kinds of mistake planted at once: every one is caught`, () => {
  const miss = [];
  for (let i = 0; i < 80; i++) {
    const r = gen0(i + 40000, { profile: 'any', mistakes: MAX_MISTAKES });
    if (r.planted.length !== MAX_MISTAKES) return `planted ${r.planted.length}, expected ${MAX_MISTAKES}`;
    const items = verifyAll(r.deal, memoText(r.deal), readFactsFromHtml(memoHtml(r.deal))).items;
    for (const p of r.planted) if (!items.some((it) => it.level === p.level && p.re.test(it.title))) miss.push(`#${r.seed} ${p.type}`);
  }
  return miss.length === 0 || `${miss.length} missed, e.g. ${miss.slice(0, 4).join(', ')}`;
});
test(`...and fixing the memo clears all ${MAX_MISTAKES} at once`, () => {
  const stuck = [];
  for (let i = 0; i < 80; i++) {
    const good = gen0(i + 40000, { profile: 'any' }).deal;
    const bad = gen0(i + 40000, { profile: 'any', mistakes: MAX_MISTAKES });
    // same seed => same underlying deal; the memo of the correct deal is the "fixed" memo
    const hg = memoHtml(good);
    const after = verifyAll(bad.deal, htmlToText(hg), readFactsFromHtml(hg)).items;
    for (const p of bad.planted) if (after.some((it) => it.level !== 'pass' && it.area !== 'Memo vs form' && p.re.test(it.title))) stuck.push(`#${bad.seed} ${p.type}`);
  }
  return stuck.length === 0 || `${stuck.length} still flagged, e.g. ${stuck.slice(0, 4).join(', ')}`;
});
for (const type of ['junk-rate', 'junk-years', 'absurd-loan']) {
  test(`chaos ${type}: flagged in the form; gone once the memo shows the correct value`, () => {
    for (let i = 0; i < 40; i++) {
      const good = gen0(i + 60000, { profile: 'any' }).deal;
      if (type === 'junk-years' && Number(good.yearsExperience) === 0) continue; // junk prints as "0 years", so a true 0 looks identical
      const messy = structuredClone(good); CHAOS[type].apply(messy, { pick: (a) => a[0], int: (a) => a, rnd: Math.random });
      const f0 = verifyAll(messy, memoText(messy), readFactsFromHtml(memoHtml(messy))).items;
      if (!f0.some((it) => it.level === CHAOS[type].level && CHAOS[type].re.test(it.title))) return `seed #${990000 + 60000 + i}: not flagged to begin with`;
      const hg = memoHtml(good);
      const after = verifyAll(messy, htmlToText(hg), readFactsFromHtml(hg)).items;
      if (after.some((it) => it.level !== 'pass' && it.area !== 'Memo vs form' && CHAOS[type].re.test(it.title))) return `seed #${990000 + 60000 + i}: still flagged after fixing the memo`;
    }
    return true;
  });
}
test('fixing ONE of several mentions of the rate leaves a "differs across the memo" failure', () => {
  const d = gen0(31, { profile: 'any' }).deal; const h = memoHtml(d);
  const edited = h.replace(/(\d[\d.]*)(%(?:<\/[^>]+>)*\s+interest)/, (m, n, rest) => (Number(n) + 1) + rest);
  if (edited === h) return 'could not edit the rate in the memo html';
  const v = verifyAll(d, htmlToText(edited), readFactsFromHtml(edited));
  return v.items.some((i) => i.level === 'fail' && /Interest rate differs across the memo/.test(i.title)) || JSON.stringify(v.items.filter((i) => i.level !== 'pass').map((i) => i.title));
});

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
  for (const r of clean) { const h = memoHtml(r.deal); const f = recheck(h, r.deal).items.filter((i) => i.level === 'fail'); if (f.length) bad.push({ seed: r.seed, t: f[0].title }); }
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
    const r = gen(i + 50000, { profile: 'any', mistakes: 1 + (i % MAX_MISTAKES) });
    const found = verifyAll(r.deal).items;
    for (const p of r.planted) {
      stats[p.type].planted++;
      if (found.some((it) => it.level === p.level && p.re.test(it.title))) stats[p.type].caught++;
      else missed.push(`#${r.seed} ${p.type}`);
    }
  }
  test(`every planted mistake is caught (${n} deals, 1 to ${MAX_MISTAKES} mistakes each)`, () => {
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
const caught = (p, items) => (p.test ? p.test(items) : items.some((it) => it.level === p.level && p.re.test(it.title)));
test('Chaotic deals: EVERY anomaly is flagged (junk numbers, absurd amounts, odd text, blanks, jumps), with 0-10 planted mistakes mixed in', () => {
  const n = Math.max(150, Math.round(COUNT / 2));
  const stats = {}; const missed = []; let flags = 0, fewest = 99;
  for (let i = 0; i < n; i++) {
    const r = gen(i + 70000, { profile: 'chaotic', mistakes: i % (MAX_MISTAKES + 1) });
    const items = verifyAll(r.deal, memoText(r.deal), readFactsFromHtml(memoHtml(r.deal))).items;
    const nf = items.filter((it) => it.level !== 'pass').length; flags += nf; fewest = Math.min(fewest, nf);
    for (const p of r.planted) {
      const key = p.type.startsWith('blank-') ? 'blank-field' : p.type;
      (stats[key] ||= { planted: 0, caught: 0 }).planted++;
      if (caught(p, items)) stats[key].caught++; else missed.push(`#${r.seed} ${p.type}`);
    }
  }
  for (const [k, v] of Object.entries(stats)) console.log(`      ${k.padEnd(22)} ${v.caught}/${v.planted} flagged`);
  console.log(`      (an average chaotic deal raises ${(flags / n).toFixed(1)} findings; the quietest raised ${fewest})`);
  return missed.length === 0 || `${missed.length} anomalies NOT flagged, e.g. ${missed.slice(0, 4).join(', ')}`;
});
test('a chaotic deal is never quiet: at least 5 findings every time', () => {
  for (let i = 0; i < 100; i++) { const r = gen(i + 71000, { profile: 'chaotic' }); const k = verifyAll(r.deal, memoText(r.deal), readFactsFromHtml(memoHtml(r.deal))).items.filter((it) => it.level !== 'pass').length; if (k < 5) return `seed #${r.seed} raised only ${k}`; }
  return true;
});
test('clean strong and medium deals raise no data-quality or unusual-value warnings (no noise)', () => {
  const noisy = clean.filter((r) => r.profile !== 'weak').filter((r) => verifyAll(r.deal).items.some((it) => it.level !== 'pass' && ['Atypical', 'Data quality'].includes(it.area)));
  return noisy.length === 0 || `${noisy.length} clean deals flagged, e.g. #${noisy[0].seed}: ${verifyAll(noisy[0].deal).items.find((it) => it.level !== 'pass' && ['Atypical', 'Data quality'].includes(it.area)).title}`;
});
test('the memo showing "NaN" or "undefined" is itself flagged', () => {
  const t = 'The loan is $750,000 and annual interest is NaN.';
  return checkMemoText(t, base()).some((i) => i.level === 'fail' && /broken text/.test(i.title));
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
