import { expect, test } from '@playwright/test';

// Unique account per run so the suite can be re-run against the same DB file.
const email = `user-${Date.now()}@example.com`;
const password = 'journey123';

test.describe.configure({ mode: 'serial' });

test('visitor sees client-side validation when creating an account', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Create one' }).click();
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByTestId('error-name')).toBeVisible();
  await expect(page.getByTestId('error-email')).toBeVisible();
  await expect(page.getByTestId('error-password')).toBeVisible();
});

test('full journey: register, import CSV, import XLSX, export, log out and back in', async ({ page }) => {
  // --- create account ---
  await page.goto('/');
  await page.getByRole('link', { name: 'Create one' }).click();
  await page.getByLabel('Name').fill('Journey User');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByTestId('welcome')).toHaveText('Welcome, Journey User');

  // --- import a CSV containing bad rows: only the valid one is accepted ---
  await page.getByTestId('file-input').setInputFiles('samples/sales-with-errors.csv');
  await expect(page.getByTestId('preview-valid')).toHaveText('1');
  await expect(page.getByTestId('preview-invalid')).toHaveText('3');
  await expect(page.getByTestId('preview-errors')).toContainText('Row 3');
  await page.getByRole('button', { name: /Import 1 valid/ }).click();
  await expect(page.getByTestId('import-result')).toHaveText('Imported 1 row(s)');
  await expect(page.getByTestId('total')).toHaveText('$500.00');

  // --- import a clean CSV ---
  await page.getByTestId('file-input').setInputFiles('samples/sales.csv');
  await page.getByRole('button', { name: /Import 3 valid/ }).click();
  await expect(page.getByTestId('summary')).toContainText('4 record(s)');
  await expect(page.getByTestId('total')).toHaveText('$2,130.00');

  // --- import an XLSX workbook ---
  await page.getByTestId('file-input').setInputFiles('samples/sales.xlsx');
  await expect(page.getByTestId('preview-valid')).toHaveText('3');
  await page.getByRole('button', { name: /Import 3 valid/ }).click();
  await expect(page.getByTestId('summary')).toContainText('7 record(s)');
  await expect(page.getByTestId('records-table')).toContainText('2024-02-03'); // Excel date converted correctly

  // --- export ---
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  expect((await download).suggestedFilename()).toBe('records.csv');

  // --- data survives logout/login ---
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByTestId('summary')).toContainText('7 record(s)');

  // --- clear ---
  await page.getByRole('button', { name: 'Clear all' }).click();
  await expect(page.getByTestId('summary')).toContainText('0 record(s)');
});

test('login fails with a wrong password and rejects unsupported files', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('not-the-password1');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByTestId('form-error')).toHaveText('Invalid email or password');

  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByTestId('welcome')).toBeVisible();

  await page.getByTestId('file-input').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') });
  await expect(page.getByTestId('import-error')).toContainText('Unsupported file type');
});
