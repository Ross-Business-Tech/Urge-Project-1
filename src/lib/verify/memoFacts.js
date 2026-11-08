// Reads back what the memo ACTUALLY says now (including hand edits) and compares it with the deal data.
// The memo marks key figures with data-fact attributes: the loan amount (everywhere it appears)
// and the amount column of the loan-uses, project-sources and project-uses tables.
import { num, money } from '../format.js';
import { allowedNumbers } from './memoText.js';

const KEYS = ['loanUse', 'source', 'use'];
const AMT = '(\\$?[\\d,]{3,})';
// The loan amount is read from the sentences that state it, so it still works after someone retypes the number.
const LOAN_PATTERNS = [
  new RegExp(AMT + '\\s+enterprise loan'),
  new RegExp('\\ba\\s+' + AMT + '\\s+loan\\b'),
  new RegExp('requests a\\s+' + AMT),
  new RegExp('would lend\\s+' + AMT + '\\s+to'),
  new RegExp('annual interest on\\s+' + AMT + '\\s+is'),
  new RegExp('Loan amount\\s+' + AMT),
];
export const LOAN_MENTIONS = LOAN_PATTERNS.length; // how many places the memo states the loan amount

export function loanMentions(text) {
  const out = [];
  for (const re of LOAN_PATTERNS) { const m = (text || '').match(re); if (m) out.push(num(m[1])); }
  return out;
}

// text = the memo as plain text; rows = [{fact, text}] from the amount columns of the money tables
export function factsFromList(rows, text) {
  const out = { loan: loanMentions(text), ...Object.fromEntries(KEYS.map((k) => [k, []])) };
  for (const { fact, text: t } of rows) if (out[fact] && fact !== 'loan') out[fact].push(num(t));
  return out;
}
// In the browser
export const readFactsFromDom = (root) =>
  factsFromList([...root.querySelectorAll('[data-fact]')].map((el) => ({ fact: el.dataset.fact, text: el.textContent })), root.innerText);
// In tests (server-rendered HTML)
export function readFactsFromHtml(html) {
  const rows = [];
  for (const m of html.matchAll(/<(\w+)[^>]*\sdata-fact="(\w+)"[^>]*>(.*?)<\/\1>/g)) rows.push({ fact: m[2], text: m[3].replace(/<[^>]+>/g, '') });
  return factsFromList(rows, html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' '));
}

// The deal as the memo now reads
export function applyFacts(deal, facts) {
  const d = structuredClone(deal);
  const loans = [...new Set(facts.loan)];
  if (loans.length === 1) d.loanAmount = String(loans[0]);
  for (const [key, fact] of [['urgeUses', 'loanUse'], ['projectSources', 'source'], ['projectUses', 'use']]) {
    const vals = facts[fact];
    if (vals.length && vals.length === (d[key] || []).length) d[key] = d[key].map((r, i) => ({ ...r, amount: String(vals[i]) }));
  }
  return d;
}

const total = (rows) => rows.reduce((t, r) => t + num(r.amount), 0);

export function checkFacts(deal, facts) {
  const items = [];
  const allowed = allowedNumbers(deal);
  const traceable = (v) => allowed.some((a) => Math.abs(a - v) <= 0.5);
  const differs = (label, memoVal, formVal) => ({
    area: 'Memo vs form',
    level: traceable(memoVal) ? 'warn' : 'fail',
    title: `${label} in the memo (${money(memoVal)}) differs from the deal form (${money(formVal)})`,
    detail: traceable(memoVal)
      ? 'The memo was changed by hand and now disagrees with your data. Update the deal data (Edit data) and write the memo again so they match.'
      : 'This figure is not in your data at all. Check it against the source, then update the deal data and write the memo again.',
  });

  const loans = [...new Set(facts.loan)];
  const formLoan = num(deal.loanAmount);
  if (!facts.loan.length && formLoan > 0) {
    items.push({ area: 'Memo vs form', level: 'warn', title: 'Could not find the loan amount in the memo', detail: 'It may have been deleted or retyped over. Write the memo again to restore it.' });
  } else if (facts.loan.length < LOAN_MENTIONS && loans.length === 1 && Math.abs(loans[0] - formLoan) <= 0.5) {
    items.push({ area: 'Memo vs form', level: 'warn', title: `Found the loan amount in only ${facts.loan.length} of ${LOAN_MENTIONS} places in the memo`, detail: 'A sentence that states the loan amount may have been reworded or deleted, so it could not be checked.' });
  } else if (loans.length > 1) {
    items.push({ area: 'Memo vs form', level: 'fail', title: `The loan amount differs across the memo: ${loans.map((v) => money(v)).join(' and ')}`, detail: `The memo states the loan amount ${facts.loan.length} times. Make every mention the same.` });
  } else if (loans.length === 1 && Math.abs(loans[0] - formLoan) > 0.5) {
    items.push(differs('Loan amount', loans[0], formLoan));
  } else if (loans.length === 1) {
    items.push({ area: 'Memo vs form', level: 'pass', title: `Loan amount is the same in all ${facts.loan.length} places in the memo and matches your data`, detail: '' });
  }

  for (const [key, fact, label] of [['urgeUses', 'loanUse', 'Loan uses total'], ['projectSources', 'source', 'Project sources total'], ['projectUses', 'use', 'Project uses total']]) {
    const rows = deal[key] || [];
    if (!rows.length || facts[fact].length !== rows.length) continue;
    const memoSum = facts[fact].reduce((a, b) => a + b, 0);
    if (Math.abs(memoSum - total(rows)) > 0.5) items.push(differs(label, memoSum, total(rows)));
  }
  return items;
}
