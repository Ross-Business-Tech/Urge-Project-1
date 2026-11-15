import { useRef, useState } from 'react';
import { ACCEPT, MAX_FILES, readDocument, newBudget } from '../lib/docReader.js';
import { extractDeal } from '../lib/docExtract.js';
import { FIELDS } from '../lib/sources.js';
import { TABLES } from '../lib/csv.js';
import { money } from '../lib/format.js';

const MONEY = new Set(['loanAmount', 'totalProjectCost', 'totalAssets', 'totalLiabilities', 'totalEquity', 'cash', 'exitProceeds']);
const PCT = new Set(['interestRate', 'originationFee', 'ownerSharePct']);
const ICON = { pdf: '📕', word: '📘', excel: '📗', text: '📄', image: '🖼️' };

const label = (k) => FIELDS[k]?.[0] || k;
const size = (b) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);

function show(key, value) {
  if (Array.isArray(value)) {
    if (!value.length) return '';
    const cols = TABLES[key] || [];
    return value.map((r) => cols.map((c) => (['amount', 'revenue', 'netIncome'].includes(c) && r[c] ? money(r[c]) : r[c])).filter(Boolean).join(' · ')).join('\n');
  }
  if (value === '' || value === undefined || value === null) return '';
  if (MONEY.has(key)) return money(value);
  if (PCT.has(key)) return `${value}%`;
  return String(value);
}
const same = (a, b) => JSON.stringify(a ?? '') === JSON.stringify(b ?? '');

// "Scan documents with AI": add many files, the AI reads them, you review what it found,
// then the chosen values go into the Deal data form.
export default function DocScan({ deal, onApply }) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState([]); // { id, file, status: reading|ready|error, doc, error }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // { summary, found, conflicts }
  const [picked, setPicked] = useState({});
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);
  const budget = useRef(newBudget());

  const add = async (list) => {
    setError('');
    setResult(null);
    const room = MAX_FILES - files.length;
    const incoming = [...list].slice(0, Math.max(0, room));
    if (list.length > incoming.length) setError(`Up to ${MAX_FILES} files at a time. Scan the rest in a second batch.`);
    const added = incoming.map((file) => ({ id: `${file.name}-${file.size}-${Math.random()}`, file, status: 'reading' }));
    setFiles((f) => [...f, ...added]);
    for (const item of added) {
      let update;
      try {
        update = { status: 'ready', doc: await readDocument(item.file, budget.current) };
      } catch (e) {
        update = { status: 'error', error: e.message || 'Couldn’t read this file.' };
      }
      setFiles((f) => f.map((x) => (x.id === item.id ? { ...x, ...update } : x)));
    }
  };

  const remove = (id) => {
    setFiles((f) => {
      const gone = f.find((x) => x.id === id);
      if (gone?.doc?.images?.length) budget.current.images += gone.doc.images.length;
      return f.filter((x) => x.id !== id);
    });
    setResult(null);
  };

  const reset = () => {
    setFiles([]);
    setResult(null);
    setError('');
    budget.current = newBudget();
  };

  const ready = files.filter((f) => f.status === 'ready');
  const reading = files.some((f) => f.status === 'reading');

  const scan = async () => {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      // Two files with the same name would confuse the quotes, so number repeats.
      const seen = {};
      const docs = ready.map((f) => {
        seen[f.file.name] = (seen[f.file.name] || 0) + 1;
        const name = seen[f.file.name] > 1 ? `${f.file.name} (${seen[f.file.name]})` : f.file.name;
        return { name, text: f.doc.text, images: f.doc.images };
      });
      const r = await extractDeal(docs);
      if (!r.found.length) {
        setError('The AI didn’t find any deal details in these files. Try adding the loan application, term sheet or budget.');
        return;
      }
      setResult(r);
      // Pre-tick everything that is new or different from what's already in the form.
      setPicked(Object.fromEntries(r.found.map((x) => [x.key, !same(x.value, deal[x.key])])));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    const chosen = result.found.filter((x) => picked[x.key]);
    if (!chosen.length) return;
    onApply(
      Object.fromEntries(chosen.map((x) => [x.key, x.value])),
      Object.fromEntries(chosen.map((x) => [x.key, { file: x.file, quote: x.quote }])),
    );
    setResult(null);
    setOpen(false);
    reset();
  };

  const count = result ? result.found.filter((x) => picked[x.key]).length : 0;

  if (!open) {
    return (
      <button className="btn" onClick={() => setOpen(true)}>Scan documents with AI</button>
    );
  }

  return (
    <div className="scan">
      <div className="scan-head">
        <h2>Scan documents with AI</h2>
        <button type="button" className="icon-btn" aria-label="Close" onClick={() => { setOpen(false); reset(); }}>×</button>
      </div>
      <p className="small">
        Add the borrower’s files: loan application, term sheet, budget, pro forma, financial statements, bios. Add as many as you have.
        The AI reads them all and suggests values for the Deal data form. You review every value, with a quote from the file, before anything is filled in.
      </p>

      <div
        className={`drop${drag ? ' over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
      >
        <strong>Drop files here or tap to choose</strong>
        <span>PDF, Word, Excel, CSV, text, or photos of paper documents · up to {MAX_FILES} files</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        hidden
        onChange={(e) => { add(e.target.files); e.target.value = ''; }}
      />

      {files.length > 0 && (
        <ul className="scan-files">
          {files.map((f) => (
            <li key={f.id} className={f.status}>
              <span aria-hidden="true">{f.status === 'error' ? '⚠️' : ICON[f.doc?.kind] || '⏳'}</span>
              <div>
                <strong>{f.file.name}</strong>
                <small>
                  {size(f.file.size)}
                  {f.status === 'reading' && ' · reading…'}
                  {f.status === 'ready' && f.doc.pages ? ` · ${f.doc.pages} page${f.doc.pages > 1 ? 's' : ''}` : ''}
                  {f.status === 'ready' && f.doc.sheets ? ` · ${f.doc.sheets} sheet${f.doc.sheets > 1 ? 's' : ''}` : ''}
                  {f.status === 'ready' && f.doc.notes?.length ? ` · ${f.doc.notes.join('; ')}` : ''}
                  {f.status === 'error' && ` · ${f.error}`}
                </small>
              </div>
              <button type="button" className="icon-btn" aria-label={`Remove ${f.file.name}`} onClick={() => remove(f.id)}>×</button>
            </li>
          ))}
        </ul>
      )}

      <p className="small scan-privacy">Use made-up documents only. The files are sent to an AI service to be read.</p>

      <div className="actions">
        <button type="button" className="btn" onClick={scan} disabled={busy || reading || !ready.length}>
          {busy ? 'AI is reading the documents… (up to a minute)' : `Read ${ready.length || ''} file${ready.length === 1 ? '' : 's'} with AI`}
        </button>
        {files.length > 0 && !busy && <button type="button" className="btn text" onClick={reset}>Remove all</button>}
      </div>

      {error && <p className="news-error" role="alert">{error}</p>}

      {result && (
        <div className="scan-review">
          <h3>Check what the AI found</h3>
          {result.summary && <p className="news-summary">{result.summary}</p>}
          {result.conflicts.length > 0 && (
            <div className="scan-conflicts">
              <strong>⚠️ The documents disagree</strong>
              <ul>{result.conflicts.map((c, i) => <li key={i}>{c.field && FIELDS[c.field] ? <b>{label(c.field)}: </b> : null}{c.note}</li>)}</ul>
            </div>
          )}
          <div className="actions">
            <button type="button" className="link-btn" onClick={() => setPicked(Object.fromEntries(result.found.map((x) => [x.key, true])))}>Tick all</button>
            <button type="button" className="link-btn" onClick={() => setPicked({})}>Untick all</button>
          </div>
          <ul className="scan-list">
            {result.found.map((x) => {
              const now = show(x.key, deal[x.key]);
              const unchanged = same(x.value, deal[x.key]);
              return (
                <li key={x.key}>
                  <label>
                    <input type="checkbox" checked={!!picked[x.key]} onChange={(e) => setPicked((p) => ({ ...p, [x.key]: e.target.checked }))} />
                    <div>
                      <span className="scan-label">{label(x.key)}</span>
                      <span className="scan-value">{show(x.key, x.value)}</span>
                      {unchanged
                        ? <small className="scan-now">Already in the form</small>
                        : now && <small className="scan-now">Replaces: {now.length > 140 ? now.slice(0, 140) + '…' : now}</small>}
                      {(x.file || x.quote) && (
                        <small className="scan-quote">📑 {x.file}{x.quote ? `: “${x.quote}”` : ''}</small>
                      )}
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="actions">
            <button type="button" className="btn" onClick={apply} disabled={!count}>Fill in {count} field{count === 1 ? '' : 's'}</button>
            <button type="button" className="btn text" onClick={() => setResult(null)}>Cancel</button>
          </div>
          <p className="small">AI can misread documents. Check each value against the quote, and the full document when it matters.</p>
        </div>
      )}
    </div>
  );
}
