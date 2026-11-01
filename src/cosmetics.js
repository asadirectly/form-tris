import { PICTURES } from './game/pictures.js';
import { COSMETIC_RANKS } from './game/shop.js';

// visual effects an item can have. an item names one in its `effect` field (see pictures.js and game/shop.js).
// they only change how something looks, never what a player can do. to add one: put it here, give it css in app.css
// (and a component if it needs more than a class), then name it on an item
export const EFFECTS = {
  sparkle: { name: 'Sparkle' },
};

// the effect of the picture a player has showing, or null
export function pictureEffect(pictureKey) {
  return Object.hasOwn(PICTURES, pictureKey) && PICTURES[pictureKey].effect ? PICTURES[pictureKey].effect : null;
}

// the effect of a shown title (earned ranks and owner/admin have none), or null
export function titleEffect(titleId) {
  return Object.hasOwn(COSMETIC_RANKS, titleId) && COSMETIC_RANKS[titleId].effect ? COSMETIC_RANKS[titleId].effect : null;
}

// where a picture and titles are shown together, only one of them sparkles. the picture goes first, so the titles stay quiet
// when it has an effect (wearing both premium items then gives one effect, not two)
export function titlesQuiet(pictureKey) {
  return pictureEffect(pictureKey) !== null;
}
