import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MARKER, buildSummary, parseJunit, parsePlaywright } from '../../scripts/ci-summary.mjs';

const NODE_XML = `<?xml version="1.0" encoding="utf-8"?>
<testsuites>
  <testsuite name="a" tests="3" failures="1">
    <testcase name="works" classname="test"/>
    <testcase name="breaks &amp; burns" classname="test"><failure message="boom"/></testcase>
    <testcase name="later" classname="test"><skipped/></testcase>
  </testsuite>
</testsuites>`;

const PHPUNIT_XML = `<testsuites>
  <testsuite name="unit" tests="2"><testsuite name="x" tests="2">
    <testcase name="a" class="X"/><testcase name="b" class="X"/>
  </testsuite></testsuite>
</testsuites>`;

const PW = {
  suites: [{
    title: 'journey.spec.js',
    specs: [{
      title: 'Parcours',
      tests: [{
        status: 'unexpected',
        results: [{ duration: 2500, steps: [
          { title: 'Créer un compte', duration: 800, steps: [{ title: 'Sous-étape', duration: 5 }] },
          { title: 'Importer', duration: 100, error: { message: '\u001b[31mExpected: 1\u001b[39m\nReceived: 2' } },
        ] }],
      }],
    }],
  }],
};

describe('parseJunit', () => {
  it('counts test cases and lists failures with decoded names (node)', () => {
    assert.deepEqual(parseJunit(NODE_XML), { total: 3, failed: 1, skipped: 1, passed: 1, failures: ['breaks & burns'] });
  });

  it('does not double-count nested suites (PHPUnit)', () => {
    const r = parseJunit(PHPUNIT_XML);
    assert.equal(r.total, 2);
    assert.equal(r.passed, 2);
    assert.deepEqual(r.failures, []);
  });
});

describe('parsePlaywright', () => {
  it('reads the step tree, with an ANSI-free first error line', () => {
    const [t] = parsePlaywright(PW);
    assert.equal(t.status, 'unexpected');
    assert.deepEqual(t.steps.map((s) => [s.title, s.ok]), [['Créer un compte', true], ['Importer', false]]);
    assert.equal(t.steps[1].error, 'Expected: 1');
    assert.equal(t.steps[0].children[0].title, 'Sous-étape');
  });
});

describe('buildSummary', () => {
  const green = Object.fromEntries(['lint', 'js-tests', 'php-tests', 'build', 'e2e', 'security', 'docker', 'workflows'].map((k) => [k, { result: 'success' }]));

  it('says everything is green and colours the diagram', () => {
    const md = buildSummary({ needs: green, js: parseJunit(PHPUNIT_XML), php: parseJunit(PHPUNIT_XML) });
    assert.ok(md.startsWith(MARKER));
    assert.match(md, /Tout est vert/);
    assert.match(md, /```mermaid/);
    assert.match(md, /js_tests\["✅ Tests JS<br\/>2\/2 tests"\]:::ok/);
  });

  it('names the failed stage, shows failing tests and the failing step', () => {
    const needs = { ...green, 'js-tests': { result: 'failure' }, build: { result: 'skipped' } };
    const md = buildSummary({ needs, js: parseJunit(NODE_XML), e2e: parsePlaywright(PW) });
    assert.match(md, /1 étape\(s\) en échec.*Tests JS/);
    assert.match(md, /:::ko/);
    assert.match(md, /❌ breaks & burns/);
    assert.match(md, /- ❌ Importer/);
    assert.match(md, /💥 `Expected: 1`/);
  });

  it('degrades gracefully when reports are missing', () => {
    assert.match(buildSummary({ needs: green }), /non disponible/);
  });
});
