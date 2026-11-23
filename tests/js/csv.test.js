import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseCsv, toCsv } from '../../web/src/csv.js';

describe('parseCsv', () => {
  it('parses simple rows', () => {
    assert.deepEqual(parseCsv('a,b\n1,2\n'), [['a', 'b'], ['1', '2']]);
  });

  it('handles CRLF line endings and a BOM', () => {
    assert.deepEqual(parseCsv('\uFEFFa,b\r\n1,2\r\n'), [['a', 'b'], ['1', '2']]);
  });

  it('handles quoted fields with commas, quotes and newlines', () => {
    assert.deepEqual(parseCsv('n,note\n"Smith, J","said ""hi""\nthere"'), [
      ['n', 'note'],
      ['Smith, J', 'said "hi"\nthere'],
    ]);
  });

  it('detects semicolon and tab delimiters', () => {
    assert.deepEqual(parseCsv('a;b\n1;2'), [['a', 'b'], ['1', '2']]);
    assert.deepEqual(parseCsv('a\tb\n1\t2'), [['a', 'b'], ['1', '2']]);
  });

  it('keeps empty fields', () => {
    assert.deepEqual(parseCsv('a,b,c\n1,,3'), [['a', 'b', 'c'], ['1', '', '3']]);
  });
});

describe('toCsv', () => {
  it('quotes cells that need it', () => {
    assert.equal(toCsv([['a,b', 'say "x"']]), '"a,b","say ""x"""');
  });

  it('neutralises spreadsheet formula injection but keeps negative numbers', () => {
    assert.equal(toCsv([['=SUM(A1)', '-5']]), "'=SUM(A1),-5");
  });

  it('round-trips through parseCsv', () => {
    const rows = [['name', 'note'], ['Ann, B', 'line1\nline2']];
    assert.deepEqual(parseCsv(toCsv(rows)), rows);
  });
});
