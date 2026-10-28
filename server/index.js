import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import session from 'express-session';
import { config } from './config.js';
import { isExpired, oauthUrl, readLoginToken } from './formbar.js';
import { startRound } from './rounds.js';

if (!config.sessionSecret || !config.formbarApiUrl || !config.formbarClientUrl) {
  console.error('missing settings, copy .env.example to .env and fill it in');
  process.exit(1);
}

const app = express();
const isProd = process.env.NODE_ENV === 'production';

// needed for secure cookies when a proxy like nginx sits in front
if (isProd) app.set('trust proxy', 1);

app.use(express.json());
app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: isProd, maxAge: 8 * 60 * 60 * 1000 },
  })
);

// send the player to formbar to log in, it sends them back to /login/callback
// if they already have a refresh token (an expired login), formbar renews it without asking for a password
app.get('/login', (req, res) => {
  res.redirect(oauthUrl(req.session.refreshToken));
});

app.get('/login/callback', async (req, res) => {
  const token = req.query.token;
  if (typeof token !== 'string') {
    console.log('login callback had no token, query was:', Object.keys(req.query));
    return res.redirect('/?error=login');
  }

  // the login token is a jwt with the player's info inside, no extra formbar call is needed
  const login = readLoginToken(token);
  if (!login || isExpired(login.exp)) {
    console.log('login token was unreadable or already expired');
    return res.redirect('/?error=login');
  }

  // new session id on login so an old one can't be reused
  req.session.regenerate((err) => {
    if (err) return res.redirect('/?error=login');
    req.session.refreshToken = login.refreshToken;
    req.session.tokenExp = login.exp;
    req.session.user = login.user;
    req.session.save(() => res.redirect('/'));
  });
});

// the browser only gets display info, the real checks always happen on the server
app.get('/api/me', (req, res) => {
  const user = req.session.user;
  if (!user || isExpired(req.session.tokenExp)) return res.status(401).json({ error: 'not logged in' });

  res.json({
    id: user.id,
    name: user.name,
    isAdmin: config.adminIds.includes(user.id),
    playsFree: user.id === config.ownerId,
    roundCost: config.roundCost,
  });
});

app.post('/api/rounds', async (req, res) => {
  const { user, tokenExp } = req.session;
  if (!user) return res.status(401).json({ error: 'not logged in' });

  // login tokens run out, formbar hands out a new one when the player comes back through /oauth with their refresh token
  if (isExpired(tokenExp)) {
    return res.status(401).json({ error: 'your Formbar login expired, please log in again' });
  }

  const { mode, pin, requestId } = req.body || {};
  const round = await startRound(user, mode, pin, requestId);
  res.json(round);
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// serves the built game when running with npm start
app.use(express.static(path.join(path.dirname(fileURLToPath(import.meta.url)), '../dist')));

app.use((err, req, res, next) => {
  if (!err.status) console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'something went wrong' });
});

app.listen(config.port, (err) => {
  // express 5 hands startup errors to this callback, like a port that is already taken
  if (err) {
    console.error(`could not start on port ${config.port}:`, err.message);
    process.exit(1);
  }
  console.log(`server running on port ${config.port}`);
});
