import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import session from 'express-session';
import { config } from './config.js';
import { isExpired, oauthUrl, readLoginToken } from './formbar.js';
import { startRound, finishRound } from './rounds.js';
import { getBoards, getDiscount, getPrice } from './leaderboard.js';
import { attachSockets } from './socket.js';
import { touchProfile, publicProfile, searchProfiles, setShownRanks, badgesFor, pictureOf } from './profiles.js';

if (!config.sessionSecret || !config.formbarApiUrl || !config.formbarClientUrl) {
  console.error('missing settings, copy .env.example to .env and fill it in');
  process.exit(1);
}

const app = express();
const isProd = process.env.NODE_ENV === 'production';

// needed for secure cookies when a proxy like nginx sits in front
if (isProd) app.set('trust proxy', 1);

app.use(express.json());
// kept in a variable because the multiplayer sockets read the same login session
const sessionMiddleware = session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: isProd, maxAge: 8 * 60 * 60 * 1000 },
});
app.use(sessionMiddleware);

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
    touchProfile(login.user); // makes sure they have a profile and the right name
    req.session.save(() => res.redirect('/'));
  });
});

// the browser only gets display info, the real checks always happen on the server
app.get('/api/me', (req, res) => {
  const user = req.session.user;
  if (!user || isExpired(req.session.tokenExp)) return res.status(401).json({ error: 'not logged in' });

  touchProfile(user);
  res.json({
    id: user.id,
    name: user.name,
    isAdmin: config.adminIds.includes(user.id),
    playsFree: user.id === config.ownerId,
    roundCost: getPrice(user.id), // what this player pays right now, after any discount
    discount: getDiscount(user.id),
    discounts: config.discounts, // what 1st, 2nd and 3rd place get
    badges: badgesFor(user.id),
    picture: pictureOf(user.id),
  });
});

app.post('/api/rounds', async (req, res) => {
  const { user, tokenExp } = req.session;
  if (!user) return res.status(401).json({ error: 'not logged in' });

  // login tokens run out, formbar hands out a new one when the player comes back through /oauth with their refresh token
  if (isExpired(tokenExp)) {
    return res.status(401).json({ error: 'your Formbar login expired, please log in again' });
  }

  const { mode, pin, requestId, expectedCost } = req.body || {};
  const round = await startRound(user, mode, pin, requestId, expectedCost);
  res.json(round);
});

// no expiry check on scores, the round was already paid for and a long game shouldn't lose its score
app.post('/api/scores', (req, res) => {
  const user = req.session.user;
  if (!user) return res.status(401).json({ error: 'not logged in' });

  const { roundId, ...result } = req.body || {};
  res.json(finishRound(user, roundId, result));
});

app.get('/api/leaderboards', (req, res) => {
  const user = req.session.user;
  if (!user) return res.status(401).json({ error: 'not logged in' });

  const boards = getBoards(user.id);
  for (const mode of Object.keys(boards)) {
    for (const entry of boards[mode].entries) entry.badges = badgesFor(entry.userId);
  }
  res.json(boards);
});

// profiles are visible to anyone who is logged in. the server decides what is public (see profiles.js)
app.get('/api/profiles', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'not logged in' });

  const offset = Number(req.query.offset);
  res.json(searchProfiles(req.query.q, offset));
});

app.get('/api/profiles/:id', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'not logged in' });

  const profile = /^\d{1,10}$/.test(req.params.id) ? publicProfile(Number(req.params.id)) : null;
  if (!profile) return res.status(404).json({ error: 'there is no player with that id' });
  res.json(profile);
});

// a player picks which of their earned ranks to show, only their own profile can be changed
app.post('/api/profile/ranks', (req, res) => {
  const user = req.session.user;
  if (!user) return res.status(401).json({ error: 'not logged in' });

  const badges = setShownRanks(user.id, (req.body || {}).ranks);
  if (!badges) return res.status(400).json({ error: 'you can show up to 2 ranks, and only ones you have earned' });
  res.json({ badges });
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

const server = app.listen(config.port, (err) => {
  // express 5 hands startup errors to this callback, like a port that is already taken
  if (err) {
    console.error(`could not start on port ${config.port}:`, err.message);
    process.exit(1);
  }
  console.log(`server running on port ${config.port}`);
});

attachSockets(server, sessionMiddleware);
