import { emptyDeal } from './sampleDeal.js';

// Spreadsheet layout: one row per field. Table rows repeat the table name.
//   field,value,value2,value3,value4
//   loanAmount,750000
//   projectSources,Senior construction loan,4420000
export const TABLES = {
  urgeUses: ['label', 'amount'],
  projectSources: ['label', 'amount'],
  projectUses: ['label', 'amount'],
  financials: ['year', 'type', 'revenue', 'netIncome'],
  repaymentOptions: ['option'],
  team: ['name', 'company', 'role', 'bio'],
};

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

export function dealFromCsv(text) {
  const deal = structuredClone(emptyDeal);
  Object.keys(TABLES).forEach((t) => (deal[t] = []));
  let known = 0;
  for (const r of parseCsv(text.replace(/^﻿/, ''))) {
    const key = r[0].trim();
    if (!key || key === 'field') continue;
    if (TABLES[key]) {
      const obj = {};
      TABLES[key].forEach((col, i) => (obj[col] = (r[i + 1] ?? '').trim()));
      deal[key].push(obj);
      known++;
    } else if (key in emptyDeal) {
      deal[key] = (r[1] ?? '').trim();
      known++;
    }
  }
  if (!known) throw new Error('No recognizable fields. Start from the downloadable template.');
  return deal;
}

const esc = (v) => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

export function dealToCsv(deal) {
  const lines = ['field,value,value2,value3,value4'];
  for (const key of Object.keys(emptyDeal)) {
    if (TABLES[key]) {
      for (const row of deal[key] || []) lines.push([key, ...TABLES[key].map((c) => row[c])].map(esc).join(','));
    } else lines.push([key, deal[key]].map(esc).join(','));
  }
  return lines.join('\r\n');
}

export function dealFromJson(text) {
  const parsed = JSON.parse(text);
  const deal = { ...structuredClone(emptyDeal) };
  for (const k of Object.keys(emptyDeal)) if (k in parsed) deal[k] = parsed[k];
  return deal;
}
