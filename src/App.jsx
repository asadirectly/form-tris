import { useEffect, useState } from 'react';
import { getMe, startRound, logout } from './api.js';
import Backdrop from './components/Backdrop.jsx';
import LoginScreen from './components/LoginScreen.jsx';
import Menu from './components/Menu.jsx';
import GameScreen from './components/GameScreen.jsx';
import PayModal from './components/PayModal.jsx';
import Leaderboard from './components/Leaderboard.jsx';
import Multiplayer from './components/Multiplayer.jsx';
import Directory from './components/Directory.jsx';
import Profile from './components/Profile.jsx';
import Toasts from './components/Toasts.jsx';
import { ACHIEVEMENTS, RANKS } from './game/achievements.js';

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [round, setRound] = useState(null); // the round the server let us start
  const [payMode, setPayMode] = useState(null); // mode waiting for a pin
  const [menuError, setMenuError] = useState('');
  const [showBoards, setShowBoards] = useState(false);
  const [inMulti, setInMulti] = useState(false);
  const [showPlayers, setShowPlayers] = useState(false);
  const [profileId, setProfileId] = useState(null); // the profile open on top of whatever screen we're on
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  // the price and discount come from the server, so ask again whenever rankings may have changed
  function refreshUser() {
    getMe()
      .then(setUser)
      .catch(() => {});
  }

  // a finished round or match can unlock achievements and ranks, each gets a small notification
  function handleUnlocks(info) {
    refreshUser(); // the player's badges may have changed
    const fresh = [];
    for (const id of info.unlocked || []) {
      const a = ACHIEVEMENTS.find((item) => item.id === id);
      if (a) fresh.push({ key: `a-${id}`, label: 'Achievement unlocked', name: a.name, icon: a.icon, color: a.color });
    }
    const rank = RANKS.find((item) => item.id === info.newRank);
    if (rank) fresh.push({ key: `r-${rank.id}`, label: 'New rank', name: rank.name, icon: 'R', color: rank.color });
    if (fresh.length > 0) setToasts((list) => [...list, ...fresh]);
  }

  // the server decides if the round is allowed and takes the payment
  async function startWith(mode, pin, requestId) {
    try {
      const newRound = await startRound(mode, pin, requestId, user.roundCost);
      setPayMode(null);
      setRound(newRound);
    } catch (err) {
      if (err.status === 401) {
        setUser(null);
        setPayMode(null);
      }
      if (err.status === 409) refreshUser(); // the price changed, show the new one
      throw err;
    }
  }

  function play(mode) {
    setMenuError('');
    if (user.playsFree) {
      startWith(mode, null, crypto.randomUUID()).catch((err) => {
        setMenuError(err.message);
        setRound(null);
      });
    } else {
      setPayMode(mode);
    }
  }

  function playAgain() {
    const mode = round.mode;
    if (!user.playsFree) setRound(null); // back to the menu so the pin box shows
    play(mode);
  }

  async function handleLogout() {
    await logout();
    setUser(null);
    setRound(null);
    setShowBoards(false);
    setInMulti(false);
    setShowPlayers(false);
    setProfileId(null);
  }

  const cost = user ? user.roundCost : 0;
  let screen;
  let screenKey;

  if (checking) {
    screen = <p className="loading">LOADING...</p>;
    screenKey = 'loading';
  } else if (!user) {
    screen = <LoginScreen />;
    screenKey = 'login';
  } else if (round) {
    const costText = user.playsFree ? 'free' : `${cost} Digipogs`;
    screen = (
      <GameScreen
        mode={round.mode}
        roundId={round.roundId}
        costText={costText}
        onPlayAgain={playAgain}
        onQuit={() => setRound(null)}
        onScore={handleUnlocks}
      />
    );
    screenKey = `game-${round.roundId}`;
  } else if (inMulti) {
    screen = <Multiplayer user={user} onBack={() => setInMulti(false)} onUnlock={handleUnlocks} onProfile={setProfileId} />;
    screenKey = 'multi';
  } else if (showBoards) {
    screen = <Leaderboard user={user} onBack={() => setShowBoards(false)} onProfile={setProfileId} />;
    screenKey = 'boards';
  } else if (showPlayers) {
    screen = <Directory user={user} onBack={() => setShowPlayers(false)} onProfile={setProfileId} />;
    screenKey = 'players';
  } else {
    screen = (
      <Menu
        user={user}
        error={menuError}
        onPlay={play}
        onMulti={() => setInMulti(true)}
        onLeaderboard={() => setShowBoards(true)}
        onPlayers={() => setShowPlayers(true)}
        onProfile={setProfileId}
        onLogout={handleLogout}
      />
    );
    screenKey = 'menu';
  }

  return (
    <>
      <Backdrop />
      <div className="screen" key={screenKey}>
        {screen}
      </div>
      {profileId && user && <Profile id={profileId} user={user} onChanged={refreshUser} onClose={() => setProfileId(null)} />}
      <Toasts toasts={toasts} onDone={(key) => setToasts((list) => list.filter((t) => t.key !== key))} />
      {payMode && user && (
        <PayModal
          mode={payMode}
          cost={cost}
          discount={user.discount}
          onPay={(pin, requestId) => startWith(payMode, pin, requestId)}
          onCancel={() => setPayMode(null)}
        />
      )}
    </>
  );
}
