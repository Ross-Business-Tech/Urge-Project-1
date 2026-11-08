const ICON = { pass: '✔', warn: '!', fail: '✖' };
const LABEL = { fail: 'Fix before sharing', warn: 'Worth a look', pass: 'Passed' };

export default function VerificationReport({ report, onRecheck, checking, onEditData }) {
  const { items, counts } = report;
  const groups = ['fail', 'warn'].map((level) => [level, items.filter((i) => i.level === level)]).filter(([, l]) => l.length);
  const passed = items.filter((i) => i.level === 'pass');
  const status = counts.fail ? 'fail' : counts.warn ? 'warn' : 'pass';
  const handEdited = items.some((i) => i.area === 'Memo vs form' && i.level !== 'pass');

  return (
    <section className={`verify no-print verify-${status}${checking ? ' checking' : ''}`} aria-label="Verification report" aria-busy={checking}>
      <div className="verify-head">
        <div>
          <strong>Verification report</strong>
          <span className="small">
            {counts.fail ? ` ${counts.fail} to fix` : ''}
            {counts.warn ? ` ${counts.fail ? '·' : ''} ${counts.warn} to review` : ''}
            {!counts.fail && !counts.warn ? ' All checks passed' : ''} · {counts.pass} passed
          </span>
        </div>
        <button className="btn ghost recheck" onClick={onRecheck} disabled={checking}>
          {checking ? <><span className="spinner" aria-hidden="true" /> Checking…</> : 'Re-check the memo text'}
        </button>
      </div>
      {report.checkedAt && !checking && (
        <p className="small verify-time">✔ Checked at {new Date(report.checkedAt).toLocaleTimeString()}</p>
      )}
      {checking && <p className="small verify-time" role="status">Re-reading the memo and re-checking every figure…</p>}
      <p className="small verify-note">
        Checks the numbers, the math, the Red/Yellow/Green ratings and any figures you typed into the memo. You still make the final call.
      </p>
      {handEdited && !checking && (
        <div className="verify-sync" role="note">
          <strong>You changed the memo by hand.</strong> Your fixes are counted above, but the deal form still holds the old numbers,
          and figures the memo calculates itself (annual interest, debt-to-equity, coverage, ratings, the flags in Section 10) do not update from hand edits.
          <ol>
            <li>Correct the same numbers on the Deal data tab.</li>
            <li>Press <b>Write the memo</b> again to refresh every calculated figure.</li>
          </ol>
          <span className="small">Writing the memo again replaces your hand edits, so fix the form first.</span>
          {onEditData && <button className="btn ghost" onClick={onEditData}>← Edit the deal data</button>}
        </div>
      )}
      {groups.map(([level, list]) => (
        <div key={level} className="verify-group">
          <h3>{LABEL[level]}</h3>
          <ul>
            {list.map((i, k) => (
              <li key={k} className={`v-${i.level}`}>
                <span className="v-icon" aria-hidden="true">{ICON[i.level]}</span>
                <span><b>{i.title}</b> <em>{i.area}</em>{i.detail && <small>{i.detail}</small>}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <details className="verify-pass">
        <summary>{passed.length} checks passed</summary>
        <ul>{passed.map((i, k) => <li key={k} className="v-pass"><span className="v-icon" aria-hidden="true">✔</span><span>{i.title}</span></li>)}</ul>
      </details>
    </section>
  );
}
