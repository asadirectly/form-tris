import { useEffect, useState } from 'react';
import ConfirmButton from './ConfirmButton.jsx';
import { admin } from '../api.js';

function when(time) {
  return new Date(time).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminLogs() {
  const [logs, setLogs] = useState(null);
  const [error, setError] = useState('');

  function load() {
    admin('GET', '/logs')
      .then(setLogs)
      .catch((err) => setError(err.message));
  }
  useEffect(load, []);

  async function resolve(id, action) {
    setError('');
    try {
      await admin('POST', `/transactions/${id}/resolve`, { action });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!logs) return error ? <p className="error">{error}</p> : <p className="loading">LOADING...</p>;

  return (
    <>
      <div className="box">
        <h3 className="box-title">Transactions</h3>
        {error && <p className="error">{error}</p>}
        <p className="fine">
          "unknown" means Formbar never confirmed the payment. Check the player's Digipogs on Formbar, then give the item if they were charged or dismiss it if not.
        </p>
        <ul className="admin-list log">
          {logs.transactions.map((t) => (
            <li key={t.id}>
              <div>
                <span className={`status ${t.status}`}>{t.status}</span> <b>{t.name}</b> · {t.item} · {t.price} DP
                <div className="fine">
                  {when(t.at)}
                  {t.note ? ` · ${t.note}` : ''}
                </div>
              </div>
              {t.status === 'unknown' && (
                <span className="admin-row">
                  <ConfirmButton ask="Give item?" onConfirm={() => resolve(t.id, 'grant')}>
                    Give item
                  </ConfirmButton>
                  <ConfirmButton ask="Dismiss?" onConfirm={() => resolve(t.id, 'dismiss')}>
                    Dismiss
                  </ConfirmButton>
                </span>
              )}
            </li>
          ))}
          {logs.transactions.length === 0 && <li className="fine">Nothing yet.</li>}
        </ul>
      </div>

      <div className="box">
        <h3 className="box-title">Admin actions</h3>
        <ul className="admin-list log">
          {logs.actions.map((a, i) => (
            <li key={i}>
              <div>
                <b>{a.admin}</b> · {a.action}
                {a.target ? ` · player ${a.target}` : ''}
                {a.detail ? ` · ${a.detail}` : ''}
                <div className="fine">{when(a.at)}</div>
              </div>
            </li>
          ))}
          {logs.actions.length === 0 && <li className="fine">Nothing yet.</li>}
        </ul>
      </div>
    </>
  );
}
