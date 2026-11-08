// Pulls simple chart data out of the deal form text. Only uses numbers the underwriter typed.
const num = (s) => Number(String(s).replace(/[^0-9.]/g, '')) || 0

// "Sources: A $1,000; B $2,000; total ... Uses: ..." -> {sources:[], uses:[]}
export function parseSourcesUses(text) {
  const out = { sources: [], uses: [] }
  if (!text) return out
  const split = text.split(/uses\s*:/i)
  const grab = (chunk) =>
    chunk
      .replace(/sources\s*:/i, '')
      .split(/[;\n]/)
      .map((p) => p.trim())
      .filter((p) => p && !/total/i.test(p))
      .map((p) => {
        const m = p.match(/^(.*?)\s*\$\s?([\d,]+(?:\.\d+)?)/)
        return m ? { label: m[1].trim().replace(/^[\d.]+\s*/, ''), value: num(m[2]) } : null
      })
      .filter(Boolean)
  out.sources = grab(split[0])
  out.uses = grab(split[1] || '')
  return out
}
