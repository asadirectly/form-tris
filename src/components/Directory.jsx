import { useEffect, useState } from 'react';
import Logo from './Logo.jsx';
import { Avatar, Badges } from './PlayerLink.jsx';
import { titlesQuiet } from '../cosmetics.js';
import { searchProfiles } from '../api.js';

// popup: shown over a lobby, so a player can find someone to invite without leaving it
export default function Directory({ user, onBack, onProfile, popup }) {
  const [query, setQuery] = useState('');
  const [players, setPlayers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // wait a moment after typing so the server isn't asked on every key
  useEffect(() => {
    let current = true;
    setLoading(true);
    const id = setTimeout(() => {
      searchProfiles(query, 0)
        .then((data) => {
          if (!current) return;
          setPlayers(data.profiles);
          setTotal(data.total);
          setError('');
        })
        .catch((err) => current && setError(err.message))
        .finally(() => current && setLoading(false));
    }, 250);
    return () => {
      current = false;
      clearTimeout(id);
    };
  }, [query]);

  function loadMore() {
    searchProfiles(query, players.length)
      .then((data) => setPlayers((list) => [...list, ...data.profiles]))
      .catch((err) => setError(err.message));
  }

  const list = (
    <div className="box directory">
      <h3 className="box-title">
        {query ? `Results · ${total}` : `Everyone · ${total}`}
      </h3>
      <div className="form search">
        <input type="text" maxLength={40} placeholder="Search by name" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {!loading && players.length === 0 && <p className="fine">No players found.</p>}

      <ul>
        {players.map((p) => (
          <li key={p.id}>
            <button type="button" className="player-row" onClick={() => onProfile(p.id)}>
              <Avatar picture={p.picture} size={40} />
              <span className="player-name">{p.name}</span>
              <Badges ids={p.badges} quiet={titlesQuiet(p.picture)} />
              <span className="player-count">{p.achievements} ach.</span>
            </button>
          </li>
        ))}
      </ul>

      {players.length < total && (
        <button className="btn small ghost perks-btn" onClick={loadMore}>
          Show more
        </button>
      )}
    </div>
  );

  if (popup) {
    return (
      <div className="modal-back" onClick={onBack}>
        <div className="modal profile" onClick={(e) => e.stopPropagation()}>
          <div className="modal-head profile-bar">
            <span>Find players</span>
            <button type="button" className="btn small ghost" onClick={onBack}>
              Close
            </button>
          </div>
          <div className="modal-body">
            {error && <p className="error">{error}</p>}
            {list}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="menu">
      <header className="topbar">
        <Logo small />
        <div className="user">
          <span className="username">{user.name}</span>
          <button className="btn small ghost" onClick={onBack}>
            Back
          </button>
        </div>
      </header>

      <section className="play-col">
        <h2 className="heading">Players</h2>
        {error && <p className="error">{error}</p>}

        {list}
      </section>
    </div>
  );
}
