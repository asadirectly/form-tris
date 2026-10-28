import {
  COLS, ROWS, HIDDEN, LOCK_DELAY, MAX_RESETS, SOFT_DROP, SOFT_DROP_MIN_MS, SPRINT_LINES,
  PIECE_TYPES, SHAPES, KICKS, KICKS_I,
} from './constants.js';

const LINE_POINTS = [0, 100, 300, 500, 800];
const TSPIN_POINTS = [400, 800, 1200, 1600];
const MINI_POINTS = [100, 200, 400];
const PERFECT_POINTS = [0, 800, 1200, 1800, 2000];
const LINE_NAMES = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'TETRIS'];

function emptyRow() {
  return new Array(COLS).fill(null);
}

export function newGame(mode) {
  const board = [];
  for (let y = 0; y < ROWS; y++) board.push(emptyRow());

  const game = {
    mode,
    state: 'countdown', // countdown -> playing -> over
    countdown: 3000,
    count: 3,
    board,
    piece: null,
    queue: [],
    hold: null,
    canHold: true,
    score: 0,
    lines: 0,
    level: 1,
    combo: -1,
    b2b: false,
    time: 0,
    won: false,
    softDrop: false,
    fallTimer: 0,
    lockTimer: 0,
    lockResets: 0,
    lowestY: 0,
    lastRotate: false,
    lastKick: 0,
    events: [], // the screen reads these to play effects
    dirty: true, // true when the hud needs to update
  };
  fillQueue(game);
  return game;
}

// 7-bag: every piece shows up once before any repeats
function fillQueue(game) {
  while (game.queue.length < 7) {
    const bag = PIECE_TYPES.slice();
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    game.queue.push(...bag);
  }
}

function collides(board, shape, px, py) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape.length; c++) {
      if (!shape[r][c]) continue;
      const x = px + c;
      const y = py + r;
      if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return true;
      if (board[y][x]) return true;
    }
  }
  return false;
}

function isGrounded(game) {
  const p = game.piece;
  return collides(game.board, SHAPES[p.type][p.rot], p.x, p.y + 1);
}

function spawnPiece(game, type) {
  const size = SHAPES[type][0].length;
  game.piece = { type, rot: 0, x: Math.floor((COLS - size) / 2), y: 1 };
  game.fallTimer = 0;
  game.lockTimer = 0;
  game.lockResets = 0;
  game.lowestY = 1;
  game.lastRotate = false;

  // no room to spawn means the stack is too high
  if (collides(game.board, SHAPES[type][0], game.piece.x, game.piece.y)) {
    endGame(game, false);
  }
}

function nextPiece(game) {
  const type = game.queue.shift();
  fillQueue(game);
  spawnPiece(game, type);
}

function endGame(game, won) {
  game.state = 'over';
  game.won = won;
  game.dirty = true;
  game.events.push({ type: 'gameover', won });
}

// seconds per row from the standard guideline curve, level is capped so it stays sane
function gravityMs(level) {
  const l = Math.min(level, 20);
  return Math.max(Math.pow(0.8 - (l - 1) * 0.007, l - 1) * 1000, 0.5);
}

// moving or rotating while on the ground gives a bit more time, but only 15 times
function afterMove(game) {
  const p = game.piece;
  if (p.y > game.lowestY) {
    game.lowestY = p.y;
    game.lockResets = 0;
  }
  if (isGrounded(game) && game.lockResets < MAX_RESETS) {
    game.lockTimer = 0;
    game.lockResets++;
  }
}

function tryDown(game) {
  const p = game.piece;
  if (collides(game.board, SHAPES[p.type][p.rot], p.x, p.y + 1)) return false;
  p.y++;
  game.lastRotate = false;
  if (p.y > game.lowestY) {
    game.lowestY = p.y;
    game.lockResets = 0;
  }
  return true;
}

// ms per row right now. soft drop is faster than gravity but has a speed limit, otherwise at high levels
// it turns into a hard drop (it never goes slower than gravity itself)
function currentInterval(game) {
  const interval = gravityMs(game.level);
  if (!game.softDrop) return interval;
  return Math.min(interval, Math.max(interval / SOFT_DROP, SOFT_DROP_MIN_MS));
}

// how far through its current row the falling piece is, from 0 to just under 1
// only used for drawing, so the piece glides down instead of jumping a whole row at a time
export function fallProgress(game) {
  if (game.state !== 'playing' || !game.piece || isGrounded(game)) return 0;
  return Math.min(game.fallTimer / currentInterval(game), 0.999);
}

export function update(game, dt) {
  if (game.state === 'countdown') {
    game.countdown -= dt;
    const count = Math.max(Math.ceil(game.countdown / 1000), 0);
    if (count !== game.count) {
      game.count = count;
      game.dirty = true;
    }
    if (game.countdown <= 0) {
      game.state = 'playing';
      game.events.push({ type: 'go' });
      nextPiece(game);
    }
    return;
  }
  if (game.state !== 'playing') return;

  game.time += dt;

  if (isGrounded(game)) {
    game.lockTimer += dt;
    if (game.lockTimer >= LOCK_DELAY) lockPiece(game);
    return;
  }
  game.lockTimer = 0;

  const interval = currentInterval(game);

  game.fallTimer += dt;
  // the step limit stops a huge dt from looping for ages at high levels
  let steps = 0;
  while (game.fallTimer >= interval && steps < 25) {
    game.fallTimer -= interval;
    steps++;
    if (!tryDown(game)) break;
    if (game.softDrop) {
      game.score += 1;
      game.dirty = true;
    }
  }
}

export function moveSide(game, dx) {
  if (game.state !== 'playing') return false;
  const p = game.piece;
  if (collides(game.board, SHAPES[p.type][p.rot], p.x + dx, p.y)) return false;
  p.x += dx;
  game.lastRotate = false;
  afterMove(game);
  return true;
}

// dir is 1 for clockwise, -1 for counter clockwise
export function rotate(game, dir) {
  if (game.state !== 'playing') return false;
  const p = game.piece;
  if (p.type === 'O') return false;

  const to = (p.rot + dir + 4) % 4;
  const shape = SHAPES[p.type][to];
  const kicks = (p.type === 'I' ? KICKS_I : KICKS)[`${p.rot}${to}`];

  for (let i = 0; i < kicks.length; i++) {
    const nx = p.x + kicks[i][0];
    const ny = p.y - kicks[i][1]; // the table has y going up, our board goes down
    if (collides(game.board, shape, nx, ny)) continue;

    p.x = nx;
    p.y = ny;
    p.rot = to;
    game.lastRotate = true;
    game.lastKick = i;
    afterMove(game);
    return true;
  }
  return false;
}

export function hardDrop(game) {
  if (game.state !== 'playing') return;
  let dist = 0;
  while (tryDown(game)) dist++;
  game.score += dist * 2;
  game.events.push({ type: 'harddrop', dist });
  lockPiece(game);
}

export function holdPiece(game) {
  if (game.state !== 'playing' || !game.canHold) return;
  const current = game.piece.type;

  if (game.hold) {
    const swap = game.hold;
    game.hold = current;
    spawnPiece(game, swap);
  } else {
    game.hold = current;
    nextPiece(game);
  }
  game.canHold = false;
  game.dirty = true;
}

export function getGhostY(game) {
  const p = game.piece;
  const shape = SHAPES[p.type][p.rot];
  let y = p.y;
  while (!collides(game.board, shape, p.x, y + 1)) y++;
  return y;
}

// 3 corner rule: a t piece that just rotated with 3+ corners blocked is a t-spin
function checkTSpin(game) {
  const p = game.piece;
  if (p.type !== 'T' || !game.lastRotate) return null;

  const blocked = (dx, dy) => {
    const x = p.x + dx;
    const y = p.y + dy;
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return true;
    return game.board[y][x] !== null;
  };

  // corners in order: top left, top right, bottom left, bottom right
  const corners = [blocked(0, 0), blocked(2, 0), blocked(0, 2), blocked(2, 2)];
  let count = 0;
  for (const c of corners) if (c) count++;
  if (count < 3) return null;

  // the two corners on the side the t is pointing at, for each rotation
  const front = [[0, 1], [1, 3], [2, 3], [0, 2]][p.rot];
  const frontBlocked = corners[front[0]] && corners[front[1]];

  // the last kick always counts as a full t-spin
  if (frontBlocked || game.lastKick === 4) return 'tspin';
  return 'mini';
}

function lockPiece(game) {
  const p = game.piece;
  const shape = SHAPES[p.type][p.rot];
  const tspin = checkTSpin(game);

  const cells = [];
  let allHidden = true;
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape.length; c++) {
      if (!shape[r][c]) continue;
      game.board[p.y + r][p.x + c] = p.type;
      cells.push({ x: p.x + c, y: p.y + r });
      if (p.y + r >= HIDDEN) allHidden = false;
    }
  }
  game.events.push({ type: 'lock', cells });

  const cleared = clearLines(game, tspin);
  game.dirty = true;
  if (game.state === 'over') return; // that was the 40th line

  // locking completely above the visible board is also game over
  if (allHidden && cleared === 0) {
    endGame(game, false);
    return;
  }

  game.canHold = true;
  nextPiece(game);
}

function clearLines(game, tspin) {
  const full = [];
  for (let y = 0; y < ROWS; y++) {
    if (game.board[y].every((cell) => cell !== null)) full.push(y);
  }
  const n = full.length;

  // copy the colors first, the effects need them after the rows are gone
  const rowColors = full.map((y) => game.board[y].slice());

  // take the full rows out and put empty ones on top
  for (const y of full) {
    game.board.splice(y, 1);
    game.board.unshift(emptyRow());
  }

  if (n === 0 && !tspin) {
    game.combo = -1;
    return 0;
  }

  let points = LINE_POINTS[n];
  let name = LINE_NAMES[n];
  if (tspin === 'tspin') {
    points = TSPIN_POINTS[n];
    name = n === 0 ? 'T-SPIN' : `T-SPIN ${LINE_NAMES[n]}`;
  } else if (tspin === 'mini') {
    points = MINI_POINTS[n];
    name = n === 0 ? 'T-SPIN MINI' : `T-SPIN MINI ${LINE_NAMES[n]}`;
  }

  // tetrises and t-spin clears are "hard", doing two in a row gives a bonus
  let b2b = false;
  if (n > 0) {
    if (n === 4 || tspin) {
      if (game.b2b) {
        points = Math.floor(points * 1.5);
        b2b = true;
      }
      game.b2b = true;
    } else {
      game.b2b = false;
    }
    game.combo++;
  } else {
    game.combo = -1;
  }

  let total = points * game.level;
  if (game.combo > 0) total += 50 * game.combo * game.level;

  const perfect = game.board.every((row) => row.every((cell) => cell === null));
  if (perfect && n > 0) total += PERFECT_POINTS[n] * game.level;

  game.score += total;
  game.lines += n;

  game.events.push({
    type: 'clear',
    rows: full,
    rowColors,
    name,
    combo: game.combo,
    b2b,
    perfect: perfect && n > 0,
  });

  if (game.mode === 'normal') {
    const newLevel = Math.floor(game.lines / 10) + 1;
    if (newLevel > game.level) {
      game.level = newLevel;
      game.events.push({ type: 'levelup', level: newLevel });
    }
  } else if (game.lines >= SPRINT_LINES) {
    endGame(game, true);
  }

  return n;
}
