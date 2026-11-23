// Builds the human-friendly CI report (Markdown) shown on the GitHub run page and in PR comments.
//
//   node scripts/ci-summary.mjs [reportsDir]   ->  Markdown on stdout
//
// Inputs (all optional, missing files are reported as "non disponible"):
//   NEEDS_JSON               `toJSON(needs)` from the report job (result of each pipeline stage)
//   <dir>/js-junit.xml       node --test JUnit output
//   <dir>/php-junit.xml      PHPUnit JUnit output
//   <dir>/playwright.json    Playwright JSON report (includes test.step() tree)
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const MARKER = '<!-- ci-summary -->';

// ---------- parsers ----------
const decode = (s) =>
  s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const strAttr = (tag, name) => decode(new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? '');

/**
 * Counts <testcase> elements directly: node's reporter has no totals on the root and PHPUnit
 * nests suites, so summing suite attributes would be wrong or double-count.
 * @returns {{ total: number, failed: number, skipped: number, passed: number, failures: string[] }}
 */
export function parseJunit(xml) {
  let failed = 0;
  let skipped = 0;
  const failures = [];
  const cases = xml.split('<testcase').slice(1);
  for (const chunk of cases) {
    if (/<(failure|error)\b/.test(chunk)) {
      failed++;
      failures.push(strAttr(chunk.split('>')[0] + '>', 'name'));
    } else if (/<skipped\b/.test(chunk)) {
      skipped++;
    }
  }
  const total = cases.length;
  return { total, failed, skipped, passed: total - failed - skipped, failures };
}

const stripAnsi = (s) => String(s ?? '').replace(/\u001b\[[0-9;]*m/g, '');

// Playwright's JSON reporter already keeps only test.step() entries (nested via `steps`).
function collectSteps(steps = []) {
  return steps
    .map((s) => ({
      title: s.title,
      ok: !s.error,
      duration: s.duration ?? 0,
      error: s.error ? stripAnsi(s.error.message).split('\n').find((l) => l.trim()) : undefined,
      children: collectSteps(s.steps),
    }));
}

/** @returns {{ title: string, status: string, duration: number, steps: object[] }[]} */
export function parsePlaywright(json) {
  const tests = [];
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const last = t.results?.at(-1) ?? {};
        tests.push({ title: spec.title, status: t.status, duration: last.duration ?? 0, steps: collectSteps(last.steps) });
      }
    }
    (suite.suites ?? []).forEach(walk);
  };
  (json.suites ?? []).forEach(walk);
  return tests;
}

// ---------- rendering ----------
const ICON = { success: '✅', failure: '❌', cancelled: '⏹️', skipped: '⏭️' };
const CLASS = { success: 'ok', failure: 'ko', cancelled: 'skip', skipped: 'skip' };
const TEST_ICON = { expected: '✅', unexpected: '❌', flaky: '⚠️', skipped: '⏭️' };
const seconds = (ms) => `${(ms / 1000).toFixed(1)} s`;

const STAGES = [
  { id: 'lint', label: 'Lint' },
  { id: 'js-tests', label: 'Tests JS' },
  { id: 'php-tests', label: 'Tests PHP' },
  { id: 'build', label: 'Build' },
  { id: 'e2e', label: 'Parcours E2E<br/>navigateur réel' },
  { id: 'security', label: 'Sécurité<br/>audit dépendances' },
  { id: 'docker', label: 'Image Docker<br/>+ smoke test' },
  { id: 'workflows', label: 'Lint workflows' },
];
const EDGES = [
  ['lint', 'build'],
  ['js-tests', 'build'],
  ['php-tests', 'build'],
  ['build', 'e2e'],
];

const mermaidId = (id) => id.replace(/-/g, '_');

function diagram(needs, details) {
  const lines = ['```mermaid', 'flowchart LR'];
  for (const { id, label } of STAGES) {
    const result = needs[id]?.result ?? 'skipped';
    const detail = details[id] ? `<br/>${details[id]}` : '';
    lines.push(`  ${mermaidId(id)}["${ICON[result] ?? '❔'} ${label}${detail}"]:::${CLASS[result] ?? 'skip'}`);
  }
  for (const [a, b] of EDGES) lines.push(`  ${mermaidId(a)} --> ${mermaidId(b)}`);
  lines.push(
    '  classDef ok fill:#d1fae5,stroke:#059669,color:#064e3b',
    '  classDef ko fill:#fee2e2,stroke:#dc2626,color:#7f1d1d',
    '  classDef skip fill:#f1f5f9,stroke:#94a3b8,color:#334155',
    '```',
  );
  return lines.join('\n');
}

function renderSteps(steps, depth = 0) {
  return steps.flatMap((s) => {
    const pad = '  '.repeat(depth);
    const line = `${pad}- ${s.ok ? '✅' : '❌'} ${s.title} _(${seconds(s.duration)})_`;
    const err = s.error ? [`${pad}  - 💥 \`${s.error}\``] : [];
    return [line, ...err, ...renderSteps(s.children, depth + 1)];
  });
}

/**
 * @param {{ needs?: Record<string, {result: string}>, js?: object, php?: object, e2e?: object[], runUrl?: string }} input
 */
export function buildSummary({ needs = {}, js, php, e2e, runUrl }) {
  const countLabel = (r) => (r ? `${r.passed}/${r.total} tests` : undefined);
  const details = { 'js-tests': countLabel(js), 'php-tests': countLabel(php) };
  if (e2e) details.e2e = `${e2e.filter((t) => t.status === 'expected').length}/${e2e.length} parcours`;

  const failedStages = STAGES.filter((s) => needs[s.id]?.result === 'failure');
  const verdict = failedStages.length
    ? `❌ **${failedStages.length} étape(s) en échec** : ${failedStages.map((s) => s.label.split('<')[0]).join(', ')}`
    : Object.values(needs).some((n) => n.result === 'cancelled')
      ? '⏹️ **Pipeline annulé**'
      : '✅ **Tout est vert, le code peut être fusionné**';

  const out = [MARKER, '# 🚦 Résultat du pipeline', '', verdict, '', diagram(needs, details), ''];

  out.push('## 🧪 Tests', '', '| Suite | Total | ✅ Réussis | ❌ Échecs | ⏭️ Ignorés |', '|---|---:|---:|---:|---:|');
  const row = (name, r) =>
    r ? `| ${name} | ${r.total} | ${r.passed} | ${r.failed} | ${r.skipped} |` : `| ${name} | | _non disponible_ | | |`;
  out.push(row('JavaScript (unitaires)', js), row('PHP (unitaires, PHPUnit)', php));
  if (e2e) {
    const n = (s) => e2e.filter((t) => t.status === s).length;
    out.push(`| Navigateur (E2E, Playwright) | ${e2e.length} | ${n('expected')} | ${n('unexpected')} | ${n('skipped')} |`);
  } else {
    out.push('| Navigateur (E2E, Playwright) | | _non disponible_ | | |');
  }
  for (const [name, r] of [['JS', js], ['PHP', php]]) {
    if (r?.failures.length) out.push('', `**Tests ${name} en échec :**`, ...r.failures.map((f) => `- ❌ ${f}`));
  }

  if (e2e?.length) {
    out.push('', '## 🎭 Parcours utilisateur, étape par étape', '');
    for (const t of e2e) {
      out.push(`### ${TEST_ICON[t.status] ?? '❔'} ${t.title} _(${seconds(t.duration)})_`, '', ...renderSteps(t.steps), '');
    }
  }

  if (runUrl) {
    out.push('---', `📎 [Ouvrir le run complet](${runUrl}) · télécharger les artefacts **playwright-report** (rapport HTML, traces, vidéos) en bas de cette page.`);
  }
  return out.join('\n') + '\n';
}

// ---------- CLI ----------
function readIfExists(path, parse) {
  return existsSync(path) ? parse(readFileSync(path, 'utf8')) : undefined;
}

function main() {
  const dir = process.argv[2] ?? 'reports';
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env;
  process.stdout.write(
    buildSummary({
      needs: JSON.parse(process.env.NEEDS_JSON || '{}'),
      js: readIfExists(`${dir}/js-junit.xml`, parseJunit),
      php: readIfExists(`${dir}/php-junit.xml`, parseJunit),
      e2e: readIfExists(`${dir}/playwright.json`, (t) => parsePlaywright(JSON.parse(t))),
      runUrl: GITHUB_RUN_ID ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}` : undefined,
    }),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
