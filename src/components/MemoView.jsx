import { useState } from 'react'
import { Bars, Pie } from './Charts.jsx'
import { parseSourcesUses } from '../lib/charts.js'

const labels = { green: 'Green', yellow: 'Yellow', red: 'Red' }

function Section({ s, deal, canAi, onEdit, onRegenerate }) {
  const [editing, setEditing] = useState(false)
  const [ask, setAsk] = useState('')
  const [busy, setBusy] = useState(false)
  const su = s.id === 'sources' ? parseSourcesUses(deal.sourcesUses) : null

  const regen = async () => {
    setBusy(true)
    await onRegenerate(s, ask)
    setBusy(false)
  }

  return (
    <section className="memo-section">
      <h3>
        {s.title}
        {s.rating && labels[s.rating] && <span className={`badge ${s.rating}`}>{labels[s.rating]}</span>}
      </h3>
      {editing ? (
        <textarea className="edit" rows={8} value={s.body} onChange={(e) => onEdit(s.id, { body: e.target.value })} />
      ) : (
        <p>{s.body}</p>
      )}
      {su && (su.sources.length > 0 || su.uses.length > 0) && (
        <div className="charts">
          <Pie title="Sources" data={su.sources} />
          <Pie title="Uses" data={su.uses} />
        </div>
      )}
      {s.id === 'sizing' && s.repayment?.length > 0 && <Bars title="Repayment sources ($)" data={s.repayment} />}
      <div className="actions">
        <button type="button" className="link" onClick={() => setEditing(!editing)}>
          {editing ? 'Done editing' : 'Edit'}
        </button>
        {editing && (
          <select value={s.rating || 'none'} onChange={(e) => onEdit(s.id, { rating: e.target.value === 'none' ? null : e.target.value })}>
            <option value="none">No rating</option>
            <option value="green">Green</option>
            <option value="yellow">Yellow</option>
            <option value="red">Red</option>
          </select>
        )}
      </div>
      {canAi && (
        <div className="regen">
          <input placeholder="Tell the AI what to change (optional)" value={ask} onChange={(e) => setAsk(e.target.value)} />
          <button type="button" className="secondary" disabled={busy} onClick={regen}>
            {busy ? 'Rewriting…' : 'Rewrite this section'}
          </button>
        </div>
      )}
    </section>
  )
}

export default function MemoView({ sections, deal, canAi, hasMemo, onEdit, onRegenerate, gaps, challenges, issues }) {
  const [filter, setFilter] = useState('all')
  const shown = sections.filter((s) => filter === 'all' || s.rating === filter)

  return (
    <div className="memo">
      <div className="filters" role="group" aria-label="Filter sections by rating">
        {['all', 'green', 'yellow', 'red'].map((f) => (
          <button key={f} type="button" className={filter === f ? 'chip active' : 'chip'} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All sections' : labels[f]}
          </button>
        ))}
      </div>

      {hasMemo && (
        <details className="checks" open={issues.length > 0}>
          <summary>
            Numbers check: {issues.length === 0 ? 'all figures match your inputs' : `${issues.length} figure${issues.length === 1 ? '' : 's'} to verify`}
          </summary>
          {issues.length > 0 && (
            <ul>
              {issues.map((i, k) => (
                <li key={k}>
                  <b>{i.value}</b> in {i.section} is not in your form or files.
                </li>
              ))}
            </ul>
          )}
        </details>
      )}
      {gaps?.length > 0 && (
        <details className="checks">
          <summary>Missing information ({gaps.length})</summary>
          <ul>{gaps.map((g, k) => <li key={k}>{g}</li>)}</ul>
        </details>
      )}
      {challenges?.length > 0 && (
        <details className="checks">
          <summary>Questions to challenge the borrower ({challenges.length})</summary>
          <ul>{challenges.map((g, k) => <li key={k}>{g}</li>)}</ul>
        </details>
      )}

      {shown.map((s) => (
        <Section key={s.id} s={s} deal={deal} canAi={canAi} onEdit={onEdit} onRegenerate={onRegenerate} />
      ))}
      {shown.length === 0 && <p className="hint">No sections with this rating.</p>}
    </div>
  )
}
