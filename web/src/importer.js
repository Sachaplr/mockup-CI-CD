import { parseCsv } from './csv.js';
import { matrixToRecords } from './tabular.js';
import { validateRecords } from './validators.js';
import { parseXlsx } from './xlsx.js';

export const SUPPORTED_EXTENSIONS = ['csv', 'xlsx'];

export function extensionOf(filename) {
  return String(filename).split('.').pop().toLowerCase();
}

/**
 * Parse an uploaded file (CSV or XLSX) and validate every row.
 * @param {{ name: string, text(): Promise<string>, arrayBuffer(): Promise<ArrayBuffer> }} file
 * @returns {Promise<{ valid: object[], invalid: {row: number, errors: string[]}[] }>}
 */
export async function importFile(file) {
  const ext = extensionOf(file.name);
  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    throw new Error(`Unsupported file type ".${ext}". Use .csv or .xlsx`);
  }

  const matrix = ext === 'csv' ? parseCsv(await file.text()) : parseXlsx(await file.arrayBuffer());
  const { records, missing } = matrixToRecords(matrix);
  if (missing.length) throw new Error(`Missing required column(s): ${missing.join(', ')}`);
  if (records.length === 0) throw new Error('The file contains no data rows');
  return validateRecords(records);
}
