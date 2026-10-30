import { useEffect, useState } from 'react';
import { getProfile, chooseRanks } from '../api.js';
import { ACHIEVEMENTS, RANKS, MAX_SHOWN_RANKS } from '../game/achievements.js';
import { pictureFile } from '../game/pictures.js';
import { formatTime, formatPlaytime } from '../format.js';
import { Badges } from './PlayerLink.jsx';

function formatDate(time) {
  return new Date(time).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function Cell({ label, value }) {
  return (
    <div className="cell">
      <span className="cell-label">{label}</span>
      <span className="cell-value">{value}</span>
    </div>
  );
}

// a profile opens on top of whatever screen the player is on, so a lobby or a leaderboard is never left
export default function Profile({ id, user, onChanged, onClose }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setProfile(null);
    setError('');
    getProfile(id)
      .then(setProfile)
      .catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    function onKey(e) {
      if (e.code === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function toggleRank(rankId) {
    const shown = profile.rank.shown;
    const next = shown.includes(rankId) ? shown.filter((r) => r !== rankId) : [...shown, rankId];
    setError('');
    try {
      const saved = await chooseRanks(next);
      setProfile((p) => ({ ...p, badges: saved.badges, rank: { ...p.rank, shown: next } }));
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  let body = <p className="loading">LOADING...</p>;
  let topRank = null;

  if (error && !profile) {
    body = <p className="error">{error}</p>;
  } else if (profile) {
    const s = profile.stats;
    const isMe = profile.id === user.id;
    const count = profile.rank.count;
    topRank = RANKS.find((r) => r.id === profile.rank.top) || null;
    const next = profile.rank.next ? RANKS.find((r) => r.id === profile.rank.next.id) : null;
    const gamesDecided = s.wins + s.losses;

    body = (
      <>
        <div className="profile-head">
          <img className="profile-pic" src={pictureFile(profile.picture)} alt="" style={{ '--c': topRank ? `var(--${topRank.color})` : 'var(--line)' }} />
          <div className="profile-who">
            <h2 className="profile-name">{profile.name}</h2>
            <div className="profile-badges">
              <Badges ids={profile.badges} />
            </div>
            <p className="fine">Playing since {formatDate(profile.joined)}</p>
          </div>
        </div>

        <div className="profile-grid">
          <div className="box">
            <h3 className="box-title">Rank</h3>
            <p className="top-rank" style={{ '--c': topRank ? `var(--${topRank.color})` : 'var(--muted)' }}>
              {topRank ? topRank.name : 'Unranked'}
            </p>
            <p className="fine">
              {count} of {ACHIEVEMENTS.length} achievements
              {next ? ` · ${next.need - count} more for ${next.name}` : ' · top rank reached'}
            </p>

            {isMe && profile.rank.earned.length > 0 && (
              <>
                <p className="fine pick-label">Ranks you show (up to {MAX_SHOWN_RANKS}), Owner and Admin always show</p>
                <div className="chips aim">
                  {profile.rank.earned.map((rankId) => {
                    const rank = RANKS.find((r) => r.id === rankId);
                    const on = profile.rank.shown.includes(rankId);
                    return (
                      <button
                        key={rankId}
                        type="button"
                        className={on ? 'chip pick on' : 'chip pick'}
                        disabled={!on && profile.rank.shown.length >= MAX_SHOWN_RANKS}
                        onClick={() => toggleRank(rankId)}
                      >
                        {rank.name}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            {error && <p className="error">{error}</p>}
          </div>

          <div className="box bests">
            <h3 className="box-title">Personal bests</h3>
            <ul className="perks">
              <li>
                <span>Normal score</span>
                <b>{profile.bests.normal ? `${profile.bests.normal.value.toLocaleString()} · #${profile.bests.normal.rank}` : '--'}</b>
              </li>
              <li>
                <span>40L time</span>
                <b>{profile.bests.sprint ? `${formatTime(profile.bests.sprint.value)} · #${profile.bests.sprint.rank}` : '--'}</b>
              </li>
              <li>
                <span>Most KOs in a match</span>
                <b>{s.mostKos || '--'}</b>
              </li>
              <li>
                <span>Most garbage sent</span>
                <b>{s.mostSent || '--'}</b>
              </li>
              <li>
                <span>Biggest match won</span>
                <b>{s.biggestWin ? `${s.biggestWin} players` : '--'}</b>
              </li>
            </ul>
          </div>
        </div>

        <div className="box stats-box">
          <h3 className="box-title">Statistics</h3>
          <div className="cells">
            <Cell label="Rounds played" value={s.rounds.toLocaleString()} />
            <Cell label="Wins" value={s.wins.toLocaleString()} />
            <Cell label="Losses" value={s.losses.toLocaleString()} />
            <Cell label="Win rate" value={gamesDecided > 0 ? `${Math.round((s.wins / gamesDecided) * 100)}%` : '--'} />
            <Cell label="Playtime" value={formatPlaytime(s.playMs)} />
            <Cell label="Lines (solo)" value={s.lines.toLocaleString()} />
            <Cell label="T-spins" value={s.tspins.toLocaleString()} />
            <Cell label="Tetrises" value={s.tetrises.toLocaleString()} />
            <Cell label="Perfect clears" value={s.perfects.toLocaleString()} />
            <Cell label="Best combo" value={`x${s.maxCombo}`} />
            <Cell label="Matches" value={s.matches.toLocaleString()} />
            <Cell label="Match wins" value={s.matchWins.toLocaleString()} />
            <Cell label="KOs" value={s.kos.toLocaleString()} />
          </div>
          <p className="fine">Wins and losses are 40L races and multiplayer matches. Normal rounds just end when you top out.</p>
        </div>

        <div className="box">
          <h3 className="box-title">
            Achievements {count}/{ACHIEVEMENTS.length}
          </h3>
          <ul className="gallery">
            {ACHIEVEMENTS.map((a) => {
              const earned = profile.achievements[a.id];
              return (
                <li key={a.id} className={earned ? 'ach got' : 'ach'} style={{ '--c': `var(--${a.color})` }}>
                  <span className="ach-icon">{earned ? a.icon : '?'}</span>
                  <span className="ach-text">
                    <b>{a.name}</b>
                    <span>{a.text}</span>
                    <small>{earned ? `Earned ${formatDate(earned)}` : 'Locked'}</small>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </>
    );
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal profile" style={topRank ? { '--c': `var(--${topRank.color})`, '--c-dk': `var(--${topRank.color}-dk)` } : undefined} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head profile-bar">
          <span>Player profile</span>
          <button type="button" className="btn small ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">{body}</div>
      </div>
    </div>
  );
}
