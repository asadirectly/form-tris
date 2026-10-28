import { useEffect, useRef } from 'react';
import { drawPreview } from '../game/draw.js';

export default function PieceBox({ type, dim }) {
  const ref = useRef(null);

  useEffect(() => {
    drawPreview(ref.current.getContext('2d'), type, 100, 70);
  }, [type]);

  return <canvas ref={ref} width={100} height={70} className={dim ? 'piece-box dim' : 'piece-box'} />;
}
