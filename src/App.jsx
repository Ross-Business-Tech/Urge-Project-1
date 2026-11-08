import { useEffect, useRef, useState } from 'react';
import DealForm from './components/DealForm.jsx';
import Memo from './components/Memo.jsx';
import { sampleDeal, emptyDeal } from './lib/sampleDeal.js';
import { dealFromCsv, dealToCsv, dealFromJson } from './lib/csv.js';
import { analyze } from './lib/analysis.js';
import './App.css';

const STORE = 'memo-drafter-deal-v1';

function loadSaved() {
  try {
    const s = localStorage.getItem(STORE);
    return s ? { ...emptyDeal, ...JSON.parse(s) } : structuredClone(emptyDeal);
  } catch {
    return structuredClone(emptyDeal);
  }
}

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const slug = (s) => (s || 'deal').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();

export default function App() {
  const [deal, setDeal] = useState(loadSaved);
  const [tab, setTab] = useState('data');
  const [generated, setGenerated] = useState(null); // { deal, id }
  const [msg, setMsg] = useState(null);
  const fileRef = useRef(null);
  const memoRef = useRef(null);

  useEffect(() => {
    try { localStorage.setItem(STORE, JSON.stringify(deal)); } catch { /* storage unavailable */ }
  }, [deal]);

  const flash = (text, kind = 'ok') => {
    setMsg({ text, kind });
    setTimeout(() => setMsg(null), 4000);
  };

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const d = file.name.toLowerCase().endsWith('.json') ? dealFromJson(text) : dealFromCsv(text);
      setDeal(d);
      flash(`Loaded ${file.name}. Review the fields, then write the memo.`);
    } catch (err) {
      flash(`Couldn’t read that file. ${err.message || ''} Use a .csv saved from the template.`, 'err');
    }
  };

  const generate = () => {
    setGenerated({ deal: structuredClone(deal), id: Date.now() });
    setTab('memo');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const memoHtml = () => memoRef.current?.innerHTML || '';

  const downloadWord = () => {
    const css = `body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1a1a1a}h1{font-size:20pt}h2{font-size:14pt;color:#1d3b5c;border-bottom:1px solid #ccc}table{border-collapse:collapse;width:100%;margin:6pt 0}td,th{border:1px solid #ccc;padding:4pt;font-size:10pt;text-align:left}.num{text-align:right}.badge{font-weight:bold}.badge-red{color:#b42318}.badge-yellow{color:#a15c00}.badge-green{color:#1b7f3b}.callout{background:#f2f6fa;padding:6pt;border-left:3pt solid #1d3b5c}.missing{background:#fff3c4}`;
    const html = `<html><head><meta charset="utf-8"><title>Investment memo</title><style>${css}</style></head><body>${memoHtml()}</body></html>`;
    download(`investment-memo-${slug(generated?.deal.firmName)}.doc`, html, 'application/msword');
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(memoRef.current?.innerText || '');
      flash('Memo text copied.');
    } catch {
      flash('Copy didn’t work in this browser. Use Download for Word instead.', 'err');
    }
  };

  const summary = generated ? analyze(generated.deal) : null;
  const counts = summary && {
    red: summary.flags.filter((f) => f.level === 'red').length,
    yellow: summary.flags.filter((f) => f.level === 'yellow').length,
  };

  return (
    <div className="app">
      <header className="top no-print">
        <div className="brand">
          <span className="logo" aria-hidden="true">M</span>
          <div>
            <strong>Memo Drafter</strong>
            <span>Investment memo first drafts from underwriting data</span>
          </div>
        </div>
        <nav className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'data'} className={tab === 'data' ? 'on' : ''} onClick={() => setTab('data')}>1. Deal data</button>
          <button role="tab" aria-selected={tab === 'memo'} className={tab === 'memo' ? 'on' : ''} onClick={() => (generated ? setTab('memo') : generate())}>2. Memo draft</button>
        </nav>
      </header>

      {msg && <div className={`toast ${msg.kind} no-print`} role="status">{msg.text}</div>}

      <main hidden={tab !== 'data'} className="no-print">
        <section className="intro">
          <h1>Turn the underwriting model into a first-draft memo</h1>
          <p>Upload the deal spreadsheet or type the numbers in. The memo follows the committee template, adds charts, and flags red and yellow items to check.</p>
          <div className="actions">
            <button className="btn" onClick={() => fileRef.current?.click()}>Upload deal spreadsheet</button>
            <button className="btn ghost" onClick={() => { setDeal(structuredClone(sampleDeal)); flash('Loaded a made-up sample deal.'); }}>Try a sample deal</button>
            <button className="btn ghost" onClick={() => download(`deal-data-${slug(deal.firmName || 'template')}.csv`, dealToCsv(deal.firmName ? deal : sampleDeal), 'text/csv')}>
              {deal.firmName ? 'Save data as spreadsheet' : 'Download blank template'}
            </button>
            <button className="btn text" onClick={() => { if (confirm('Clear all fields?')) setDeal(structuredClone(emptyDeal)); }}>Clear</button>
            <input ref={fileRef} type="file" accept=".csv,.json,text/csv,application/json" hidden onChange={onUpload} />
          </div>
          <p className="hint">Spreadsheet format: one row per field (CSV). Open the template in Excel, fill in column B, and save as CSV.</p>
        </section>

        <DealForm deal={deal} set={setDeal} />

        <div className="sticky-cta">
          <button className="btn big" onClick={generate}>Write the memo →</button>
        </div>
      </main>

      <main hidden={tab !== 'memo'}>
        {generated ? (
          <>
            <div className="memo-bar no-print">
              <div className="flag-summary">
                <span className="badge badge-red">{counts.red} red</span>
                <span className="badge badge-yellow">{counts.yellow} yellow</span>
                <span className="small">Click any text in the memo to edit it.</span>
              </div>
              <div className="actions">
                <button className="btn" onClick={downloadWord}>Download for Word</button>
                <button className="btn ghost" onClick={() => window.print()}>Print / PDF</button>
                <button className="btn ghost" onClick={copyText}>Copy text</button>
                <button className="btn text" onClick={() => setTab('data')}>← Edit data</button>
              </div>
            </div>
            <div className="paper" ref={memoRef} contentEditable suppressContentEditableWarning spellCheck key={generated.id}>
              <Memo deal={generated.deal} />
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
