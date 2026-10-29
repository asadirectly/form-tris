import { useEffect, useState } from 'react';
import { openSocket } from '../net.js';
import LobbyList from './LobbyList.jsx';
import Lobby from './Lobby.jsx';
import Versus from './Versus.jsx';

// owns the connection and works out which multiplayer screen to show from what the server says
export default function Multiplayer({ user, onBack }) {
  const [socket, setSocket] = useState(null);
  const [status, setStatus] = useState('connecting'); // connecting, open or closed
  const [lobby, setLobby] = useState(null); // the lobby we're in, null while browsing
  const [game, setGame] = useState(null); // set when a match starts
  const [error, setError] = useState('');

  useEffect(() => {
    const s = openSocket();
    const stops = [
      s.on('open', () => setStatus('open')),
      s.on('close', () => setStatus('closed')),
      s.on('lobby', (m) => {
        setLobby(m.lobby);
        if (!m.lobby) setGame(null);
        if (m.notice) setError(m.notice);
      }),
      s.on('start', (m) => setGame(m)),
      s.on('error', (m) => setError(m.message)),
    ];
    setSocket(s);
    return () => {
      stops.forEach((stop) => stop());
      s.close();
    };
  }, []);

  // messages from the server go away by themselves
  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(''), 5000);
    return () => clearTimeout(id);
  }, [error]);

  if (status !== 'open') {
    return (
      <div className="center-col">
        <p className="loading">{status === 'connecting' ? 'CONNECTING...' : 'DISCONNECTED'}</p>
        {status === 'closed' && (
          <button className="btn" onClick={onBack}>
            Back to menu
          </button>
        )}
      </div>
    );
  }

  const leave = () => socket.send({ type: 'leave' });

  if (game && lobby) return <Versus socket={socket} lobby={lobby} game={game} onDone={() => setGame(null)} onLeave={leave} />;
  if (lobby) return <Lobby socket={socket} user={user} lobby={lobby} error={error} />;
  return <LobbyList socket={socket} user={user} error={error} onBack={onBack} />;
}
