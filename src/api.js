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

// expectedCost is the price the player was shown, the server refuses if it changed
export function startRound(mode, pin, requestId, expectedCost) {
  return request('/api/rounds', {
    method: 'POST',
    body: JSON.stringify({ mode, pin, requestId, expectedCost }),
  });
}

export function submitScore(roundId, result) {
  return request('/api/scores', {
    method: 'POST',
    body: JSON.stringify({ roundId, ...result }),
  });
}

export function getLeaderboards() {
  return request('/api/leaderboards');
}

export function logout() {
  return request('/api/logout', { method: 'POST' });
}
