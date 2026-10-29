import { WebSocketServer } from 'ws';
import { config } from './config.js';
import { isExpired } from './formbar.js';
import { clients, sendTo } from './hub.js';
import {
  createLobby, joinLobby, leaveLobby, resume, setReady, setRole, updateSettings, addBot, setBotLevel,
  removeBot, kick, giveHost, startLobbyMatch, gameMessage, listPublic, lobbyOf,
} from './lobbies.js';

const isProd = process.env.NODE_ENV === 'production';

// what a player can ask for, each one checks who is asking and whether it's allowed
const handlers = {
  list: (c) => sendTo(c.user.id, { type: 'lobbies', lobbies: listPublic() }),
  create: (c, m) => createLobby(c.user, m),
  join: (c, m) => joinLobby(c.user, m),
  leave: (c) => {
    leaveLobby(c.user.id);
    sendTo(c.user.id, { type: 'lobby', lobby: null });
  },
  ready: (c, m) => setReady(c.user.id, m.ready === true),
  role: (c, m) => setRole(c.user.id, m.role),
  settings: (c, m) => updateSettings(c.user.id, m),
  addBot: (c, m) => addBot(c.user.id, m.level),
  setBot: (c, m) => setBotLevel(c.user.id, m.id, m.level),
  removeBot: (c, m) => removeBot(c.user.id, m.id),
  kick: (c, m) => kick(c.user.id, m.id),
  host: (c, m) => giveHost(c.user.id, m.id),
  start: (c) => startLobbyMatch(c.user.id),
  attack: (c, m) => gameMessage(c.user.id, m),
  board: (c, m) => gameMessage(c.user.id, m),
  dead: (c, m) => gameMessage(c.user.id, m),
  target: (c, m) => gameMessage(c.user.id, m),
  watch: (c, m) => gameMessage(c.user.id, m),
};

// the browser's origin has to be this site, so other sites can't open sockets with a player's cookie
function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    return origin === config.appUrl || new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function reject(socket, code, text) {
  socket.write(`HTTP/1.1 ${code} ${text}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

function handle(client, text) {
  // a short burst is fine, a flood is not
  const now = Date.now();
  client.tokens = Math.min(60, client.tokens + ((now - client.lastToken) / 1000) * 40);
  client.lastToken = now;
  if (client.tokens < 1) {
    if (++client.dropped > 300) client.ws.close(1008, 'too many messages');
    return;
  }
  client.tokens--;

  let msg;
  try {
    msg = JSON.parse(text);
  } catch {
    return;
  }
  if (!msg || typeof msg.type !== 'string' || !Object.hasOwn(handlers, msg.type)) return;

  try {
    handlers[msg.type](client, msg);
  } catch (err) {
    if (err.isUser) sendTo(client.user.id, { type: 'error', message: err.message });
    else console.error('socket handler failed:', err);
  }
}

function connect(ws, user) {
  // one connection per player, a new tab takes over from the old one
  const old = clients.get(user.id);
  const client = { ws, user, alive: true, tokens: 60, lastToken: Date.now(), dropped: 0 };
  clients.set(user.id, client);
  if (old) old.ws.close(4000, 'opened somewhere else');

  ws.on('message', (data, isBinary) => {
    if (!isBinary) handle(client, data.toString());
  });
  ws.on('pong', () => (client.alive = true));
  ws.on('error', () => {});
  ws.on('close', () => {
    // only the current connection counts, an old tab closing must not drop the lobby spot
    if (clients.get(user.id) !== client) return;
    clients.delete(user.id);
    leaveLobby(user.id);
  });

  sendTo(user.id, { type: 'hello', id: String(user.id) });
  resume(user.id);
  const lobby = lobbyOf(user.id);
  if (lobby) sendTo(user.id, { type: 'lobby', lobby });
}

export function attachSockets(server, sessionMiddleware) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 2048 });

  server.on('upgrade', (req, socket, head) => {
    if (new URL(req.url, 'http://localhost').pathname !== '/ws') return reject(socket, 404, 'Not Found');
    if (!originAllowed(req)) return reject(socket, 403, 'Forbidden');

    // the session middleware only knows normal requests, so tell it whether this one came in over https
    req.secure = isProd && req.headers['x-forwarded-proto'] === 'https';
    sessionMiddleware(req, {}, () => {
      const session = req.session;
      if (!session || !session.user || isExpired(session.tokenExp)) return reject(socket, 401, 'Unauthorized');
      wss.handleUpgrade(req, socket, head, (ws) => connect(ws, session.user));
    });
  });

  // players that went quiet without closing get dropped
  setInterval(() => {
    for (const client of clients.values()) {
      if (!client.alive) {
        client.ws.terminate();
        continue;
      }
      client.alive = false;
      client.ws.ping();
    }
  }, 30000).unref();
}
