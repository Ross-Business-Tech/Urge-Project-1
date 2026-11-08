export const num = (v) => {
  if (v === null || v === undefined) return 0;
  const n = Number(String(v).replace(/[$,%\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
export const has = (v) => v !== null && v !== undefined && String(v).trim() !== '';
export const money = (v) =>
  '$' + Math.round(num(v)).toLocaleString('en-US');
export const moneyShort = (v) => {
  const n = num(v);
  if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 2) + 'M';
  if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
  return '$' + Math.round(n);
};
export const pct = (v, digits = 1) => (num(v) * 100).toFixed(digits) + '%';
export const sum = (rows, key = 'amount') => rows.reduce((t, r) => t + num(r[key]), 0);
export const fmtDate = (d) => {
  if (!has(d)) return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const dt = new Date(d + 'T12:00:00');
  return isNaN(dt) ? d : dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};
export const or = (v, fallback) => (has(v) ? v : fallback);
