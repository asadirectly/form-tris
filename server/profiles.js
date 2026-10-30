import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { getBests } from './leaderboard.js';
import { ACHIEVEMENTS, RANKS, MAX_SHOWN_RANKS, earnedRanks } from '../src/game/achievements.js';
import { DEFAULT_PICTURE } from '../src/game/pictures.js';

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../data');
const file = path.join(dataDir, 'profiles.json');

const MIN_MATCH_MS = 60 * 1000; // a match shorter than this doesn't count, it stops two accounts farming wins
const PAGE_SIZE = 30;

// every profile is saved under the formbar user id, names are only kept for showing
let profiles = {};

try {
  profiles = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (err) {
  // no file just means nobody has logged in yet, anything else we don't want to overwrite
  if (err.code !== 'ENOENT') {
    console.error('could not read data/profiles.json, fix or delete it:', err.message);
    process.exit(1);
  }
}

function save() {
  fs.mkdirSync(dataDir, { recursive: true });
  // write a temp file and swap it in, so a crash can't leave half a file behind
  fs.writeFileSync(file + '.tmp', JSON.stringify(profiles));
  fs.renameSync(file + '.tmp', file);
}

function newStats() {
  return {
    rounds: 0, // finished rounds and matches
    wins: 0, // finished 40L races and won matches
    losses: 0, // failed 40L races and lost matches
    playMs: 0,
    lines: 0, // solo only, matches don't report lines
    tspins: 0,
    tetrises: 0,
    perfects: 0,
    maxCombo: 0,
    bestLevel: 0,
    normalRounds: 0,
    sprintRounds: 0,
    sprintFinishes: 0,
    matches: 0,
    matchWins: 0,
    kos: 0,
    sent: 0,
    mostKos: 0, // best in one match
    mostSent: 0,
    biggestWin: 0, // most players in a match that was won
  };
}

function getOrCreate(user) {
  const id = String(user.id);
  if (!profiles[id]) {
    profiles[id] = {
      id: Number(user.id),
      name: user.name,
      joined: Date.now(),
      picture: DEFAULT_PICTURE,
      shownRanks: null, // null means the highest earned rank, a list is the player's own choice
      stats: newStats(),
      achievements: {}, // achievement id -> the time it was earned
    };
  }
  const profile = profiles[id];
  profile.name = user.name; // formbar names can change
  // stats added in later versions start at zero for old profiles
  profile.stats = { ...newStats(), ...profile.stats };
  return profile;
}

// called at login (and on /api/me, for sessions that started before profiles existed) so every player
// is in the directory and their name stays up to date
export function touchProfile(user) {
  const old = profiles[String(user.id)];
  const changed = !old || old.name !== user.name;
  getOrCreate(user);
  if (changed) save();
}

// awards every achievement this game earned that the player doesn't have yet. one that can't be earned in this mode is skipped
function unlock(profile, mode, result) {
  const before = earnedRanks(Object.keys(profile.achievements).length).length;
  const unlocked = [];

  for (const a of ACHIEVEMENTS) {
    if (profile.achievements[a.id]) continue; // never twice
    if (a.mode !== 'any' && ![].concat(a.mode).includes(mode)) continue;
    if (a.test(profile.stats, result)) {
      profile.achievements[a.id] = Date.now();
      unlocked.push(a.id);
    }
  }

  const ranks = earnedRanks(Object.keys(profile.achievements).length);
  return { unlocked, newRank: ranks.length > before ? ranks[ranks.length - 1].id : null };
}

// a solo round that rounds.js already checked. result has score, lines, level, time, won and the clear counts
export function recordSolo(user, mode, result) {
  const profile = getOrCreate(user);
  const s = profile.stats;

  s.rounds++;
  s.playMs += result.time;
  s.lines += result.lines;
  s.tspins += result.tspins;
  s.tetrises += result.tetrises;
  s.perfects += result.perfects;
  s.maxCombo = Math.max(s.maxCombo, result.combo);

  if (mode === 'normal') {
    s.normalRounds++;
    s.bestLevel = Math.max(s.bestLevel, result.level);
  } else {
    s.sprintRounds++;
    if (result.won) {
      s.sprintFinishes++;
      s.wins++;
    } else {
      s.losses++;
    }
  }

  const earned = unlock(profile, mode, result);
  save();
  return earned;
}

// a finished multiplayer match. rows are the server's own results, so nothing here comes from a browser
// info is { ms, size, kind }. returns what each person unlocked, keyed by user id
export function recordMatch(rows, info) {
  const earned = {};
  if (info.ms < MIN_MATCH_MS) return earned;

  for (const row of rows) {
    if (row.bot) continue;
    const profile = getOrCreate({ id: Number(row.id), name: row.name });
    const s = profile.stats;
    const won = row.placement === 1;

    s.rounds++;
    s.matches++;
    s.playMs += row.ms;
    s.kos += row.kos;
    s.sent += row.sent;
    s.mostKos = Math.max(s.mostKos, row.kos);
    s.mostSent = Math.max(s.mostSent, row.sent);
    if (won) {
      s.matchWins++;
      s.wins++;
      s.biggestWin = Math.max(s.biggestWin, info.size);
    } else {
      s.losses++;
    }

    earned[row.id] = unlock(profile, 'multi', { placement: row.placement, kos: row.kos, sent: row.sent, kind: info.kind, size: info.size });
  }

  save();
  return earned;
}

// the badges shown beside a name: owner and admin first (they don't use up the player's choices), then the chosen ranks
export function badgesFor(userId) {
  const badges = [];
  if (userId === config.ownerId) badges.push('owner');
  if (config.adminIds.includes(userId)) badges.push('admin');

  const profile = profiles[String(userId)];
  if (profile) badges.push(...shownRanks(profile));
  return badges;
}

function shownRanks(profile) {
  const earned = earnedRanks(Object.keys(profile.achievements).length);
  if (earned.length === 0) return [];
  if (!profile.shownRanks) return [earned[earned.length - 1].id];
  // ranks can't be lost, but only show ones that are still earned
  return profile.shownRanks.filter((id) => earned.some((rank) => rank.id === id));
}

export function pictureOf(userId) {
  const profile = profiles[String(userId)];
  return profile ? profile.picture : DEFAULT_PICTURE;
}

export function setShownRanks(userId, ranks) {
  const profile = profiles[String(userId)];
  if (!profile) return null;

  if (!Array.isArray(ranks) || ranks.length > MAX_SHOWN_RANKS) return null;
  const earned = earnedRanks(Object.keys(profile.achievements).length);
  for (const id of ranks) {
    if (typeof id !== 'string' || !earned.some((rank) => rank.id === id)) return null; // only earned ones
  }
  if (new Set(ranks).size !== ranks.length) return null;

  profile.shownRanks = ranks;
  save();
  return badgesFor(userId);
}

// what anyone can see. this is the one place that decides what is public, so privacy settings can go here later
export function publicProfile(userId) {
  const profile = profiles[String(userId)];
  if (!profile) return null;

  const count = Object.keys(profile.achievements).length;
  const earned = earnedRanks(count);
  const top = earned[earned.length - 1] || null;
  const next = RANKS.find((rank) => rank.need > count) || null;

  return {
    id: profile.id,
    name: profile.name,
    picture: profile.picture,
    joined: profile.joined,
    badges: badgesFor(profile.id),
    stats: profile.stats,
    bests: getBests(profile.id),
    achievements: profile.achievements,
    rank: {
      count,
      earned: earned.map((rank) => rank.id),
      shown: shownRanks(profile),
      top: top ? top.id : null,
      next: next ? { id: next.id, need: next.need } : null,
    },
  };
}

// the player directory, searchable by name. most achievements first, then alphabetical
export function searchProfiles(query, offset) {
  const text = String(query || '').trim().toLowerCase().slice(0, 40);
  let list = Object.values(profiles);
  if (text) list = list.filter((p) => p.name.toLowerCase().includes(text));

  list.sort((a, b) => Object.keys(b.achievements).length - Object.keys(a.achievements).length || a.name.localeCompare(b.name));

  const start = Number.isInteger(offset) && offset > 0 ? offset : 0;
  const rows = list.slice(start, start + PAGE_SIZE).map((p) => ({
    id: p.id,
    name: p.name,
    picture: p.picture,
    badges: badgesFor(p.id),
    achievements: Object.keys(p.achievements).length,
  }));
  return { total: list.length, profiles: rows };
}
