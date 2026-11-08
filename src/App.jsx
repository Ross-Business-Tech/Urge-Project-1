import { useEffect, useRef, useState } from 'react';
import DealForm from './components/DealForm.jsx';
import Memo from './components/Memo.jsx';
import { sampleDeal, emptyDeal } from './lib/sampleDeal.js';
import { sampleLoans } from './lib/sampleLoans.js';
import { randomDeal } from './lib/randomDeal.js';
import { dealFromCsv, dealToCsv, dealFromJson } from './lib/csv.js';
import { analyze } from './lib/analysis.js';
import { verifyAll } from './lib/verify/index.js';
import { readFactsFromDom } from './lib/verify/memoFacts.js';
import VerificationReport from './components/VerificationReport.jsx';
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
  const [report, setReport] = useState(null);
  const [rand, setRand] = useState({ profile: 'any', mistakes: '0', seed: '' });
  const [seedTyped, setSeedTyped] = useState(false); // true only while the user has typed their own seed
  const [spin, setSpin] = useState(0); // changes on every randomize/sample load so the form visibly refills
  const [checking, setChecking] = useState(false);
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

  const loadSample = (id) => {
    const ex = sampleLoans.find((x) => x.id === id);
    if (!ex) return;
    setDeal(structuredClone(ex.deal));
    setGenerated(null); // the old memo no longer matches this deal
    setSpin((n) => n + 1);
    flash(`Loaded sample: ${ex.name}.`);
  };

  const randomize = (repeat = false) => {
    // A new random deal every click. A typed seed is used once (to repeat a deal), then cleared.
    const seed = (repeat || seedTyped) && rand.seed.trim() ? Number(rand.seed) || 1 : Math.floor(Math.random() * 1e6) + 1;
    setSeedTyped(false);
    setSpin((n) => n + 1);
    const r = randomDeal(seed, { profile: rand.profile, mistakes: Number(rand.mistakes) });
    setDeal(r.deal);
    setGenerated(null);
    setRand({ ...rand, seed: String(seed) });
    flash(`Random deal #${seed} (${r.profile}${r.planted.length ? `, ${r.planted.length} planted mistake${r.planted.length > 1 ? 's' : ''}: ${r.planted.map((p) => p.type).join(', ')}` : ''}).`);
  };

  const runChecks = () => {
    if (!generated || checking) return;
    setChecking(true);
    // The checks themselves are instant; a short pause makes it visible that they re-ran
    setTimeout(() => {
      setReport({ ...verifyAll(generated.deal, memoRef.current?.innerText || '', memoRef.current ? readFactsFromDom(memoRef.current) : undefined), checkedAt: Date.now() });
      setChecking(false);
    }, 900);
  };

  // Check the memo as soon as it is written
  useEffect(() => {
    if (generated) setReport({ ...verifyAll(generated.deal, memoRef.current?.innerText || '', memoRef.current ? readFactsFromDom(memoRef.current) : undefined), checkedAt: Date.now() });
  }, [generated]);

  // Re-check the written text (including hand edits) before anything leaves the app
  const guard = (action) => {
    const r = verifyAll(generated.deal, memoRef.current?.innerText || '', memoRef.current ? readFactsFromDom(memoRef.current) : undefined);
    setReport({ ...r, checkedAt: Date.now() });
    if (r.counts.fail && !confirm(`${r.counts.fail} check(s) failed. Review the Verification report first.\n\nShare the memo anyway?`)) return;
    action();
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
            <button className="btn ghost" onClick={() => download(`deal-data-${slug(deal.firmName || 'template')}.csv`, dealToCsv(deal.firmName ? deal : sampleDeal), 'text/csv')}>
              {deal.firmName ? 'Save data as spreadsheet' : 'Download blank template'}
            </button>
            <button className="btn text" onClick={() => { if (confirm('Clear all fields?')) setDeal(structuredClone(emptyDeal)); }}>Clear</button>
            <input ref={fileRef} type="file" accept=".csv,.json,text/csv,application/json" hidden onChange={onUpload} />
          </div>
          <div className="samples">
            <label>
              <span>Sample loans (all made up)</span>
              <select value="" onChange={(e) => loadSample(e.target.value)} aria-label="Load a sample loan">
                <option value="">Choose a sample loan…</option>
                {sampleLoans.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </label>
            <div className="random">
              <label><span>Randomizer</span>
                <select value={rand.profile} onChange={(e) => setRand({ ...rand, profile: e.target.value })} aria-label="Random deal type">
                  <option value="any">Any type</option>
                  <option value="strong">Strong</option>
                  <option value="mid">Medium</option>
                  <option value="weak">Weak</option>
                  <option value="chaotic">Chaotic</option>
                </select>
              </label>
              <label><span>Planted mistakes</span>
                <select value={rand.mistakes} onChange={(e) => setRand({ ...rand, mistakes: e.target.value })} aria-label="Number of planted mistakes">
                  <option value="0">None</option><option value="1">1</option><option value="2">2</option><option value="3">3</option>
                </select>
              </label>
              <label><span>Last seed (type one to repeat it)</span>
                <input inputMode="numeric" placeholder="random" value={rand.seed} onChange={(e) => { setSeedTyped(true); setRand({ ...rand, seed: e.target.value.replace(/\D/g, '') }); }} aria-label="Random seed" />
              </label>
              <button className="btn" onClick={() => randomize(false)}>Randomize the whole deal</button>
              <button className="btn ghost" disabled={!rand.seed} onClick={() => randomize(true)}>Repeat this seed</button>
            </div>
          </div>
          <p className="hint">Spreadsheet format: one row per field (CSV). Open the template in Excel, fill in column B, and save as CSV.</p>
        </section>

        <div key={spin} className={spin ? 'shuffle' : ''}>
          <DealForm deal={deal} set={setDeal} />
        </div>

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
                <button className="btn" onClick={() => guard(downloadWord)}>Download for Word</button>
                <button className="btn ghost" onClick={() => guard(() => window.print())}>Print / PDF</button>
                <button className="btn ghost" onClick={() => guard(copyText)}>Copy text</button>
                <button className="btn text" onClick={() => setTab('data')}>← Edit data</button>
              </div>
            </div>
            {report && <VerificationReport report={report} onRecheck={runChecks} checking={checking} onEditData={() => setTab('data')} />}
            <div className="paper" ref={memoRef} contentEditable suppressContentEditableWarning spellCheck key={generated.id}>
              <Memo deal={generated.deal} />
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
