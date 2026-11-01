import { clients, sendTo } from './hub.js';
import { fail, inviteSource, lobbySummary } from './lobbies.js';
import { profileName } from './profiles.js';

// a lobby invite is a short lived note on the server. it is the server's permission to join that lobby without its password,
// but the payment, bans and capacity are all still checked when the person accepts
const INVITE_MS = 2 * 60 * 1000;
const MAX_PER_MINUTE = 10; // per sender, so nobody can spam people

const invites = new Map(); // invite id -> { id, from, to, code, expires }
const recent = new Map(); // sender id -> times they sent invites
let nextId = 1;

function clean() {
  const now = Date.now();
  for (const [id, inv] of invites) if (inv.expires < now) invites.delete(id);
}

// what the recipient sees. never the lobby code or password, so a private lobby stays private
function show(inv) {
  const lobby = lobbySummary(inv.code);
  return {
    id: inv.id,
    from: { id: inv.from.id, name: inv.from.name },
    lobby: lobby && { name: lobby.name, kind: lobby.kind, lines: lobby.lines, players: lobby.players, max: lobby.max, isPrivate: lobby.isPrivate },
    expires: inv.expires,
  };
}

// someone invites another player to the lobby they are in. throws a message the sender can read
export function sendInvite(user, toId) {
  clean();
  const to = Number(toId);
  if (!Number.isInteger(to) || to === user.id) throw fail('pick another player to invite');

  const name = profileName(to);
  if (!name) throw fail('that player does not exist');

  const source = inviteSource(user.id);
  if (!source) throw fail('join or create a lobby first');
  if (source.status !== 'waiting') throw fail('you can only invite while the lobby is waiting');
  if (source.isPrivate && !source.isHost) throw fail('only the host can invite to a private lobby');
  if (source.players >= source.max) throw fail('your lobby is full');

  // the other player has to be online (connected to the game), or the invite would just sit there
  if (!clients.has(to)) throw fail(`${name} is offline right now`);
  if (inviteSource(to) && inviteSource(to).code === source.code) throw fail(`${name} is already in your lobby`);

  for (const inv of invites.values()) {
    if (inv.to === to && inv.code === source.code) throw fail(`${name} was already invited`);
  }

  const now = Date.now();
  const times = (recent.get(user.id) || []).filter((t) => now - t < 60000);
  if (times.length >= MAX_PER_MINUTE) throw fail('too many invites, wait a minute');
  times.push(now);
  recent.set(user.id, times);

  const inv = { id: nextId++, from: { id: user.id, name: user.name }, to, code: source.code, expires: now + INVITE_MS };
  invites.set(inv.id, inv);
  sendTo(to, { type: 'invite', invite: show(inv) });
  return name;
}

// the invite behind an accept, only its recipient can use it. returns the lobby code, or null if it ran out
export function findInvite(userId, inviteId) {
  clean();
  const inv = invites.get(Number(inviteId));
  if (!inv || inv.to !== userId) return null;
  if (!lobbySummary(inv.code)) {
    invites.delete(inv.id);
    return null;
  }
  return inv;
}

export function finishInvite(inviteId) {
  invites.delete(Number(inviteId));
}

// the recipient said no. the sender is told, an unknown or old id does nothing
export function declineInvite(userId, inviteId) {
  const inv = invites.get(Number(inviteId));
  if (!inv || inv.to !== userId) return;
  invites.delete(inv.id);
  sendTo(inv.from.id, { type: 'inviteReply', name: profileName(userId) || 'A player', accepted: false });
}
