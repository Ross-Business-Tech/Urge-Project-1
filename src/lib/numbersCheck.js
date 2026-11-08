// Finds dollar amounts and percentages in the memo that don't appear in the deal form or uploads.
const pattern = /\$\s?[\d,]+(?:\.\d+)?\s?(?:[MKmk]\b|million|thousand)?|\b\d+(?:\.\d+)?\s?%/g

const normalize = (s) => s.replace(/[\s,]/g, '').toLowerCase()

export function numbersCheck(sections, deal, docs) {
  const source = normalize(
    Object.values(deal).join(' ') + ' ' + docs.map((d) => d.text || '').join(' '),
  )
  const digitsSource = source.replace(/\$/g, '')
  const issues = []
  for (const s of sections) {
    const found = new Set(s.body.match(pattern) || [])
    for (const f of found) {
      const n = normalize(f)
      if (!source.includes(n) && !digitsSource.includes(n.replace('$', ''))) {
        issues.push({ section: s.title, value: f })
      }
    }
  }
  return issues
}
