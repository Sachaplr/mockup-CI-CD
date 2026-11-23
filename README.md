# Sales Importer: a mock app for showing off CI/CD

A small **PHP + vanilla JS** web app whose only purpose is to give a CI/CD pipeline something real to build, test and ship.

**User journey:** create account → log in → import sales data from **`.csv` or `.xlsx`** (with per-row validation) → view totals → export CSV → clear data → log out.

## Stack

| Layer | Tech |
|---|---|
| Backend | PHP 8.2+, no framework, SQLite (PDO), session auth, JSON API in `src/` |
| Frontend | Vanilla JS (ES modules) in `web/src/`, bundled by esbuild; XLSX parsing via SheetJS |
| Unit tests | JS: `node --test` · PHP: PHPUnit 11 |
| E2E tests | Playwright (Chromium) drives the real app through the whole user journey |
| Packaging | Multi-stage Dockerfile |

## Run it locally

```bash
npm install && composer install
npm run build          # bundles web/src -> public/assets/app.js
npm run serve          # http://127.0.0.1:8080
```

Try the files in [`samples/`](samples/): `sales.csv`, `sales.xlsx`, and `sales-with-errors.csv` (1 good row, 3 rejected for different reasons).

## Test it

```bash
npm run lint           # ESLint
npm test               # 32 JS unit tests (CSV parser, XLSX import, validators, formatters)
vendor/bin/phpunit     # 19 PHP tests (API, auth, per-user data isolation, validation)
npm run test:e2e       # Playwright: full browser journey (needs php + `npx playwright install chromium`)
```

## The pipelines (`.github/`)

### `ci.yml`: on every PR and push to `main`

```
lint ──────┐
js-tests ──┼─► build ─► e2e ──┐
php-tests ─┘  (artifact)      │
security  (npm audit, composer audit) ├─► ci-passed   ← the one required check
docker    (build + container smoke test) ┤
workflows (actionlint) ──────────┘
```

What it demonstrates:
- **Matrix builds**: JS on Node 20/22, PHP on 8.2/8.3/8.4, in parallel.
- **Fail fast, fan in**: cheap checks gate the expensive browser tests; `ci-passed` gives branch protection one stable status name.
- **Artifacts**: the bundle is built once and reused by the E2E job; Playwright traces/screenshots are uploaded on failure.
- **Caching** (npm, Composer, Docker layers via GHA cache) and **concurrency** (superseded PR runs are cancelled).
- **Job summary**: coverage table rendered on the run page.
- **Supply-chain & quality gates**: dependency audits, actionlint, Dockerfile build + smoke test.

### `cd.yml`: delivery

- push to `main` → build image → push to **GHCR** → deploy to **staging** → smoke test
- push tag `v1.2.3` → same, then **production** behind a manual approval → GitHub Release with generated notes
- Images are promoted **by digest**, so what was tested is exactly what ships.
- The deploy steps are mocked (`echo`); swap in `ssh`/`kubectl`/a PaaS CLI.

### `codeql.yml` & `dependabot.yml`
Security scanning (JS) on PRs and weekly, plus weekly dependency PRs for Actions, npm, Composer and Docker.

## Enabling it on GitHub

1. Push the repo; CI runs automatically.
2. **Settings → Environments**: create `staging` and `production`; add *Required reviewers* to `production`.
3. **Settings → Branches**: protect `main`, require the **CI passed** status check.
4. Release: `git tag v1.0.0 && git push --tags`.

## Good demos for an audience

- **Break something on a branch**, e.g. make `validateEmail` accept anything. Unit tests and the E2E journey fail with a clear red ✗; the PR can't merge.
- **A real catch that happened while building this**: the PHP code used `mb_strlen` without declaring `ext-mbstring`. PHPUnit passed on the full PHP image, but the E2E job on a leaner PHP install failed with a 500. The fix was one line in `composer.json`. This is exactly why the pipeline exists.
- Open a PR that only edits `README.md` and show the run page, then add `paths-ignore` to skip CI for docs.
- Push a tag and watch the production approval gate.

## Notes
- Actions are referenced by major version tag (`@v4`). For stricter supply-chain hygiene pin to commit SHAs; Dependabot keeps them updated either way.
- PHP's built-in server and SQLite are fine for a demo, not for production traffic.
- `xlsx` is installed from the vendor's CDN tarball (the npm registry copy is stale and has known advisories).
