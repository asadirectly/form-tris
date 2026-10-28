import { useGame } from '../game/useGame.js';
import { COLS, ROWS, HIDDEN, CELL, MODES, SPRINT_LINES } from '../game/constants.js';
import { formatTime } from '../format.js';
import PieceBox from './PieceBox.jsx';
import Timer from './Timer.jsx';
import TouchPad from './TouchPad.jsx';

function Stat({ label, value, big }) {
  return (
    <div className={big ? 'stat big' : 'stat'}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

export default function GameScreen({ mode, costText, onPlayAgain, onQuit }) {
  const { canvasRef, boxRef, hud, popups, removePopup, paused, togglePause, result, getTime } = useGame(mode);
  const sprint = mode === 'sprint';

  let bestText = '';
  if (result && result.best) {
    const value = sprint ? formatTime(result.best.best) : result.best.best.toLocaleString();
    bestText = result.best.isNew ? `New personal best: ${value}` : `Personal best: ${value}`;
  }

  // the bar next to the board: progress to 40 lines, or to the next level
  const progress = sprint ? hud.lines / SPRINT_LINES : (hud.lines % 10) / 10;

  return (
    <div className={`game ${mode}`}>
      <div className="side">
        <div className="box">
          <h3 className="box-title">Hold</h3>
          <PieceBox type={hud.hold} dim={!hud.canHold} />
        </div>

        <div className="box stats">
          <Stat big label="Score" value={hud.score.toLocaleString()} />
          <Stat label="Lines" value={sprint ? `${hud.lines}/${SPRINT_LINES}` : hud.lines} />
          {!sprint && <Stat label="Level" value={hud.level} />}
          <Stat label="Time" value={<Timer getTime={getTime} />} />
        </div>

        <div className="chips">
          <span className={hud.b2b ? 'chip on b2b' : 'chip b2b'}>B2B</span>
          <span className={hud.combo >= 1 ? 'chip on combo' : 'chip combo'}>
            {hud.combo >= 1 ? `Combo x${hud.combo}` : 'Combo'}
          </span>
        </div>

        <button className="btn small ghost pause" onClick={togglePause}>
          Pause
        </button>
      </div>

      <div className="board-wrap">
        <div className="mode-tag">{MODES[mode].name}</div>

        <div className="board-row">
          <div className="meter" title={sprint ? 'Lines' : 'Next level'}>
            <div className="meter-fill" style={{ height: `${Math.min(progress, 1) * 100}%` }} />
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

            {paused && (
              <div className="overlay">
                <h2 className="overlay-title">Paused</h2>
                <button className="btn" onClick={togglePause}>
                  Resume
                </button>
                <button className="btn ghost" onClick={onQuit}>
                  Quit to menu
                </button>
              </div>
            )}

            {result && (
              <div className="overlay">
                <h2 className={result.won ? 'overlay-title win' : 'overlay-title lose'}>
                  {result.won ? 'Finished!' : 'Game over'}
                </h2>
                {result.won && <div className="big-time">{formatTime(result.time)}</div>}
                <dl className="result-stats">
                  <div>
                    <dt>Score</dt>
                    <dd>{result.score.toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt>Lines</dt>
                    <dd>{result.lines}</dd>
                  </div>
                  {!sprint && (
                    <div>
                      <dt>Level</dt>
                      <dd>{result.level}</dd>
                    </div>
                  )}
                  {!result.won && (
                    <div>
                      <dt>Time</dt>
                      <dd>{formatTime(result.time)}</dd>
                    </div>
                  )}
                </dl>
                {bestText && <p className="best-line">{bestText}</p>}
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
        </div>

        <p className="hint">Arrows move · Up/X rotate · Z back · Space drop · C hold · Esc pause</p>
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

      <TouchPad />
    </div>
  );
}
