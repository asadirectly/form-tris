import { Fragment } from 'react';
import { PIECE_TYPES, COLORS } from '../game/constants.js';

const letters = 'FORM-TRIS!'.split('');

// every letter is a block in a piece color, the big logo wraps after "FORM-"
export default function Logo({ small }) {
  return (
    <h1 className={small ? 'logo small' : 'logo'} aria-label="Form-Tris!">
      {letters.map((ch, i) => (
        <Fragment key={i}>
          <span style={{ '--c': COLORS[PIECE_TYPES[i % 7]], '--i': i }} aria-hidden="true">
            {ch}
          </span>
          {i === 4 && !small && <i className="logo-break" />}
        </Fragment>
      ))}
    </h1>
  );
}
