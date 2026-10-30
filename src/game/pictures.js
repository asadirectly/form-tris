// profile pictures. every profile saves the key of its picture, so a future shop only has to add a line here
// and let a player pick one they own. unknown keys fall back to the default
export const PICTURES = {
  caticon1: { name: 'Cat', file: '/img/caticon1.png' },
};

export const DEFAULT_PICTURE = 'caticon1';

export function pictureFile(key) {
  return (PICTURES[key] || PICTURES[DEFAULT_PICTURE]).file;
}
