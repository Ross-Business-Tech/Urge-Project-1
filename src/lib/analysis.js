import { num, has, money, pct, sum } from './format.js';

const LEVEL_RANK = { green: 0, yellow: 1, red: 2 };
const worst = (levels) =>
  levels.reduce((w, l) => (LEVEL_RANK[l] > LEVEL_RANK[w] ? l : w), 'green');

export const LEVEL_LABEL = { green: 'Green', yellow: 'Yellow', red: 'Red' };

// Fields the memo really needs. Missing ones become yellow flags so nothing silently drops out.
const REQUIRED = [
  ['firmName', 'Borrower firm name'],
  ['principalName', 'Principal name'],
  ['loanAmount', 'Loan amount'],
  ['interestRate', 'Interest rate'],
  ['termMonths', 'Loan term'],
  ['loanPurpose', 'Reason for loan'],
  ['projectName', 'Project name'],
  ['projectAddress', 'Project location'],
  ['totalProjectCost', 'Total project cost'],
  ['yearsExperience', 'Years of experience'],
  ['totalLiabilities', 'Firm total liabilities'],
  ['totalEquity', 'Firm total equity'],
  ['exitProceeds', 'Expected repayment proceeds'],
];

export function analyze(deal) {
  const loan = num(deal.loanAmount);
  const rate = num(deal.interestRate) / 100;
  const term = num(deal.termMonths);
  const years = Math.max(term / 12, 0);
  const annualInterest = loan * rate;
  const totalInterest = annualInterest * years;
  const fee = loan * (num(deal.originationFee) / 100);
  const totalOwed = loan + totalInterest;

  const urgeUsesTotal = sum(deal.urgeUses);
  const srcTotal = sum(deal.projectSources);
  const useTotal = sum(deal.projectUses);
  const projectCost = num(deal.totalProjectCost) || useTotal;

  const liabilities = num(deal.totalLiabilities);
  const equity = num(deal.totalEquity);
  const debtToEquity = equity > 0 ? liabilities / equity : null;
  const debtToEquityAfter = equity > 0 ? (liabilities + loan) / equity : null;
  const cash = num(deal.cash);
  const cashMonthsInterest = annualInterest > 0 ? cash / (annualInterest / 12) : null;

  const exitProceeds = num(deal.exitProceeds);
  const repaymentCoverage = totalOwed > 0 && exitProceeds > 0 ? exitProceeds / totalOwed : null;
  const exitMonth = num(deal.exitMonth);

  const fin = (deal.financials || []).filter((r) => has(r.year));
  const actuals = fin.filter((r) => String(r.type).toLowerCase().startsWith('a'));
  const projections = fin.filter((r) => !String(r.type).toLowerCase().startsWith('a'));
  const growth = [];
  for (let i = 1; i < fin.length; i++) {
    const prev = num(fin[i - 1].revenue);
    if (prev > 0) growth.push({ year: fin[i].year, type: fin[i].type, g: num(fin[i].revenue) / prev - 1 });
  }
  const actualGrowth = growth.filter((g) => String(g.type).toLowerCase().startsWith('a'));
  const projectedGrowth = growth.filter((g) => !String(g.type).toLowerCase().startsWith('a'));
  const avgActualGrowth = actualGrowth.length ? actualGrowth.reduce((t, g) => t + g.g, 0) / actualGrowth.length : null;
  const maxProjected = projectedGrowth.reduce((m, g) => (m && m.g > g.g ? m : g), null);
  const lastActual = actuals[actuals.length - 1];

  const flags = [];
  const add = (area, level, title, evidence) => flags.push({ area, level, title, evidence });

  // --- Data completeness
  const missing = REQUIRED.filter(([k]) => !has(deal[k])).map(([, label]) => label);
  if (missing.length) add('Data', 'yellow', `${missing.length} key field(s) missing`, `Not provided: ${missing.join(', ')}. The memo shows placeholders for these.`);

  // --- Experience
  const yrs = num(deal.yearsExperience);
  const projects = num(deal.projectsCompleted);
  let expLevel = 'green';
  if (has(deal.yearsExperience)) {
    expLevel = yrs >= 10 ? 'green' : yrs >= 5 ? 'yellow' : 'red';
    if (projects >= 5 && expLevel === 'yellow' && yrs >= 8) expLevel = 'green';
    add('Experience', expLevel,
      expLevel === 'green' ? 'Experienced sponsor' : expLevel === 'yellow' ? 'Moderate track record' : 'Limited track record',
      `${yrs} years of experience and ${projects || 'an unstated number of'} completed projects. Rule used: 10+ years (or 8+ years with 5+ projects) = green; 5–9 = yellow; under 5 = red.`);
  } else expLevel = 'yellow';

  // --- Sources & uses
  if (deal.projectSources?.length && deal.projectUses?.length && Math.abs(srcTotal - useTotal) > 1) {
    add('Sources & Uses', 'red', 'Project sources and uses do not balance',
      `Sources total ${money(srcTotal)} but uses total ${money(useTotal)} (gap of ${money(Math.abs(srcTotal - useTotal))}). Confirm with the borrower before committee.`);
  }
  if (has(deal.totalProjectCost) && deal.projectUses?.length && Math.abs(num(deal.totalProjectCost) - useTotal) > 1) {
    add('Sources & Uses', 'yellow', 'Total project cost differs from the uses table',
      `Stated total project cost is ${money(deal.totalProjectCost)}, but the uses table adds up to ${money(useTotal)}.`);
  }
  if (deal.urgeUses?.length && loan > 0 && Math.abs(urgeUsesTotal - loan) > 1) {
    add('Sources & Uses', 'yellow', 'Loan uses do not match the loan amount',
      `The ${deal.fundName || 'fund'} loan is ${money(loan)}, but the planned uses add up to ${money(urgeUsesTotal)}.`);
  }

  // --- Leverage
  let finLevel = 'green';
  if (debtToEquity !== null) {
    const l = debtToEquityAfter < 2 ? 'green' : debtToEquityAfter <= 3 ? 'yellow' : 'red';
    finLevel = worst([finLevel, l]);
    add('Financial strength', l, `Debt-to-equity ${debtToEquityAfter.toFixed(2)}x after this loan`,
      `Firm liabilities of ${money(liabilities)} plus this ${money(loan)} loan against equity of ${money(equity)} (currently ${debtToEquity.toFixed(2)}x). Rule used: under 2.0x = green; 2.0–3.0x = yellow; above 3.0x = red.`);
  } else if (has(deal.totalLiabilities)) {
    finLevel = 'red';
    add('Financial strength', 'red', 'Firm has zero or negative equity', 'Total equity was reported as zero or less, so leverage cannot be measured.');
  }

  if (cashMonthsInterest !== null && has(deal.cash)) {
    const l = cashMonthsInterest >= 12 ? 'green' : cashMonthsInterest >= 6 ? 'yellow' : 'red';
    finLevel = worst([finLevel, l]);
    add('Financial strength', l, `Cash covers ${cashMonthsInterest.toFixed(0)} months of interest`,
      `Cash on hand of ${money(cash)} versus ${money(annualInterest / 12)} monthly interest on this loan. Rule used: 12+ months = green; 6–11 = yellow; under 6 = red.`);
  }

  if (lastActual && num(lastActual.netIncome) < 0) {
    finLevel = worst([finLevel, 'yellow']);
    add('Financial strength', 'yellow', `Net loss in ${lastActual.year}`, `The firm reported net income of ${money(lastActual.netIncome)} in its most recent actual year.`);
  }

  // --- Challenge projections
  if (maxProjected) {
    const benchmark = avgActualGrowth !== null ? Math.max(avgActualGrowth * 1.5, 0.15) : 0.3;
    if (maxProjected.g > benchmark) {
      const l = maxProjected.g > 0.5 ? 'red' : 'yellow';
      finLevel = worst([finLevel, 'yellow']);
      add('Borrower assumptions', l, `Projected ${maxProjected.year} revenue growth of ${pct(maxProjected.g, 0)} looks aggressive`,
        `Historical revenue growth averaged ${avgActualGrowth !== null ? pct(avgActualGrowth, 0) : 'n/a'} per year. The projection is well above that. Ask the borrower which signed contracts or pipeline projects support it.`);
    }
  }

  // --- Repayment
  if (repaymentCoverage !== null) {
    const l = repaymentCoverage >= 1.5 ? 'green' : repaymentCoverage >= 1.2 ? 'yellow' : 'red';
    finLevel = worst([finLevel, l === 'red' ? 'red' : 'green']);
    add('Repayment', l, `Primary repayment source covers ${repaymentCoverage.toFixed(2)}x of what is owed`,
      `Expected proceeds of ${money(exitProceeds)} versus ${money(totalOwed)} principal plus interest over the term. Rule used: 1.5x+ = green; 1.2–1.5x = yellow; under 1.2x = red.`);
  }
  if (exitMonth > 0 && term > 0 && exitMonth > term) {
    add('Repayment', 'red', 'Repayment event falls after loan maturity',
      `Proceeds are expected in month ${exitMonth}, but the loan matures in month ${term}.`);
  } else if (exitMonth > 0 && term > 0 && term - exitMonth < 3) {
    add('Repayment', 'yellow', 'Little cushion between repayment event and maturity',
      `Proceeds are expected in month ${exitMonth} and the loan matures in month ${term}. Construction delays could push repayment past maturity.`);
  }

  // --- Location
  if (has(deal.walkScore)) {
    const ws = num(deal.walkScore);
    const l = ws >= 70 ? 'green' : ws >= 50 ? 'yellow' : 'yellow';
    add('Location', l, `Walk Score of ${ws}`,
      `${ws >= 70 ? 'Very walkable location, supportive of retail and office demand.' : ws >= 50 ? 'Somewhat walkable; confirm tenant demand and parking.' : 'Car-dependent location; confirm tenant demand and parking.'} Verify at walkscore.com.`);
  }

  // --- Mission alignment
  const mission = [];
  mission.push({ label: 'BIPOC-owned firm', level: deal.bipocOwned === 'Yes' ? 'green' : deal.bipocOwned === 'No' ? 'yellow' : 'yellow',
    text: deal.bipocOwned === 'Yes' ? `${deal.firmName || 'The firm'} is BIPOC-owned.` : deal.bipocOwned === 'No' ? 'The firm is not BIPOC-owned.' : 'Ownership demographics not provided.' });
  mission.push({ label: 'Potential scale / acceleration', level: has(deal.growthPlan) ? 'green' : 'yellow',
    text: has(deal.growthPlan) ? deal.growthPlan : 'Growth plan not provided.' });
  const jobs = num(deal.jobsCreated);
  mission.push({ label: 'Economic impact', level: jobs >= 25 ? 'green' : jobs > 0 ? 'yellow' : 'yellow',
    text: jobs > 0 ? `Project expected to create or support about ${jobs} jobs and ${num(deal.squareFeet).toLocaleString()} sq ft of commercial space.` : 'Job creation estimate not provided.' });
  mission.push({ label: 'Neighborhood impact area', level: deal.impactArea === 'Yes' ? 'green' : 'yellow',
    text: deal.impactArea === 'Yes' ? 'Project is located in a designated neighborhood impact area.' : deal.impactArea === 'No' ? 'Project is not in a designated impact area.' : 'Impact-area status not provided.' });
  const missionGreens = mission.filter((m) => m.level === 'green').length;
  const missionLevel = missionGreens >= 3 ? 'green' : missionGreens >= 2 ? 'yellow' : 'red';

  const merits = [
    { label: 'Experience', level: expLevel },
    { label: 'Mission alignment', level: missionLevel },
    { label: 'Financial strength', level: finLevel },
  ];
  const overall = worst(merits.map((m) => m.level));

  // --- News found by the news check
  for (const n of deal.news || []) {
    if (!n.headline || n.level === 'green') continue;
    add(`News (${n.about || 'Borrower'})`, n.level === 'red' ? 'red' : 'yellow', n.headline,
      [n.summary, n.relevance, [n.source, n.date].filter(Boolean).join(', ')].filter(Boolean).join(' '));
  }

  flags.sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level]);

  return {
    loan, rate, term, years, annualInterest, totalInterest, fee, totalOwed,
    urgeUsesTotal, srcTotal, useTotal, projectCost,
    liabilities, equity, debtToEquity, debtToEquityAfter, cash, cashMonthsInterest,
    exitProceeds, exitMonth, repaymentCoverage,
    fin, actuals, projections, growth, avgActualGrowth,
    flags, mission, missionLevel, merits, overall,
    loanShareOfProject: projectCost > 0 ? loan / projectCost : null,
  };
}
