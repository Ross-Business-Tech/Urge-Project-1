// Entirely made-up sample deal. No real people, companies or figures.
export const emptyDeal = {
  borrower: '',
  icDate: '',
  projectLead: '',
  underwriter: '',
  location: '',
  loanAmount: '',
  loanPurpose: '',
  loanType: '',
  collateral: '',
  term: '',
  interestRate: '',
  commitmentFee: '',
  interestHoldback: '',
  disbursement: '',
  successFee: '',
  sourcesUses: '',
  repaymentSources: '',
  notes: '',
}

export const sampleDeal = {
  borrower: 'Sample Borrower Development LLC',
  icDate: '2026-12-10',
  projectLead: 'Jordan Example',
  underwriter: 'Casey Sample',
  location: 'Sample Avenue corridor, Detroit, MI',
  loanAmount: '2000000',
  loanPurpose:
    'Project equity to support the borrower’s first mixed-use development: 24 apartments and 4,000 sq ft of ground-floor retail.',
  loanType: 'Senior secured term loan to the sponsor entity',
  collateral: 'Pledge of sponsor’s 30% interest in a stabilized portfolio; second position on the project',
  term: '36 months, interest-only, balloon at maturity',
  interestRate: '8%',
  commitmentFee: '1% ($20,000)',
  interestHoldback: '12 months of interest ($160,000) held back at closing',
  disbursement: 'Three draws tied to construction milestones',
  successFee: '1% of loan amount at repayment ($20,000)',
  sourcesUses:
    'Sources: EBIARA loan $2,000,000; senior construction loan $6,500,000; sponsor equity $1,000,000; total $9,500,000.\nUses: land and acquisition $1,500,000; hard costs $6,200,000; soft costs $1,300,000; reserves $500,000; total $9,500,000.',
  repaymentSources:
    '1. Cash flow sweep from the borrower’s 15% share of a $80M stabilized portfolio.\n2. Refinance proceeds on the Sample Lofts property (est. $1.4M after debt).\n3. Refinance proceeds on the sponsor’s 30% interest in a second holding in 2028.\n4. Sale or refinance of the new project at stabilization.\n5. Worst case: foreclose on the pledged portfolio interest.',
  notes: 'First-time developer of this size; strong track record managing existing apartments.',
}

export function money(value) {
  const n = Number(String(value).replace(/[^0-9.]/g, ''))
  return n ? '$' + n.toLocaleString('en-US') : value || '—'
}
