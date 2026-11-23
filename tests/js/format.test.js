import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { escapeHtml, formatCurrency, summarize } from '../../web/src/format.js';

describe('format helpers', () => {
  it('formats currency', () => {
    assert.equal(formatCurrency(1234.5), '$1,234.50');
  });

  it('escapes HTML to prevent XSS from imported data', () => {
    assert.equal(escapeHtml('<img src=x onerror="a()">&\''), '&lt;img src=x onerror=&quot;a()&quot;&gt;&amp;&#39;');
    assert.equal(escapeHtml(null), '');
  });

  it('summarizes without floating point noise', () => {
    assert.deepEqual(summarize([{ amount: 0.1 }, { amount: 0.2 }]), { count: 2, total: 0.3 });
  });
});
