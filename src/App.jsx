import { useEffect, useState } from 'react';
import { getMe, startRound, logout } from './api.js';
import Backdrop from './components/Backdrop.jsx';
import LoginScreen from './components/LoginScreen.jsx';
import Menu from './components/Menu.jsx';
import GameScreen from './components/GameScreen.jsx';
import PayModal from './components/PayModal.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [round, setRound] = useState(null); // the round the server let us start
  const [payMode, setPayMode] = useState(null); // mode waiting for a pin
  const [menuError, setMenuError] = useState('');

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  // the server decides if the round is allowed and takes the payment
  async function startWith(mode, pin, requestId) {
    try {
      const newRound = await startRound(mode, pin, requestId);
      setPayMode(null);
      setRound(newRound);
    } catch (err) {
      if (err.status === 401) {
        setUser(null);
        setPayMode(null);
      }
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
    screen = <GameScreen mode={round.mode} costText={costText} onPlayAgain={playAgain} onQuit={() => setRound(null)} />;
    screenKey = `game-${round.roundId}`;
  } else {
    screen = <Menu user={user} error={menuError} onPlay={play} onLogout={handleLogout} />;
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
          onPay={(pin, requestId) => startWith(payMode, pin, requestId)}
          onCancel={() => setPayMode(null)}
        />
      )}
    </>
  );
}
