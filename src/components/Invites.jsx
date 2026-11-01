import { useEffect, useState } from 'react';
import { LOBBY_KINDS } from '../game/constants.js';

// lobby invitations from other players. accepting opens the normal entry box, so the fee is confirmed there
export default function Invites({ invites, user, busy, onAccept, onDecline, onExpire }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (invites.length === 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [invites.length]);

  // an invite that ran out disappears by itself
  useEffect(() => {
    for (const inv of invites) if (inv.expires <= now) onExpire(inv.id);
  }, [now, invites]);

  if (invites.length === 0) return null;

  return (
    <div className="invites" aria-live="polite">
      {invites.slice(0, 3).map((inv) => {
        const secs = Math.max(0, Math.round((inv.expires - now) / 1000));
        const lobby = inv.lobby;
        const fee = user.playsFree ? 'free' : `${user.multiCost} Digipogs`;
        return (
          <div key={inv.id} className="invite-card">
            <h3>Lobby invite</h3>
            <p>
              <b>{inv.from.name}</b> invited you to {lobby ? <b>{lobby.name}</b> : 'a lobby'}
            </p>
            {lobby && (
              <p className="fine">
                {LOBBY_KINDS[lobby.kind].name}
                {lobby.kind === 'rush' ? `, first to ${lobby.lines} lines` : ''} · {lobby.players}/{lobby.max} players
                {lobby.isPrivate ? ' · private' : ''}
              </p>
            )}
            <p className="fine">
              Entry fee: {fee}, you confirm it before paying. Expires in {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}
            </p>
            <div className="modal-buttons">
              <button type="button" className="btn small ghost" onClick={() => onDecline(inv.id)}>
                Decline
              </button>
              <button type="button" className="btn small" disabled={busy} title={busy ? 'Finish your round first' : ''} onClick={() => onAccept(inv.id)}>
                Accept
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
