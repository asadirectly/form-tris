import { useEffect, useState } from 'react';
import { getProfile, chooseRanks, equipPicture } from '../api.js';
import { ACHIEVEMENTS, RANKS } from '../game/achievements.js';
import { pictureFile } from '../game/pictures.js';
import { formatTime, formatPlaytime } from '../format.js';
import { Badges } from './PlayerLink.jsx';
import { TitlePicker, PicturePicker } from './Pickers.jsx';
import Fx from './Fx.jsx';
import { pictureEffect, titlesQuiet } from '../cosmetics.js';
import { titleColor, titleName } from '../titleColor.js';

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
export default function Profile({ id, user, lobby, onInvite, onChanged, onClose }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [inviteNote, setInviteNote] = useState(null); // { ok, message } after pressing Invite to Lobby
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    setProfile(null);
    setError('');
    setInviteNote(null);
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

  // titles are owner, admin, earned ranks and bought ranks. owner and admin don't use up the choices
  async function toggleTitle(titleId) {
    const shown = profile.mine.titles;
    const next = shown.includes(titleId) ? shown.filter((t) => t !== titleId) : [...shown, titleId];
    setError('');
    try {
      const saved = await chooseRanks(next);
      setProfile((p) => ({ ...p, badges: saved.badges, mine: { ...p.mine, titles: saved.badges } }));
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  // the server decides if the invite is allowed, we only show what it says
  async function invite() {
    setInviting(true);
    setInviteNote(await onInvite(profile.id));
    setInviting(false);
  }

  async function pickPicture(picture) {
    setError('');
    try {
      await equipPicture(picture);
      // an admin picture still wins over this, so ask again instead of guessing
      const fresh = await getProfile(id);
      setProfile(fresh);
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  let body = <p className="loading">LOADING...</p>;
  let topRank = null;
  let accent = null; // the first title a player shows sets their profile color

  if (error && !profile) {
    body = <p className="error">{error}</p>;
  } else if (profile) {
    const s = profile.stats;
    const isMe = profile.id === user.id;
    const count = profile.rank.count;
    topRank = RANKS.find((r) => r.id === profile.rank.top) || null;
    accent = profile.badges.length > 0 ? titleColor(profile.badges[0]) : null;
    const next = profile.rank.next ? RANKS.find((r) => r.id === profile.rank.next.id) : null;

    // the big title is the first one the player shows. if they show none, it falls back to their highest earned rank
    let heroName = topRank ? topRank.name : 'Unranked';
    let heroColor = topRank ? `var(--${topRank.color})` : 'var(--muted)';
    if (accent) {
      heroName = titleName(profile.badges[0]);
      heroColor = accent.c;
    }
    const gamesDecided = s.wins + s.losses;
    // only while we are in a lobby that has not started, and only the host can invite to a private one
    const canInvite = !!lobby && lobby.status === 'waiting' && (!lobby.isPrivate || String(lobby.hostId) === String(user.id));

    body = (
      <>
        <div className="profile-head">
          <Fx effect={pictureEffect(profile.picture)}>
            <img className="profile-pic" src={pictureFile(profile.picture)} alt="" style={{ '--c': accent ? accent.c : 'var(--line)' }} />
          </Fx>
          <div className="profile-who">
            <h2 className="profile-name">{profile.name}</h2>
            <div className="profile-badges">
              <Badges ids={profile.badges} quiet={titlesQuiet(profile.picture)} />
            </div>
            <p className="fine">Playing since {formatDate(profile.joined)}</p>
            {!isMe && canInvite && (
              <div className="invite-line">
                <button type="button" className="btn small" disabled={inviting} onClick={invite}>
                  Invite to Lobby
                </button>
                {inviteNote && <span className={inviteNote.ok ? 'fine' : 'error'}>{inviteNote.message}</span>}
              </div>
            )}
          </div>
        </div>

        <div className="profile-grid">
          <div className="box">
            <h3 className="box-title">Rank</h3>
            <p className="top-rank" style={{ '--c': heroColor }}>
              {heroName}
            </p>
            <p className="fine">
              {count} of {ACHIEVEMENTS.length} achievements
              {next ? ` · ${next.need - count} more for ${next.name}` : ' · top rank reached'}
            </p>

            {isMe && profile.mine && (
              <>
                <TitlePicker mine={profile.mine} onToggle={toggleTitle} />
                <PicturePicker mine={profile.mine} byAdmin={profile.pictureByAdmin} onPick={pickPicture} />
                <p className="fine">More pictures and ranks are in the Shop, and everything here is also in Settings.</p>
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
                <span>Block Blast score</span>
                <b>{profile.bests.blast ? `${profile.bests.blast.value.toLocaleString()} · #${profile.bests.blast.rank}` : '--'}</b>
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
            <Cell label="Wins vs players" value={s.realWins.toLocaleString()} />
            <Cell label="Royale KOs" value={s.realKos.toLocaleString()} />
          </div>
          <p className="fine">Wins and losses are 40L races and multiplayer matches. Normal rounds just end when you top out. Wins vs players and Royale KOs are the ones on the leaderboards, they need another real player in the match.</p>
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
      <div className="modal profile" style={accent ? { '--c': accent.c, '--c-dk': accent.dk } : undefined} onClick={(e) => e.stopPropagation()}>
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
