import { COLS, ROWS, SHAPES } from '../src/game/constants.js';
import { newGame, update, hardDrop } from '../src/game/engine.js';

// pieces per second, and how often the bot picks one of its next best spots instead of the best one
const LEVELS = [
  null,
  { pps: 0.4, sloppy: 0.5 },
  { pps: 0.55, sloppy: 0.4 },
  { pps: 0.75, sloppy: 0.3 },
  { pps: 1.0, sloppy: 0.2 },
  { pps: 1.3, sloppy: 0.12 },
  { pps: 1.7, sloppy: 0.07 },
  { pps: 2.2, sloppy: 0.03 },
  { pps: 2.8, sloppy: 0.01 },
  { pps: 3.5, sloppy: 0 },
];

// bots play on the real engine so garbage and attacks work exactly like they do for people
export function makeBotGame(rng) {
  const game = newGame('versus', rng);
  update(game, 3001); // skips the countdown, the first piece is ready
  return game;
}

// ms until the bot places its next piece
export function botDelay(level) {
  return (1000 / LEVELS[level].pps) * (0.8 + Math.random() * 0.4);
}

// scratch space reused by every move so nothing gets allocated in the hot path
const grid = new Uint8Array(ROWS * COLS); // 1 where there is a block
const gone = new Uint8Array(ROWS); // 1 for rows that would clear
const keptBelow = new Uint8Array(ROWS + 1); // rows left standing from this row down

function fits(shape, x, y) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape.length; c++) {
      if (!shape[r][c]) continue;
      const cx = x + c;
      const cy = y + r;
      if (cx < 0 || cx >= COLS || cy >= ROWS || grid[cy * COLS + cx]) return false;
    }
  }
  return true;
}

// where the piece lands when dropped from startY, -1 if it can't even be placed there
function dropY(shape, x, startY) {
  if (!fits(shape, x, startY)) return -1;
  let y = startY;
  while (fits(shape, x, y + 1)) y++;
  return y;
}

// the usual stacking score: low and flat is good, holes are bad, clearing lines is good
function rate(shape, x, y) {
  const placed = [];
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape.length; c++) {
      if (!shape[r][c]) continue;
      const i = (y + r) * COLS + x + c;
      grid[i] = 1;
      placed.push(i);
    }
  }

  let lines = 0;
  for (let r = 0; r < ROWS; r++) {
    let full = 1;
    for (let c = 0; c < COLS; c++) {
      if (!grid[r * COLS + c]) {
        full = 0;
        break;
      }
    }
    gone[r] = full;
    lines += full;
  }

  keptBelow[ROWS] = 0;
  for (let r = ROWS - 1; r >= 0; r--) keptBelow[r] = keptBelow[r + 1] + (gone[r] ? 0 : 1);

  let total = 0;
  let holes = 0;
  let bumps = 0;
  let last = 0;
  for (let c = 0; c < COLS; c++) {
    let height = 0;
    let seenTop = false;
    for (let r = 0; r < ROWS; r++) {
      if (gone[r]) continue;
      if (grid[r * COLS + c]) {
        if (!seenTop) {
          seenTop = true;
          height = keptBelow[r];
        }
      } else if (seenTop) {
        holes++;
      }
    }
    total += height;
    if (c > 0) bumps += Math.abs(height - last);
    last = height;
  }

  for (const i of placed) grid[i] = 0;
  return -0.51 * total + 0.76 * lines - 0.36 * holes - 0.18 * bumps;
}

// puts the current piece somewhere sensible. false means there was nowhere to put it
export function botMove(game, level) {
  const piece = game.piece;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) grid[y * COLS + x] = game.board[y][x] ? 1 : 0;
  }

  const options = [];
  const rotations = piece.type === 'O' ? 1 : 4;
  for (let rot = 0; rot < rotations; rot++) {
    const shape = SHAPES[piece.type][rot];
    for (let x = -2; x < COLS; x++) {
      const y = dropY(shape, x, piece.y);
      if (y >= 0) options.push({ rot, x, score: rate(shape, x, y) });
    }
  }
  if (options.length === 0) return false;

  options.sort((a, b) => b.score - a.score);
  let pick = options[0];
  if (Math.random() < LEVELS[level].sloppy) {
    pick = options[Math.floor(Math.random() * Math.min(5, options.length))];
  }

  // the engine's hard drop does the rest: lock, clear lines, garbage, attack events
  piece.rot = pick.rot;
  piece.x = pick.x;
  hardDrop(game);
  return true;
}
