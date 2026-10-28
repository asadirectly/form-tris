import crypto from 'node:crypto';
import { config } from './config.js';
import { charge } from './formbar.js';

const modes = ['normal', 'sprint'];
const busy = new Set(); // user ids with a payment in progress
const recent = new Map(); // userId:requestId -> the round we already gave out

function fail(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function forgetOld() {
  for (const [key, entry] of recent) {
    if (Date.now() - entry.time > 10 * 60 * 1000) recent.delete(key);
  }
}

export async function startRound(user, mode, pin, requestId) {
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

    if (!free) {
      if (!/^\d{1,10}$/.test(String(pin))) throw fail(400, 'enter your Formbar PIN (numbers only)');

      // formbar wants the pin as a number
      const paid = await charge(user.id, config.roundCost, Number(pin));
      if (!paid.ok) throw fail(402, paid.message);
    }

    const round = { roundId: crypto.randomUUID(), mode, paid: free ? 0 : config.roundCost };
    recent.set(key, { round, time: Date.now() });
    return round;
  } finally {
    busy.delete(user.id);
  }
}
