import { memo } from 'react';
import { analyze, LEVEL_LABEL } from '../lib/analysis.js';
import { num, has, money, pct, fmtDate, or } from '../lib/format.js';
import { BarCompare, StackedShare, Columns } from './Charts.jsx';

const Missing = ({ what }) => <span className="missing">[{what}: to be added]</span>;
const v = (val, what) => (has(val) ? val : <Missing what={what} />);

function Badge({ level }) {
  return <span className={`badge badge-${level}`}>{LEVEL_LABEL[level]}</span>;
}

function Note({ children }) {
  return <aside className="callout">{children}</aside>;
}

function AmountTable({ rows, total, totalLabel = 'Total', base, fact }) {
  if (!rows?.length) return <p><Missing what="Table" /></p>;
  return (
    <table className="money-table">
      <thead>
        <tr><th>Item</th><th className="num">Amount</th><th className="num">% of total</th></tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}><td>{r.label}</td><td className="num" data-fact={fact}>{money(r.amount)}</td><td className="num">{pct(num(r.amount) / (base || total || 1), 0)}</td></tr>
        ))}
      </tbody>
      <tfoot>
        <tr><td>{totalLabel}</td><td className="num">{money(total)}</td><td className="num">100%</td></tr>
      </tfoot>
    </table>
  );
}

function MemoDoc({ deal }) {
  const a = analyze(deal);
  const fund = or(deal.fundName, 'the Fund');
  const firm = or(deal.firmName, 'the Borrower');
  const principal = or(deal.principalName, 'the principal');
  const project = or(deal.projectName, 'the Project');
  const termYears = a.term ? (a.term % 12 === 0 ? `${a.term / 12}-year` : `${a.term}-month`) : '';
  const reds = a.flags.filter((f) => f.level === 'red');
  const yellows = a.flags.filter((f) => f.level === 'yellow');
  const recommendation =
    a.overall === 'red'
      ? 'proceed only after the red items below are resolved'
      : a.overall === 'yellow'
        ? 'approve, subject to the conditions and follow-up items noted below'
        : 'approve';
  const lastActual = a.actuals[a.actuals.length - 1];
  const firstProj = a.projections[0];
  const lastProj = a.projections[a.projections.length - 1];

  return (
    <article className="memo">
      <header className="memo-head">
        <p className="eyebrow">{fund} · Investment Memorandum · Draft</p>
        <h1>{firm}</h1>
        <p className="subtitle">{money(a.loan)} enterprise loan · {project}</p>
        <dl className="meta">
          <div><dt>To</dt><dd>{v(deal.committee, 'Investment committee')}</dd></div>
          <div><dt>From</dt><dd>{v(deal.preparedBy, 'Underwriter')}</dd></div>
          <div><dt>Date</dt><dd>{fmtDate(deal.memoDate)}</dd></div>
          <div><dt>Overall rating</dt><dd data-fact="overall"><Badge level={a.overall} /></dd></div>
        </dl>
      </header>

      <section>
        <h2>1. Introduction</h2>
        <p>
          This memorandum presents {firm}{has(deal.hqCity) ? `, based in ${deal.hqCity},` : ''} to the {fund} investment committee for approval of
          a {money(a.loan)} loan. {firm} is led by {principal}{has(deal.principalTitle) ? `, ${deal.principalTitle}` : ''}, who brings{' '}
          {has(deal.yearsExperience) ? `${num(deal.yearsExperience)} years` : <Missing what="Years" />} of real estate development and construction experience
          {has(deal.projectsCompleted) ? ` and ${num(deal.projectsCompleted)} completed projects` : ''}.
        </p>
        <p>
          Based on the analysis below, the underwriting team recommends that the committee <strong>{recommendation}</strong>.
          The review produced {reds.length} red and {yellows.length} yellow item{yellows.length === 1 ? '' : 's'}, listed in Section 10.
        </p>
      </section>

      <section>
        <h2>2. Request</h2>
        <p>
          {firm} requests a <strong>{money(a.loan)}</strong> {termYears} loan from {fund} at <strong>{has(deal.interestRate) ? `${num(deal.interestRate)}%` : <Missing what="Rate" />}</strong> interest
          {has(deal.originationFee) ? ` with a ${num(deal.originationFee)}% origination fee (${money(a.fee)})` : ''}. Repayment structure: {deal.repaymentStructure?.toLowerCase() || <Missing what="Structure" />}.
        </p>
        <p><strong>Reason for the loan.</strong> {v(deal.loanPurpose, 'Loan purpose')}</p>
        <p><strong>Project location.</strong> {project}, {v(deal.projectAddress, 'Address')}{has(deal.assetType) ? `, ${deal.assetType.toLowerCase()}` : ''}{num(deal.squareFeet) ? ` of about ${num(deal.squareFeet).toLocaleString()} sq ft` : ''}.</p>

        <h3>Use of {fund} loan proceeds</h3>
        <AmountTable fact="loanUse" rows={deal.urgeUses} total={a.urgeUsesTotal} totalLabel={`Total ${fund} loan`} />

        <h3>Overall project sources and uses</h3>
        <div className="two-col">
          <div>
            <h4>Sources</h4>
            <AmountTable fact="source" rows={deal.projectSources} total={a.srcTotal} totalLabel="Total sources" />
          </div>
          <div>
            <h4>Uses</h4>
            <AmountTable fact="use" rows={deal.projectUses} total={a.useTotal} totalLabel="Total uses" />
          </div>
        </div>
        {deal.projectSources?.length > 0 && (
          <StackedShare title="How the project is financed" parts={deal.projectSources.map((r) => ({ label: r.label, value: num(r.amount) }))} />
        )}
        {a.loanShareOfProject !== null && (
          <Note>
            The {fund} loan equals {pct(a.loanShareOfProject)} of total project cost ({money(a.projectCost)}).
            {Math.abs(a.srcTotal - a.useTotal) > 1 && a.srcTotal && a.useTotal ? ` Sources and uses differ by ${money(Math.abs(a.srcTotal - a.useTotal))}; see Section 10.` : ' Project sources and uses are balanced.'}
          </Note>
        )}
      </section>

      <section>
        <h2>3. Investment merits</h2>
        <table className="merits">
          <thead><tr><th>Criterion</th><th>Rating</th><th>Evaluation</th></tr></thead>
          <tbody>
            <tr>
              <td>Experience</td><td><Badge level={a.merits[0].level} /></td>
              <td>{principal} has {has(deal.yearsExperience) ? `${num(deal.yearsExperience)} years` : 'an unstated amount'} of experience{has(deal.projectsCompleted) ? ` and has completed ${num(deal.projectsCompleted)} projects` : ''}. {a.merits[0].level === 'green' ? 'The track record supports a project of this size.' : 'The committee should weigh the track record against the size of this project.'}</td>
            </tr>
            <tr>
              <td>Mission alignment</td><td><Badge level={a.missionLevel} /></td>
              <td>{a.mission.filter((m) => m.level === 'green').length} of 4 mission criteria clearly met (see Section 5).</td>
            </tr>
            <tr>
              <td>Financial strength</td><td><Badge level={a.merits[2].level} /></td>
              <td>
                {a.debtToEquityAfter !== null ? `Debt-to-equity of ${a.debtToEquityAfter.toFixed(2)}x including this loan. ` : ''}
                {a.cashMonthsInterest !== null ? `Cash covers about ${a.cashMonthsInterest.toFixed(0)} months of interest. ` : ''}
                {a.repaymentCoverage !== null ? `Primary repayment source covers ${a.repaymentCoverage.toFixed(2)}x of principal plus interest.` : ''}
              </td>
            </tr>
            <tr className="overall">
              <td>Overall assessment</td><td><Badge level={a.overall} /></td>
              <td>{a.overall === 'green' ? 'Strong candidate for approval.' : a.overall === 'yellow' ? 'Supportable with the conditions noted.' : 'Material concerns must be resolved first.'}</td>
            </tr>
          </tbody>
        </table>

        <h3>Borrower background</h3>
        <p>{v(deal.principalBio, 'Principal bio')}</p>
        <Note>Underwriter to confirm: cross-check the bio, prior projects and any litigation against public records and news before committee.</Note>

        <h3>Project location</h3>
        <p>
          {project} is located at {v(deal.projectAddress, 'Address')}. {has(deal.walkScore) ? `The site has a Walk Score of ${num(deal.walkScore)} (walkscore.com). ` : ''}
          {v(deal.neighborhood, 'Neighborhood description')}
        </p>

        <h3>Enterprise collateral</h3>
        <p>
          {firm} reports total assets of {money(deal.totalAssets)}, liabilities of {money(a.liabilities)} and equity of {money(a.equity)}.
          {a.debtToEquity !== null ? ` Debt-to-equity is ${a.debtToEquity.toFixed(2)}x today and would be ${a.debtToEquityAfter.toFixed(2)}x after this loan.` : ''}
          {has(deal.collateral) ? ` Collateral: ${deal.collateral}` : ''}
        </p>
        {a.equity > 0 && (
          <BarCompare
            title="Firm leverage before and after this loan"
            bars={[
              { label: 'Equity', value: a.equity, tone: 'b' },
              { label: 'Debt today', value: a.liabilities, tone: 'a' },
              { label: `Debt incl. ${fund} loan`, value: a.liabilities + a.loan, tone: 'c' },
            ]}
            note={a.debtToEquityAfter !== null ? `Debt-to-equity: ${a.debtToEquity.toFixed(2)}x → ${a.debtToEquityAfter.toFixed(2)}x` : null}
          />
        )}
      </section>

      <section>
        <h2>4. Investment overview</h2>
        <p>
          {fund} would lend {money(a.loan)} to {firm} to support {project}{a.projectCost ? `, a ${money(a.projectCost)} ${has(deal.assetType) ? deal.assetType.toLowerCase() : 'commercial'} project` : ''}.
          Over the {termYears || ''} term the loan is expected to earn {money(a.totalInterest)} in interest{a.fee ? ` plus ${money(a.fee)} in fees` : ''}.
          The primary repayment source is {has(deal.repaymentOptions?.[0]?.option) ? deal.repaymentOptions[0].option.toLowerCase() : <Missing what="Primary repayment source" />}
          {a.exitMonth ? `, expected around month ${a.exitMonth}` : ''}.
          Beyond the single project, the loan is intended to strengthen {firm} as a company: {has(deal.growthPlan) ? deal.growthPlan.charAt(0).toLowerCase() + deal.growthPlan.slice(1) : <Missing what="Growth plan" />}
        </p>
      </section>

      <section>
        <h2>5. Mission alignment</h2>
        <table className="merits">
          <thead><tr><th>Criterion</th><th>Rating</th><th>Comment</th></tr></thead>
          <tbody>
            {a.mission.map((m) => (
              <tr key={m.label}><td>{m.label}</td><td><Badge level={m.level} /></td><td>{m.text}</td></tr>
            ))}
            <tr className="overall"><td>Overall assessment</td><td><Badge level={a.missionLevel} /></td><td>{a.missionLevel === 'green' ? 'Strong fit with the fund’s mission.' : a.missionLevel === 'yellow' ? 'Partial fit with the fund’s mission.' : 'Weak fit with the fund’s mission.'}</td></tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>6. Organizational structure</h2>
        <p>{v(deal.orgStructure, 'Organizational structure')}</p>
        <Note>Insert the borrower’s organizational chart here and highlight the entity that receives {fund}’s loan proceeds.</Note>
      </section>

      <section>
        <h2>7. Development team</h2>
        {deal.team?.length ? (
          <table>
            <thead><tr><th>Name</th><th>Company</th><th>Role</th></tr></thead>
            <tbody>{deal.team.map((t, i) => <tr key={i}><td>{t.name}</td><td>{t.company}</td><td>{t.role}</td></tr>)}</tbody>
          </table>
        ) : <p><Missing what="Development team" /></p>}
        <p className="small">Full bios are in the Appendix.</p>
      </section>

      <section>
        <h2>8. Firm financials &amp; projections</h2>
        {a.fin.length ? (
          <>
            <table>
              <thead><tr><th>Year</th><th>Type</th><th className="num">Revenue</th><th className="num">Net income</th><th className="num opt">Margin</th><th className="num opt">Growth</th></tr></thead>
              <tbody>
                {a.fin.map((r, i) => {
                  const g = a.growth.find((x) => x.year === r.year);
                  return (
                    <tr key={i} className={String(r.type).startsWith('P') ? 'projected' : ''}>
                      <td data-fact="finYear">{r.year}</td><td data-fact="finType">{r.type}</td><td className="num" data-fact="finRev">{money(r.revenue)}</td><td className="num" data-fact="finNet">{money(r.netIncome)}</td>
                      <td className="num opt">{num(r.revenue) ? pct(num(r.netIncome) / num(r.revenue)) : '–'}</td>
                      <td className="num opt">{g ? pct(g.g, 0) : '–'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Columns title="Revenue by year (lighter bars are projections)" points={a.fin.map((r) => ({ label: r.year, value: num(r.revenue), muted: String(r.type).startsWith('P') }))} />
            <h3>Key observations</h3>
            <ul>
              {lastActual && <li>Most recent actual year ({lastActual.year}): revenue of {money(lastActual.revenue)} and net income of {money(lastActual.netIncome)} ({num(lastActual.revenue) ? pct(num(lastActual.netIncome) / num(lastActual.revenue)) : '–'} margin).</li>}
              {a.avgActualGrowth !== null && <li>Historical revenue growth has averaged {pct(a.avgActualGrowth, 0)} per year.</li>}
              {firstProj && lastProj && lastActual && <li>The borrower projects revenue rising to {money(lastProj.revenue)} by {lastProj.year}, {pct(num(lastProj.revenue) / num(lastActual.revenue) - 1, 0)} above {lastActual.year}.</li>}
              {has(deal.ownerSharePct) && <li>{principal} owns {num(deal.ownerSharePct)}% of {firm}{lastProj ? `, implying a ${money((num(lastProj.netIncome) * num(deal.ownerSharePct)) / 100)} share of projected ${lastProj.year} net income` : ''}.</li>}
              {has(deal.cash) && <li>Cash on hand of {money(a.cash)}.</li>}
            </ul>
          </>
        ) : <p><Missing what="Firm financials" /></p>}
      </section>

      <section>
        <h2>9. Loan sizing &amp; repayment</h2>
        <p>
          At {has(deal.interestRate) ? `${num(deal.interestRate)}%` : 'the stated rate'}, annual interest on {money(a.loan)} is {money(a.annualInterest)} ({money(a.annualInterest / 12)} per month).
          Total owed to {fund} over the term is {money(a.totalOwed)} (principal plus interest).
          {a.repaymentCoverage !== null ? ` The borrower’s primary repayment source is expected to produce ${money(a.exitProceeds)}, or ${a.repaymentCoverage.toFixed(2)}x coverage.` : ''}
        </p>
        <h3>Repayment options, in priority order</h3>
        {deal.repaymentOptions?.length ? (
          <ol>{deal.repaymentOptions.map((r, i) => <li key={i} data-fact="repay">{r.option}</li>)}</ol>
        ) : <p><Missing what="Repayment options" /></p>}
        {a.loan > 0 && (
          <BarCompare
            title="Development repayment: what is owed vs. what the project returns"
            bars={[
              { label: 'Principal', value: a.loan, tone: 'a' },
              { label: 'Total owed (with interest)', value: a.totalOwed, tone: 'c' },
              { label: 'Expected project proceeds', value: a.exitProceeds, tone: 'b' },
              { label: 'Firm cash on hand today', value: a.cash, tone: 'd' },
            ]}
          />
        )}
      </section>

      <section className="flags-section">
        <h2>10. Underwriter review: flags</h2>
        <p className="small">Automatically generated checks. Each one shows the evidence and rule behind it. Confirm or dismiss each before sending to committee.</p>
        {a.flags.length ? (
          <ul className="flags">
            {a.flags.map((f, i) => (
              <li key={i} className={`flag flag-${f.level}`}>
                <Badge level={f.level} /> <strong>{f.area}: {f.title}</strong>
                <p>{f.evidence}</p>
              </li>
            ))}
          </ul>
        ) : <p>No flags raised.</p>}
        {has(deal.underwriterNotes) && (<><h3>Underwriter notes</h3><p>{deal.underwriterNotes}</p></>)}
      </section>

      <section>
        <h2>11. Term sheet</h2>
        <table className="terms">
          <tbody>
            <tr><th>Borrower</th><td>{firm}</td></tr>
            <tr><th>Lender</th><td>{fund}</td></tr>
            <tr><th>Loan amount</th><td>{money(a.loan)}</td></tr>
            <tr><th>Interest rate</th><td>{has(deal.interestRate) ? `${num(deal.interestRate)}% per year` : <Missing what="Rate" />}</td></tr>
            <tr><th>Term</th><td>{has(deal.termMonths) ? `${a.term} months` : <Missing what="Term" />}</td></tr>
            <tr><th>Origination fee</th><td>{has(deal.originationFee) ? `${num(deal.originationFee)}% (${money(a.fee)})` : 'None'}</td></tr>
            <tr><th>Repayment</th><td>{deal.repaymentStructure}</td></tr>
            <tr><th>Use of proceeds</th><td>{deal.urgeUses?.map((u) => u.label).join('; ') || <Missing what="Uses" />}</td></tr>
            <tr><th>Collateral</th><td>{v(deal.collateral, 'Collateral')}</td></tr>
            <tr><th>Project</th><td>{project}, {v(deal.projectAddress, 'Address')}</td></tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>Appendix: Development team bios</h2>
        {deal.team?.length ? deal.team.map((t, i) => (
          <p key={i}><strong>{t.name}</strong>{t.role ? `, ${t.role}` : ''}{t.company ? ` (${t.company})` : ''}. {t.bio}</p>
        )) : <p><Missing what="Team bios" /></p>}
      </section>
    </article>
  );
}

// Memoized so the underwriter's direct edits to the text survive until they regenerate.
export default memo(MemoDoc);
