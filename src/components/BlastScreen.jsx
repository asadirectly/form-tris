import { useEffect, useRef, useState } from 'react';
import { SIZE, canPlace, fitsAnywhere, newGame, placePiece, previewClears } from '../game/blast.js';
import { MODES } from '../game/constants.js';
import { saveBest } from '../game/useGame.js';
import { submitScore } from '../api.js';
import { formatTime } from '../format.js';
import { Stat } from './GameScreen.jsx';
import ConfirmButton from './ConfirmButton.jsx';
import Timer from './Timer.jsx';

const BURST_MS = 450;
const CLEAR_NAMES = ['', 'CLEAR', 'DOUBLE', 'TRIPLE', 'BLAST!'];

// a piece drawn as a small grid of blocks, size is a css length
function Shape({ grid, color, size }) {
  return (
    <div className="blast-piece" style={{ gridTemplateColumns: `repeat(${grid[0].length}, ${size})`, '--c': `var(--${color})` }}>
      {grid.flat().map((on, i) => (
        <span key={i} className={on ? 'blast-block' : ''} style={{ width: size, height: size }} />
      ))}
    </div>
  );
}

export default function BlastScreen({ roundId, costText, onPlayAgain, onQuit, onScore }) {
  const [game, setGame] = useState(newGame);
  const [held, setHeld] = useState(null); // the piece being dragged: { index, x, y, cell, row, col, ok }
  const [bursts, setBursts] = useState([]);
  const [popups, setPopups] = useState([]);
  const [result, setResult] = useState(null);

  const boardRef = useRef(null);
  const startTime = useRef(Date.now());
  const endTime = useRef(null);
  const popupId = useRef(0);
  const burstId = useRef(0);
  const burstTimer = useRef(0);

  // the menu may be scrolled down when the round starts (the bar is at the bottom on a phone), so start at the top
  useEffect(() => {
    window.scrollTo(0, 0);
    return () => clearTimeout(burstTimer.current);
  }, []);

  function getTime() {
    return endTime.current === null ? Date.now() - startTime.current : endTime.current;
  }

  function addPopup(text, kind) {
    popupId.current++;
    const popup = { id: popupId.current, text, kind };
    setPopups((list) => [...list.slice(-3), popup]);
  }

  function removePopup(id) {
    setPopups((list) => list.filter((p) => p.id !== id));
  }

  function shake(kind) {
    const el = boardRef.current;
    el.classList.remove('shake-small', 'shake-big');
    void el.offsetWidth; // reading this forces a reflow so the animation can restart
    el.classList.add(kind);
  }

  function showClear(move) {
    burstId.current++;
    clearTimeout(burstTimer.current);
    setBursts(move.cleared.map((cell) => ({ ...cell, key: `${burstId.current}-${cell.row}-${cell.col}` })));
    burstTimer.current = setTimeout(() => setBursts([]), BURST_MS);

    addPopup(CLEAR_NAMES[Math.min(move.lines, 4)], move.lines >= 4 ? 'tetris' : 'clear');
    if (move.game.combo >= 1) addPopup(`COMBO x${move.game.combo}`, 'combo');
    if (move.perfect) addPopup('PERFECT CLEAR', 'perfect');
    shake(move.lines >= 2 ? 'shake-big' : 'shake-small');
  }

  // the server decides what counts, same as the other modes
  function finish(final) {
    const time = Date.now() - startTime.current;
    endTime.current = time;
    const best = saveBest({ mode: 'blast', score: final.score });
    setResult({ score: final.score, lines: final.lines, moves: final.moves, time, best });

    const stats = { score: final.score, lines: final.lines, moves: final.moves, time, combo: final.maxCombo, perfects: final.perfects };
    submitScore(roundId, stats)
      .then((saved) => {
        setResult((r) => ({ ...r, rank: saved.rank }));
        onScore(saved);
      })
      .catch((err) => setResult((r) => ({ ...r, rankError: err.message })));
  }

  function place(index, row, col) {
    const move = placePiece(game, index, row, col);
    if (!move) return;
    setGame(move.game);
    if (move.lines > 0) showClear(move);
    if (move.game.over) finish(move.game);
  }

  // pick a piece up from the tray. it follows the pointer until it is let go
  function startDrag(e, index) {
    const piece = game.tray[index];
    if (!piece || game.over) return;
    e.preventDefault();

    const board = boardRef.current;
    const cell = board.clientWidth / SIZE;
    const lift = e.pointerType === 'touch' ? 70 : 0; // on a phone the piece sits above the finger so it can be seen
    const width = piece.grid[0].length;
    const height = piece.grid.length;

    // the board cell closest to the piece's top left corner
    function spotFor(ev) {
      const rect = board.getBoundingClientRect();
      const left = ev.clientX - (width * cell) / 2;
      const top = ev.clientY - lift - (height * cell) / 2;
      const col = Math.round((left - rect.left - board.clientLeft) / cell);
      const row = Math.round((top - rect.top - board.clientTop) / cell);
      return { row, col, ok: canPlace(game.board, piece.grid, row, col) };
    }

    function move(ev) {
      setHeld({ index, x: ev.clientX, y: ev.clientY - lift, cell, ...spotFor(ev) });
    }

    function stop() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', drop);
      window.removeEventListener('pointercancel', stop);
      setHeld(null);
    }

    function drop(ev) {
      const spot = spotFor(ev);
      stop();
      if (spot.ok) place(index, spot.row, spot.col);
    }

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', drop);
    window.addEventListener('pointercancel', stop);
    move(e);
  }

  // where the held piece would land, and which cells that would clear
  const heldPiece = held ? game.tray[held.index] : null;
  const ghost = new Set();
  const clearing = new Set();
  if (heldPiece && held.ok) {
    heldPiece.grid.forEach((line, r) =>
      line.forEach((on, c) => {
        if (on) ghost.add(`${held.row + r},${held.col + c}`);
      })
    );
    for (const cell of previewClears(game.board, heldPiece, held.row, held.col)) clearing.add(`${cell.row},${cell.col}`);
  }

  let bestText = '';
  if (result && result.best) {
    const value = result.best.best.toLocaleString();
    bestText = result.best.isNew ? `New personal best: ${value}` : `Personal best: ${value}`;
  }

  return (
    <div className="game blast">
      <div className="side">
        <div className="box stats">
          <Stat big label="Score" value={game.score.toLocaleString()} />
          <Stat label="Lines" value={game.lines} />
          <Stat label="Moves" value={game.moves} />
          <Stat label="Time" value={<Timer getTime={getTime} />} />
        </div>

        <div className="chips">
          <span className={game.combo >= 1 ? 'chip on combo' : 'chip combo'}>{game.combo >= 1 ? `Combo x${game.combo}` : 'Combo'}</span>
        </div>

        <ConfirmButton ask="Quit round?" onConfirm={onQuit}>
          Quit
        </ConfirmButton>
      </div>

      <div className="board-wrap">
        <div className="mode-tag">{MODES.blast.name}</div>

        <div className="blast-box" ref={boardRef}>
          <div className="blast-grid">
            {game.board.map((line, r) =>
              line.map((color, c) => {
                const key = `${r},${c}`;
                const isGhost = ghost.has(key);
                let className = 'blast-cell';
                if (color || isGhost) className += ' blast-block';
                if (isGhost) className += ' ghost';
                if (clearing.has(key)) className += ' will-clear';
                const shown = isGhost ? heldPiece.color : color;
                return <div key={key} className={className} style={shown ? { '--c': `var(--${shown})` } : undefined} />;
              })
            )}
          </div>

          <div className="blast-grid blast-fx">
            {bursts.map((b) => (
              <div key={b.key} className="blast-burst blast-block" style={{ gridRow: b.row + 1, gridColumn: b.col + 1, '--c': `var(--${b.color})` }} />
            ))}
          </div>

          <div className="popups">
            {popups.map((p) => (
              <div key={p.id} className={`popup ${p.kind}`} onAnimationEnd={() => removePopup(p.id)}>
                {p.text}
              </div>
            ))}
          </div>

          {result && (
            <div className="overlay">
              <h2 className="overlay-title lose">Game over</h2>
              <dl className="result-stats">
                <div>
                  <dt>Score</dt>
                  <dd>{result.score.toLocaleString()}</dd>
                </div>
                <div>
                  <dt>Lines</dt>
                  <dd>{result.lines}</dd>
                </div>
                <div>
                  <dt>Moves</dt>
                  <dd>{result.moves}</dd>
                </div>
                <div>
                  <dt>Time</dt>
                  <dd>{formatTime(result.time)}</dd>
                </div>
              </dl>
              {bestText && <p className="best-line">{bestText}</p>}
              {result.rank && <p className="best-line">Leaderboard rank: #{result.rank}</p>}
              {result.rankError && <p className="error">{result.rankError}</p>}
              <button className="btn" onClick={onPlayAgain}>
                Play again
                <small className="btn-cost">{costText}</small>
              </button>
              <button className="btn ghost" onClick={onQuit}>
                Menu
              </button>
            </div>
          )}
        </div>

        <p className="hint">Drag a piece onto the board. Fill a whole row or column to clear it. Pieces can't be turned.</p>
      </div>

      <div className="side tray-side">
        <div className="box">
          <h3 className="box-title">Pieces</h3>
          <div className="blast-tray">
            {game.tray.map((piece, i) => {
              let className = 'blast-slot';
              if (held && held.index === i) className += ' lifted';
              else if (piece && !fitsAnywhere(game.board, piece.grid)) className += ' dim'; // nowhere to put it
              return (
                <div key={i} className={className} onPointerDown={(e) => startDrag(e, i)}>
                  {piece && <Shape grid={piece.grid} color={piece.color} size="var(--mini)" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {heldPiece && (
        <div className="blast-drag" style={{ left: held.x, top: held.y }}>
          <Shape grid={heldPiece.grid} color={heldPiece.color} size={`${held.cell}px`} />
        </div>
      )}
    </div>
  );
}
