import { useMemo, useState } from 'react'
import DealForm from './components/DealForm.jsx'
import MemoView from './components/MemoView.jsx'
import UploadPanel from './components/UploadPanel.jsx'
import { buildMemo } from './lib/memoSections.js'
import { emptyDeal, sampleDeal } from './lib/sampleDeal.js'
import './App.css'

export default function App() {
  const [deal, setDeal] = useState(emptyDeal)
  const [files, setFiles] = useState([])
  const [tab, setTab] = useState('deal')
  const sections = useMemo(() => buildMemo(deal), [deal])

  return (
    <div className="app">
      <header>
        <h1>Investment Memo Drafter</h1>
        <p>Enter the deal, add your files, and get a first-draft memo for the investment committee.</p>
      </header>

      <nav className="tabs">
        {[
          ['deal', '1. Deal'],
          ['files', '2. Files'],
          ['memo', '3. Memo'],
        ].map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? 'tab active' : 'tab'} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      <main>
        {tab === 'deal' && (
          <>
            <button type="button" className="secondary" onClick={() => setDeal(sampleDeal)}>
              Load sample deal (made-up data)
            </button>
            <DealForm deal={deal} onChange={setDeal} />
            <button type="button" className="primary" onClick={() => setTab('files')}>
              Next: add files
            </button>
          </>
        )}
        {tab === 'files' && (
          <>
            <UploadPanel files={files} onFiles={setFiles} />
            <button type="button" className="primary" onClick={() => setTab('memo')}>
              Draft the memo
            </button>
          </>
        )}
        {tab === 'memo' && (
          <>
            <p className="notice">
              Demo draft: built from your form only. AI-written text is the next step.
            </p>
            <MemoView sections={sections} />
          </>
        )}
      </main>
    </div>
  )
}
