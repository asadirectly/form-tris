import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../data');
const file = path.join(dataDir, 'leaderboard.json');

// one best result per player in each mode, keyed by formbar user id
// normal keeps the score, sprint keeps the time in ms
const boards = { normal: {}, sprint: {} };

try {
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  boards.normal = saved.normal || {};
  boards.sprint = saved.sprint || {};
} catch (err) {
  // no file just means nobody has played yet, anything else we don't want to overwrite
  if (err.code !== 'ENOENT') {
    console.error('could not read data/leaderboard.json, fix or delete it:', err.message);
    process.exit(1);
  }
}

function save() {
  fs.mkdirSync(dataDir, { recursive: true });
  // write a temp file and swap it in, so a crash can't leave half a file behind
  fs.writeFileSync(file + '.tmp', JSON.stringify(boards, null, 2));
  fs.renameSync(file + '.tmp', file);
}

// best first: highest score for normal, lowest time for sprint. a tie goes to whoever got there first
function sorted(mode) {
  const list = Object.values(boards[mode]);
  list.sort((a, b) => {
    const diff = mode === 'sprint' ? a.value - b.value : b.value - a.value;
    return diff || a.date - b.date;
  });
  return list;
}

export function addScore(user, mode, value) {
  const old = boards[mode][user.id];
  const better = !old || (mode === 'sprint' ? value < old.value : value > old.value);

  if (better) {
    boards[mode][user.id] = { userId: user.id, name: user.name, value, date: Date.now() };
  } else {
    old.name = user.name; // formbar names can change
  }
  save();

  const rank = sorted(mode).findIndex((entry) => entry.userId === user.id) + 1;
  return { rank, isNewBest: better };
}

// the biggest discount a player has earned on either board, as a percent
export function getDiscount(userId) {
  let best = 0;
  for (const mode of Object.keys(boards)) {
    const place = sorted(mode).findIndex((entry) => entry.userId === userId);
    if (place >= 0 && place < config.discounts.length) best = Math.max(best, config.discounts[place]);
  }
  return best;
}

// what the player pays right now. formbar only takes whole digipogs (it rounds down anything else),
// so the discounted price is rounded to the nearest whole one here, where we can see it
export function getPrice(userId) {
  return Math.round((config.roundCost * (100 - getDiscount(userId))) / 100);
}

export function getBoards(userId) {
  const result = {};

  for (const mode of Object.keys(boards)) {
    const list = sorted(mode);
    const entries = list.slice(0, config.boardSize).map((entry, i) => ({
      rank: i + 1,
      userId: entry.userId,
      name: entry.name,
      value: entry.value,
      discount: config.discounts[i] || 0,
    }));

    // players outside the top rows still get to see where they are
    const place = list.findIndex((entry) => entry.userId === userId);
    const you = place >= config.boardSize ? { rank: place + 1, value: list[place].value } : null;

    result[mode] = { entries, you };
  }
  return result;
}
