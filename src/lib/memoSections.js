import { money } from './sampleDeal.js'


// What each section should contain; used to instruct the AI.
export const sectionSpecs = [
  { id: 'request', title: '1. Request summary', guidance: 'One paragraph: loan amount, borrower, purpose, location, price, terms, success fee.' },
  { id: 'sources', title: '2. Sources and uses', guidance: 'How the borrower will spend the money; where the EBIARA loan sits in the project finance.' },
  { id: 'criteria', title: '3. Investment criteria and overall assessment', guidance: 'Experience, mission alignment, financial strength (excess assets, excess cash flow). Give overall rating; list mitigants for any yellow.' },
  { id: 'considerations', title: '4. Considerations', guidance: 'Few sentences each: service-driven impact, minority contract support, management experience, principal financial strength, development team, risk management, Walk/Transit/Bike score (only if supplied).' },
  { id: 'mission', title: '5. Mission alignment', guidance: 'BIPOC-owned firm, potential scale/acceleration, economic impact, neighborhood impact area, overall rating.' },
  { id: 'collateral', title: '6. Collateral and capital structure', guidance: 'Debt-to-equity and the percentage the principal currently owns; collateral offered.' },
  { id: 'overview', title: '7. Investment overview and organizational structure', guidance: 'How the deal is broken down and where EBIARA money sits in the borrower\u2019s structure.' },
  { id: 'team', title: '8. Team', guidance: 'Names, companies and short bios of the team.' },
  { id: 'financials', title: '9. Firm financials', guidance: '2-3 years of history then projections. Note outliers, e.g. sudden cash-flow jumps. Show what the principal actually receives from his share.' },
  { id: 'sizing', title: '10. Loan sizing and repayment', guidance: 'MOST IMPORTANT. Give 3-5 independent ways EBIARA gets repaid (ownership, refinance proceeds, cash flow, real estate portfolio). Always cover worst-case scenarios. Include a refinance analysis: proceeds minus debt.' },
  { id: 'recommendation', title: '11. Recommendation and term sheet', guidance: 'Recommendation, then term sheet: commitment, loan type, purpose, collateral, term/repayment, commitment fee, interest, interest holdback, disbursement, success fee.' },
]

const dash = (v) => (v && String(v).trim() ? v : '[not provided yet]')

// Builds the demo draft from the deal form. Phase 2 replaces `body` with AI-written text.
// rating: 'green' | 'yellow' | 'red' | null
export function buildMemo(d) {
  return [
    {
      id: 'request',
      title: '1. Request summary',
      rating: null,
      body: `EBIARA is asked to approve a ${money(d.loanAmount)} loan to ${dash(d.borrower)} for ${dash(d.loanPurpose)} Location: ${dash(d.location)}. Presented to the investment committee on ${dash(d.icDate)} by ${dash(d.underwriter)} (project lead: ${dash(d.projectLead)}).`,
    },
    {
      id: 'sources',
      title: '2. Sources and uses',
      rating: null,
      body: dash(d.sourcesUses),
    },
    {
      id: 'criteria',
      title: '3. Investment criteria and overall assessment',
      rating: 'green',
      body: `Experience, mission alignment and financial strength are reviewed against EBIARA criteria. ${dash(d.notes)} Overall assessment: Green, with mitigants to be listed for any Yellow items.`,
    },
    {
      id: 'considerations',
      title: '4. Considerations',
      rating: 'yellow',
      body: 'Service-driven impact, minority contracting support, management experience, principal financial strength, development team, risk management and neighborhood Walk / Transit / Bike scores. [Detail to be drafted from uploaded borrower materials.]',
    },
    {
      id: 'mission',
      title: '5. Mission alignment',
      rating: 'green',
      body: 'BIPOC-owned firm, potential for scale and acceleration, economic impact, and neighborhood impact area. [To be drafted from borrower materials.]',
    },
    {
      id: 'collateral',
      title: '6. Collateral and capital structure',
      rating: 'yellow',
      body: `Collateral: ${dash(d.collateral)}. Debt-to-equity and ownership charts will appear here.`,
    },
    {
      id: 'overview',
      title: '7. Investment overview and organizational structure',
      rating: null,
      body: `Loan type: ${dash(d.loanType)}. Term: ${dash(d.term)}. Disbursement: ${dash(d.disbursement)}. An organizational chart showing where EBIARA’s money sits will be added from the borrower’s structure.`,
    },
    {
      id: 'team',
      title: '8. Team',
      rating: null,
      body: 'Names, companies and short bios of the borrower’s team. [Upload bios to draft this section.]',
    },
    {
      id: 'financials',
      title: '9. Firm financials',
      rating: 'yellow',
      body: 'Two to three years of historical financials followed by projections, with notes on anything unusual (for example, a sudden jump in cash flow). [Upload financials to draft this section.]',
    },
    {
      id: 'sizing',
      title: '10. Loan sizing and repayment (most important)',
      rating: 'yellow',
      body: `How EBIARA gets its money back — aim for three to five independent sources, always including the worst case.\n${dash(d.repaymentSources)}`,
    },
    {
      id: 'recommendation',
      title: '11. Recommendation and term sheet',
      rating: 'green',
      body: `Recommend approval of the ${money(d.loanAmount)} loan.\nType: ${dash(d.loanType)}\nCollateral: ${dash(d.collateral)}\nTerm / repayment: ${dash(d.term)}\nCommitment fee: ${dash(d.commitmentFee)}\nInterest: ${dash(d.interestRate)}\nInterest holdback: ${dash(d.interestHoldback)}\nDisbursement: ${dash(d.disbursement)}\nSuccess fee: ${dash(d.successFee)}`,
    },
  ]
}
