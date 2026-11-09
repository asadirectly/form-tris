import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { getBests } from './leaderboard.js';
import { ACHIEVEMENTS, RANKS, MAX_SHOWN_RANKS, earnedRanks } from '../src/game/achievements.js';
import { DEFAULT_PICTURE, PICTURES } from '../src/game/pictures.js';
import { COSMETIC_RANKS } from '../src/game/shop.js';
import { DEFAULT_KEYS, cleanKeys } from '../src/game/keys.js';

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../data');
const file = path.join(dataDir, 'profiles.json');

const MIN_MATCH_MS = 60 * 1000; // a match shorter than this doesn't count, it stops two accounts farming wins
const MIN_RUSH_MS = 20 * 1000; // a rush can be short on purpose (the host picks the line goal), so it needs less
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
    blastRounds: 0,
    matches: 0,
    matchWins: 0,
    realWins: 0, // multiplayer wins (standard, battle royale, rush) in matches with at least one other real player
    realKos: 0, // battle royale KOs in matches with at least one other real player
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
      picture: DEFAULT_PICTURE, // the one the player equipped
      pictureOverride: null, // { value, by, at } when an admin picked a picture for them, it wins until an admin clears it
      owned: [], // shop items bought or gifted, picture and rank ids
      shownRanks: null, // the titles shown by the name. null means the usual ones, a list is the player's own choice
      titlesV2: true,
      settings: { keys: null, effects: true }, // keys null means the default controls
      ban: null, // { until, reason, by, at } while banned from multiplayer
      stats: newStats(),
      achievements: {}, // achievement id -> the time it was earned
    };
  }
  const profile = profiles[id];
  profile.name = user.name; // formbar names can change
  upgrade(profile);
  return profile;
}

// brings a profile saved by an older version up to date. this runs for every profile when the server starts
function upgrade(profile) {
  // stats added in later versions start at zero for old profiles
  profile.stats = { ...newStats(), ...profile.stats };
  if (!profile.owned) profile.owned = [];
  delete profile.tickets; // multiplayer tickets were replaced by paying on entry
  if (profile.pictureOverride === undefined) profile.pictureOverride = null;
  if (profile.ban === undefined) profile.ban = null;
  if (!profile.settings) profile.settings = { keys: null, effects: true };
  if (!profile.achievements) profile.achievements = {};
  // before the shop, owner and admin were always shown. they are titles you pick now, so keep them for people who had chosen ranks
  if (!profile.titlesV2) {
    profile.titlesV2 = true;
    if (Array.isArray(profile.shownRanks)) profile.shownRanks = [...adminTitles(profile.id), ...profile.shownRanks];
  }
}

// owner and admin are titles tied to the formbar user id in config.js. showing or hiding one never changes what the player can do
function adminTitles(userId) {
  const titles = [];
  if (userId === config.ownerId) titles.push('owner');
  if (config.adminIds.includes(userId)) titles.push('admin');
  return titles;
}

for (const profile of Object.values(profiles)) upgrade(profile);

// called at login (and on /api/me, for sessions that started before profiles existed) so every player
// is in the directory and their name stays up to date
export function profileName(userId) {
  const profile = profiles[String(userId)];
  return profile ? profile.name : null;
}

// a player's saved settings. keys are always a complete valid set
export function settingsOf(userId) {
  const profile = profiles[String(userId)];
  const saved = profile ? profile.settings : null;
  return { keys: (saved && cleanKeys(saved.keys)) || DEFAULT_KEYS, effects: saved ? saved.effects !== false : true };
}

// saves the parts that were sent. returns the new settings, or null if something is not allowed
export function saveSettings(userId, input) {
  const profile = profiles[String(userId)];
  if (!profile || !input || typeof input !== 'object') return null;

  if (input.keys !== undefined) {
    const keys = input.keys === null ? null : cleanKeys(input.keys);
    if (input.keys !== null && !keys) return null;
    profile.settings.keys = keys;
  }
  if (input.effects !== undefined) {
    if (typeof input.effects !== 'boolean') return null;
    profile.settings.effects = input.effects;
  }
  save();
  return settingsOf(userId);
}

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
  } else if (mode === 'blast') {
    s.blastRounds++;
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
  if (info.ms < (info.kind === 'rush' ? MIN_RUSH_MS : MIN_MATCH_MS)) return earned;

  // wins and KOs on the leaderboards only count when another real player was in the match, bots alone don't
  const humans = rows.filter((row) => !row.bot).length;

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
    if (humans >= 2) {
      if (won) s.realWins++;
      if (info.kind === 'royale') s.realKos += row.kos;
    }
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

// is this title one the player can show right now? earned ranks and bought ranks only count if they still have them
function canShow(profile, id) {
  if (id === 'owner' || id === 'admin') return adminTitles(profile.id).includes(id);
  if (RANKS.some((rank) => rank.id === id)) return earnedRanks(Object.keys(profile.achievements).length).some((rank) => rank.id === id);
  if (Object.hasOwn(COSMETIC_RANKS, id)) return profile.owned.includes(id);
  return false;
}

// the titles shown beside a name, in the order the player picked them (the first one sets the profile color).
// if the player never chose, it is owner/admin plus their highest earned rank
function shownTitles(profile) {
  let list = profile.shownRanks;
  if (!list) {
    const earned = earnedRanks(Object.keys(profile.achievements).length);
    list = [...adminTitles(profile.id), ...(earned.length > 0 ? [earned[earned.length - 1].id] : [])];
  }
  return list.filter((id) => canShow(profile, id));
}

export function badgesFor(userId) {
  const profile = profiles[String(userId)];
  return profile ? shownTitles(profile) : [];
}

// every title a player could pick from right now, for their own profile
function pickableTitles(profile) {
  const ranks = earnedRanks(Object.keys(profile.achievements).length).map((rank) => rank.id);
  const bought = profile.owned.filter((id) => Object.hasOwn(COSMETIC_RANKS, id));
  return [...adminTitles(profile.id), ...ranks, ...bought];
}

// the player picks what to show and in what order: up to 2 ranks (earned or bought), plus owner/admin if they have them. returns null if it isn't allowed
export function setShownRanks(userId, titles) {
  const profile = profiles[String(userId)];
  if (!profile || !Array.isArray(titles)) return null;

  if (new Set(titles).size !== titles.length) return null;
  for (const id of titles) {
    if (typeof id !== 'string' || !canShow(profile, id)) return null;
  }
  // owner and admin don't use up the choices
  if (titles.filter((id) => id !== 'owner' && id !== 'admin').length > MAX_SHOWN_RANKS) return null;

  profile.shownRanks = titles;
  save();
  return shownTitles(profile);
}

// the picture everyone sees: an admin's choice if there is one, otherwise what the player equipped
function pictureOfProfile(profile) {
  if (profile.pictureOverride) return profile.pictureOverride.value;
  const own = profile.picture;
  return own === DEFAULT_PICTURE || profile.owned.includes(own) ? own : DEFAULT_PICTURE;
}

export function pictureOf(userId) {
  const profile = profiles[String(userId)];
  return profile ? pictureOfProfile(profile) : DEFAULT_PICTURE;
}

// equip a picture the player owns (the classic cat is always theirs)
export function equipPicture(userId, key) {
  const profile = profiles[String(userId)];
  if (!profile || typeof key !== 'string') return null;
  if (key !== DEFAULT_PICTURE && !(Object.hasOwn(PICTURES, key) && profile.owned.includes(key))) return null;

  profile.picture = key;
  save();
  return pictureOfProfile(profile);
}

export function owns(userId, itemId) {
  const profile = profiles[String(userId)];
  return !!profile && profile.owned.includes(itemId);
}

// puts a shop item in a player's collection. it is permanent unless an admin takes it back. returns false if they already had it
export function grantItem(userId, itemId) {
  const profile = profiles[String(userId)];
  if (!profile) return false;
  if (profile.owned.includes(itemId)) return false;
  profile.owned.push(itemId);
  save();
  return true;
}

export function revokeItem(userId, itemId) {
  const profile = profiles[String(userId)];
  if (!profile || !profile.owned.includes(itemId)) return false;
  profile.owned = profile.owned.filter((id) => id !== itemId);
  if (profile.picture === itemId) profile.picture = DEFAULT_PICTURE;
  if (profile.shownRanks) profile.shownRanks = profile.shownRanks.filter((id) => id !== itemId);
  save();
  return true;
}

// an admin picks a picture for someone (value is any picture key, or null to take the override off)
export function setPictureOverride(userId, value, by) {
  const profile = profiles[String(userId)];
  if (!profile) return null;
  const old = profile.pictureOverride ? profile.pictureOverride.value : null;
  profile.pictureOverride = value ? { value, by, at: Date.now() } : null;
  save();
  return old; // so the caller can delete an uploaded file that nobody uses any more
}

// an admin can give or take back an achievement. ranks follow from the count, so they update by themselves
export function setAchievement(userId, id, give) {
  const profile = profiles[String(userId)];
  if (!profile || !ACHIEVEMENTS.some((a) => a.id === id)) return false;
  if (give) {
    if (profile.achievements[id]) return false;
    profile.achievements[id] = Date.now();
  } else {
    if (!profile.achievements[id]) return false;
    delete profile.achievements[id];
  }
  save();
  return true;
}

// the multiplayer ban if there is one that hasn't run out
export function banOf(userId) {
  const profile = profiles[String(userId)];
  if (!profile || !profile.ban) return null;
  if (profile.ban.until && profile.ban.until <= Date.now()) return null;
  return profile.ban;
}

export function setBan(userId, ban) {
  const profile = profiles[String(userId)];
  if (!profile) return false;
  profile.ban = ban;
  save();
  return true;
}

// how many players have each achievement
export function achievementCounts() {
  const counts = {};
  for (const p of Object.values(profiles)) {
    for (const id of Object.keys(p.achievements)) counts[id] = (counts[id] || 0) + 1;
  }
  return counts;
}

// numbers for the admin panel
export function siteStats() {
  const stats = { players: 0, rounds: 0, normalRounds: 0, sprintRounds: 0, matches: 0, banned: 0 };
  for (const p of Object.values(profiles)) {
    stats.players++;
    stats.rounds += p.stats.rounds;
    stats.normalRounds += p.stats.normalRounds;
    stats.sprintRounds += p.stats.sprintRounds;
    stats.matches += p.stats.matches;
    if (banOf(p.id)) stats.banned++;
  }
  return stats;
}

// the two boards made from profile stats: most wins and most royale KOs. no discounts come from these
function statBoard(key, userId) {
  const list = Object.values(profiles).filter((p) => p.stats[key] > 0);
  list.sort((a, b) => b.stats[key] - a.stats[key] || a.joined - b.joined);

  const entries = list.slice(0, config.boardSize).map((p, i) => ({ rank: i + 1, userId: p.id, name: p.name, value: p.stats[key], discount: 0 }));
  const place = list.findIndex((p) => p.id === userId);
  const you = place >= config.boardSize ? { rank: place + 1, value: list[place].stats[key] } : null;
  return { entries, you };
}

export function getStatBoards(userId) {
  return { wins: statBoard('realWins', userId), kos: statBoard('realKos', userId) };
}

// what anyone can see. this is the one place that decides what is public, so privacy settings can go here later
export function publicProfile(userId, viewerId) {
  const profile = profiles[String(userId)];
  if (!profile) return null;

  const count = Object.keys(profile.achievements).length;
  const earned = earnedRanks(count);
  const top = earned[earned.length - 1] || null;
  const next = RANKS.find((rank) => rank.need > count) || null;

  const view = {
    id: profile.id,
    name: profile.name,
    picture: pictureOfProfile(profile),
    pictureByAdmin: !!profile.pictureOverride,
    joined: profile.joined,
    badges: shownTitles(profile),
    stats: profile.stats,
    bests: getBests(profile.id),
    achievements: profile.achievements,
    rank: {
      count,
      earned: earned.map((rank) => rank.id),
      top: top ? top.id : null,
      next: next ? { id: next.id, need: next.need } : null,
    },
  };

  // what the player owns and what they picked is only sent to the player themselves
  if (viewerId === profile.id) {
    view.mine = {
      picture: profile.picture,
      owned: profile.owned,
      pickable: pickableTitles(profile),
      titles: shownTitles(profile),
    };
  }
  return view;
}

// everything an admin gets to see about a player
export function adminProfile(userId) {
  const profile = profiles[String(userId)];
  if (!profile) return null;
  return {
    ...publicProfile(userId, null),
    owned: profile.owned,
    equipped: profile.picture,
    override: profile.pictureOverride,
    ban: banOf(userId),
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
    picture: pictureOfProfile(p),
    badges: shownTitles(p),
    achievements: Object.keys(p.achievements).length,
  }));
  return { total: list.length, profiles: rows };
}
