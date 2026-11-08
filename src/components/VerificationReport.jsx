const ICON = { pass: '✔', warn: '!', fail: '✖' };
const LABEL = { fail: 'Fix before sharing', warn: 'Worth a look', pass: 'Passed' };

export default function VerificationReport({ report, onRecheck }) {
  const { items, counts } = report;
  const groups = ['fail', 'warn'].map((level) => [level, items.filter((i) => i.level === level)]).filter(([, l]) => l.length);
  const passed = items.filter((i) => i.level === 'pass');
  const status = counts.fail ? 'fail' : counts.warn ? 'warn' : 'pass';

  return (
    <section className={`verify no-print verify-${status}`} aria-label="Verification report">
      <div className="verify-head">
        <div>
          <strong>Verification report</strong>
          <span className="small">
            {counts.fail ? ` ${counts.fail} to fix` : ''}
            {counts.warn ? ` ${counts.fail ? '·' : ''} ${counts.warn} to review` : ''}
            {!counts.fail && !counts.warn ? ' All checks passed' : ''} · {counts.pass} passed
          </span>
        </div>
        <button className="btn ghost" onClick={onRecheck}>Re-check the memo text</button>
      </div>
      <p className="small verify-note">
        Checks the numbers, the math, the Red/Yellow/Green ratings and any figures you typed into the memo. You still make the final call.
      </p>
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
