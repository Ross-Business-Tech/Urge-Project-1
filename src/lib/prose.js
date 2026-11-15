// Free-response fields can be typed as bullets. The memo turns them into a paragraph:
//   "Strong corridor:\n- new grocery\n- two bus lines"  ->  "Strong corridor: new grocery; and two bus lines."
//   "- Site control in place\n- Permits filed"          ->  "Site control in place. Permits filed."
// Text without bullets is left exactly as typed (blank lines still separate paragraphs).

const BULLET = /^\s*(?:[-*•–—▪◦·]|\(?\d{1,2}[.)]|\(?[a-z]\))\s+/;

const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const end = (t) => (/[.!?:;]$/.test(t) ? t : `${t}.`);
const trimEnd = (t) => t.replace(/[\s.;,]+$/, '');

function block(lines) {
  const items = [];
  let intro = [];
  for (const line of lines) {
    if (BULLET.test(line)) items.push(line.replace(BULLET, '').trim());
    else if (items.length) items[items.length - 1] += ` ${line.trim()}`; // wrapped bullet line
    else intro.push(line.trim());
  }
  const lead = intro.join(' ').trim();
  if (!items.length) return lines.map((l) => l.trim()).join(' ');
  const clean = items.map(trimEnd).filter(Boolean);
  if (/:$/.test(lead)) {
    // "Intro: a; b; and c."
    const list = clean.length > 1 ? `${clean.slice(0, -1).join('; ')}; and ${clean[clean.length - 1]}` : clean[0];
    return `${lead} ${list}.`;
  }
  return [lead ? end(lead) : '', ...clean.map((i) => end(cap(i)))].filter(Boolean).join(' ');
}

export function prose(text) {
  if (typeof text !== 'string' || !text.trim()) return text;
  if (!text.split('\n').some((l) => BULLET.test(l))) return text;
  return text
    .split(/\n\s*\n/)
    .map((para) => block(para.split('\n').filter((l) => l.trim())))
    .join('\n\n');
}

const TEXT_FIELDS = ['loanPurpose', 'collateral', 'guarantee', 'principalBio', 'orgStructure', 'neighborhood', 'growthPlan', 'targetPopulation',
  'underwritingNote', 'guarantorPortfolio', 'taNeeds', 'underwriterNotes', 'primaryRepayment', 'secondaryRepayment', 'sponsors', 'loanSizingParagraph'];
const ROW_FIELDS = { risks: ['risk', 'mitigant'], team: ['bio'], customSections: ['body'], templateSections: ['body'] };

// The deal as the memo should read it: every free-response answer turned into paragraphs.
export function proseDeal(deal) {
  const d = { ...deal };
  for (const k of TEXT_FIELDS) if (typeof d[k] === 'string') d[k] = prose(d[k]);
  for (const [k, cols] of Object.entries(ROW_FIELDS)) {
    if (Array.isArray(d[k])) d[k] = d[k].map((r) => { const x = { ...r }; for (const c of cols) if (typeof x[c] === 'string') x[c] = prose(x[c]); return x; });
  }
  return d;
}
