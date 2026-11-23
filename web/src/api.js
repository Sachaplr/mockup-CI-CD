async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export const api = {
  me: () => request('GET', '/api/me'),
  register: (payload) => request('POST', '/api/register', payload),
  login: (payload) => request('POST', '/api/login', payload),
  logout: () => request('POST', '/api/logout'),
  records: () => request('GET', '/api/records'),
  importRows: (rows) => request('POST', '/api/records/import', { rows }),
  clearRecords: () => request('DELETE', '/api/records'),
};
