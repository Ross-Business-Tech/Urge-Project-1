// Ready-made, made-up sample loans. Each tells a different story. Fixed seeds keep them stable.
import { sampleDeal } from './sampleDeal.js';
import { randomDeal } from './randomDeal.js';

const strong = randomDeal(101, { profile: 'strong' }).deal;

const weak = randomDeal(202, { profile: 'weak' }).deal;

// Strong borrower, but the projections are far above the firm's history
const aggressive = randomDeal(303, { profile: 'strong' }).deal;
{
  const f = aggressive.financials;
  const lastActual = f.filter((r) => r.type === 'Actual').at(-1);
  const proj = f.filter((r) => r.type === 'Projected');
  proj[0].revenue = String(Math.round(Number(lastActual.revenue) * 1.35 / 10000) * 10000);
  proj[1].revenue = String(Math.round(Number(proj[0].revenue) * 1.9 / 10000) * 10000);
}

// A mid deal with a lot left blank
const thin = randomDeal(404, { profile: 'mid' }).deal;
for (const k of ['principalBio', 'orgStructure', 'collateral', 'walkScore', 'neighborhood', 'growthPlan', 'totalLiabilities', 'totalEquity', 'cash', 'exitProceeds', 'projectAddress']) thin[k] = '';
thin.repaymentOptions = [];
thin.team = [];

// A mid deal with three planted data mistakes the Verification report should catch
const messy = randomDeal(505, { profile: 'mid', mistakes: 3 });

export const sampleLoans = [
  { id: 'linden', name: 'Linden Street Commons ($750K)', blurb: 'The original sample. Medium risk: overall Yellow.', deal: sampleDeal },
  { id: 'strong', name: 'Strong borrower', blurb: 'Experienced firm, low debt, plenty of repayment cover. Overall Green.', deal: strong },
  { id: 'weak', name: 'First-time, heavily indebted borrower', blurb: 'Short track record, high debt, thin cash. Overall Red.', deal: weak },
  { id: 'aggressive', name: 'Rosy projections', blurb: 'Good borrower, but projected growth is far above its history. Check the flags.', deal: aggressive },
  { id: 'thin', name: 'Incomplete data', blurb: 'Many fields left blank. Memo shows placeholders and the report lists what is missing.', deal: thin },
  { id: 'messy', name: 'Deal with data mistakes', blurb: `Three planted errors (${messy.planted.map((p) => p.type).join(', ')}). The Verification report should catch them.`, deal: messy.deal },
];
