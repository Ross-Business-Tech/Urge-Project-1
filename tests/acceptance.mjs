// Acceptance tests: one row per example, with the EXPECTED answer written down before running.
// Every example runs through the app's real code (memo writer, rating rules, verification,
// spreadsheet import/export, the server's password lock). Made-up data only.
//
//   npm run build && node tests/acceptance.mjs            -> prints the score
//   node tests/acceptance.mjs --json deliverables/test-results.json
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { sampleDeal, emptyDeal } from '../src/lib/sampleDeal.js';
import { analyze, suggestStage } from '../src/lib/analysis.js';
import { verifyAll } from '../src/lib/verify/index.js';
import { checkMemoText } from '../src/lib/verify/memoText.js';
import { htmlToText } from '../src/lib/verify/memoFacts.js';
import { dealToCsv, dealFromCsv } from '../src/lib/csv.js';
import { prose } from '../src/lib/prose.js';

const root = new URL('..', import.meta.url).pathname;
const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const Memo = (await vite.ssrLoadModule('/src/components/Memo.jsx')).default;
const memoText = (deal) => htmlToText(renderToStaticMarkup(React.createElement(Memo, { deal })));

const base = () => structuredClone(sampleDeal);
const mut = (patch) => ({ ...base(), ...patch });
const findings = (deal, text) => verifyAll(deal, text ?? memoText(deal)).items.filter((i) => i.level !== 'pass');
const has = (items, level, re) => items.some((i) => i.level === level && re.test(i.title));
const money = (n) => '$' + Math.round(n).toLocaleString('en-US');
const k = (n) => `$${Math.round(n / 1000)}K`;

const rows = [];
async function test(id, area, input, expected, run) {
  let actual = '', pass = false;
  try { [actual, pass] = await run(); } catch (e) { actual = `Error: ${e.message}`; }
  rows.push({ id, area, input, expected, actual, result: pass ? 'PASS' : 'FAIL' });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}  ${input}\n        expected: ${expected}\n        actual:   ${actual}`);
}

// ---------------------------------------------------------------- Ratings (Red / Yellow / Green)
await test('R1', 'Ratings', 'Sample deal (made up): 9 yrs experience, debt-to-equity 2.5x after loan, refinance covers 1.22x', 'Overall YELLOW', () => {
  const o = analyze(base()).overall; return [`Overall ${o.toUpperCase()}`, o === 'yellow'];
});
const steady = [{ year: '2024', type: 'Actual', revenue: '1000000', netIncome: '100000' }, { year: '2025', type: 'Actual', revenue: '1100000', netIncome: '120000' }, { year: '2026', type: 'Projected', revenue: '1200000', netIncome: '130000' }];
const strong = { yearsExperience: '15', totalLiabilities: '400000', totalEquity: '2000000', cash: '900000', exitProceeds: '2000000', exitMonth: '24', walkScore: '90' };
await test('R2', 'Ratings', 'Strong deal: 15 yrs experience, low debt, $900K cash, $2M proceeds, Walk Score 90, steady ~10%/yr revenue growth', 'Overall GREEN', () => {
  const o = analyze(mut({ ...strong, financials: steady })).overall; return [`Overall ${o.toUpperCase()}`, o === 'green'];
});
await test('R7', 'Ratings', 'Same strong deal, but the borrower projects revenue jumping 61% in one year', 'Overall YELLOW: red flag "projected revenue growth looks aggressive"', () => {
  const a = analyze(mut(strong)); const f = a.flags.find((x) => x.area === 'Borrower assumptions');
  return [`Overall ${a.overall.toUpperCase()}; ${f ? `${f.level.toUpperCase()}: ${f.title}` : 'no flag'}`, a.overall === 'yellow' && f?.level === 'red'];
});
await test('R3', 'Ratings', 'Weak deal: 2 yrs experience, debt 8x equity, $10K cash, $500K proceeds', 'Overall RED', () => {
  const d = mut({ yearsExperience: '2', totalLiabilities: '4000000', totalEquity: '500000', cash: '10000', exitProceeds: '500000' });
  const o = analyze(d).overall; return [`Overall ${o.toUpperCase()}`, o === 'red'];
});
await test('R4', 'Ratings', 'Borrower has completed $500K of development, no stage picked', 'Suggested stage Early-emerging; "Emerging developer" criterion GREEN', () => {
  const d = mut({ developerStage: '', tdcCompleted: '500000' }); const a = analyze(d);
  return [`Suggested ${suggestStage(d)}; criterion ${a.mission[0].level.toUpperCase()}`, suggestStage(d) === 'Early-emerging' && a.mission[0].level === 'green'];
});
await test('R5', 'Ratings', 'Borrower has completed $25M of development, no stage picked', 'Suggested stage Established; criterion YELLOW', () => {
  const d = mut({ developerStage: '', tdcCompleted: '25000000' }); const a = analyze(d);
  return [`Suggested ${suggestStage(d)}; criterion ${a.mission[0].level.toUpperCase()}`, suggestStage(d) === 'Established' && a.mission[0].level === 'yellow'];
});
await test('R6', 'Ratings', 'Project cash flow: net operating income only 0.9x debt service', 'Red flag "Project cash flow"', () => {
  const d = mut({ projectProjections: [{ year: '2028', revenue: '500000', expenses: '200000', debtService: '333000' }] });
  const f = analyze(d).flags.find((x) => x.area === 'Project cash flow'); return [f ? `${f.level.toUpperCase()}: ${f.title}` : 'no flag', f?.level === 'red'];
});

// ---------------------------------------------------------------- Catching mistakes (verification report)
await test('V1', 'Verification', 'Project sources total $5M more than uses', 'Failed check: sources and uses do not balance', () => {
  const i = findings(mut({ projectSources: [{ label: 'Bank', amount: '5000000' }] })); const ok = has(i, 'fail', /do not balance/);
  return [ok ? 'Failed check: sources and uses do not balance' : i.map((x) => x.title).join('; '), ok];
});
await test('V2', 'Verification', 'Repayment expected in month 48 on a 36-month loan', 'Failed check: repayment after the loan matures', () => {
  const i = findings(mut({ exitMonth: '48' })); const ok = has(i, 'fail', /after the loan matures/); return [ok ? 'Failed check: repayment after maturity' : 'not caught', ok];
});
await test('V3', 'Verification', 'Interest rate typed as 85 instead of 8.5', 'Warning: interest rate looks wrong', () => {
  const i = findings(mut({ interestRate: '85' })); const ok = has(i, 'warn', /Interest rate looks wrong/); return [ok ? 'Warning: interest rate looks wrong' : 'not caught', ok];
});
await test('V4', 'Verification', 'Balance sheet: equity typed as $5M (assets don’t add up)', 'Failed check: balance sheet does not balance', () => {
  const i = findings(mut({ totalEquity: '5000000' })); const ok = has(i, 'fail', /Balance sheet/); return [ok ? 'Failed check: balance sheet' : 'not caught', ok];
});
await test('V5', 'Verification', 'Underwriter edits the memo: loan $750,000 changed to $570,000 in one place', 'Failed check: $570,000 is not in the deal data', () => {
  const t = memoText(base()).replace('$750,000', '$570,000'); const i = checkMemoText(t, base());
  const ok = i.some((x) => x.level === 'fail' && x.title.includes('$570,000')); return [ok ? 'Failed check: $570,000 not in deal data' : 'not caught', ok];
});
await test('V6', 'Verification', 'An invented figure ($9,999,999) is typed into the memo', 'Failed check: figure not in the deal data', () => {
  const i = checkMemoText(memoText(base()) + ' Expected sale price $9,999,999.', base()); const ok = i.some((x) => x.level === 'fail');
  return [ok ? 'Failed check: $9,999,999 not in deal data' : 'not caught', ok];
});
await test('V7', 'Verification', 'Untouched sample memo', 'No failed checks; every figure traces to the deal data', () => {
  const t = memoText(base()); const bad = checkMemoText(t, base()).filter((x) => x.level === 'fail'); const fails = verifyAll(base(), t).counts.fail;
  return [`${fails} failed checks; ${bad.length ? bad.map((b) => b.title).join('; ') : 'all figures trace'}`, fails === 0 && bad.length === 0];
});

// ---------------------------------------------------------------- Memo content
await test('M1', 'Memo', '$750,000 at 8.5%: interest-only 24 months, then 15-year amortization, 60-month term', 'Interest-only ~$5,313/mo; then ~$7,386/mo from month 25', () => {
  const t = memoText(mut({ repaymentStructure: 'Interest-only period, then amortizing', interestOnlyMonths: '24', amortizationYears: '15', termMonths: '60' }));
  const ok = /interest-only payments of approximately \$5,313 for the first 24 months/.test(t) && /approximately \$7,386 based on a 15-year amortization schedule commencing in month 25/.test(t);
  return [ok ? 'IO $5,313 for 24 months; then $7,386 from month 25' : (t.match(/The loan requires.{0,200}/) || ['not found'])[0], ok];
});
await test('M2', 'Memo', '$750,000 at 8.5%, fully amortizing over 10 years', 'Monthly payment ~$9,299', () => {
  const t = memoText(mut({ repaymentStructure: 'Fully amortizing', interestOnlyMonths: '', amortizationYears: '10' }));
  const ok = /fully amortizing, with monthly principal and interest payments of approximately \$9,299/.test(t); return [ok ? 'Fully amortizing, $9,299/month' : 'not found', ok];
});
await test('M3', 'Memo', 'Reason for loan typed as bullets ("The loan will fund:" + 3 bullets)', 'One paragraph: "The loan will fund: a; b; and c." with no bullet dashes', () => {
  const t = memoText(mut({ loanPurpose: 'The loan will fund:\n- predevelopment costs\n- the sponsor equity gap\n- two staff positions' }));
  const ok = t.includes('The loan will fund: predevelopment costs; the sponsor equity gap; and two staff positions.'); return [ok ? 'Paragraph as expected' : (t.match(/The loan will fund.{0,120}/) || ['not found'])[0], ok];
});
await test('M4', 'Memo', 'Project type "Other" typed as "Senior housing with ground-floor clinic"', 'Memo calls it "a senior housing with ground-floor clinic project"', () => {
  const t = memoText(mut({ projectType: 'Other', projectTypeOther: 'Senior housing with ground-floor clinic' }));
  const ok = /is a senior housing with ground-floor clinic project/.test(t); return [ok ? 'Typed project type used' : 'not found', ok];
});
await test('M5', 'Memo', 'Collateral and guarantee entered in separate boxes', 'Loan terms table has separate Collateral and Guarantee rows', () => {
  const t = memoText(base()); const ok = /Collateral Junior lien/.test(t) && /Guarantee Full personal guarantee/.test(t); return [ok ? 'Two separate rows' : 'missing', ok];
});
await test('M6', 'Memo', '18 apartments; affordable: 1 at 50% AMI, 3 at 80% AMI', '"4 of 18 residential units (22%) ... 1 at 50% AMI and 3 at 80% AMI"', () => {
  const t = memoText(base()); const ok = /4 of 18 residential units \(22%\) are designated as affordable: 1 at 50% AMI and 3 at 80% AMI/.test(t);
  return [ok ? 'Affordability sentence as expected' : (t.match(/AFFORDABLE HOUSING COMPONENT.{0,140}/) || ['not found'])[0], ok];
});
await test('M7', 'Memo', 'Extra section "Environmental Review", just this memo, placed after Project Breakdown', 'Section appears right after PROJECT BREAKDOWN', () => {
  const t = memoText(mut({ customSections: [{ title: 'Environmental Review', position: 'breakdown', body: 'Phase I report pending.', templateId: '' }] }));
  const ok = /PROJECT BREAKDOWN.*ENVIRONMENTAL REVIEW Phase I report pending\..*PROJECT SOURCES AND USES/.test(t); return [ok ? 'Placed after Project Breakdown' : 'wrong place or missing', ok];
});
await test('M8', 'Memo', 'Completely blank deal form', 'Memo still renders with "[... to be added]" placeholders; no broken text (NaN/undefined)', () => {
  const t = memoText(structuredClone(emptyDeal)); const broken = /\bNaN\b|\bundefined\b|\[object|Infinity/.test(t); const ph = (t.match(/to be added\]/g) || []).length;
  return [`${ph} placeholders; broken text: ${broken ? 'yes' : 'none'}`, !broken && ph > 5];
});
await test('M9', 'Memo', 'Borrower track record: $6.5M developed, 12 units, 36,000 sq ft commercial', 'Memo states the track record in Management Experience', () => {
  const t = memoText(base()); const ok = /completed approximately \$6,500,000 of total development, including 12 residential units and 36,000 sq ft of commercial space/.test(t);
  return [ok ? 'Track record sentence present' : 'not found', ok];
});

// ---------------------------------------------------------------- Neighborhood impact (planning ranges)
await test('I1', 'Impact', 'Sample project, $6.8M total cost, default 1.5%–3% tax rate', 'Property taxes $102K–$204K per year', () => {
  const r = analyze(base()).impact.rows.find((x) => x.key === 'propertyTax'); const ok = Math.round(r.low) === 102000 && Math.round(r.high) === 204000;
  return [`${k(r.low)}–${k(r.high)} per year`, ok];
});
await test('I2', 'Impact', '18 units (1 at 50%, 3 at 80% AMI, 14 market), AMI $72,000, 93% occupied', 'Resident household income ~$944K–$1.32M per year', () => {
  const r = analyze(base()).impact.rows.find((x) => x.key === 'householdIncome'); const ok = Math.round(r.low) === 944136 && Math.round(r.high) === 1319112;
  return [`${money(r.low)}–${money(r.high)}`, ok];
});

// ---------------------------------------------------------------- Data in and out
await test('D1', 'Data', 'Save the sample deal as a spreadsheet, then load it again', 'Loaded deal is identical to the saved one', () => {
  const back = dealFromCsv(dealToCsv(base())); const ok = JSON.stringify(Object.keys(back).sort().map((x) => [x, back[x]])) === JSON.stringify(Object.keys(base()).sort().map((x) => [x, base()[x]]));
  return [ok ? 'Identical' : 'Differs', ok];
});
await test('D2', 'Data', 'Uploaded spreadsheet has interest rate "abc"', 'Failed check: interest rate is not a number', () => {
  const d = dealFromCsv(dealToCsv(base()).replace('interestRate,8.5', 'interestRate,abc')); const i = findings(d); const ok = has(i, 'fail', /Interest rate is not a number/);
  return [ok ? 'Failed check: not a number' : i.map((x) => x.title).slice(0, 3).join('; '), ok];
});
await test('D3', 'Data', 'Free-text bullets with a person’s initial ("J. Avery founded...")', 'Left as typed (not mistaken for a list)', () => {
  const s = 'J. Avery founded the firm.\nIt grew.'; return [JSON.stringify(prose(s)), prose(s) === s];
});

// ---------------------------------------------------------------- Security (live server, run locally)
async function withServer(env, fn) {
  const port = 4900 + Math.floor(Math.random() * 90);
  const p = spawn(process.execPath, ['server.mjs'], { cwd: root, env: { ...process.env, PORT: String(port), ...env }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 900));
  try { return await fn(`http://127.0.0.1:${port}`); } finally { p.kill(); }
}
await test('S1', 'Security', 'Site opened with NO team password set', 'Locked: only "This site is locked" page; AI route refused', () => withServer({ SITE_PASSWORD: '' }, async (b) => {
  const page = await (await fetch(b + '/')).text(); const api = await fetch(b + '/api/news', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } });
  const ok = /This site is locked/.test(page) && api.status === 401; return [`page: ${/This site is locked/.test(page) ? 'locked notice' : 'APP SHOWN'}; AI route: ${api.status}`, ok];
}));
await test('S2', 'Security', 'Password set; visitor types a wrong password, then the right one', 'Wrong: refused (401). Right: signed in, app shown', () => withServer({ SITE_PASSWORD: 'test-password-123' }, async (b) => {
  const wrong = await fetch(b + '/login', { method: 'POST', body: 'password=nope', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, redirect: 'manual' });
  const right = await fetch(b + '/login', { method: 'POST', body: 'password=test-password-123', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, redirect: 'manual' });
  const cookie = (right.headers.get('set-cookie') || '').split(';')[0];
  const app = await (await fetch(b + '/', { headers: { cookie } })).text();
  const ok = wrong.status === 401 && right.status === 303 && /<title>Memo Drafter/.test(app);
  return [`wrong: ${wrong.status}; right: ${right.status}; app after sign-in: ${/<title>Memo Drafter/.test(app) ? 'shown' : 'not shown'}`, ok];
}));
await test('S3', 'Security', 'Signed-out visitor calls the AI route directly', 'Refused (401); AI key never used', () => withServer({ SITE_PASSWORD: 'test-password-123' }, async (b) => {
  const r = await fetch(b + '/api/extract', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } }); return [`${r.status}`, r.status === 401];
}));

await vite.close();

// Checks that need the live site and the AI key: listed for the team to run by hand.
const live = [
  { id: 'L1', area: 'AI document scan', input: 'Upload a made-up term sheet (PDF) with $500,000 loan, 6.5%, 60 months, 36 months interest-only', expected: 'Suggested values: loan amount 500000, rate 6.5, term 60, interest-only 36, each with a quote from the file' },
  { id: 'L2', area: 'AI news search', input: 'Deeper AI search for a well-known Detroit developer and address', expected: 'Recent articles with working source links, each rated red/yellow/green with a reason' },
  { id: 'L3', area: 'AI area description', input: '“Describe the area with AI” for a real Detroit address', expected: '1–2 paragraphs on nearby places, new developments and who they serve; no invented numbers' },
  { id: 'L4', area: 'AI loan sizing', input: 'Sample deal’s four loan sizing points → “Write the loan sizing paragraph with AI”', expected: 'One paragraph using only those points' },
  { id: 'L5', area: 'Free news search', input: '“Search the news” for a real developer and address', expected: 'Articles from the last 3 years that name the borrower or site; lawsuits rated red' },
  { id: 'L6', area: 'Phone', input: 'Open the live link on a phone, sign in, write the sample memo', expected: 'Everything readable; no sideways scrolling; Download for Word works' },
];

const passed = rows.filter((r) => r.result === 'PASS').length;
console.log(`\nSCORE: ${passed} / ${rows.length}`);
const out = process.argv.indexOf('--json');
if (out > 0) {
  const file = process.argv[out + 1];
  mkdirSync(dirname(file), { recursive: true });
  const history = [
    { run: 1, score: '29 / 30', note: 'R2 failed: the "strong deal" example still contained the sample deal’s 61% projected revenue jump, which the app correctly flags as aggressive (so it rated Yellow). The example was incomplete, not the app. Fixed the example (steady growth) and added R7 to test the aggressive-projection case on its own.' },
    { run: 2, score: `${passed} / ${rows.length}`, note: 'Rerun after fixing R2 and adding R7.' },
    { run: 'Extra', score: '2 bugs fixed', note: 'While taking screenshots for the user guide on a laptop-sized screen we found the “Where this came from” card did not appear: (1) it closed itself the moment it opened, and (2) it opened about 10,000 pixels off screen. Phones were not affected. Both fixed in src/components/SourceCard.jsx and re-checked in a browser.' },
  ];
  writeFileSync(file, JSON.stringify({ ranAt: new Date().toISOString(), passed, total: rows.length, rows, live, history }, null, 2));
  console.log(`Wrote ${file}`);
}
process.exit(passed === rows.length ? 0 : 1);
