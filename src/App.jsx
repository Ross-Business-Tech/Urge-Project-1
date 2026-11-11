import { useCallback, useEffect, useRef, useState } from 'react';
import DealForm from './components/DealForm.jsx';
import Memo from './components/Memo.jsx';
import SourceCard from './components/SourceCard.jsx';
import DocScan from './components/DocScan.jsx';
import DealDrop from './components/DealDrop.jsx';
import { explain } from './lib/sources.js';
import { sampleDeal, emptyDeal } from './lib/sampleDeal.js';
import { dealFromCsv, dealToCsv, dealFromJson } from './lib/csv.js';
import { analyze } from './lib/analysis.js';
import { verifyAll } from './lib/verify/index.js';
import { readFactsFromDom } from './lib/verify/memoFacts.js';
import VerificationReport from './components/VerificationReport.jsx';
import { sampleLoans } from './lib/sampleLoans.js';
import { randomDeal, MAX_MISTAKES } from './lib/randomDeal.js';
import './App.css';

const STORE = 'memo-drafter-deal-v1';
const ORIGINS = 'memo-drafter-origins-v1';

// Remembers how the deal got here (typed, sample, or uploaded file + row numbers)
// so the memo can show where each number came from.
function loadOrigins() {
  try {
    return JSON.parse(localStorage.getItem(ORIGINS)) || { kind: 'typed' };
  } catch {
    return { kind: 'typed' };
  }
}

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

// Line icons for the Viewing / Editing switch, drawn in the page's colors (they follow the text color)
const EyeIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const PencilIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
    <path d="M14.5 7.5l3 3" />
  </svg>
);

const slug = (s) => (s || 'deal').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();

export default function App() {
  const [deal, setDeal] = useState(loadSaved);
  const [origins, setOrigins] = useState(loadOrigins);
  const [mode, setMode] = useState('view'); // 'view' = tap numbers for sources, 'edit' = type in the memo
  const [card, setCard] = useState(null);
  const closeCard = useCallback(() => setCard(null), []);
  const [tab, setTab] = useState('data');
  const [generated, setGenerated] = useState(null); // { deal, id }
  const [msg, setMsg] = useState(null);
  const memoRef = useRef(null);
  const [report, setReport] = useState(null); // Verification report for the memo as it reads now
  const [checking, setChecking] = useState(false);
  const [rand, setRand] = useState({ profile: 'any', mistakes: '0', seed: '' });
  const [seedTyped, setSeedTyped] = useState(false); // true only while the user has typed their own seed
  const [compact, setCompact] = useState(false); // scrolled down: the mode switch shrinks to just its icons
  const [spin, setSpin] = useState(0); // changes whenever a new deal loads so the form visibly refills

  useEffect(() => {
    try { localStorage.setItem(STORE, JSON.stringify(deal)); } catch { /* storage unavailable */ }
  }, [deal]);
  useEffect(() => {
    try { localStorage.setItem(ORIGINS, JSON.stringify(origins)); } catch { /* storage unavailable */ }
  }, [origins]);

  // Load a whole new deal and record where it came from.
  // A new deal means the old memo no longer matches it, so clear it and refresh the form.
  const loadDeal = (d, o) => { setDeal(d); setOrigins(o); setGenerated(null); setCard(null); setSpin((n) => n + 1); };

  const loadSample = (id) => {
    const ex = sampleLoans.find((x) => x.id === id);
    if (!ex) return;
    loadDeal(structuredClone(ex.deal), { kind: 'sample' });
    flash(`Loaded sample: ${ex.name}.`);
  };

  const randomize = (repeat = false) => {
    // A new random deal every click. A typed seed (or Repeat) is used once to recreate a deal.
    const seed = (repeat || seedTyped) && rand.seed.trim() ? Number(rand.seed) || 1 : (crypto.getRandomValues(new Uint32Array(1))[0] % 1000000) + 1;
    setSeedTyped(false);
    const r = randomDeal(seed, { profile: rand.profile, mistakes: Number(rand.mistakes) });
    loadDeal(r.deal, { kind: 'sample' });
    setRand({ ...rand, seed: String(seed) });
    flash(`Random deal #${seed} (${r.profile}${r.planted.length ? `, ${r.planted.length} planted problem${r.planted.length > 1 ? 's' : ''}: ${r.planted.slice(0, 3).map((p) => p.type).join(', ')}${r.planted.length > 3 ? ` and ${r.planted.length - 3} more` : ''}` : ''}).`);
  };

  // Edits on the Deal data page: anything changed by hand now counts as "typed".
  const editDeal = (next) => {
    const changed = Object.keys(next).filter((k) => next[k] !== deal[k]);
    if (changed.length) setOrigins((o) => ({ ...o, typed: { ...o.typed, ...Object.fromEntries(changed.map((k) => [k, true])) } }));
    setDeal(next);
  };

  // Values the AI read from uploaded documents: fill them in and remember the file + quote.
  const applyScan = (updates, evidence) => {
    setDeal((d) => ({ ...d, ...updates }));
    setOrigins((o) => {
      const typed = { ...o.typed };
      Object.keys(updates).forEach((k) => delete typed[k]);
      return { ...o, typed, docs: { ...o.docs, ...evidence } };
    });
    const n = Object.keys(updates).length;
    flash(`Filled in ${n} field${n === 1 ? '' : 's'} from your documents. Review them below, then write the memo.`);
  };

  const flash = (text, kind = 'ok') => {
    setMsg({ text, kind });
    setTimeout(() => setMsg(null), 4000);
  };

  // Loads a deal spreadsheet (.csv from the template, or .json)
  const loadDealFile = async (file) => {
    try {
      const text = await file.text();
      const lines = {};
      const d = file.name.toLowerCase().endsWith('.json') ? dealFromJson(text) : dealFromCsv(text, lines);
      loadDeal(d, { kind: 'file', fileName: file.name, lines });
      flash(`Loaded ${file.name}. Review the fields, then write the memo.`);
    } catch (err) {
      flash(`Couldn’t read that file. ${err.message || ''} Use a .csv saved from the template.`, 'err');
    }
  };

  const generate = () => {
    setGenerated({ deal: structuredClone(deal), origins: structuredClone(origins), id: Date.now() });
    setCard(null);
    setTab('memo');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Remember each number's original text, so the card can tell if it was changed by hand.
  useEffect(() => {
    memoRef.current?.querySelectorAll('.src').forEach((el) => { el.dataset.orig = el.textContent; });
  }, [generated?.id]);

  // Viewing mode: tapping a marked number opens its source card.
  const onPaperClick = (e) => {
    if (mode !== 'view') return;
    if (e.target.closest('a')) return; // let article links open normally
    const el = e.target.closest('[data-src]');
    if (!el) return;
    const info = explain(el.dataset.src, generated.deal, generated.origins);
    if (!info) return;
    const shown = el.textContent.trim();
    const original = (el.dataset.orig || '').trim();
    setCard({ info, shown, original, edited: original && shown !== original, anchor: el.getBoundingClientRect() });
  };

  // "Go to this in Deal data": open the form and jump to that box.
  const goToField = (field) => {
    setCard(null);
    setTab('data');
    setTimeout(() => {
      let el = document.getElementById('f-' + field);
      if (!el) {
        const wanted = { urgeUses: 'How the loan will be used', projectSources: 'Project sources (overall financing)', projectUses: 'Project uses', financials: 'Revenue and net income by year', repaymentOptions: 'Ways the fund gets repaid (in priority order)', news: 'News items for the memo', team: 'Team members' }[field];
        el = [...document.querySelectorAll('.field .label')].find((l) => l.textContent === wanted);
      }
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.closest('.field')?.classList.add('flash');
        setTimeout(() => el.closest('.field')?.classList.remove('flash'), 2000);
        if (el.focus) el.focus({ preventScroll: true });
      }
    }, 50);
  };

  // Keep the mode switch pinned just under the page header, and shrink it to icons once you scroll down
  useEffect(() => {
    const header = document.querySelector('.top');
    const setOffset = () => document.documentElement.style.setProperty('--top-h', `${header ? header.offsetHeight : 58}px`);
    const onScroll = () => setCompact(window.scrollY > 60);
    setOffset();
    onScroll();
    const ro = typeof ResizeObserver !== 'undefined' && header ? new ResizeObserver(setOffset) : null;
    ro?.observe(header);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', setOffset);
    return () => { ro?.disconnect(); window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', setOffset); };
  }, []);

  // --- Verification: always check the memo as it reads right now (including hand edits)
  const check = () => verifyAll(generated.deal, memoRef.current?.innerText || '', memoRef.current ? readFactsFromDom(memoRef.current) : undefined);
  const runChecks = () => {
    if (!generated || checking) return;
    setChecking(true);
    // The checks themselves are instant; a short pause makes it visible that they re-ran
    setTimeout(() => {
      setReport({ ...check(), checkedAt: Date.now() });
      setChecking(false);
    }, 900);
  };
  useEffect(() => {
    if (generated) setReport({ ...verifyAll(generated.deal, memoRef.current?.innerText || '', memoRef.current ? readFactsFromDom(memoRef.current) : undefined), checkedAt: Date.now() });
  }, [generated]);
  // Re-check before anything leaves the app
  const guard = (action) => {
    const r = check();
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
          <p>Drop in the deal spreadsheet, let AI read the borrower’s documents, or type the numbers in. The memo follows the committee template, adds charts, and flags red and yellow items to check.</p>
          <div className="add-grid">
            <DealDrop
              onFile={loadDealFile}
              onReject={(m, kind = 'err') => flash(m, kind)}
              loadedName={origins.kind === 'file' ? origins.fileName : ''}
              onTemplate={() => download('deal-data-template.csv', dealToCsv(sampleDeal), 'text/csv')}
              canSave={!!deal.firmName}
              onSave={() => download(`deal-data-${slug(deal.firmName)}.csv`, dealToCsv(deal), 'text/csv')}
            />
            <DocScan deal={deal} onApply={applyScan} />
          </div>
          <div className="intro-tools">
            <button className="btn text" onClick={() => { if (confirm('Clear all fields?')) loadDeal(structuredClone(emptyDeal), { kind: 'typed' }); }}>Clear all fields</button>
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
                  <option value="0">None</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n) => n < MAX_MISTAKES).map((n) => <option key={n} value={n}>{n}</option>)}
                  <option value={MAX_MISTAKES}>Maximum ({MAX_MISTAKES})</option>
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
          <DealForm deal={deal} set={editDeal} />
        </div>

        <div className="sticky-cta">
          <button className="btn big" onClick={generate}>Write the memo →</button>
        </div>
      </main>

      <main hidden={tab !== 'memo'}>
        {generated ? (
          <>
            <div className={`mode-bar no-print${compact ? ' compact' : ''}`}>
              <div className="mode-switch" role="group" aria-label="Memo mode">
                <button type="button" aria-pressed={mode === 'view'} aria-label="Viewing mode" title="Viewing: tap numbers to see their source" className={mode === 'view' ? 'on' : ''} onClick={() => setMode('view')}>
                  <EyeIcon /><span className="lbl">Viewing</span>
                </button>
                <button type="button" aria-pressed={mode === 'edit'} aria-label="Editing mode" title="Editing: type in the memo" className={mode === 'edit' ? 'on' : ''} onClick={() => { setMode('edit'); setCard(null); }}>
                  <PencilIcon /><span className="lbl">Editing</span>
                </button>
              </div>
            </div>
            <p className="small mode-hint no-print">
              {mode === 'view'
                ? 'Tap any highlighted number to see where it came from.'
                : 'Click any text in the memo to change it. Switch back to Viewing to check sources.'}
            </p>
            <div className="memo-bar no-print">
              <div className="flag-summary">
                <span className="badge badge-red">{counts.red} red</span>
                <span className="badge badge-yellow">{counts.yellow} yellow</span>
              </div>
              <div className="actions">
                <button className="btn" onClick={() => guard(downloadWord)}>Download for Word</button>
                <button className="btn ghost" onClick={() => guard(() => window.print())}>Print / PDF</button>
                <button className="btn ghost" onClick={() => guard(copyText)}>Copy text</button>
                <button className="btn text" onClick={() => setTab('data')}>← Edit data</button>
              </div>
            </div>
            {report && <VerificationReport report={report} onRecheck={runChecks} checking={checking} onEditData={() => setTab('data')} />}
            <div
              className={`paper ${mode === 'view' ? 'viewing' : 'editing'}`}
              ref={memoRef}
              contentEditable={mode === 'edit'}
              suppressContentEditableWarning
              spellCheck={mode === 'edit'}
              key={generated.id}
              onClick={onPaperClick}
            >
              <Memo deal={generated.deal} />
            </div>
            {card && mode === 'view' && (
              <SourceCard {...card} onClose={closeCard} onGoTo={goToField} />
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}
