// on-screen buttons for phones, they send the same key events the keyboard does
const buttons = [
  { label: 'Left', code: 'ArrowLeft', hold: true },
  { label: 'Down', code: 'ArrowDown', hold: true },
  { label: 'Right', code: 'ArrowRight', hold: true },
  { label: 'Hold', code: 'KeyC' },
  { label: 'Rot back', code: 'KeyZ' },
  { label: 'Rotate', code: 'ArrowUp' },
  { label: 'Drop', code: 'Space' },
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
          key={b.code}
          className={`pad ${b.hold ? 'move' : 'act'}`}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            press(b.code);
          }}
          onPointerUp={() => release(b.code)}
          onPointerCancel={() => release(b.code)}
          onContextMenu={(e) => e.preventDefault()}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}
