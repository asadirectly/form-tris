import { useEffect, useState } from 'react';
import Logo from './Logo.jsx';
import PlayerLink, { Badges } from './PlayerLink.jsx';
import AdminPlayers from './AdminPlayers.jsx';
import AdminLobbies from './AdminLobbies.jsx';
import AdminShop from './AdminShop.jsx';
import AdminLogs from './AdminLogs.jsx';
import { admin } from '../api.js';

const tabs = ['Overview', 'Players', 'Lobbies', 'Shop', 'Logs'];

// harmless and easy to clear, for when the site needs a little life
const presets = ['Free hugs at the leaderboard.', 'Remember to stretch your thumbs.', 'Maintenance soon. Please finish your round.', 'Sale in the shop, go spend those Digipogs.'];

function Overview() {
  const [stats, setStats] = useState(null);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function load() {
    admin('GET', '/stats')
      .then(setStats)
      .catch((err) => setError(err.message));
  }
  useEffect(load, []);

  async function run(method, body) {
    setError('');
    setMessage('');
    try {
      await admin(method, '/announcement', body);
      setMessage(method === 'DELETE' ? 'Announcement cleared.' : 'Announcement is live.');
      if (method === 'POST') setText('');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!stats) return error ? <p className="error">{error}</p> : <p className="loading">LOADING...</p>;

  return (
    <>
      <div className="box">
        <h3 className="box-title">Site</h3>
        <div className="cells">
          <div className="cell"><span className="cell-label">Registered players</span><span className="cell-value">{stats.site.players}</span></div>
          <div className="cell"><span className="cell-label">Rounds played</span><span className="cell-value">{stats.site.rounds}</span></div>
          <div className="cell"><span className="cell-label">Matches</span><span className="cell-value">{stats.site.matches}</span></div>
          <div className="cell"><span className="cell-label">Online now</span><span className="cell-value">{stats.online}</span></div>
          <div className="cell"><span className="cell-label">Open lobbies</span><span className="cell-value">{stats.lobbies}</span></div>
          <div className="cell"><span className="cell-label">Banned</span><span className="cell-value">{stats.site.banned}</span></div>
          <div className="cell"><span className="cell-label">Shop purchases</span><span className="cell-value">{stats.shop.purchases}</span></div>
          <div className="cell"><span className="cell-label">Digipogs spent</span><span className="cell-value">{stats.shop.spent.toLocaleString()}</span></div>
          <div className="cell"><span className="cell-label">Gifts given</span><span className="cell-value">{stats.shop.gifts}</span></div>
          <div className="cell"><span className="cell-label">Payments to check</span><span className="cell-value">{stats.shop.unresolved}</span></div>
        </div>
      </div>

      <div className="box form">
        <h3 className="box-title">Announcement</h3>
        {stats.announcement && <p className="fine">Live now: "{stats.announcement.text}" (by {stats.announcement.by})</p>}
        <input type="text" maxLength={140} placeholder="Message for everyone" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="chips">
          {presets.map((p) => (
            <button key={p} type="button" className="chip pick" onClick={() => setText(p)}>
              {p}
            </button>
          ))}
        </div>
        <div className="admin-row">
          <button className="btn small" disabled={!text.trim()} onClick={() => run('POST', { text })}>
            Send
          </button>
          {stats.announcement && (
            <button className="btn small ghost" onClick={() => run('DELETE')}>
              Clear
            </button>
          )}
        </div>
        {message && <p className="fine">{message}</p>}
        {error && <p className="error">{error}</p>}
      </div>

      <div className="box">
        <h3 className="box-title">Achievements, players who earned each</h3>
        <ul className="perks">
          {stats.achievements.map((a) => (
            <li key={a.id}>
              <span>
                {a.name} <small>({a.mode})</small>
              </span>
              <b>{a.earned}</b>
            </li>
          ))}
        </ul>
        <p className="fine">Give or take achievements from a player on the Players tab.</p>
      </div>
    </>
  );
}

export default function Admin({ user, onBack, onProfile }) {
  const [tab, setTab] = useState('Overview');

  return (
    <div className="menu admin">
      <header className="topbar">
        <Logo small />
        <div className="user">
          <Badges ids={user.badges} />
          <PlayerLink id={user.id} name={user.name} onProfile={onProfile} className="username" />
          <button className="btn small ghost" onClick={onBack}>
            Back
          </button>
        </div>
      </header>

      <section className="admin-page">
        <h2 className="heading">Admin panel</h2>
        <div className="tabs">
          {tabs.map((t) => (
            <button key={t} type="button" className={t === tab ? 'tab on' : 'tab'} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>
        {tab === 'Overview' && <Overview />}
        {tab === 'Players' && <AdminPlayers onProfile={onProfile} />}
        {tab === 'Lobbies' && <AdminLobbies />}
        {tab === 'Shop' && <AdminShop />}
        {tab === 'Logs' && <AdminLogs />}
      </section>
    </div>
  );
}
