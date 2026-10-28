// temporary: when the token refresh fails, try a grid of paths and auth styles and print what formbar says
// delete this file (and the call in index.js) once login works
import { config } from './config.js';

async function tryOne(label, method, path, headers = {}) {
  try {
    const res = await fetch(config.formbarApiUrl + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      signal: AbortSignal.timeout(8000),
    });
    const text = (await res.text()).replace(/\s+/g, ' ');
    // never print anything that could be a token or a whole web page
    let shown = text.slice(0, 120);
    if (/eyJ|accessToken|refreshToken/.test(text)) shown = '(response has a token or user info in it)';
    else if (text.startsWith('<!DOCTYPE')) shown = '(html page)';
    console.log(`  ${res.status} ${label} ${res.status === 401 ? '' : shown}`);
  } catch (err) {
    console.log(`  ERR ${label} ${err.message}`);
  }
}

function jwtAlg(token) {
  try {
    return JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString()).alg;
  } catch {
    return 'unreadable';
  }
}

export async function probe(loginToken, refreshToken) {
  console.log('probing formbar, paste everything between the lines:');
  console.log('-----');
  console.log(`  login token alg: ${jwtAlg(loginToken)}, refresh token alg: ${jwtAlg(refreshToken)}`);

  const styles = {
    'Bearer refresh': { Authorization: `Bearer ${refreshToken}` },
    'Bearer login': { Authorization: `Bearer ${loginToken}` },
    'API header refresh': { API: refreshToken },
    'API header login': { API: loginToken },
    'raw Authorization refresh': { Authorization: refreshToken },
    'raw Authorization login': { Authorization: loginToken },
    'cookie token login': { Cookie: `token=${loginToken}` },
  };

  for (const path of ['/api/me', '/api/user/me', '/api/v1/user/me']) {
    for (const [name, headers] of Object.entries(styles)) {
      await tryOne(`GET ${path} [${name}]`, 'GET', path, headers);
    }
  }

  // paths outside /api, in case the auth routes live elsewhere
  for (const path of ['/', '/oauth', '/.well-known/jwks.json', '/auth/refresh', '/api/refresh', '/oauth/refresh']) {
    await tryOne(`GET ${path} [no auth]`, 'GET', path);
  }
  console.log('-----');
}
