const BASE_URL = process.env.REACT_APP_API_URL || '';

export class UnauthorizedError extends Error {
  constructor(message = 'Session expired. Please sign in again.') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

function getToken() {
  return localStorage.getItem('token');
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function readJsonResponse(res) {
  const text = await res.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

export async function register(data) {
  const res = await fetch(`${BASE_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  const json = await readJsonResponse(res);
  if (!res.ok) throw new Error(json.error || 'Registration failed');
  return json;
}

export async function login(data) {
  const res = await fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  const json = await readJsonResponse(res);
  if (!res.ok) throw new Error(json.error || 'Login failed');
  return json;
}

export async function track(feature_name) {
  if (!getToken()) return;

  try {
    await fetch(`${BASE_URL}/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ feature_name }),
    });
  } catch (e) {
    // Tracking should never break core UX.
    console.warn('Track error:', e);
  }
}

export async function getAnalytics(params = {}) {
  const query = new URLSearchParams();
  if (params.start_date) query.set('start_date', params.start_date);
  if (params.end_date) query.set('end_date', params.end_date);
  if (params.age) query.set('age', params.age);
  if (params.gender) query.set('gender', params.gender);
  if (params.feature) query.set('feature', params.feature);

  const res = await fetch(`${BASE_URL}/analytics?${query.toString()}`, {
    headers: authHeaders(),
  });

  const json = await readJsonResponse(res);

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new UnauthorizedError();
    }
    throw new Error(json.error || 'Failed to fetch analytics');
  }

  return json;
}
