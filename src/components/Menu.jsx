import Logo from './Logo.jsx';
import Keys from './Keys.jsx';
import { MODES, MENU_MODES, MULTI, MIN_PLAYERS, LOBBY_KINDS } from '../game/constants.js';
import { getBest } from '../format.js';
import PlayerLink, { Avatar, Badges } from './PlayerLink.jsx';

const planned = [
  { name: 'Shop', blurb: 'Themes, cosmetics, etc.', color: 'yellow' },
  { name: 'Settings', blurb: 'Dark mode, light mode, maybe keybinds.', color: 'green' },
  { name: 'Puyo Puyo', blurb: 'A new game mode.', color: 'purple' },
  { name: 'Block Blast', blurb: 'Another new game mode.', color: 'cyan' },
];

const places = ['1st', '2nd', '3rd'];

// the texture strip on the end of each mode bar
const art = { normal: '/img/Pattern01.png', multi: '/img/Pattern03.png', sprint: '/img/Pattern02.png' };

export default function Menu({ user, error, onPlay, onMulti, onLeaderboard, onPlayers, onProfile, onLogout }) {
  let cost = 'FREE';
  if (!user.playsFree) {
    cost = `${user.roundCost} Digipogs`;
    if (user.discount > 0) cost += ` (${user.discount}% off)`;
  }

  return (
    <div className="menu">
      <header className="topbar">
        <Logo small />
        <div className="user">
          <Badges ids={user.badges} />
          <PlayerLink id={user.id} name={user.name} onProfile={onProfile} className="username" />
          <button className="btn small ghost" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>

      <section className="play-col">
        <h2 className="heading">Pick a mode</h2>
        {error && <p className="error">{error}</p>}

        {MENU_MODES.map((mode, i) => {
          // multiplayer opens the lobbies instead of starting a round
          const multi = mode === 'multi';
          const info = multi ? MULTI : MODES[mode];
          return (
            <button key={mode} className={`mode-bar ${mode}`} style={{ '--i': i, '--art': `url(${art[mode]})` }} onClick={() => (multi ? onMulti() : onPlay(mode))}>
              <span className="mode-skew" />
              <span className="mode-body">
                <span className="mode-name">{info.name}</span>
                <span className="mode-blurb">{info.blurb}</span>
                <span className="mode-foot">
                  <span className="tag">{multi ? 'FREE' : cost}</span>
                  <span className="mode-best">{multi ? `${MIN_PLAYERS}-${LOBBY_KINDS.royale.max} players` : `Best ${getBest(mode) || '--'}`}</span>
                </span>
              </span>
              <span className="mode-go">Play</span>
            </button>
          );
        })}
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
          <h2 className="box-title">Leaderboards</h2>
          <ul className="perks">
            {user.discounts.map((percent, i) => (
              <li key={i}>
                <span>{places[i]} place</span>
                <b>{percent}% off</b>
              </li>
            ))}
          </ul>
          <button className="btn small ghost perks-btn" onClick={onLeaderboard}>
            View rankings
          </button>
        </div>

        <div className="box profile-box">
          <h2 className="box-title">Profile</h2>
          <div className="me-row">
            <Avatar picture={user.picture} size={48} />
            <div>
              <PlayerLink id={user.id} name={user.name} onProfile={onProfile} className="me-name" />
              <div className="me-badges">
                <Badges ids={user.badges} />
              </div>
            </div>
          </div>
          <div className="profile-btns">
            <button className="btn small ghost" onClick={() => onProfile(user.id)}>
              My profile
            </button>
            <button className="btn small ghost" onClick={onPlayers}>
              Find players
            </button>
          </div>
        </div>

        <div className="box">
          <h2 className="box-title">Controls</h2>
          <Keys />
        </div>
      </aside>
    </div>
  );
}
