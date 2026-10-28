import { COLS, ROWS, HIDDEN, CELL, COLORS, SHAPES } from './constants.js';
import { getGhostY, fallProgress } from './engine.js';
import { drawEffects } from './effects.js';

export function drawCell(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y + 1, size - 2, size - 2);

  // light edge on top and left, dark edge on bottom and right
  const edge = Math.max(Math.round(size / 8), 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.fillRect(x + 1, y + 1, size - 2, edge);
  ctx.fillRect(x + 1, y + 1, edge, size - 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(x + 1, y + size - 1 - edge, size - 2, edge);
  ctx.fillRect(x + size - 1 - edge, y + 1, edge, size - 2);
}

export function drawBoard(ctx, game, fx) {
  ctx.clearRect(0, 0, COLS * CELL, (ROWS - HIDDEN) * CELL);

  for (let y = HIDDEN; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const type = game.board[y][x];
      if (type) drawCell(ctx, x * CELL, (y - HIDDEN) * CELL, CELL, COLORS[type]);
    }
  }

  const p = game.piece;
  if (p && game.state === 'playing') {
    const shape = SHAPES[p.type][p.rot];
    const ghostY = getGhostY(game);

    // ghost is just an outline of where the piece will land
    ctx.strokeStyle = COLORS[p.type];
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 2;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape.length; c++) {
        if (!shape[r][c]) continue;
        ctx.strokeRect((p.x + c) * CELL + 2, (ghostY + r - HIDDEN) * CELL + 2, CELL - 4, CELL - 4);
      }
    }
    ctx.globalAlpha = 1;

    // slide the piece part of a row down so the fall looks smooth (logic still moves whole rows)
    const slide = fallProgress(game) * CELL;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape.length; c++) {
        if (shape[r][c]) drawCell(ctx, (p.x + c) * CELL, (p.y + r - HIDDEN) * CELL + slide, CELL, COLORS[p.type]);
      }
    }
  }

  drawEffects(ctx, fx);
}

// draws one piece centered in a small canvas, for the next and hold boxes
export function drawPreview(ctx, type, width, height) {
  ctx.clearRect(0, 0, width, height);
  if (!type) return;

  const shape = SHAPES[type][0];
  const size = 22;

  // find the filled area so the piece can be centered
  let minR = 9, maxR = 0, minC = 9, maxC = 0;
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape.length; c++) {
      if (!shape[r][c]) continue;
      minR = Math.min(minR, r);
      maxR = Math.max(maxR, r);
      minC = Math.min(minC, c);
      maxC = Math.max(maxC, c);
    }
  }
  const offsetX = (width - (maxC - minC + 1) * size) / 2;
  const offsetY = (height - (maxR - minR + 1) * size) / 2;

  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      if (shape[r][c]) drawCell(ctx, offsetX + (c - minC) * size, offsetY + (r - minR) * size, size, COLORS[type]);
    }
  }
}
