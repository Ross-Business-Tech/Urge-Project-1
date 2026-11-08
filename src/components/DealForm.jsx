const groups = [
  {
    title: 'Deal basics',
    fields: [
      ['borrower', 'Borrower'],
      ['icDate', 'Investment committee date', 'date'],
      ['projectLead', 'Project lead'],
      ['underwriter', 'Underwriter'],
      ['location', 'Project location'],
    ],
  },
  {
    title: 'The request',
    fields: [
      ['loanAmount', 'Loan amount ($)'],
      ['loanPurpose', 'What the loan is for', 'area'],
    ],
  },
  {
    title: 'Term sheet',
    fields: [
      ['loanType', 'Type of loan'],
      ['collateral', 'Collateral', 'area'],
      ['term', 'Term / repayment'],
      ['interestRate', 'Interest'],
      ['commitmentFee', 'Commitment fee'],
      ['interestHoldback', 'Interest holdback'],
      ['disbursement', 'Disbursement'],
      ['successFee', 'Success fee'],
    ],
  },
  {
    title: 'Money in and out',
    fields: [
      ['sourcesUses', 'Sources and uses', 'area'],
      ['repaymentSources', 'Ways EBIARA gets repaid (3–5, include worst case)', 'area'],
      ['notes', 'Other notes for the memo', 'area'],
    ],
  },
]

export default function DealForm({ deal, onChange }) {
  return (
    <div className="form">
      {groups.map((g) => (
        <fieldset key={g.title}>
          <legend>{g.title}</legend>
          {g.fields.map(([key, label, type]) => (
            <label key={key}>
              <span>{label}</span>
              {type === 'area' ? (
                <textarea
                  rows={3}
                  value={deal[key]}
                  onChange={(e) => onChange({ ...deal, [key]: e.target.value })}
                />
              ) : (
                <input
                  type={type || 'text'}
                  value={deal[key]}
                  onChange={(e) => onChange({ ...deal, [key]: e.target.value })}
                />
              )}
            </label>
          ))}
        </fieldset>
      ))}
    </div>
  )
}
