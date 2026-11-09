import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import { config } from './config.js';
import { isExpired } from './formbar.js';
import { clients } from './hub.js';
import { removeScore } from './leaderboard.js';
import { adminLobbies, closeLobby, removeFromLobby } from './lobbies.js';
import { ACHIEVEMENTS } from '../src/game/achievements.js';
import { PICTURES, UPLOAD_KEY } from '../src/game/pictures.js';
import {
  adminProfile, searchProfiles, banOf, setBan, setPictureOverride, setAchievement, siteStats, achievementCounts,
} from './profiles.js';
import { gift, takeBack, adminShop, setItem, setSale, shopStats, transactions, resolveEntry, addCredit, creditsOf } from './shop.js';

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../data');
const file = path.join(dataDir, 'admin.json');
export const avatarDir = path.join(dataDir, 'avatars');

const MAX_LOG = 1000;
const MAX_UPLOAD = 256 * 1024;

// the action log and the announcement everybody sees
let state = { log: [], announcement: null };

try {
  state = { ...state, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
} catch (err) {
  if (err.code !== 'ENOENT') {
    console.error('could not read data/admin.json, fix or delete it:', err.message);
    process.exit(1);
  }
}

function save() {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(file + '.tmp', JSON.stringify(state));
  fs.renameSync(file + '.tmp', file);
}

function fail(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function logAction(admin, action, target, detail) {
  state.log.push({ at: Date.now(), adminId: admin.id, admin: admin.name, action, target: target || '', detail: detail || '' });
  if (state.log.length > MAX_LOG) state.log = state.log.slice(-MAX_LOG);
  save();
}

export function getAnnouncement() {
  return state.announcement;
}

// admin rights come from the verified formbar user id in config.js and nothing else, never from a title the player shows
function requireAdmin(req, res, next) {
  const { user, tokenExp } = req.session;
  if (!user || isExpired(tokenExp)) return res.status(401).json({ error: 'not logged in' });
  if (!config.adminIds.includes(user.id)) return res.status(403).json({ error: 'admins only' });
  next();
}

function targetId(req) {
  if (!/^\d{1,10}$/.test(req.params.id)) throw fail(404, 'no such player');
  const id = Number(req.params.id);
  if (!adminProfile(id)) throw fail(404, 'no such player');
  return id;
}

// admins can't be banned, kicked or have their scores removed, not even by each other
function notAdmin(id) {
  if (config.adminIds.includes(id)) throw fail(403, 'you can not do that to an admin');
}

function cleanText(value, max) {
  return String(value ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, max);
}

// ---- uploaded pictures. only real png, jpg, gif and webp files are kept, found by their first bytes and not by the name they came with

const fileTypes = [
  { ext: 'png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'gif', test: (b) => b.toString('ascii', 0, 4) === 'GIF8' },
  { ext: 'webp', test: (b) => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
];

function saveUpload(userId, base64) {
  if (typeof base64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw fail(400, 'that is not a picture');
  const data = Buffer.from(base64, 'base64');
  if (data.length > MAX_UPLOAD) throw fail(413, 'pictures can be up to 256 KB');
  const type = fileTypes.find((t) => t.test(data));
  if (!type) throw fail(400, 'pictures have to be png, jpg, gif or webp');

  const name = `${userId}-${Date.now()}.${type.ext}`;
  fs.mkdirSync(avatarDir, { recursive: true });
  fs.writeFileSync(path.join(avatarDir, name), data);
  return `upload:${name}`;
}

function deleteUpload(key) {
  if (typeof key !== 'string' || !UPLOAD_KEY.test(key)) return;
  fs.rm(path.join(avatarDir, key.slice('upload:'.length)), () => {});
}

// ---- the routes

export const adminRouter = Router();
adminRouter.use(requireAdmin);
adminRouter.use((req, res, next) => {
  req.body = req.body || {};
  next();
});

adminRouter.get('/stats', (req, res) => {
  res.json({
    site: siteStats(),
    shop: shopStats(),
    online: clients.size,
    lobbies: adminLobbies().length,
    achievements: ACHIEVEMENTS.map((a) => ({ id: a.id, name: a.name, mode: [].concat(a.mode).join(', '), earned: achievementCounts()[a.id] || 0 })),
    announcement: state.announcement,
  });
});

adminRouter.get('/players', (req, res) => {
  const found = searchProfiles(req.query.q, Number(req.query.offset));
  found.profiles = found.profiles.map((p) => ({ ...p, banned: !!banOf(p.id) }));
  res.json(found);
});

adminRouter.get('/players/:id', (req, res) => {
  const id = targetId(req);
  const profile = adminProfile(id);
  profile.purchases = transactions(3000).filter((e) => e.userId === id).slice(0, 20);
  profile.entries = creditsOf(id);
  res.json(profile);
});

// ---- moderation

adminRouter.post('/players/:id/ban', (req, res) => {
  const id = targetId(req);
  notAdmin(id);
  const hours = req.body.hours;
  if (!Number.isInteger(hours) || hours < 0 || hours > 24 * 365) throw fail(400, 'hours is 0 (forever) to 8760');
  const reason = cleanText(req.body.reason, 80);

  const ban = { until: hours === 0 ? null : Date.now() + hours * 3600 * 1000, reason, by: req.session.user.name, at: Date.now() };
  setBan(id, ban);
  removeFromLobby(id, 'You were banned from multiplayer.');
  logAction(req.session.user, 'ban', String(id), `${hours === 0 ? 'forever' : `${hours}h`}${reason ? `: ${reason}` : ''}`);
  res.json({ ban });
});

adminRouter.post('/players/:id/unban', (req, res) => {
  const id = targetId(req);
  setBan(id, null);
  logAction(req.session.user, 'unban', String(id));
  res.json({ ban: null });
});

adminRouter.post('/players/:id/kick', (req, res) => {
  const id = targetId(req);
  notAdmin(id);
  const kicked = removeFromLobby(id, 'An admin removed you from the lobby.');
  logAction(req.session.user, 'kick', String(id), kicked ? '' : 'was not in a lobby');
  res.json({ kicked });
});

adminRouter.post('/players/:id/scores/remove', (req, res) => {
  const id = targetId(req);
  notAdmin(id);
  const mode = req.body.mode;
  if (mode !== 'normal' && mode !== 'sprint' && mode !== 'blast') throw fail(400, 'bad mode');
  const removed = removeScore(id, mode);
  logAction(req.session.user, 'remove score', String(id), `${mode}${removed ? '' : ' (had none)'}`);
  res.json({ removed });
});

// ---- profile pictures, anyone's and anything. it stays until an admin takes it off, the player's own choice is kept underneath

adminRouter.post('/players/:id/picture', (req, res) => {
  const id = targetId(req);
  const { picture, upload, reset } = req.body;

  let value = null;
  if (reset === true) {
    value = null;
  } else if (typeof upload === 'string') {
    value = saveUpload(id, upload);
  } else if (typeof picture === 'string' && Object.hasOwn(PICTURES, picture)) {
    value = picture;
  } else {
    throw fail(400, 'pick a picture or upload one');
  }

  const old = setPictureOverride(id, value, req.session.user.name);
  if (old !== value) deleteUpload(old);
  logAction(req.session.user, value ? 'set picture' : 'reset picture', String(id), value || '');
  res.json({ override: value });
});

// ---- items and achievements

adminRouter.post('/players/:id/items', (req, res) => {
  const id = targetId(req);
  const target = { id, name: adminProfile(id).name };
  const { item, give } = req.body;
  const changed = give === false ? takeBack(req.session.user, target, item) : gift(req.session.user, target, item);
  if (changed) logAction(req.session.user, give === false ? 'take item' : 'give item', String(id), item);
  res.json({ changed });
});

adminRouter.post('/players/:id/achievements', (req, res) => {
  const id = targetId(req);
  const { id: achievement, give } = req.body;
  if (typeof give !== 'boolean') throw fail(400, 'bad request');
  const changed = setAchievement(id, achievement, give);
  if (changed) logAction(req.session.user, give ? 'give achievement' : 'take achievement', String(id), achievement);
  res.json({ changed });
});

// a saved entry makes someone's next multiplayer entry free. for putting right a payment problem
adminRouter.post('/players/:id/entry', (req, res) => {
  const id = targetId(req);
  addCredit(id);
  logAction(req.session.user, 'give saved entry', String(id));
  res.json({ ok: true });
});

// ---- lobbies

adminRouter.get('/lobbies', (req, res) => {
  res.json({ lobbies: adminLobbies() });
});

adminRouter.post('/lobbies/:code/close', (req, res) => {
  const code = String(req.params.code).toUpperCase();
  const closed = closeLobby(code);
  if (!closed) throw fail(404, 'that lobby is already gone');
  logAction(req.session.user, 'close lobby', code);
  res.json({ closed });
});

// ---- the shop

adminRouter.get('/shop', (req, res) => {
  res.json(adminShop());
});

adminRouter.put('/shop/items/:id', (req, res) => {
  const { price, text, enabled } = req.body;
  const item = setItem(req.params.id, { price, text, enabled });
  logAction(req.session.user, 'edit item', req.params.id, JSON.stringify({ price, text, enabled }));
  res.json({ item });
});

adminRouter.put('/shop/sale', (req, res) => {
  const sale = setSale(req.body.percent, req.body.label);
  logAction(req.session.user, 'set sale', '', `${sale.percent}%${sale.label ? ` ${sale.label}` : ''}`);
  res.json({ sale });
});

// ---- announcements, everyone sees the banner until it is cleared

adminRouter.post('/announcement', (req, res) => {
  const text = cleanText(req.body.text, 140);
  if (!text) throw fail(400, 'write something first');
  state.announcement = { id: Date.now(), text, by: req.session.user.name };
  logAction(req.session.user, 'announce', '', text);
  res.json({ announcement: state.announcement });
});

adminRouter.delete('/announcement', (req, res) => {
  state.announcement = null;
  logAction(req.session.user, 'clear announcement');
  res.json({ announcement: null });
});

// ---- logs

adminRouter.get('/logs', (req, res) => {
  res.json({ transactions: transactions(200), actions: state.log.slice(-200).reverse() });
});

adminRouter.post('/transactions/:id/resolve', (req, res) => {
  const entry = resolveEntry(req.params.id, req.body.action, req.session.user);
  logAction(req.session.user, `${req.body.action} payment`, String(entry.userId), entry.item);
  res.json({ entry });
});
