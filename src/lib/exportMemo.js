const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function memoToText(deal, sections) {
  return `Investment Memo: ${deal.borrower || 'Untitled'}\n\n` + sections.map((s) => `${s.title}${s.rating ? ` [${s.rating.toUpperCase()}]` : ''}\n${s.body}`).join('\n\n')
}

// Downloads a .doc file that Word opens and can edit.
export function downloadWord(deal, sections) {
  const html = `<html><head><meta charset="utf-8"><title>Investment Memo</title></head><body style="font-family:Calibri,Arial,sans-serif">
<h1>Investment Memo: ${esc(deal.borrower || '')}</h1>
${sections.map((s) => `<h2>${esc(s.title)}${s.rating ? ` (${esc(s.rating)})` : ''}</h2><p>${esc(s.body).replace(/\n/g, '<br>')}</p>`).join('\n')}
</body></html>`
  const url = URL.createObjectURL(new Blob([html], { type: 'application/msword' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `Investment Memo - ${deal.borrower || 'draft'}.doc`
  a.click()
  URL.revokeObjectURL(url)
}
