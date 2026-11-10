// "Flag anything that stands out." Junk, blanks, absurd amounts, sudden jumps, odd text.
// Hard errors (not a number, invalid date) are failures; outliers are warnings to confirm.
import { num, has, money, sum } from '../format.js';
import { rubric } from './rubric.js';
import { emptyDeal } from '../sampleDeal.js';

const A = rubric.atypical;
const item = (area, level, title, detail = '') => ({ area, level, title, detail });

export const NUMERIC_FIELDS = {
  loanAmount: 'Loan amount', interestRate: 'Interest rate', termMonths: 'Loan term', originationFee: 'Origination fee',
  yearsExperience: 'Years of experience', projectsCompleted: 'Projects completed', squareFeet: 'Size (sq ft)',
  totalProjectCost: 'Total project cost', walkScore: 'Walk Score', jobsCreated: 'Jobs created', totalAssets: 'Total assets',
  totalLiabilities: 'Total liabilities', totalEquity: 'Total equity', cash: 'Cash on hand', ownerSharePct: "Principal's ownership",
  exitProceeds: 'Expected repayment proceeds', exitMonth: 'Repayment month',
};
// Every field the memo can show, with a plain-English label (used to say which fields are blank)
export const FIELD_LABELS = {
  committee: 'Investment committee', preparedBy: 'Prepared by', memoDate: 'Memo date', firmName: 'Borrower firm name', principalName: 'Principal name',
  principalTitle: 'Principal title', hqCity: 'Firm location', principalBio: 'Principal bio', bipocOwned: 'BIPOC-owned answer', orgStructure: 'Organizational structure',
  loanPurpose: 'Reason for loan', collateral: 'Collateral', projectName: 'Project name', projectAddress: 'Project address', assetType: 'Property type',
  neighborhood: 'Neighborhood description', impactArea: 'Impact-area answer', urgeUses: 'How the loan will be used', projectSources: 'Project sources',
  projectUses: 'Project uses', financials: 'Firm financials', repaymentOptions: 'Repayment options', team: 'Development team', ...NUMERIC_FIELDS,
};
const TEXT_FIELDS = ['firmName', 'principalName', 'principalTitle', 'hqCity', 'principalBio', 'loanPurpose', 'collateral', 'projectName', 'projectAddress', 'assetType', 'neighborhood', 'growthPlan', 'orgStructure', 'committee', 'preparedBy'];
const PROSE_FIELDS = ['principalBio', 'loanPurpose', 'neighborhood', 'orgStructure'];
const isBlank = (v) => (Array.isArray(v) ? v.length === 0 : !has(v));
const isNumeric = (v) => String(v).trim() !== '' && Number.isFinite(Number(String(v).replace(/[$,%\s]/g, '')));
const list = (xs, n = 4) => xs.slice(0, n).join(', ') + (xs.length > n ? ` and ${xs.length - n} more` : '');

export function checkAtypical(deal) {
  const out = [];
  const add = (...a) => out.push(item(...a));
  const labelOf = (k) => FIELD_LABELS[k] || k;

  // --- Not a number
  const junk = [];
  for (const [k, label] of Object.entries(NUMERIC_FIELDS)) if (has(deal[k]) && !isNumeric(deal[k])) junk.push(`${label} ("${String(deal[k]).slice(0, 20)}")`);
  for (const [key, label] of [['urgeUses', 'a loan-use amount'], ['projectSources', 'a project-source amount'], ['projectUses', 'a project-use amount']])
    for (const r of deal[key] || []) if (has(r.amount) && !isNumeric(r.amount)) junk.push(`${label} ("${String(r.amount).slice(0, 20)}")`);
  for (const r of deal.financials || []) for (const f of ['revenue', 'netIncome']) if (has(r[f]) && !isNumeric(r[f])) junk.push(`${r.year || '?'} ${f} ("${String(r[f]).slice(0, 20)}")`);
  for (const j of junk.slice(0, 6)) add('Data quality', 'fail', `${j.replace(/ \(".*"\)$/, '')} is not a number: ${j.match(/\(".*"\)$/)?.[0].slice(1, -1) || ''}`, 'The memo treats text in a number field as 0. Replace it with a real number.');
  if (junk.length > 6) add('Data quality', 'fail', `${junk.length - 6} more fields contain text where a number is needed`);

  // --- Dates and answers
  if (has(deal.memoDate)) {
    const d = new Date(deal.memoDate + 'T12:00:00');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deal.memoDate) || Number.isNaN(d.getTime())) add('Data quality', 'fail', `Memo date is not a valid date: "${deal.memoDate}"`);
    else if (d.getFullYear() < A.memoYearRange[0] || d.getFullYear() > A.memoYearRange[1]) add('Atypical', 'warn', `Memo date looks off: ${deal.memoDate}`, `Expected a year between ${A.memoYearRange[0]} and ${A.memoYearRange[1]}.`);
  }
  for (const k of ['bipocOwned', 'impactArea']) if (has(deal[k]) && !['Yes', 'No'].includes(deal[k])) add('Data quality', 'warn', `${labelOf(k)} is "${deal[k]}", not Yes or No`, 'The rating rules only understand Yes or No.');

  // --- Blanks (beyond the required fields, which are reported separately)
  const required = ['firmName', 'principalName', 'loanAmount', 'interestRate', 'termMonths', 'loanPurpose', 'projectName', 'totalProjectCost', 'exitProceeds'];
  const skip = new Set(['fundName', 'underwriterNotes', 'repaymentStructure', 'growthPlan', 'news', 'newsSummary', 'newsCheckedAt']);
  const keys = Object.keys(emptyDeal).filter((k) => !skip.has(k));
  const blank = keys.filter((k) => isBlank(deal[k]));
  const optionalBlank = blank.filter((k) => !required.includes(k));
  if (optionalBlank.length) add('Data quality', 'warn', `${optionalBlank.length} section(s) or field(s) are empty`, `${list(optionalBlank.map(labelOf), 12)}. The memo will show a placeholder or leave these out.`);
  if (blank.length / keys.length > A.mostlyBlank) add('Data quality', 'fail', `Most of the deal is blank: ${blank.length} of ${keys.length} fields are empty`, 'A memo this empty cannot be reviewed. Fill in the deal data first.');

  // --- Text hygiene
  const flagged = { code: [], placeholder: [], repeated: [], digits: [], control: [], short: [], long: [], caps: [] };
  const checkText = (label, v, { name = false, prose = false } = {}) => {
    if (!has(v)) return;
    const t = String(v);
    if (/[<>]|&lt;|&gt;|javascript:|\$\{|\{\{/i.test(t)) flagged.code.push(label);
    if (/^\s*(test|testing|asdf+g*|qwer\w*|abc+|xxx+|n\/a|na|tbd|todo|none|null|undefined|\.+|-+|\?+)\s*$/i.test(t) || /lorem ipsum|asdf|qwer/i.test(t)) flagged.placeholder.push(label);
    if (/(.)\1{5,}/.test(t)) flagged.repeated.push(label);
    // eslint-disable-next-line no-control-regex
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(t)) flagged.control.push(label);
    if (name && /\d/.test(t)) flagged.digits.push(label);
    if (prose && t.trim().length < A.shortText) flagged.short.push(label);
    if (t.length > A.longText) flagged.long.push(label);
    if (t.length > 30 && t === t.toUpperCase() && /[A-Z]/.test(t)) flagged.caps.push(label);
  };
  for (const k of TEXT_FIELDS) checkText(labelOf(k), deal[k], { name: k === 'principalName', prose: PROSE_FIELDS.includes(k) });
  (deal.team || []).forEach((m, i) => { checkText(`Team member ${i + 1} name`, m.name, { name: true }); checkText(`Team member ${i + 1} company`, m.company); checkText(`Team member ${i + 1} role`, m.role); checkText(`Team member ${i + 1} bio`, m.bio); });
  (deal.repaymentOptions || []).forEach((o, i) => checkText(`Repayment option ${i + 1}`, o.option));
  for (const key of ['urgeUses', 'projectSources', 'projectUses']) (deal[key] || []).forEach((r, i) => checkText(`${labelOf(key)} row ${i + 1}`, r.label));
  const T = [
    ['code', 'Contains HTML or code characters', 'warn', 'Characters like < > could break the memo layout or be an attempt to inject code.'],
    ['placeholder', 'Looks like placeholder or test text', 'warn', 'Replace it with real content.'],
    ['repeated', 'Contains a long run of repeated characters', 'warn', 'Likely a typo or filler.'],
    ['control', 'Contains hidden control characters', 'fail', 'Paste the text again as plain text.'],
    ['digits', 'A person’s name contains digits', 'warn', 'Check the spelling.'],
    ['short', 'Text is very short for a description', 'warn', 'The memo needs a real description here.'],
    ['long', 'Text is unusually long', 'warn', 'Check that the wrong content was not pasted.'],
    ['caps', 'Text is written in all capitals', 'warn', 'Likely pasted from another source; check it.'],
  ];
  for (const [k, title, level, detail] of T) if (flagged[k].length) add('Data quality', level, `${title}: ${list(flagged[k])}`, detail);

  // --- Magnitudes that stand out
  const loan = num(deal.loanAmount);
  const cost = num(deal.totalProjectCost) || sum(deal.projectUses || []);
  if (has(deal.loanAmount) && isNumeric(deal.loanAmount) && loan > 0 && (loan < A.loanRange[0] || loan > A.loanRange[1])) add('Atypical', 'warn', `Loan amount is unusual: ${money(loan)}`, `Loans here are normally between ${money(A.loanRange[0])} and ${money(A.loanRange[1])}. Confirm it is not a typo.`);
  if (cost > 0 && (cost < A.projectCostRange[0] || cost > A.projectCostRange[1])) add('Atypical', 'warn', `Project cost is unusual: ${money(cost)}`, `Expected between ${money(A.projectCostRange[0])} and ${money(A.projectCostRange[1])}.`);
  if (loan > 0 && cost > 0 && loan / cost < A.minLoanShareOfProject) add('Atypical', 'warn', `The loan is a tiny share of the project (${((loan / cost) * 100).toFixed(1)}%)`, 'Confirm the loan amount and the project cost belong to the same deal.');
  const eq = num(deal.totalEquity);
  const liab = num(deal.totalLiabilities);
  if (has(deal.totalEquity) && eq < 0) add('Atypical', 'warn', `The firm has negative equity (${money(eq)})`, 'Liabilities exceed assets.');
  else if (eq > 0 && liab / eq > A.maxLiabilitiesToEquity) add('Atypical', 'warn', `Very high leverage: liabilities are ${(liab / eq).toFixed(0)} times equity`, 'Confirm the balance sheet figures.');
  const fin = (deal.financials || []).filter((r) => has(r.year));
  const actuals = fin.filter((r) => String(r.type).toLowerCase().startsWith('a'));
  const lastActual = actuals.at(-1);
  if (loan > 0 && lastActual && num(lastActual.revenue) > 0 && loan > A.maxLoanToLatestRevenue * num(lastActual.revenue)) add('Atypical', 'warn', `The loan is more than ${A.maxLoanToLatestRevenue} times the firm's latest annual revenue`, `${money(loan)} versus ${money(lastActual.revenue)} in ${lastActual.year}.`);
  const owed = loan + loan * (num(deal.interestRate) / 100) * (num(deal.termMonths) / 12);
  if (owed > 0 && num(deal.exitProceeds) / owed > A.maxCoverage) add('Atypical', 'warn', `Expected repayment proceeds look unusually high (${(num(deal.exitProceeds) / owed).toFixed(1)}x what is owed)`, 'Confirm the figure.');
  if (cost > 0 && num(deal.squareFeet) > 0) { const psf = cost / num(deal.squareFeet); if (psf < A.costPerSqFt[0] || psf > A.costPerSqFt[1]) add('Atypical', 'warn', `Project cost per square foot is unusual: ${money(psf)}`, `Expected between ${money(A.costPerSqFt[0])} and ${money(A.costPerSqFt[1])}. Check the size and the cost.`); }
  if (num(deal.jobsCreated) > A.maxJobs) add('Atypical', 'warn', `Jobs created looks very high: ${num(deal.jobsCreated)}`);
  if (num(deal.yearsExperience) > A.maxYears) add('Atypical', 'warn', `Years of experience looks very high: ${num(deal.yearsExperience)}`);
  const yrs = num(deal.yearsExperience), pr = num(deal.projectsCompleted);
  if (pr > A.maxProjects || (yrs > 0 && pr / yrs > A.maxProjectsPerYear)) add('Atypical', 'warn', `Projects completed looks very high: ${pr} in ${yrs || '?'} years`);
  if (has(deal.ownerSharePct) && isNumeric(deal.ownerSharePct) && num(deal.ownerSharePct) === 0) add('Atypical', 'warn', 'The principal is shown as owning 0% of the firm');

  // --- Financial series
  const odd = { year: [], margin: [], jump: [], flip: [], gap: [] };
  fin.forEach((r, i) => {
    const y = num(r.year);
    if (y < A.yearRange[0] || y > A.yearRange[1]) odd.year.push(String(r.year));
    const rev = num(r.revenue), net = num(r.netIncome);
    if (rev > 0) { const m = net / rev; if (m < A.marginRange[0] || m > A.marginRange[1]) odd.margin.push(`${r.year} (${(m * 100).toFixed(0)}%)`); }
    if (i > 0) {
      const prev = fin[i - 1];
      const pr2 = num(prev.revenue);
      if (pr2 > 0) { const g = rev / pr2 - 1; if (g > A.revenueChange[1] || g < A.revenueChange[0]) odd.jump.push(`${prev.year} to ${r.year} (${g > 0 ? '+' : ''}${(g * 100).toFixed(0)}%)`); }
      if (num(prev.netIncome) > 0 && net < 0) odd.flip.push(`${r.year}`);
      if (y - num(prev.year) > 1 && y - num(prev.year) < 50) odd.gap.push(`${prev.year} to ${r.year}`);
    }
  });
  if (odd.year.length) add('Atypical', 'fail', `Year(s) outside the normal range: ${list(odd.year)}`, `Expected between ${A.yearRange[0]} and ${A.yearRange[1]}.`);
  if (odd.margin.length) add('Atypical', 'warn', `Unusual profit margin in ${list(odd.margin)}`, `Normal margins are between ${A.marginRange[0] * 100}% and ${A.marginRange[1] * 100}%.`);
  if (odd.jump.length) add('Atypical', 'warn', `Sudden jump in revenue: ${list(odd.jump)}`, 'Explain it before committee (URGE looks for sudden jumps).');
  if (odd.flip.length) add('Atypical', 'warn', `Net income turns from profit to loss in ${list(odd.flip)}`);
  if (odd.gap.length) add('Atypical', 'warn', `Missing year(s) in the financials: ${list(odd.gap)}`);
  if (fin.length && actuals.length < A.minActualYears) add('Atypical', 'warn', `Only ${actuals.length} year of actual financials`, `URGE likes to see ${A.minActualYears} to 3 years of history.`);

  // --- Tables
  for (const [key, label] of [['urgeUses', 'Loan uses'], ['projectSources', 'Project sources'], ['projectUses', 'Project uses']]) {
    const rows = deal[key] || [];
    if (!rows.length) continue;
    const bad = rows.filter((r) => has(r.amount) && isNumeric(r.amount) && num(r.amount) <= 0).length;
    const noLabel = rows.filter((r) => !has(r.label)).length;
    const labels = rows.map((r) => String(r.label || '').trim().toLowerCase()).filter(Boolean);
    const dup = labels.find((l, i) => labels.indexOf(l) !== i);
    const total = sum(rows);
    const top = Math.max(...rows.map((r) => num(r.amount)));
    if (bad) add('Atypical', 'warn', `${label}: ${bad} row(s) with a zero or negative amount`);
    if (noLabel) add('Data quality', 'warn', `${label}: ${noLabel} row(s) have no description`);
    if (dup) add('Data quality', 'warn', `${label}: "${dup}" is listed more than once`);
    if (rows.length >= 2 && total > 0 && top / total > A.topRowShare) add('Atypical', 'warn', `${label}: one row is ${((top / total) * 100).toFixed(0)}% of the total`);
  }

  // --- Team and repayment options
  const team = deal.team || [];
  if (team.length === 1) add('Atypical', 'warn', 'The development team lists only one person');
  const names = team.map((m) => String(m.name || '').trim().toLowerCase()).filter(Boolean);
  const dupName = names.find((n, i) => names.indexOf(n) !== i);
  if (dupName) add('Data quality', 'warn', `Two team members have the same name: "${dupName}"`);
  const thin = team.filter((m) => !has(m.name) || !has(m.role) || !has(m.bio)).length;
  if (thin) add('Data quality', 'warn', `${thin} team member(s) are missing a name, role or bio`);
  const opts = (deal.repaymentOptions || []).map((o) => String(o.option || '').trim().toLowerCase());
  if (opts.some((o, i) => o && opts.indexOf(o) !== i)) add('Data quality', 'warn', 'The same repayment option is listed more than once');
  if (opts.some((o) => !o)) add('Data quality', 'warn', 'A repayment option is blank');

  return out;
}
