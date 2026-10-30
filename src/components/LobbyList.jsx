import { useEffect, useState } from 'react';
import Logo from './Logo.jsx';
import { LOBBY_KINDS, MIN_PLAYERS } from '../game/constants.js';

export default function LobbyList({ socket, user, error, onBack }) {
  const [lobbies, setLobbies] = useState([]);
  const [form, setForm] = useState({ name: '', kind: 'standard', max: 8, isPrivate: false, password: '' });
  const [code, setCode] = useState('');
  const [codePassword, setCodePassword] = useState('');

  useEffect(() => {
    const stop = socket.on('lobbies', (m) => setLobbies(m.lobbies));
    socket.send({ type: 'list' });
    const id = setInterval(() => socket.send({ type: 'list' }), 3000);
    return () => {
      stop();
      clearInterval(id);
    };
  }, []);

  function change(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  // the server checks the limits again, this just keeps the number box sensible
  function changeKind(kind) {
    setForm((f) => ({ ...f, kind, max: Math.min(f.max, LOBBY_KINDS[kind].max) }));
  }

  function create(e) {
    e.preventDefault();
    const settings = { kind: form.kind, max: Number(form.max), isPrivate: form.isPrivate, password: form.password };
    if (user.isAdmin && form.name.trim()) settings.name = form.name; // everyone else gets "{name}'s lobby" from the server
    socket.send({ type: 'create', ...settings });
  }

  function joinCode(e) {
    e.preventDefault();
    socket.send({ type: 'join', code, password: codePassword });
  }

  const limit = LOBBY_KINDS[form.kind].max;

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
        <h2 className="heading">Multiplayer</h2>
        {error && <p className="error">{error}</p>}

        <div className="box lobbies">
          <h3 className="box-title">Public lobbies</h3>
          {lobbies.length === 0 && <p className="fine">No lobbies yet. Make one!</p>}
          {lobbies.map((l) => (
            <button key={l.id} className={`lobby-row ${l.kind}`} onClick={() => socket.send({ type: 'join', code: l.id })}>
              <span className="lobby-name">{l.name}</span>
              <span className="tag">{LOBBY_KINDS[l.kind].name}</span>
              <span className="lobby-info">
                {l.players}/{l.max}
              </span>
              <span className="lobby-go">{l.status === 'playing' ? 'Watch' : 'Join'}</span>
            </button>
          ))}
        </div>
      </section>

      <aside className="side-col">
        <form className="box form" onSubmit={create}>
          <h2 className="box-title">Create lobby</h2>
          {user.isAdmin ? (
            <label>
              Name
              <input type="text" maxLength={24} placeholder={`${user.name}'s lobby`} value={form.name} onChange={(e) => change('name', e.target.value)} />
            </label>
          ) : (
            <p className="fine">Your lobby will be called {user.name}'s lobby.</p>
          )}
          <label>
            Type
            <select value={form.kind} onChange={(e) => changeKind(e.target.value)}>
              {Object.keys(LOBBY_KINDS).map((kind) => (
                <option key={kind} value={kind}>
                  {LOBBY_KINDS[kind].name} ({MIN_PLAYERS}-{LOBBY_KINDS[kind].max})
                </option>
              ))}
            </select>
          </label>
          <label>
            Max players ({MIN_PLAYERS}-{limit})
            <input type="number" min={MIN_PLAYERS} max={limit} value={form.max} onChange={(e) => change('max', e.target.value)} />
          </label>
          <label className="check">
            <input type="checkbox" checked={form.isPrivate} onChange={(e) => change('isPrivate', e.target.checked)} />
            Private (needs a password)
          </label>
          {form.isPrivate && (
            <label>
              Password
              <input type="password" maxLength={32} autoComplete="off" value={form.password} onChange={(e) => change('password', e.target.value)} />
            </label>
          )}
          <button type="submit" className="btn">
            Create
          </button>
        </form>

        <form className="box form" onSubmit={joinCode}>
          <h2 className="box-title">Join with code</h2>
          <label>
            Code
            <input type="text" maxLength={5} placeholder="ABCDE" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          </label>
          <label>
            Password (if it has one)
            <input type="password" maxLength={32} autoComplete="off" value={codePassword} onChange={(e) => setCodePassword(e.target.value)} />
          </label>
          <button type="submit" className="btn ghost" disabled={code.length < 5}>
            Join
          </button>
        </form>
      </aside>
    </div>
  );
}
