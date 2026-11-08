// Independent re-computation of the Red/Yellow/Green ratings from rubric.js.
import { num, has, sum } from '../format.js';
import { analyze } from '../analysis.js';
import { rubric as R } from './rubric.js';

const RANK = { green: 0, yellow: 1, red: 2 };
const worst = (ls) => ls.reduce((w, l) => (RANK[l] > RANK[w] ? l : w), 'green');
const th = (v, greenOk, yellowOk) => (greenOk(v) ? 'green' : yellowOk(v) ? 'yellow' : 'red');

// Returns { key: level } for each criterion we can rate from the data.
export function rateIndependent(deal) {
  const out = {};
  const loan = num(deal.loanAmount);
  const annualInterest = loan * (num(deal.interestRate) / 100);
  const term = num(deal.termMonths);
  const totalOwed = loan + annualInterest * (term / 12);

  if (has(deal.yearsExperience)) {
    const y = num(deal.yearsExperience);
    let l = th(y, (v) => v >= R.experience.greenYears, (v) => v >= R.experience.yellowYears);
    if (l === 'yellow' && num(deal.projectsCompleted) >= R.experience.withProjectsAtLeast && y >= R.experience.greenIfYearsAtLeast) l = 'green';
    out.experience = l;
  }
  const equity = num(deal.totalEquity);
  if (equity > 0 && has(deal.totalLiabilities)) {
    const de = (num(deal.totalLiabilities) + loan) / equity;
    out.leverage = th(de, (v) => v < R.leverage.greenBelow, (v) => v <= R.leverage.yellowUpTo);
  } else if (has(deal.totalLiabilities)) out.leverage = 'red';
  if (annualInterest > 0 && has(deal.cash)) {
    const m = num(deal.cash) / (annualInterest / 12);
    out.cash = th(m, (v) => v >= R.cash.greenMonths, (v) => v >= R.cash.yellowMonths);
  }
  if (totalOwed > 0 && num(deal.exitProceeds) > 0) {
    const c = num(deal.exitProceeds) / totalOwed;
    out.repayment = th(c, (v) => v >= R.repayment.greenCoverage, (v) => v >= R.repayment.yellowCoverage);
  }
  if (has(deal.walkScore)) out.walk = num(deal.walkScore) >= R.walkScore.green ? 'green' : 'yellow';

  const greens = [
    deal.bipocOwned === 'Yes',
    has(deal.growthPlan),
    num(deal.jobsCreated) >= R.jobsGreen,
    deal.impactArea === 'Yes',
  ].filter(Boolean).length;
  out.mission = greens >= R.missionGreensForGreen ? 'green' : greens >= R.missionGreensForYellow ? 'yellow' : 'red';
  return out;
}

// How each independent criterion is found among analysis.js's flags (by area + title).
const FLAG_MATCH = {
  experience: (f) => f.area === 'Experience',
  leverage: (f) => f.area === 'Financial strength' && /^Debt-to-equity|zero or negative equity/.test(f.title),
  cash: (f) => f.area === 'Financial strength' && /^Cash covers/.test(f.title),
  repayment: (f) => f.area === 'Repayment' && /^Primary repayment source/.test(f.title),
  walk: (f) => f.area === 'Location',
};
const LABEL = { experience: 'Experience', leverage: 'Debt-to-equity', cash: 'Cash cushion', repayment: 'Repayment coverage', walk: 'Walk Score', mission: 'Mission alignment' };

// Compare the app's ratings with the independent ones. Returns check items.
export function checkRatings(deal, memoOverall) {
  const a = analyze(deal);
  // If the memo's overall rating was changed by hand, judge the consistency of what the memo now says
  const overall = ['green', 'yellow', 'red'].includes(memoOverall) ? memoOverall : a.overall;
  const mine = rateIndependent(deal);
  const items = [];
  let compared = 0;

  for (const [key, match] of Object.entries(FLAG_MATCH)) {
    if (!mine[key]) continue;
    const flag = a.flags.find(match);
    compared++;
    if (!flag) items.push({ area: 'Ratings', level: 'fail', title: `${LABEL[key]}: the memo shows no rating`, detail: `The rules give ${mine[key]}, but the memo has no matching flag.` });
    else if (flag.level !== mine[key]) items.push({ area: 'Ratings', level: 'fail', title: `${LABEL[key]}: memo says ${flag.level}, rules say ${mine[key]}`, detail: `"${flag.title}". Rules are in src/lib/verify/rubric.js. One of the two is out of date.` });
  }
  const missionApp = a.missionLevel;
  compared++;
  if (missionApp !== mine.mission) items.push({ area: 'Ratings', level: 'fail', title: `Mission alignment: memo says ${missionApp}, rules say ${mine.mission}`, detail: 'The four mission criteria were re-counted and disagree with the memo.' });

  if (!items.length) items.push({ area: 'Ratings', level: 'pass', title: `All ${compared} ratings match the written rules`, detail: '' });

  // Proposed consistency rule: overall must not look better than the red flags.
  const reds = a.flags.filter((f) => f.level === 'red');
  const hardReds = reds.filter((f) => R.criticalRedAreas.includes(f.area));
  if (hardReds.length && overall !== 'red') {
    items.push({ area: 'Ratings', level: 'warn', title: `Overall is ${overall}, but there is a red item in a critical area`, detail: `"${hardReds[0].title}" (${hardReds[0].area}). Proposed rule: a red flag in ${R.criticalRedAreas.join(', ')} should make the overall rating red. Confirm with URGE.` });
  } else if (reds.length && overall === 'green') {
    items.push({ area: 'Ratings', level: 'warn', title: 'Overall is green, but the memo contains a red item', detail: `"${reds[0].title}". Proposed rule: any red flag makes the overall rating at least yellow.` });
  } else {
    items.push({ area: 'Ratings', level: 'pass', title: 'Overall rating is consistent with the red flags', detail: '' });
  }
  return items;
}

export { worst, RANK, sum };
