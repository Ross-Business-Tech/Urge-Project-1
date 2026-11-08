import { useState } from 'react'

const labels = { green: 'Green', yellow: 'Yellow', red: 'Red' }

export default function MemoView({ sections }) {
  const [filter, setFilter] = useState('all')
  const shown = sections.filter((s) => filter === 'all' || s.rating === filter)

  return (
    <div className="memo">
      <div className="filters" role="group" aria-label="Filter sections by rating">
        {['all', 'green', 'yellow', 'red'].map((f) => (
          <button
            key={f}
            type="button"
            className={filter === f ? 'chip active' : 'chip'}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All sections' : labels[f]}
          </button>
        ))}
      </div>
      {shown.map((s) => (
        <section key={s.id} className="memo-section">
          <h3>
            {s.title}
            {s.rating && <span className={`badge ${s.rating}`}>{labels[s.rating]}</span>}
          </h3>
          <p>{s.body}</p>
        </section>
      ))}
      {shown.length === 0 && <p className="hint">No sections with this rating.</p>}
    </div>
  )
}
