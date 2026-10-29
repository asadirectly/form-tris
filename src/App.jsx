import { useEffect, useState } from 'react';
import { getMe, startRound, logout } from './api.js';
import Backdrop from './components/Backdrop.jsx';
import LoginScreen from './components/LoginScreen.jsx';
import Menu from './components/Menu.jsx';
import GameScreen from './components/GameScreen.jsx';
import PayModal from './components/PayModal.jsx';
import Leaderboard from './components/Leaderboard.jsx';
import Multiplayer from './components/Multiplayer.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [round, setRound] = useState(null); // the round the server let us start
  const [payMode, setPayMode] = useState(null); // mode waiting for a pin
  const [menuError, setMenuError] = useState('');
  const [showBoards, setShowBoards] = useState(false);
  const [inMulti, setInMulti] = useState(false);

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
        onScore={refreshUser}
      />
    );
    screenKey = `game-${round.roundId}`;
  } else if (inMulti) {
    screen = <Multiplayer user={user} onBack={() => setInMulti(false)} />;
    screenKey = 'multi';
  } else if (showBoards) {
    screen = <Leaderboard user={user} onBack={() => setShowBoards(false)} />;
    screenKey = 'boards';
  } else {
    screen = <Menu user={user} error={menuError} onPlay={play} onMulti={() => setInMulti(true)} onLeaderboard={() => setShowBoards(true)} onLogout={handleLogout} />;
    screenKey = 'menu';
  }

  return (
    <>
      <Backdrop />
      <div className="screen" key={screenKey}>
        {screen}
      </div>
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
