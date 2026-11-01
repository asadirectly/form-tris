// keyboard controls. every action can have up to 2 keys (event.code names like KeyX or ArrowLeft)
export const ACTIONS = [
  { id: 'left', label: 'Move left' },
  { id: 'right', label: 'Move right' },
  { id: 'softDrop', label: 'Soft drop' },
  { id: 'hardDrop', label: 'Hard drop' },
  { id: 'rotateCw', label: 'Rotate' },
  { id: 'rotateCcw', label: 'Rotate back' },
  { id: 'hold', label: 'Hold' },
  { id: 'pause', label: 'Pause' },
];

export const DEFAULT_KEYS = {
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  softDrop: ['ArrowDown'],
  hardDrop: ['Space'],
  rotateCw: ['ArrowUp', 'KeyX'],
  rotateCcw: ['KeyZ', 'ControlLeft'],
  hold: ['KeyC', 'ShiftLeft'],
  pause: ['Escape', 'KeyP'],
};

export const KEYS_PER_ACTION = 2;

// keys that would break the page or the browser, they can't be bound
const blocked = ['Tab', 'MetaLeft', 'MetaRight', 'ContextMenu', 'F5', 'F11', 'F12'];

const names = {
  ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'Space', Escape: 'Esc',
  ShiftLeft: 'L Shift', ShiftRight: 'R Shift', ControlLeft: 'L Ctrl', ControlRight: 'R Ctrl',
  AltLeft: 'L Alt', AltRight: 'R Alt', Enter: 'Enter', Backspace: 'Backspace',
};

// a short name for a key to show on a keycap
export function keyLabel(code) {
  if (names[code]) return names[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}

export function isBindable(code) {
  return typeof code === 'string' && /^[A-Za-z0-9]{1,16}$/.test(code) && !blocked.includes(code);
}

// checks a whole set of keys, from the browser or the server. returns the cleaned keys, or null if anything is wrong
export function cleanKeys(input) {
  if (!input || typeof input !== 'object') return null;
  const out = {};
  const used = new Set();

  for (const { id } of ACTIONS) {
    const list = input[id];
    if (!Array.isArray(list) || list.length < 1 || list.length > KEYS_PER_ACTION) return null;
    for (const code of list) {
      if (!isBindable(code) || used.has(code)) return null; // the same key can't do two things
      used.add(code);
    }
    out[id] = list;
  }
  return out;
}

// the keys in use right now. the settings screen changes them and the game reads them on every key press
let active = DEFAULT_KEYS;

export function getActiveKeys() {
  return active;
}

export function setActiveKeys(keys) {
  active = cleanKeys(keys) || DEFAULT_KEYS;
}

// which action a key does, or null
export function actionOf(code) {
  for (const { id } of ACTIONS) {
    if (active[id].includes(code)) return id;
  }
  return null;
}
