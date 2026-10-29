// the multiplayer connection. everything is json with a "type", the server decides who may do what
export function openSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${protocol}://${window.location.host}/ws`);
  const listeners = {}; // type -> list of functions

  function emit(type, message) {
    for (const fn of listeners[type] || []) fn(message);
  }

  ws.onopen = () => emit('open', {});
  ws.onclose = () => emit('close', {});
  ws.onmessage = (e) => {
    try {
      const message = JSON.parse(e.data);
      emit(message.type, message);
    } catch {
      // not ours, ignore it
    }
  };

  return {
    send(message) {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
    },
    // returns a function that stops listening
    on(type, fn) {
      listeners[type] = [...(listeners[type] || []), fn];
      return () => {
        listeners[type] = listeners[type].filter((f) => f !== fn);
      };
    },
    close() {
      ws.close();
    },
  };
}
