import { moneyShort } from '../lib/format.js';

// Horizontal bar comparison. bars: [{label, value, tone}]
export function BarCompare({ title, bars, note }) {
  const max = Math.max(...bars.map((b) => b.value), 1);
  const rowH = 34;
  const w = 560;
  const labelW = 190;
  const h = bars.length * rowH + 8;
  return (
    <figure className="chart">
      <figcaption>{title}</figcaption>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={title} preserveAspectRatio="xMinYMin meet">
        {bars.map((b, i) => {
          const bw = Math.max(((w - labelW - 70) * b.value) / max, 2);
          const y = i * rowH + 4;
          return (
            <g key={b.label}>
              <text x={0} y={y + 18} className="chart-label">{b.label}</text>
              <rect x={labelW} y={y + 4} width={bw} height={20} rx={3} className={`bar bar-${b.tone || 'a'}`} />
              <text x={labelW + bw + 6} y={y + 19} className="chart-value">{moneyShort(b.value)}</text>
            </g>
          );
        })}
      </svg>
      {note && <p className="chart-note">{note}</p>}
    </figure>
  );
}

// Single stacked bar showing shares of a whole. parts: [{label, value}]
export function StackedShare({ title, parts }) {
  const total = parts.reduce((t, p) => t + p.value, 0) || 1;
  const offsets = parts.map((_, i) => parts.slice(0, i).reduce((t, p) => t + (560 * p.value) / total, 0));
  const tones = ['a', 'b', 'c', 'd', 'e', 'f'];
  return (
    <figure className="chart">
      <figcaption>{title}</figcaption>
      <svg viewBox="0 0 560 30" role="img" aria-label={title} preserveAspectRatio="none" className="stack">
        {parts.map((p, i) => {
          const w = (560 * p.value) / total;
          return <rect key={p.label} x={offsets[i]} y={0} width={Math.max(w - 1.5, 0)} height={30} className={`bar bar-${tones[i % tones.length]}`} />;
        })}
      </svg>
      <ul className="legend">
        {parts.map((p, i) => (
          <li key={p.label}>
            <span className={`swatch bar-${tones[i % tones.length]}`} />
            {p.label}: <strong>{moneyShort(p.value)}</strong> ({((p.value / total) * 100).toFixed(0)}%)
          </li>
        ))}
      </ul>
    </figure>
  );
}

// Column chart of a time series. points: [{label, value, muted}]
export function Columns({ title, points, note }) {
  const w = 560, h = 190, pad = 26;
  const max = Math.max(...points.map((p) => Math.abs(p.value)), 1);
  const colW = (w - pad * 2) / Math.max(points.length, 1);
  return (
    <figure className="chart">
      <figcaption>{title}</figcaption>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={title}>
        <line x1={pad} x2={w - pad} y1={h - pad} y2={h - pad} className="axis" />
        {points.map((p, i) => {
          const bh = ((h - pad * 2 - 14) * Math.max(p.value, 0)) / max;
          const x = pad + i * colW + colW * 0.18;
          const bw = colW * 0.64;
          return (
            <g key={p.label + i}>
              <rect x={x} y={h - pad - bh} width={bw} height={bh} rx={3} className={`bar ${p.muted ? 'bar-muted' : 'bar-a'}`} />
              <text x={x + bw / 2} y={h - pad - bh - 5} textAnchor="middle" className="chart-value">{moneyShort(p.value)}</text>
              <text x={x + bw / 2} y={h - 8} textAnchor="middle" className="chart-label">{p.label}</text>
            </g>
          );
        })}
      </svg>
      {note && <p className="chart-note">{note}</p>}
    </figure>
  );
}
