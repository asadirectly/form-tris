import { RANKS } from '../game/achievements.js';
import { COSMETIC_RANKS } from '../game/shop.js';
import { pictureFile } from '../game/pictures.js';
import { pictureEffect, titleEffect } from '../cosmetics.js';
import Fx from './Fx.jsx';

// one title: Owner, Admin, a rank earned from achievements or a rank bought in the shop
export function Badge({ id, big, quiet }) {
  const size = big ? ' big' : '';
  if (id === 'owner') return <span className={`badge owner${size}`}>Owner</span>;
  if (id === 'admin') return <span className={`badge admin${size}`}>Admin</span>;

  const rank = RANKS.find((r) => r.id === id);
  if (rank) {
    return (
      <span className={`badge rank${size}`} style={{ '--c': `var(--${rank.color})` }}>
        {rank.name}
      </span>
    );
  }

  const bought = Object.hasOwn(COSMETIC_RANKS, id) ? COSMETIC_RANKS[id] : null;
  if (!bought) return null;
  const style = { background: bought.bg, color: bought.color, borderColor: bought.border || bought.bg };
  return (
    <Fx effect={quiet ? null : titleEffect(id)}>
      <span className={`badge cosmetic${bought.rare ? ' rare' : ''}${size}`} style={style} title={bought.text}>
        {bought.image ? <img className="rank-image" src={bought.image} alt={bought.name} /> : bought.name}
      </span>
    </Fx>
  );
}

// the titles beside a name, Owner and Admin first, then the ranks the player chose to show
export function Badges({ ids, quiet }) {
  if (!ids || ids.length === 0) return null;
  return ids.map((id) => <Badge key={id} id={id} quiet={quiet} />);
}

// the small square picture used in lists
export function Avatar({ picture, size }) {
  return (
    <Fx effect={pictureEffect(picture)}>
      <img className="avatar" src={pictureFile(picture)} width={size} height={size} alt="" />
    </Fx>
  );
}

// a name that opens the player's profile. CPUs have no profile, so they stay plain text
export default function PlayerLink({ id, name, onProfile, className }) {
  const real = onProfile && /^\d+$/.test(String(id));
  if (!real) return <span className={className}>{name}</span>;

  // the outer span keeps the look of a plain name, the button only adds the click
  return (
    <span className={className}>
      <button type="button" className="name-link" onClick={() => onProfile(Number(id))}>
        {name}
      </button>
    </span>
  );
}
