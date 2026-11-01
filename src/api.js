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

export function getProfile(id) {
  return request(`/api/profiles/${id}`);
}

export function searchProfiles(query, offset) {
  return request(`/api/profiles?q=${encodeURIComponent(query)}&offset=${offset}`);
}

// ranks is a list of rank ids, up to 2 earned ones
export function chooseRanks(ranks) {
  return request('/api/profile/ranks', {
    method: 'POST',
    body: JSON.stringify({ ranks }),
  });
}

// the shop. the server sets every price, expectedPrice is only what the player was shown
export function getShop() {
  return request('/api/shop');
}

export function buyItem(item, pin, requestId, expectedPrice) {
  return request('/api/shop/buy', { method: 'POST', body: JSON.stringify({ item, pin, requestId, expectedPrice }) });
}

// creating a lobby, joining one to play, or going from watching to playing. without confirm the server only checks and
// answers { quote } (or { joined } when it is free). with confirm, pin, requestId and expectedPrice it pays and joins
export function enterLobby(body) {
  return request('/api/multiplayer/enter', { method: 'POST', body: JSON.stringify(body) });
}

export function equipPicture(picture) {
  return request('/api/profile/picture', { method: 'POST', body: JSON.stringify({ picture }) });
}

// controls and display options, saved with the profile. send only what changed: { keys } (null for the defaults) and/or { effects }
export function saveSettings(settings) {
  return request('/api/settings', { method: 'POST', body: JSON.stringify(settings) });
}

export function getAnnouncement() {
  return request('/api/announcement');
}

// every admin call goes through here, the server checks the player is an admin each time
export function admin(method, path, body) {
  return request(`/api/admin${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body) });
}

export function logout() {
  return request('/api/logout', { method: 'POST' });
}
