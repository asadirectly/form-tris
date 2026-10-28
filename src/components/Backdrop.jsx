import { useMemo } from 'react';
import { PIECE_TYPES, SHAPES, COLORS } from '../game/constants.js';

// slow falling pieces behind everything, animated with css only
export default function Backdrop() {
  const pieces = useMemo(() => {
    const list = [];
    for (let i = 0; i < 14; i++) {
      list.push({
        type: PIECE_TYPES[i % 7],
        left: Math.random() * 100,
        delay: -Math.random() * 40,
        duration: 25 + Math.random() * 25,
        size: 14 + Math.random() * 18,
        rot: Math.floor(Math.random() * 4) * 90,
      });
    }
    return list;
  }, []);

  return (
    <div className="backdrop" aria-hidden="true">
      {pieces.map((p, i) => {
        const shape = SHAPES[p.type][0];
        const style = {
          left: `${p.left}%`,
          animationDuration: `${p.duration}s`,
          animationDelay: `${p.delay}s`,
          '--size': `${p.size}px`,
          '--color': COLORS[p.type],
          '--rot': `${p.rot}deg`,
          gridTemplateColumns: `repeat(${shape.length}, var(--size))`,
        };
        return (
          <div key={i} className="faller" style={style}>
            {shape.flat().map((on, j) => (
              <span key={j} className={on ? 'on' : ''} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
