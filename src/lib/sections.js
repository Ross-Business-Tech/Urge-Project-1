// Extra memo sections added by the underwriter. No server or database is used:
//  - "All future memos": kept in this browser (localStorage), so they appear in every memo
//    written on this device.
//  - "Just this memo": saved with the deal itself (deal.customSections, no templateId).
// The per-deal text for an "all future memos" section is a deal.customSections row with its templateId.

export const POSITIONS = [
  ['request', 'Request'], ['merits', 'Investment Merits'], ['breakdown', 'Project Breakdown'], ['sources', 'Project Sources and Uses'],
  ['mission', 'Mission Alignment'], ['impact', 'Neighborhood Impact Estimate'], ['overview', 'Investment Overview'],
  ['projections', 'Projected Financial Performance'], ['financials', 'Firm Financials'], ['repayment', 'Consolidated Repayment Capacity'],
  ['org', 'Organizational Structure'], ['team', 'Borrower & Sponsor Team'], ['risks', 'Risks & Mitigants'], ['news', 'Recent News'],
  ['flags', 'Underwriter Review'], ['sizing', 'Loan Sizing & Structuring'], ['recommendation', 'Recommendation'], ['approvals', 'Approvals'],
  ['end', 'the end (after the exhibits)'],
];
export const positionLabel = (k) => POSITIONS.find(([p]) => p === k)?.[1] || 'the end';

const KEY = 'memo-drafter-template-sections-v1';
export function loadTemplates() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
export function saveTemplates(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage unavailable (private window) */ }
}

// Every extra section to show in a memo, grouped by position: the "all future memos" sections
// (with this deal's text if any, otherwise their starting text), then this deal's own sections.
export function memoExtras(deal) {
  const rows = deal.customSections || [];
  const byTemplate = new Map(rows.filter((r) => r.templateId).map((r) => [String(r.templateId), r]));
  const out = {};
  const push = (pos, item) => { (out[pos] = out[pos] || []).push(item); };
  for (const t of deal.templateSections || []) {
    const own = byTemplate.get(String(t.id));
    push(t.position || 'end', { title: t.title, body: own?.body?.trim() ? own.body : t.body, template: true, filled: Boolean(own?.body?.trim()) });
  }
  for (const r of rows) if (!r.templateId && String(r.title || '').trim()) push(r.position || 'end', { title: r.title, body: r.body, template: false, filled: true });
  return out;
}
