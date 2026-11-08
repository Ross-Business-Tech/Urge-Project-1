// Random deal generator for demos and pressure tests. Everything is made up: names are generic,
// addresses are marked fictional, and the same seed always gives the same deal.
import { emptyDeal } from './sampleDeal.js';

export const PROFILES = ['strong', 'mid', 'weak', 'chaotic'];

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRM_A = ['Northbrook', 'Eastgate', 'Maple Row', 'Harbor Light', 'Cedar Crossing', 'Copper Line', 'Brightwater', 'Fairmont Yard', 'Stonebridge', 'Larkspur', 'Ironwood', 'Redfern', 'Millstream', 'Oakhaven', 'Kestrel', 'Tidewell'];
const FIRM_B = ['Builders Collective LLC', 'Development Partners LLC', 'Holdings LLC', 'Property Group LLC', 'Community Builders LLC', 'Ventures LLC'];
const FIRST = ['Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Avery', 'Quinn', 'Rowan', 'Sam', 'Devon', 'Alex', 'Jamie', 'Reese', 'Skyler'];
const LAST = ['Avery', 'Brooks', 'Rivera', 'Hayes', 'Monroe', 'Sutton', 'Bell', 'Okafor', 'Park', 'Whitfield', 'Delgado', 'Lang', 'Ellis', 'Navarro'];
const PROJ_A = ['Linden', 'Sample', 'Riverside', 'Oak', 'Harbor', 'Maple', 'Union', 'Foundry', 'Cass', 'Garden', 'Lakeview', 'Station'];
const PROJ_B = ['Commons', 'Lofts', 'Market Hall', 'Flats', 'Works', 'Plaza', 'Row', 'Yard'];
const ASSET = ['Mixed-use commercial (ground-floor retail + office)', 'Multifamily apartments (ground-floor retail)', 'Light industrial / makerspace', 'Neighborhood grocery and food hall', 'Office and co-working space', 'Senior and workforce housing'];
const STREET = ['Avenue', 'Street', 'Boulevard', 'Road'];
const COLLATERAL = [
  'Junior lien on the firm’s membership interests in the project entity; personal guarantee from the principal.',
  'Pledge of the firm’s equity in two stabilized buildings; personal guarantee from the principal.',
  'Second mortgage on the project property and assignment of developer fees.',
  'Assignment of cash-flow distributions from the firm’s existing portfolio; guarantee from the principal.',
];
const NEIGHBORHOOD = [
  'Commercial corridor with a mix of vacant storefronts and recently reopened small businesses; two bus lines within one block.',
  'Residential neighborhood anchored by a school and a clinic; limited retail within walking distance.',
  'Former industrial area now seeing new investment; near a planned transit stop.',
  'Dense, walkable district with steady foot traffic and several long-time neighborhood businesses.',
];
const GROWTH = [
  'Plans to start two additional commercial projects in the next 24 months, roughly doubling the active pipeline.',
  'Intends to add a property-management arm and take on one new project each year.',
  'Will use the loan to hire two project managers and run two projects at once.',
];
const REPAY_MAIN = [
  (a, b) => `Developer fee and sponsor distribution at project refinance (month ${a}–${b})`,
  () => 'Firm operating cash flow from fee-based construction management work',
  () => 'Refinance proceeds on an existing stabilized building',
  () => 'Distributions from the firm’s existing property portfolio',
  () => 'Repayment from a committed community grant',
];
const REPAY_WORST = [
  'Personal guarantee of the principal',
  'Sale of the firm’s interest in the project entity',
  'Foreclosure on the pledged membership interests',
  'Liquidation of pledged collateral',
];
const REPAY_PLAIN = ['Firm operating cash flow', 'Refinance proceeds', 'Grant funding'];
const COMMITTEES = ['Investment Committee (sample members A, B, C)', 'Investment Committee (sample members D, E, F)'];

// Each plantable mistake and the check that must catch it.
export const MISTAKES = {
  'sources-uses': { level: 'fail', re: /do not balance/, apply: (d) => { d.projectSources[0].amount = String(Number(d.projectSources[0].amount) + 250000); } },
  'loan-uses': { level: 'warn', re: /Loan uses/, apply: (d) => { d.urgeUses[0].amount = String(Number(d.urgeUses[0].amount) + 40000); } },
  'balance-sheet': { level: 'fail', re: /Balance sheet/, apply: (d) => { d.totalEquity = String(Math.round(Number(d.totalEquity) * 1.4 + 100000)); } },
  'repay-after-maturity': { group: 'timing', level: 'fail', re: /after the loan matures/, apply: (d) => { d.exitMonth = String(Number(d.termMonths) + 6); } },
  'rate-typo': { level: 'warn', re: /Interest rate looks wrong/, apply: (d) => { d.interestRate = '85'; } },
  'term-typo': { group: 'timing', level: 'warn', re: /Term looks wrong/, apply: (d) => { d.termMonths = '360'; } },
  'duplicate-year': { group: 'financials', level: 'fail', re: /twice/, apply: (d) => { const f = d.financials; f[f.length - 1].year = f[f.length - 2].year; } },
  'net-over-revenue': { group: 'financials', level: 'fail', re: /Net income is higher/, apply: (d) => { const r = d.financials[0]; r.netIncome = String(Number(r.revenue) * 2); } },
  'walk-score': { level: 'fail', re: /Walk Score/, apply: (d) => { d.walkScore = '150'; } },
  'one-repayment-path': { group: 'repayment-list', level: 'warn', re: /Only 1/, apply: (d) => { d.repaymentOptions = d.repaymentOptions.slice(0, 1); } },
  'no-worst-case': { group: 'repayment-list', level: 'warn', re: /No worst-case/, apply: (d) => { d.repaymentOptions = REPAY_PLAIN.map((option) => ({ option })); } },
  'negative-cash': { level: 'fail', re: /Negative amount/, apply: (d) => { d.cash = '-5000'; } },
  'project-cost': { level: 'warn', re: /Total project cost differs/, apply: (d) => { d.totalProjectCost = String(Math.round(Number(d.totalProjectCost) * 1.15 / 1000) * 1000); } },
};

// Splits a total into rows of whole thousands that add up exactly.
function split(total, weights, labels) {
  const sumW = weights.reduce((a, b) => a + b, 0);
  const amounts = weights.map((w) => Math.round((total * w) / sumW / 1000) * 1000);
  amounts[amounts.length - 1] = total - amounts.slice(0, -1).reduce((a, b) => a + b, 0);
  return labels.map((label, i) => ({ label, amount: String(amounts[i]) }));
}

const PARAMS = {
  strong: { years: [11, 22], deRange: [0.6, 1.8], months: [14, 30], cover: [1.6, 2.4], walk: [70, 96], greens: [4, 4], actualG: [0.06, 0.14], projBoost: [1.0, 1.3], margin: [0.1, 0.16] },
  mid: { years: [5, 9], deRange: [2.05, 2.95], months: [6.5, 11], cover: [1.22, 1.48], walk: [50, 85], greens: [2, 3], actualG: [0.08, 0.2], projBoost: [1.2, 1.9], margin: [0.06, 0.12] },
  weak: { years: [0, 4], deRange: [3.2, 5], months: [1, 5], cover: [0.6, 1.15], walk: [25, 65], greens: [0, 1], actualG: [0.02, 0.1], projBoost: [3, 6], margin: [-0.02, 0.06] },
};

export function randomDeal(seed = 1, { profile = 'any', mistakes = 0 } = {}) {
  const rnd = mulberry32(Number(seed) || 1);
  const f = (lo, hi) => lo + rnd() * (hi - lo);
  const int = (lo, hi) => Math.floor(f(lo, hi + 1));
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const chance = (p) => rnd() < p;
  const shuffle = (arr) => arr.map((v) => [rnd(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  const th = (n, step = 1000) => Math.round(n / step) * step;

  const chosen = profile === 'any' ? pick(['strong', 'mid', 'weak']) : profile;
  const chaotic = chosen === 'chaotic';
  const P = PARAMS[chaotic ? pick(['strong', 'mid', 'weak']) : chosen];

  // --- Loan
  const loan = th(int(250, 2500) * 1000, 25000);
  const rate = pick([6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11]);
  const term = pick([24, 36, 48, 60]);
  const fee = pick([1, 1.5, 2]);
  const annualInterest = loan * (rate / 100);
  const totalOwed = loan + annualInterest * (term / 12);

  // --- Balance sheet (built from a target debt-to-equity after the loan)
  const de = f(...P.deRange);
  const liabilities = th(int(200, 3000) * 1000);
  const equity = Math.max(50000, th((liabilities + loan) / de));
  const assets = liabilities + equity;
  const cash = Math.min(th((f(...P.months) * annualInterest) / 12), Math.round(assets * 0.9));
  const exitProceeds = th(f(...P.cover) * totalOwed);
  const exitMonth = Math.max(3, Math.min(term - 4, Math.round(term * f(0.45, 0.9))));

  // --- Borrower
  const years = int(...P.years);
  const projects = Math.max(0, Math.round(years * f(0.4, 1.0)));
  const principal = `${pick(FIRST)} ${pick(LAST)}`;
  const firm = `${pick(FIRM_A)} ${pick(FIRM_B)}`;
  const ownerPct = pick([100, 100, 75, 60, 51]);
  const projectPct = pick([10, 20, 25, 30]);
  const projName = `${pick(PROJ_A)} ${pick(PROJ_B)}`;
  const sqft = th(int(8, 60) * 1000, 1000);
  const greenCount = int(...P.greens);
  const flags = shuffle([0, 1, 2, 3]).slice(0, greenCount);
  const bipoc = flags.includes(0);
  const impact = flags.includes(1);
  const hasGrowth = flags.includes(2);
  const jobs = flags.includes(3) ? int(25, 80) : int(0, 20);

  // --- Project money
  const projectCost = th(loan * f(3, 10), 10000);
  const uses = split(projectCost, [int(10, 20), int(55, 70), int(8, 14), int(4, 9)], ['Land acquisition', 'Hard construction costs', 'Soft costs', 'Financing costs & reserves']);
  const sources = split(projectCost, [int(45, 65), int(15, 25), int(4, 9), int(6, 12)], ['Senior construction loan (bank)', 'Outside investor equity', 'Sponsor equity (funded by loan)', 'Local small-business grant']);
  const loanUses = split(loan, [int(25, 45), int(25, 40), int(10, 25)], ['Predevelopment (architecture, permits, environmental)', 'Sponsor equity contribution to project', 'Two new staff positions (18 months)']);

  // --- Financials: 2-4 actual years then 2 projected
  const nActual = int(2, 4);
  const startYear = 2026 - nActual;
  let revenue = th(int(700, 5000) * 1000, 10000);
  const financials = [];
  let gSum = 0;
  for (let i = 0; i < nActual; i++) {
    const m = f(...P.margin);
    financials.push({ year: String(startYear + i), type: 'Actual', revenue: String(revenue), netIncome: String(th(revenue * m, 1000)) });
    const g = f(...P.actualG);
    gSum += g;
    revenue = th(revenue * (1 + g), 10000);
  }
  const avgG = gSum / nActual;
  for (let i = 0; i < 2; i++) {
    const m = f(...P.margin);
    financials.push({ year: String(2026 + i), type: 'Projected', revenue: String(revenue), netIncome: String(th(revenue * m, 1000)) });
    revenue = th(revenue * (1 + Math.min(avgG * f(...P.projBoost), 0.95)), 10000);
  }
  if (chosen === 'weak' && chance(0.4)) financials[nActual - 1].netIncome = String(-th(Number(financials[nActual - 1].revenue) * 0.03, 1000));

  // --- Repayment options (3-5, with a worst-case path)
  const nOpts = int(3, 5);
  const opts = shuffle(REPAY_MAIN).slice(0, nOpts - 1).map((fn) => fn(Math.max(1, exitMonth - 4), exitMonth));
  opts.push(pick(REPAY_WORST));
  const repaymentOptions = shuffle(opts).map((option) => ({ option }));

  const team = [
    { name: principal, company: firm.replace(/ LLC$/, ''), role: 'Developer / Principal', bio: `Founder; leads acquisition, financing and construction oversight. ${years} years in commercial construction and development.` },
    { name: `${pick(FIRST)} ${pick(LAST)}`, company: 'Sample Design Studio', role: 'Architect', bio: `Licensed architect with ${int(8, 25)} years of small-format retail and office design experience.` },
    { name: `${pick(FIRST)} ${pick(LAST)}`, company: 'Example Construction Co.', role: 'General Contractor', bio: `GC with a portfolio of ${int(10, 40)}+ commercial projects under $10M in the region.` },
  ];
  if (chance(0.5)) team.push({ name: `${pick(FIRST)} ${pick(LAST)}`, company: 'Sample Property Services', role: 'Property Manager', bio: `Manages ${int(150, 900)} units of mixed-use and multifamily property in the city.` });

  const deal = {
    ...structuredClone(emptyDeal),
    fundName: 'URGE',
    memoDate: new Date(Date.UTC(2026, 10, 1 + int(0, 45))).toISOString().slice(0, 10),
    preparedBy: `Sample Underwriter ${int(1, 9)}`,
    committee: pick(COMMITTEES),
    firmName: firm,
    principalName: principal,
    principalTitle: pick(['Founder & Managing Partner', 'Founder & CEO', 'Managing Principal']),
    hqCity: 'Detroit, MI',
    yearsExperience: String(years),
    projectsCompleted: String(projects),
    bipocOwned: bipoc ? 'Yes' : 'No',
    principalBio: `${principal} spent ${Math.max(1, years - int(1, 4))} years in construction and development before founding ${firm.replace(/ LLC$/, '')}. The firm has completed ${projects} projects totaling roughly ${th(sqft * (projects || 1) / 2, 1000).toLocaleString('en-US')} sq ft.`,
    loanAmount: String(loan),
    interestRate: String(rate),
    termMonths: String(term),
    originationFee: String(fee),
    repaymentStructure: pick(['Interest-only, principal due at maturity', 'Monthly amortizing', 'Accrued interest, all due at maturity']),
    loanPurpose: `Enterprise working-capital loan to fund predevelopment costs and the sponsor equity gap for ${projName}, and to add staff so the firm can run two projects at once.`,
    collateral: pick(COLLATERAL),
    projectName: projName,
    projectAddress: `${int(100, 999)} Sample ${pick(STREET)}, Detroit, MI (fictional)`,
    assetType: pick(ASSET),
    squareFeet: String(sqft),
    totalProjectCost: String(projectCost),
    walkScore: String(int(...P.walk)),
    neighborhood: pick(NEIGHBORHOOD),
    impactArea: impact ? 'Yes' : 'No',
    jobsCreated: String(jobs),
    growthPlan: hasGrowth ? pick(GROWTH) : '',
    orgStructure: `${principal} owns ${ownerPct}% of ${firm}, which is managing member (${projectPct}%) of ${projName} LLC. Outside investors hold the remaining ${100 - projectPct}% of the project entity.`,
    urgeUses: loanUses,
    projectSources: sources,
    projectUses: uses,
    financials,
    totalAssets: String(assets),
    totalLiabilities: String(liabilities),
    totalEquity: String(equity),
    cash: String(cash),
    ownerSharePct: String(ownerPct),
    exitProceeds: String(exitProceeds),
    exitMonth: String(exitMonth),
    repaymentOptions,
    team,
    underwriterNotes: '',
  };

  const planted = [];
  if (chaotic) {
    // Anything goes: blank out fields, use extreme values, add odd text
    const blankable = Object.keys(deal).filter((k) => !['fundName'].includes(k));
    for (const k of shuffle(blankable).slice(0, int(0, 10))) deal[k] = Array.isArray(deal[k]) ? [] : '';
    if (chance(0.3)) deal.loanAmount = pick(['1', '999999999', '0', '12.5']);
    if (chance(0.3)) deal.interestRate = pick(['0', '45', 'abc', '-3']);
    if (chance(0.2)) deal.principalName = '<b>Dr. O’Neil & Sons</b> "quoted"';
  } else if (mistakes > 0) {
    // Some mistakes would hide each other (e.g. a typo'd term masks "repayment after maturity"),
    // so never plant two from the same group.
    const used = new Set();
    for (const type of shuffle(Object.keys(MISTAKES))) {
      if (planted.length >= mistakes) break;
      const g = MISTAKES[type].group || type;
      if (used.has(g)) continue;
      used.add(g);
      MISTAKES[type].apply(deal);
      planted.push({ type, level: MISTAKES[type].level, re: MISTAKES[type].re });
    }
  }
  return { deal, seed: Number(seed) || 1, profile: chosen, planted };
}
