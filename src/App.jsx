import { useEffect, useMemo, useRef, useState } from 'react'
import { draftWithAI } from './ai.js'
import {
  NEEDS_INPUT,
  computeMetrics,
  factSheet,
  missingFields,
  money,
  riskIndicators,
  templateNarrative,
} from './memo.js'
import { EMPTY, SAMPLE } from './sample.js'
import './App.css'

const STORE_KEY = 'urge-memo-draft-v1'

function loadSaved() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null')
    return s ? { ...EMPTY, ...s } : EMPTY
  } catch {
    return EMPTY
  }
}

const STATUS_TEXT = { green: 'On track', amber: 'Watch', red: 'Off', missing: 'Missing' }

function Field({ label, name, form, set, hint, type = 'text', textarea, required, inputMode, prefix, suffix, children }) {
  const empty = required && !String(form[name] ?? '').trim()
  return (
    <label className={`field ${textarea ? 'wide' : ''}`}>
      <span className="label">
        {label}
        {required && <span className="req" aria-label="required"> *</span>}
      </span>
      {children ? (
        children
      ) : textarea ? (
        <textarea name={name} rows={3} value={form[name]} onChange={(e) => set(name, e.target.value)} />
      ) : (
        <span className="affix">
          {prefix && <span className="pre">{prefix}</span>}
          <input
            name={name}
            type={type}
            inputMode={inputMode}
            value={form[name]}
            onChange={(e) => set(name, e.target.value)}
            className={empty ? 'is-empty' : ''}
          />
          {suffix && <span className="suf">{suffix}</span>}
        </span>
      )}
      {hint && <span className="hint">{hint}</span>}
    </label>
  )
}

function Section({ n, title, note, children }) {
  return (
    <fieldset className="card">
      <legend>
        <span className="step">{n}</span> {title}
      </legend>
      {note && <p className="note">{note}</p>}
      <div className="grid">{children}</div>
    </fieldset>
  )
}

function IntakeForm({ form, set, onGenerate, onSample, onClear, missingCount }) {
  const money$ = { inputMode: 'decimal', prefix: '$' }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onGenerate()
      }}
    >
      <div className="toolbar">
        <button type="button" className="ghost" onClick={onSample}>
          Load sample deal
        </button>
        <button type="button" className="ghost" onClick={onClear}>
          Clear form
        </button>
      </div>

      <Section n="1" title="The deal">
        <Field label="Borrowing company" name="companyName" form={form} set={set} required />
        <Field label="Sponsor / principal" name="sponsorName" form={form} set={set} required />
        <Field label="Property address" name="propertyAddress" form={form} set={set} required />
        <Field label="Property type" name="propertyType" form={form} set={set} required>
          <select value={form.propertyType} onChange={(e) => set('propertyType', e.target.value)}>
            <option value="">Choose…</option>
            <option>Commercial</option>
            <option>Mixed-use (commercial + residential)</option>
            <option>Residential only</option>
          </select>
        </Field>
        <Field label="Structure" name="structure" form={form} set={set}>
          <select value={form.structure} onChange={(e) => set('structure', e.target.value)}>
            <option>Loan</option>
            <option>Loan with equity option</option>
            <option>Equity</option>
          </select>
        </Field>
        <Field label="Loan amount requested" name="loanAmount" form={form} set={set} required {...money$} />
        <Field label="Interest rate" name="interestRate" form={form} set={set} required inputMode="decimal" suffix="%" />
        <Field label="Term" name="termMonths" form={form} set={set} required inputMode="numeric" suffix="months" />
        <Field label="Repayment" name="repayment" form={form} set={set}>
          <select value={form.repayment} onChange={(e) => set('repayment', e.target.value)}>
            <option value="interest-only">Interest-only</option>
            <option value="amortizing">Amortizing</option>
          </select>
        </Field>
        {form.repayment === 'amortizing' && (
          <Field label="Amortization period" name="amortYears" form={form} set={set} required inputMode="numeric" suffix="years" />
        )}
        <Field label="Use of funds" name="useOfFunds" form={form} set={set} textarea required />
      </Section>

      <Section n="2" title="Financials" note="From the balance sheet and underwriting spreadsheet. The app does all the math.">
        <Field label="Property value (as-is or appraised)" name="propertyValue" form={form} set={set} required {...money$} />
        <Field label="Total project cost" name="projectCost" form={form} set={set} required {...money$} />
        <Field label="Net operating income (annual)" name="noi" form={form} set={set} required {...money$} />
        <Field label="Sponsor equity contribution" name="sponsorEquity" form={form} set={set} required {...money$} />
        <Field label="Sponsor liquid cash" name="liquidity" form={form} set={set} required {...money$} />
      </Section>

      <Section n="3" title="Borrower profile" note="Written in your words. The memo will not change it.">
        <Field label="Completed comparable projects" name="projectsCompleted" form={form} set={set} required inputMode="numeric" />
        <Field label="Borrower bio" name="borrowerBio" form={form} set={set} textarea required />
      </Section>

      <Section n="4" title="Terms & conditions">
        <Field label="Collateral" name="collateral" form={form} set={set} textarea required />
        <Field label="Guarantees" name="guarantees" form={form} set={set} textarea required />
        <Field label="Covenants & other conditions" name="covenants" form={form} set={set} textarea />
      </Section>

      <Section n="5" title="Notes & research" note="One point per line. Used as-is; the memo never adds facts that aren't here.">
        <Field label="Meeting notes" name="meetingNotes" form={form} set={set} textarea />
        <Field label="Underwriting notes" name="underwritingNotes" form={form} set={set} textarea />
        <Field label="Market research & news" name="marketResearch" form={form} set={set} textarea />
        <Field label="Strengths you see" name="strengths" form={form} set={set} textarea />
        <Field label="Concerns you see" name="concerns" form={form} set={set} textarea />
      </Section>

      <div className="generate">
        <p className="muted">
          {missingCount
            ? `${missingCount} required item${missingCount > 1 ? 's' : ''} still empty. You can still draft; they'll be flagged in the memo.`
            : 'All required items filled in.'}
        </p>
        <button type="submit" className="primary">
          Draft investment memo
        </button>
      </div>
    </form>
  )
}

function Editable({ as: Tag = 'p', children, className }) {
  return (
    <Tag className={`editable ${className || ''}`} contentEditable suppressContentEditableWarning>
      {children}
    </Tag>
  )
}

function Flagged({ text }) {
  // Highlight [NEEDS INPUT...] and [Reviewer ...] markers so they can't be missed.
  const parts = String(text).split(/(\[[^\]]*\]|NEEDS INPUT)/g)
  return parts.map((p, i) =>
    /^\[.*\]$|^NEEDS INPUT$/.test(p) ? (
      <mark key={i} className="flag">
        {p}
      </mark>
    ) : (
      p
    ),
  )
}

function Memo({ form, metrics, indicators, missing, narrative, source, onBack, onRedraft, busy }) {
  const ref = useRef(null)
  const [copied, setCopied] = useState(false)
  const [today] = useState(() => new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }))
  const val = (v) => (String(v ?? '').trim() ? v : NEEDS_INPUT)
  const deal = [
    ['Borrowing company', val(form.companyName)],
    ['Sponsor / principal', val(form.sponsorName)],
    ['Property', `${val(form.propertyAddress)} · ${val(form.propertyType)}`],
    ['Structure', form.structure],
    ['Loan amount', money(metrics.loan)],
    ['Interest rate', metrics.rate === null ? NEEDS_INPUT : `${metrics.rate}%`],
    ['Term', metrics.term === null ? NEEDS_INPUT : `${metrics.term} months`],
    ['Repayment', form.repayment === 'amortizing' ? `Amortizing, ${val(form.amortYears)} years` : 'Interest-only'],
    ['Annual debt service', money(metrics.ads)],
    ['Interest income over term', money(metrics.interestOverTerm)],
    ['Property value', money(metrics.value)],
    ['Total project cost', money(metrics.cost)],
    ['Net operating income', money(metrics.noi)],
    ['Sponsor equity', money(metrics.equity)],
    ['Sponsor liquid cash', money(metrics.liquidity)],
  ]

  async function copy() {
    try {
      await navigator.clipboard.writeText(ref.current.innerText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div>
      <div className="toolbar no-print">
        <button type="button" className="ghost" onClick={onBack}>
          ← Edit inputs
        </button>
        <button type="button" className="ghost" onClick={onRedraft} disabled={busy}>
          {busy ? 'Drafting…' : 'Redraft'}
        </button>
        <button type="button" className="ghost" onClick={copy}>
          {copied ? 'Copied ✓' : 'Copy text'}
        </button>
        <button type="button" className="ghost" onClick={() => window.print()}>
          Print / PDF
        </button>
      </div>

      <div className={`banner no-print ${source === 'ai' ? 'ok' : 'info'}`} role="status">
        {source === 'ai'
          ? 'Drafted with AI from your inputs. Numbers and your own words come straight from the form.'
          : "AI drafting isn't connected on this link, so this is a template draft built from your inputs. On the team site it will be written by AI."}{' '}
        Tap any paragraph to edit it.
      </div>

      <article className="memo" ref={ref}>
        <header className="memo-head">
          <p className="draft-tag">Draft · for reviewer sign-off</p>
          <h2>Investment Memo: {val(form.companyName)}</h2>
          <dl className="meta">
            <div>
              <dt>To</dt>
              <dd>URGE Investment Committee</dd>
            </div>
            <div>
              <dt>Date</dt>
              <dd>{today}</dd>
            </div>
            <div>
              <dt>Request</dt>
              <dd>
                {money(metrics.loan)} · {form.structure}
              </dd>
            </div>
          </dl>
        </header>

        <section>
          <h3>1. Executive summary</h3>
          <Editable>
            <Flagged text={narrative.executiveSummary} />
          </Editable>
        </section>

        <section>
          <h3>2. Transaction overview</h3>
          <table className="kv">
            <tbody>
              {deal.map(([k, v]) => (
                <tr key={k}>
                  <th scope="row">{k}</th>
                  <td>
                    <Flagged text={v} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="sub">Use of funds (as provided)</p>
          <p className="verbatim">
            <Flagged text={val(form.useOfFunds)} />
          </p>
        </section>

        <section>
          <h3>3. Risk indicators</h3>
          <ul className="indicators">
            {indicators.map((i) => (
              <li key={i.key} className={`ind ${i.status}`}>
                <span className="dot" aria-hidden="true" />
                <span className="ind-main">
                  <strong>{i.label}</strong>
                  <span className="ind-val">
                    <Flagged text={i.value} />
                  </span>
                  <span className="ind-rule">{i.rule}</span>
                </span>
                <span className="pill">{STATUS_TEXT[i.status]}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3>4. Borrower profile (as provided)</h3>
          <p className="verbatim">
            <Flagged text={val(form.borrowerBio)} />
          </p>
          <p className="verbatim">Completed comparable projects: {val(form.projectsCompleted)}</p>
          {form.meetingNotes && (
            <>
              <p className="sub">Meeting notes</p>
              <p className="verbatim">{form.meetingNotes}</p>
            </>
          )}
          {form.underwritingNotes && (
            <>
              <p className="sub">Underwriting notes</p>
              <p className="verbatim">{form.underwritingNotes}</p>
            </>
          )}
        </section>

        <section>
          <h3>5. Property & market</h3>
          <Editable>
            <Flagged text={narrative.marketContext} />
          </Editable>
        </section>

        <section>
          <h3>6. Strengths</h3>
          {narrative.strengths.length ? (
            <ul className="bullets">
              {narrative.strengths.map((s, i) => (
                <Editable as="li" key={i}>
                  <Flagged text={s} />
                </Editable>
              ))}
            </ul>
          ) : (
            <p>
              <mark className="flag">[Reviewer to add strengths]</mark>
            </p>
          )}
        </section>

        <section>
          <h3>7. Risks & mitigants</h3>
          {narrative.risks.length ? (
            <ul className="risks">
              {narrative.risks.map((r, i) => (
                <li key={i}>
                  <Editable className="risk">
                    <Flagged text={r.risk} />
                  </Editable>
                  <Editable className="mitigant">
                    <Flagged text={r.mitigant || '[Reviewer to add mitigant]'} />
                  </Editable>
                </li>
              ))}
            </ul>
          ) : (
            <p>No risks identified from the inputs. Reviewer should confirm.</p>
          )}
        </section>

        <section>
          <h3>8. Terms & conditions (as provided)</h3>
          <table className="kv">
            <tbody>
              <tr>
                <th scope="row">Collateral</th>
                <td>
                  <Flagged text={val(form.collateral)} />
                </td>
              </tr>
              <tr>
                <th scope="row">Guarantees</th>
                <td>
                  <Flagged text={val(form.guarantees)} />
                </td>
              </tr>
              <tr>
                <th scope="row">Covenants</th>
                <td>{form.covenants || '—'}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <h3>9. Open items & follow-up questions</h3>
          {missing.length > 0 && (
            <p className="missing">
              <strong>Missing from intake:</strong> {missing.join(', ')}.
            </p>
          )}
          {narrative.followUpQuestions.length ? (
            <ul className="bullets">
              {narrative.followUpQuestions.map((q, i) => (
                <Editable as="li" key={i}>
                  <Flagged text={q} />
                </Editable>
              ))}
            </ul>
          ) : (
            <p>None.</p>
          )}
        </section>

        <section>
          <h3>10. Suggested recommendation</h3>
          <Editable className="rec">
            <Flagged text={narrative.recommendation} />
          </Editable>
          <p className="signoff">Reviewed by: ____________________ Date: __________</p>
        </section>
      </article>
    </div>
  )
}

export default function App() {
  const [form, setForm] = useState(loadSaved)
  const [view, setView] = useState('form')
  const [narrative, setNarrative] = useState(null)
  const [source, setSource] = useState('template')
  const [busy, setBusy] = useState(false)
  const [draftId, setDraftId] = useState(0)

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(form))
    } catch {
      /* storage unavailable: fine, nothing to remember */
    }
  }, [form])

  const metrics = useMemo(() => computeMetrics(form), [form])
  const indicators = useMemo(() => riskIndicators(metrics, form), [metrics, form])
  const missing = useMemo(() => missingFields(form), [form])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  async function generate() {
    setBusy(true)
    setView('memo')
    window.scrollTo(0, 0)
    const fallback = templateNarrative(form, metrics, indicators, missing)
    setNarrative((n) => n || fallback)
    try {
      const ai = await draftWithAI(factSheet(form, metrics, indicators))
      setNarrative({
        ...fallback,
        ...Object.fromEntries(Object.entries(ai).filter(([, v]) => (Array.isArray(v) ? v.length : v))),
      })
      setSource('ai')
      setDraftId((d) => d + 1)
    } catch {
      setNarrative(fallback)
      setSource('template')
      setDraftId((d) => d + 1)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <header className="top no-print">
        <div className="brand">
          <span className="logo" aria-hidden="true">
            U
          </span>
          <div>
            <h1>URGE Memo Builder</h1>
            <p>Turn a deal intake form into a draft investment memo for the Investment Committee.</p>
          </div>
        </div>
      </header>

      <main>
        {view === 'form' ? (
          <IntakeForm
            form={form}
            set={set}
            onGenerate={generate}
            onSample={() => setForm(SAMPLE)}
            onClear={() => setForm(EMPTY)}
            missingCount={missing.length}
          />
        ) : (
          narrative && (
            <Memo
              key={draftId}
              form={form}
              metrics={metrics}
              indicators={indicators}
              missing={missing}
              narrative={narrative}
              source={source}
              busy={busy}
              onBack={() => setView('form')}
              onRedraft={generate}
            />
          )
        )}
      </main>

      <footer className="foot no-print">
        Sample data only. Every memo is a draft and must be checked by a reviewer before it goes to committee.
      </footer>
    </div>
  )
}
