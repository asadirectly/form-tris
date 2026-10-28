import { COLS, HIDDEN, CELL, COLORS } from './constants.js';

// the spark streaks from the asset pack, loaded once
const sparkImages = [];
for (let i = 1; i <= 9; i++) {
  const img = new Image();
  img.src = `/fx/Fx_clean0${i}.png`;
  sparkImages.push(img);
}

const FLASH_TIME = 350;
const SPARK_TIME = 450;
const LOCK_TIME = 150;

export function makeEffects() {
  return { particles: [], flashes: [], sparks: [], locks: [] };
}

export function addLockFlash(fx, cells) {
  for (const cell of cells) fx.locks.push({ x: cell.x, y: cell.y, age: 0 });
}

export function addClearEffects(fx, event) {
  const extra = event.rows.length; // bigger clears throw more particles

  for (let i = 0; i < event.rows.length; i++) {
    const y = event.rows[i];
    fx.flashes.push({ y, age: 0 });
    fx.sparks.push({ y, age: 0, img: sparkImages[Math.floor(Math.random() * 9)] });

    for (let x = 0; x < COLS; x++) {
      const color = COLORS[event.rowColors[i][x]];
      for (let k = 0; k < 2 + extra; k++) {
        fx.particles.push({
          x: x * CELL + CELL / 2,
          y: (y - HIDDEN) * CELL + CELL / 2,
          vx: (Math.random() - 0.5) * 420,
          vy: -Math.random() * 380,
          age: 0,
          max: 500 + Math.random() * 500,
          size: 3 + Math.random() * 4,
          color,
        });
      }
    }
  }
}

function ageList(list, dt, max) {
  for (let i = list.length - 1; i >= 0; i--) {
    list[i].age += dt;
    if (list[i].age >= max) list.splice(i, 1);
  }
}

export function updateEffects(fx, dt) {
  ageList(fx.flashes, dt, FLASH_TIME);
  ageList(fx.sparks, dt, SPARK_TIME);
  ageList(fx.locks, dt, LOCK_TIME);

  const sec = dt / 1000;
  for (let i = fx.particles.length - 1; i >= 0; i--) {
    const p = fx.particles[i];
    p.age += dt;
    if (p.age >= p.max) {
      fx.particles.splice(i, 1);
      continue;
    }
    p.vy += 900 * sec; // gravity
    p.x += p.vx * sec;
    p.y += p.vy * sec;
  }
}

export function drawEffects(ctx, fx) {
  for (const l of fx.locks) {
    ctx.fillStyle = `rgba(255, 255, 255, ${0.7 * (1 - l.age / LOCK_TIME)})`;
    ctx.fillRect(l.x * CELL, (l.y - HIDDEN) * CELL, CELL, CELL);
  }

  for (const f of fx.flashes) {
    ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * (1 - f.age / FLASH_TIME)})`;
    ctx.fillRect(0, (f.y - HIDDEN) * CELL, COLS * CELL, CELL);
  }

  // each spark flies across its row from left to right
  for (const s of fx.sparks) {
    const t = s.age / SPARK_TIME;
    const x = -147 + t * (COLS * CELL + 147);
    ctx.globalAlpha = 1 - t * t;
    ctx.drawImage(s.img, x, (s.y - HIDDEN) * CELL + CELL / 2 - 17);
  }

  for (const p of fx.particles) {
    ctx.globalAlpha = 1 - p.age / p.max;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}
