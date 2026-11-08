// Reads uploaded files in the browser. Nothing is uploaded anywhere by this step.
const MAX_CHARS = 40000

async function pdfText(file) {
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  let out = ''
  for (let i = 1; i <= doc.numPages && out.length < MAX_CHARS; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    out += content.items.map((it) => it.str).join(' ') + '\n'
  }
  return out
}

async function docxText(file) {
  const mammoth = await import('mammoth/mammoth.browser.js')
  const res = await (mammoth.default || mammoth).extractRawText({ arrayBuffer: await file.arrayBuffer() })
  return res.value
}

async function xlsxText(file) {
  const { default: readXlsxFile, readSheetNames } = await import('read-excel-file/browser')
  const names = await readSheetNames(file)
  let out = ''
  for (const name of names) {
    const rows = await readXlsxFile(file, { sheet: name })
    out += `## Sheet: ${name}\n` + rows.map((r) => r.map((c) => c ?? '').join(' | ')).join('\n') + '\n'
  }
  return out
}

export async function readFile(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  try {
    let text = ''
    if (ext === 'pdf') text = await pdfText(file)
    else if (ext === 'docx') text = await docxText(file)
    else if (ext === 'xlsx') text = await xlsxText(file)
    else if (['csv', 'txt', 'md'].includes(ext)) text = await file.text()
    else return { name: file.name, size: file.size, text: '', error: 'This file type can’t be read yet (try PDF, Word .docx, Excel .xlsx, CSV or text).' }
    return { name: file.name, size: file.size, text: text.slice(0, MAX_CHARS) }
  } catch {
    return { name: file.name, size: file.size, text: '', error: 'Could not read this file.' }
  }
}
