import { config } from './config.js';
import { clients } from './hub.js';
import { getDiscount, getEntryPrice } from './leaderboard.js';
import { getBalance } from './formbar.js';
import { checkCreate, createLobby, checkJoin, joinLobby, checkPlay, startPlaying, inRunningMatch, fail } from './lobbies.js';
import { findInvite, finishInvite } from './invites.js';
import { payEntry, creditsOf, previousAnswer } from './shop.js';

// creating a lobby, joining one to play and moving from watching to playing all cost the entry fee.
// the player asks once without a pin to get a quote, then again with the pin once they confirmed
// every step checks that the entry can work first, so nobody is charged for a lobby that is full or a wrong password

// works out what this entry costs and what to do once it is paid. throws if it can't work
function plan(user, body) {
  const { action } = body;
  let free = false; // watching is free
  let commit;

  if ((action === 'create' || action === 'join') && inRunningMatch(user.id)) throw fail('finish your match first');

  if (action === 'join' && body.inviteId !== undefined) {
    // an invite stands in for the lobby code and password, nothing else changes: the fee, bans and room are still checked
    const inv = findInvite(user.id, body.inviteId);
    if (!inv) throw fail('that invite has expired');
    const { spectate } = checkJoin(user, { code: inv.code }, true);
    free = spectate;
    commit = () => {
      joinLobby(user, { code: inv.code }, true);
      finishInvite(inv.id);
    };
  } else if (action === 'create') {
    checkCreate(user, body.settings);
    commit = () => createLobby(user, body.settings);
  } else if (action === 'join') {
    const { spectate } = checkJoin(user, body);
    free = spectate;
    commit = () => joinLobby(user, body);
  } else if (action === 'play') {
    const { me } = checkPlay(user.id);
    free = !!me.paid;
    commit = () => startPlaying(user.id);
  } else {
    throw fail('bad request');
  }

  const price = user.id === config.ownerId || free ? 0 : getEntryPrice(user.id);
  return { price, commit };
}

export async function enter(user, body) {
  // the lobby is shown over the player's socket, so they have to be connected
  if (!clients.has(user.id)) throw fail('you are not connected to multiplayer, go back and try again');

  if (body.confirm === true) {
    const done = previousAnswer(user.id, body.requestId);
    if (done) return done;
  }

  const { price, commit } = plan(user, body);

  // no confirmation yet: free entries go straight through, paid ones return a quote for the confirm box
  if (body.confirm !== true) {
    if (price === 0) {
      commit();
      return { joined: true, price: 0 };
    }
    const saved = creditsOf(user.id) > 0; // a saved entry covers the fee
    return { quote: { price: saved ? 0 : price, full: config.multiplayerCost, discount: getDiscount(user.id), saved, balance: getBalance(user.id) } };
  }

  // confirmed. payEntry takes the money (if any) and then runs commit
  return payEntry(user, price, body.pin, body.requestId, body.expectedPrice, commit);
}
