// All exact math, rules and missing-field checks live here, never in the AI.
// The AI only writes narrative; every number in the memo comes from these functions.

export const NEEDS_INPUT = 'NEEDS INPUT'

// Risk thresholds. Adjust these to match URGE's credit policy.
export const THRESHOLDS = {
  ltv: { amber: 0.65, red: 0.75 }, // loan / property value: higher is riskier
  ltc: { amber: 0.7, red: 0.8 }, // loan / total project cost
  dscr: { amber: 1.35, red: 1.2 }, // NOI / annual debt service: lower is riskier
  equity: { amber: 0.2, red: 0.1 }, // sponsor equity / total project cost
  liquidityMonths: { amber: 12, red: 6 }, // months of debt service covered by liquid cash
  projects: { amber: 3, red: 1 }, // completed comparable projects
}

export const FIELD_LABELS = {
  companyName: 'Borrowing company',
  sponsorName: 'Sponsor / principal',
  propertyAddress: 'Property address',
  propertyType: 'Property type',
  loanAmount: 'Loan amount requested',
  interestRate: 'Interest rate',
  termMonths: 'Term',
  repayment: 'Repayment structure',
  useOfFunds: 'Use of funds',
  propertyValue: 'Property value (as-is or appraised)',
  projectCost: 'Total project cost',
  noi: 'Net operating income (annual)',
  sponsorEquity: 'Sponsor equity contribution',
  liquidity: 'Sponsor liquid cash',
  borrowerBio: 'Borrower bio',
  projectsCompleted: 'Completed comparable projects',
  collateral: 'Collateral',
  guarantees: 'Guarantees',
}

// Fields the memo cannot be complete without.
const REQUIRED = Object.keys(FIELD_LABELS)

export function num(v) {
  if (v === null || v === undefined) return null
  const s = String(v).replace(/[$,%\s]/g, '')
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export const money = (n) =>
  n === null ? NEEDS_INPUT : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
export const pct = (n, digits = 1) => (n === null ? NEEDS_INPUT : `${(n * 100).toFixed(digits)}%`)
export const times = (n) => (n === null ? NEEDS_INPUT : `${n.toFixed(2)}x`)

const div = (a, b) => (a === null || b === null || b === 0 ? null : a / b)

export function annualDebtService(loan, ratePct, repayment, amortYears) {
  if (loan === null || ratePct === null) return null
  const r = ratePct / 100
  if (repayment !== 'amortizing') return loan * r // interest-only
  const years = amortYears ?? null
  if (!years) return null
  if (r === 0) return loan / years
  const m = r / 12
  const n = years * 12
  const monthly = (loan * m) / (1 - Math.pow(1 + m, -n))
  return monthly * 12
}

export function computeMetrics(f) {
  const loan = num(f.loanAmount)
  const rate = num(f.interestRate)
  const term = num(f.termMonths)
  const value = num(f.propertyValue)
  const cost = num(f.projectCost)
  const noi = num(f.noi)
  const equity = num(f.sponsorEquity)
  const liquidity = num(f.liquidity)
  const projects = num(f.projectsCompleted)
  const ads = annualDebtService(loan, rate, f.repayment, num(f.amortYears))

  return {
    loan,
    rate,
    term,
    value,
    cost,
    noi,
    equity,
    liquidity,
    projects,
    ads,
    ltv: div(loan, value),
    ltc: div(loan, cost),
    dscr: div(noi, ads),
    equityPct: div(equity, cost),
    liquidityMonths: ads ? div(liquidity, ads / 12) : null,
    interestOverTerm: loan !== null && rate !== null && term !== null ? loan * (rate / 100) * (term / 12) : null,
  }
}

function grade(value, { amber, red }, higherIsRiskier) {
  if (value === null) return 'missing'
  if (higherIsRiskier) return value > red ? 'red' : value > amber ? 'amber' : 'green'
  return value < red ? 'red' : value < amber ? 'amber' : 'green'
}

// "What's on and what's off": one row per indicator, with the rule spelled out.
export function riskIndicators(m, f) {
  const T = THRESHOLDS
  const rows = [
    {
      key: 'ltv',
      label: 'Loan-to-value',
      value: pct(m.ltv),
      status: grade(m.ltv, T.ltv, true),
      rule: `On track at ${pct(T.ltv.amber, 0)} or below; off above ${pct(T.ltv.red, 0)}`,
    },
    {
      key: 'ltc',
      label: 'Loan-to-cost',
      value: pct(m.ltc),
      status: grade(m.ltc, T.ltc, true),
      rule: `On track at ${pct(T.ltc.amber, 0)} or below; off above ${pct(T.ltc.red, 0)}`,
    },
    {
      key: 'dscr',
      label: 'Debt service coverage',
      value: times(m.dscr),
      status: grade(m.dscr, T.dscr, false),
      rule: `On track at ${T.dscr.amber.toFixed(2)}x or above; off below ${T.dscr.red.toFixed(2)}x`,
    },
    {
      key: 'equity',
      label: 'Sponsor equity in deal',
      value: pct(m.equityPct),
      status: grade(m.equityPct, T.equity, false),
      rule: `On track at ${pct(T.equity.amber, 0)} or more; off below ${pct(T.equity.red, 0)}`,
    },
    {
      key: 'liquidity',
      label: 'Liquidity cushion',
      value: m.liquidityMonths === null ? NEEDS_INPUT : `${m.liquidityMonths.toFixed(1)} months of payments`,
      status: grade(m.liquidityMonths, T.liquidityMonths, false),
      rule: `On track at ${T.liquidityMonths.amber}+ months; off below ${T.liquidityMonths.red}`,
    },
    {
      key: 'projects',
      label: 'Track record',
      value: m.projects === null ? NEEDS_INPUT : `${m.projects} completed project${m.projects === 1 ? '' : 's'}`,
      status: grade(m.projects, T.projects, false),
      rule: `On track at ${T.projects.amber}+ projects; off below ${T.projects.red}`,
    },
  ]
  if (f.propertyType === 'Residential only') {
    rows.push({
      key: 'mandate',
      label: 'Fits URGE mandate',
      value: 'Residential only',
      status: 'red',
      rule: 'URGE invests in commercial and mixed-use companies, not residential-only',
    })
  }
  return rows
}

export function missingFields(f) {
  const missing = REQUIRED.filter((k) => !String(f[k] ?? '').trim()).map((k) => FIELD_LABELS[k])
  if (f.repayment === 'amortizing' && !num(f.amortYears)) missing.push('Amortization period')
  return missing
}

// Facts the AI is allowed to use. Numbers are pre-formatted so the AI never does math.
export function factSheet(f, m, indicators) {
  return {
    deal: {
      company: f.companyName || NEEDS_INPUT,
      sponsor: f.sponsorName || NEEDS_INPUT,
      address: f.propertyAddress || NEEDS_INPUT,
      propertyType: f.propertyType || NEEDS_INPUT,
      structure: f.structure,
      useOfFunds: f.useOfFunds || NEEDS_INPUT,
      loanAmount: money(m.loan),
      interestRate: m.rate === null ? NEEDS_INPUT : `${m.rate}%`,
      term: m.term === null ? NEEDS_INPUT : `${m.term} months`,
      repayment: f.repayment === 'amortizing' ? `Amortizing over ${f.amortYears || NEEDS_INPUT} years` : 'Interest-only',
      annualDebtService: money(m.ads),
      interestIncomeOverTerm: money(m.interestOverTerm),
      propertyValue: money(m.value),
      projectCost: money(m.cost),
      noi: money(m.noi),
      sponsorEquity: money(m.equity),
      sponsorLiquidity: money(m.liquidity),
    },
    indicators: indicators.map(({ label, value, status }) => ({ label, value, status })),
    userInputVerbatim: {
      borrowerBio: f.borrowerBio || NEEDS_INPUT,
      meetingNotes: f.meetingNotes || '',
      underwritingNotes: f.underwritingNotes || '',
      marketResearch: f.marketResearch || '',
      strengths: f.strengths || '',
      concerns: f.concerns || '',
      collateral: f.collateral || NEEDS_INPUT,
      guarantees: f.guarantees || NEEDS_INPUT,
      covenants: f.covenants || '',
    },
  }
}

const lines = (s) =>
  String(s || '')
    .split(/\n|;/)
    .map((x) => x.replace(/^[-•*\s]+/, '').trim())
    .filter(Boolean)

// Template narrative used when AI drafting is not connected (e.g. on test links).
export function templateNarrative(f, m, indicators, missing) {
  const off = indicators.filter((i) => i.status === 'red')
  const watch = indicators.filter((i) => i.status === 'amber')
  const company = f.companyName || `[${NEEDS_INPUT}: company]`
  const summary =
    `${company} is requesting a ${money(m.loan)} ${f.structure.toLowerCase()} ` +
    `${m.term !== null ? `over ${m.term} months ` : ''}at ${m.rate !== null ? `${m.rate}%` : `[${NEEDS_INPUT}: rate]`} ` +
    `to fund: ${f.useOfFunds ? f.useOfFunds.trim().replace(/[.\s]+$/, '') : `[${NEEDS_INPUT}: use of funds]`}. ` +
    `The property at ${f.propertyAddress || `[${NEEDS_INPUT}: address]`} is ${f.propertyType ? f.propertyType.toLowerCase() : `[${NEEDS_INPUT}: type]`}. ` +
    (off.length
      ? `${off.length} indicator${off.length > 1 ? 's are' : ' is'} outside URGE guidelines (${off.map((i) => i.label.toLowerCase()).join(', ')}) and should be discussed before committee. `
      : watch.length
        ? `No indicators are outside guidelines; ${watch.map((i) => i.label.toLowerCase()).join(', ')} ${watch.length > 1 ? 'are' : 'is'} worth watching. `
        : 'All calculated indicators are within URGE guidelines. ') +
    (missing.length ? `${missing.length} required item${missing.length > 1 ? 's are' : ' is'} still missing.` : '')

  const strengths = [
    ...indicators.filter((i) => i.status === 'green').map((i) => `${i.label} is ${i.value}, within guidelines.`),
    ...lines(f.strengths),
  ]
  const risks = [
    ...[...off, ...watch].map((i) => ({
      risk: `${i.label} is ${i.value} (${i.status === 'red' ? 'outside' : 'near the edge of'} guidelines).`,
      mitigant: `[Reviewer to add mitigant] (Guideline: ${i.rule}.)`,
    })),
    ...lines(f.concerns).map((c) => ({ risk: c, mitigant: '[Reviewer to add mitigant]' })),
  ]
  const questions = [
    ...missing.map((x) => `Please provide: ${x.toLowerCase()}.`),
    ...[...off, ...watch].map((i) => `What explains the ${i.label.toLowerCase()} of ${i.value}, and how will it be managed?`),
  ]
  return {
    executiveSummary: summary,
    marketContext: f.marketResearch || `[${NEEDS_INPUT}: market research, comparable deals and local news for this address]`,
    strengths,
    risks,
    followUpQuestions: questions,
    recommendation: '[Reviewer to decide: recommend / recommend with conditions / decline]',
  }
}
