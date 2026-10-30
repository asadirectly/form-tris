import crypto from 'node:crypto';
import { encodeBoard, isBoardString, stackHeight, seededRandom, BOARD_SIZE } from '../src/game/versus.js';
import { makeBotGame, botMove, botDelay } from './bot.js';
import { sendTo, sendMany } from './hub.js';

const COUNTDOWN = 3000; // the game's own countdown, bots wait it out too
const TICK = 50;
const PREVIEW_EVERY = 250; // opponent boards go out four times a second
const PREVIEW_COUNT = { standard: 31, royale: 16 }; // boards one player is sent, royale only gets a handful
const AFK_MS = 40000; // a game that never locks a piece in this long is frozen or abandoned
const SUDDEN_AFTER = 180000; // after 3 minutes garbage starts piling on everyone so matches always end
const SUDDEN_EVERY = 10000;
const KO_WINDOW = 20000; // a player who dies within this long of being hit counts as a KO for the attacker
const MAX_BADGES = 4;
const MODES = ['random', 'attackers', 'knockouts', 'badges', 'manual'];

// starts a match for everyone in the lobby with the player role. onEnd gets the results
export function startMatch(lobby, onEnd) {
  const now = Date.now();
  const seed = crypto.randomInt(0, 2 ** 31);
  const players = new Map();

  for (const m of lobby.members) {
    if (m.role !== 'player') continue;
    const p = {
      id: m.id,
      name: m.name,
      bot: m.bot,
      level: m.level || 0,
      alive: true,
      placement: 0,
      kos: 0,
      badges: 0,
      sent: 0, // lines that actually went out
      claimed: 0, // lines a human's game said it sent, checked against a budget
      targetMode: 'random',
      manualId: null,
      targetId: null, // who the last attack went to
      hitBy: null,
      hitAt: 0,
      board: '0'.repeat(BOARD_SIZE),
      ver: 0, // goes up whenever the board changes, so only changed boards get sent
      height: 0,
      lastActive: now + COUNTDOWN,
      lastBoard: 0,
      outAt: 0, // when they went out, for the profile's playtime
      game: null,
      nextAt: 0,
    };
    if (m.bot) {
      p.game = makeBotGame(seededRandom(seed));
      p.nextAt = now + COUNTDOWN + 500 + Math.random() * 1500;
      // stronger bots aim smarter
      if (m.level >= 7) p.targetMode = 'knockouts';
      else if (m.level >= 4) p.targetMode = 'attackers';
    }
    players.set(p.id, p);
  }

  const match = {
    lobby,
    kind: lobby.kind,
    seed,
    startAt: now + COUNTDOWN,
    players,
    alive: players.size,
    views: new Map(), // member id -> what that player has already been sent
    ended: false,
    onEnd,
    lastPreview: 0,
    lastSudden: 0,
    timer: null,
  };
  match.timer = setInterval(() => tick(match), TICK);
  match.timer.unref();
  return match;
}

export function stopMatch(match) {
  match.ended = true;
  clearInterval(match.timer);
}

function humanIds(match) {
  return match.lobby.members.filter((m) => !m.bot).map((m) => m.id);
}

function getView(match, id) {
  if (!match.views.has(id)) match.views.set(id, { seen: new Map(), key: '', follow: null });
  return match.views.get(id);
}

function tick(match) {
  const now = Date.now();
  if (match.ended || now < match.startAt) return;

  for (const p of match.players.values()) {
    if (!p.alive) continue;
    if (p.bot) {
      if (now >= p.nextAt) botTurn(match, p, now);
    } else if (now - p.lastActive > AFK_MS) {
      eliminate(match, p);
    }
    if (match.ended) return;
  }

  // sudden death: garbage for everybody, a little more every 30 seconds
  const elapsed = now - match.startAt;
  if (elapsed > SUDDEN_AFTER && now - match.lastSudden >= SUDDEN_EVERY) {
    match.lastSudden = now;
    const lines = 1 + Math.floor((elapsed - SUDDEN_AFTER) / 30000);
    for (const p of match.players.values()) if (p.alive) deliver(p, lines, null);
  }

  if (now - match.lastPreview >= PREVIEW_EVERY) {
    match.lastPreview = now;
    sendPreviews(match);
  }
}

function botTurn(match, p, now) {
  const placed = botMove(p.game, p.level);
  for (const e of p.game.events.splice(0)) {
    if (e.type === 'attack') sendAttack(match, p, e.lines);
  }

  p.board = encodeBoard(p.game.board);
  p.ver++;
  p.height = stackHeight(p.board);
  p.nextAt = now + botDelay(p.level);

  if (!placed || p.game.state === 'over') eliminate(match, p);
}

// garbage lands on the target, bots take it into their own game and people get told
function deliver(p, lines, fromId) {
  if (p.bot) p.game.incoming += lines;
  else sendTo(p.id, { type: 'garbage', lines, from: fromId });
}

function pickTarget(match, from) {
  const others = [];
  for (const p of match.players.values()) if (p.alive && p !== from) others.push(p);
  if (others.length === 0) return null;

  const random = () => others[Math.floor(Math.random() * others.length)];
  const best = (score) => {
    let top = [];
    let topScore = -1;
    for (const p of others) {
      const s = score(p);
      if (s > topScore) {
        topScore = s;
        top = [p];
      } else if (s === topScore) {
        top.push(p);
      }
    }
    return top[Math.floor(Math.random() * top.length)];
  };

  if (from.targetMode === 'manual') {
    const chosen = match.players.get(from.manualId);
    return chosen && chosen.alive ? chosen : random();
  }
  if (from.targetMode === 'attackers') {
    const attackers = others.filter((p) => p.targetId === from.id);
    return attackers.length ? attackers[Math.floor(Math.random() * attackers.length)] : random();
  }
  if (from.targetMode === 'knockouts') return best((p) => p.height); // whoever is closest to topping out
  if (from.targetMode === 'badges') return best((p) => p.badges);
  return random();
}

function sendAttack(match, from, lines) {
  if (!from.alive || match.ended) return;

  // every KO badge makes attacks 25% stronger in battle royale
  if (match.kind === 'royale') lines = Math.ceil(lines * (1 + 0.25 * from.badges));

  const target = pickTarget(match, from);
  if (!target) return;

  from.targetId = target.id;
  from.sent += lines;
  target.hitBy = from.id;
  target.hitAt = Date.now();
  deliver(target, lines, from.id);
}

function eliminate(match, p) {
  if (!p.alive || match.ended) return;
  p.alive = false;
  p.outAt = Date.now();
  p.placement = match.alive;
  match.alive--;

  let killer = null;
  if (p.hitBy && Date.now() - p.hitAt < KO_WINDOW) {
    const k = match.players.get(p.hitBy);
    if (k && k.alive) killer = k;
  }

  if (killer) {
    killer.kos++;
    if (match.kind === 'royale') {
      // a KO gives a badge and cancels some of the garbage waiting for the killer
      killer.badges = Math.min(killer.badges + 1, MAX_BADGES);
      if (killer.bot) {
        killer.game.incoming = Math.max(0, killer.game.incoming - 4);
      } else {
        sendTo(killer.id, { type: 'ko', badges: killer.badges, cancel: 4 });
      }
    }
  }

  sendMany(humanIds(match), {
    type: 'out',
    id: p.id,
    placement: p.placement,
    by: killer ? killer.id : null,
    alive: match.alive,
  });

  if (match.alive <= 1) finish(match);
}

function finish(match) {
  if (match.ended) return;
  stopMatch(match);

  for (const p of match.players.values()) {
    if (p.alive) {
      p.alive = false;
      p.outAt = Date.now();
      p.placement = 1;
    }
  }
  const results = [...match.players.values()]
    .sort((a, b) => a.placement - b.placement)
    .map((p) => ({ id: p.id, name: p.name, bot: p.bot, level: p.level, placement: p.placement, kos: p.kos, sent: p.sent, ms: Math.max(0, p.outAt - match.startAt) }));
  match.onEnd(results, { ms: Date.now() - match.startAt, size: match.players.size, kind: match.kind });
}

// the boards one person gets to see. their target and the players aiming at them come first, then whoever fits
function sendPreviews(match) {
  const alive = [];
  for (const p of match.players.values()) if (p.alive) alive.push(p);
  const cap = PREVIEW_COUNT[match.kind];
  // in a big lobby the starting point moves every couple of seconds so everyone gets seen, small ones stay put
  const slot = alive.length > cap ? Math.floor(Date.now() / 2000) : 0;
  let index = 0;

  for (const m of match.lobby.members) {
    if (m.bot) continue;
    index++;
    const me = match.players.get(m.id);
    const view = getView(match, m.id);
    const ids = [];
    const add = (p) => {
      if (p && p.alive && p.id !== m.id && ids.length < cap && !ids.includes(p.id)) ids.push(p.id);
    };

    add(match.players.get(view.follow));
    if (me && me.alive) {
      add(match.players.get(me.targetId));
      for (const p of alive) if (p.targetId === me.id) add(p);
    }
    for (let i = 0; i < alive.length && ids.length < cap; i++) {
      add(alive[(i + slot * 7 + (slot ? index : 0)) % alive.length]);
    }

    // only boards that changed since last time are sent
    const boards = {};
    let changed = 0;
    for (const id of ids) {
      const p = match.players.get(id);
      if (view.seen.get(id) !== p.ver) {
        boards[id] = p.board;
        view.seen.set(id, p.ver);
        changed++;
      }
    }

    const target = me && me.alive ? me.targetId : null;
    const key = `${ids.join(',')}|${target}|${alive.length}`;
    if (changed === 0 && key === view.key) continue;
    view.key = key;
    sendTo(m.id, { type: 'previews', ids, boards, target, alive: alive.length });
  }
}

// messages from people while a match is running
export function matchMessage(match, userId, msg) {
  const id = String(userId);

  if (msg.type === 'watch') {
    getView(match, id).follow = typeof msg.id === 'string' ? msg.id : null;
    return;
  }

  const p = match.players.get(id);
  const now = Date.now();
  if (!p || p.bot || !p.alive || match.ended) return;

  if (msg.type === 'target') {
    if (!MODES.includes(msg.mode)) return;
    if (msg.mode === 'manual') {
      const chosen = match.players.get(msg.id);
      if (!chosen || !chosen.alive || chosen === p) return;
      p.manualId = chosen.id;
      p.targetId = chosen.id;
    }
    p.targetMode = msg.mode;
    return;
  }

  // nothing else counts before the countdown is over
  if (now < match.startAt - 1000) return;

  if (msg.type === 'attack') {
    const lines = msg.lines;
    if (!Number.isInteger(lines) || lines < 1 || lines > 10) return;

    // a game can't really send more than this much, anything past it is thrown away
    const seconds = (now - match.startAt) / 1000;
    if (p.claimed + lines > seconds * 6 + 12) return;
    p.claimed += lines;
    sendAttack(match, p, lines);
  } else if (msg.type === 'board') {
    if (!isBoardString(msg.rows) || now - p.lastBoard < 100) return;
    p.lastBoard = now;
    p.lastActive = now;
    p.board = msg.rows;
    p.ver++;
    p.height = stackHeight(msg.rows);
  } else if (msg.type === 'dead') {
    eliminate(match, p);
  }
}

// a person left or lost their connection, that is the same as losing
export function playerLeft(match, id) {
  const p = match.players.get(id);
  if (p && !p.bot) eliminate(match, p);
}
