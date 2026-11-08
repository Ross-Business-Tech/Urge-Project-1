import { useRef } from 'react'

export default function UploadPanel({ files, onFiles }) {
  const input = useRef(null)
  const add = (list) => onFiles([...files, ...Array.from(list).map((f) => ({ name: f.name, size: f.size }))])

  return (
    <div className="upload">
      <p>
        Add the term sheet and anything else about the deal: financials, bios, org structure, decks.
      </p>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
        onChange={(e) => {
          add(e.target.files)
          e.target.value = ''
        }}
      />
      <button type="button" className="secondary" onClick={() => input.current.click()}>
        Choose files
      </button>
      {files.length > 0 && (
        <ul>
          {files.map((f, i) => (
            <li key={f.name + i}>
              {f.name} <small>({Math.max(1, Math.round(f.size / 1024))} KB)</small>
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => onFiles(files.filter((_, j) => j !== i))}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="hint">
        Coming next: the tool will read these files and fill in the form for you to confirm. For now,
        files are only listed.
      </p>
    </div>
  )
}
