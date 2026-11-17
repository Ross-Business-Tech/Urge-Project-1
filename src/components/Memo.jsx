import { memo } from 'react';
import { analyze, LEVEL_LABEL } from '../lib/analysis.js';
import { num, has, money, moneyShort, pct, fmtDate, or } from '../lib/format.js';
import { BarCompare, StackedShare, Columns } from './Charts.jsx';
import { safeUrl } from '../lib/news.js';
import { memoExtras } from '../lib/sections.js';
import { proseDeal } from '../lib/prose.js';

// Layout follows the fund's own investment memos (EBIARA format): REQUEST, INVESTMENT MERITS with
// colour-filled evaluation cells, key considerations, project breakdown, sources & uses, mission
// alignment, projections, repayment capacity, risks & mitigants, loan sizing, recommendation,
// approvals and exhibits.
//
// NOTE: lib/verify/memoFacts.js reads several sentences below word for word (e.g. "requests a $X
// 3-year loan from ... at 8.5% interest", "reports total assets of"). Keep them as they are.

// Marks a number so Viewing mode can show where it came from (see lib/sources.js).
// r = a Deal data field ("loanAmount", "projectSources.2.amount"); c = a calculation ("annualInterest").
const Src = ({ r, c, children }) => <span className="src" data-src={c ? `calc:${c}` : r}>{children}</span>;

const Missing = ({ what }) => <span className="missing">[{what}: to be added]</span>;
const v = (val, what) => (has(val) ? val : <Missing what={what} />);
const fx = (n) => `${n.toFixed(2)}x`;
const sqft = (n) => Math.round(num(n)).toLocaleString('en-US');
const lower1 = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const cssText = (t) => String(t || '').replace(/[\\"\n\r<>]/g, ' ').slice(0, 120);
const stripDot = (s) => String(s || '').trim().replace(/[.\s]+$/, '');
const initials = (name) => String(name || '?').replace(/[^A-Za-z ]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
const sameName = (x, y) => String(x || '').trim().toLowerCase() === String(y || '').trim().toLowerCase();
const firstSentence = (t) => { const m = String(t || '').trim().match(/^.+?[.!?](\s|$)/); return (m ? m[0] : String(t || '')).trim(); };
// "The firm has completed approximately $6,500,000 of development, including 12 residential units and 36,000 sq ft of commercial space (48,000 sq ft in total)."
function trackRecord(d) {
  const parts = [];
  if (has(d.unitsCompleted)) parts.push(<><Src r="unitsCompleted">{num(d.unitsCompleted)}</Src> residential units</>);
  if (has(d.commercialSqFtCompleted)) parts.push(<><Src r="commercialSqFtCompleted">{sqft(d.commercialSqFtCompleted)}</Src> sq ft of commercial space</>);
  if (!has(d.tdcCompleted) && !parts.length && !has(d.sqFtCompleted)) return null;
  return (
    <>
      {' '}The firm has completed {has(d.tdcCompleted) ? <>approximately <Src r="tdcCompleted">{money(d.tdcCompleted)}</Src> of total development</> : 'projects'}
      {parts.length ? <>, including {parts.length === 2 ? <>{parts[0]} and {parts[1]}</> : parts[0]}</> : ''}
      {has(d.sqFtCompleted) ? <> (<Src r="sqFtCompleted">{sqft(d.sqFtCompleted)}</Src> sq ft in total)</> : ''}.
    </>
  );
}
const showRange = (r) => (r.kind === '$'
  ? (Math.round(r.low) === Math.round(r.high) ? moneyShort(r.low) : `${moneyShort(r.low)} – ${moneyShort(r.high)}`)
  : (Math.round(r.low) === Math.round(r.high) ? String(Math.round(r.low)) : `${Math.round(r.low)} – ${Math.round(r.high)}`));

function Badge({ level }) {
  return <span className={`badge badge-${level}`}>{LEVEL_LABEL[level]}</span>;
}

// The coloured "Evaluation" cell used in the fund's memos (green / yellow / red fill).
function Eval({ level, fact }) {
  return (
    <td className={`eval eval-${level}`} data-fact={fact}>
      <span className="eval-label">{LEVEL_LABEL[level]}</span>
    </td>
  );
}

function Note({ children }) {
  return <aside className="callout">{children}</aside>;
}

function AmountTable({ name, rows, total, totalLabel = 'Total', base, title = 'Item', perSf }) {
  if (!rows?.length) return <p><Missing what="Table" /></p>;
  return (
    <table className="money-table">
      <thead>
        <tr><th>{title}</th><th className="num">Amount</th><th className="num">%</th>{perSf && <th className="num opt">Cost/Sq. Ft.</th>}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td>{r.label}</td>
            <td className="num" data-fact={{ urgeUses: 'loanUse', projectSources: 'source', projectUses: 'use' }[name]}><Src r={`${name}.${i}.amount`}>{money(r.amount)}</Src></td>
            <td className="num"><Src c={`rowShare:${name}:${i}`}>{pct(num(r.amount) / (base || total || 1), 0)}</Src></td>
            {perSf && <td className="num opt"><Src c={`useCostPerSf:${i}`}>${perSf[i].toFixed(2)}</Src></td>}
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr><td>{totalLabel}</td><td className="num"><Src c={`tableTotal:${name}`}>{money(total)}</Src></td><td className="num">100%</td>{perSf && <td className="num opt">{perSf.total !== null ? <Src c="costPerSf">${perSf.total.toFixed(2)}</Src> : '–'}</td>}</tr>
      </tfoot>
    </table>
  );
}

function MemoDoc({ deal: raw }) {
  // Free-response answers typed as bullets read as paragraphs in the memo.
  const deal = proseDeal(raw);
  const a = analyze(deal);
  const fund = or(deal.fundName, 'the Fund');
  const firm = or(deal.firmName, 'the Borrower');
  const principal = or(deal.principalName, 'the principal');
  const project = or(deal.projectName, 'the Project');
  const termYears = a.term ? (a.term % 12 === 0 ? `${a.term / 12}-year` : `${a.term}-month`) : '';
  const reds = a.flags.filter((f) => f.level === 'red');
  const yellows = a.flags.filter((f) => f.level === 'yellow');
  const lastActual = a.actuals[a.actuals.length - 1];
  const firstProj = a.projections[0];
  const lastProj = a.projections[a.projections.length - 1];
  const hasUnits = has(deal.residentialUnits) || has(deal.commercialSqFt);
  const sch = a.schedule;
  const sizingPoints = (deal.loanSizingPoints || []).map((r) => String(r.point || '').trim()).filter(Boolean).map((t) => (/[.!?]$/.test(t) ? t : `${t}.`)).map((t) => t.charAt(0).toUpperCase() + t.slice(1));
  const typeLabel = deal.projectType === 'Other' ? (deal.projectTypeOther || '').trim() : deal.projectType || '';
  const track = trackRecord(deal);
  const extras = memoExtras(deal);
  // Sections the team added (template or this memo only), shown after the section they chose.
  const extra = (pos) => (extras[pos] || []).map((x, i) => (
    <section className={`custom-section${x.template ? ' from-template' : ''}`} key={`${pos}-${i}`}>
      <h2>{String(x.title).toUpperCase()}</h2>
      {String(x.body || '').trim()
        ? String(x.body).split(/\n\s*\n/).map((para, j) => <p key={j}>{para}</p>)
        : <p><Missing what={`${x.title} text`} /></p>}
      {x.template && !x.filled && String(x.body || '').trim() ? <Note>Starting text from the saved section. Replace it with this deal’s details, on the Deal data page (section 12) or by editing the memo.</Note> : null}
    </section>
  ));
  const amis = [...new Set(a.tiers.map((t) => t.ami).filter((x) => x > 0))].sort((x, y) => x - y);
  const amiText = amis.length ? amis.map((x) => `${x}%`).join(amis.length > 2 ? ', ' : ' and ') : has(deal.amiPct) ? `${num(deal.amiPct)}%` : '';
  const tierText = a.tiers.length ? a.tiers.map((t) => `${t.units} at ${t.ami}% AMI`).join(a.tiers.length > 2 ? ', ' : ' and ') : '';
  const props = (deal.collateralProperties || []).filter((r) => has(r.description) || has(r.marketValue));
  const approvers = (deal.approvers || []).filter((x) => has(x.name) || has(x.title));
  const signers = approvers.length ? approvers : [{ name: '', title: 'Chief Operating Officer' }, { name: '', title: 'Fund Manager' }];
  const risks = (deal.risks || []).filter((r) => has(r.risk));
  const autoRisks = a.flags.filter((f) => f.level !== 'green' && !f.area.startsWith('News'));
  const usesPerSf = a.costPerSf !== null ? Object.assign([...a.useCostPerSf], { total: a.costPerSf }) : null;
  const decision =
    a.overall === 'red'
      ? 'deferred until the red items identified in this memo are resolved'
      : a.overall === 'yellow'
        ? 'approved, subject to the conditions and follow-up items noted in this memo'
        : 'approved';
  const status = [deal.constructionType, deal.siteControl === 'Yes' ? 'site control in place' : deal.siteControl === 'No' ? 'site control not yet secured' : '', has(deal.constructionStart) ? `construction anticipated ${deal.constructionStart}` : '']
    .filter(Boolean).join('; ');

  return (
    <article className="memo ebiara">
      <header className="memo-head">
        <div className="memo-logo">
          <span className="logo-mark" aria-hidden="true">{String(fund).replace(/^the /i, '').charAt(0).toUpperCase()}</span>
          <span className="logo-name">{fund}</span>
          {has(deal.fundTagline) && <span className="logo-tag">{deal.fundTagline}</span>}
        </div>
        <div className="memo-meta">
          <div>
            <p className="meta-label">Firm under consideration:</p>
            <p className="meta-firm">{firm}</p>
            {has(deal.hqCity) && <p>{deal.hqCity}</p>}
          </div>
          <div>
            <p className="meta-title">INVESTMENT MEMORANDUM</p>
            <p>{fmtDate(deal.memoDate)}</p>
            <p>Relationship Manager: {v(deal.relationshipManager, 'Relationship manager')}</p>
            <p>Underwriter: {v(deal.preparedBy, 'Underwriter')}</p>
            <p>To: {v(deal.committee, 'Investment committee')}</p>
          </div>
        </div>
        <p className="draft-tag">Draft</p>
      </header>

      <section>
        <h2>REQUEST</h2>
        <h3 className="sub">Loan Request</h3>
        <p>
          Approval of a <Src r="loanAmount">{money(a.loan)}</Src> {fund} loan facility to {firm} to support {project}
          {has(deal.assetType) ? `, a ${lower1(deal.assetType)}` : typeLabel ? `, a ${lower1(typeLabel)} project` : ''} located at {v(deal.projectAddress, 'Address')}. {has(deal.loanPurpose) ? `${stripDot(deal.loanPurpose)}.` : <Missing what="Loan purpose" />}
          {' '}{firm} is led by {principal}{has(deal.principalTitle) ? `, ${deal.principalTitle}` : ''}.
          {a.stage ? ` The firm is classified as ${/^[aeiou]/i.test(a.stage) ? 'an' : 'a'} ${a.stage.toLowerCase()} developer.` : ''}
        </p>

        {(hasUnits || num(deal.squareFeet) || typeLabel || has(deal.targetPopulation) || has(deal.siteControl) || has(deal.constructionStart)) && (
          <>
            <h3 className="sub">The Project</h3>
            <p>
              {typeLabel ? `${project} is a ${lower1(typeLabel)} project${has(deal.constructionType) ? ` (${lower1(deal.constructionType)})` : ''}.` : ''}
              {hasUnits && (
                <>
                  {' '}The “Project” will include{' '}
                  {has(deal.residentialUnits) ? <><Src r="residentialUnits">{num(deal.residentialUnits)}</Src> residential units</> : null}
                  {a.affordablePct !== null ? <>, <Src c="affordablePct">{pct(a.affordablePct, 0)}</Src> of which are affordable{amiText ? <> at {amiText} AMI</> : ''}</> : null}
                  {has(deal.commercialSqFt) ? <>{has(deal.residentialUnits) ? ', and ' : ''}<Src r="commercialSqFt">{sqft(deal.commercialSqFt)}</Src> square feet of commercial space</> : null}
                  {num(deal.squareFeet) ? <>, of about <Src r="squareFeet">{num(deal.squareFeet).toLocaleString()} sq ft</Src> in total</> : ''}.
                </>
              )}
              {!hasUnits && num(deal.squareFeet) ? <> The building has a total area of about <Src r="squareFeet">{num(deal.squareFeet).toLocaleString()} sq ft</Src>.</> : ''}
              {deal.siteControl === 'Yes' ? ` The development team has site control${has(deal.constructionStart) ? ` and anticipates beginning construction in ${deal.constructionStart}` : ''}.` : has(deal.constructionStart) ? ` Construction is anticipated to begin in ${deal.constructionStart}.` : ''}
              {has(deal.targetPopulation) ? ` The project is intended to serve ${lower1(stripDot(deal.targetPopulation))}.` : ''}
            </p>
          </>
        )}

        <h3 className="sub">Loan Terms &amp; Repayment Structure</h3>
        <p>
          {firm} requests a <strong><Src r="loanAmount">{money(a.loan)}</Src></strong> <Src r="termMonths">{termYears}</Src> loan from {fund} at <strong>{has(deal.interestRate) ? <Src r="interestRate">{num(deal.interestRate)}%</Src> : <Missing what="Rate" />}</strong> interest per annum
          {has(deal.originationFee) ? <>, with a <Src r="originationFee">{num(deal.originationFee)}%</Src> origination fee (<Src c="fee">{money(a.fee)}</Src>)</> : ''}.{' '}
          {sch.ioMonths > 0
            ? <>The loan requires monthly interest-only payments{sch.monthlyIoPayment !== null ? <> of approximately <Src c="ioPayment">{money(sch.monthlyIoPayment)}</Src></> : ''} for the first <Src r={has(deal.interestOnlyMonths) ? 'interestOnlyMonths' : 'termMonths'}>{sch.ioMonths} months</Src>{deal.interestReserve === 'Yes' ? ', supported by an interest reserve' : ''}
                {sch.amortPayment !== null ? <>, followed by monthly principal and interest payments of approximately <Src c="amortPayment">{money(sch.amortPayment)}</Src> based on a <Src r="amortizationYears">{sch.amortYears}-year</Src> amortization schedule commencing in <Src c="amortStart">month {sch.amortStart}</Src></> : ''}. </>
            : sch.amortPayment !== null
              ? <>The loan is fully amortizing, with monthly principal and interest payments of approximately <Src c="amortPayment">{money(sch.amortPayment)}</Src> based on a <Src r={has(deal.amortizationYears) ? 'amortizationYears' : 'termMonths'}>{Math.round(sch.amortYears * 10) / 10}-year</Src> schedule. </>
              : /accrued/i.test(deal.repaymentStructure || '') ? <>Interest accrues during the term and is paid, together with principal, at maturity. </>
                : <>Repayment structure: {deal.repaymentStructure?.toLowerCase() || <Missing what="Structure" />}. </>}
          The outstanding principal balance{sch.amortPayment !== null && sch.balloon > 1 ? <> (approximately <Src c="balloon">{money(sch.balloon)}</Src> at maturity)</> : ''} plus any accrued and unpaid interest will be due at loan maturity
          {a.successFee > 0 ? <>, together with a success fee equal to <Src r="successFeePct">{num(deal.successFeePct)}%</Src> of the total loan amount (<Src c="successFee">{money(a.successFee)}</Src>)</> : ''}.
        </p>

        <h3>{fund} Project Specific Loan Sources &amp; Uses</h3>
        <div className="two-col su">
          <table className="money-table">
            <thead><tr><th>Sources</th><th className="num">Amount</th><th className="num">%</th></tr></thead>
            <tbody><tr><td>{fund} loan</td><td className="num"><Src r="loanAmount">{money(a.loan)}</Src></td><td className="num">100%</td></tr></tbody>
            <tfoot><tr><td>Total Sources</td><td className="num"><Src r="loanAmount">{money(a.loan)}</Src></td><td className="num">100%</td></tr></tfoot>
          </table>
          <AmountTable name="urgeUses" title="Uses" rows={deal.urgeUses} total={a.urgeUsesTotal} totalLabel="Total Uses" />
        </div>
      </section>

      {extra('request')}

      <section>
        <h2>INVESTMENT MERITS</h2>
        <table className="criteria">
          <thead><tr><th>Investment Criteria</th><th>Evaluation</th><th>Comments</th></tr></thead>
          <tbody>
            <tr>
              <th scope="row">Experience</th><Eval level={a.merits[0].level} />
              <td>{principal} has {has(deal.yearsExperience) ? <Src r="yearsExperience">{num(deal.yearsExperience)} years</Src> : 'an unstated amount'} of experience{has(deal.projectsCompleted) ? <> and has completed <Src r="projectsCompleted">{num(deal.projectsCompleted)} projects</Src></> : ''}. {a.merits[0].level === 'green' ? 'The track record supports a project of this size.' : 'The committee should weigh the track record against the size of this project.'}</td>
            </tr>
            <tr>
              <th scope="row">Mission Alignment</th><Eval level={a.missionLevel} />
              <td>{a.mission.filter((m) => m.level === 'green').length} of 4 mission criteria clearly met (see Mission Alignment below).{has(deal.growthPlan) ? ` ${deal.growthPlan}` : ''}</td>
            </tr>
            <tr>
              <th scope="row">Financial Strength</th><Eval level={a.merits[2].level} />
              <td>
                {has(deal.primaryRepayment) ? `Repayment is underwritten first to ${lower1(stripDot(deal.primaryRepayment))}${has(deal.secondaryRepayment) ? `, and second to ${lower1(stripDot(deal.secondaryRepayment))}` : ''}. ` : ''}
                {a.debtToEquityAfter !== null ? <>Debt-to-equity of <Src c="debtToEquityAfter">{a.debtToEquityAfter.toFixed(2)}x</Src> including this loan. </> : ''}
                {a.cashMonthsInterest !== null ? <>Cash covers about <Src c="cashMonthsInterest">{a.cashMonthsInterest.toFixed(0)} months</Src> of interest. </> : ''}
                {a.repaymentCoverage !== null ? <>Primary repayment source covers <Src c="repaymentCoverage">{a.repaymentCoverage.toFixed(2)}x</Src> of principal plus interest.</> : ''}
              </td>
            </tr>
            <tr className="overall">
              <th scope="row">OVERALL ASSESSMENT</th><Eval level={a.overall} fact="overall" />
              <td>{a.overall === 'green' ? `Meets ${fund} mission and economic criteria.` : a.overall === 'yellow' ? `Supportable, subject to the conditions noted; meets most ${fund} criteria.` : 'Material concerns must be resolved before approval.'}</td>
            </tr>
          </tbody>
        </table>

        <p>Below are key considerations for the investment:</p>
        <h4 className="group">Site &amp; Community</h4>
        <ul className="considerations">
          <li>
            <strong>NEIGHBORHOOD INVESTMENT:</strong>{' '}
            {project} is located at {v(deal.projectAddress, 'Address')}. {has(deal.walkScore) ? <>The site has a Walk Score of <Src r="walkScore">{num(deal.walkScore)}</Src> (walkscore.com). </> : ''}
            {v(deal.neighborhood, 'Neighborhood description')}
          </li>
          {has(deal.targetPopulation) && (
            <li><strong>WHO THE PROJECT SERVES:</strong> {deal.targetPopulation}</li>
          )}
          {a.affordablePct !== null && (
            <li>
              <strong>AFFORDABLE HOUSING COMPONENT:</strong> {a.tiers.length ? <Src c="affordableCount">{a.affordableCount}</Src> : <Src r="affordableUnits">{num(deal.affordableUnits)}</Src>} of <Src r="residentialUnits">{num(deal.residentialUnits)}</Src> residential units (<Src c="affordablePct">{pct(a.affordablePct, 0)}</Src>) are designated as affordable{tierText ? `: ${tierText}` : amiText ? ` at ${amiText} AMI` : ''}.
            </li>
          )}
        </ul>
        <h4 className="group">Sponsor</h4>
        <ul className="considerations">
          <li>
            <strong>MANAGEMENT EXPERIENCE:</strong>{' '}
            {principal}{has(deal.principalTitle) ? `, ${deal.principalTitle},` : ','} who brings{' '}
            {has(deal.yearsExperience) ? <Src r="yearsExperience">{num(deal.yearsExperience)} years</Src> : <Missing what="Years" />} of real estate development and construction experience
            {has(deal.projectsCompleted) ? <> and <Src r="projectsCompleted">{num(deal.projectsCompleted)} completed projects</Src></> : ''}.{track}{a.stage ? ` The firm is classified as ${/^[aeiou]/i.test(a.stage) ? 'an' : 'a'} ${a.stage.toLowerCase()} developer.` : ''} {v(deal.principalBio, 'Principal bio')}
          </li>
          {has(deal.guarantorName) && (
            <li>
              <strong>CO-BORROWER / GUARANTOR STRENGTH ({deal.guarantorName.toUpperCase()}):</strong>{' '}
              {deal.guarantorName}’s existing portfolio is considered as a secondary source of repayment. {has(deal.guarantorPortfolio) ? `${stripDot(deal.guarantorPortfolio)}. ` : ''}
              {has(deal.guarantorDscr) ? <>The portfolio has a DSCR of <Src r="guarantorDscr">{fx(num(deal.guarantorDscr))}</Src>.</> : ''}
            </li>
          )}
        </ul>
        <h4 className="group">Underwriting &amp; Collateral</h4>
        <ul className="considerations">
          {(has(deal.rentHaircutPct) || has(deal.underwrittenVacancyPct) || has(deal.underwritingNote) || a.proj.length > 0) && (
            <li>
              <strong>CONSERVATIVE UNDERWRITING APPROACH:</strong>{' '}
              {has(deal.underwritingNote) ? `${stripDot(deal.underwritingNote)}. ` : ''}
              {has(deal.rentHaircutPct) ? <>Underwriting reduced the borrower’s projected rental revenue by <Src r="rentHaircutPct">{num(deal.rentHaircutPct)}%</Src>{has(deal.underwrittenVacancyPct) ? <> and {has(deal.borrowerVacancyPct) ? <>increased vacancy from <Src r="borrowerVacancyPct">{num(deal.borrowerVacancyPct)}%</Src> to <Src r="underwrittenVacancyPct">{num(deal.underwrittenVacancyPct)}%</Src></> : <>assumed <Src r="underwrittenVacancyPct">{num(deal.underwrittenVacancyPct)}%</Src> vacancy</>}</> : ''}. </> : ''}
              {a.firstDscr !== null ? <>With these assumptions the project reaches a DSCR of <Src c="dscr:0">{fx(a.firstDscr)}</Src> in {a.proj[0].year}{a.proj.length > 1 ? <>, improving to <Src c={`dscr:${a.proj.length - 1}`}>{fx(a.lastDscr)}</Src> by {a.proj[a.proj.length - 1].year}</> : ''}.</> : ''}
            </li>
          )}
          {(has(deal.collateral) || has(deal.guarantee) || props.length > 0) && (
            <li>
              <strong>COLLATERAL SUPPORT:</strong> {has(deal.collateral) ? `${stripDot(deal.collateral)}.` : ''}{has(deal.guarantee) ? ` Guarantee: ${lower1(stripDot(deal.guarantee))}.` : ''}
              {props.length > 0 && (
                <>
                  {' '}In addition, {fund} will take a lien on the following properties:
                  <ul>
                    {props.map((r, i) => (
                      <li key={i}>{r.description}: annual rent <Src r={`collateralProperties.${i}.annualRent`}>{money(r.annualRent)}</Src>, market value <Src r={`collateralProperties.${i}.marketValue`}>{money(r.marketValue)}</Src></li>
                    ))}
                    <li><strong>Total annual rent ~<Src c="collateralRent">{money(a.collateralRent)}</Src> – total market value ~<Src c="collateralValue">{money(a.collateralValue)}</Src>{a.collateralCoverage !== null ? <> (<Src c="collateralCoverage">{fx(a.collateralCoverage)}</Src> the loan)</> : ''}</strong></li>
                  </ul>
                </>
              )}
            </li>
          )}
          <li>
            <strong>ENTERPRISE COLLATERAL:</strong>{' '}
            {firm} reports total assets of <Src r="totalAssets">{money(deal.totalAssets)}</Src>, liabilities of <Src r="totalLiabilities">{money(a.liabilities)}</Src> and equity of <Src r="totalEquity">{money(a.equity)}</Src>.
            {a.debtToEquity !== null ? <> Debt-to-equity is <Src c="debtToEquity">{a.debtToEquity.toFixed(2)}x</Src> today and would be <Src c="debtToEquityAfter">{a.debtToEquityAfter.toFixed(2)}x</Src> after this loan.</> : ''}
          </li>
        </ul>
        {a.equity > 0 && (
          <BarCompare
            title="Enterprise collateral: debt and equity before and after this loan"
            bars={[
              { label: 'Equity', value: a.equity, tone: 'b' },
              { label: 'Debt today', value: a.liabilities, tone: 'a' },
              { label: `Debt incl. ${fund} loan`, value: a.liabilities + a.loan, tone: 'c' },
            ]}
            note={a.debtToEquityAfter !== null ? `Debt-to-equity: ${a.debtToEquity.toFixed(2)}x → ${a.debtToEquityAfter.toFixed(2)}x` : null}
          />
        )}
        <Note>Underwriter to confirm: cross-check the bio, prior projects and any litigation against public records and news before committee.</Note>
      </section>

      {extra('merits')}

      <section>
        <h2>PROJECT BREAKDOWN</h2>
        <div className="table-scroll">
          <table className="breakdown">
            <thead><tr><th>Project</th><th>Location</th><th className="num">Residential Units</th><th className="num">Commercial Sq. Ft.</th><th className="num">TDC</th><th>Construction Type / Status</th></tr></thead>
            <tbody>
              <tr>
                <td>{project}</td><td>{v(deal.projectAddress, 'Address')}</td>
                <td className="num">{has(deal.residentialUnits) ? <Src r="residentialUnits">{num(deal.residentialUnits)}</Src> : '–'}</td>
                <td className="num">{has(deal.commercialSqFt) ? <Src r="commercialSqFt">{sqft(deal.commercialSqFt)}</Src> : '–'}</td>
                <td className="num">{a.projectCost ? <Src c="projectCost">{money(a.projectCost)}</Src> : '–'}</td>
                <td>{status || (has(deal.assetType) ? deal.assetType : '–')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {extra('breakdown')}

      <section>
        <h2>PROJECT SOURCES AND USES</h2>
        <div className="two-col su">
          <AmountTable name="projectSources" title="Sources" rows={deal.projectSources} total={a.srcTotal} totalLabel="Total Sources" />
          <AmountTable name="projectUses" title="Uses" rows={deal.projectUses} total={a.useTotal} totalLabel="Total Uses" perSf={usesPerSf} />
        </div>
        {deal.projectSources?.length > 0 && (
          <StackedShare title="How the project is financed" parts={deal.projectSources.map((r) => ({ label: r.label, value: num(r.amount) }))} />
        )}
        {a.loanShareOfProject !== null && (
          <Note>
            The {fund} loan equals <Src c="loanShareOfProject">{pct(a.loanShareOfProject)}</Src> of total project cost (<Src c="projectCost">{money(a.projectCost)}</Src>).
            {Math.abs(a.srcTotal - a.useTotal) > 1 && a.srcTotal && a.useTotal ? <> Sources and uses differ by <Src c="srcUseGap">{money(Math.abs(a.srcTotal - a.useTotal))}</Src>; see Underwriter Review.</> : ' Project sources and uses are balanced.'}
          </Note>
        )}
      </section>

      {extra('sources')}

      <section>
        <h2>MISSION ALIGNMENT</h2>
        <table className="criteria">
          <thead><tr><th>Criteria</th><th>Evaluation</th><th>Comments</th></tr></thead>
          <tbody>
            {a.mission.map((m) => (
              <tr key={m.label}><th scope="row">{m.label.replace(/\b\w/g, (c) => c.toUpperCase())}</th><Eval level={m.level} /><td>{m.text}</td></tr>
            ))}
            <tr className="overall"><th scope="row">OVERALL ASSESSMENT</th><Eval level={a.missionLevel} /><td>{a.missionLevel === 'green' ? `Meets ${fund} mission criteria.` : a.missionLevel === 'yellow' ? `Partially meets ${fund} mission criteria.` : `Does not yet meet ${fund} mission criteria.`}</td></tr>
          </tbody>
        </table>
      </section>

      {extra('mission')}

      {a.impact && (
        <section>
          <h2>NEIGHBORHOOD IMPACT ESTIMATE</h2>
          <p>
            Estimated from this project’s own inputs{a.projectCost ? <> (total development cost of <Src c="projectCost">{money(a.projectCost)}</Src>{has(deal.residentialUnits) ? <>, <Src r="residentialUnits">{num(deal.residentialUnits)}</Src> residential units</> : ''}{has(deal.commercialSqFt) ? <>, <Src r="commercialSqFt">{sqft(deal.commercialSqFt)}</Src> sq ft of commercial space</> : ''})</> : ''}.
            Each figure is a range because the assumptions vary by market; it is a screening estimate, not an economic impact study.
          </p>
          <table className="impact">
            <thead><tr><th>Impact</th><th className="num">Estimated range</th><th>Timing</th><th className="opt">How it is estimated</th></tr></thead>
            <tbody>
              {a.impact.rows.map((r) => (
                <tr key={r.key}>
                  <th scope="row">{r.label}</th>
                  <td className="num"><Src c={`impact:${r.key}`}>{showRange(r)}</Src></td>
                  <td>{r.when}</td>
                  <td className="opt small">{r.basis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {extra('impact')}

      <section>
        <h2>INVESTMENT OVERVIEW</h2>
        <p>
          {fund} would lend <Src r="loanAmount">{money(a.loan)}</Src> to {firm} to support {project}{a.projectCost ? <>, a <Src c="projectCost">{money(a.projectCost)}</Src> {has(deal.assetType) ? deal.assetType.toLowerCase() : 'commercial'} project</> : ''}.
          Over the {termYears || ''} term the loan is expected to earn <Src c="totalInterest">{money(a.totalInterest)}</Src> in interest{a.fee ? <> plus <Src c="fee">{money(a.fee)}</Src> in fees</> : ''}{a.successFee > 0 ? <> and a <Src c="successFee">{money(a.successFee)}</Src> success fee</> : ''}.
          The primary repayment source is {has(deal.repaymentOptions?.[0]?.option) ? deal.repaymentOptions[0].option.toLowerCase() : <Missing what="Primary repayment source" />}
          {a.exitMonth ? <>, expected around <Src r="exitMonth">month {a.exitMonth}</Src></> : ''}.
          Beyond the single project, the loan is intended to strengthen {firm} as a company: {has(deal.growthPlan) ? deal.growthPlan.charAt(0).toLowerCase() + deal.growthPlan.slice(1) : <Missing what="Growth plan" />}
        </p>
      </section>

      {extra('overview')}

      {a.proj.length > 0 && (
        <section>
          <h2>{String(project).toUpperCase()} PROJECTED FINANCIAL PERFORMANCE</h2>
          <p>
            {has(deal.underwritingNote) ? `${stripDot(deal.underwritingNote)}. ` : ''}
            The project is projected to generate operating cash flow that supports project-level debt service. Based on the underwriting model, {a.proj[0].year} net operating income is approximately <Src c="noi:0">{money(a.proj[0].noi)}</Src>, with project-level DSCR of approximately <Src c="dscr:0">{fx(a.firstDscr)}</Src>.
            {a.proj.length > 1 && a.lastDscr > a.firstDscr ? ' DSCR is projected to improve over the following years as rents and revenue grow.' : ''}
          </p>
          <div className="table-scroll">
            <table className="proj">
              <thead><tr><th>Fiscal year</th><th className="num">Revenue</th><th className="num">Operating expenses</th><th className="num">Net operating income</th><th className="num">Debt service</th><th className="num">DSCR</th></tr></thead>
              <tbody>
                {a.proj.map((r, i) => {
                  const k = deal.projectProjections.findIndex((x) => String(x.year) === String(r.year));
                  return (
                    <tr key={i}>
                      <td>{r.year}</td>
                      <td className="num"><Src r={`projectProjections.${k}.revenue`}>{money(r.revenue)}</Src></td>
                      <td className="num"><Src r={`projectProjections.${k}.expenses`}>{money(r.expenses)}</Src></td>
                      <td className="num"><Src c={`noi:${i}`}>{money(r.noi)}</Src></td>
                      <td className="num"><Src r={`projectProjections.${k}.debtService`}>{money(r.debtService)}</Src></td>
                      <td className="num">{r.dscr !== null ? <Src c={`dscr:${i}`}>{fx(r.dscr)}</Src> : 'N/A'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {extra('projections')}

      <section>
        <h2>FIRM FINANCIALS</h2>
        {a.fin.length ? (
          <>
            <h3 className="sub">Historical &amp; Projected Results</h3>
            <table>
              <thead><tr><th>Year</th><th>Type</th><th className="num">Revenue</th><th className="num">Net income</th><th className="num opt">Margin</th><th className="num opt">Growth</th></tr></thead>
              <tbody>
                {a.fin.map((r, i) => {
                  const g = a.growth.find((x) => x.year === r.year);
                  const fi = deal.financials.indexOf(r);
                  return (
                    <tr key={i} className={String(r.type).startsWith('P') ? 'projected' : ''}>
                      <td data-fact="finYear">{r.year}</td><td data-fact="finType">{r.type}</td><td className="num" data-fact="finRev"><Src r={`financials.${fi}.revenue`}>{money(r.revenue)}</Src></td><td className="num" data-fact="finNet"><Src r={`financials.${fi}.netIncome`}>{money(r.netIncome)}</Src></td>
                      <td className="num opt">{num(r.revenue) ? <Src c={`margin:${r.year}`}>{pct(num(r.netIncome) / num(r.revenue))}</Src> : '–'}</td>
                      <td className="num opt">{g ? <Src c={`growth:${r.year}`}>{pct(g.g, 0)}</Src> : '–'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Columns title="Revenue by year (lighter bars are projections)" points={a.fin.map((r) => ({ label: r.year, value: num(r.revenue), muted: String(r.type).startsWith('P') }))} />
            <h3 className="sub">Key Observations</h3>
            <ul>
              {lastActual && <li>Most recent actual year ({lastActual.year}): revenue of <Src r={`financials.${deal.financials.indexOf(lastActual)}.revenue`}>{money(lastActual.revenue)}</Src> and net income of <Src r={`financials.${deal.financials.indexOf(lastActual)}.netIncome`}>{money(lastActual.netIncome)}</Src> ({num(lastActual.revenue) ? <Src c={`margin:${lastActual.year}`}>{pct(num(lastActual.netIncome) / num(lastActual.revenue))}</Src> : '–'} margin).</li>}
              {a.avgActualGrowth !== null && <li>Historical revenue growth has averaged <Src c="avgActualGrowth">{pct(a.avgActualGrowth, 0)}</Src> per year.</li>}
              {firstProj && lastProj && lastActual && <li>The borrower projects revenue rising to <Src r={`financials.${deal.financials.indexOf(lastProj)}.revenue`}>{money(lastProj.revenue)}</Src> by {lastProj.year}, <Src c="projectedRise">{pct(num(lastProj.revenue) / num(lastActual.revenue) - 1, 0)}</Src> above {lastActual.year}.</li>}
              {has(deal.ownerSharePct) && <li>{principal} owns <Src r="ownerSharePct">{num(deal.ownerSharePct)}%</Src> of {firm}{lastProj ? <>, implying a <Src c="ownerShareIncome">{money((num(lastProj.netIncome) * num(deal.ownerSharePct)) / 100)}</Src> share of projected {lastProj.year} net income</> : ''}.</li>}
              {has(deal.cash) && <li>Cash on hand of <Src r="cash">{money(a.cash)}</Src>.</li>}
            </ul>
          </>
        ) : <p><Missing what="Firm financials" /></p>}
      </section>

      {extra('financials')}

      <section>
        <h2>CONSOLIDATED REPAYMENT CAPACITY</h2>
        <p>
          The consolidated view compares the borrower’s expected repayment proceeds with everything owed to {fund}
          {has(deal.secondaryRepayment) ? `. ${stripDot(deal.secondaryRepayment)} is included as a secondary repayment source` : ''}.
          {a.aggregateCoverage !== null
            ? <> Including the maturity payment{a.successFee > 0 ? <> and the <Src r="successFeePct">{num(deal.successFeePct)}%</Src> success fee</> : ''}, expected repayment proceeds of approximately <Src r="exitProceeds">{money(a.exitProceeds)}</Src> compare with total {fund} obligations of approximately <Src c="totalObligations">{money(a.totalObligations)}</Src>, producing approximately <Src c="aggregateCoverage">{fx(a.aggregateCoverage)}</Src> aggregate coverage over the full period.</>
            : <> <Missing what="Expected repayment proceeds" /></>}
        </p>
        {a.loan > 0 && (
          <BarCompare
            title="Development repayment: what is owed vs. what the project returns"
            bars={[
              { label: 'Principal', value: a.loan, tone: 'a' },
              { label: 'Total owed (with interest)', value: a.totalOwed, tone: 'c' },
              ...(a.successFee > 0 ? [{ label: 'Total incl. success fee', value: a.totalObligations, tone: 'e' }] : []),
              { label: 'Expected project proceeds', value: a.exitProceeds, tone: 'b' },
              { label: 'Firm cash on hand today', value: a.cash, tone: 'd' },
            ]}
          />
        )}
      </section>

      {extra('repayment')}

      <section>
        <h2>ORGANIZATIONAL STRUCTURE</h2>
        <p>{v(deal.orgStructure, 'Organizational structure')}</p>
        <Note>Insert the borrower’s organizational chart here and highlight the entity that receives {fund}’s loan proceeds.</Note>
      </section>

      {extra('org')}

      <section>
        <h2>BORROWER &amp; SPONSOR TEAM</h2>
        <h3 className="sub">Borrower</h3>
        <div className="people">
          <div className="person lead">
            <span className="avatar" aria-hidden="true">{initials(principal)}</span>
            <div>
              <p className="person-name">{principal}</p>
              <p className="person-role">{[deal.principalTitle, firm].filter(Boolean).join(', ')}</p>
              <p className="chips">
                {(a.stage || a.stageSuggested) && <span className="chip">{a.stage || `${a.stageSuggested} (suggested)`} developer</span>}
                {has(deal.yearsExperience) && <span className="chip">{num(deal.yearsExperience)} yrs in development</span>}
                {has(deal.projectsCompleted) && <span className="chip">{num(deal.projectsCompleted)} projects completed</span>}
                {has(deal.tdcCompleted) && <span className="chip"><Src r="tdcCompleted">{moneyShort(deal.tdcCompleted)}</Src> developed</span>}
                {has(deal.unitsCompleted) && <span className="chip">{num(deal.unitsCompleted)} units completed</span>}
                {has(deal.commercialSqFtCompleted) && <span className="chip">{sqft(deal.commercialSqFtCompleted)} commercial sq ft completed</span>}
                {has(deal.guarantorName) && sameName(deal.guarantorName, principal) && <span className="chip">Personal guarantor</span>}
                {has(deal.ownerSharePct) && <span className="chip">Owns {num(deal.ownerSharePct)}% of the firm</span>}
              </p>
              {has(deal.principalBio) && <p className="person-bio">{firstSentence(deal.principalBio)}</p>}
            </div>
          </div>
          {has(deal.guarantorName) && !sameName(deal.guarantorName, principal) && (
            <div className="person">
              <span className="avatar" aria-hidden="true">{initials(deal.guarantorName)}</span>
              <div>
                <p className="person-name">{deal.guarantorName}</p>
                <p className="person-role">Guarantor / co-borrower</p>
                {has(deal.guarantorPortfolio) && <p className="person-bio">{firstSentence(deal.guarantorPortfolio)}</p>}
              </div>
            </div>
          )}
        </div>
        <h3 className="sub">Sponsor &amp; Development Team</h3>
        {deal.team?.length ? (
          <div className="people">
            {deal.team.filter((t) => (has(t.name) || has(t.company)) && !sameName(t.name, principal)).map((t, i) => (
              <div className="person" key={i}>
                <span className="avatar" aria-hidden="true">{initials(t.name || t.company)}</span>
                <div>
                  <p className="person-name">{t.name || t.company}</p>
                  <p className="person-role">{[t.role, t.name ? t.company : ''].filter(Boolean).join(', ')}</p>
                  {has(t.bio) && <p className="person-bio">{firstSentence(t.bio)}</p>}
                </div>
              </div>
            ))}
          </div>
        ) : <p><Missing what="Development team" /></p>}
        <p className="small">Full bios are in Exhibit A.</p>
      </section>

      {extra('team')}

      <section>
        <h2>RISKS &amp; MITIGANTS</h2>
        {risks.length ? (
          <ol className="risks">
            {risks.map((r, i) => (
              <li key={i}>
                <strong>{stripDot(r.risk)}.</strong>
                <ol type="a"><li><strong>Mitigant:</strong> {has(r.mitigant) ? r.mitigant : <Missing what="Mitigant" />}</li></ol>
              </li>
            ))}
          </ol>
        ) : autoRisks.length ? (
          <>
            <p className="small">Drafted from the red and yellow items in Underwriter Review. Add a mitigant for each, or enter your own risks on the Deal data page.</p>
            <ol className="risks">
              {autoRisks.map((f, i) => (
                <li key={i}>
                  <strong>{f.area}: {f.title}.</strong> {f.evidence}
                  <ol type="a"><li><strong>Mitigant:</strong> <Missing what="Mitigant" /></li></ol>
                </li>
              ))}
            </ol>
          </>
        ) : <p><Missing what="Risks and mitigants" /></p>}
      </section>

      {extra('risks')}

      <section>
        <h2>RECENT NEWS &amp; PUBLIC INFORMATION</h2>
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

      {extra('news')}

      <section className="flags-section">
        <h2>UNDERWRITER REVIEW: AUTOMATED FLAGS</h2>
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

      {extra('flags')}

      <section>
        <h2>LOAN SIZING &amp; STRUCTURING</h2>
        <p>
          Based on the project underwriting, proposed sources and uses, collateral support, and repayment capacity, {fund} recommends consideration of a <Src r="loanAmount">{money(a.loan)}</Src> loan to {firm}.
          {has(deal.loanSizingParagraph) ? ` ${deal.loanSizingParagraph.trim()}` : sizingPoints.length ? ` ${sizingPoints.join(' ')}` : ''}
          {deal.urgeUses?.length ? ` The facility will support ${deal.urgeUses.map((u) => lower1(u.label)).join('; ')}.` : ''}
        </p>
        <h3 className="sub">Proposed Terms &amp; Payment Schedule</h3>
        <table className="terms">
          <thead><tr><th colSpan={2}>Proposed {fund} Loan Terms</th></tr></thead>
          <tbody>
            <tr><th>Borrower</th><td>{firm}</td></tr>
            <tr><th>Lender</th><td>{fund}</td></tr>
            <tr><th>Sponsors</th><td>{has(deal.sponsors) ? deal.sponsors : principal}</td></tr>
            <tr><th>Loan amount</th><td><Src r="loanAmount">{money(a.loan)}</Src></td></tr>
            <tr><th>Interest rate</th><td>{has(deal.interestRate) ? <Src r="interestRate">{num(deal.interestRate)}% per year</Src> : <Missing what="Rate" />}</td></tr>
            <tr><th>Term</th><td>{has(deal.termMonths) ? <Src r="termMonths">{a.term} months</Src> : <Missing what="Term" />}</td></tr>
            <tr><th>Repayment structure</th><td>{deal.repaymentStructure || <Missing what="Structure" />}</td></tr>
            <tr><th>Interest-only period</th><td>{sch.ioMonths > 0 ? <><Src r={has(deal.interestOnlyMonths) ? 'interestOnlyMonths' : 'termMonths'}>{sch.ioMonths} months</Src>{deal.interestReserve === 'Yes' ? ', supported by interest reserve' : ''}</> : 'None'}</td></tr>
            <tr><th>Amortization</th><td>{sch.amortPayment !== null ? <><Src r={has(deal.amortizationYears) ? 'amortizationYears' : 'termMonths'}>{Math.round(sch.amortYears * 10) / 10} years</Src>{sch.ioMonths > 0 ? ' after interest-only period' : ''}</> : 'None; principal due at maturity'}</td></tr>
            <tr><th>Monthly payment</th><td>
              {sch.monthlyIoPayment !== null ? <><Src c="ioPayment">{money(sch.monthlyIoPayment)}</Src> interest-only{sch.amortPayment !== null ? <>, then <Src c="amortPayment">{money(sch.amortPayment)}</Src> principal and interest from <Src c="amortStart">month {sch.amortStart}</Src></> : ''}</>
                : sch.amortPayment !== null ? <><Src c="amortPayment">{money(sch.amortPayment)}</Src> principal and interest</> : '–'}
            </td></tr>
            <tr><th>Due at maturity</th><td>{sch.amortPayment !== null ? <><Src c="balloon">{money(sch.balloon)}</Src> remaining principal</> : 'All principal'} plus any accrued interest{a.successFee > 0 ? ' and the success fee' : ''}</td></tr>
            <tr><th>Origination fee</th><td>{has(deal.originationFee) ? <><Src r="originationFee">{num(deal.originationFee)}%</Src> (<Src c="fee">{money(a.fee)}</Src>)</> : 'None'}</td></tr>
            <tr><th>Success fee</th><td>{a.successFee > 0 ? <><Src r="successFeePct">{num(deal.successFeePct)}%</Src> (<Src c="successFee">{money(a.successFee)}</Src>) at final payoff / maturity</> : 'None'}</td></tr>
            <tr><th>Primary repayment source</th><td>{has(deal.primaryRepayment) ? deal.primaryRepayment : (deal.repaymentOptions?.[0]?.option || <Missing what="Primary repayment source" />)}</td></tr>
            <tr><th>Secondary repayment source</th><td>{has(deal.secondaryRepayment) ? deal.secondaryRepayment : (deal.repaymentOptions?.[1]?.option || '–')}</td></tr>
            <tr><th>Collateral</th><td>{v(deal.collateral, 'Collateral')}</td></tr>
            <tr><th>Guarantee</th><td>{has(deal.guarantee) ? deal.guarantee : <Missing what="Guarantee" />}</td></tr>
            <tr><th>Use of proceeds</th><td>{deal.urgeUses?.map((u) => u.label).join('; ') || <Missing what="Uses" />}</td></tr>
            <tr><th>Project</th><td>{project}, {v(deal.projectAddress, 'Address')}</td></tr>
          </tbody>
        </table>
        <p>
          At {has(deal.interestRate) ? <Src r="interestRate">{num(deal.interestRate)}%</Src> : 'the stated rate'}, annual interest on <Src r="loanAmount">{money(a.loan)}</Src> is <Src c="annualInterest">{money(a.annualInterest)}</Src> (<Src c="monthlyInterest">{money(a.annualInterest / 12)}</Src> per month).
          Total owed to {fund} over the term is <Src c="totalOwed">{money(a.totalOwed)}</Src> (principal plus interest).
          {a.repaymentCoverage !== null ? <> The borrower’s primary repayment source is expected to produce <Src r="exitProceeds">{money(a.exitProceeds)}</Src>, or <Src c="repaymentCoverage">{a.repaymentCoverage.toFixed(2)}x</Src> coverage.</> : ''}
        </p>
        <h3 className="sub">Sources of Repayment</h3>
        <p>To support principal repayment of the {fund} loan, the following resources are expected to be available:</p>
        {deal.repaymentOptions?.length ? (
          <ol>{deal.repaymentOptions.map((r, i) => <li key={i} data-fact="repay">{r.option}</li>)}</ol>
        ) : <p><Missing what="Repayment options" /></p>}
      </section>

      {extra('sizing')}

      <section>
        <h2>RECOMMENDATION</h2>
        <p>
          This investment request is {a.missionLevel === 'red' ? 'only partly' : 'in'} alignment with the overall mission and goals of the {fund} Fund, namely the growth and scale of underrepresented development firms.
          {' '}The proposed loan will support {project}{has(deal.assetType) ? `, a ${lower1(deal.assetType)}` : ''}, and help {firm} grow its capacity as a developer.
          {' '}The review produced <Src c="newsCount">{reds.length} red and {yellows.length} yellow item{yellows.length === 1 ? '' : 's'}</Src>, listed under Underwriter Review.
        </p>
        <p>
          For these reasons, and subject to completion of the outstanding diligence items identified in this draft memo, it is recommended that this investment proposal be <strong>{decision}</strong>.
        </p>
      </section>

      {extra('recommendation')}

      <section className="approvals">
        <h2>APPROVALS</h2>
        {signers.map((s, i) => (
          <div className="sign" key={i}>
            <div className="sign-line"><span /><span className="sign-date">Date</span></div>
            <p>{has(s.name) ? `${s.name}, ` : ''}{s.title}</p>
          </div>
        ))}
      </section>

      {extra('approvals')}

      <section className="exhibit">
        <h2 className="exhibit-title">Exhibit A: Project Team</h2>
        {deal.team?.length ? deal.team.map((t, i) => (
          <p key={i}><strong>{t.role ? `${t.role}: ` : ''}{t.name}{t.company ? `, ${stripDot(t.company)}` : ''}</strong>. {t.bio}</p>
        )) : <p><Missing what="Team bios" /></p>}
      </section>

      <section className="exhibit">
        <h2 className="exhibit-title">Exhibit B: Anticipated TA Needs</h2>
        <p>{v(deal.taNeeds, 'Technical assistance needs')}</p>
      </section>

      <section className="exhibit">
        <h2 className="exhibit-title">Exhibit C: Loan Information &amp; Metric Sheet</h2>
        <table className="metrics">
          <tbody>
            <tr className="grp"><th colSpan={2}>Loan summary</th></tr>
            <tr><th>Company / project name</th><td>{firm} / {project}</td></tr>
            <tr><th>Fund name</th><td>{fund}</td></tr>
            <tr><th>Project / property address</th><td>{v(deal.projectAddress, 'Address')}</td></tr>
            <tr><th>Total project cost</th><td>{a.projectCost ? <Src c="projectCost">{money(a.projectCost)}</Src> : '–'}</td></tr>
            <tr><th>Loan term</th><td>{has(deal.termMonths) ? `${a.term} months` : '–'}</td></tr>
            <tr className="grp"><th colSpan={2}>Real estate metrics</th></tr>
            <tr><th>Project type</th><td>{typeLabel || '–'}</td></tr>
            <tr><th>Description</th><td>{deal.assetType || '–'}</td></tr>
            <tr><th>New construction / rehab</th><td>{deal.constructionType || '–'}</td></tr>
            <tr><th>Previously vacant / blighted</th><td>{deal.previouslyVacant || '–'}</td></tr>
            <tr><th>Sq. ft. commercial</th><td>{has(deal.commercialSqFt) ? sqft(deal.commercialSqFt) : '–'}</td></tr>
            <tr><th>Sq. ft. total</th><td>{num(deal.squareFeet) ? sqft(deal.squareFeet) : '–'}</td></tr>
            <tr><th>Residential units for rent</th><td>{has(deal.residentialUnits) ? num(deal.residentialUnits) : '–'}</td></tr>
            <tr><th>Affordable units</th><td>{a.affordableCount !== null ? <>{a.affordableCount}{a.affordablePct !== null ? <> (<Src c="affordablePct">{pct(a.affordablePct, 0)}</Src>)</> : ''}{tierText ? `: ${tierText}` : amiText ? ` at ${amiText} AMI` : ''}</> : '–'}</td></tr>
            <tr><th>Who the project serves</th><td>{deal.targetPopulation || '–'}</td></tr>
            <tr className="grp"><th colSpan={2}>Impact metrics</th></tr>
            <tr><th>Jobs, construction</th><td>{has(deal.constructionJobs) ? num(deal.constructionJobs) : '–'}</td></tr>
            <tr><th>Jobs, permanent (new / supported)</th><td>{has(deal.jobsCreated) ? num(deal.jobsCreated) : '–'}</td></tr>
            <tr><th>Development completed (total cost)</th><td>{has(deal.tdcCompleted) ? <Src r="tdcCompleted">{money(deal.tdcCompleted)}</Src> : '–'}</td></tr>
            <tr><th>Units / commercial sq ft / total sq ft completed</th><td>{[deal.unitsCompleted, deal.commercialSqFtCompleted, deal.sqFtCompleted].some(has) ? `${has(deal.unitsCompleted) ? num(deal.unitsCompleted) : '–'} / ${has(deal.commercialSqFtCompleted) ? sqft(deal.commercialSqFtCompleted) : '–'} / ${has(deal.sqFtCompleted) ? sqft(deal.sqFtCompleted) : '–'}` : '–'}</td></tr>
            <tr><th>Borrower stage</th><td>{a.stage || (a.stageSuggested ? `${a.stageSuggested} (suggested)` : '–')}</td></tr>
            <tr><th>In a strategic neighborhood</th><td>{deal.impactArea || '–'}</td></tr>
          </tbody>
        </table>
      </section>

      {extra('end')}

      <footer className="memo-footer">{firm}</footer>
      {/* Printed footer in the page margin: firm name bottom left, page numbers bottom right. */}
      <style>{`@media print { @page { @bottom-left { content: "${cssText(firm)}"; font: 9pt Arial, sans-serif; color: #444; } @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 9pt Arial, sans-serif; color: #444; } } }`}</style>
    </article>
  );
}

// Memoized so the underwriter's direct edits to the text survive until they regenerate.
export default memo(MemoDoc);
