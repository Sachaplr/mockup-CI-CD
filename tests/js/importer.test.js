import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { importFile } from '../../web/src/importer.js';

// Minimal File-like wrapper so the browser-facing code runs unchanged in Node.
const fileLike = (path) => {
  const buf = readFileSync(path);
  return {
    name: path,
    text: async () => buf.toString('utf8'),
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  };
};
const textFile = (name, content) => ({ name, text: async () => content, arrayBuffer: async () => new ArrayBuffer(0) });

const sum = (rows) => rows.reduce((s, r) => s + r.amount, 0);

describe('importFile', () => {
  it('imports the sample CSV', async () => {
    const { valid, invalid } = await importFile(fileLike('samples/sales.csv'));
    assert.equal(valid.length, 3);
    assert.equal(invalid.length, 0);
    assert.equal(sum(valid), 1630);
  });

  it('imports the sample XLSX with identical results, dates included', async () => {
    const csv = await importFile(fileLike('samples/sales.csv'));
    const xlsx = await importFile(fileLike('samples/sales.xlsx'));
    assert.deepEqual(xlsx.valid, csv.valid);
  });

  it('separates valid rows from rejected ones', async () => {
    const { valid, invalid } = await importFile(fileLike('samples/sales-with-errors.csv'));
    assert.equal(valid.length, 1);
    assert.deepEqual(invalid.map((i) => i.row), [3, 4, 5]);
  });

  it('rejects unsupported extensions', async () => {
    await assert.rejects(importFile(textFile('notes.txt', 'x')), /Unsupported file type/);
  });

  it('rejects files missing required columns', async () => {
    await assert.rejects(importFile(textFile('a.csv', 'customer,email\na,b@c.io')), /amount, date/);
  });

  it('rejects files without data rows', async () => {
    await assert.rejects(importFile(textFile('a.csv', 'customer,email,amount,date\n')), /no data rows/);
  });
});
