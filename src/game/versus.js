import { COLS, ROWS, HIDDEN } from './constants.js';

// helpers the game and the server both use for multiplayer

// a board sent over the network is one string with a char per visible cell:
// 0 is empty, 1-7 are the pieces in the order below, 8 is garbage
export const BOARD_TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L', 'G'];
export const BOARD_SIZE = COLS * (ROWS - HIDDEN);

export function encodeBoard(board) {
  let out = '';
  for (let y = HIDDEN; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const type = board[y][x];
      out += type ? BOARD_TYPES.indexOf(type) + 1 : 0;
    }
  }
  return out;
}

export function isBoardString(str) {
  return typeof str === 'string' && str.length === BOARD_SIZE && /^[0-8]+$/.test(str);
}

// how many rows tall the stack is
export function stackHeight(str) {
  const first = str.search(/[1-8]/);
  return first < 0 ? 0 : ROWS - HIDDEN - Math.floor(first / COLS);
}

// small seeded random generator (mulberry32), the server hands out the seed so every player gets the same pieces
export function seededRandom(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
