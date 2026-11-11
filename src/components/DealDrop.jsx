import { useRef, useState } from 'react';
import { CheckIcon, FileIcon, UploadIcon } from './icons.jsx';

const OK = /\.(csv|json)$/i;

// A drag-and-drop area for the deal spreadsheet (click to browse works too).
export default function DealDrop({ onFile, onReject, loadedName, onTemplate, onSave, canSave }) {
  const input = useRef(null);
  const [over, setOver] = useState(false);

  const take = (list) => {
    const files = [...(list || [])];
    if (!files.length) return;
    const file = files.find((f) => OK.test(f.name));
    if (!file) return onReject?.(`“${files[0].name}” isn’t a deal spreadsheet. Use a .csv saved from the template, or a .json file. For PDFs, Word or photos, use Scan documents with AI.`);
    if (files.length > 1) onReject?.('Only one deal spreadsheet at a time. Loaded the first one.', 'ok');
    onFile(file);
  };

  return (
    <div className="add-card">
      <div className="add-head">
        <h3>Deal spreadsheet</h3>
        <span className="add-tag">CSV or JSON</span>
      </div>
      <div
        className={`dd${over ? ' over' : ''}${loadedName ? ' loaded' : ''}`}
        role="button"
        tabIndex={0}
        aria-label="Upload a deal spreadsheet: drop a file here or press Enter to browse"
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), input.current?.click())}
        onDragEnter={(e) => { e.preventDefault(); setOver(true); }}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(false); }}
        onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files); }}
      >
        <span className="dd-icon">{loadedName ? <CheckIcon /> : <UploadIcon />}</span>
        {loadedName ? (
          <>
            <strong className="dd-title">Spreadsheet loaded</strong>
            <span className="dd-file"><FileIcon width={16} height={16} /> {loadedName}</span>
            <span className="dd-sub">Drop another file to replace it, or <u>browse</u></span>
          </>
        ) : (
          <>
            <strong className="dd-title">{over ? 'Drop to load the deal' : 'Drop your deal spreadsheet here'}</strong>
            <span className="dd-sub">or <u>click to browse</u> · one file, saved from the template</span>
          </>
        )}
      </div>
      <input ref={input} type="file" accept=".csv,.json,text/csv,application/json" hidden onChange={(e) => { take(e.target.files); e.target.value = ''; }} />
      <div className="add-links">
        <button type="button" className="link-btn" onClick={onTemplate}>Download blank template</button>
        {canSave && <button type="button" className="link-btn" onClick={onSave}>Save current data as spreadsheet</button>}
      </div>
    </div>
  );
}
