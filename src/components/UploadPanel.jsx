import { useRef, useState } from 'react'
import { readFile } from '../lib/parseFiles.js'
import { extractFields, AiUnavailable } from '../lib/ai.js'
import { emptyDeal } from '../lib/sampleDeal.js'

export default function UploadPanel({ docs, onDocs, deal, onDeal, research, onResearch }) {
  const input = useRef(null)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')

  const add = async (list) => {
    setBusy('Reading files…')
    const read = []
    for (const f of Array.from(list)) read.push(await readFile(f))
    onDocs([...docs, ...read])
    setBusy('')
  }

  const fill = async () => {
    setBusy('Reading your files and filling in the form…')
    setMsg('')
    try {
      const found = await extractFields(emptyDeal, docs)
      const merged = { ...deal }
      let n = 0
      for (const k of Object.keys(emptyDeal)) {
        const v = found[k]
        if (v && !String(deal[k] || '').trim()) {
          merged[k] = String(v)
          n++
        }
      }
      onDeal(merged)
      setMsg(`Filled in ${n} empty field${n === 1 ? '' : 's'}. Check them on the Deal tab. Anything you already typed was left alone.`)
    } catch (e) {
      setMsg(e instanceof AiUnavailable ? e.message + ' You can still fill in the form by hand.' : 'Something went wrong reading the files.')
    }
    setBusy('')
  }

  return (
    <div className="upload">
      <p>Add the term sheet and anything else about the deal: financials, bios, org structure, decks. Files are read in your browser.</p>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        accept=".pdf,.docx,.xlsx,.csv,.txt,.md"
        onChange={(e) => {
          add(e.target.files)
          e.target.value = ''
        }}
      />
      <button type="button" className="secondary" onClick={() => input.current.click()}>
        Choose files
      </button>
      {docs.length > 0 && (
        <>
          <ul>
            {docs.map((f, i) => (
              <li key={f.name + i}>
                <span>
                  {f.name} <small>{f.error ? `– ${f.error}` : `(${f.text.length.toLocaleString()} characters read)`}</small>
                </span>
                <button type="button" aria-label={`Remove ${f.name}`} onClick={() => onDocs(docs.filter((_, j) => j !== i))}>
                  ×
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="secondary" disabled={!!busy} onClick={fill}>
            Fill in the form from these files
          </button>
        </>
      )}
      <label className="research">
        <span>Outside research (optional): paste news articles, neighborhood data, Walk Score results…</span>
        <textarea rows={5} value={research} onChange={(e) => onResearch(e.target.value)} />
      </label>
      {busy && <p className="notice">{busy}</p>}
      {msg && <p className="notice">{msg}</p>}
    </div>
  )
}
