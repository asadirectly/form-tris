import { RANKS } from '../game/achievements.js';
import { pictureFile } from '../game/pictures.js';

// the badges beside a name: Owner and Admin first, then the ranks the player chose to show
export function Badges({ ids }) {
  if (!ids || ids.length === 0) return null;
  return (
    <>
      {ids.map((id) => {
        if (id === 'owner') return <span key={id} className="badge owner">Owner</span>;
        if (id === 'admin') return <span key={id} className="badge admin">Admin</span>;
        const rank = RANKS.find((r) => r.id === id);
        if (!rank) return null;
        return (
          <span key={id} className="badge rank" style={{ '--c': `var(--${rank.color})` }}>
            {rank.name}
          </span>
        );
      })}
    </>
  );
}

// the small round picture used in lists
export function Avatar({ picture, size }) {
  return <img className="avatar" src={pictureFile(picture)} width={size} height={size} alt="" />;
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
