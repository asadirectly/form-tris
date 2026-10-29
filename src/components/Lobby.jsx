import { useEffect, useState } from 'react';
import Logo from './Logo.jsx';
import { LOBBY_KINDS, MIN_PLAYERS } from '../game/constants.js';

const levels = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function LevelSelect({ value, onChange }) {
  return (
    <select className="level" value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {levels.map((n) => (
        <option key={n} value={n}>
          Lv {n}
        </option>
      ))}
    </select>
  );
}

export default function Lobby({ socket, user, lobby, error }) {
  const me = lobby.members.find((m) => m.id === String(user.id));
  const isHost = lobby.hostId === me.id;
  const players = lobby.members.filter((m) => m.role === 'player');
  const spectators = lobby.members.filter((m) => m.role === 'spectator');

  const [botLevel, setBotLevel] = useState(5);
  const [draft, setDraft] = useState({ name: lobby.name, kind: lobby.kind, max: lobby.max, isPrivate: lobby.isPrivate, password: '' });

  // the host edits a copy, it resets whenever the saved settings change
  useEffect(() => {
    setDraft({ name: lobby.name, kind: lobby.kind, max: lobby.max, isPrivate: lobby.isPrivate, password: '' });
  }, [lobby.name, lobby.kind, lobby.max, lobby.isPrivate]);

  function change(field, value) {
    setDraft((d) => ({ ...d, [field]: value }));
  }

  function changeKind(kind) {
    setDraft((d) => ({ ...d, kind, max: Math.min(d.max, LOBBY_KINDS[kind].max) }));
  }

  function save(e) {
    e.preventDefault();
    socket.send({ type: 'settings', ...draft, max: Number(draft.max) });
  }

  return (
    <div className="menu">
      <header className="topbar">
        <Logo small />
        <div className="user">
          {isHost && <span className="badge owner">Host</span>}
          <span className="username">{user.name}</span>
          <button className="btn small ghost" onClick={() => socket.send({ type: 'leave' })}>
            Leave
          </button>
        </div>
      </header>

      <section className="play-col">
        <h2 className="heading">{lobby.name}</h2>
        {error && <p className="error">{error}</p>}

        <div className="box lobbies">
          <h3 className="box-title">
            Players {players.length}/{lobby.max}
          </h3>
          <ul className="members">
            {players.map((m) => (
              <li key={m.id} className={m.ready || m.id === lobby.hostId ? 'ready' : ''}>
                <span className="member-name">{m.name}</span>
                {m.id === lobby.hostId && <span className="badge owner">Host</span>}
                {m.bot && <span className="badge cpu">CPU</span>}
                {m.bot && isHost && <LevelSelect value={m.level} onChange={(level) => socket.send({ type: 'setBot', id: m.id, level })} />}
                {m.bot && !isHost && <span className="member-level">Lv {m.level}</span>}
                {!m.bot && m.id !== lobby.hostId && <span className={m.ready ? 'badge ready' : 'badge wait'}>{m.ready ? 'Ready' : 'Not ready'}</span>}
                {isHost && m.id !== me.id && (
                  <>
                    {!m.bot && (
                      <button className="btn small ghost" onClick={() => socket.send({ type: 'host', id: m.id })}>
                        Make host
                      </button>
                    )}
                    <button className="btn small ghost" onClick={() => socket.send({ type: 'kick', id: m.id })}>
                      {m.bot ? 'Remove' : 'Kick'}
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>

        {spectators.length > 0 && (
          <div className="box lobbies spectators">
            <h3 className="box-title">Spectators {spectators.length}</h3>
            <ul className="members">
              {spectators.map((m) => (
                <li key={m.id}>
                  <span className="member-name">{m.name}</span>
                  {isHost && m.id !== me.id && (
                    <>
                      <button className="btn small ghost" onClick={() => socket.send({ type: 'host', id: m.id })}>
                        Make host
                      </button>
                      <button className="btn small ghost" onClick={() => socket.send({ type: 'kick', id: m.id })}>
                        Kick
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <aside className="side-col">
        <div className="box">
          <h2 className="box-title">Match</h2>
          <p className="lobby-code">{lobby.id}</p>
          <p className="fine">
            {LOBBY_KINDS[lobby.kind].name}
            {lobby.isPrivate ? ' · Private' : ' · Public'}. Share the code to invite people.
          </p>
          <div className="lobby-actions">
            {me.role === 'player' && !isHost && (
              <button className={me.ready ? 'btn ghost' : 'btn'} onClick={() => socket.send({ type: 'ready', ready: !me.ready })}>
                {me.ready ? 'Not ready' : 'Ready'}
              </button>
            )}
            {isHost && (
              <button className="btn" disabled={players.length < MIN_PLAYERS} onClick={() => socket.send({ type: 'start' })}>
                Start match
              </button>
            )}
            <button className="btn small ghost" onClick={() => socket.send({ type: 'role', role: me.role === 'player' ? 'spectator' : 'player' })}>
              {me.role === 'player' ? 'Watch instead' : 'Play instead'}
            </button>
          </div>
          {isHost && players.length < MIN_PLAYERS && <p className="fine">Add a CPU or wait for someone to join.</p>}
        </div>

        {isHost && (
          <div className="box form">
            <h2 className="box-title">Add CPU</h2>
            <div className="cpu-add">
              <LevelSelect value={botLevel} onChange={setBotLevel} />
              <button className="btn small ghost" disabled={players.length >= lobby.max} onClick={() => socket.send({ type: 'addBot', level: botLevel })}>
                Add
              </button>
            </div>
          </div>
        )}

        {isHost ? (
          <form className="box form" onSubmit={save}>
            <h2 className="box-title">Settings</h2>
            <label>
              Name
              <input type="text" maxLength={24} value={draft.name} onChange={(e) => change('name', e.target.value)} />
            </label>
            <label>
              Type
              <select value={draft.kind} onChange={(e) => changeKind(e.target.value)}>
                {Object.keys(LOBBY_KINDS).map((kind) => (
                  <option key={kind} value={kind}>
                    {LOBBY_KINDS[kind].name} ({MIN_PLAYERS}-{LOBBY_KINDS[kind].max})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Max players ({MIN_PLAYERS}-{LOBBY_KINDS[draft.kind].max})
              <input type="number" min={MIN_PLAYERS} max={LOBBY_KINDS[draft.kind].max} value={draft.max} onChange={(e) => change('max', e.target.value)} />
            </label>
            <label className="check">
              <input type="checkbox" checked={draft.isPrivate} onChange={(e) => change('isPrivate', e.target.checked)} />
              Private (needs a password)
            </label>
            {draft.isPrivate && (
              <label>
                {lobby.isPrivate ? 'New password (leave empty to keep it)' : 'Password'}
                <input type="password" maxLength={32} autoComplete="off" value={draft.password} onChange={(e) => change('password', e.target.value)} />
              </label>
            )}
            <button type="submit" className="btn small ghost">
              Save settings
            </button>
          </form>
        ) : (
          <div className="box">
            <h2 className="box-title">Settings</h2>
            <ul className="perks">
              <li>
                <span>Type</span>
                <b>{LOBBY_KINDS[lobby.kind].name}</b>
              </li>
              <li>
                <span>Max players</span>
                <b>{lobby.max}</b>
              </li>
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}
