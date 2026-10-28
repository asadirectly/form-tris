import { config } from './config.js';

// the token formbar sends back after login is a jwt holding the user's info
// (id, displayName, permissions, refreshToken, exp). both reference apps (jukebar, formbartetris)
// just decode it, so we do the same instead of calling formbar to look the user up
export function readLoginToken(loginToken) {
  try {
    const payload = JSON.parse(Buffer.from(loginToken.split('.')[1], 'base64url').toString());
    if (!payload || payload.id == null) return null;

    // the name shown in the game is the formbar name from the token, never the id
    const name = payload.displayName || payload.username;
    if (!name) return null;

    return {
      user: { id: Number(payload.id), name: String(name) },
      refreshToken: payload.refreshToken || null,
      exp: payload.exp ? Number(payload.exp) : null, // seconds
    };
  } catch {
    return null;
  }
}

export function isExpired(exp) {
  return exp != null && Date.now() >= exp * 1000;
}

// where to send the player to log in, or to quietly renew an expired login using their refresh token
// (formbar's /oauth accepts ?refreshToken= and sends back a fresh login token)
export function oauthUrl(refreshToken) {
  const url = new URL('/oauth', config.formbarClientUrl);
  if (refreshToken) url.searchParams.set('refreshToken', refreshToken);
  url.searchParams.set('redirectURL', `${config.appUrl}/login/callback`);
  return url.toString();
}

// digipog transfers are a plain POST to /api/digipogs/transfer with no auth header,
// formbar checks the sender's pin instead. same as jukebar and formbartetris
export async function charge(userId, amount, pin) {
  const url = config.formbarApiUrl + config.apiPrefix + '/digipogs/transfer';

  let res;
  let body = {};
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: Number(userId),
        to: Number(config.poolId),
        amount: Number(amount),
        pin: Number(pin),
        reason: 'Form-Tris! round',
        pool: true, // the destination is a pool, not a user
      }),
      signal: AbortSignal.timeout(15000),
    });
    body = await res.json().catch(() => ({}));
  } catch (err) {
    console.log('formbar transfer request failed:', url, err.message);
    return { ok: false, message: 'could not reach Formbar, please try again' };
  }

  // formbar answers { success, message }: 200 when it worked, 400 with a message when it didn't
  const ok = res.ok && body.success === true;
  if (!ok) console.log('formbar transfer failed:', res.status, url, JSON.stringify(body).slice(0, 300));

  return { ok, message: body.message || body.error || 'the payment was declined' };
}
