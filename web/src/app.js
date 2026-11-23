import { api } from './api.js';
import { toCsv } from './csv.js';
import { escapeHtml, formatCurrency } from './format.js';
import { importFile } from './importer.js';
import { validateLogin, validateRegistration } from './validators.js';

const root = document.getElementById('app');
const state = { user: null, view: 'login', pending: null, importResult: null, importError: null };

const fieldError = (errors, name) =>
  errors[name] ? `<p class="error" data-testid="error-${name}">${escapeHtml(errors[name])}</p>` : '';

function authForm(kind, errors = {}, values = {}) {
  const isRegister = kind === 'register';
  return `
    <section class="card">
      <h1>${isRegister ? 'Create account' : 'Log in'}</h1>
      <form id="${kind}-form" novalidate>
        ${isRegister ? `<label>Name <input name="name" value="${escapeHtml(values.name)}" autocomplete="name"></label>${fieldError(errors, 'name')}` : ''}
        <label>Email <input name="email" type="email" value="${escapeHtml(values.email)}" autocomplete="email"></label>
        ${fieldError(errors, 'email')}
        <label>Password <input name="password" type="password" autocomplete="${isRegister ? 'new-password' : 'current-password'}"></label>
        ${fieldError(errors, 'password')}
        ${isRegister ? `<label>Confirm password <input name="confirm" type="password" autocomplete="new-password"></label>${fieldError(errors, 'confirm')}` : ''}
        ${errors.form ? `<p class="error" role="alert" data-testid="form-error">${escapeHtml(errors.form)}</p>` : ''}
        <button type="submit">${isRegister ? 'Create account' : 'Log in'}</button>
      </form>
      <p>${isRegister ? 'Already registered?' : 'No account yet?'}
        <a href="#" data-goto="${isRegister ? 'login' : 'register'}">${isRegister ? 'Log in' : 'Create one'}</a></p>
    </section>`;
}

function previewHtml() {
  if (state.importError) return `<p class="error" role="alert" data-testid="import-error">${escapeHtml(state.importError)}</p>`;
  const p = state.pending;
  if (!p) return '';
  const rejected = p.invalid.map((r) => `<li>Row ${r.row}: ${escapeHtml(r.errors.join(', '))}</li>`).join('');
  return `
    <div data-testid="import-preview">
      <p><strong data-testid="preview-valid">${p.valid.length}</strong> valid row(s),
         <strong data-testid="preview-invalid">${p.invalid.length}</strong> rejected.</p>
      ${rejected ? `<ul class="error" data-testid="preview-errors">${rejected}</ul>` : ''}
      <button id="confirm-import" ${p.valid.length ? '' : 'disabled'}>Import ${p.valid.length} valid row(s)</button>
    </div>`;
}

function dashboardHtml(records, summary) {
  const rows = records
    .map(
      (r) => `<tr><td>${escapeHtml(r.customer)}</td><td>${escapeHtml(r.email)}</td>
        <td class="num">${formatCurrency(r.amount)}</td><td>${escapeHtml(r.date)}</td></tr>`,
    )
    .join('');
  return `
    <header class="bar">
      <span data-testid="welcome">Welcome, ${escapeHtml(state.user.name)}</span>
      <button id="logout" class="secondary">Log out</button>
    </header>
    <section class="card">
      <h2>Import sales data</h2>
      <p>Upload a <code>.csv</code> or <code>.xlsx</code> file with columns: customer, email, amount, date.</p>
      <input type="file" id="file" accept=".csv,.xlsx" data-testid="file-input">
      ${previewHtml()}
      ${state.importResult ? `<p class="ok" data-testid="import-result">${escapeHtml(state.importResult)}</p>` : ''}
    </section>
    <section class="card">
      <h2>Records</h2>
      <p data-testid="summary">${summary.count} record(s) · total <strong data-testid="total">${formatCurrency(summary.total)}</strong></p>
      <table data-testid="records-table"><thead><tr><th>Customer</th><th>Email</th><th>Amount</th><th>Date</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4">No data yet</td></tr>'}</tbody></table>
      <button id="export" class="secondary" ${records.length ? '' : 'disabled'}>Export CSV</button>
      <button id="clear" class="secondary" ${records.length ? '' : 'disabled'}>Clear all</button>
    </section>`;
}

function download(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

async function render(errors = {}, values = {}) {
  if (!state.user) {
    root.innerHTML = authForm(state.view, errors, values);
    bindAuth();
    return;
  }
  const { data } = await api.records();
  root.innerHTML = dashboardHtml(data.records ?? [], data.summary ?? { count: 0, total: 0 });
  bindDashboard(data.records ?? []);
}

function bindAuth() {
  root.querySelector('[data-goto]').addEventListener('click', (e) => {
    e.preventDefault();
    state.view = e.target.dataset.goto;
    render();
  });

  root.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.target));
    const isRegister = state.view === 'register';
    const errors = isRegister ? validateRegistration(values) : validateLogin(values);
    if (Object.keys(errors).length) return render(errors, values);

    const res = await (isRegister ? api.register(values) : api.login(values));
    if (!res.ok) {
      return render({ ...(res.data.fields ?? {}), form: res.data.error ?? 'Something went wrong' }, values);
    }
    state.user = res.data.user;
    render();
  });
}

function bindDashboard(records) {
  root.querySelector('#logout').addEventListener('click', async () => {
    await api.logout();
    Object.assign(state, { user: null, view: 'login', pending: null, importResult: null, importError: null });
    render();
  });

  root.querySelector('#file').addEventListener('change', async (e) => {
    const [file] = e.target.files;
    if (!file) return;
    state.importResult = null;
    state.importError = null;
    state.pending = null;
    try {
      state.pending = await importFile(file);
    } catch (err) {
      state.importError = err.message;
    }
    render();
  });

  root.querySelector('#confirm-import')?.addEventListener('click', async () => {
    const res = await api.importRows(state.pending.valid);
    state.importError = res.ok ? null : (res.data.error ?? 'Import failed');
    state.importResult = res.ok ? `Imported ${res.data.imported} row(s)` : null;
    state.pending = null;
    render();
  });

  root.querySelector('#export').addEventListener('click', () => {
    const header = ['customer', 'email', 'amount', 'date'];
    download('records.csv', toCsv([header, ...records.map((r) => header.map((h) => r[h]))]), 'text/csv');
  });

  root.querySelector('#clear').addEventListener('click', async () => {
    await api.clearRecords();
    state.importResult = null;
    render();
  });
}

(async () => {
  const me = await api.me();
  if (me.ok) state.user = me.data.user;
  render();
})();
