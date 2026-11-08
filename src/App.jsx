import { useMemo, useState } from 'react'
import DealForm from './components/DealForm.jsx'
import MemoView from './components/MemoView.jsx'
import UploadPanel from './components/UploadPanel.jsx'
import { AiUnavailable, draftMemo, regenerateSection } from './lib/ai.js'
import { downloadWord, memoToText } from './lib/exportMemo.js'
import { buildMemo, sectionSpecs } from './lib/memoSections.js'
import { numbersCheck } from './lib/numbersCheck.js'
import { exampleDeals } from './lib/exampleDeals.js'
import { emptyDeal } from './lib/sampleDeal.js'
import './App.css'

const cleanRating = (r) => (['green', 'yellow', 'red'].includes(r) ? r : null)

export default function App() {
  const [deal, setDeal] = useState(emptyDeal)
  const [docs, setDocs] = useState([])
  const [research, setResearch] = useState('')
  const [tab, setTab] = useState('deal')
  const [ai, setAi] = useState(null) // { sections, gaps, challenges } once the AI has drafted
  const [status, setStatus] = useState({ busy: false, error: '' })
  const [copied, setCopied] = useState(false)
  const [exampleId, setExampleId] = useState(null) // set while an example deal is loaded and unedited

  const demo = useMemo(() => buildMemo(deal), [deal])
  const sections = ai ? ai.sections : demo
  const issues = useMemo(() => (ai ? numbersCheck(ai.sections, deal, docs) : []), [ai, deal, docs])

  const loadExample = (ex) => {
    setDeal(ex.deal)
    setExampleId(ex.id)
    setAi(null)
    setDocs([])
  }
  const changeDeal = (d) => {
    setDeal(d)
    setExampleId(null)
  }

  const generate = async () => {
    setStatus({ busy: true, error: '' })
    const example = exampleDeals.find((e) => e.id === exampleId)
    if (example) {
      // Pre-written example memo: no AI needed
      await new Promise((r) => setTimeout(r, 1200))
      setAi({ ...example.memo, example: true })
      setStatus({ busy: false, error: '' })
      return
    }
    try {
      const r = await draftMemo(deal, docs, research)
      const byId = Object.fromEntries((r.sections || []).map((s) => [s.id, s]))
      setAi({
        sections: sectionSpecs.map((sp) => ({
          id: sp.id,
          title: sp.title,
          rating: cleanRating(byId[sp.id]?.rating),
          body: byId[sp.id]?.body || '[The AI did not write this section. Try rewriting it.]',
          repayment:
            sp.id === 'sizing'
              ? (r.repayment || []).map((x) => ({ label: String(x.label), value: Number(x.amount) || 0 })).filter((x) => x.value > 0)
              : undefined,
        })),
        gaps: r.gaps || [],
        challenges: r.challenges || [],
      })
      setStatus({ busy: false, error: '' })
    } catch (e) {
      setStatus({
        busy: false,
        error:
          e instanceof AiUnavailable
            ? `${e.message} The AI works on the team’s dev site once your instructor has added the AI key. Showing the demo draft built from your form.`
            : 'The AI answer could not be understood. Please try again.',
      })
    }
  }

  const edit = (id, patch) => setAi((a) => ({ ...a, sections: a.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) }))
  const rewrite = async (s, instruction) => {
    try {
      const spec = sectionSpecs.find((x) => x.id === s.id)
      const r = await regenerateSection(deal, docs, spec, s.body, instruction)
      edit(s.id, { body: r.body || s.body, rating: cleanRating(r.rating) })
    } catch {
      setStatus({ busy: false, error: 'Could not rewrite that section right now.' })
    }
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(memoToText(deal, sections))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setStatus({ busy: false, error: 'Copying is blocked in this browser. Use Download instead.' })
    }
  }

  return (
    <div className="app">
      <header>
        <h1>Investment Memo Drafter</h1>
        <p>Enter the deal, add your files, and get a first-draft memo for the investment committee.</p>
      </header>

      <nav className="tabs">
        {[['deal', '1. Deal'], ['files', '2. Files'], ['memo', '3. Memo']].map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? 'tab active' : 'tab'} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      <main>
        {tab === 'deal' && (
          <>
            <h2 className="pick">Try an example deal</h2>
            <p className="hint">Pick one to fill in the form. Everything here is made up, and each has a pre-written memo.</p>
            <div className="examples">
              {exampleDeals.map((ex) => (
                <button key={ex.id} type="button" className={exampleId === ex.id ? 'example active' : 'example'} onClick={() => loadExample(ex)}>
                  <b>{ex.name}</b>
                  <span>{ex.summary}</span>
                </button>
              ))}
            </div>
            <DealForm deal={deal} onChange={changeDeal} />
            <button type="button" className="primary" onClick={() => setTab('files')}>
              Next: add files
            </button>
          </>
        )}
        {tab === 'files' && (
          <>
            <UploadPanel docs={docs} onDocs={setDocs} deal={deal} onDeal={changeDeal} research={research} onResearch={setResearch} />
            <button type="button" className="primary" onClick={() => setTab('memo')}>
              Next: memo
            </button>
          </>
        )}
        {tab === 'memo' && (
          <>
            <button type="button" className="primary top" disabled={status.busy} onClick={generate}>
              {status.busy ? 'Writing the memo…' : ai ? (exampleId ? 'Show the example memo again' : 'Write the memo again with AI') : exampleId ? 'Show the example memo' : 'Write the memo with AI'}
            </button>
            {status.error && <p className="notice warn">{status.error}</p>}
            {ai?.example && <p className="notice">Example memo: pre-written for this made-up deal. It was not written by the AI.</p>}
            {!ai && <p className="notice">{exampleId ? 'Press the button above to see the example memo for this deal.' : 'Draft built from your form only, with placeholders. Press the button above for the AI-written version.'}</p>}
            <MemoView
              sections={sections}
              deal={deal}
              canAi={!!ai && !ai.example}
              hasMemo={!!ai}
              onEdit={edit}
              onRegenerate={rewrite}
              gaps={ai?.gaps}
              challenges={ai?.challenges}
              issues={issues}
            />
            <div className="export">
              <button type="button" className="secondary" onClick={copy}>{copied ? 'Copied!' : 'Copy memo text'}</button>
              <button type="button" className="secondary" onClick={() => downloadWord(deal, sections)}>Download for Word</button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
