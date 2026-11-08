import { memo } from 'react';
import { analyze, LEVEL_LABEL } from '../lib/analysis.js';
import { num, has, money, pct, fmtDate, or } from '../lib/format.js';
import { BarCompare, StackedShare, Columns } from './Charts.jsx';
import { safeUrl } from '../lib/news.js';

// Marks a number so Viewing mode can show where it came from (see lib/sources.js).
// r = a Deal data field ("loanAmount", "projectSources.2.amount"); c = a calculation ("annualInterest").
const Src = ({ r, c, children }) => <span className="src" data-src={c ? `calc:${c}` : r}>{children}</span>;

const Missing = ({ what }) => <span className="missing">[{what}: to be added]</span>;
const v = (val, what) => (has(val) ? val : <Missing what={what} />);

function Badge({ level }) {
  return <span className={`badge badge-${level}`}>{LEVEL_LABEL[level]}</span>;
}

function Note({ children }) {
  return <aside className="callout">{children}</aside>;
}

function AmountTable({ name, rows, total, totalLabel = 'Total', base }) {
  if (!rows?.length) return <p><Missing what="Table" /></p>;
  return (
    <table className="money-table">
      <thead>
        <tr><th>Item</th><th className="num">Amount</th><th className="num">% of total</th></tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}><td>{r.label}</td><td className="num"><Src r={`${name}.${i}.amount`}>{money(r.amount)}</Src></td><td className="num"><Src c={`rowShare:${name}:${i}`}>{pct(num(r.amount) / (base || total || 1), 0)}</Src></td></tr>
        ))}
      </tbody>
      <tfoot>
        <tr><td>{totalLabel}</td><td className="num"><Src c={`tableTotal:${name}`}>{money(total)}</Src></td><td className="num">100%</td></tr>
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
        <p className="subtitle"><Src r="loanAmount">{money(a.loan)}</Src> enterprise loan · {project}</p>
        <dl className="meta">
          <div><dt>To</dt><dd>{v(deal.committee, 'Investment committee')}</dd></div>
          <div><dt>From</dt><dd>{v(deal.preparedBy, 'Underwriter')}</dd></div>
          <div><dt>Date</dt><dd>{fmtDate(deal.memoDate)}</dd></div>
          <div><dt>Overall rating</dt><dd><Badge level={a.overall} /></dd></div>
        </dl>
      </header>

      <section>
        <h2>1. Introduction</h2>
        <p>
          This memorandum presents {firm}{has(deal.hqCity) ? `, based in ${deal.hqCity},` : ''} to the {fund} investment committee for approval of
          a <Src r="loanAmount">{money(a.loan)}</Src> loan. {firm} is led by {principal}{has(deal.principalTitle) ? `, ${deal.principalTitle}` : ''}, who brings{' '}
          {has(deal.yearsExperience) ? <Src r="yearsExperience">{num(deal.yearsExperience)} years</Src> : <Missing what="Years" />} of real estate development and construction experience
          {has(deal.projectsCompleted) ? <> and <Src r="projectsCompleted">{num(deal.projectsCompleted)} completed projects</Src></> : ''}.
        </p>
        <p>
          Based on the analysis below, the underwriting team recommends that the committee <strong>{recommendation}</strong>.
          The review produced <Src c="newsCount">{reds.length} red and {yellows.length} yellow item{yellows.length === 1 ? '' : 's'}</Src>, listed in Section 11.
        </p>
      </section>

      <section>
        <h2>2. Request</h2>
        <p>
          {firm} requests a <strong><Src r="loanAmount">{money(a.loan)}</Src></strong> <Src r="termMonths">{termYears}</Src> loan from {fund} at <strong>{has(deal.interestRate) ? <Src r="interestRate">{num(deal.interestRate)}%</Src> : <Missing what="Rate" />}</strong> interest
          {has(deal.originationFee) ? <> with a <Src r="originationFee">{num(deal.originationFee)}%</Src> origination fee (<Src c="fee">{money(a.fee)}</Src>)</> : ''}. Repayment structure: {deal.repaymentStructure?.toLowerCase() || <Missing what="Structure" />}.
        </p>
        <p><strong>Reason for the loan.</strong> {v(deal.loanPurpose, 'Loan purpose')}</p>
        <p><strong>Project location.</strong> {project}, {v(deal.projectAddress, 'Address')}{has(deal.assetType) ? `, ${deal.assetType.toLowerCase()}` : ''}{num(deal.squareFeet) ? <> of about <Src r="squareFeet">{num(deal.squareFeet).toLocaleString()} sq ft</Src></> : ''}.</p>

        <h3>Use of {fund} loan proceeds</h3>
        <AmountTable name="urgeUses" rows={deal.urgeUses} total={a.urgeUsesTotal} totalLabel={`Total ${fund} loan`} />

        <h3>Overall project sources and uses</h3>
        <div className="two-col">
          <div>
            <h4>Sources</h4>
            <AmountTable name="projectSources" rows={deal.projectSources} total={a.srcTotal} totalLabel="Total sources" />
          </div>
          <div>
            <h4>Uses</h4>
            <AmountTable name="projectUses" rows={deal.projectUses} total={a.useTotal} totalLabel="Total uses" />
          </div>
        </div>
        {deal.projectSources?.length > 0 && (
          <StackedShare title="How the project is financed" parts={deal.projectSources.map((r) => ({ label: r.label, value: num(r.amount) }))} />
        )}
        {a.loanShareOfProject !== null && (
          <Note>
            The {fund} loan equals <Src c="loanShareOfProject">{pct(a.loanShareOfProject)}</Src> of total project cost (<Src c="projectCost">{money(a.projectCost)}</Src>).
            {Math.abs(a.srcTotal - a.useTotal) > 1 && a.srcTotal && a.useTotal ? <> Sources and uses differ by <Src c="srcUseGap">{money(Math.abs(a.srcTotal - a.useTotal))}</Src>; see Section 11.</> : ' Project sources and uses are balanced.'}
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
              <td>{principal} has {has(deal.yearsExperience) ? <Src r="yearsExperience">{num(deal.yearsExperience)} years</Src> : 'an unstated amount'} of experience{has(deal.projectsCompleted) ? <> and has completed <Src r="projectsCompleted">{num(deal.projectsCompleted)} projects</Src></> : ''}. {a.merits[0].level === 'green' ? 'The track record supports a project of this size.' : 'The committee should weigh the track record against the size of this project.'}</td>
            </tr>
            <tr>
              <td>Mission alignment</td><td><Badge level={a.missionLevel} /></td>
              <td>{a.mission.filter((m) => m.level === 'green').length} of 4 mission criteria clearly met (see Section 5).</td>
            </tr>
            <tr>
              <td>Financial strength</td><td><Badge level={a.merits[2].level} /></td>
              <td>
                {a.debtToEquityAfter !== null ? <>Debt-to-equity of <Src c="debtToEquityAfter">{a.debtToEquityAfter.toFixed(2)}x</Src> including this loan. </> : ''}
                {a.cashMonthsInterest !== null ? <>Cash covers about <Src c="cashMonthsInterest">{a.cashMonthsInterest.toFixed(0)} months</Src> of interest. </> : ''}
                {a.repaymentCoverage !== null ? <>Primary repayment source covers <Src c="repaymentCoverage">{a.repaymentCoverage.toFixed(2)}x</Src> of principal plus interest.</> : ''}
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
          {project} is located at {v(deal.projectAddress, 'Address')}. {has(deal.walkScore) ? <>The site has a Walk Score of <Src r="walkScore">{num(deal.walkScore)}</Src> (walkscore.com). </> : ''}
          {v(deal.neighborhood, 'Neighborhood description')}
        </p>

        <h3>Enterprise collateral</h3>
        <p>
          {firm} reports total assets of <Src r="totalAssets">{money(deal.totalAssets)}</Src>, liabilities of <Src r="totalLiabilities">{money(a.liabilities)}</Src> and equity of <Src r="totalEquity">{money(a.equity)}</Src>.
          {a.debtToEquity !== null ? <> Debt-to-equity is <Src c="debtToEquity">{a.debtToEquity.toFixed(2)}x</Src> today and would be <Src c="debtToEquityAfter">{a.debtToEquityAfter.toFixed(2)}x</Src> after this loan.</> : ''}
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
          {fund} would lend <Src r="loanAmount">{money(a.loan)}</Src> to {firm} to support {project}{a.projectCost ? <>, a <Src c="projectCost">{money(a.projectCost)}</Src> {has(deal.assetType) ? deal.assetType.toLowerCase() : 'commercial'} project</> : ''}.
          Over the {termYears || ''} term the loan is expected to earn <Src c="totalInterest">{money(a.totalInterest)}</Src> in interest{a.fee ? <> plus <Src c="fee">{money(a.fee)}</Src> in fees</> : ''}.
          The primary repayment source is {has(deal.repaymentOptions?.[0]?.option) ? deal.repaymentOptions[0].option.toLowerCase() : <Missing what="Primary repayment source" />}
          {a.exitMonth ? <>, expected around <Src r="exitMonth">month {a.exitMonth}</Src></> : ''}.
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
                  const fi = deal.financials.indexOf(r);
                  return (
                    <tr key={i} className={String(r.type).startsWith('P') ? 'projected' : ''}>
                      <td>{r.year}</td><td>{r.type}</td><td className="num"><Src r={`financials.${fi}.revenue`}>{money(r.revenue)}</Src></td><td className="num"><Src r={`financials.${fi}.netIncome`}>{money(r.netIncome)}</Src></td>
                      <td className="num opt">{num(r.revenue) ? <Src c={`margin:${r.year}`}>{pct(num(r.netIncome) / num(r.revenue))}</Src> : '–'}</td>
                      <td className="num opt">{g ? <Src c={`growth:${r.year}`}>{pct(g.g, 0)}</Src> : '–'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Columns title="Revenue by year (lighter bars are projections)" points={a.fin.map((r) => ({ label: r.year, value: num(r.revenue), muted: String(r.type).startsWith('P') }))} />
            <h3>Key observations</h3>
            <ul>
              {lastActual && <li>Most recent actual year ({lastActual.year}): revenue of <Src r={`financials.${deal.financials.indexOf(lastActual)}.revenue`}>{money(lastActual.revenue)}</Src> and net income of <Src r={`financials.${deal.financials.indexOf(lastActual)}.netIncome`}>{money(lastActual.netIncome)}</Src> ({num(lastActual.revenue) ? <Src c={`margin:${lastActual.year}`}>{pct(num(lastActual.netIncome) / num(lastActual.revenue))}</Src> : '–'} margin).</li>}
              {a.avgActualGrowth !== null && <li>Historical revenue growth has averaged <Src c="avgActualGrowth">{pct(a.avgActualGrowth, 0)}</Src> per year.</li>}
              {firstProj && lastProj && lastActual && <li>The borrower projects revenue rising to <Src r={`financials.${deal.financials.indexOf(lastProj)}.revenue`}>{money(lastProj.revenue)}</Src> by {lastProj.year}, <Src c="projectedRise">{pct(num(lastProj.revenue) / num(lastActual.revenue) - 1, 0)}</Src> above {lastActual.year}.</li>}
              {has(deal.ownerSharePct) && <li>{principal} owns <Src r="ownerSharePct">{num(deal.ownerSharePct)}%</Src> of {firm}{lastProj ? <>, implying a <Src c="ownerShareIncome">{money((num(lastProj.netIncome) * num(deal.ownerSharePct)) / 100)}</Src> share of projected {lastProj.year} net income</> : ''}.</li>}
              {a.cash > 0 && <li>Cash on hand of <Src r="cash">{money(a.cash)}</Src>.</li>}
            </ul>
          </>
        ) : <p><Missing what="Firm financials" /></p>}
      </section>

      <section>
        <h2>9. Loan sizing &amp; repayment</h2>
        <p>
          At {has(deal.interestRate) ? <Src r="interestRate">{num(deal.interestRate)}%</Src> : 'the stated rate'}, annual interest on <Src r="loanAmount">{money(a.loan)}</Src> is <Src c="annualInterest">{money(a.annualInterest)}</Src> (<Src c="monthlyInterest">{money(a.annualInterest / 12)}</Src> per month).
          Total owed to {fund} over the term is <Src c="totalOwed">{money(a.totalOwed)}</Src> (principal plus interest).
          {a.repaymentCoverage !== null ? <> The borrower’s primary repayment source is expected to produce <Src r="exitProceeds">{money(a.exitProceeds)}</Src>, or <Src c="repaymentCoverage">{a.repaymentCoverage.toFixed(2)}x</Src> coverage.</> : ''}
        </p>
        <h3>Repayment options, in priority order</h3>
        {deal.repaymentOptions?.length ? (
          <ol>{deal.repaymentOptions.map((r, i) => <li key={i}>{r.option}</li>)}</ol>
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

      <section>
        <h2>10. Recent news &amp; public information</h2>
        {deal.newsSummary && <p>{deal.newsSummary}</p>}
        {deal.news?.length ? ['Borrower', 'Site'].map((about) => {
          const items = deal.news.filter((n) => (n.about || 'Borrower') === about && n.headline);
          if (!items.length) return null;
          return (
            <div key={about}>
              <h3>{about === 'Borrower' ? `About ${firm} and ${principal}` : `Around the site`}</h3>
              <ul className="news-list">
                {items.map((n, i) => {
                  const href = safeUrl(n.url);
                  return (
                    <li key={i}>
                      <Badge level={['red', 'yellow', 'green'].includes(n.level) ? n.level : 'yellow'} />{' '}
                      <strong>{href ? <a href={href} target="_blank" rel="noopener noreferrer">{n.headline}</a> : n.headline}</strong>
                      {(n.source || n.date) && <span className="small"> (<Src r={`news.${deal.news.indexOf(n)}`}>{[n.source, n.date].filter(Boolean).join(', ')}</Src>)</span>}
                      {n.summary && <p>{n.summary}{n.relevance ? ` ${n.relevance}` : ''}</p>}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        }) : <p><Missing what="News search" /></p>}
        <Note>Underwriter to confirm: open each source and verify it refers to this borrower and site before committee.{deal.newsCheckedAt ? ` Search run ${deal.newsCheckedAt}.` : ''}</Note>
      </section>

      <section className="flags-section">
        <h2>11. Underwriter review: flags</h2>
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
        <h2>12. Term sheet</h2>
        <table className="terms">
          <tbody>
            <tr><th>Borrower</th><td>{firm}</td></tr>
            <tr><th>Lender</th><td>{fund}</td></tr>
            <tr><th>Loan amount</th><td><Src r="loanAmount">{money(a.loan)}</Src></td></tr>
            <tr><th>Interest rate</th><td>{has(deal.interestRate) ? <Src r="interestRate">{num(deal.interestRate)}% per year</Src> : <Missing what="Rate" />}</td></tr>
            <tr><th>Term</th><td>{has(deal.termMonths) ? <Src r="termMonths">{a.term} months</Src> : <Missing what="Term" />}</td></tr>
            <tr><th>Origination fee</th><td>{has(deal.originationFee) ? <><Src r="originationFee">{num(deal.originationFee)}%</Src> (<Src c="fee">{money(a.fee)}</Src>)</> : 'None'}</td></tr>
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
