// profile pictures. an item can have an effect (see src/cosmetics.js), it is only a visual. every profile saves the key of its picture. price 0 means everybody owns it and it is not for sale
// prices here are the defaults, an admin can change them (see server/shop.js)
export const PICTURES = {
  caticon1: { label: 'Classic Cat', name: 'Classic Cat', text: 'Everyone starts with one.', file: '/img/caticon1.png', price: 0 },
  puyo: { label: 'Green Puyo', name: 'Puyo Enjoyer', text: 'No thoughts. Just blob.', file: '/img/greenpuyo.png', price: 100 },
  cat: { label: 'Cat Icon', name: 'Catastrophic', text: 'Nine lives. Zero Tetrises.', file: '/img/catshop.png', price: 150 },
  dominus: { label: 'Golden Dominus', name: 'Financially Irresponsible', text: "You could've played 166 rounds instead.", file: '/img/dominus.png', price: 5000, rare: true, effect: 'sparkle' },
};

export const DEFAULT_PICTURE = 'caticon1';

// pictures an admin uploads are saved by the server as files and look like upload:12-1700000000000.png
export const UPLOAD_KEY = /^upload:[a-z0-9-]{1,60}\.(png|jpg|gif|webp)$/;

export function isPictureKey(key) {
  return typeof key === 'string' && (Object.hasOwn(PICTURES, key) || UPLOAD_KEY.test(key));
}

export function pictureFile(key) {
  if (typeof key === 'string' && UPLOAD_KEY.test(key)) return `/avatars/${key.slice('upload:'.length)}`;
  return (Object.hasOwn(PICTURES, key) ? PICTURES[key] : PICTURES[DEFAULT_PICTURE]).file;
}
