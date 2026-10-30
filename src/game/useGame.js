import { useEffect, useRef, useState } from 'react';
import { DAS, ARR } from './constants.js';
import { newGame, update, moveSide, rotate, hardDrop, holdPiece } from './engine.js';
import { drawBoard } from './draw.js';
import { makeEffects, updateEffects, addClearEffects, addLockFlash } from './effects.js';
import { submitScore } from '../api.js';
import { encodeBoard, seededRandom } from './versus.js';

// keys the page shouldn't react to (arrows and space scroll the page)
const gameKeys = ['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'Space'];

function saveBest(game) {
  const sprint = game.mode === 'sprint';
  if (sprint && !game.won) return null;

  const key = `formtris-best-${game.mode}`;
  const value = sprint ? game.time : game.score;
  try {
    const old = Number(localStorage.getItem(key)) || 0;
    const isNew = old === 0 || (sprint ? value < old : value > old);
    if (isNew) localStorage.setItem(key, String(value));
    return { best: isNew ? value : old, isNew };
  } catch {
    return null;
  }
}

// versus is only given in multiplayer: { socket, seed }. there is no pausing in a live match
export function useGame(mode, roundId, onScore, versus) {
  const canvasRef = useRef(null);
  const boxRef = useRef(null);
  const gameRef = useRef(null);
  const pausedRef = useRef(false);
  const popupId = useRef(0);

  const [hud, setHud] = useState({
    score: 0, lines: 0, level: 1, next: [], hold: null, canHold: true, count: 3, state: 'countdown', combo: -1, b2b: false,
    incoming: 0,
  });
  const [popups, setPopups] = useState([]);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState(null);

  function togglePause() {
    const game = gameRef.current;
    if (!game || game.state !== 'playing' || versus) return;
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
  }

  function removePopup(id) {
    setPopups((list) => list.filter((p) => p.id !== id));
  }

  function getTime() {
    return gameRef.current ? gameRef.current.time : 0;
  }

  useEffect(() => {
    const game = newGame(mode, versus ? seededRandom(versus.seed) : undefined);
    const fx = makeEffects();
    const ctx = canvasRef.current.getContext('2d');
    const input = { dir: 0, das: 0, arr: 0, left: false, right: false };
    const clears = { tspins: 0, tetrises: 0, perfects: 0, combo: 0 };
    gameRef.current = game;
    pausedRef.current = false;

    function addPopup(text, kind) {
      popupId.current++;
      const popup = { id: popupId.current, text, kind };
      setPopups((list) => [...list.slice(-3), popup]);
    }

    function shake(kind) {
      const el = boxRef.current;
      el.classList.remove('shake-small', 'shake-big');
      void el.offsetWidth; // reading this forces a reflow so the animation can restart
      el.classList.add(kind);
    }

    function syncHud() {
      game.dirty = false;
      setHud({
        score: game.score,
        lines: game.lines,
        level: game.level,
        next: game.queue.slice(0, 5),
        hold: game.hold,
        canHold: game.canHold,
        count: game.count,
        state: game.state,
        combo: game.combo,
        b2b: game.b2b,
        incoming: game.incoming,
      });
    }

    function handleClear(e) {
      addClearEffects(fx, e);

      // counted for the profile, the server checks them against the lines before it believes them
      if (e.name === 'TETRIS') clears.tetrises++;
      if (e.name.startsWith('T-SPIN') && e.rows.length > 0) clears.tspins++;
      if (e.perfect) clears.perfects++;
      clears.combo = Math.max(clears.combo, e.combo);

      let kind = 'clear';
      if (e.name === 'TETRIS') kind = 'tetris';
      else if (e.name.startsWith('T-SPIN')) kind = 'tspin';

      if (e.name) addPopup(e.name, kind);
      if (e.b2b) addPopup('BACK-TO-BACK', 'b2b');
      if (e.combo >= 1) addPopup(`COMBO x${e.combo}`, 'combo');
      if (e.perfect) addPopup('PERFECT CLEAR', 'perfect');

      shake(kind === 'clear' && e.rows.length < 3 ? 'shake-small' : 'shake-big');
    }

    function handleEvents() {
      // splice(0) hands back everything and empties the list
      for (const e of game.events.splice(0)) {
        if (e.type === 'lock' || e.type === 'garbage') boardChanged = true;
        if (e.type === 'lock') addLockFlash(fx, e.cells);
        else if (e.type === 'harddrop' && e.dist > 0) shake('shake-small');
        else if (e.type === 'clear') handleClear(e);
        else if (e.type === 'levelup') addPopup(`LEVEL ${e.level}`, 'level');
        else if (e.type === 'go') addPopup('GO!', 'go');
        else if (e.type === 'attack') versus.socket.send({ type: 'attack', lines: e.lines });
        else if (e.type === 'garbage') shake('shake-big');
        else if (e.type === 'gameover' && versus) {
          versus.socket.send({ type: 'dead' });
          setResult({ won: false, score: game.score, lines: game.lines, level: game.level, time: game.time });
        } else if (e.type === 'gameover') {
          const best = saveBest(game);
          setResult({ won: e.won, score: game.score, lines: game.lines, level: game.level, time: game.time, best });

          // every finished round goes to the server, it decides what counts for the leaderboard and the profile
          const stats = { score: game.score, lines: game.lines, level: game.level, time: Math.round(game.time), won: e.won, ...clears };
          submitScore(roundId, stats)
            .then((saved) => {
              setResult((r) => ({ ...r, rank: saved.rank }));
              onScore(saved); // the player's discount may have changed, and they may have unlocked something
            })
            .catch((err) => setResult((r) => ({ ...r, rankError: err.message })));
        }
      }
    }

    // left and right repeat on their own after a short delay
    function runHeldKeys(dt) {
      if (input.dir === 0) return;
      input.das += dt;
      if (input.das < DAS) return;

      input.arr += dt;
      while (input.arr >= ARR) {
        moveSide(game, input.dir);
        input.arr -= ARR;
      }
    }

    function pressSide(dir) {
      input.dir = dir;
      input.das = 0;
      input.arr = 0;
      moveSide(game, dir);
    }

    function onKeyDown(e) {
      if (gameKeys.includes(e.code)) e.preventDefault();
      if (e.repeat) return;

      if (e.code === 'Escape' || e.code === 'KeyP') {
        togglePause();
        return;
      }
      if (pausedRef.current) return;

      if (e.code === 'ArrowLeft') {
        input.left = true;
        pressSide(-1);
      } else if (e.code === 'ArrowRight') {
        input.right = true;
        pressSide(1);
      } else if (e.code === 'ArrowDown') {
        game.softDrop = true;
      } else if (e.code === 'ArrowUp' || e.code === 'KeyX') {
        rotate(game, 1);
      } else if (e.code === 'KeyZ' || e.code === 'ControlLeft') {
        rotate(game, -1);
      } else if (e.code === 'Space') {
        hardDrop(game);
      } else if (e.code === 'KeyC' || e.code === 'ShiftLeft') {
        holdPiece(game);
      }
    }

    function onKeyUp(e) {
      if (e.code === 'ArrowLeft') {
        input.left = false;
        // fall back to the other direction if it's still held
        if (input.dir === -1) input.dir = input.right ? 1 : 0;
      } else if (e.code === 'ArrowRight') {
        input.right = false;
        if (input.dir === 1) input.dir = input.left ? -1 : 0;
      } else if (e.code === 'ArrowDown') {
        game.softDrop = false;
      }
    }

    // alt-tabbing away pauses so you don't lose a game in the background
    function onBlur() {
      if (!pausedRef.current) togglePause();
    }

    // in multiplayer the server needs to know about every new board, and what the other players send us
    let boardChanged = false;
    let lastBoardSend = 0;
    const stopListening = [];
    if (versus) {
      stopListening.push(
        versus.socket.on('garbage', (m) => {
          game.incoming += m.lines;
          game.dirty = true;
        }),
        versus.socket.on('ko', (m) => {
          game.incoming = Math.max(0, game.incoming - m.cancel);
          game.dirty = true;
        })
      );
    }

    let last = performance.now();
    let rafId;

    function frame(now) {
      const dt = Math.min(now - last, 100);
      last = now;

      if (!pausedRef.current) {
        runHeldKeys(dt);
        update(game, dt);
        handleEvents();
        if (versus && boardChanged && now - lastBoardSend >= 250) {
          versus.socket.send({ type: 'board', rows: encodeBoard(game.board) });
          boardChanged = false;
          lastBoardSend = now;
        }
        updateEffects(fx, dt);
        if (game.dirty) syncHud();
      }
      drawBoard(ctx, game, fx);
      rafId = requestAnimationFrame(frame);
    }

    syncHud();
    rafId = requestAnimationFrame(frame);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    return () => {
      cancelAnimationFrame(rafId);
      stopListening.forEach((stop) => stop());
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [mode]);

  return { canvasRef, boxRef, hud, popups, removePopup, paused, togglePause, result, getTime };
}
