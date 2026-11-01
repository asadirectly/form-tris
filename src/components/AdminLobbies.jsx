import { useEffect, useState } from 'react';
import ConfirmButton from './ConfirmButton.jsx';
import { admin } from '../api.js';

export default function AdminLobbies() {
  const [lobbies, setLobbies] = useState(null);
  const [error, setError] = useState('');

  function load() {
    admin('GET', '/lobbies')
      .then((data) => {
        setLobbies(data.lobbies);
        setError('');
      })
      .catch((err) => setError(err.message));
  }

  // lobbies come and go, so the list refreshes by itself
  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  async function close(code) {
    try {
      await admin('POST', `/lobbies/${code}/close`);
      load();
    } catch (err) {
      setError(err.message);
      load();
    }
  }

  return (
    <div className="box">
      <h3 className="box-title">Open lobbies</h3>
      {error && <p className="error">{error}</p>}
      {lobbies && lobbies.length === 0 && <p className="fine">No lobbies right now.</p>}
      <ul className="admin-list">
        {(lobbies || []).map((l) => (
          <li key={l.id}>
            <div>
              <b>{l.name}</b> <small>{l.id} · {l.kind} · {l.status} · {l.isPrivate ? 'private' : 'public'}</small>
              <div className="fine">
                Host {l.host || '--'} · {l.members.filter((m) => m.role === 'player').length}/{l.max} players ·{' '}
                {l.members.map((m) => (m.bot ? 'CPU' : m.name)).join(', ')}
              </div>
            </div>
            <ConfirmButton ask="Close it?" onConfirm={() => close(l.id)}>
              Close
            </ConfirmButton>
          </li>
        ))}
      </ul>
      <p className="fine">Closing a lobby sends everyone back to the lobby list. Players who paid to get in are given a saved entry, so their next entry is free.</p>
    </div>
  );
}
