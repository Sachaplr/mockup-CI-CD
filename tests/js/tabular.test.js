import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { excelSerialToIso, matrixToRecords, normalizeAmount, normalizeDate, normalizeHeader } from '../../web/src/tabular.js';

describe('normalizeHeader', () => {
  it('maps aliases case-insensitively', () => {
    assert.equal(normalizeHeader(' Client '), 'customer');
    assert.equal(normalizeHeader('E-Mail'), 'email');
    assert.equal(normalizeHeader('Order Date'), 'date');
    assert.equal(normalizeHeader('unknown'), null);
  });
});

describe('normalizeAmount', () => {
  it('handles locale and currency formats', () => {
    assert.equal(normalizeAmount('1,234.50'), 1234.5);
    assert.equal(normalizeAmount('1 234,50'), 1234.5);
    assert.equal(normalizeAmount('€12'), 12);
    assert.equal(normalizeAmount(7), 7);
  });

  it('returns null for non-numeric input', () => {
    assert.equal(normalizeAmount('abc'), null);
    assert.equal(normalizeAmount(''), null);
  });
});

describe('dates', () => {
  it('converts Excel serials without timezone drift', () => {
    assert.equal(excelSerialToIso(45306), '2024-01-15');
    assert.equal(normalizeDate(45306), '2024-01-15');
  });

  it('converts DD/MM/YYYY and keeps ISO', () => {
    assert.equal(normalizeDate('5/3/2024'), '2024-03-05');
    assert.equal(normalizeDate('2024-03-05'), '2024-03-05');
  });
});

describe('matrixToRecords', () => {
  it('maps columns in any order and tracks source rows', () => {
    const { records, missing } = matrixToRecords([
      ['Date', 'Total', 'E-mail', 'Client'],
      ['2024-01-01', '10', 'A@B.IO', ' Ann '],
      ['', '', '', ''],
      ['2024-01-02', '20', 'c@d.io', 'Cy'],
    ]);
    assert.deepEqual(missing, []);
    assert.deepEqual(records, [
      { row: 2, customer: 'Ann', email: 'a@b.io', amount: 10, date: '2024-01-01' },
      { row: 4, customer: 'Cy', email: 'c@d.io', amount: 20, date: '2024-01-02' },
    ]);
  });

  it('reports missing required columns', () => {
    assert.deepEqual(matrixToRecords([['customer', 'email'], ['a', 'b']]).missing, ['amount', 'date']);
  });
});
