// Deterministic data checks on the deal form. No AI. Each returns items: {area, level, title, detail}
import { num, has, money, sum } from '../format.js';
import { rubric as R } from './rubric.js';

const item = (area, level, title, detail = '') => ({ area, level, title, detail });
const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;

export function checkDeal(deal) {
  const out = [];
  const add = (...a) => out.push(item(...a));
  const loan = num(deal.loanAmount);
  const term = num(deal.termMonths);

  // --- Required data
  const required = [
    ['firmName', 'Borrower firm name'], ['principalName', 'Principal name'], ['loanAmount', 'Loan amount'],
    ['interestRate', 'Interest rate'], ['termMonths', 'Loan term'], ['loanPurpose', 'Reason for loan'],
    ['projectName', 'Project name'], ['totalProjectCost', 'Total project cost'], ['exitProceeds', 'Expected repayment proceeds'],
  ];
  const missing = required.filter(([k]) => !has(deal[k])).map(([, l]) => l);
  if (missing.length) add('Data', 'warn', `${missing.length} required field(s) empty`, `${missing.join(', ')}. Fill it in where the memo shows a [... to be added] placeholder; fields the memo does not show until they are filled in need to be added on the Deal data tab.`);
  else add('Data', 'pass', 'All required fields are filled in');

  // --- Plausible ranges
  const range = (key, label, [lo, hi], unit, level = 'warn') => {
    if (!has(deal[key])) return;
    const v = num(deal[key]);
    if (v < lo || v > hi) add('Data', level, `${label} looks wrong: ${deal[key]}${unit}`, `Expected between ${lo} and ${hi}${unit}. Typo (extra zero, wrong unit)?`);
    else add('Data', 'pass', `${label} is in a normal range`);
  };
  range('interestRate', 'Interest rate', R.plausible.ratePct, '%');
  range('termMonths', 'Term', R.plausible.termMonths, ' months');
  range('originationFee', 'Origination fee', R.plausible.feePct, '%');
  range('walkScore', 'Walk Score', [0, 100], '', 'fail');
  range('ownerSharePct', "Principal's ownership", [0, 100], '%', 'fail');
  if (has(deal.loanAmount) && loan <= 0) add('Data', 'fail', 'Loan amount must be more than zero');
  const neg = ['loanAmount', 'totalProjectCost', 'totalAssets', 'totalLiabilities', 'cash', 'exitProceeds'].filter((k) => num(deal[k]) < 0);
  if (neg.length) add('Data', 'fail', `Negative amount in: ${neg.join(', ')}`);

  // --- Sources & uses
  const src = sum(deal.projectSources || []);
  const use = sum(deal.projectUses || []);
  if ((deal.projectSources || []).length && (deal.projectUses || []).length) {
    if (near(src, use)) add('Math', 'pass', `Project sources equal uses (${money(src)})`);
    else add('Math', 'fail', 'Project sources and uses do not balance', `Sources ${money(src)} vs uses ${money(use)}: gap ${money(Math.abs(src - use))}.`);
  }
  if (has(deal.totalProjectCost) && (deal.projectUses || []).length) {
    if (near(num(deal.totalProjectCost), use)) add('Math', 'pass', 'Total project cost equals the uses table');
    else add('Math', 'warn', 'Total project cost differs from the uses table', `Stated ${money(deal.totalProjectCost)}; table adds to ${money(use)}.`);
  }
  if ((deal.urgeUses || []).length && loan > 0) {
    const u = sum(deal.urgeUses);
    if (near(u, loan)) add('Math', 'pass', 'Loan uses equal the loan amount');
    else add('Math', 'warn', 'Loan uses do not equal the loan amount', `Loan ${money(loan)}; uses add to ${money(u)}.`);
  }
  if (loan > 0 && num(deal.totalProjectCost) > 0 && loan > num(deal.totalProjectCost)) add('Math', 'warn', 'Loan is larger than the whole project cost', `${money(loan)} vs ${money(deal.totalProjectCost)}. Confirm this is an enterprise loan, not a project loan.`);

  // --- Balance sheet
  if (has(deal.totalAssets) && has(deal.totalLiabilities) && has(deal.totalEquity)) {
    const implied = num(deal.totalAssets) - num(deal.totalLiabilities);
    if (near(implied, num(deal.totalEquity), Math.max(1, Math.abs(implied) * 0.01))) add('Math', 'pass', 'Assets - liabilities = equity');
    else add('Math', 'fail', 'Balance sheet does not balance', `Assets ${money(deal.totalAssets)} - liabilities ${money(deal.totalLiabilities)} = ${money(implied)}, but equity is ${money(deal.totalEquity)}.`);
  }
  if (num(deal.cash) > num(deal.totalAssets) && has(deal.totalAssets)) add('Math', 'warn', 'Cash is larger than total assets');

  // --- Timing
  const em = num(deal.exitMonth);
  if (em > 0 && term > 0) {
    if (em > term) add('Consistency', 'fail', 'Repayment event is after the loan matures', `Month ${em} vs term of ${term} months.`);
    else if (term - em < R.repaymentCushionMonths) add('Consistency', 'warn', 'Less than 3 months of cushion before maturity', `Repayment month ${em}; maturity month ${term}.`);
    else add('Consistency', 'pass', 'Repayment event is comfortably before maturity');
  }

  // --- Financial statements
  const fin = (deal.financials || []).filter((r) => has(r.year));
  if (fin.length) {
    const years = fin.map((r) => num(r.year));
    const dup = years.find((y, i) => years.indexOf(y) !== i);
    if (dup) add('Data', 'fail', `Year ${dup} appears twice in the financials`);
    else if (years.some((y, i) => i && y < years[i - 1])) add('Data', 'warn', 'Financial years are not in order');
    else add('Data', 'pass', 'Financial years are in order');
    const bad = fin.filter((r) => has(r.netIncome) && has(r.revenue) && num(r.netIncome) > num(r.revenue));
    if (bad.length) add('Math', 'fail', `Net income is higher than revenue in ${bad.map((r) => r.year).join(', ')}`);
    const types = fin.map((r) => String(r.type).toLowerCase().startsWith('a'));
    const firstProj = types.indexOf(false);
    if (firstProj >= 0 && types.slice(firstProj).includes(true)) add('Data', 'warn', 'An "Actual" year comes after a "Projected" year');
    if (!types.includes(true)) add('Data', 'warn', 'No actual (historical) years: only projections');
  }

  // --- Repayment paths (URGE: they like 3 to 5, and always cover the worst case)
  const opts = (deal.repaymentOptions || []).map((o) => String(o.option || '')).filter(Boolean);
  if (opts.length) {
    if (opts.length < R.minRepaymentOptions) add('Repayment paths', 'warn', `Only ${opts.length} way(s) to get repaid`, 'URGE likes to see 3 to 5 independent options.');
    else add('Repayment paths', 'pass', `${opts.length} ways to get repaid are listed`);
    if (!opts.some((o) => R.worstCaseWords.some((w) => o.toLowerCase().includes(w)))) add('Repayment paths', 'warn', 'No worst-case path is listed', 'Add what happens if the main plan fails (guarantee, collateral sale, etc.).');
    else add('Repayment paths', 'pass', 'A worst-case path is listed');
  } else if (has(deal.firmName)) add('Repayment paths', 'warn', 'No repayment options listed');

  return out;
}
