// Reads uploaded documents in the browser and turns them into text (or page images for
// scans and photos) that the AI can read. Nothing here leaves the browser; the heavy
// libraries load only when someone actually adds a file of that type.

export const MAX_FILES = 20;
const MAX_TEXT_PER_FILE = 60000; // characters
const MAX_PDF_PAGES = 60;
const MAX_IMAGES = 12; // photos + scanned PDF pages, across all files
const IMAGE_WIDTH = 1500; // px; enough to read a scanned page

export const ACCEPT = [
  '.pdf', '.docx', '.xlsx', '.xls', '.xlsm', '.ods', '.csv', '.tsv', '.txt', '.md', '.json',
  '.png', '.jpg', '.jpeg', '.webp', '.gif',
].join(',');

const ext = (name) => (String(name).toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '';

export function kindOf(file) {
  const e = ext(file.name);
  if (e === 'pdf') return 'pdf';
  if (e === 'docx') return 'word';
  if (['xlsx', 'xls', 'xlsm', 'ods'].includes(e)) return 'excel';
  if (['csv', 'tsv', 'txt', 'md', 'json'].includes(e)) return 'text';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(e) || file.type?.startsWith('image/')) return 'image';
  if (e === 'doc') return 'old-word';
  return 'unknown';
}

const trim = (text) => {
  const t = String(text || '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return t.length > MAX_TEXT_PER_FILE ? { text: t.slice(0, MAX_TEXT_PER_FILE), cut: true } : { text: t, cut: false };
};

function canvasToJpeg(canvas) {
  return canvas.toDataURL('image/jpeg', 0.78);
}

async function imageToDataUrl(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, IMAGE_WIDTH / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvasToJpeg(canvas);
}

let pdfjs;
async function loadPdfjs() {
  if (!pdfjs) {
    const [lib, worker] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]);
    lib.GlobalWorkerOptions.workerSrc = worker.default;
    pdfjs = lib;
  }
  return pdfjs;
}

async function readPdf(file, budget) {
  const lib = await loadPdfjs();
  const pdf = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages = Math.min(pdf.numPages, MAX_PDF_PAGES);
  const parts = [];
  const images = [];
  let scanned = 0;
  for (let p = 1; p <= pages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const text = content.items.map((it) => (it.str || '') + (it.hasEOL ? '\n' : ' ')).join('').trim();
    if (text.length >= 40) {
      parts.push(`--- Page ${p} ---\n${text}`);
    } else {
      // Little or no text: probably a scan. Send a picture of the page instead.
      scanned++;
      if (budget.images > 0) {
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: Math.min(2, IMAGE_WIDTH / base.width) });
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport }).promise;
        images.push({ label: `page ${p}`, url: canvasToJpeg(canvas) });
        budget.images--;
      }
    }
    page.cleanup();
  }
  await pdf.destroy();
  const { text, cut } = trim(parts.join('\n\n'));
  const notes = [];
  if (pdf.numPages > pages) notes.push(`only the first ${pages} of ${pdf.numPages} pages were read`);
  if (scanned) notes.push(`${scanned} scanned page${scanned > 1 ? 's' : ''}${scanned > images.length ? `, ${images.length} sent as pictures (limit reached)` : ' sent as pictures'}`);
  if (cut) notes.push('very long, so the end was cut');
  return { text, images, pages: pdf.numPages, notes };
}

async function readWord(file) {
  const mammoth = (await import('mammoth')).default;
  const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  const { text, cut } = trim(value);
  return { text, images: [], notes: cut ? ['very long, so the end was cut'] : [] };
}

async function readExcel(file) {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const sheets = wb.SheetNames.map((name) => {
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name], { blankrows: false, strip: true });
    return csv.trim() ? `--- Sheet: ${name} ---\n${csv}` : '';
  }).filter(Boolean);
  const { text, cut } = trim(sheets.join('\n\n'));
  return { text, images: [], sheets: sheets.length, notes: cut ? ['very long, so the end was cut'] : [] };
}

// budget is shared across a batch so the total number of pictures stays small.
export async function readDocument(file, budget = { images: MAX_IMAGES }) {
  const kind = kindOf(file);
  if (kind === 'old-word') throw new Error('Old .doc format. Open it in Word and “Save As” .docx or PDF.');
  if (kind === 'unknown') throw new Error('This file type can’t be read. Use PDF, Word (.docx), Excel, CSV, text or a photo.');
  if (file.size > 40 * 1024 * 1024) throw new Error('Too big (over 40 MB).');

  let result;
  if (kind === 'pdf') result = await readPdf(file, budget);
  else if (kind === 'word') result = await readWord(file);
  else if (kind === 'excel') result = await readExcel(file);
  else if (kind === 'image') {
    if (budget.images <= 0) throw new Error(`Too many pictures in one batch (limit ${MAX_IMAGES}). Scan the rest in a second batch.`);
    budget.images--;
    result = { text: '', images: [{ label: 'photo', url: await imageToDataUrl(file) }], notes: [] };
  } else {
    const { text, cut } = trim(await file.text());
    result = { text, images: [], notes: cut ? ['very long, so the end was cut'] : [] };
  }
  if (!result.text && !result.images.length) throw new Error('No readable text found in this file.');
  return { kind, ...result };
}

export function newBudget() {
  return { images: MAX_IMAGES };
}
