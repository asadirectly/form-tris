import Logo from './Logo.jsx';
import Keys from './Keys.jsx';
import { MODES } from '../game/constants.js';
import { getBest } from '../format.js';

const planned = [
  { name: 'Multiplayer', blurb: 'Up to 99 players, public &/or private rooms.', color: 'red' },
  { name: 'Leaderboards', blurb: 'Rankings and stats + rewards', color: 'cyan' },
  { name: 'Shop', blurb: 'Themes, cosmetics, etc.', color: 'yellow' },
  { name: 'Settings', blurb: 'Dark mode, light mode, maybe keybinds.', color: 'green' },
  { name: 'Puyo Puyo', blurb: 'A new game mode.', color: 'purple' },
];

// the texture strip on the end of each mode bar
const art = { normal: '/img/Pattern01.png', sprint: '/img/Pattern02.png' };

export default function Menu({ user, error, onPlay, onLogout }) {
  const cost = user.playsFree ? 'FREE' : `${user.roundCost} Digipogs`;

  return (
    <div className="menu">
      <header className="topbar">
        <Logo small />
        <div className="user">
          {user.playsFree && <span className="badge owner">Owner</span>}
          {user.isAdmin && <span className="badge admin">Admin</span>}
          <span className="username">{user.name}</span>
          <button className="btn small ghost" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>

      <section className="play-col">
        <h2 className="heading">Pick a mode</h2>
        {error && <p className="error">{error}</p>}

        {Object.keys(MODES).map((mode, i) => (
          <button key={mode} className={`mode-bar ${mode}`} style={{ '--i': i, '--art': `url(${art[mode]})` }} onClick={() => onPlay(mode)}>
            <span className="mode-skew" />
            <span className="mode-body">
              <span className="mode-name">{MODES[mode].name}</span>
              <span className="mode-blurb">{MODES[mode].blurb}</span>
              <span className="mode-foot">
                <span className="tag">{cost}</span>
                <span className="mode-best">Best {getBest(mode) || '--'}</span>
              </span>
            </span>
            <span className="mode-go">Play</span>
          </button>
        ))}
      </section>

      <aside className="side-col">
        <div className="box">
          <h2 className="box-title">Coming soon</h2>
          <ul className="soon">
            {planned.map((item) => (
              <li key={item.name} style={{ '--c': `var(--${item.color})` }}>
                <b>{item.name}</b>
                <span>{item.blurb}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="box">
          <h2 className="box-title">Controls</h2>
          <Keys />
        </div>
      </aside>
    </div>
  );
}
