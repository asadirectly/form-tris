// every connected player, by Formbar user id. the socket code adds to it, lobbies and matches send through it
export const clients = new Map();

export function sendTo(userId, message) {
  const client = clients.get(Number(userId));
  if (client && client.ws.readyState === 1) client.ws.send(JSON.stringify(message));
}

// same message to a lot of players, only turned into text once
export function sendMany(userIds, message) {
  const text = JSON.stringify(message);
  for (const id of userIds) {
    const client = clients.get(Number(id));
    if (client && client.ws.readyState === 1) client.ws.send(text);
  }
}
