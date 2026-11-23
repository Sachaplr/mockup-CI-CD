import { defineConfig } from '@playwright/test';

const PORT = 8080;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }], ['json', { outputFile: 'reports/playwright.json' }]]
    : [['list'], ['json', { outputFile: 'reports/playwright.json' }]],
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: 'on-first-retry', screenshot: 'only-on-failure', video: process.env.CI ? 'on' : 'off' },
  webServer: {
    command: `php -S 127.0.0.1:${PORT} -t public public/index.php`,
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    env: { APP_DB: 'var/e2e.sqlite' },
  },
});
