import { expect, test } from '@playwright/test';

// Chaque test.step() apparaît dans le rapport de la CI ("Parcours utilisateur, étape par étape").
// Compte unique par exécution pour pouvoir relancer la suite sur la même base.
const email = `user-${Date.now()}@example.com`;
const password = 'journey123';

test.describe.configure({ mode: 'serial' });

test('Validation du formulaire d’inscription', async ({ page }) => {
  await test.step('Ouvrir la page et choisir « Créer un compte »', async () => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Create one' }).click();
  });

  await test.step('Soumettre le formulaire vide', async () => {
    await page.getByRole('button', { name: 'Create account' }).click();
  });

  await test.step('Les erreurs de nom, email et mot de passe s’affichent', async () => {
    await expect(page.getByTestId('error-name')).toBeVisible();
    await expect(page.getByTestId('error-email')).toBeVisible();
    await expect(page.getByTestId('error-password')).toBeVisible();
  });
});

test('Parcours complet : inscription, imports CSV/XLSX, export, reconnexion', async ({ page }) => {
  await test.step('1. Créer un compte', async () => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Create one' }).click();
    await page.getByLabel('Name').fill('Journey User');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm password').fill(password);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByTestId('welcome')).toHaveText('Welcome, Journey User');
  });

  await test.step('2. Importer un CSV avec erreurs : seule la ligne valide est acceptée', async () => {
    await page.getByTestId('file-input').setInputFiles('samples/sales-with-errors.csv');
    await expect(page.getByTestId('preview-valid')).toHaveText('1');
    await expect(page.getByTestId('preview-invalid')).toHaveText('3');
    await expect(page.getByTestId('preview-errors')).toContainText('Row 3');
    await page.getByRole('button', { name: /Import 1 valid/ }).click();
    await expect(page.getByTestId('import-result')).toHaveText('Imported 1 row(s)');
    await expect(page.getByTestId('total')).toHaveText('$500.00');
  });

  await test.step('3. Importer un CSV valide (3 lignes)', async () => {
    await page.getByTestId('file-input').setInputFiles('samples/sales.csv');
    await page.getByRole('button', { name: /Import 3 valid/ }).click();
    await expect(page.getByTestId('summary')).toContainText('4 record(s)');
    await expect(page.getByTestId('total')).toHaveText('$2,130.00');
  });

  await test.step('4. Importer un classeur XLSX (dates Excel converties)', async () => {
    await page.getByTestId('file-input').setInputFiles('samples/sales.xlsx');
    await expect(page.getByTestId('preview-valid')).toHaveText('3');
    await page.getByRole('button', { name: /Import 3 valid/ }).click();
    await expect(page.getByTestId('summary')).toContainText('7 record(s)');
    await expect(page.getByTestId('records-table')).toContainText('2024-02-03');
  });

  await test.step('5. Exporter les données en CSV', async () => {
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV' }).click();
    expect((await download).suggestedFilename()).toBe('records.csv');
  });

  await test.step('6. Se déconnecter puis se reconnecter : les données sont conservées', async () => {
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByTestId('summary')).toContainText('7 record(s)');
  });

  await test.step('7. Vider les données', async () => {
    await page.getByRole('button', { name: 'Clear all' }).click();
    await expect(page.getByTestId('summary')).toContainText('0 record(s)');
  });
});

test('Sécurité : mauvais mot de passe et fichier non supporté refusés', async ({ page }) => {
  await test.step('Connexion avec un mauvais mot de passe : refusée', async () => {
    await page.goto('/');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('not-the-password1');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByTestId('form-error')).toHaveText('Invalid email or password');
  });

  await test.step('Connexion avec le bon mot de passe : acceptée', async () => {
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByTestId('welcome')).toBeVisible();
  });

  await test.step('Importer un fichier .txt : refusé avec un message clair', async () => {
    await page.getByTestId('file-input').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') });
    await expect(page.getByTestId('import-error')).toContainText('Unsupported file type');
  });
});
