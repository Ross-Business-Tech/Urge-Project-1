const colors = ['#aa3bff', '#1f8a4c', '#c27a00', '#2563eb', '#b3261e']

// Simple pie chart from [{label, value}]
export function Pie({ title, data }) {
  const total = data.reduce((a, d) => a + d.value, 0)
  if (!total) return null
  let angle = -Math.PI / 2
  const arcs = data.map((d, i) => {
    const a = (d.value / total) * Math.PI * 2
    const [x1, y1] = [50 + 40 * Math.cos(angle), 50 + 40 * Math.sin(angle)]
    angle += a
    const [x2, y2] = [50 + 40 * Math.cos(angle), 50 + 40 * Math.sin(angle)]
    return (
      <path key={d.label} d={`M50 50 L${x1} ${y1} A40 40 0 ${a > Math.PI ? 1 : 0} 1 ${x2} ${y2} Z`} fill={colors[i % colors.length]} />
    )
  })
  return (
    <figure className="chart">
      <figcaption>{title}</figcaption>
      <svg viewBox="0 0 100 100" role="img" aria-label={title}>
        {data.length === 1 ? <circle cx="50" cy="50" r="40" fill={colors[0]} /> : arcs}
      </svg>
      <ul>
        {data.map((d, i) => (
          <li key={d.label}>
            <i style={{ background: colors[i % colors.length] }} /> {d.label}: {Math.round((d.value / total) * 100)}%
          </li>
        ))}
      </ul>
    </figure>
  )
}

// Horizontal bars from [{label, value}] with $ labels
export function Bars({ title, data }) {
  const max = Math.max(...data.map((d) => d.value), 0)
  if (!max) return null
  return (
    <figure className="chart">
      <figcaption>{title}</figcaption>
      {data.map((d, i) => (
        <div className="bar-row" key={d.label}>
          <span>{d.label}</span>
          <div className="bar">
            <div style={{ width: `${(d.value / max) * 100}%`, background: colors[i % colors.length] }} />
          </div>
          <b>${d.value.toLocaleString('en-US')}</b>
        </div>
      ))}
    </figure>
  )
}
