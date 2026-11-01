import { getActiveKeys } from '../game/keys.js';

// on-screen buttons for phones, they send the same key events the keyboard does (using whatever keys the player set)
const buttons = [
  { label: 'Left', action: 'left', hold: true },
  { label: 'Down', action: 'softDrop', hold: true },
  { label: 'Right', action: 'right', hold: true },
  { label: 'Hold', action: 'hold' },
  { label: 'Rot back', action: 'rotateCcw' },
  { label: 'Rotate', action: 'rotateCw' },
  { label: 'Drop', action: 'hardDrop' },
];

function press(code) {
  window.dispatchEvent(new KeyboardEvent('keydown', { code }));
}

function release(code) {
  window.dispatchEvent(new KeyboardEvent('keyup', { code }));
}

export default function TouchPad() {
  return (
    <div className="touchpad">
      {buttons.map((b) => (
        <button
          key={b.action}
          className={`pad ${b.hold ? 'move' : 'act'}`}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            press(getActiveKeys()[b.action][0]);
          }}
          onPointerUp={() => release(getActiveKeys()[b.action][0])}
          onPointerCancel={() => release(getActiveKeys()[b.action][0])}
          onContextMenu={(e) => e.preventDefault()}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}
