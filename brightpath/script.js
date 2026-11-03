/*
  script.js — what happens when you click things on the page.
  Milestone 1: load the sample month and show a preview of each messy source.
*/

let month = null; // the four sources once loaded

// Make any text safe to show on the page (data may contain odd characters or code).
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function num(n) { return n.toLocaleString('en-US'); }
function isBlank(v) { return v === undefined || v === null || String(v).trim() === ''; }

function countBlanks(rows) {
  let n = 0;
  for (const r of rows) for (const k in r) if (isBlank(r[k])) n++;
  return n;
}

// Show a few normal rows plus a few rows with blanks, so the mess is visible.
function previewRows(rows) {
  const normal = rows.slice(0, 3);
  const messy = rows.slice(3).filter((r) => Object.values(r).some(isBlank)).slice(0, 3);
  return normal.concat(messy);
}

function tableHtml(rows) {
  if (!rows.length) return '<p class="empty">No rows.</p>';
  const cols = Object.keys(rows[0]);
  const head = cols.map((c) => `<th>${esc(c)}</th>`).join('');
  const body = rows.map((r) => '<tr>' + cols.map((c) =>
    isBlank(r[c]) ? '<td><span class="blank">blank</span></td>' : `<td>${esc(r[c])}</td>`
  ).join('') + '</tr>').join('');
  return `<div class="table-scroll"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function sourceCard({ icon, title, from, count, unit, issues, preview }) {
  return `
    <article class="card">
      <div class="card-head">
        <span class="icon" aria-hidden="true">${icon}</span>
        <div>
          <h3>${esc(title)}</h3>
          <p class="from">${esc(from)}</p>
        </div>
        <span class="count">${num(count)} <small>${esc(unit)}</small></span>
      </div>
      <ul class="issues">${issues.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
      ${preview}
    </article>`;
}

function renderSources(m) {
  const phones = new Map();
  for (const r of m.forms) if (r.Phone) phones.set(r.Phone, (phones.get(r.Phone) || 0) + 1);
  const repeatPhones = [...phones.values()].filter((n) => n > 1).length;

  const spellings = new Set(m.sheet.map((r) => r['Attended?'].trim()).filter(Boolean));
  const blankAttend = m.sheet.filter((r) => isBlank(r['Attended?'])).length;
  const blankHours = m.sheet.filter((r) => r.Mentor && (isBlank(r['Volunteer hrs']) || r['Volunteer hrs'] === '?')).length;

  const noHours = m.emails.filter((e) => /forgot/i.test(e.body)).length;
  const withStory = m.emails.filter((e) => e.body.length > 110).length;

  const blankGifts = m.donors.filter((r) => isBlank(r.GFT_AMT)).length;

  const emailPreview = '<div class="emails">' + m.emails.slice(0, 3).map((e) => `
      <div class="email"><p class="email-meta"><strong>${esc(e.from)}</strong> · ${esc(e.subject)}</p>
      <p>${esc(e.body)}</p></div>`).join('') + '</div>';

  document.getElementById('sources').innerHTML = [
    sourceCard({
      icon: '📝', title: 'Signups', from: 'Google Forms export', count: m.forms.length, unit: 'signups',
      issues: [`${num(repeatPhones)} phone numbers appear more than once (likely duplicates)`,
        `${num(countBlanks(m.forms))} blank cells`, 'Signed up ≠ showed up: about 1 in 3 never come'],
      preview: tableHtml(previewRows(m.forms)),
    }),
    sourceCard({
      icon: '📊', title: 'Attendance', from: 'Shared spreadsheet', count: m.sheet.length, unit: 'rows',
      issues: [`"Attended?" is written ${spellings.size} different ways (Y, yes, ✓, NS, no show…)`,
        `${num(blankAttend)} rows with attendance left blank`,
        `${num(blankHours)} sessions missing volunteer hours`, 'Dates in 4+ formats'],
      preview: tableHtml(previewRows(m.sheet)),
    }),
    sourceCard({
      icon: '✉️', title: 'Volunteer updates', from: 'Email inbox', count: m.emails.length, unit: 'emails',
      issues: ['Hours buried in sentences ("about 4", "two")', `${noHours} volunteers forgot to log hours`,
        `${withStory} emails contain a story worth using`],
      preview: emailPreview,
    }),
    sourceCard({
      icon: '💰', title: 'Donations', from: 'Donor database export', count: m.donors.length, unit: 'gifts',
      issues: ['Cryptic columns (GFT_AMT, FND_CD) only two people understand',
        'Amounts as "$1,000", "1000.00" and "1000"', `${blankGifts} gifts with no amount`],
      preview: tableHtml(previewRows(m.donors)),
    }),
  ].join('');
}

document.getElementById('load-sample').addEventListener('click', () => {
  const status = document.getElementById('status');
  try {
    const t0 = performance.now();
    month = makeSampleMonth();
    renderSources(month);
    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    const total = month.forms.length + month.sheet.length + month.emails.length + month.donors.length;
    status.textContent = `Loaded ${num(total)} records from 4 sources in ${secs} seconds. Here's how messy they are:`;
    status.className = 'status ok';
  } catch (err) {
    status.textContent = 'Sorry, the sample month could not be loaded. Please refresh the page and try again.';
    status.className = 'status error';
    console.warn(err);
  }
});
