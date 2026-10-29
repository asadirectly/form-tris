import { useEffect, useRef, useState } from 'react';
import { useGame } from '../game/useGame.js';
import { COLS, ROWS, HIDDEN, CELL, LOBBY_KINDS } from '../game/constants.js';
import { Stat } from './GameScreen.jsx';
import Minis, { MiniBoard } from './Minis.jsx';
import PieceBox from './PieceBox.jsx';
import Timer from './Timer.jsx';
import TouchPad from './TouchPad.jsx';

// ways to pick who your garbage goes to, clicking a board aims at that player for good
const aims = [
  { mode: 'random', label: 'Random', key: '1' },
  { mode: 'attackers', label: 'Attackers', key: '2' },
  { mode: 'knockouts', label: 'KOs', key: '3' },
  { mode: 'badges', label: 'Badges', key: '4' },
];

// puts the opponent boards on both sides of the board, in the same order for everybody
function split(ids, order) {
  const sorted = [...ids].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const half = Math.ceil(sorted.length / 2);
  return [sorted.slice(0, half), sorted.slice(half)];
}

function Match({ socket, seed, kind, you, boards, ids, target, alive, total, place, kos, badges, names, order, onSpectate, onLeave }) {
  const versus = useRef({ socket, seed }).current;
  const { canvasRef, boxRef, hud, popups, removePopup, result, getTime } = useGame('versus', null, null, versus);
  const [aim, setAim] = useState('random');
  const royale = kind === 'royale';
  const choices = royale ? aims : aims.slice(0, 3);

  function pick(mode) {
    setAim(mode);
    socket.send({ type: 'target', mode });
  }

  function aimAt(id) {
    setAim('manual');
    socket.send({ type: 'target', mode: 'manual', id });
  }

  // number keys change the targeting
  useEffect(() => {
    function onKey(e) {
      const found = choices.find((a) => e.key === a.key);
      if (found) pick(found.mode);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const [left, right] = split(ids, order);
  const out = place !== undefined || result;

  return (
    <div className="game versus">
      <Minis ids={left} boards={boards} names={names} target={aim === 'manual' ? target : null} onPick={aimAt} />

      <div className="side">
        <div className="box">
          <h3 className="box-title">Hold</h3>
          <PieceBox type={hud.hold} dim={!hud.canHold} />
        </div>

        <div className="box stats">
          <Stat big label="Score" value={hud.score.toLocaleString()} />
          <Stat label="Lines" value={hud.lines} />
          <Stat label="Level" value={hud.level} />
          <Stat label="Alive" value={`${alive}/${total}`} />
          <Stat label="KOs" value={kos} />
          {royale && <Stat label="Badges" value={badges} />}
          <Stat label="Time" value={<Timer getTime={getTime} />} />
        </div>

        <div className="chips aim">
          {choices.map((a) => (
            <button key={a.mode} className={aim === a.mode ? 'chip pick on' : 'chip pick'} onClick={() => pick(a.mode)} title={`Key ${a.key}`}>
              {a.label}
            </button>
          ))}
        </div>

        <button className="btn small ghost pause" onClick={onLeave}>
          Leave
        </button>
      </div>

      <div className="board-wrap">
        <div className="mode-tag">{LOBBY_KINDS[kind].name}</div>

        <div className="board-row">
          <div className="meter danger" title="Garbage coming">
            <div className="meter-fill" style={{ height: `${Math.min(hud.incoming / 12, 1) * 100}%` }} />
          </div>

          <div className="board-box" ref={boxRef}>
            <canvas ref={canvasRef} width={COLS * CELL} height={(ROWS - HIDDEN) * CELL} />

            <div className="popups">
              {popups.map((p) => (
                <div key={p.id} className={`popup ${p.kind}`} onAnimationEnd={() => removePopup(p.id)}>
                  {p.text}
                </div>
              ))}
            </div>

            {hud.state === 'countdown' && (
              <div className="overlay clear-bg">
                <div className="count" key={hud.count}>
                  {hud.count}
                </div>
              </div>
            )}

            {out && (
              <div className="overlay">
                <h2 className="overlay-title lose">{place ? `Out! #${place}` : 'Game over'}</h2>
                <dl className="result-stats">
                  <div>
                    <dt>Score</dt>
                    <dd>{hud.score.toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt>Lines</dt>
                    <dd>{hud.lines}</dd>
                  </div>
                  <div>
                    <dt>KOs</dt>
                    <dd>{kos}</dd>
                  </div>
                </dl>
                <button className="btn" onClick={onSpectate}>
                  Spectate
                </button>
                <button className="btn ghost" onClick={onLeave}>
                  Leave
                </button>
              </div>
            )}
          </div>
        </div>

        <p className="hint">Arrows move · Up/X rotate · Z back · Space drop · C hold · 1-{royale ? 4 : 3} aim · click a board to target it</p>
      </div>

      <div className="side">
        <div className="box">
          <h3 className="box-title">Next</h3>
          <div className="next-list">
            {hud.next.map((type, i) => (
              <PieceBox key={i} type={type} />
            ))}
          </div>
        </div>
      </div>

      <Minis ids={right} boards={boards} names={names} target={aim === 'manual' ? target : null} onPick={aimAt} />
      <TouchPad />
    </div>
  );
}

// for spectators and players who are out: one board big, the rest small, click to follow somebody else
function Spectate({ socket, kind, boards, ids, alive, total, names, order, follow, onFollow, onLeave }) {
  const shown = follow && ids.includes(follow) ? follow : ids[0];
  const others = ids.filter((id) => id !== shown);
  const [left, right] = split(others, order);

  return (
    <div className="game versus watching">
      <Minis ids={left} boards={boards} names={names} target={null} onPick={onFollow} />

      <div className="board-wrap">
        <div className="mode-tag">Spectating · {LOBBY_KINDS[kind].name}</div>
        <div className="watch-board">
          <MiniBoard board={shown ? boards[shown] : null} cell={20} />
        </div>
        <p className="watch-name">{shown && names[shown] ? names[shown].name : 'Waiting for boards...'}</p>
        <p className="hint">
          {alive} of {total} still alive. Click a small board to follow that player.
        </p>
        <button className="btn small ghost" onClick={onLeave}>
          Leave
        </button>
      </div>

      <Minis ids={right} boards={boards} names={names} target={null} onPick={onFollow} />
    </div>
  );
}

function Results({ results, you, onDone, onLeave }) {
  const mine = results.find((r) => r.id === you);
  const top = results.slice(0, 10);
  const label = (r) => (r.bot ? `${r.name} Lv ${r.level}` : r.name);

  return (
    <div className="modal-back">
      <div className="modal multi">
        <h2 className="modal-head">{results[0].id === you ? 'You win!' : 'Results'}</h2>
        <div className="modal-body">
          <ul className="results">
            {top.map((r) => (
              <li key={r.id} className={r.id === you ? 'rank-row me' : 'rank-row'}>
                <span className="rank-pos">{r.placement}</span>
                <span className="rank-name">{label(r)}</span>
                <span className="rank-value">{r.kos} KO</span>
              </li>
            ))}
            {mine && mine.placement > 10 && (
              <li className="rank-row me">
                <span className="rank-pos">{mine.placement}</span>
                <span className="rank-name">{label(mine)}</span>
                <span className="rank-value">{mine.kos} KO</span>
              </li>
            )}
          </ul>
          <div className="modal-buttons">
            <button className="btn ghost" onClick={onLeave}>
              Leave
            </button>
            <button className="btn" onClick={onDone}>
              Back to lobby
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Versus({ socket, lobby, game, onDone, onLeave }) {
  const you = game.you;
  const names = {};
  for (const m of lobby.members) names[m.id] = m;
  const order = lobby.members.map((m) => m.id);

  const [total] = useState(() => lobby.members.filter((m) => m.role === 'player').length);
  const [boards, setBoards] = useState({});
  const [ids, setIds] = useState([]);
  const [target, setTarget] = useState(null);
  const [alive, setAlive] = useState(total);
  const [out, setOut] = useState({}); // player id -> the place they finished in
  const [kos, setKos] = useState(0);
  const [badges, setBadges] = useState(0);
  const [results, setResults] = useState(null);
  const [watching, setWatching] = useState(game.spectate);
  const [follow, setFollow] = useState(null);

  useEffect(() => {
    const stops = [
      socket.on('previews', (m) => {
        setBoards((b) => ({ ...b, ...m.boards }));
        setIds(m.ids);
        setTarget(m.target);
        setAlive(m.alive);
      }),
      socket.on('out', (m) => {
        setOut((o) => ({ ...o, [m.id]: m.placement }));
        setAlive(m.alive);
        if (m.by === you) setKos((k) => k + 1);
      }),
      socket.on('ko', (m) => setBadges(m.badges)),
      socket.on('results', (m) => setResults(m.results)),
    ];
    return () => stops.forEach((stop) => stop());
  }, []);

  function followPlayer(id) {
    setFollow(id);
    socket.send({ type: 'watch', id });
  }

  return (
    <>
      {watching ? (
        <Spectate
          socket={socket}
          kind={game.kind}
          boards={boards}
          ids={ids}
          alive={alive}
          total={total}
          names={names}
          order={order}
          follow={follow}
          onFollow={followPlayer}
          onLeave={onLeave}
        />
      ) : (
        <Match
          socket={socket}
          seed={game.seed}
          kind={game.kind}
          you={you}
          boards={boards}
          ids={ids}
          target={target}
          alive={alive}
          total={total}
          place={out[you]}
          kos={kos}
          badges={badges}
          names={names}
          order={order}
          onSpectate={() => setWatching(true)}
          onLeave={onLeave}
        />
      )}
      {results && <Results results={results} you={you} onDone={onDone} onLeave={onLeave} />}
    </>
  );
}
