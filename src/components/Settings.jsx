import { useEffect, useState } from 'react';
import { getProfile, chooseRanks, equipPicture, saveSettings } from '../api.js';
import { ACTIONS, DEFAULT_KEYS, KEYS_PER_ACTION, keyLabel, isBindable, cleanKeys, setActiveKeys } from '../game/keys.js';
import Logo from './Logo.jsx';
import { TitlePicker, PicturePicker } from './Pickers.jsx';

const tabs = [
  { id: 'controls', name: 'Controls' },
  { id: 'ranks', name: 'Ranks' },
  { id: 'pictures', name: 'Pictures' },
  { id: 'cosmetics', name: 'Cosmetics' },
];

// every setting saves the moment it changes, there is no save button
export default function Settings({ user, onBack, onChanged, onShop, onProfile }) {
  const [tab, setTab] = useState('controls');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  async function save(settings) {
    setError('');
    try {
      await saveSettings(settings);
      setStatus('Saved');
      onChanged();
    } catch (err) {
      setError(err.message);
      setStatus('');
    }
  }

  useEffect(() => {
    if (status !== 'Saved') return;
    const id = setTimeout(() => setStatus(''), 1800);
    return () => clearTimeout(id);
  }, [status]);

  return (
    <div className="menu">
      <header className="topbar">
        <Logo small />
        <div className="user">
          <span className="save-note" aria-live="polite">
            {status}
          </span>
          <button className="btn small ghost" onClick={onBack}>
            Back
          </button>
        </div>
      </header>

      <section className="play-col settings">
        <h2 className="heading">Settings</h2>

        <div className="settings-body">
          <nav className="settings-nav" aria-label="Settings sections">
            {tabs.map((t) => (
              <button key={t.id} type="button" className={tab === t.id ? 'tab on' : 'tab'} onClick={() => setTab(t.id)}>
                {t.name}
              </button>
            ))}
            <button type="button" className="tab" onClick={() => onProfile(user.id)}>
              My profile
            </button>
          </nav>

          <div className="box settings-pane">
            {tab === 'controls' && <Controls user={user} save={save} />}
            {tab === 'ranks' && <Ranks user={user} onChanged={onChanged} setStatus={setStatus} setError={setError} />}
            {tab === 'pictures' && <Pictures user={user} onChanged={onChanged} setStatus={setStatus} setError={setError} />}
            {tab === 'cosmetics' && <Cosmetics user={user} save={save} onShop={onShop} />}
            {error && <p className="error">{error}</p>}
          </div>
        </div>
      </section>
    </div>
  );
}

function Controls({ user, save }) {
  const [keys, setKeys] = useState(() => cleanKeys(user.settings.keys) || DEFAULT_KEYS);
  const [listening, setListening] = useState(null); // { action, slot } while waiting for a key press
  const [message, setMessage] = useState('');

  // applies the keys to the game right away and saves them
  function change(next) {
    setKeys(next);
    setActiveKeys(next);
    save({ keys: next });
  }

  function labelOf(code) {
    for (const a of ACTIONS) if (keys[a.id].includes(code)) return a.label;
    return '';
  }

  useEffect(() => {
    if (!listening) return;

    function onKey(e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') {
        setListening(null);
        setMessage('');
        return;
      }
      if (!isBindable(e.code)) {
        setMessage(`${keyLabel(e.code)} can't be used as a key`);
        return;
      }
      const owner = labelOf(e.code);
      const current = keys[listening.action][listening.slot];
      if (e.code === current) {
        setListening(null);
        return;
      }
      if (owner) {
        setMessage(`${keyLabel(e.code)} is already used for "${owner}". Change that one first.`);
        return;
      }
      const list = [...keys[listening.action]];
      list[listening.slot] = e.code;
      setMessage('');
      setListening(null);
      change({ ...keys, [listening.action]: list });
    }

    // capture phase, so the game never sees this key press
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [listening, keys]);

  function clearSecond(action) {
    change({ ...keys, [action]: [keys[action][0]] });
  }

  function restore() {
    setKeys(DEFAULT_KEYS);
    setActiveKeys(DEFAULT_KEYS);
    setListening(null);
    setMessage('');
    save({ keys: null });
  }

  return (
    <>
      <h2 className="box-title">Controls</h2>
      <p className="fine">Click a key, then press the new one. Esc cancels. A key can only do one thing. Changes work in your next piece, no restart.</p>
      <ul className="bind-list">
        {ACTIONS.map((a) => (
          <li key={a.id}>
            <span className="bind-name">{a.label}</span>
            <span className="bind-keys">
              {Array.from({ length: KEYS_PER_ACTION }, (_, slot) => {
                const code = keys[a.id][slot];
                const waiting = listening && listening.action === a.id && listening.slot === slot;
                if (!code && !waiting && slot > keys[a.id].length) return null;
                return (
                  <button
                    key={slot}
                    type="button"
                    className={waiting ? 'keycap waiting' : code ? 'keycap' : 'keycap empty'}
                    onClick={() => {
                      setMessage('');
                      setListening({ action: a.id, slot });
                    }}
                  >
                    {waiting ? 'Press a key' : code ? keyLabel(code) : 'Add'}
                  </button>
                );
              })}
              {keys[a.id].length > 1 && (
                <button type="button" className="btn small ghost" onClick={() => clearSecond(a.id)} aria-label={`Remove the second key for ${a.label}`}>
                  Clear
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
      {message && <p className="error" role="alert">{message}</p>}
      <button type="button" className="btn small ghost" onClick={restore}>
        Restore defaults
      </button>
    </>
  );
}

// loads the player's own profile, it has the lists of what they own
function useMine(user) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');

  function load() {
    return getProfile(user.id)
      .then(setProfile)
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    load();
  }, []);

  return { profile, error, load };
}

function Ranks({ user, onChanged, setStatus, setError }) {
  const { profile, error, load } = useMine(user);

  async function change(next) {
    setError('');
    try {
      await chooseRanks(next);
      setStatus('Saved');
      await load();
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  function toggle(titleId) {
    const shown = profile.mine.titles;
    change(shown.includes(titleId) ? shown.filter((t) => t !== titleId) : [...shown, titleId]);
  }

  function move(titleId, step) {
    const list = [...profile.mine.titles];
    const from = list.indexOf(titleId);
    const to = from + step;
    if (to < 0 || to >= list.length) return;
    list.splice(from, 1);
    list.splice(to, 0, titleId);
    change(list);
  }

  if (error) return <p className="error">{error}</p>;
  if (!profile) return <p className="loading">LOADING...</p>;
  return (
    <>
      <h2 className="box-title">Ranks</h2>
      <TitlePicker mine={profile.mine} onToggle={toggle} onMove={move} />
    </>
  );
}

function Pictures({ user, onChanged, setStatus, setError }) {
  const { profile, error, load } = useMine(user);

  async function pick(picture) {
    setError('');
    try {
      await equipPicture(picture);
      setStatus('Saved');
      await load();
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (!profile) return <p className="loading">LOADING...</p>;
  return (
    <>
      <h2 className="box-title">Pictures</h2>
      <PicturePicker mine={profile.mine} byAdmin={profile.pictureByAdmin} onPick={pick} />
    </>
  );
}

function Cosmetics({ user, save, onShop }) {
  const [effects, setEffects] = useState(user.settings.effects !== false);

  function toggle(e) {
    const on = e.target.checked;
    setEffects(on);
    document.documentElement.dataset.effects = on ? 'on' : 'off';
    save({ effects: on });
  }

  return (
    <>
      <h2 className="box-title">Cosmetics</h2>
      <label className="check">
        <input type="checkbox" checked={effects} onChange={toggle} />
        <span>Show cosmetic effects (like sparkles) around players</span>
      </label>
      <p className="fine">This only changes what you see. Effects never change how the game plays, and they follow the picture or rank a player has equipped.</p>
      <button type="button" className="btn small" onClick={onShop}>
        Open shop
      </button>
    </>
  );
}
