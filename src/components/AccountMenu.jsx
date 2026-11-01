import { useEffect, useRef, useState } from 'react';
import { Avatar, Badges } from './PlayerLink.jsx';
import { titlesQuiet } from '../cosmetics.js';

// [equipped ranks] [username] [picture], click it for the account menu. logout is always the last item
export default function AccountMenu({ user, onProfile, onPlayers, onSettings, onAdmin, onLogout }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  // a click anywhere else or Escape closes it
  useEffect(() => {
    if (!open) return;
    function onClick(e) {
      if (box.current && !box.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.code === 'Escape') setOpen(false);
    }
    window.addEventListener('pointerdown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function choose(action) {
    setOpen(false);
    action();
  }

  return (
    <div className="account" ref={box}>
      <button type="button" className={open ? 'identity open' : 'identity'} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Badges ids={user.badges} quiet={titlesQuiet(user.picture)} />
        <span className="username">{user.name}</span>
        <Avatar picture={user.picture} size={32} />
        <span className="caret" aria-hidden="true" />
      </button>

      {open && (
        <ul className="account-menu" role="menu">
          <li>
            <button type="button" role="menuitem" onClick={() => choose(() => onProfile(user.id))}>
              Profile
            </button>
          </li>
          <li>
            <button type="button" role="menuitem" onClick={() => choose(onPlayers)}>
              Players
            </button>
          </li>
          <li>
            <button type="button" role="menuitem" onClick={() => choose(onSettings)}>
              Settings
            </button>
          </li>
          {user.isAdmin && (
            <li>
              <button type="button" role="menuitem" onClick={() => choose(onAdmin)}>
                Admin panel
              </button>
            </li>
          )}
          <li className="last">
            <button type="button" role="menuitem" className="logout" onClick={() => choose(onLogout)}>
              Logout
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
