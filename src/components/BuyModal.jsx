import { useEffect, useState } from 'react';

// asks for the formbar pin and pays for one thing (a shop item or a multiplayer entry). onPay does the actual request
// rows is an optional list of [label, value] lines for the fee breakdown. a price of 0 means nothing is charged, so no pin
export default function BuyModal({ title, text, price, rows, payLabel, onPay, onCancel }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // one id per attempt, so a retry can never charge twice
  const [requestId] = useState(() => crypto.randomUUID());
  const free = price === 0;

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && !busy) onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy]);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await onPay(free ? null : pin, requestId);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="modal-back">
      <form className="modal shop" onSubmit={submit}>
        <h2 className="modal-head">{title}</h2>
        <div className="modal-body">
          {text && <p>{text}</p>}
          {rows && (
            <ul className="fee-rows">
              {rows.map(([label, value, strong]) => (
                <li key={label} className={strong ? 'strong' : ''}>
                  <span>{label}</span>
                  <b>{value}</b>
                </li>
              ))}
            </ul>
          )}
          {!rows && !free && (
            <p>
              It costs <strong>{price} Digipogs</strong>. Enter your Formbar PIN to pay.
            </p>
          )}
          {!free && (
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              placeholder="PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
          )}
          {error && <p className="error shake-once">{error}</p>}
          <div className="modal-buttons">
            <button type="button" className="btn ghost" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn" disabled={busy || (!free && pin === '')}>
              {busy ? 'Paying...' : payLabel || (free ? 'Continue' : `Pay ${price}`)}
            </button>
          </div>
          {!free && <p className="fine">Your PIN is only sent to Formbar to approve this payment. It is never saved.</p>}
        </div>
      </form>
    </div>
  );
}
