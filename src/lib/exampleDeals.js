// Three entirely made-up example deals, each with a pre-written memo.
// Used for the early demo so the whole flow can be tried without the AI connected.
import { emptyDeal, sampleDeal } from './sampleDeal.js'

const S = (id, title, rating, body) => ({ id, title, rating, body })

const lofts = {
  id: 'lofts',
  name: 'Sample Lofts: mixed-use project ($2M)',
  summary: 'First-time developer with a strong management record. Overall: Green.',
  deal: sampleDeal,
  memo: {
    sections: [
      S('request', '1. Request summary', null, 'EBIARA is asked to approve a $2,000,000 loan to Sample Borrower Development LLC to provide project equity for its first mixed-use development: 24 apartments and 4,000 sq ft of ground-floor retail on the Sample Avenue corridor, Detroit, MI. The loan is a 36 month, interest-only senior secured term loan at 8%, with a 1% success fee ($20,000).'),
      S('sources', '2. Sources and uses', null, 'The $9,500,000 project is funded by the EBIARA loan ($2,000,000), a senior construction loan ($6,500,000) and sponsor equity ($1,000,000). Funds go to land and acquisition ($1,500,000), hard costs ($6,200,000), soft costs ($1,300,000) and reserves ($500,000). EBIARA funds in three draws tied to construction milestones.'),
      S('criteria', '3. Investment criteria and overall assessment', 'green', 'Experience: the sponsor has managed existing apartments for years but this is the first ground-up project of this size (yellow, mitigated by the experienced development team). Mission alignment: strong. Financial strength: the sponsor receives cash flow from a 15% share of a stabilized portfolio. Overall assessment: Green.'),
      S('considerations', '4. Considerations', 'yellow', 'Impact: 24 apartments and neighborhood retail on a corridor that needs both. Management experience: strong on operations, limited on construction. Risk management: construction cost overruns are the main risk; hard costs of $6,200,000 should carry a contingency review before the first draw. Walk, transit and bike scores were not provided. [Gap: add from walkscore.com]'),
      S('mission', '5. Mission alignment', 'green', 'The borrower is a locally owned, community-rooted firm. The project creates housing and retail jobs on the Sample Avenue corridor, and success would let the borrower scale to larger projects.'),
      S('collateral', '6. Collateral and capital structure', 'yellow', 'Collateral is a pledge of the sponsor’s 30% interest in a stabilized portfolio plus a second position on the project. Because the senior construction loan ($6,500,000) is ahead of EBIARA on the project, the pledged portfolio interest is the stronger protection.'),
      S('overview', '7. Investment overview and organizational structure', null, 'EBIARA lends to the sponsor entity, not to the project. The sponsor owns the project and holds interests in existing holdings. Money flows: EBIARA loan to sponsor, sponsor equity into the project, with distributions from the portfolio flowing back to the sponsor. [Org chart to be supplied by the borrower]'),
      S('team', '8. Team', null, 'Principal: Jordan Example (sample name), long-time apartment operator. Development manager and general contractor to be named. [Upload bios to complete this section]'),
      S('financials', '9. Firm financials', 'yellow', 'The borrower’s 15% share of a $80M stabilized portfolio provides the cash flow supporting repayment. Two to three years of history and projections should be added; any year-over-year jump in cash flow should be explained before committee.'),
      S('sizing', '10. Loan sizing and repayment', 'yellow', 'EBIARA has five paths to repayment: (1) cash flow sweep from the borrower’s 15% share of the portfolio; (2) refinance proceeds on the Sample Lofts property, estimated at $1.4M after debt; (3) refinance proceeds on the sponsor’s 30% interest in a second holding in 2028; (4) sale or refinance of the new project at stabilization; (5) worst case: foreclose on the pledged portfolio interest. The worst case recovers value only if the portfolio interest holds its value.'),
      S('recommendation', '11. Recommendation and term sheet', 'green', 'Recommend approval of the $2,000,000 loan.\nType: Senior secured term loan to the sponsor entity\nCollateral: Pledge of sponsor’s 30% interest in a stabilized portfolio; second position on the project\nTerm / repayment: 36 months, interest-only, balloon at maturity\nCommitment fee: 1% ($20,000)\nInterest: 8%\nInterest holdback: 12 months of interest ($160,000) held back at closing\nDisbursement: Three draws tied to construction milestones\nSuccess fee: 1% of loan amount at repayment ($20,000)'),
    ],
    repayment: [
      { label: 'Lofts refinance', value: 1400000 },
    ],
    gaps: ['Walk, transit and bike scores', 'Organizational chart from the borrower', 'Team bios', 'Two to three years of historical financials'],
    challenges: [
      'Is a first ground-up project realistic for a borrower whose experience is operating buildings?',
      'What happens to repayment if construction costs overrun and the senior lender pauses draws?',
      'Does the 2028 refinance depend on a market assumption the borrower has not tested?',
    ],
  },
}

const market = {
  id: 'market',
  name: 'Corner Market Co-op: grocery build-out ($750K)',
  summary: 'Neighborhood grocery opening a second store. Overall: Yellow.',
  deal: {
    ...emptyDeal,
    borrower: 'Sample Corner Market Cooperative',
    icDate: '2026-12-17',
    projectLead: 'Riley Example',
    underwriter: 'Casey Sample',
    location: 'Sample Boulevard, Detroit, MI',
    loanAmount: '750000',
    loanPurpose: 'Build-out, equipment and opening inventory for the cooperative’s second grocery store in an under-served neighborhood.',
    loanType: 'Secured term loan to the cooperative',
    collateral: 'First lien on equipment and leasehold improvements; personal guarantee from the founder',
    term: '48 months: 12 months interest-only, then amortizing',
    interestRate: '7%',
    commitmentFee: '1% ($7,500)',
    interestHoldback: '6 months of interest ($26,250)',
    disbursement: 'Two draws: at lease signing and at equipment delivery',
    successFee: '0.5% of loan amount at repayment ($3,750)',
    sourcesUses:
      'Sources: EBIARA loan $750,000; owner equity $250,000; community grant $150,000; total $1,150,000.\nUses: build-out $700,000; equipment $300,000; inventory $100,000; reserves $50,000; total $1,150,000.',
    repaymentSources:
      '1. Cash flow from the existing store: $120,000 per year available for debt service.\n2. Cash flow from the second store once open.\n3. Liquidation of equipment: $200,000 estimated.\n4. Personal guarantee from the founder.\n5. Worst case: liquidate equipment and call the guarantee.',
    notes: 'Existing store is profitable; grant is committed but not yet received.',
  },
  memo: {
    sections: [
      S('request', '1. Request summary', null, 'EBIARA is asked to approve a $750,000 secured term loan to Sample Corner Market Cooperative for the build-out, equipment and opening inventory of its second grocery store on Sample Boulevard, Detroit, MI. Term is 48 months at 7%, with a success fee of 0.5% ($3,750).'),
      S('sources', '2. Sources and uses', null, 'Total project cost is $1,150,000, funded by the EBIARA loan ($750,000), owner equity ($250,000) and a community grant ($150,000). Uses are build-out ($700,000), equipment ($300,000), inventory ($100,000) and reserves ($50,000). The grant is committed but not yet received.'),
      S('criteria', '3. Investment criteria and overall assessment', 'yellow', 'Experience: the cooperative runs one profitable store. Mission alignment: strong, with fresh food access in an under-served neighborhood. Financial strength: adequate; the existing store produces $120,000 per year for debt service. Overall assessment: Yellow, because repayment before the second store opens relies on the first store alone.'),
      S('considerations', '4. Considerations', 'yellow', 'Impact: grocery access and local jobs. Management experience: proven at one location; a second location is a new test. Risk management: the $150,000 grant has not been received, so the budget has a gap until it arrives. Neighborhood walk, transit and bike scores were not provided. [Gap]'),
      S('mission', '5. Mission alignment', 'green', 'Cooperative ownership and local hiring align directly with EBIARA’s mission. The store serves a neighborhood without a full-service grocery.'),
      S('collateral', '6. Collateral and capital structure', 'yellow', 'EBIARA has a first lien on equipment and leasehold improvements and a personal guarantee from the founder. Equipment is estimated to liquidate for $200,000, well under the loan amount, so the guarantee carries real weight.'),
      S('overview', '7. Investment overview and organizational structure', null, 'The cooperative owns both stores. EBIARA lends to the cooperative; the founder guarantees. [Org chart to be supplied]'),
      S('team', '8. Team', null, 'Founder and store manager to be profiled. [Upload bios to complete this section]'),
      S('financials', '9. Firm financials', 'yellow', 'The existing store generates $120,000 per year available for debt service. Projections for the second store should be reviewed against the first store’s opening-year results.'),
      S('sizing', '10. Loan sizing and repayment', 'yellow', 'Five paths to repayment: (1) cash flow from the existing store, $120,000 per year; (2) cash flow from the second store once open; (3) liquidation of equipment, estimated at $200,000; (4) personal guarantee from the founder; (5) worst case: liquidate equipment and call the guarantee. In the worst case the equipment covers only part of the loan, so the guarantee is essential.'),
      S('recommendation', '11. Recommendation and term sheet', 'yellow', 'Recommend approval of the $750,000 loan, conditioned on receipt of the $150,000 grant before the second draw.\nType: Secured term loan to the cooperative\nCollateral: First lien on equipment and leasehold improvements; personal guarantee from the founder\nTerm / repayment: 48 months: 12 months interest-only, then amortizing\nCommitment fee: 1% ($7,500)\nInterest: 7%\nInterest holdback: 6 months of interest ($26,250)\nDisbursement: Two draws: at lease signing and at equipment delivery\nSuccess fee: 0.5% of loan amount at repayment ($3,750)'),
    ],
    repayment: [
      { label: 'Store 1 cash flow (per yr)', value: 120000 },
      { label: 'Equipment sale', value: 200000 },
    ],
    gaps: ['Grant award letter', 'Second-store projections', 'Walk, transit and bike scores'],
    challenges: [
      'What if the grant is delayed? Can the build-out be phased?',
      'Does the first store’s margin hold up if the founder’s time is split across two locations?',
    ],
  },
}

const riverside = {
  id: 'riverside',
  name: 'Riverside Housing: bridge loan ($1.5M)',
  summary: 'First-time sponsor, 40-unit rehab. Overall: Yellow with a Red item.',
  deal: {
    ...emptyDeal,
    borrower: 'Sample Riverside Workforce Housing Partners',
    icDate: '2027-01-14',
    projectLead: 'Morgan Example',
    underwriter: 'Casey Sample',
    location: 'Sample Riverside district, Detroit, MI',
    loanAmount: '1500000',
    loanPurpose: 'Bridge financing to acquire and renovate a 40-unit apartment building for workforce housing.',
    loanType: 'Subordinate bridge loan',
    collateral: 'Second mortgage on the property; pledge of sponsor entity interests',
    term: '18 months, interest-only, balloon at maturity',
    interestRate: '10%',
    commitmentFee: '1.5% ($22,500)',
    interestHoldback: 'None',
    disbursement: 'Funded at closing, with renovation draws from the senior lender',
    successFee: '1% of loan amount at repayment ($15,000)',
    sourcesUses:
      'Sources: EBIARA loan $1,500,000; senior loan $3,000,000; sponsor equity $300,000; total $4,800,000.\nUses: acquisition $3,600,000; renovation $900,000; closing costs and reserves $300,000; total $4,800,000.',
    repaymentSources:
      '1. Refinance into a permanent loan after stabilization: estimated $1,900,000 of proceeds after paying the senior loan.\n2. Sale of a non-core asset by the sponsor: $400,000.\n3. Worst case: sale of the building, where our second position may not be fully covered.',
    notes: 'First-time sponsor. Senior lender has issued a term sheet but not a commitment.',
  },
  memo: {
    sections: [
      S('request', '1. Request summary', null, 'EBIARA is asked to approve a $1,500,000 subordinate bridge loan to Sample Riverside Workforce Housing Partners to help acquire and renovate a 40-unit apartment building in the Sample Riverside district, Detroit, MI. The loan is 18 months, interest-only, at 10%, with a success fee of 1% ($15,000).'),
      S('sources', '2. Sources and uses', null, 'Total project cost is $4,800,000: EBIARA loan ($1,500,000), senior loan ($3,000,000) and sponsor equity ($300,000). Uses are acquisition ($3,600,000), renovation ($900,000) and closing costs and reserves ($300,000). The senior lender has issued a term sheet but not yet a commitment.'),
      S('criteria', '3. Investment criteria and overall assessment', 'yellow', 'Experience: first-time sponsor (yellow). Mission alignment: strong, preserving workforce housing. Financial strength: thin; sponsor equity is $300,000 against a $4,800,000 project, and no excess cash flow was provided (red). Overall assessment: Yellow, with conditions.'),
      S('considerations', '4. Considerations', 'red', 'The sponsor has no development track record and equity is a small share of total cost. The senior loan is not yet committed, so the capital stack could change. Management experience and development team need to be documented before committee.'),
      S('mission', '5. Mission alignment', 'green', 'The project keeps 40 units available to working households in the Sample Riverside district and would be the sponsor’s entry into ownership.'),
      S('collateral', '6. Collateral and capital structure', 'red', 'EBIARA holds a second mortgage behind a $3,000,000 senior loan, plus a pledge of sponsor entity interests. In a downside sale the senior lender is paid first, so recovery on the second position is uncertain.'),
      S('overview', '7. Investment overview and organizational structure', null, 'The sponsor entity will own the building. EBIARA’s loan sits between the senior loan and sponsor equity. [Org chart to be supplied]'),
      S('team', '8. Team', null, 'Sponsor principals and property manager to be profiled. [Upload bios to complete this section]'),
      S('financials', '9. Firm financials', 'red', 'No operating history was provided for the sponsor. A rent-roll and renovation budget are needed to test the refinance assumption.'),
      S('sizing', '10. Loan sizing and repayment', 'yellow', 'Three paths to repayment: (1) refinance into a permanent loan after stabilization, estimated at $1,900,000 of proceeds after paying the senior loan; (2) sale of a non-core asset by the sponsor, $400,000; (3) worst case: sale of the building, where the second position may not be fully covered. Path one depends on renovation finishing on time and on the permanent loan market. Fewer than the preferred three to five paths are supported by documents.'),
      S('recommendation', '11. Recommendation and term sheet', 'yellow', 'Recommend approval of the $1,500,000 loan only if the senior loan commitment is received and a second repayment source is documented.\nType: Subordinate bridge loan\nCollateral: Second mortgage on the property; pledge of sponsor entity interests\nTerm / repayment: 18 months, interest-only, balloon at maturity\nCommitment fee: 1.5% ($22,500)\nInterest: 10%\nInterest holdback: None\nDisbursement: Funded at closing, with renovation draws from the senior lender\nSuccess fee: 1% of loan amount at repayment ($15,000)'),
    ],
    repayment: [
      { label: 'Refinance proceeds', value: 1900000 },
      { label: 'Non-core asset sale', value: 400000 },
    ],
    gaps: ['Senior loan commitment letter', 'Renovation budget and schedule', 'Rent roll', 'Sponsor track record and bios'],
    challenges: [
      'The refinance is the main repayment path. What if rates or values move against it during the 18 months?',
      'With a first-time sponsor and thin equity, who is accountable if renovation costs run over?',
      'Why is there no interest holdback on a 10% bridge loan with no operating cash flow yet?',
    ],
  },
}

export const exampleDeals = [lofts, market, riverside]
