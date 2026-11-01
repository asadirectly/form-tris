import { useEffect, useState } from 'react';
import ConfirmButton from './ConfirmButton.jsx';
import { Avatar, Badges } from './PlayerLink.jsx';
import { admin } from '../api.js';
import { ACHIEVEMENTS } from '../game/achievements.js';
import { PICTURES, pictureFile } from '../game/pictures.js';
import { allItems } from '../game/shop.js';

const items = allItems();

function Detail({ id, onProfile, onChanged }) {
  const [p, setP] = useState(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [hours, setHours] = useState('24');
  const [reason, setReason] = useState('');

  function load() {
    admin('GET', `/players/${id}`)
      .then(setP)
      .catch((err) => setError(err.message));
  }
  useEffect(() => {
    setP(null);
    setError('');
    setNote('');
    load();
  }, [id]);

  // every action goes through here: send it, show what happened, reload
  async function act(path, body, done) {
    setError('');
    setNote('');
    try {
      const data = await admin('POST', `/players/${id}${path}`, body);
      if (done) setNote(typeof done === 'function' ? done(data) : done);
      load();
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  // an upload is read in the browser and sent as base64, the server checks it is a real picture
  function upload(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 256 * 1024) return setError('pictures can be up to 256 KB');
    const reader = new FileReader();
    reader.onload = () => act('/picture', { upload: String(reader.result).split(',')[1] }, 'Picture set.');
    reader.readAsDataURL(file);
  }

  if (!p) return error ? <p className="error">{error}</p> : <p className="loading">LOADING...</p>;

  const isAdminPlayer = p.badges.includes('owner') || p.badges.includes('admin');

  return (
    <div className="admin-detail">
      <div className="profile-head">
        <img className="profile-pic" src={pictureFile(p.picture)} alt="" />
        <div className="profile-who">
          <h3 className="profile-name">{p.name}</h3>
          <div className="profile-badges">
            <Badges ids={p.badges} />
          </div>
          <p className="fine">
            Formbar id {p.id} · {p.stats.rounds} rounds · {p.entries} saved entries · {p.owned.length} items
          </p>
          <button className="btn small ghost" onClick={() => onProfile(p.id)}>
            Open profile
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {note && <p className="fine">{note}</p>}

      <div className="box">
        <h4 className="box-title">Moderation</h4>
        {p.ban && (
          <p className="error">
            Banned {p.ban.until ? `until ${new Date(p.ban.until).toLocaleString()}` : 'forever'}
            {p.ban.reason ? ` (${p.ban.reason})` : ''} by {p.ban.by}
          </p>
        )}
        <div className="admin-row">
          <label>
            Hours (0 is forever)
            <input type="number" min={0} max={8760} value={hours} onChange={(e) => setHours(e.target.value)} />
          </label>
          <label>
            Reason
            <input type="text" maxLength={80} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
        </div>
        <div className="admin-row">
          <ConfirmButton ask="Ban them?" disabled={isAdminPlayer} onConfirm={() => act('/ban', { hours: Number(hours), reason }, 'Banned from multiplayer.')}>
            Ban from multiplayer
          </ConfirmButton>
          {p.ban && (
            <ConfirmButton ask="Unban?" onConfirm={() => act('/unban', {}, 'Unbanned.')}>
              Unban
            </ConfirmButton>
          )}
          <ConfirmButton ask="Kick them?" disabled={isAdminPlayer} onConfirm={() => act('/kick', {}, (d) => (d.kicked ? 'Removed from their lobby.' : 'They were not in a lobby.'))}>
            Kick from lobby
          </ConfirmButton>
          <ConfirmButton ask="Remove score?" disabled={isAdminPlayer} onConfirm={() => act('/scores/remove', { mode: 'normal' }, (d) => (d.removed ? 'Normal score removed.' : 'They had no normal score.'))}>
            Remove normal score
          </ConfirmButton>
          <ConfirmButton ask="Remove time?" disabled={isAdminPlayer} onConfirm={() => act('/scores/remove', { mode: 'sprint' }, (d) => (d.removed ? '40L time removed.' : 'They had no 40L time.'))}>
            Remove 40L time
          </ConfirmButton>
        </div>
        <p className="fine">Bans only block multiplayer. Admins can not be banned, kicked or have scores removed.</p>
      </div>

      <div className="box">
        <h4 className="box-title">Profile picture</h4>
        <p className="fine">
          {p.override ? `Set by ${p.override.by}, it stays until you reset it.` : 'Their own choice is showing.'} Anything you set here is easy to undo.
        </p>
        <div className="chips">
          {Object.keys(PICTURES).map((key) => (
            <button key={key} type="button" className={p.override && p.override.value === key ? 'pic-pick on' : 'pic-pick'} title={PICTURES[key].name} onClick={() => act('/picture', { picture: key }, 'Picture set.')}>
              <img src={pictureFile(key)} alt={PICTURES[key].name} />
            </button>
          ))}
        </div>
        <div className="admin-row">
          <label className="btn small ghost file-btn">
            Upload picture
            <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={upload} />
          </label>
          {p.override && (
            <button className="btn small ghost" onClick={() => act('/picture', { reset: true }, 'Picture reset.')}>
              Reset
            </button>
          )}
        </div>
        <p className="fine">png, jpg, gif or webp, up to 256 KB.</p>
      </div>

      <div className="box">
        <h4 className="box-title">Shop items</h4>
        <ul className="admin-list">
          {items.map((item) => {
            const has = p.owned.includes(item.id);
            return (
              <li key={item.id}>
                <span>
                  {item.name} <small>{item.label}</small>
                </span>
                {has ? (
                  <ConfirmButton ask="Take it back?" onConfirm={() => act('/items', { item: item.id, give: false }, 'Item taken back.')}>
                    Take back
                  </ConfirmButton>
                ) : (
                  <button className="btn small ghost" onClick={() => act('/items', { item: item.id, give: true }, 'Item given.')}>
                    Give
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <div className="admin-row">
          <button className="btn small ghost" onClick={() => act('/entry', {}, 'Saved entry given.')}>
            Give a saved entry
          </button>
        </div>
        <p className="fine">Gifts are free and show up in the transaction log. This never touches anyone's Digipogs on Formbar.</p>
      </div>

      <div className="box">
        <h4 className="box-title">Achievements</h4>
        <ul className="admin-list">
          {ACHIEVEMENTS.map((a) => {
            const has = !!p.achievements[a.id];
            return (
              <li key={a.id}>
                <span>
                  {a.name} <small>{has ? 'earned' : 'locked'}</small>
                </span>
                {has ? (
                  <ConfirmButton ask="Take away?" onConfirm={() => act('/achievements', { id: a.id, give: false }, 'Achievement removed.')}>
                    Take
                  </ConfirmButton>
                ) : (
                  <button className="btn small ghost" onClick={() => act('/achievements', { id: a.id, give: true }, 'Achievement given.')}>
                    Give
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="box">
        <h4 className="box-title">Recent purchases</h4>
        <ul className="admin-list log">
          {p.purchases.map((t) => (
            <li key={t.id}>
              <span>
                <span className={`status ${t.status}`}>{t.status}</span> {t.item} · {t.price} DP
              </span>
              <small>{new Date(t.at).toLocaleDateString()}</small>
            </li>
          ))}
          {p.purchases.length === 0 && <li className="fine">Nothing bought yet.</li>}
        </ul>
      </div>
    </div>
  );
}

export default function AdminPlayers({ onProfile }) {
  const [query, setQuery] = useState('');
  const [players, setPlayers] = useState([]);
  const [total, setTotal] = useState(0);
  const [picked, setPicked] = useState(null);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0); // bumps to search again after a change

  useEffect(() => {
    let current = true;
    const id = setTimeout(() => {
      admin('GET', `/players?q=${encodeURIComponent(query)}&offset=0`)
        .then((data) => {
          if (!current) return;
          setPlayers(data.profiles);
          setTotal(data.total);
          setError('');
        })
        .catch((err) => current && setError(err.message));
    }, 250);
    return () => {
      current = false;
      clearTimeout(id);
    };
  }, [query, tick]);

  return (
    <div className="admin-players">
      <div className="box">
        <h3 className="box-title">Find a player</h3>
        <input type="text" placeholder="Search by name" maxLength={40} value={query} onChange={(e) => setQuery(e.target.value)} />
        {error && <p className="error">{error}</p>}
        <ul className="admin-list pick-list">
          {players.map((p) => (
            <li key={p.id} className={picked === p.id ? 'on' : ''}>
              <button type="button" className="row-btn" onClick={() => setPicked(p.id)}>
                <Avatar picture={p.picture} size={28} />
                <span>{p.name}</span>
                <Badges ids={p.badges} />
                {p.banned && <span className="status failed">banned</span>}
              </button>
            </li>
          ))}
        </ul>
        <p className="fine">{total} players{total > players.length ? `, showing ${players.length}. Search to narrow it down.` : ''}</p>
      </div>
      {picked && <Detail id={picked} onProfile={onProfile} onChanged={() => setTick((t) => t + 1)} />}
    </div>
  );
}
