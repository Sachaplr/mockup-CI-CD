import * as XLSX from 'xlsx';

/**
 * Reads the first sheet of an .xlsx workbook into a matrix.
 * Dates stay as Excel serial numbers; tabular.js converts them (avoids timezone drift).
 * @param {ArrayBuffer | Uint8Array} data
 * @returns {unknown[][]}
 */
export function parseXlsx(data) {
  const workbook = XLSX.read(data, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('The workbook has no sheets');
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: true, defval: '' });
}
