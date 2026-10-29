import { useEffect, useRef } from 'react';
import { COLS, ROWS, HIDDEN } from '../game/constants.js';
import { drawMini } from '../game/draw.js';

const EMPTY = '0'.repeat(COLS * (ROWS - HIDDEN));

// one opponent's board, only redrawn when the board string changes
export function MiniBoard({ board, cell }) {
  const ref = useRef(null);

  useEffect(() => {
    drawMini(ref.current.getContext('2d'), board || EMPTY, cell);
  }, [board, cell]);

  return <canvas ref={ref} width={COLS * cell} height={(ROWS - HIDDEN) * cell} />;
}

// a grid of opponent boards, clicking one aims at it (or watches it when spectating)
export default function Minis({ ids, boards, names, target, onPick }) {
  return (
    <div className="opps">
      {ids.map((id) => (
        <button key={id} className={id === target ? 'mini target' : 'mini'} onClick={() => onPick(id)} title={names[id] ? names[id].name : ''}>
          <MiniBoard board={boards[id]} cell={4} />
          <span className="mini-name">{names[id] ? names[id].name : ''}</span>
        </button>
      ))}
    </div>
  );
}
