import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { charge } from './formbar.js';
import { allItems } from '../src/game/shop.js';
import { owns, grantItem, revokeItem } from './profiles.js';

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../data');
const file = path.join(dataDir, 'shop.json');

const MAX_LOG = 3000;
const MAX_PRICE = 100000;
const defaults = new Map(allItems().map((item) => [item.id, item]));

// items holds only what an admin changed from the defaults (price, text, enabled). log is every transaction, newest last
// a log entry goes pending -> paid -> done, so a crash in the middle can always be put right when the server starts
let state = { items: {}, sale: { percent: 0, label: '' }, log: [], credits: {} };

try {
  state = { ...state, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
} catch (err) {
  if (err.code !== 'ENOENT') {
    console.error('could not read data/shop.json, fix or delete it:', err.message);
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

function addLog(entry) {
  const full = { id: crypto.randomUUID(), at: Date.now(), ...entry };
  state.log.push(full);
  if (state.log.length > MAX_LOG) state.log = state.log.slice(-MAX_LOG);
  return full;
}

// money was taken but the item never arrived: finish it. a payment we never heard back about needs an admin to look at it
let fixed = false;
for (const entry of state.log) {
  if (entry.status === 'paid') {
    handOver(entry.userId, entry.item);
    entry.status = 'done';
    entry.note = 'finished after a restart';
    fixed = true;
  } else if (entry.status === 'pending') {
    entry.status = 'unknown';
    entry.note = 'the server stopped before the payment was confirmed';
    fixed = true;
  }
}
if (fixed) save();

// the multiplayer entry fee is not an item. if somebody paid and could not get in, they keep a saved entry (a credit)
// that makes their next entry free. it is only ever made when a payment could not be undone, never sold
export const ENTRY = 'multiplayer-entry';

export function creditsOf(userId) {
  return state.credits[userId] || 0;
}

export function addCredit(userId) {
  state.credits[userId] = creditsOf(userId) + 1;
  save();
}

function useCredit(userId) {
  if (creditsOf(userId) < 1) return false;
  state.credits[userId]--;
  if (state.credits[userId] === 0) delete state.credits[userId];
  save();
  return true;
}

function handOver(userId, itemId) {
  if (itemId === ENTRY) {
    addCredit(userId);
    return true;
  }
  return grantItem(userId, itemId);
}

// the item with any admin changes on top
function itemNow(id) {
  const base = defaults.get(id);
  if (!base) return null;
  const changes = state.items[id] || {};
  return {
    ...base,
    basePrice: changes.price ?? base.price,
    text: changes.text ?? base.text,
    enabled: changes.enabled !== false,
  };
}

// what the player really pays, after any sale. whole digipogs only, formbar rounds anything else down
function finalPrice(basePrice) {
  return Math.max(1, Math.round((basePrice * (100 - state.sale.percent)) / 100));
}

// what the shop screen shows one player
export function shopFor(userId) {
  const items = [];
  for (const id of defaults.keys()) {
    const item = itemNow(id);
    if (!item.enabled) continue;
    items.push({ id, kind: item.kind, label: item.label, name: item.name, text: item.text, rare: item.rare, price: finalPrice(item.basePrice), basePrice: item.basePrice, owned: owns(userId, id) });
  }
  return { items, sale: state.sale };
}

const busy = new Set(); // user ids with a purchase in progress
const recent = new Map(); // userId:requestId -> the answer we already gave, so a retry doesn't charge twice

export async function buy(user, itemId, pin, requestId, expectedPrice) {
  const item = typeof itemId === 'string' ? itemNow(itemId) : null;  if (!item || !item.enabled) throw fail(404, 'that item is not for sale');
  if (typeof requestId !== 'string' || requestId.length < 8 || requestId.length > 64) throw fail(400, 'bad request id');
  if (!/^\d{1,10}$/.test(String(pin))) throw fail(400, 'enter your Formbar PIN (numbers only)');

  const key = `${user.id}:${requestId}`;
  for (const [k, old] of recent) if (Date.now() - old.time > 10 * 60 * 1000) recent.delete(k);
  if (recent.has(key)) return recent.get(key).result;

  if (owns(user.id, itemId)) throw fail(409, 'you already own that');
  if (busy.has(user.id)) throw fail(409, 'a payment is already going through');
  busy.add(user.id);

  try {
    // owning something is checked again now that we hold the lock, two clicks can't both get past this
    if (owns(user.id, itemId)) throw fail(409, 'you already own that');

    // prices change (sales, rankings, admins), so only charge what the player was shown
    const price = finalPrice(item.basePrice);
    if (expectedPrice !== price) throw fail(409, `the price is now ${price} Digipogs, please check it and try again`);

    // written down before the payment, so a crash can never lose track of a charge
    const entry = addLog({ requestId, userId: user.id, name: user.name, item: itemId, price, status: 'pending' });
    save();

    const paid = await charge(user.id, price, Number(pin), `Form-Tris! shop: ${item.name}`);
    if (!paid.ok) {
      entry.status = paid.unsure ? 'unknown' : 'failed';
      entry.note = paid.message;
      save();
      if (paid.unsure) {
        throw fail(502, "We couldn't confirm the payment with Formbar. Check your Digipogs before trying again. If you were charged, an admin can give you the item.");
      }
      throw fail(402, paid.message);
    }

    // the money is taken, so the item has to be handed over. 'paid' is saved first so a restart can finish the job
    entry.status = 'paid';
    try {
      save();
    } catch (err) {
      console.error('could not save a paid purchase:', entry, err.message);
    }
    try {
      handOver(user.id, itemId);
      entry.status = 'done';
      save();
    } catch (err) {
      console.error('paid but could not give the item:', entry, err.message);
      throw fail(500, 'Your payment went through but saving the item failed. It will be added when the server restarts, or an admin can give it to you.');
    }

    const result = { item: itemId, price };
    recent.set(key, { result, time: Date.now() });
    return result;
  } finally {
    busy.delete(user.id);
  }
}

// the answer already given for this request id, so a retry after a dropped connection just gets the same answer
export function previousAnswer(userId, requestId) {
  const old = recent.get(`${userId}:${requestId}`);
  return old ? old.result : null;
}

// pays the multiplayer entry fee and then runs commit(), which puts the player in the lobby.
// the caller already checked that the entry can work, so commit() almost never fails. formbar has no refund for a transfer,
// so if it does fail after the charge the player gets a saved entry instead of losing the money
export async function payEntry(user, price, pin, requestId, expectedPrice, commit) {
  if (typeof requestId !== 'string' || requestId.length < 8 || requestId.length > 64) throw fail(400, 'bad request id');

  const key = `${user.id}:${requestId}`;
  for (const [k, old] of recent) if (Date.now() - old.time > 10 * 60 * 1000) recent.delete(k);
  if (recent.has(key)) return recent.get(key).result;

  if (busy.has(user.id)) throw fail(409, 'a payment is already going through');
  busy.add(user.id);

  try {
    // a saved entry pays for itself
    const useSaved = price > 0 && creditsOf(user.id) > 0;
    const owed = useSaved ? 0 : price;
    if (expectedPrice !== owed) throw fail(409, `the entry fee is now ${owed} Digipogs, please check it and try again`);

    let result;
    if (owed === 0) {
      if (useSaved) useCredit(user.id);
      try {
        commit();
      } catch (err) {
        if (useSaved) addCredit(user.id);
        throw err;
      }
      if (useSaved) {
        addLog({ requestId, userId: user.id, name: user.name, item: ENTRY, price: 0, status: 'done', note: 'used a saved entry' });
        save();
      }
      result = { joined: true, price: 0 };
    } else {
      if (!/^\d{1,10}$/.test(String(pin))) throw fail(400, 'enter your Formbar PIN (numbers only)');

      const entry = addLog({ requestId, userId: user.id, name: user.name, item: ENTRY, price, status: 'pending' });
      save();

      const paid = await charge(user.id, price, Number(pin), 'Form-Tris! multiplayer entry');
      if (!paid.ok) {
        entry.status = paid.unsure ? 'unknown' : 'failed';
        entry.note = paid.message;
        save();
        if (paid.unsure) {
          throw fail(502, "We couldn't confirm the payment with Formbar. Check your Digipogs before trying again. If you were charged, an admin can give you a saved entry.");
        }
        throw fail(402, paid.message);
      }

      entry.status = 'paid';
      try {
        save();
      } catch (err) {
        console.error('could not save a paid entry:', entry, err.message);
      }

      try {
        commit();
        entry.status = 'done';
        result = { joined: true, price };
      } catch (err) {
        // the lobby changed while the payment went through. keep the entry for next time
        addCredit(user.id);
        entry.status = 'done';
        entry.note = `could not join (${err.message}), saved as an entry`;
        result = { joined: false, saved: true, price, message: `${err.isUser ? err.message : 'something went wrong'}. You were not charged for nothing: your entry is saved, so joining again is free.` };
      }
      try {
        save();
      } catch (err) {
        console.error('could not save a finished entry:', entry, err.message);
      }
    }

    recent.set(key, { result, time: Date.now() });
    return result;
  } finally {
    busy.delete(user.id);
  }
}

// ---- admin tools. the permission check happens in admin.js before any of these run

export function adminShop() {
  const sold = {};
  for (const e of state.log) if (e.status === 'done' && e.price > 0) sold[e.item] = (sold[e.item] || 0) + 1;

  const items = [];
  for (const [id, base] of defaults) {
    const item = itemNow(id);
    items.push({ id, kind: item.kind, label: item.label, name: item.name, text: item.text, defaultText: base.text, price: item.basePrice, defaultPrice: base.price, enabled: item.enabled, sold: sold[id] || 0 });
  }
  return { items, sale: state.sale };
}

export function setItem(id, changes) {
  if (!defaults.has(id)) throw fail(404, 'no such item');
  const base = defaults.get(id);
  const now = { ...(state.items[id] || {}) };

  if (changes.price !== undefined) {
    if (!Number.isInteger(changes.price) || changes.price < 1 || changes.price > MAX_PRICE) throw fail(400, `the price is 1 to ${MAX_PRICE} Digipogs`);
    now.price = changes.price;
  }
  if (changes.text !== undefined) {
    if (typeof changes.text !== 'string') throw fail(400, 'bad description');
    const text = changes.text.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 120);
    now.text = text;
  }
  if (changes.enabled !== undefined) {
    if (typeof changes.enabled !== 'boolean') throw fail(400, 'bad value');
    now.enabled = changes.enabled;
  }

  // only keep what differs from the defaults
  if (now.price === base.price) delete now.price;
  if (!now.text || now.text === base.text) delete now.text;
  if (now.enabled !== false) delete now.enabled;
  if (Object.keys(now).length === 0) delete state.items[id];
  else state.items[id] = now;

  save();
  return itemNow(id);
}

export function setSale(percent, label) {
  if (!Number.isInteger(percent) || percent < 0 || percent > 90) throw fail(400, 'a sale is 0 to 90 percent off');
  state.sale = { percent, label: percent === 0 ? '' : String(label || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 40) };
  save();
  return state.sale;
}

// an admin gives an item for free, or takes one back. both are in the log
export function gift(admin, target, itemId) {
  if (!defaults.has(itemId)) throw fail(404, 'no such item');
  const added = grantItem(target.id, itemId);
  if (added) {
    addLog({ userId: target.id, name: target.name, item: itemId, price: 0, status: 'gift', note: `given by ${admin.name}` });
    save();
  }
  return added;
}

export function takeBack(admin, target, itemId) {
  if (!defaults.has(itemId)) throw fail(404, 'no such item');
  const removed = revokeItem(target.id, itemId);
  if (removed) {
    addLog({ userId: target.id, name: target.name, item: itemId, price: 0, status: 'taken', note: `taken back by ${admin.name}` });
    save();
  }
  return removed;
}

// a payment we never heard back about: the admin checks Formbar, then either gives the item or dismisses it
export function resolveEntry(entryId, action, admin) {
  const entry = state.log.find((e) => e.id === entryId);
  if (!entry || entry.status !== 'unknown') throw fail(404, 'there is nothing to resolve there');

  if (action === 'grant') {
    handOver(entry.userId, entry.item);
    entry.status = 'done';
    entry.note = `confirmed by ${admin.name}`;
  } else if (action === 'dismiss') {
    entry.status = 'failed';
    entry.note = `dismissed by ${admin.name}`;
  } else {
    throw fail(400, 'bad action');
  }
  save();
  return entry;
}

export function transactions(limit = 200) {
  return state.log.slice(-limit).reverse();
}

export function shopStats() {
  let purchases = 0;
  let spent = 0;
  let unresolved = 0;
  for (const e of state.log) {
    if (e.status === 'done' && e.price > 0) {
      purchases++;
      spent += e.price;
    }
    if (e.status === 'unknown') unresolved++;
  }
  return { purchases, spent, unresolved, gifts: state.log.filter((e) => e.status === 'gift').length };
}
