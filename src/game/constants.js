export const COLS = 10;
export const ROWS = 22; // the top 2 rows are hidden spawn space
export const HIDDEN = 2;
export const CELL = 30;

export const LOCK_DELAY = 500;
export const MAX_RESETS = 15;
export const DAS = 150; // ms before a held left/right starts repeating
export const ARR = 40; // ms between repeats
export const SOFT_DROP = 8; // soft drop is this many times faster than gravity
export const SOFT_DROP_MIN_MS = 60; // but never faster than one row per this many ms (raise it to slow soft drop down more)
export const SPRINT_LINES = 40;

// multiplayer lobbies, the server enforces these limits and the lobby screens read them
export const MIN_PLAYERS = 2;
export const LOBBY_KINDS = {
  standard: { name: 'Standard', max: 32, blurb: 'Classic versus. Garbage, targeting and last one standing.' },
  royale: { name: 'Battle Royale', max: 99, blurb: 'Up to 99 players. KOs make your attacks stronger.' },
};

export const MODES = {
  normal: { name: 'Normal', blurb: 'Endless. Clear lines, progressive diffulty, blah blah blah' },
  sprint: { name: '40L', blurb: 'Clear 40 lines as fast as you can' },
};

// the multiplayer bar on the menu, it opens the lobbies instead of starting a round
export const MULTI = { name: 'Multiplayer', blurb: 'Standard (up to 32) or Battle Royale (up to 99). CPUs welcome.' };
export const MENU_MODES = ['normal', 'multi', 'sprint']; // order of the bars on the menu

export const COLORS = {
  G: '#71717a', // garbage
  I: '#22d3ee',
  O: '#facc15',
  T: '#a855f7',
  S: '#4ade80',
  Z: '#ef4444',
  J: '#3b82f6',
  L: '#fb923c',
};

export const PIECE_TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

const baseShapes = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
  J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
};

// turns a square grid 90 degrees clockwise
function rotateGrid(grid) {
  const n = grid.length;
  const out = [];
  for (let r = 0; r < n; r++) {
    out.push([]);
    for (let c = 0; c < n; c++) {
      out[r].push(grid[n - 1 - c][r]);
    }
  }
  return out;
}

// SHAPES.T[2] is the t piece rotated twice, worked out once up front
export const SHAPES = {};
for (const type of PIECE_TYPES) {
  SHAPES[type] = [baseShapes[type]];
  for (let i = 1; i < 4; i++) {
    SHAPES[type].push(rotateGrid(SHAPES[type][i - 1]));
  }
}

// wall kick tests from the standard rotation system, written as [x, y] with y going up
// the key is "from rotation" + "to rotation"
export const KICKS = {
  '01': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '10': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '12': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '21': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '23': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '32': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '30': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '03': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
};

export const KICKS_I = {
  '01': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '10': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '12': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  '21': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '23': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '32': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '30': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '03': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
};
