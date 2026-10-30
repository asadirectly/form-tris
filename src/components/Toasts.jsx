// small notifications for unlocked achievements and ranks, each one removes itself when its animation ends
export default function Toasts({ toasts, onDone }) {
  if (toasts.length === 0) return null;

  return (
    <div className="toasts" aria-live="polite">
      {toasts.slice(0, 4).map((t) => (
        <div key={t.key} className="toast" style={{ '--c': `var(--${t.color})`, '--c-dk': `var(--${t.color}-dk)` }} onAnimationEnd={() => onDone(t.key)}>
          <span className="ach-icon">{t.icon}</span>
          <span className="toast-text">
            <small>{t.label}</small>
            <b>{t.name}</b>
          </span>
        </div>
      ))}
    </div>
  );
}
