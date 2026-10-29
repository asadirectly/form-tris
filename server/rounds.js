import crypto from 'node:crypto';
import { config } from './config.js';
import { charge } from './formbar.js';
import { getPrice, addScore } from './leaderboard.js';
import { SPRINT_LINES } from '../src/game/constants.js';

const modes = ['normal', 'sprint'];
const busy = new Set(); // user ids with a payment in progress
const recent = new Map(); // userId:requestId -> the round we already gave out
const openRounds = new Map(); // roundId -> who paid for it and when, until its score comes in
const MIN_SPRINT_MS = 10000; // nobody clears 40 lines faster than this

function fail(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function forgetOld() {
  for (const [key, entry] of recent) {
    if (Date.now() - entry.time > 10 * 60 * 1000) recent.delete(key);
  }

  // an open round only lives as long as the login cookie does
  for (const [id, round] of openRounds) {
    if (Date.now() - round.start > 8 * 60 * 60 * 1000) openRounds.delete(id);
  }
}

export async function startRound(user, mode, pin, requestId, expectedCost) {
  if (!modes.includes(mode)) throw fail(400, 'unknown game mode');
  if (typeof requestId !== 'string' || requestId.length < 8 || requestId.length > 64) {
    throw fail(400, 'bad request id');
  }

  // the user comes from the server-side session (set at login), never from an id sent by the browser

  // a retry of the same request gets the same round back instead of a second charge
  forgetOld();
  const key = `${user.id}:${requestId}`;
  if (recent.has(key)) return recent.get(key).round;

  // stops double clicks and two tabs from charging twice at the same moment
  if (busy.has(user.id)) throw fail(409, 'a payment is already going through');
  busy.add(user.id);

  try {
    const free = user.id === config.ownerId;
    const cost = free ? 0 : getPrice(user.id);

    if (!free) {
      if (!/^\d{1,10}$/.test(String(pin))) throw fail(400, 'enter your Formbar PIN (numbers only)');

      // rankings change, so only charge the price the player was actually shown
      if (expectedCost !== cost) throw fail(409, `the price is now ${cost} Digipogs, please check it and try again`);

      // formbar wants the pin as a number
      const paid = await charge(user.id, cost, Number(pin));
      if (!paid.ok) throw fail(402, paid.message);
    }

    const round = { roundId: crypto.randomUUID(), mode, paid: cost };
    recent.set(key, { round, time: Date.now() });
    openRounds.set(round.roundId, { userId: user.id, mode, start: Date.now() });
    return round;
  } finally {
    busy.delete(user.id);
  }
}

// the game runs in the browser so the server can't replay it, these checks just throw out results that can't be real
function checkResult(round, r) {
  for (const n of [r.score, r.lines, r.level, r.time]) {
    if (!Number.isInteger(n) || n < 0) return 'bad numbers';
  }

  // the game clock can't run longer than the round has been open, minus the 3 second countdown
  const elapsed = Date.now() - round.start;
  if (r.time > elapsed - 2500) return 'time is longer than the round';

  if (round.mode === 'sprint') {
    // the last clear can overshoot 40 by up to 3 lines
    if (r.won !== true || r.lines < SPRINT_LINES || r.lines > SPRINT_LINES + 3) return 'sprint was not finished';
    if (r.time < MIN_SPRINT_MS) return 'sprint is too fast to be real';
    return null;
  }

  if (r.level !== Math.floor(r.lines / 10) + 1) return 'level does not match lines';
  if (r.lines > (r.time / 1000) * 4 + 4) return 'too many lines for the time';
  if (r.score > (r.lines * 2000 + 3000) * r.level) return 'score is too high for the lines';
  return null;
}

// puts a finished game on the leaderboard, only for a round this player paid for
export function finishRound(user, roundId, result) {
  const round = openRounds.get(roundId);
  if (!round || round.userId !== user.id) throw fail(400, 'there is no open round for this score');
  openRounds.delete(roundId); // one score per round, even a rejected one uses it up

  const problem = checkResult(round, result);
  if (problem) {
    console.log(`score from user ${user.id} rejected: ${problem}`);
    throw fail(400, 'that score could not be verified, so it was not saved');
  }

  return addScore(user, round.mode, round.mode === 'sprint' ? result.time : result.score);
}
