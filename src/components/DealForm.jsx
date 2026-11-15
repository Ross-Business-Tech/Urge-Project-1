import { useState } from 'react';
import { searchNews, searchNewsFree, manualSearches } from '../lib/news.js';
import { analyze, suggestStage, STAGES } from '../lib/analysis.js';
import { moneyShort } from '../lib/format.js';
import { POSITIONS, positionLabel } from '../lib/sections.js';
import { describeArea, loanSizingParagraph } from '../lib/aiWrite.js';

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
const PROJECT_TYPES = ['', 'Multifamily residential', 'Multifamily mixed-use', 'Commercial', 'Hotel / hospitality', 'Office', 'Co-working space', 'Other'];

// The (i) next to each section heading: hover (or tap on a phone) to see what the section is for.
const SECTION_HELP = {
  1: 'Who the memo is from and to: fund name, date, relationship manager, underwriter and the committee. Appears in the memo header.',
  2: 'The borrower firm and its principal: experience, track record (development costs, units and square feet completed) and stage. Stage guide: Early-emerging = under $1M of development completed; Emerging = $1M to $10M (e.g. small multifamily); Established = $10M+.',
  3: 'What the borrower is asking the fund for: amount, rate, term, repayment structure (e.g. 24 months interest-only, then amortizing), fees, collateral and guarantee. Usually from the term sheet.',
  4: 'The project itself: type, location, total project size, residential units, affordable units by AMI level, commercial space, who it serves, what is around the site, and its sources and uses of funds.',
  5: 'The borrower firm’s own results: revenue and net income by year (actual and projected) and its balance sheet. Used for leverage and cash checks.',
  6: 'The project’s cash flow as underwritten: revenue, operating expenses and debt service by year, plus any cuts made to the borrower’s rent or vacancy assumptions.',
  7: 'How the loan gets repaid and why this amount: expected proceeds, ranked repayment options, guarantor and collateral properties, and the loan sizing points the memo turns into a paragraph.',
  8: 'Risks with their mitigants, technical assistance the borrower may need, and who signs off (approval lines).',
  9: 'Searches the news for the borrower, principal, project and street. Red and yellow items become flags in the memo.',
  10: 'Everyone on the project team (architect, contractor, etc.) with a short bio. Bios go in Exhibit A.',
  11: 'Estimates the project’s impact on the neighborhood (economic activity, jobs, taxes, resident spending) as ranges, from this deal’s own numbers.',
  12: 'Add your own sections to the memo, either for just this memo or for all future memos on this device.',
};
function Legend({ n, children }) {
  const [open, setOpen] = useState(false);
  return (
    <legend>
      {n}. {children}
      <button type="button" className="info-tip" aria-label={`What is section ${n} for?`} aria-expanded={open} title={SECTION_HELP[n]}
        onClick={() => setOpen((o) => !o)} onBlur={() => setOpen(false)}>i</button>
      {open && <span className="info-pop" role="tooltip">{SECTION_HELP[n]}</span>}
    </legend>
  );
}

// Small AI button that writes into a text field.
function AiButton({ label, run, onText, confirmReplace }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const go = async () => {
    if (confirmReplace && !confirm(confirmReplace)) return;
    setBusy(true); setErr('');
    try { onText(await run()); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="ai-btn field wide">
      <div><button type="button" className="btn ghost" onClick={go} disabled={busy}>{busy ? 'Working… (up to a minute)' : label}</button></div>
      {err && <p className="news-error" role="alert">{err}</p>}
    </div>
  );
}
const REPAYMENT = ['Interest-only, principal due at maturity', 'Interest-only period, then amortizing', 'Fully amortizing', 'Accrued interest, all due at maturity'];

// Shows the affordable units as shares of all residential units, e.g. "3 at 80% AMI (17%)".
function AffordableSummary({ deal }) {
  const total = Number(String(deal.residentialUnits || '').replace(/[^0-9.]/g, '')) || 0;
  const tiers = (deal.affordableTiers || []).filter((t) => Number(t.units) > 0);
  if (!tiers.length) return null;
  const sum = tiers.reduce((t, x) => t + Number(x.units), 0);
  const share = (n) => (total ? ` (${Math.round((n / total) * 100)}%)` : '');
  return (
    <p className="small field wide affordable-summary">
      {sum} of {total || '?'} units affordable{share(sum)}: {tiers.map((t) => `${t.units} at ${t.ami || '?'}% AMI${share(Number(t.units))}`).join(' · ')}
    </p>
  );
}

// Live preview of the neighborhood impact estimate (the same numbers go into the memo).
function ImpactPreview({ deal }) {
  const impact = analyze(deal).impact;
  if (!impact) return <p className="small field wide">Fill in the total project cost, residential units or commercial space (section 4) to see the estimate.</p>;
  const show = (r) => (r.kind === '$' ? (Math.round(r.low) === Math.round(r.high) ? moneyShort(r.low) : `${moneyShort(r.low)} – ${moneyShort(r.high)}`) : (Math.round(r.low) === Math.round(r.high) ? Math.round(r.low) : `${Math.round(r.low)} – ${Math.round(r.high)}`));
  return (
    <div className="field wide">
      <p className="small">Estimated from this deal’s own numbers (total cost, units, commercial space, jobs). Ranges, not exact figures: a screening estimate for the memo, not an economic impact study.</p>
      <table className="impact-table">
        <thead><tr><th>Impact</th><th className="num">Estimate</th></tr></thead>
        <tbody>{impact.rows.map((r) => <tr key={r.key}><td>{r.label}<small>{r.basis}</small></td><td className="num">{show(r)}<small>{r.when}</small></td></tr>)}</tbody>
      </table>
    </div>
  );
}

// Section 12: add extra memo sections, either to all future memos (kept on this device) or to
// just this memo (saved with the deal).
function ExtraSections({ deal, set, templates = [], setTemplates }) {
  const [draft, setDraft] = useState({ title: '', position: 'risks', body: '', scope: 'this' });
  const [msg, setMsg] = useState('');
  const rows = deal.customSections || [];
  const own = rows.filter((r) => !r.templateId);
  const textFor = (id) => rows.find((r) => String(r.templateId) === String(id))?.body || '';
  const setTextFor = (t, body) => {
    const rest = rows.filter((r) => String(r.templateId) !== String(t.id));
    set({ ...deal, customSections: body.trim() ? [...rest, { title: t.title, position: t.position, body, templateId: String(t.id) }] : rest });
  };
  const add = () => {
    const title = draft.title.trim();
    if (!title) { setMsg('Give the section a title first.'); return; }
    if (draft.scope === 'all') {
      setTemplates([...templates, { id: `s${Date.now()}`, title, position: draft.position, body: draft.body.trim() }]);
      setMsg(`Added “${title}” to all future memos on this device.`);
    } else {
      set({ ...deal, customSections: [...rows, { title, position: draft.position, body: draft.body, templateId: '' }] });
      setMsg(`Added “${title}” to this memo.`);
    }
    setDraft({ ...draft, title: '', body: '' });
  };
  const removeOwn = (r) => set({ ...deal, customSections: rows.filter((x) => x !== r) });
  const updateOwn = (r, patch) => set({ ...deal, customSections: rows.map((x) => (x === r ? { ...x, ...patch } : x)) });
  const removeTemplate = (t) => {
    if (!confirm(`Remove “${t.title}” from all future memos on this device?`)) return;
    setTemplates(templates.filter((x) => x.id !== t.id));
    set({ ...deal, customSections: rows.filter((r) => String(r.templateId) !== String(t.id)) });
  };
  const posSelect = (value, onChange, label) => (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      {POSITIONS.map(([k, l]) => <option key={k} value={k}>After {l}</option>)}
    </select>
  );
  return (
    <>
      <div className="field wide add-section">
        <span className="label">Add a section</span>
        <input aria-label="Section title" placeholder="Section title, e.g. Environmental Review" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        {posSelect(draft.position, (position) => setDraft({ ...draft, position }), 'Where it goes in the memo')}
        <textarea aria-label="Section text" rows={3} placeholder="Text for the section (for “all future memos”, this is the starting text or guidance each memo begins with)" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
        <div className="scope" role="radiogroup" aria-label="Add it to">
          <label><input type="radio" name="scope" checked={draft.scope === 'this'} onChange={() => setDraft({ ...draft, scope: 'this' })} /> Just this memo</label>
          <label><input type="radio" name="scope" checked={draft.scope === 'all'} onChange={() => setDraft({ ...draft, scope: 'all' })} /> All future memos</label>
        </div>
        <div><button type="button" className="btn" onClick={add}>Add section</button></div>
        {msg && <small role="status">{msg}</small>}
        <small>“All future memos” sections are kept in this browser, so they appear in every memo written on this device.</small>
      </div>

      {templates.length > 0 && (
        <div className="field wide">
          <span className="label">In all future memos</span>
          {templates.map((t) => (
            <div className="extra-row" key={t.id}>
              <div className="extra-head"><strong>{t.title}</strong> <small>after {positionLabel(t.position)}</small>
                <button type="button" className="link-btn danger" onClick={() => removeTemplate(t)}>Remove from all memos</button></div>
              <textarea aria-label={`${t.title}: text for this memo`} rows={3} placeholder={t.body ? `Starting text: ${t.body}` : 'Text for this memo'} value={textFor(t.id)} onChange={(e) => setTextFor(t, e.target.value)} />
              <small>Text for this memo. Leave blank to use the starting text.</small>
            </div>
          ))}
        </div>
      )}

      {own.length > 0 && (
        <div className="field wide">
          <span className="label">Only in this memo</span>
          {own.map((r, i) => (
            <div className="extra-row" key={i}>
              <div className="extra-head">
                <input aria-label="Section title" value={r.title} onChange={(e) => updateOwn(r, { title: e.target.value })} />
                {posSelect(r.position, (position) => updateOwn(r, { position }), 'Where it goes')}
                <button type="button" className="icon-btn" aria-label={`Remove ${r.title}`} onClick={() => removeOwn(r)}>×</button>
              </div>
              <textarea aria-label={`${r.title} text`} rows={3} value={r.body} onChange={(e) => updateOwn(r, { body: e.target.value })} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function DealForm({ deal, set, templates, setTemplates }) {
  const p = { deal, set };
  return (
    <div className="form">
      <fieldset>
        <Legend n={1}>Memo details</Legend>
        <Field {...p} name="fundName" label="Fund name" />
        <Field {...p} name="fundTagline" label="Fund tagline" />
        <Field {...p} name="memoDate" label="Memo date" type="date" />
        <Field {...p} name="relationshipManager" label="Relationship manager" />
        <Field {...p} name="preparedBy" label="Underwriter" />
        <Field {...p} name="committee" label="Investment committee" />
      </fieldset>

      <fieldset>
        <Legend n={2}>Borrower</Legend>
        <Field {...p} name="firmName" label="Borrower firm name" />
        <Field {...p} name="hqCity" label="Firm location" />
        <Field {...p} name="principalName" label="Principal name" />
        <Field {...p} name="principalTitle" label="Principal title" />
        <Field {...p} name="yearsExperience" label="Years of experience" type="number" />
        <Field {...p} name="projectsCompleted" label="Projects completed" type="number" />
        <Field {...p} name="tdcCompleted" label="Total development costs completed" type="number" prefix="$" hint="All projects the borrower has completed. Used to suggest the stage." />
        <Field {...p} name="unitsCompleted" label="Residential units completed" type="number" />
        <Field {...p} name="commercialSqFtCompleted" label="Commercial space completed" type="number" suffix="sq ft" />
        <Field {...p} name="sqFtCompleted" label="Total square footage completed" type="number" suffix="sq ft" />
        <Field {...p} name="developerStage" label="Borrower stage" options={['', ...STAGES]}
          hint={suggestStage(deal) ? `Track record suggests: ${suggestStage(deal)}${deal.developerStage && deal.developerStage !== suggestStage(deal) ? ' (you picked differently, which is fine)' : ''}` : 'Early-emerging (under $1M developed), Emerging ($1M–$10M) or Established ($10M+).'} />
        <Field {...p} name="sponsors" label="Sponsors / guarantors" />
        <Field {...p} name="principalBio" label="Principal bio / background" type="textarea" hint="Paste from the borrower’s submission. Cross-check against public sources." />
        <Field {...p} name="orgStructure" label="Organizational structure" type="textarea" hint="Who owns what, and which entity receives the money." />
      </fieldset>

      <fieldset>
        <Legend n={3}>Loan request</Legend>
        <Field {...p} name="loanAmount" label="Loan amount" type="number" prefix="$" />
        <Field {...p} name="interestRate" label="Interest rate" type="number" suffix="%" />
        <Field {...p} name="termMonths" label="Term" type="number" suffix="months" />
        <Field {...p} name="originationFee" label="Origination fee" type="number" suffix="%" />
        <Field deal={deal} set={(d) => set(/then amortiz/i.test(d.repaymentStructure) && !/then amortiz/i.test(deal.repaymentStructure || '')
          ? { ...d, interestOnlyMonths: d.interestOnlyMonths || '24', amortizationYears: d.amortizationYears || '15' } : d)}
          name="repaymentStructure" label="Repayment structure" options={REPAYMENT} wide hint="“Interest-only period, then amortizing” fills in 24 months interest-only and a 15-year amortization; change them below if needed." />
        <Field {...p} name="interestOnlyMonths" label="Interest-only period" type="number" suffix="months" hint="For “interest-only period, then amortizing”. Blank = the whole term when the loan is interest-only." />
        <Field {...p} name="amortizationYears" label="Amortize over" type="number" suffix="years" hint="For amortizing loans: the schedule principal is paid on (e.g. 15)." />
        <Field {...p} name="successFeePct" label="Success fee" type="number" suffix="% of loan" />
        <Field {...p} name="interestReserve" label="Interest reserve?" options={YES_NO} />
        <Field {...p} name="loanPurpose" label="Reason for loan" type="textarea" />
        <Field {...p} name="collateral" label="Collateral" type="textarea" hint="Liens and pledged property, e.g. second mortgage on the project, first lien on two duplexes." />
        <Field {...p} name="guarantee" label="Guarantee" type="textarea" hint="Who guarantees the loan, e.g. full personal guarantee from the principal." />
        <RowTable {...p} name="urgeUses" label="How the loan will be used" columns={amountCols} />
      </fieldset>

      <fieldset>
        <Legend n={4}>Project</Legend>
        <Field {...p} name="projectName" label="Project name" />
        <Field {...p} name="projectAddress" label="Location / address" />
        <Field {...p} name="projectType" label="Project type" options={PROJECT_TYPES} />
        {deal.projectType === 'Other' && <Field {...p} name="projectTypeOther" label="Other project type" hint="Type the project type, e.g. Senior housing, Mixed-use with childcare." />}
        <Field {...p} name="assetType" label="Project description" hint="e.g. Ground-floor retail and office, apartments above" />
        <Field {...p} name="squareFeet" label="Total project size" type="number" suffix="sq ft" />
        <Field {...p} name="residentialUnits" label="Residential units" type="number" />
        <RowTable {...p} name="affordableTiers" label="Affordable units by AMI level" hint="One row per income level, e.g. 3 units at 50% AMI and 60 units at 80% AMI (AMI = area median income)."
          columns={[
            { key: 'units', label: 'Affordable units', number: true },
            { key: 'ami', label: 'At % of AMI', number: true },
          ]} />
        <AffordableSummary deal={deal} />
        <Field {...p} name="targetPopulation" label="Who the project serves" type="textarea" hint="Target population or community, e.g. working families, seniors, local small businesses." />
        <Field {...p} name="commercialSqFt" label="Commercial space" type="number" suffix="sq ft" />
        <Field {...p} name="constructionType" label="Construction type" options={YES_NO_BOTH} />
        <Field {...p} name="constructionStart" label="Construction start" hint="e.g. Spring 2027" />
        <Field {...p} name="siteControl" label="Site control?" options={YES_NO} />
        <Field {...p} name="previouslyVacant" label="Previously vacant / blighted?" options={YES_NO} />
        <Field {...p} name="totalProjectCost" label="Total project cost" type="number" prefix="$" />
        <Field {...p} name="walkScore" label="Walk Score" type="number" hint="Look it up at walkscore.com" />
        <Field {...p} name="neighborhood" label="What’s around the site" type="textarea" hint="Type it yourself (bullets are fine) or let the AI describe nearby places, new developments and who they serve." />
        <AiButton label="✨ Describe the area with AI" run={() => describeArea(deal)} onText={(t) => set({ ...deal, neighborhood: t })}
          confirmReplace={deal.neighborhood?.trim() ? 'Replace what’s in “What’s around the site” with the AI’s description?' : ''} />
        <Field {...p} name="impactArea" label="In a strategic neighborhood?" options={YES_NO} />
        <Field {...p} name="jobsCreated" label="Permanent jobs created / supported" type="number" />
        <Field {...p} name="constructionJobs" label="Construction jobs" type="number" />
        <Field {...p} name="growthPlan" label="Growth plan (scale / acceleration)" type="textarea" />
        <RowTable {...p} name="projectSources" label="Project sources (overall financing)" columns={amountCols} />
        <RowTable {...p} name="projectUses" label="Project uses" columns={amountCols} />
      </fieldset>

      <fieldset>
        <Legend n={5}>Firm financials</Legend>
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
        <Legend n={6}>Project cash flow &amp; underwriting</Legend>
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
        <Legend n={7}>Loan sizing &amp; repayment</Legend>
        <Field {...p} name="exitProceeds" label="Expected proceeds to repay loan" type="number" prefix="$" hint="Cash the firm expects from the project (refinance, sale, developer fee)." />
        <Field {...p} name="exitMonth" label="Expected in month" type="number" suffix="of loan" />
        <Field {...p} name="primaryRepayment" label="Primary repayment source" />
        <Field {...p} name="secondaryRepayment" label="Secondary repayment source" />
        <RowTable {...p} name="repaymentOptions" label="Ways the fund gets repaid (in priority order)" columns={[{ key: 'option', label: 'Repayment option' }]} />
        <RowTable {...p} name="loanSizingPoints" label="Loan sizing points" hint="One point per row: why this loan amount and structure. The memo turns them into a paragraph." columns={[{ key: 'point', label: 'Point' }]} />
        <AiButton label="✨ Write the loan sizing paragraph with AI" run={() => loanSizingParagraph(deal)} onText={(t) => set({ ...deal, loanSizingParagraph: t })}
          confirmReplace={deal.loanSizingParagraph?.trim() ? 'Replace the current loan sizing paragraph?' : ''} />
        <Field {...p} name="loanSizingParagraph" label="Loan sizing paragraph (optional)" type="textarea" hint="Written by the AI button above, or type your own. If blank, the memo joins the points into a paragraph itself." />
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
        <Legend n={8}>Risks, approvals &amp; exhibits</Legend>
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
        <Legend n={9}>News check</Legend>
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
        <Legend n={10}>Development team</Legend>
        <RowTable {...p} name="team" label="Team members" hint="Short bio goes in Exhibit A of the memo."
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'company', label: 'Company' },
            { key: 'role', label: 'Role' },
            { key: 'bio', label: 'Short bio', flex: 2 },
          ]} />
        <Field {...p} name="underwriterNotes" label="Underwriter notes (optional)" type="textarea" hint="Anything else the committee should know. Added to the memo as-is." />
      </fieldset>

      <fieldset>
        <Legend n={11}>Neighborhood impact calculator</Legend>
        <ImpactPreview deal={deal} />
        <Field {...p} name="areaMedianIncome" label="Area median income (AMI) for the region" type="number" prefix="$" hint="From HUD’s income limits for the area. Lets the calculator estimate residents’ income and spending by AMI level." />
        <Field {...p} name="propertyTaxRatePct" label="Local property tax rate (optional)" type="number" suffix="% of cost" hint="Leave blank to use a 1.5%–3% range." />
      </fieldset>

      <fieldset>
        <Legend n={12}>Extra memo sections</Legend>
        <ExtraSections {...p} templates={templates} setTemplates={setTemplates} />
      </fieldset>
    </div>
  );
}
