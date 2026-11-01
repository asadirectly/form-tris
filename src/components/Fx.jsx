import { EFFECTS } from '../cosmetics.js';

// where the sparkles sit around whatever they wrap, as percentages. a handful is plenty
const spots = [
  { left: '-6%', top: '10%', delay: '0s' },
  { left: '92%', top: '0%', delay: '0.7s' },
  { left: '48%', top: '-12%', delay: '1.4s' },
  { left: '98%', top: '70%', delay: '2.1s' },
  { left: '8%', top: '88%', delay: '2.8s' },
];

// wraps something and adds the item's visual effect around it. with no effect it is just a plain wrapper.
// the sparkles are css animations with the provided texture, so they cost almost nothing. they are hidden for players
// who turned effects off or ask their system for less motion, and an effect inside another effect is hidden (see app.css)
export default function Fx({ effect, children, className = '' }) {
  if (!effect || !Object.hasOwn(EFFECTS, effect)) return children;

  return (
    <span className={`fx fx-${effect} ${className}`}>
      {children}
      {effect === 'sparkle' &&
        spots.map((s, i) => <img key={i} className="sparkle" src="/img/sparkle.png" alt="" aria-hidden="true" style={{ left: s.left, top: s.top, animationDelay: s.delay }} />)}
    </span>
  );
}
