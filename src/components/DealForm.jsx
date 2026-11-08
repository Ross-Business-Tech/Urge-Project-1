const YES_NO = ['', 'Yes', 'No'];

function Field({ deal, set, name, label, type = 'text', hint, options, wide, prefix, suffix }) {
  const id = 'f-' + name;
  const value = deal[name] ?? '';
  const onChange = (e) => set({ ...deal, [name]: e.target.value });
  let input;
  if (type === 'textarea') input = <textarea id={id} value={value} onChange={onChange} rows={3} />;
  else if (options)
    input = (
      <select id={id} value={value} onChange={onChange}>
        {options.map((o) => <option key={o} value={o}>{o || 'Choose…'}</option>)}
      </select>
    );
  else
    input = (
      <div className="affix">
        {prefix && <span>{prefix}</span>}
        <input id={id} type={type === 'date' ? 'date' : 'text'} inputMode={type === 'number' ? 'decimal' : undefined} value={value} onChange={onChange} />
        {suffix && <span>{suffix}</span>}
      </div>
    );
  return (
    <div className={'field' + (wide || type === 'textarea' ? ' wide' : '')}>
      <label htmlFor={id}>{label}</label>
      {input}
      {hint && <small>{hint}</small>}
    </div>
  );
}

function RowTable({ deal, set, name, label, columns, hint }) {
  const rows = deal[name] || [];
  const update = (i, key, v) => set({ ...deal, [name]: rows.map((r, j) => (j === i ? { ...r, [key]: v } : r)) });
  const remove = (i) => set({ ...deal, [name]: rows.filter((_, j) => j !== i) });
  const addRow = () => set({ ...deal, [name]: [...rows, Object.fromEntries(columns.map((c) => [c.key, c.options ? c.options[0] : '']))] });
  return (
    <div className="field wide">
      <span className="label">{label}</span>
      {hint && <small>{hint}</small>}
      <div className="rows">
        {rows.map((r, i) => (
          <div className="row" key={i}>
            {columns.map((c) =>
              c.options ? (
                <select key={c.key} aria-label={c.label} value={r[c.key] ?? ''} onChange={(e) => update(i, c.key, e.target.value)} style={{ flex: c.flex || 1 }}>
                  {c.options.map((o) => <option key={o}>{o}</option>)}
                </select>
              ) : (
                <input key={c.key} aria-label={c.label} placeholder={c.label} inputMode={c.number ? 'decimal' : undefined} value={r[c.key] ?? ''} onChange={(e) => update(i, c.key, e.target.value)} style={{ flex: c.flex || 1 }} />
              )
            )}
            <button type="button" className="icon-btn" aria-label="Remove row" onClick={() => remove(i)}>×</button>
          </div>
        ))}
        <button type="button" className="link-btn" onClick={addRow}>+ Add row</button>
      </div>
    </div>
  );
}

const amountCols = [
  { key: 'label', label: 'Item', flex: 3 },
  { key: 'amount', label: 'Amount ($)', number: true, flex: 1.3 },
];

export default function DealForm({ deal, set }) {
  const p = { deal, set };
  return (
    <div className="form">
      <fieldset>
        <legend>1. Memo details</legend>
        <Field {...p} name="fundName" label="Fund name" />
        <Field {...p} name="memoDate" label="Memo date" type="date" />
        <Field {...p} name="preparedBy" label="Prepared by" />
        <Field {...p} name="committee" label="Investment committee" />
      </fieldset>

      <fieldset>
        <legend>2. Borrower</legend>
        <Field {...p} name="firmName" label="Borrower firm name" />
        <Field {...p} name="hqCity" label="Firm location" />
        <Field {...p} name="principalName" label="Principal name" />
        <Field {...p} name="principalTitle" label="Principal title" />
        <Field {...p} name="yearsExperience" label="Years of experience" type="number" />
        <Field {...p} name="projectsCompleted" label="Projects completed" type="number" />
        <Field {...p} name="bipocOwned" label="BIPOC-owned firm?" options={YES_NO} />
        <Field {...p} name="principalBio" label="Principal bio / background" type="textarea" hint="Paste from the borrower’s submission. Cross-check against public sources." />
        <Field {...p} name="orgStructure" label="Organizational structure" type="textarea" hint="Who owns what, and which entity receives the money." />
      </fieldset>

      <fieldset>
        <legend>3. Loan request</legend>
        <Field {...p} name="loanAmount" label="Loan amount" type="number" prefix="$" />
        <Field {...p} name="interestRate" label="Interest rate" type="number" suffix="%" />
        <Field {...p} name="termMonths" label="Term" type="number" suffix="months" />
        <Field {...p} name="originationFee" label="Origination fee" type="number" suffix="%" />
        <Field {...p} name="repaymentStructure" label="Repayment structure" options={['Interest-only, principal due at maturity', 'Monthly amortizing', 'Accrued interest, all due at maturity']} wide />
        <Field {...p} name="loanPurpose" label="Reason for loan" type="textarea" />
        <Field {...p} name="collateral" label="Collateral / guarantees" type="textarea" />
        <RowTable {...p} name="urgeUses" label="How the loan will be used" columns={amountCols} />
      </fieldset>

      <fieldset>
        <legend>4. Project</legend>
        <Field {...p} name="projectName" label="Project name" />
        <Field {...p} name="projectAddress" label="Location / address" />
        <Field {...p} name="assetType" label="Property type" />
        <Field {...p} name="squareFeet" label="Size" type="number" suffix="sq ft" />
        <Field {...p} name="totalProjectCost" label="Total project cost" type="number" prefix="$" />
        <Field {...p} name="walkScore" label="Walk Score" type="number" hint="Look it up at walkscore.com" />
        <Field {...p} name="neighborhood" label="What’s around the site" type="textarea" />
        <Field {...p} name="impactArea" label="In a neighborhood impact area?" options={YES_NO} />
        <Field {...p} name="jobsCreated" label="Jobs created / supported" type="number" />
        <Field {...p} name="growthPlan" label="Growth plan (scale / acceleration)" type="textarea" />
        <RowTable {...p} name="projectSources" label="Project sources (overall financing)" columns={amountCols} />
        <RowTable {...p} name="projectUses" label="Project uses" columns={amountCols} />
      </fieldset>

      <fieldset>
        <legend>5. Firm financials</legend>
        <RowTable {...p} name="financials" label="Revenue and net income by year" hint="Mark each year as Actual or Projected."
          columns={[
            { key: 'year', label: 'Year', flex: 0.8 },
            { key: 'type', label: 'Type', options: ['Actual', 'Projected'], flex: 1.2 },
            { key: 'revenue', label: 'Revenue ($)', number: true, flex: 1.3 },
            { key: 'netIncome', label: 'Net income ($)', number: true, flex: 1.3 },
          ]} />
        <Field {...p} name="totalAssets" label="Total assets" type="number" prefix="$" />
        <Field {...p} name="totalLiabilities" label="Total liabilities" type="number" prefix="$" />
        <Field {...p} name="totalEquity" label="Total equity" type="number" prefix="$" />
        <Field {...p} name="cash" label="Cash on hand" type="number" prefix="$" />
        <Field {...p} name="ownerSharePct" label="Principal’s ownership of firm" type="number" suffix="%" />
      </fieldset>

      <fieldset>
        <legend>6. Loan sizing &amp; repayment</legend>
        <Field {...p} name="exitProceeds" label="Expected proceeds to repay loan" type="number" prefix="$" hint="Cash the firm expects from the project (refinance, sale, developer fee)." />
        <Field {...p} name="exitMonth" label="Expected in month" type="number" suffix="of loan" />
        <RowTable {...p} name="repaymentOptions" label="Ways the fund gets repaid (in priority order)" columns={[{ key: 'option', label: 'Repayment option' }]} />
      </fieldset>

      <fieldset>
        <legend>7. Development team</legend>
        <RowTable {...p} name="team" label="Team members" hint="Short bio goes in the memo appendix."
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'company', label: 'Company' },
            { key: 'role', label: 'Role' },
            { key: 'bio', label: 'Short bio', flex: 2 },
          ]} />
        <Field {...p} name="underwriterNotes" label="Underwriter notes (optional)" type="textarea" hint="Anything else the committee should know. Added to the memo as-is." />
      </fieldset>
    </div>
  );
}
