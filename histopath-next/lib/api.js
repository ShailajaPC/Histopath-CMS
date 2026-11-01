export async function apiFetch(url, options = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('hp_token') : null;
  const res = await fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (res.status === 401 && typeof window !== 'undefined') {
    localStorage.clear();
    window.location.href = '/login';
  }
  const method = (options.method || 'GET').toUpperCase();
  if (res.status === 403 && method === 'GET' && typeof window !== 'undefined') {
    window.location.href = '/forbidden';
  }
  return res;
}
