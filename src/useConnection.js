import { useEffect, useRef, useState } from 'react';
import { openSocket } from './net.js';

// the game connection lives for as long as the player is logged in, so invites reach them on any screen.
// it reconnects by itself, unless the player opened the game in another tab (close code 4000)
export function useConnection(user, onReplied) {
  const [socket, setSocket] = useState(null);
  const [online, setOnline] = useState(false);
  const [lobby, setLobby] = useState(null); // the lobby the player is in, null when they are not in one
  const [invites, setInvites] = useState([]);
  const [replacedByTab, setReplacedByTab] = useState(false);
  const replied = useRef(onReplied);
  replied.current = onReplied;
  const userId = user ? user.id : null;

  useEffect(() => {
    if (!userId) return;
    let stopped = false;
    let timer = null;
    let current = null;
    let stops = [];

    function connect() {
      const s = openSocket();
      current = s;
      stops = [
        s.on('open', () => {
          setOnline(true);
          setSocket(s);
        }),
        s.on('close', (m) => {
          setOnline(false);
          setLobby(null);
          setInvites([]);
          if (m.code === 4000) setReplacedByTab(true);
          else if (!stopped) timer = setTimeout(connect, 3000);
        }),
        s.on('lobby', (m) => setLobby(m.lobby)),
        s.on('invite', (m) => setInvites((list) => [...list.filter((i) => i.id !== m.invite.id), m.invite])),
        s.on('inviteReply', (m) => replied.current(m)),
      ];
    }

    connect();
    return () => {
      stopped = true;
      clearTimeout(timer);
      stops.forEach((stop) => stop());
      current.close();
      setSocket(null);
      setOnline(false);
      setLobby(null);
      setInvites([]);
    };
  }, [userId]);

  function dropInvite(id) {
    setInvites((list) => list.filter((i) => i.id !== id));
  }

  // invites someone and waits for the server to say how it went. resolves to { ok, message }
  function invitePlayer(id) {
    return new Promise((resolve) => {
      if (!socket || !online) return resolve({ ok: false, message: 'not connected right now' });
      const stop = socket.on('inviteResult', (m) => {
        if (m.to !== Number(id)) return;
        stop();
        clearTimeout(timer);
        resolve({ ok: m.ok, message: m.message });
      });
      const timer = setTimeout(() => {
        stop();
        resolve({ ok: false, message: 'no answer from the server' });
      }, 5000);
      socket.send({ type: 'invite', to: id });
    });
  }

  return { socket, online, lobby, invites, dropInvite, invitePlayer, replacedByTab };
}
