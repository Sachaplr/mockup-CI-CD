import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  validateEmail,
  validateLogin,
  validatePassword,
  validateRecord,
  validateRecords,
  validateRegistration,
} from '../../web/src/validators.js';

describe('account validation', () => {
  it('validates emails', () => {
    assert.ok(validateEmail('a@b.io'));
    for (const bad of ['', 'a@b', 'a b@c.io', '@b.io', null]) assert.equal(validateEmail(bad), false, String(bad));
  });

  it('requires 8 chars with a letter and a digit', () => {
    assert.deepEqual(validatePassword('abc12345'), []);
    assert.ok(validatePassword('short1').length > 0);
    assert.ok(validatePassword('lettersonly').length > 0);
    assert.ok(validatePassword('12345678').length > 0);
  });

  it('reports every invalid registration field', () => {
    const errors = validateRegistration({ name: '', email: 'x', password: 'y', confirm: 'z' });
    assert.deepEqual(Object.keys(errors).sort(), ['email', 'name', 'password']);
  });

  it('detects mismatched password confirmation', () => {
    const errors = validateRegistration({ name: 'A', email: 'a@b.io', password: 'abc12345', confirm: 'abc12346' });
    assert.deepEqual(Object.keys(errors), ['confirm']);
  });

  it('validates login', () => {
    assert.deepEqual(validateLogin({ email: 'a@b.io', password: 'x' }), {});
    assert.deepEqual(Object.keys(validateLogin({ email: '', password: '' })).sort(), ['email', 'password']);
  });
});

describe('record validation', () => {
  const ok = { customer: 'Acme', email: 'a@acme.io', amount: 10, date: '2024-02-29' };

  it('accepts a valid record (leap day included)', () => {
    assert.deepEqual(validateRecord(ok), []);
  });

  it('rejects impossible dates, bad amounts and empty customers', () => {
    assert.ok(validateRecord({ ...ok, date: '2023-02-29' }).length);
    assert.ok(validateRecord({ ...ok, amount: null }).length);
    assert.ok(validateRecord({ ...ok, amount: -1 }).length);
    assert.ok(validateRecord({ ...ok, customer: '  ' }).length);
  });

  it('splits records into valid and invalid with row numbers', () => {
    const { valid, invalid } = validateRecords([
      { row: 2, ...ok },
      { row: 3, ...ok, email: 'nope' },
    ]);
    assert.equal(valid.length, 1);
    assert.equal('row' in valid[0], false);
    assert.deepEqual(invalid.map((i) => i.row), [3]);
  });
});
