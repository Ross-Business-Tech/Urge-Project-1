import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const ICON = { typed: '⌨️', file: '📄', sample: '🧪', calc: '🧮', news: '📰' };

// The little card that opens when you tap a number in Viewing mode.
export default function SourceCard({ info, shown, edited, original, anchor, onClose, onGoTo }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  // Next to the number on wide screens; as a bottom sheet on phones (CSS handles that).
  useLayoutEffect(() => {
    if (!anchor || !ref.current || window.innerWidth <= 640) return setPos(null);
    const card = ref.current.getBoundingClientRect();
    const gap = 8;
    let top = anchor.bottom + gap;
    if (top + card.height > window.innerHeight - 8) top = Math.max(8, anchor.top - card.height - gap);
    const left = Math.min(Math.max(8, anchor.left), window.innerWidth - card.width - 8);
    setPos({ top, left });
  }, [anchor, info]);

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    const onScroll = () => window.innerWidth > 640 && onClose();
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll);
    };
  }, [onClose]);

  return (
    <>
      <div className="src-backdrop no-print" onClick={onClose} />
      <div
        ref={ref}
        className="src-card no-print"
        role="dialog"
        aria-modal="true"
        aria-label={`Source for ${info.title}`}
        tabIndex={-1}
        style={pos ? { top: pos.top, left: pos.left } : undefined}
      >
        <button type="button" className="src-close" aria-label="Close" onClick={onClose}>×</button>
        <p className="src-eyebrow">Where this came from</p>
        <p className="src-value">{shown}</p>
        <p className="src-title">{info.title}</p>

        <div className={`src-where src-${info.where.kind}`}>
          <span aria-hidden="true">{ICON[info.where.kind] || '📌'}</span>
          <span>{info.where.text}</span>
        </div>

        {info.kind === 'news' && (
          <div className="src-news">
            {info.sourceName && <p><strong>{info.sourceName}</strong></p>}
            {info.note && <p>{info.note}</p>}
            {info.link
              ? <a className="btn ghost" href={info.link} target="_blank" rel="noopener noreferrer">Open the article ↗</a>
              : <p className="small">No link saved for this item.</p>}
          </div>
        )}

        {info.formula && <p className="src-formula">{info.formula}</p>}

        {info.inputs?.length > 0 && (
          <>
            <p className="src-sub">Numbers used</p>
            <ul className="src-inputs">
              {info.inputs.map((x, i) => (
                <li key={i}>
                  <button type="button" className="src-input" onClick={() => onGoTo(x.focus)}>
                    <span><strong>{x.label}</strong>: {x.value}</span>
                    <small>{ICON[x.where.kind]} {x.where.text}</small>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {edited && (
          <p className="src-edited">✏️ This was changed by hand in Editing mode. The original was <strong>{original}</strong>.</p>
        )}

        {info.focus && info.kind !== 'calc' && (
          <button type="button" className="btn src-go" onClick={() => onGoTo(info.focus)}>Go to this in Deal data →</button>
        )}
      </div>
    </>
  );
}
