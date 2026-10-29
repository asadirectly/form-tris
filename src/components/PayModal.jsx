import { useEffect, useState } from 'react';
import { MODES } from '../game/constants.js';

export default function PayModal({ mode, cost, discount, onPay, onCancel }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // one id per attempt, so a retry can never charge twice
  const [requestId] = useState(() => crypto.randomUUID());

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
      await onPay(pin, requestId);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="modal-back">
      <form className={`modal ${mode}`} onSubmit={submit}>
        <h2 className="modal-head">{MODES[mode].name}</h2>
        <div className="modal-body">
          <p>
            This round costs <strong>{cost} Digipogs</strong>
            {discount > 0 && ` (${discount}% off)`}. Enter your Formbar PIN to pay.
          </p>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            placeholder="PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />
          {error && <p className="error shake-once">{error}</p>}
          <div className="modal-buttons">
            <button type="button" className="btn ghost" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn" disabled={busy || pin === ''}>
              {busy ? 'Paying...' : `Pay ${cost} and play`}
            </button>
          </div>
          <p className="fine">Your PIN is only sent to Formbar to approve this payment. It is never saved.</p>
        </div>
      </form>
    </div>
  );
}
