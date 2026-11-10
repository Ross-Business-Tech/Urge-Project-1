// The Red / Yellow / Green rules, written down in one place.
// The checker re-computes every rating from THESE numbers, independently of analysis.js,
// so if someone changes a rule in one place and not the other, the report flags it.
// URGE staff should confirm or change these thresholds.
export const rubric = {
  experience: { greenYears: 10, yellowYears: 5, greenIfYearsAtLeast: 8, withProjectsAtLeast: 5 },
  leverage: { greenBelow: 2.0, yellowUpTo: 3.0 }, // debt-to-equity after the loan
  cash: { greenMonths: 12, yellowMonths: 6 }, // months of interest covered by cash
  repayment: { greenCoverage: 1.5, yellowCoverage: 1.2 }, // expected proceeds / (principal + interest)
  repaymentCushionMonths: 3, // months between repayment event and maturity
  walkScore: { green: 70 },
  jobsGreen: 25,
  missionGreensForGreen: 3,
  missionGreensForYellow: 2,
  // Plausibility ranges (warn if outside)
  plausible: { ratePct: [0.5, 25], termMonths: [1, 120], feePct: [0, 5] },
  // Minimum repayment paths (from URGE's notes: they like 3 to 5) and words that signal a worst-case path
  minRepaymentOptions: 3,
  worstCaseWords: ['guarantee', 'worst', 'collateral', 'liquidat', 'foreclos', 'lien', 'sale of'],
  // PROPOSED rule (not yet confirmed by URGE): the overall rating should never look better than the red flags.
  // Any red flag => overall at least yellow. Red in these areas => overall red.
  criticalRedAreas: ['Financial strength', 'Repayment', 'Sources & Uses', 'Experience'],
  // "Anything unusual gets flagged": outlier thresholds. These are warnings to confirm, not errors. URGE staff should tune them.
  atypical: {
    loanRange: [25000, 25000000],
    projectCostRange: [50000, 1000000000],
    minLoanShareOfProject: 0.02,
    maxLiabilitiesToEquity: 10,
    maxLoanToLatestRevenue: 3,
    maxCoverage: 10, // expected proceeds / amount owed
    costPerSqFt: [40, 2500],
    maxJobs: 1000,
    maxYears: 50,
    maxProjects: 150,
    maxProjectsPerYear: 12,
    yearRange: [1990, 2040],
    memoYearRange: [2020, 2040],
    marginRange: [-0.5, 0.6],
    revenueChange: [-0.5, 1.0], // year-over-year
    minActualYears: 2,
    shortText: 20,
    longText: 5000,
    mostlyBlank: 0.4, // share of fields blank before the whole deal is called mostly blank
    topRowShare: 0.9,
  },
};
