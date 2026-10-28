async function request(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.error || 'something went wrong');
    err.status = res.status;
    throw err;
  }
  return data;
}

// returns null when nobody is logged in
export async function getMe() {
  try {
    return await request('/api/me');
  } catch (err) {
    if (err.status === 401) return null;
    throw err;
  }
}

export function startRound(mode, pin, requestId) {
  return request('/api/rounds', {
    method: 'POST',
    body: JSON.stringify({ mode, pin, requestId }),
  });
}

export function logout() {
  return request('/api/logout', { method: 'POST' });
}
