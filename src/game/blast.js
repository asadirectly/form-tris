export const SIZE = 8;

const COLOR_NAMES = ['cyan', 'yellow', 'purple', 'green', 'red', 'blue', 'orange'];

// every shape is a grid where 1 is a block. pieces can't be turned in this game,
// so the turned versions are added to the list below
const baseShapes = [
  [[1]],
  [[1, 1]],
  [[1, 1, 1]],
  [[1, 1, 1, 1]],
  [[1, 1, 1, 1, 1]],
  [[1, 1], [1, 1]],
  [[1, 1, 1], [1, 1, 1], [1, 1, 1]],
  [[1, 1, 1], [1, 1, 1]],
  [[1, 0], [1, 1]],
  [[1, 0, 0], [1, 0, 0], [1, 1, 1]],
  [[1, 1, 1], [0, 1, 0]],
  [[0, 1, 1], [1, 1, 0]],
  [[1, 1, 0], [0, 1, 1]],
  [[1, 0], [1, 0], [1, 1]],
  [[0, 1], [0, 1], [1, 1]],
];

// turns a grid 90 degrees clockwise (works for grids that aren't square)
function turn(grid) {
  const out = [];
  for (let c = 0; c < grid[0].length; c++) {
    out.push([]);
    for (let r = grid.length - 1; r >= 0; r--) {
      out[c].push(grid[r][c]);
    }
  }
  return out;
}

// each base shape keeps its color, and turned copies that look the same are skipped
export const PIECES = [];
baseShapes.forEach((base, i) => {
  const seen = new Set();
  let grid = base;
  for (let t = 0; t < 4; t++) {
    const key = JSON.stringify(grid);
    if (!seen.has(key)) {
      seen.add(key);
      PIECES.push({ grid, color: COLOR_NAMES[i % COLOR_NAMES.length] });
    }
    grid = turn(grid);
  }
});

export function countBlocks(grid) {
  return grid.flat().filter((cell) => cell === 1).length;
}

// can this piece go with its top left corner at row, col?
export function canPlace(board, grid, row, col) {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (!grid[r][c]) continue;
      const y = row + r;
      const x = col + c;
      if (y < 0 || y >= SIZE || x < 0 || x >= SIZE) return false;
      if (board[y][x]) return false;
    }
  }
  return true;
}

export function fitsAnywhere(board, grid) {
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      if (canPlace(board, grid, row, col)) return true;
    }
  }
  return false;
}

function emptyBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
}

// a copy of the board with the piece on it
function withPiece(board, piece, row, col) {
  const next = board.map((line) => [...line]);
  for (let r = 0; r < piece.grid.length; r++) {
    for (let c = 0; c < piece.grid[r].length; c++) {
      if (piece.grid[r][c]) next[row + r][col + c] = piece.color;
    }
  }
  return next;
}

// every cell in a full row or full column, and how many lines that is
function fullLines(board) {
  const cells = new Map(); // "row,col" -> the cell, so a cell in a row and a column is only counted once
  let lines = 0;

  for (let i = 0; i < SIZE; i++) {
    if (board[i].every((cell) => cell)) {
      lines++;
      for (let c = 0; c < SIZE; c++) cells.set(`${i},${c}`, { row: i, col: c });
    }
    if (board.every((line) => line[i])) {
      lines++;
      for (let r = 0; r < SIZE; r++) cells.set(`${r},${i}`, { row: r, col: i });
    }
  }
  return { lines, cells: [...cells.values()] };
}

// what would clear if the piece went here, used for the preview
export function previewClears(board, piece, row, col) {
  return fullLines(withPiece(board, piece, row, col)).cells;
}

// three new pieces. if nothing can be placed the game is lost, so try a few times to deal at least one that fits
function dealPieces(board) {
  let pieces = [];
  for (let attempt = 0; attempt < 30; attempt++) {
    pieces = [0, 1, 2].map(() => PIECES[Math.floor(Math.random() * PIECES.length)]);
    if (pieces.some((piece) => fitsAnywhere(board, piece.grid))) break;
  }
  return pieces;
}

export function newGame() {
  const board = emptyBoard();
  return {
    board,
    tray: dealPieces(board),
    score: 0,
    lines: 0,
    moves: 0,
    combo: -1, // -1 means no combo, 0 is the first clear, 1 is the second clear in a row and so on
    maxCombo: 0,
    dry: 0, // moves in a row without a clear, 3 of them end the combo
    perfects: 0,
    over: false,
  };
}

// puts tray piece number index down. returns null if it doesn't fit,
// otherwise { game, cleared, lines, perfect } with the new game and what just cleared
export function placePiece(game, index, row, col) {
  const piece = game.tray[index];
  if (!piece || !canPlace(game.board, piece.grid, row, col)) return null;

  let board = withPiece(game.board, piece, row, col);
  const full = fullLines(board);

  // remember the colors for the clear effect, then take the cells off the board
  const cleared = full.cells.map((cell) => ({ ...cell, color: board[cell.row][cell.col] }));
  for (const cell of full.cells) board[cell.row][cell.col] = null;

  const perfect = full.lines > 0 && board.every((line) => line.every((cell) => !cell));

  let combo = game.combo;
  let dry = game.dry + 1;
  if (full.lines > 0) {
    combo++;
    dry = 0;
  } else if (dry >= 3) {
    combo = -1;
  }

  // 1 point per block placed, then a bonus for lines (more lines at once is worth a lot more) and for combos
  let points = countBlocks(piece.grid);
  if (full.lines > 0) points += 10 * full.lines * full.lines + 10 * combo;
  if (perfect) points += 100;

  let tray = game.tray.map((p, i) => (i === index ? null : p));
  if (tray.every((p) => !p)) tray = dealPieces(board);

  const next = {
    board,
    tray,
    score: game.score + points,
    lines: game.lines + full.lines,
    moves: game.moves + 1,
    combo,
    maxCombo: Math.max(game.maxCombo, combo),
    dry,
    perfects: game.perfects + (perfect ? 1 : 0),
    over: !tray.some((p) => p && fitsAnywhere(board, p.grid)),
  };
  return { game: next, cleared, lines: full.lines, perfect };
}
