// Neighborhood impact calculator: a planning estimate of what a project adds to its
// neighborhood, worked out from each deal's own inputs (total cost, residential units,
// commercial space, jobs). Every result is a LOW-HIGH RANGE because the assumptions vary by
// market. These are screening estimates for the memo, not an economic impact study.
//
// The assumptions are written down here in one place so URGE / EBIARA staff can change them.
import { num, has } from './format.js';

export const IMPACT_ASSUMPTIONS = {
  // One-time: total economic activity created by spending the development budget locally
  // (direct + supplier + household spending), as a multiple of total development cost.
  outputMultiplier: [1.5, 2.0],
  // One-time: construction job-years supported per $1M of development cost.
  constructionJobsPerMillion: [6, 10],
  // Every year: property tax as a share of development cost (effective rate on the finished building).
  propertyTaxPct: [1.5, 3.0],
  // Every year: what each occupied household spends at local businesses.
  householdLocalSpend: [12000, 20000],
  residentialOccupancyPct: 93,
  // Every year: sales by the businesses in the commercial space, per occupied sq ft.
  commercialSalesPerSqFt: [150, 300],
  commercialOccupancyPct: 85,
  // Permanent jobs when the borrower gives no estimate: sq ft per commercial job, and on-site jobs per apartment.
  sqFtPerJob: [450, 250],
  jobsPerUnit: [0.03, 0.05],
  taxYears: 10,
  perMillion: 1000000, // the "$1M" in the construction-jobs explanation
};

const A = IMPACT_ASSUMPTIONS;
const range = (lo, hi) => ({ low: Math.min(lo, hi), high: Math.max(lo, hi) });

// Returns null when the deal has nothing to estimate from.
export function neighborhoodImpact(deal, projectCost) {
  const cost = num(projectCost);
  const units = num(deal.residentialUnits);
  const commercial = num(deal.commercialSqFt);
  if (!(cost > 0) && !(units > 0) && !(commercial > 0)) return null;

  const rows = [];
  const add = (key, label, kind, r, basis, when = 'one-time') => rows.push({ key, label, kind, ...r, basis, when });

  if (cost > 0) {
    add('output', 'Local economic activity from construction', '$',
      range(cost * A.outputMultiplier[0], cost * A.outputMultiplier[1]),
      `Total development cost × ${A.outputMultiplier[0]}x–${A.outputMultiplier[1]}x local spending multiplier`);
    const cj = has(deal.constructionJobs) ? num(deal.constructionJobs) : null;
    add('constructionJobs', 'Construction jobs (job-years)', 'n',
      cj !== null ? range(cj, cj) : range((cost / 1e6) * A.constructionJobsPerMillion[0], (cost / 1e6) * A.constructionJobsPerMillion[1]),
      cj !== null ? 'Borrower’s estimate (Construction jobs field)' : `${A.constructionJobsPerMillion[0]}–${A.constructionJobsPerMillion[1]} job-years per $1M of development cost`);
    const t = has(deal.propertyTaxRatePct) ? [num(deal.propertyTaxRatePct), num(deal.propertyTaxRatePct)] : A.propertyTaxPct;
    const tax = range((cost * t[0]) / 100, (cost * t[1]) / 100);
    add('propertyTax', 'Property taxes', '$', tax,
      has(deal.propertyTaxRatePct) ? `Total development cost × ${t[0]}% local property tax rate` : `Total development cost × ${t[0]}%–${t[1]}% effective property tax rate`, 'per year');
    add('propertyTax10', `Property taxes over ${A.taxYears} years`, '$', range(tax.low * A.taxYears, tax.high * A.taxYears),
      `${A.taxYears} years of the yearly property taxes above (before any abatement)`, `${A.taxYears}-year total`);
  }
  if (units > 0) {
    const households = units * (A.residentialOccupancyPct / 100);
    add('householdSpend', 'Resident spending at local businesses', '$',
      range(households * A.householdLocalSpend[0], households * A.householdLocalSpend[1]),
      `${units} units × ${A.residentialOccupancyPct}% occupied × $${A.householdLocalSpend[0].toLocaleString()}–$${A.householdLocalSpend[1].toLocaleString()} per household`, 'per year');
  }
  if (commercial > 0) {
    const occupied = commercial * (A.commercialOccupancyPct / 100);
    add('commercialSales', 'Business sales in the commercial space', '$',
      range(occupied * A.commercialSalesPerSqFt[0], occupied * A.commercialSalesPerSqFt[1]),
      `${commercial.toLocaleString()} sq ft × ${A.commercialOccupancyPct}% occupied × $${A.commercialSalesPerSqFt[0]}–$${A.commercialSalesPerSqFt[1]} sales per sq ft`, 'per year');
  }
  if (has(deal.jobsCreated)) {
    const j = num(deal.jobsCreated);
    add('permanentJobs', 'Permanent jobs', 'n', range(j, j), 'Borrower’s estimate (Permanent jobs field)', 'ongoing');
  } else if (units > 0 || commercial > 0) {
    add('permanentJobs', 'Permanent jobs', 'n',
      range(commercial / A.sqFtPerJob[0] + units * A.jobsPerUnit[0], commercial / A.sqFtPerJob[1] + units * A.jobsPerUnit[1]),
      `One job per ${A.sqFtPerJob[1]}–${A.sqFtPerJob[0]} sq ft of commercial space, plus ${A.jobsPerUnit[0]}–${A.jobsPerUnit[1]} on-site jobs per apartment`, 'ongoing');
  }
  return { rows, assumptions: A };
}
