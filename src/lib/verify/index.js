import { checkDeal } from './checks.js';
import { checkRatings } from './ratings.js';
import { checkMemoText } from './memoText.js';
import { applyFacts, checkFacts } from './memoFacts.js';

// Runs every check and returns { items, counts }.
// `memoText` is the written memo as plain text; `facts` are the figures read back from the memo (see memoFacts.js).
// Data checks run on the deal AS THE MEMO NOW READS, so fixing a figure in the memo clears the matching flag.
export function verifyAll(deal, memoText, facts) {
  let items = [];
  try {
    const effective = facts ? applyFacts(deal, facts) : deal;
    items = [...checkDeal(effective), ...checkRatings(deal)];
    if (memoText) items.push(...checkMemoText(memoText, deal, effective));
    if (facts) items.push(...checkFacts(deal, facts));
  } catch (e) {
    items.push({ area: 'Checks', level: 'fail', title: 'The checker itself hit an error', detail: String(e?.message || e) });
  }
  const counts = { pass: 0, warn: 0, fail: 0 };
  items.forEach((i) => counts[i.level]++);
  return { items, counts };
}
