import { RANKS } from './game/achievements.js';
import { COSMETIC_RANKS } from './game/shop.js';

// a darker shade of a hex color, for the hard shadow under things (the same look as the --yellow-dk style colors)
function darken(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const parts = [0, 2, 4].map((i) => Math.round(parseInt(h.slice(i, i + 2), 16) * 0.5));
  return `rgb(${parts.join(',')})`;
}

// the name shown for a title, or null if the id is unknown
export function titleName(id) {
  if (id === 'owner') return 'Owner';
  if (id === 'admin') return 'Admin';

  const rank = RANKS.find((r) => r.id === id);
  if (rank) return rank.name;

  return Object.hasOwn(COSMETIC_RANKS, id) ? COSMETIC_RANKS[id].name : null;
}

// the accent color of a title, used for a player's profile. returns { c, dk } or null if the id is unknown
export function titleColor(id) {
  if (id === 'owner') return { c: 'var(--yellow)', dk: 'var(--yellow-dk)' };
  if (id === 'admin') return { c: 'var(--cyan)', dk: 'var(--cyan-dk)' };

  const rank = RANKS.find((r) => r.id === id);
  if (rank) return { c: `var(--${rank.color})`, dk: `var(--${rank.color}-dk)` };

  if (Object.hasOwn(COSMETIC_RANKS, id)) {
    const bought = COSMETIC_RANKS[id];
    // a black badge (sans.) would vanish on the dark page, so its white outline is the accent
    const c = bought.bg === '#000' ? bought.border || '#fff' : bought.bg;
    return { c, dk: darken(c) };
  }
  return null;
}
