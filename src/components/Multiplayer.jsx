import { useEffect, useState } from 'react';
import { enterLobby } from '../api.js';
import EntryModal from './EntryModal.jsx';
import LobbyList from './LobbyList.jsx';
import Lobby from './Lobby.jsx';
import Versus from './Versus.jsx';
import Directory from './Directory.jsx';

// works out which multiplayer screen to show. the connection and the lobby we are in come from the app, so invites work everywhere
export default function Multiplayer({ user, socket, online, lobby, invite, onInviteDone, onBack, onUnlock, onProfile, onRefresh }) {
  const [game, setGame] = useState(null); // set when a match starts
  const [error, setError] = useState('');
  const [finding, setFinding] = useState(false); // the player search over the lobby, used to invite people
  const [entry, setEntry] = useState(null); // an entry waiting for the player to confirm the fee

  // creating, joining to play and starting to play all cost the entry fee. the server checks first, then we ask the player
  async function enter(body) {
    setError('');
    try {
      const answer = await enterLobby(body);
      if (answer.quote) setEntry({ body, action: body.action, quote: answer.quote });
    } catch (err) {
      setError(err.message);
    }
  }

  // runs after the player confirmed with their pin. a failure is shown in the box, nothing is lost
  async function pay(pin, requestId) {
    const answer = await enterLobby({ ...entry.body, confirm: true, pin, requestId, expectedPrice: entry.quote.price });
    setEntry(null);
    onRefresh(); // the balance changed
    if (!answer.joined) setError(answer.message);
  }

  useEffect(() => {
    if (!socket) return;
    const stops = [
      socket.on('lobby', (m) => {
        if (!m.lobby) setGame(null);
        if (m.notice) setError(m.notice);
      }),
      socket.on('start', (m) => setGame(m)),
      socket.on('error', (m) => setError(m.message)),
      socket.on('unlocked', (m) => onUnlock({ unlocked: m.ids, newRank: m.newRank })),
    ];
    return () => stops.forEach((stop) => stop());
  }, [socket]);

  // leaving this screen leaves the lobby
  useEffect(() => {
    return () => {
      if (socket) socket.send({ type: 'leave' });
    };
  }, [socket]);

  // an accepted invite opens the same fee box as joining by hand
  useEffect(() => {
    if (!invite || !socket || !online) return;
    onInviteDone();
    enter({ action: 'join', inviteId: invite });
  }, [invite, online]);

  // messages from the server go away by themselves
  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(''), 5000);
    return () => clearTimeout(id);
  }, [error]);

  if (!online || !socket) {
    return (
      <div className="center-col">
        <p className="loading">CONNECTING...</p>
        <button className="btn" onClick={onBack}>
          Back to menu
        </button>
      </div>
    );
  }

  const leave = () => socket.send({ type: 'leave' });

  let screen;
  if (game && lobby) screen = <Versus socket={socket} lobby={lobby} game={game} onDone={() => setGame(null)} onLeave={leave} onProfile={onProfile} />;
  else if (lobby) screen = <Lobby socket={socket} user={user} lobby={lobby} error={error} onProfile={onProfile} onEnter={enter} onFind={() => setFinding(true)} />;
  else screen = <LobbyList socket={socket} user={user} error={error} onBack={onBack} onEnter={enter} />;

  return (
    <>
      {screen}
      {finding && lobby && <Directory popup user={user} onBack={() => setFinding(false)} onProfile={onProfile} />}
      {entry && <EntryModal entry={entry} onPay={pay} onCancel={() => setEntry(null)} />}
    </>
  );
}
