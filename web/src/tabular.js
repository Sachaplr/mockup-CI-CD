// Turns a raw matrix (from CSV or XLSX) into normalized record objects.
const ALIASES = {
  customer: ['customer', 'customer name', 'client', 'name'],
  email: ['email', 'e-mail', 'mail'],
  amount: ['amount', 'total', 'price', 'revenue'],
  date: ['date', 'order date', 'order_date'],
};
export const REQUIRED_COLUMNS = Object.keys(ALIASES);

export function normalizeHeader(header) {
  const key = String(header ?? '').trim().toLowerCase();
  return REQUIRED_COLUMNS.find((field) => ALIASES[field].includes(key)) ?? null;
}

/** Excel stores dates as days since 1899-12-30. */
export function excelSerialToIso(serial) {
  const ms = Date.UTC(1899, 11, 30) + Math.round(serial * 86400000);
  return new Date(ms).toISOString().slice(0, 10);
}

export function normalizeDate(value) {
  if (typeof value === 'number') return excelSerialToIso(value);
  const s = String(value ?? '').trim();
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  return s;
}

/** Accepts 1234.5, "1,234.50", "1 234,50", "€12". Returns null when not a number. */
export function normalizeAmount(value) {
  if (typeof value === 'number') return value;
  let s = String(value ?? '').replace(/[€$£\s]/g, '');
  if (s === '') return null;
  if (s.includes(',') && s.includes('.')) s = s.replace(/,/g, '');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {unknown[][]} matrix first row is the header
 * @returns {{ records: object[], missing: string[] }} records carry their 1-based source `row`
 */
export function matrixToRecords(matrix) {
  const [header = [], ...body] = matrix;
  const columns = header.map(normalizeHeader);
  const missing = REQUIRED_COLUMNS.filter((c) => !columns.includes(c));
  if (missing.length) return { records: [], missing };

  const records = [];
  body.forEach((cells, index) => {
    if (cells.every((c) => String(c ?? '').trim() === '')) return; // skip blank lines
    const raw = {};
    columns.forEach((field, i) => {
      if (field) raw[field] = cells[i];
    });
    records.push({
      row: index + 2,
      customer: String(raw.customer ?? '').trim(),
      email: String(raw.email ?? '').trim().toLowerCase(),
      amount: normalizeAmount(raw.amount),
      date: normalizeDate(raw.date),
    });
  });
  return { records, missing: [] };
}
