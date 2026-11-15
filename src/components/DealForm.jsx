import { useState } from 'react';
import { searchNews, searchNewsFree, manualSearches } from '../lib/news.js';

const YES_NO = ['', 'Yes', 'No'];

function NewsCheck({ deal, set }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const links = manualSearches(deal);
  const run = async (ai) => {
    setBusy(ai ? 'ai' : 'free');
    setError('');
    try {
      const r = ai ? await searchNews(deal) : await searchNewsFree(deal);
      set({ ...deal, news: r.items, newsSummary: r.summary, newsCheckedAt: new Date().toISOString().slice(0, 10) });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const ready = deal.firmName || deal.principalName || deal.projectAddress;
  return (
    <div className="field wide news-check">
      <p className="small">
        Searches Bing and Google News for the last 3 years of coverage on the borrower, the principal, the project and its street, and rates each article red, yellow or green using warning words (e.g. lawsuit, lien, foreclosure). “Deeper AI search” reads and rates articles with AI once your instructor adds the AI key.
        Results go into the memo and the flags list. Always open the source before relying on it.
      </p>
      <div className="actions">
        <button type="button" className="btn" onClick={() => run(false)} disabled={!!busy || !ready}>
          {busy === 'free' ? 'Searching…' : deal.newsCheckedAt ? 'Search the news again' : 'Search the news'}
        </button>
        <button type="button" className="btn ghost" onClick={() => run(true)} disabled={!!busy || !ready} title="Needs the AI key in here.now">
          {busy === 'ai' ? 'AI is reading the news… (up to a minute)' : 'Deeper AI search'}
        </button>
      </div>
      {!ready && <small>Fill in the borrower name or project address first.</small>}
      {error && <p className="news-error" role="alert">{error}</p>}
      {deal.newsSummary && (
        <p className="news-summary">
          <strong>{deal.newsCheckedAt ? `Search on ${deal.newsCheckedAt}: ` : ''}</strong>{deal.newsSummary}
        </p>
      )}
      {links.length > 0 && (
        <p className="small">
          Search it yourself:{' '}
          {links.map((l, i) => (
            <span key={l.url}>{i > 0 && ' · '}<a href={l.url} target="_blank" rel="noopener noreferrer">{l.label}</a></span>
          ))}
        </p>
      )}
    </div>
  );
}

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

const YES_NO_BOTH = ['', 'New construction', 'Rehab', 'Both'];

export default function DealForm({ deal, set }) {
  const p = { deal, set };
  return (
    <div className="form">
      <fieldset>
        <legend>1. Memo details</legend>
        <Field {...p} name="fundName" label="Fund name" />
        <Field {...p} name="fundTagline" label="Fund tagline" />
        <Field {...p} name="memoDate" label="Memo date" type="date" />
        <Field {...p} name="relationshipManager" label="Relationship manager" />
        <Field {...p} name="preparedBy" label="Underwriter" />
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
        <Field {...p} name="sponsors" label="Sponsors / guarantors" />
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
        <Field {...p} name="interestOnlyMonths" label="Interest-only period" type="number" suffix="months" />
        <Field {...p} name="amortizationYears" label="Then amortize over" type="number" suffix="years" hint="Leave blank if interest-only to maturity." />
        <Field {...p} name="successFeePct" label="Success fee" type="number" suffix="% of loan" />
        <Field {...p} name="interestReserve" label="Interest reserve?" options={YES_NO} />
        <Field {...p} name="loanPurpose" label="Reason for loan" type="textarea" />
        <Field {...p} name="collateral" label="Collateral / guarantees" type="textarea" />
        <RowTable {...p} name="urgeUses" label="How the loan will be used" columns={amountCols} />
      </fieldset>

      <fieldset>
        <legend>4. Project</legend>
        <Field {...p} name="projectName" label="Project name" />
        <Field {...p} name="projectAddress" label="Location / address" />
        <Field {...p} name="assetType" label="Property type" />
        <Field {...p} name="squareFeet" label="Total size" type="number" suffix="sq ft" />
        <Field {...p} name="residentialUnits" label="Residential units" type="number" />
        <Field {...p} name="affordableUnits" label="Affordable units" type="number" />
        <Field {...p} name="amiPct" label="Affordable at" type="number" suffix="% AMI" />
        <Field {...p} name="commercialSqFt" label="Commercial space" type="number" suffix="sq ft" />
        <Field {...p} name="constructionType" label="Construction type" options={YES_NO_BOTH} />
        <Field {...p} name="constructionStart" label="Construction start" hint="e.g. Spring 2027" />
        <Field {...p} name="siteControl" label="Site control?" options={YES_NO} />
        <Field {...p} name="previouslyVacant" label="Previously vacant / blighted?" options={YES_NO} />
        <Field {...p} name="totalProjectCost" label="Total project cost" type="number" prefix="$" />
        <Field {...p} name="walkScore" label="Walk Score" type="number" hint="Look it up at walkscore.com" />
        <Field {...p} name="neighborhood" label="What’s around the site" type="textarea" />
        <Field {...p} name="impactArea" label="In a neighborhood impact area?" options={YES_NO} />
        <Field {...p} name="jobsCreated" label="Permanent jobs created / supported" type="number" />
        <Field {...p} name="constructionJobs" label="Construction jobs" type="number" />
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
        <legend>6. Project cash flow &amp; underwriting</legend>
        <RowTable {...p} name="projectProjections" label="Project projections by year (as underwritten)" hint="From the underwriting model. The memo works out net operating income and DSCR."
          columns={[
            { key: 'year', label: 'Year', flex: 0.8 },
            { key: 'revenue', label: 'Revenue ($)', number: true, flex: 1.3 },
            { key: 'expenses', label: 'Operating expenses ($)', number: true, flex: 1.3 },
            { key: 'debtService', label: 'Debt service ($)', number: true, flex: 1.3 },
          ]} />
        <Field {...p} name="rentHaircutPct" label="Rent reduction applied" type="number" suffix="%" hint="How much underwriting cut the borrower’s projected rents." />
        <Field {...p} name="borrowerVacancyPct" label="Borrower’s vacancy assumption" type="number" suffix="%" />
        <Field {...p} name="underwrittenVacancyPct" label="Underwritten vacancy" type="number" suffix="%" />
        <Field {...p} name="underwritingNote" label="Why the borrower’s assumptions were adjusted" type="textarea" />
      </fieldset>

      <fieldset>
        <legend>7. Loan sizing &amp; repayment</legend>
        <Field {...p} name="exitProceeds" label="Expected proceeds to repay loan" type="number" prefix="$" hint="Cash the firm expects from the project (refinance, sale, developer fee)." />
        <Field {...p} name="exitMonth" label="Expected in month" type="number" suffix="of loan" />
        <Field {...p} name="primaryRepayment" label="Primary repayment source" />
        <Field {...p} name="secondaryRepayment" label="Secondary repayment source" />
        <RowTable {...p} name="repaymentOptions" label="Ways the fund gets repaid (in priority order)" columns={[{ key: 'option', label: 'Repayment option' }]} />
        <Field {...p} name="guarantorName" label="Guarantor / co-borrower" />
        <Field {...p} name="guarantorDscr" label="Guarantor portfolio DSCR" type="number" suffix="x" />
        <Field {...p} name="guarantorPortfolio" label="Guarantor’s existing portfolio" type="textarea" />
        <RowTable {...p} name="collateralProperties" label="Collateral properties" hint="Properties pledged to the fund (e.g. stabilized rentals)."
          columns={[
            { key: 'description', label: 'Property', flex: 3 },
            { key: 'annualRent', label: 'Annual rent ($)', number: true, flex: 1.3 },
            { key: 'marketValue', label: 'Market value ($)', number: true, flex: 1.3 },
          ]} />
      </fieldset>

      <fieldset>
        <legend>8. Risks, approvals &amp; exhibits</legend>
        <RowTable {...p} name="risks" label="Risks & mitigants" hint="Leave empty and the memo lists the red and yellow flags as risks for you to add mitigants to."
          columns={[
            { key: 'risk', label: 'Risk', flex: 2 },
            { key: 'mitigant', label: 'Mitigant', flex: 2 },
          ]} />
        <Field {...p} name="taNeeds" label="Anticipated technical assistance (TA) needs" type="textarea" />
        <RowTable {...p} name="approvers" label="Approvals (signature lines)"
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'title', label: 'Title' },
          ]} />
      </fieldset>

      <fieldset>
        <legend>9. News check</legend>
        <NewsCheck {...p} />
        <RowTable {...p} name="news" label="News items for the memo" hint="Edit, delete or add items by hand. Red and yellow items also appear in the memo’s flags."
          columns={[
            { key: 'about', label: 'About', options: ['Borrower', 'Site'], flex: 1 },
            { key: 'level', label: 'Rating', options: ['red', 'yellow', 'green'], flex: 1 },
            { key: 'headline', label: 'Headline', flex: 3 },
            { key: 'source', label: 'Source', flex: 1.4 },
            { key: 'date', label: 'Date', flex: 1 },
            { key: 'url', label: 'Link', flex: 2 },
            { key: 'summary', label: 'What it says', flex: 3 },
          ]} />
      </fieldset>

      <fieldset>
        <legend>10. Development team</legend>
        <RowTable {...p} name="team" label="Team members" hint="Short bio goes in Exhibit A of the memo."
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
