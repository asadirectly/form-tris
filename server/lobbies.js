import crypto from 'node:crypto';
import { LOBBY_KINDS, MIN_PLAYERS, RUSH_LINES } from '../src/game/constants.js';
import { config } from './config.js';
import { sendTo, sendMany } from './hub.js';
import { startMatch, stopMatch, matchMessage, playerLeft } from './match.js';
import { recordMatch, badgesFor, banOf } from './profiles.js';
import { addCredit } from './shop.js';

const lobbies = new Map(); // code -> lobby
const inLobby = new Map(); // member id -> lobby, a person can only be in one at a time
const misses = new Map(); // user id -> times of wrong codes or passwords, to slow down guessing

const MAX_BOT_LEVEL = 9;
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I

// errors with a message that is safe to show the player
export function fail(message) {
  const err = new Error(message);
  err.isUser = true;
  return err;
}

// the owner plays free, everyone else paid an entry fee to be a player (see entry.js). spectating is free
function mayPlay(member) {
  return member.paid || Number(member.id) === config.ownerId;
}

function checkBan(userId) {
  const ban = banOf(userId);
  if (!ban) return;
  const until = ban.until ? ` until ${new Date(ban.until).toLocaleString()}` : '';
  throw fail(`you are banned from multiplayer${until}${ban.reason ? `: ${ban.reason}` : ''}`);
}

function playersIn(lobby) {
  return lobby.members.filter((m) => m.role === 'player');
}

function memberOf(lobby, id) {
  return lobby.members.find((m) => m.id === id);
}

function makeCode() {
  for (;;) {
    let code = '';
    for (let i = 0; i < 5; i++) code += CODE_LETTERS[crypto.randomInt(CODE_LETTERS.length)];
    if (!lobbies.has(code)) return code;
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  return { salt, hash: crypto.scryptSync(password, salt, 32) };
}

function passwordMatches(lobby, password) {
  const hash = crypto.scryptSync(String(password), lobby.password.salt, 32);
  return crypto.timingSafeEqual(hash, lobby.password.hash);
}

// 6 wrong guesses in a minute and the player has to wait
function checkMisses(userId) {
  const recent = (misses.get(userId) || []).filter((t) => Date.now() - t < 60000);
  misses.set(userId, recent);
  if (recent.length >= 6) throw fail('too many wrong tries, wait a minute');
}

function missed(userId) {
  misses.get(userId).push(Date.now());
}

// the limits live here and nowhere else, the lobby screens only show them
// canName is true for admins only. everybody else gets "{name}'s lobby" and can't change it
function readSettings(input, old, userName, canName) {
  const kind = input.kind === undefined ? (old ? old.kind : 'standard') : input.kind;
  if (typeof kind !== 'string' || !Object.hasOwn(LOBBY_KINDS, kind)) throw fail('unknown lobby type');
  const limit = LOBBY_KINDS[kind].max;

  let max = input.max;
  if (max === undefined) {
    // nothing asked for, so keep the old size but never past the new type's limit
    max = Math.min(old ? old.max : 8, limit);
  }
  if (!Number.isInteger(max) || max < MIN_PLAYERS || max > limit) {
    throw fail(`${LOBBY_KINDS[kind].name} lobbies hold ${MIN_PLAYERS} to ${limit} players`);
  }

  let name = old ? old.name : `${userName.replace(/[\u0000-\u001f]/g, '').trim()}'s lobby`;
  if (input.name !== undefined) {
    if (!canName) throw fail('only admins can name lobbies');
    if (typeof input.name !== 'string') throw fail('bad lobby name');
    name = input.name.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 24);
    if (!name) throw fail('the lobby needs a name');
  }

  const isPrivate = input.isPrivate === undefined ? (old ? old.isPrivate : false) : input.isPrivate === true;

  // public lobbies have no password, private ones must have one
  let password = old ? old.password : null;
  if (!isPrivate) {
    password = null;
  } else if (input.password !== undefined && input.password !== '') {
    if (typeof input.password !== 'string' || input.password.length > 32) throw fail('passwords can be up to 32 characters');
    password = hashPassword(input.password);
  }
  if (isPrivate && !password) throw fail('private lobbies need a password');

  // only a rush lobby has a line goal
  let lines = RUSH_LINES.default;
  if (old && old.lines) lines = old.lines;
  if (input.lines !== undefined) {
    if (!Number.isInteger(input.lines) || input.lines < RUSH_LINES.min || input.lines > RUSH_LINES.max) {
      throw fail(`a rush is ${RUSH_LINES.min} to ${RUSH_LINES.max} lines`);
    }
    lines = input.lines;
  }

  return { kind, max, name, isPrivate, password, lines };
}

// everything that could make a new lobby fail, so entry.js can check before taking any money
export function checkCreate(user, input) {
  checkBan(user.id);
  if (lobbies.size >= config.maxLobbies) throw fail('too many lobbies right now, try again later');
  return readSettings(input || {}, null, user.name, config.adminIds.includes(user.id));
}

export function createLobby(user, input) {
  const settings = checkCreate(user, input);

  leaveLobby(user.id);
  const lobby = {
    id: makeCode(),
    ...settings,
    hostId: String(user.id),
    status: 'waiting', // waiting -> playing -> waiting
    members: [{ id: String(user.id), name: user.name, bot: false, role: 'player', paid: true, ready: false, joinedAt: Date.now() }],
    match: null,
    botCount: 0,
    dirty: true,
  };
  lobbies.set(lobby.id, lobby);
  inLobby.set(String(user.id), lobby);
}

// looks at a join without doing it. returns the lobby and whether the person would only watch. throws if it can't work
export function checkJoin(user, input, invited = false) {
  const id = String(user.id);
  const code = String(input.code || '').toUpperCase().trim();
  const lobby = lobbies.get(code);

  checkBan(user.id);
  if (!invited) checkMisses(user.id);
  if (!lobby) {
    if (!invited) missed(user.id);
    throw fail(invited ? 'that lobby is gone' : 'there is no lobby with that code');
  }
  if (inLobby.get(id) === lobby) throw fail('you are already in that lobby');
  // an invite from the lobby's host or a member is the server's own permission to skip the password, it never skips anything else
  if (!invited && lobby.password && !passwordMatches(lobby, input.password ?? '')) {
    missed(user.id);
    throw fail('wrong password');
  }

  // people who join a match in progress can only watch
  const spectate = input.spectate === true || lobby.status === 'playing';
  if (spectate) {
    if (lobby.members.length - playersIn(lobby).length >= config.maxSpectators) throw fail('no room left for spectators');
  } else if (playersIn(lobby).length >= lobby.max) {
    throw fail('that lobby is full');
  }
  return { lobby, spectate };
}

// only entry.js calls this, after the entry fee is handled. watching is always free
export function joinLobby(user, input, invited = false) {
  const id = String(user.id);
  const { lobby, spectate } = checkJoin(user, input, invited);

  leaveLobby(user.id);
  lobby.members.push({
    id,
    name: user.name,
    bot: false,
    role: spectate ? 'spectator' : 'player',
    paid: !spectate,
    ready: false,
    joinedAt: Date.now(),
  });
  inLobby.set(id, lobby);
  lobby.dirty = true;
  if (lobby.status === 'playing') sendTo(user.id, startMessage(lobby, id, true));
  return spectate;
}

export function leaveLobby(userId) {
  const id = String(userId);
  const lobby = inLobby.get(id);
  if (!lobby) return;

  lobby.members = lobby.members.filter((m) => m.id !== id);
  inLobby.delete(id);
  if (lobby.match) playerLeft(lobby.match, id);

  const humans = lobby.members.filter((m) => !m.bot);
  if (humans.length === 0) {
    if (lobby.match) stopMatch(lobby.match);
    lobbies.delete(lobby.id);
    return;
  }
  // the host passes to the longest waiting player
  if (lobby.hostId === id) lobby.hostId = (humans.find((m) => m.role === 'player') || humans[0]).id;
  lobby.dirty = true;
}

// a player who reconnects in the middle of a match has lost their game, so they forfeit and watch
export function resume(userId) {
  const id = String(userId);
  const lobby = inLobby.get(id);
  if (!lobby) return;
  if (lobby.match) {
    playerLeft(lobby.match, id);
    sendTo(userId, startMessage(lobby, id, true));
  }
  lobby.dirty = true;
}

// looks up the lobby for a host action and makes sure the caller is the host
function hostLobby(userId, needWaiting = true) {
  const lobby = inLobby.get(String(userId));
  if (!lobby) throw fail('you are not in a lobby');
  if (lobby.hostId !== String(userId)) throw fail('only the host can do that');
  if (needWaiting && lobby.status !== 'waiting') throw fail('a match is in progress');
  return lobby;
}

export function setReady(userId, ready) {
  const lobby = inLobby.get(String(userId));
  if (!lobby || lobby.status !== 'waiting') return;
  const me = memberOf(lobby, String(userId));
  if (me.role !== 'player') return;
  if (ready && !mayPlay(me)) throw fail('pay the entry fee to play');
  me.ready = ready;
  lobby.dirty = true;
}

// moving from watching to playing needs a paid entry (the owner is exempt). entry.js checks this before charging
export function checkPlay(userId) {
  const lobby = inLobby.get(String(userId));
  if (!lobby) throw fail('you are not in a lobby');
  if (lobby.status !== 'waiting') throw fail('a match is in progress');
  const me = memberOf(lobby, String(userId));
  if (me.role === 'player') throw fail('you are already playing');
  if (playersIn(lobby).length >= lobby.max) throw fail('that lobby is full');
  return { lobby, me };
}

export function setRole(userId, role) {
  const lobby = inLobby.get(String(userId));
  if (!lobby) throw fail('you are not in a lobby');
  if (lobby.status !== 'waiting') throw fail('a match is in progress');
  const me = memberOf(lobby, String(userId));

  if (role === 'player' && me.role !== 'player') {
    if (playersIn(lobby).length >= lobby.max) throw fail('that lobby is full');
    if (!mayPlay(me)) throw fail('pay the entry fee to play');
    me.role = 'player';
  } else if (role === 'spectator' && me.role !== 'spectator') {
    if (lobby.members.length - playersIn(lobby).length >= config.maxSpectators) throw fail('no room left for spectators');
    me.role = 'spectator';
  } else {
    return;
  }
  me.ready = false;
  lobby.dirty = true;
}

// the fee was paid, so the person plays and keeps their paid spot even if they watch for a bit
export function startPlaying(userId) {
  const lobby = inLobby.get(String(userId));
  const me = lobby && memberOf(lobby, String(userId));
  if (!me) throw fail('you are not in a lobby');
  me.paid = true;
  setRole(userId, 'player');
}

export function updateSettings(user, input) {
  const lobby = hostLobby(user.id);
  const settings = readSettings(input, lobby, '', config.adminIds.includes(user.id));

  // shrinking the lobby can't kick anyone out
  const count = playersIn(lobby).length;
  if (count > settings.max) throw fail(`there are already ${count} players in here`);

  Object.assign(lobby, settings);
  lobby.dirty = true;
}

function checkLevel(level) {
  if (!Number.isInteger(level) || level < 1 || level > MAX_BOT_LEVEL) throw fail('CPU level is 1 to 9');
}

// CPU players take a slot like anybody else, so they count toward the limit
export function addBot(userId, level) {
  const lobby = hostLobby(userId);
  checkLevel(level);
  if (playersIn(lobby).length >= lobby.max) throw fail('the lobby is full');

  lobby.botCount++;
  lobby.members.push({
    id: `cpu${lobby.botCount}`,
    name: `CPU ${lobby.botCount}`,
    bot: true,
    level,
    role: 'player',
    ready: true,
    joinedAt: Date.now(),
  });
  lobby.dirty = true;
}

export function setBotLevel(userId, botId, level) {
  const lobby = hostLobby(userId);
  checkLevel(level);
  const bot = memberOf(lobby, botId);
  if (!bot || !bot.bot) throw fail('no such CPU');
  bot.level = level;
  lobby.dirty = true;
}

export function removeBot(userId, botId) {
  const lobby = hostLobby(userId);
  const bot = memberOf(lobby, botId);
  if (!bot || !bot.bot) throw fail('no such CPU');
  lobby.members = lobby.members.filter((m) => m !== bot);
  lobby.dirty = true;
}

export function kick(userId, targetId) {
  const lobby = hostLobby(userId);
  const target = memberOf(lobby, String(targetId));
  if (!target || target.id === String(userId)) throw fail('nobody to kick');

  if (target.bot) return removeBot(userId, target.id);
  leaveLobby(target.id);
  sendTo(target.id, { type: 'lobby', lobby: null, notice: 'You were kicked from the lobby.' });
}

export function giveHost(userId, targetId) {
  const lobby = hostLobby(userId, false);
  const target = memberOf(lobby, String(targetId));
  if (!target || target.bot) throw fail('pick a person to hand the lobby to');
  lobby.hostId = target.id;
  lobby.dirty = true;
}

// spectate is true for anybody who isn't playing in this match, so their screen only watches
function startMessage(lobby, you, spectate = false) {
  return { type: 'start', kind: lobby.kind, seed: lobby.match ? lobby.match.seed : 0, you, spectate, lines: lobby.kind === 'rush' ? lobby.lines : 0 };
}

export function startLobbyMatch(userId) {
  const lobby = hostLobby(userId);
  const players = playersIn(lobby);
  if (players.length < MIN_PLAYERS) throw fail('you need at least 2 players, add a CPU or wait for someone to join');
  if (players.length > LOBBY_KINDS[lobby.kind].max) throw fail('too many players for this lobby type');

  const notReady = players.filter((m) => !m.bot && m.id !== lobby.hostId && !m.ready).length;
  if (notReady > 0) throw fail(`${notReady} player${notReady > 1 ? 's are' : ' is'} not ready yet`);

  lobby.status = 'playing';
  lobby.match = startMatch(lobby, (results, info) => endMatch(lobby, results, info));
  lobby.dirty = true;

  for (const m of lobby.members) {
    if (!m.bot) sendTo(m.id, startMessage(lobby, m.id));
  }
}

function endMatch(lobby, results, info) {
  lobby.match = null;
  lobby.status = 'waiting';
  for (const m of lobby.members) m.ready = m.bot;
  lobby.dirty = true;
  sendMany(lobby.members.filter((m) => !m.bot).map((m) => m.id), { type: 'results', results });

  // the match counts toward each player's profile, and anyone who unlocked something is told
  const earned = recordMatch(results, info);
  for (const id of Object.keys(earned)) {
    const { unlocked, newRank } = earned[id];
    if (unlocked.length > 0 || newRank) sendTo(id, { type: 'unlocked', ids: unlocked, newRank });
  }
}

// attack, board, dead, target and watch messages from a game in progress
export function gameMessage(userId, msg) {
  const lobby = inLobby.get(String(userId));
  if (lobby && lobby.match) matchMessage(lobby.match, userId, msg);
}

// what the lobby screen gets, never anything private like the password
function view(lobby) {
  return {
    id: lobby.id,
    name: lobby.name,
    kind: lobby.kind,
    max: lobby.max,
    hostId: lobby.hostId,
    status: lobby.status,
    isPrivate: lobby.isPrivate,
    lines: lobby.lines,
    members: lobby.members.map((m) => ({
      id: m.id,
      name: m.name,
      bot: m.bot,
      level: m.level,
      ready: m.ready,
      role: m.role,
      badges: m.bot ? [] : badgesFor(Number(m.id)),
    })),
  };
}

// only public lobbies are listed, private ones need their code
export function listPublic() {
  const list = [];
  for (const lobby of lobbies.values()) {
    if (lobby.isPrivate) continue;
    const players = playersIn(lobby).length;
    const host = memberOf(lobby, lobby.hostId);
    list.push({
      id: lobby.id,
      name: lobby.name,
      kind: lobby.kind,
      lines: lobby.lines,
      max: lobby.max,
      players,
      spectators: lobby.members.length - players,
      status: lobby.status,
      host: host ? host.name : '',
    });
  }
  return list.slice(0, 50);
}

// ---- helpers for invites.js and entry.js

// the lobby a person is in, with the details an invite shows
export function inviteSource(userId) {
  const lobby = inLobby.get(String(userId));
  if (!lobby) return null;
  return { code: lobby.id, isHost: lobby.hostId === String(userId), ...summary(lobby) };
}

export function lobbySummary(code) {
  const lobby = lobbies.get(code);
  return lobby ? { code, ...summary(lobby) } : null;
}

function summary(lobby) {
  return {
    name: lobby.name,
    kind: lobby.kind,
    lines: lobby.lines,
    players: playersIn(lobby).length,
    max: lobby.max,
    isPrivate: lobby.isPrivate,
    status: lobby.status,
  };
}

// true while the person is playing in a running match, they can't hop into another lobby then
export function inRunningMatch(userId) {
  const lobby = inLobby.get(String(userId));
  if (!lobby || lobby.status !== 'playing') return false;
  const me = memberOf(lobby, String(userId));
  return !!me && me.role === 'player';
}

// ---- admin tools, admin.js checks who is asking before it calls these

export function adminLobbies() {
  return [...lobbies.values()].map((lobby) => {
    const host = memberOf(lobby, lobby.hostId);
    return {
      id: lobby.id,
      name: lobby.name,
      kind: lobby.kind,
      max: lobby.max,
      status: lobby.status,
      isPrivate: lobby.isPrivate,
      host: host ? host.name : '',
      members: lobby.members.map((m) => ({ id: m.id, name: m.name, bot: m.bot, role: m.role })),
    };
  });
}

// shuts a lobby and sends everyone back to the browser. players who paid to get in are given a saved entry, since the lobby was taken away from them
export function closeLobby(code) {
  const lobby = lobbies.get(code);
  if (!lobby) return false;

  if (lobby.match) stopMatch(lobby.match);
  for (const m of lobby.members) {
    if (m.bot) continue;
    inLobby.delete(m.id);
    if (m.paid && Number(m.id) !== config.ownerId) addCredit(m.id);
    sendTo(m.id, { type: 'lobby', lobby: null, notice: 'An admin closed this lobby.' });
  }
  lobbies.delete(code);
  return true;
}

// takes one person out of whatever lobby they are in
export function removeFromLobby(userId, notice) {
  if (!inLobby.has(String(userId))) return false;
  leaveLobby(userId);
  sendTo(userId, { type: 'lobby', lobby: null, notice });
  return true;
}

export function lobbyOf(userId) {
  const lobby = inLobby.get(String(userId));
  return lobby ? view(lobby) : null;
}

// sends the lobby screen to everyone in a lobby that changed
setInterval(() => {
  for (const lobby of lobbies.values()) {
    if (!lobby.dirty) continue;
    lobby.dirty = false;
    sendMany(
      lobby.members.filter((m) => !m.bot).map((m) => m.id),
      { type: 'lobby', lobby: view(lobby) }
    );
  }
}, 100).unref();
