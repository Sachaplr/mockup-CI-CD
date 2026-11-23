// Client-side validation. The PHP Validator enforces the same rules server-side.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email) {
  return typeof email === 'string' && email.length <= 254 && EMAIL_RE.test(email);
}

export function validatePassword(password) {
  const errors = [];
  if (typeof password !== 'string' || password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (typeof password !== 'string' || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    errors.push('Password must contain a letter and a digit');
  }
  return errors;
}

/** @returns {Record<string, string>} field -> message (empty object when valid) */
export function validateRegistration({ name, email, password, confirm }) {
  const errors = {};
  if (!name || !name.trim() || name.length > 100) errors.name = 'Name is required (max 100 characters)';
  if (!validateEmail(email)) errors.email = 'Enter a valid email address';
  const pw = validatePassword(password);
  if (pw.length) errors.password = pw[0];
  else if (password !== confirm) errors.confirm = 'Passwords do not match';
  return errors;
}

export function validateLogin({ email, password }) {
  const errors = {};
  if (!validateEmail(email)) errors.email = 'Enter a valid email address';
  if (!password) errors.password = 'Password is required';
  return errors;
}

function isRealIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** @returns {string[]} human readable problems for one imported record */
export function validateRecord(record) {
  const errors = [];
  if (typeof record.customer !== 'string' || !record.customer.trim() || record.customer.length > 120) {
    errors.push('customer is required (max 120 characters)');
  }
  if (!validateEmail(record.email)) errors.push('email is invalid');
  if (typeof record.amount !== 'number' || !Number.isFinite(record.amount) || record.amount < 0) {
    errors.push('amount must be a number ≥ 0');
  }
  if (!isRealIsoDate(record.date)) errors.push('date must be a real date (YYYY-MM-DD)');
  return errors;
}

/** Split records into valid ones and rejected ones (with their source row number). */
export function validateRecords(records) {
  const valid = [];
  const invalid = [];
  for (const { row, ...record } of records) {
    const errors = validateRecord(record);
    if (errors.length) invalid.push({ row, errors });
    else valid.push(record);
  }
  return { valid, invalid };
}
