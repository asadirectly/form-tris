import { useEffect, useState } from 'react';
import Logo from './Logo.jsx';
import { MODES } from '../game/constants.js';
import { getLeaderboards } from '../api.js';
import { formatTime } from '../format.js';
import PlayerLink, { Badges } from './PlayerLink.jsx';

const labels = { normal: 'Score', sprint: 'Time' };

function showValue(mode, value) {
  return mode === 'sprint' ? formatTime(value) : value.toLocaleString();
}

export default function Leaderboard({ user, onBack, onProfile }) {
  const [boards, setBoards] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getLeaderboards()
      .then(setBoards)
      .catch((err) => setError(err.message));
  }, []);

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

      <section className="boards">
        <h2 className="heading">Leaderboards</h2>
        {error && <p className="error">{error}</p>}
        {!boards && !error && <p className="fine">LOADING...</p>}

        {boards && (
          <div className="boards-grid">
            {Object.keys(MODES).map((mode, i) => (
              <div key={mode} className={`box board ${mode}`} style={{ '--i': i }}>
                <h3 className="box-title">
                  {MODES[mode].name} · {labels[mode]}
                </h3>

                {boards[mode].entries.length === 0 && <p className="fine">No scores yet.</p>}

                <ul>
                  {boards[mode].entries.map((entry) => (
                    <li key={entry.userId} className={entry.userId === user.id ? 'rank-row me' : 'rank-row'}>
                      <span className="rank-pos">{entry.rank}</span>
                      <PlayerLink id={entry.userId} name={entry.name} onProfile={onProfile} className="rank-name" />
                      <Badges ids={entry.badges} />
                      {entry.discount > 0 && <span className="tag">{entry.discount}% off</span>}
                      <span className="rank-value">{showValue(mode, entry.value)}</span>
                    </li>
                  ))}

                  {boards[mode].you && (
                    <li className="rank-row me">
                      <span className="rank-pos">{boards[mode].you.rank}</span>
                      <PlayerLink id={user.id} name={user.name} onProfile={onProfile} className="rank-name" />
                      <span className="rank-value">{showValue(mode, boards[mode].you.value)}</span>
                    </li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
