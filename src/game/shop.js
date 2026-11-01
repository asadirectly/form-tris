import { PICTURES } from './pictures.js';

// cosmetic ranks you can buy. they are only for show, they never give permissions or any gameplay advantage
// bg and color are the badge colors (dark text on bright colors so it stays readable), image is for ranks drawn as a picture
// effect is an optional purely visual extra (see src/cosmetics.js). prices are the defaults, an admin can change them (see server/shop.js)
export const COSMETIC_RANKS = {
  tourist: { name: 'Top-Out Tourist', text: 'Just visiting the ceiling.', price: 75, bg: '#3b82f6', color: '#000' },
  meow: { name: 'Meow', text: 'meow', price: 100, bg: '#f472b6', color: '#000' },
  blob: { name: 'Certified Blob', text: 'Chain of one. Zero regrets.', price: 120, bg: '#4ade80', color: '#000' },
  skillissue: { name: 'Skill Issue', text: 'Not an insult. A diagnosis.', price: 150, bg: '#ef4444', color: '#000' },
  hooligan: { name: 'Hard Drop Hooligan', text: 'Gravity is a suggestion.', price: 200, bg: '#fb923c', color: '#000' },
  // this one is a picture of the text in Pixel Comic Sans, the font's license doesn't allow using it as a web font
  sans: { name: 'sans.', text: "it's a beautiful day outside. blocks are falling. you should be stacking.", price: 250, bg: '#000', color: '#fff', image: '/img/sans.png', border: '#fff' },
  wallkick: { name: 'Wall Kick Wizard', text: 'Every rotation is legal if you believe hard enough.', price: 400, bg: '#a855f7', color: '#000' },
  blockillionaire: { name: 'BLOCKILLIONAIRE', text: "The economy is in shambles. You're doing great.", price: 5000, bg: '#facc15', color: '#000', rare: true, effect: 'sparkle' },
};

// every item the shop sells, pictures first. the ids are the keys above, so they never clash with each other
export function allItems() {
  const items = [];
  for (const [id, p] of Object.entries(PICTURES)) {
    if (p.price > 0) items.push({ id, kind: 'picture', label: p.label, name: p.name, text: p.text, price: p.price, rare: !!p.rare });
  }
  for (const [id, r] of Object.entries(COSMETIC_RANKS)) {
    items.push({ id, kind: 'rank', label: 'Rank', name: r.name, text: r.text, price: r.price, rare: !!r.rare });
  }
  return items;
}
