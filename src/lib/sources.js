// "Where did this number come from?" Explains any number marked in the memo:
// either the Deal data box / spreadsheet row it was typed into, or the math the app did.
import { analyze } from './analysis.js';
import { num, has, money, pct } from './format.js';
import { safeUrl } from './news.js';

// Labels and sections match the Deal data page (DealForm.jsx).
const S = {
  1: '1. Memo details', 2: '2. Borrower', 3: '3. Loan request', 4: '4. Project',
  5: '5. Firm financials', 6: '6. Loan sizing & repayment', 7: '7. News check', 8: '8. Development team',
};
export const FIELDS = {
  fundName: ['Fund name', 1], memoDate: ['Memo date', 1], preparedBy: ['Prepared by', 1], committee: ['Investment committee', 1],
  firmName: ['Borrower firm name', 2], hqCity: ['Firm location', 2], principalName: ['Principal name', 2], principalTitle: ['Principal title', 2],
  yearsExperience: ['Years of experience', 2], projectsCompleted: ['Projects completed', 2], bipocOwned: ['BIPOC-owned firm?', 2],
  principalBio: ['Principal bio / background', 2], orgStructure: ['Organizational structure', 2],
  loanAmount: ['Loan amount', 3], interestRate: ['Interest rate', 3], termMonths: ['Term (months)', 3], originationFee: ['Origination fee', 3],
  repaymentStructure: ['Repayment structure', 3], loanPurpose: ['Reason for loan', 3], collateral: ['Collateral / guarantees', 3],
  urgeUses: ['How the loan will be used', 3],
  projectName: ['Project name', 4], projectAddress: ['Location / address', 4], assetType: ['Property type', 4], squareFeet: ['Size (sq ft)', 4],
  totalProjectCost: ['Total project cost', 4], walkScore: ['Walk Score', 4], neighborhood: ['What’s around the site', 4],
  impactArea: ['In a neighborhood impact area?', 4], jobsCreated: ['Jobs created / supported', 4], growthPlan: ['Growth plan', 4],
  projectSources: ['Project sources (overall financing)', 4], projectUses: ['Project uses', 4],
  financials: ['Revenue and net income by year', 5], totalAssets: ['Total assets', 5], totalLiabilities: ['Total liabilities', 5],
  totalEquity: ['Total equity', 5], cash: ['Cash on hand', 5], ownerSharePct: ['Principal’s ownership of firm', 5],
  exitProceeds: ['Expected proceeds to repay loan', 6], exitMonth: ['Expected in month', 6],
  repaymentOptions: ['Ways the fund gets repaid', 6], news: ['News items for the memo', 7], team: ['Team members', 8],
};
const COLS = { amount: 'amount', revenue: 'revenue', netIncome: 'net income', label: 'item', year: 'year' };

const MONEY = new Set(['amount', 'revenue', 'netIncome', 'loanAmount', 'totalProjectCost', 'totalAssets', 'totalLiabilities', 'totalEquity', 'cash', 'exitProceeds']);
const PCT = new Set(['interestRate', 'originationFee', 'ownerSharePct']);
const fieldLabel = (f) => FIELDS[f]?.[0] || f;

// Where a typed-in value came from, based on how the deal was loaded.
function whereFrom(field, rowKey, origins = {}) {
  const section = FIELDS[field] ? `Deal data page, section ${S[FIELDS[field][1]]}` : 'Deal data page';
  if (origins.typed?.[field]) return { kind: 'typed', text: `Typed on the ${section}` };
  if (origins.kind === 'file') {
    const line = origins.lines?.[rowKey] ?? origins.lines?.[field];
    if (line) return { kind: 'file', text: `Uploaded spreadsheet “${origins.fileName}”, row ${line}` };
    if (/\.json$/i.test(origins.fileName || '')) return { kind: 'file', text: `Uploaded file “${origins.fileName}”` };
    return { kind: 'file', text: `Not in the uploaded file “${origins.fileName}”. Default value from the ${section}` };
  }
  if (origins.kind === 'sample') return { kind: 'sample', text: `Made-up sample deal (the “Try a sample deal” button), ${section}` };
  return { kind: 'typed', text: `Typed on the ${section}` };
}

// One input that feeds a number: "projectSources.2.amount" or "loanAmount".
function input(ref, deal, origins, shown) {
  const [field, i, col] = ref.split('.');
  const row = i !== undefined ? deal[field]?.[Number(i)] : null;
  const raw = row ? row[col] : deal[field];
  let label = fieldLabel(field);
  if (row) {
    const name = row.label || row.year || row.name || `row ${Number(i) + 1}`;
    label = `${label}: ${name}${col && COLS[col] && col !== 'amount' ? ` (${COLS[col]})` : ''}`;
  }
  return {
    label,
    value: shown ?? (!has(raw) ? 'blank' : MONEY.has(col || field) ? money(raw) : PCT.has(field) ? `${num(raw)}%` : String(raw)),
    where: whereFrom(field, row ? `${field}.${i}` : field, origins),
    focus: field,
  };
}

const fx = (n) => (n === null || n === undefined ? '–' : `${n.toFixed(2)}x`);
const yr = (deal, y) => (deal.financials || []).find((r) => String(r.year) === String(y));

// Every number the app calculates: what it is, the math with real values, and its inputs.
const CALCS = {
  fee: (d, a) => ({ label: 'Origination fee in dollars', formula: `${money(a.loan)} loan × ${num(d.originationFee)}% fee = ${money(a.fee)}`, inputs: ['loanAmount', 'originationFee'] }),
  annualInterest: (d, a) => ({ label: 'Interest per year', formula: `${money(a.loan)} loan × ${num(d.interestRate)}% rate = ${money(a.annualInterest)} per year`, inputs: ['loanAmount', 'interestRate'] }),
  monthlyInterest: (d, a) => ({ label: 'Interest per month', formula: `${money(a.annualInterest)} per year ÷ 12 = ${money(a.annualInterest / 12)} per month`, inputs: ['loanAmount', 'interestRate'] }),
  totalInterest: (d, a) => ({ label: 'Total interest over the loan', formula: `${money(a.annualInterest)} per year × ${a.years.toFixed(2).replace(/\.00$/, '')} years (${a.term} months) = ${money(a.totalInterest)}`, inputs: ['loanAmount', 'interestRate', 'termMonths'] }),
  totalOwed: (d, a) => ({ label: 'Total owed (principal + interest)', formula: `${money(a.loan)} principal + ${money(a.totalInterest)} interest = ${money(a.totalOwed)}`, inputs: ['loanAmount', 'interestRate', 'termMonths'] }),
  tableTotal: (d, a, t) => ({ label: `Total of “${fieldLabel(t)}”`, formula: `${(d[t] || []).map((r) => money(r.amount)).join(' + ') || 'no rows'} = ${money((d[t] || []).reduce((s, r) => s + num(r.amount), 0))}`, inputs: (d[t] || []).map((_, i) => `${t}.${i}.amount`) }),
  rowShare: (d, a, t, i) => {
    const total = (d[t] || []).reduce((s, r) => s + num(r.amount), 0);
    const r = d[t]?.[Number(i)] || {};
    return { label: `Share of total: ${r.label || 'row'}`, formula: `${money(r.amount)} ÷ ${money(total)} total = ${pct(num(r.amount) / (total || 1), 0)}`, inputs: [`${t}.${i}.amount`] };
  },
  srcUseGap: (d, a) => ({ label: 'Gap between sources and uses', formula: `${money(a.srcTotal)} sources − ${money(a.useTotal)} uses = ${money(Math.abs(a.srcTotal - a.useTotal))} difference`, inputs: ['projectSources', 'projectUses'] }),
  projectCost: (d, a) => has(d.totalProjectCost)
    ? { label: 'Total project cost', formula: `Taken straight from “Total project cost”: ${money(a.projectCost)}`, inputs: ['totalProjectCost'] }
    : { label: 'Total project cost', formula: `“Total project cost” was blank, so the app added up the Project uses table: ${money(a.projectCost)}`, inputs: ['projectUses'] },
  loanShareOfProject: (d, a) => ({ label: 'Loan as a share of project cost', formula: `${money(a.loan)} loan ÷ ${money(a.projectCost)} project cost = ${pct(a.loanShareOfProject)}`, inputs: ['loanAmount', has(d.totalProjectCost) ? 'totalProjectCost' : 'projectUses'] }),
  debtToEquity: (d, a) => ({ label: 'Debt-to-equity today', formula: `${money(a.liabilities)} liabilities ÷ ${money(a.equity)} equity = ${fx(a.debtToEquity)}`, inputs: ['totalLiabilities', 'totalEquity'] }),
  debtToEquityAfter: (d, a) => ({ label: 'Debt-to-equity after this loan', formula: `(${money(a.liabilities)} liabilities + ${money(a.loan)} loan) ÷ ${money(a.equity)} equity = ${fx(a.debtToEquityAfter)}`, inputs: ['totalLiabilities', 'loanAmount', 'totalEquity'] }),
  cashMonthsInterest: (d, a) => ({ label: 'Months of interest covered by cash', formula: `${money(a.cash)} cash ÷ ${money(a.annualInterest / 12)} monthly interest = ${a.cashMonthsInterest?.toFixed(0)} months`, inputs: ['cash', 'loanAmount', 'interestRate'] }),
  repaymentCoverage: (d, a) => ({ label: 'Repayment coverage', formula: `${money(a.exitProceeds)} expected proceeds ÷ ${money(a.totalOwed)} total owed = ${fx(a.repaymentCoverage)}`, inputs: ['exitProceeds', 'loanAmount', 'interestRate', 'termMonths'] }),
  margin: (d, a, y) => {
    const r = yr(d, y) || {};
    const i = (d.financials || []).indexOf(r);
    return { label: `Profit margin, ${y}`, formula: `${money(r.netIncome)} net income ÷ ${money(r.revenue)} revenue = ${num(r.revenue) ? pct(num(r.netIncome) / num(r.revenue)) : '–'}`, inputs: [`financials.${i}.netIncome`, `financials.${i}.revenue`] };
  },
  growth: (d, a, y) => {
    const list = d.financials || [];
    const i = list.findIndex((r) => String(r.year) === String(y));
    const prev = list[i - 1] || {}, cur = list[i] || {};
    return { label: `Revenue growth, ${y}`, formula: `${money(cur.revenue)} (${y}) ÷ ${money(prev.revenue)} (${prev.year}) − 1 = ${num(prev.revenue) ? pct(num(cur.revenue) / num(prev.revenue) - 1, 0) : '–'}`, inputs: [`financials.${i}.revenue`, `financials.${i - 1}.revenue`] };
  },
  avgActualGrowth: (d, a) => {
    const g = a.growth.filter((x) => String(x.type).toLowerCase().startsWith('a'));
    return { label: 'Average historical revenue growth', formula: `Average of ${g.map((x) => `${pct(x.g, 0)} (${x.year})`).join(', ')} = ${a.avgActualGrowth !== null ? pct(a.avgActualGrowth, 0) : '–'}`, inputs: ['financials'] };
  },
  projectedRise: (d, a) => {
    const la = a.actuals[a.actuals.length - 1] || {}, lp = a.projections[a.projections.length - 1] || {};
    return { label: `Projected revenue rise to ${lp.year}`, formula: `${money(lp.revenue)} (${lp.year}, projected) ÷ ${money(la.revenue)} (${la.year}, actual) − 1 = ${num(la.revenue) ? pct(num(lp.revenue) / num(la.revenue) - 1, 0) : '–'}`, inputs: ['financials'] };
  },
  ownerShareIncome: (d, a) => {
    const lp = a.projections[a.projections.length - 1] || {};
    return { label: `Principal’s share of ${lp.year} net income`, formula: `${money(lp.netIncome)} projected net income × ${num(d.ownerSharePct)}% ownership = ${money((num(lp.netIncome) * num(d.ownerSharePct)) / 100)}`, inputs: ['financials', 'ownerSharePct'] };
  },
  newsCount: (d, a) => ({ label: 'Red and yellow review items', formula: `The app counted the automatic checks in the “Underwriter review: flags” section: ${a.flags.filter((f) => f.level === 'red').length} red and ${a.flags.filter((f) => f.level === 'yellow').length} yellow. Each flag there shows its own rule.`, inputs: [] }),
};

// Main entry: ref is what the memo put on the number (data-src).
export function explain(ref, deal, origins) {
  if (ref.startsWith('news.')) {
    const n = deal.news?.[Number(ref.split('.')[1])] || {};
    const fromSearch = has(deal.newsCheckedAt) && !origins?.typed?.news;
    return {
      kind: 'news',
      title: n.headline || 'News item',
      sourceName: [n.source, n.date].filter(Boolean).join(', '),
      link: safeUrl(n.url),
      where: {
        kind: 'news',
        text: fromSearch ? `Found by the News check on ${deal.newsCheckedAt}` : whereFrom('news', ref, origins).text,
      },
      note: n.summary || '',
      focus: 'news',
    };
  }
  if (ref.startsWith('calc:')) {
    const [, id, ...params] = ref.split(':');
    const a = analyze(deal);
    const c = CALCS[id]?.(deal, a, ...params);
    if (!c) return null;
    return {
      kind: 'calc',
      title: c.label,
      formula: c.formula,
      where: { kind: 'calc', text: 'Calculated by the app from the numbers below' },
      inputs: c.inputs.filter((r) => !/\.-1\./.test(r)).map((r) => input(r, deal, origins)),
    };
  }
  const i = input(ref, deal, origins);
  return { kind: 'input', title: i.label, where: i.where, focus: i.focus };
}

export { fieldLabel };
