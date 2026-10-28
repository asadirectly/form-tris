// [keys, what it does]
const rows = [
  [['←', '→'], 'Move'],
  [['↓'], 'Soft drop'],
  [['↑', 'X'], 'Rotate'],
  [['Z'], 'Rotate back'],
  [['Space'], 'Hard drop'],
  [['C'], 'Hold'],
  [['Esc'], 'Pause'],
];

export default function Keys() {
  return (
    <ul className="keys">
      {rows.map(([keys, action]) => (
        <li key={action}>
          <span className="keycaps">
            {keys.map((k) => (
              <kbd key={k}>{k}</kbd>
            ))}
          </span>
          <span>{action}</span>
        </li>
      ))}
    </ul>
  );
}
