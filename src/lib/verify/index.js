import { checkDeal } from './checks.js';
import { checkRatings } from './ratings.js';
import { checkMemoText } from './memoText.js';

// Runs every check and returns { items, counts }. `memoText` is optional (the written memo as plain text).
export function verifyAll(deal, memoText) {
  let items = [];
  try {
    items = [...checkDeal(deal), ...checkRatings(deal)];
    if (memoText) items.push(...checkMemoText(memoText, deal));
  } catch (e) {
    items.push({ area: 'Checks', level: 'fail', title: 'The checker itself hit an error', detail: String(e?.message || e) });
  }
  const counts = { pass: 0, warn: 0, fail: 0 };
  items.forEach((i) => counts[i.level]++);
  return { items, counts };
}
