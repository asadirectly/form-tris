import { useEffect, useState } from 'react';
import { getMe, startRound, logout, getAnnouncement } from './api.js';
import Backdrop from './components/Backdrop.jsx';
import LoginScreen from './components/LoginScreen.jsx';
import Menu from './components/Menu.jsx';
import GameScreen from './components/GameScreen.jsx';
import PayModal from './components/PayModal.jsx';
import BuyModal from './components/BuyModal.jsx';
import Shop from './components/Shop.jsx';
import Admin from './components/Admin.jsx';
import Leaderboard from './components/Leaderboard.jsx';
import Multiplayer from './components/Multiplayer.jsx';
import Directory from './components/Directory.jsx';
import Profile from './components/Profile.jsx';
import Toasts from './components/Toasts.jsx';
import Settings from './components/Settings.jsx';
import Invites from './components/Invites.jsx';
import { useConnection } from './useConnection.js';
import { setActiveKeys } from './game/keys.js';
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
  const [showShop, setShowShop] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [announcement, setAnnouncement] = useState(null);
  const [hiddenNote, setHiddenNote] = useState(0); // id of the announcement the player closed
  const [showSettings, setShowSettings] = useState(false);
  const [acceptedInvite, setAcceptedInvite] = useState(null); // an invite the player accepted, multiplayer takes it from here

  // the connection stays open on every screen so invitations always arrive
  const net = useConnection(user, (reply) => notify('Invite declined', reply.name, 'X', 'red'));

  // saved controls and effects apply as soon as we know whose they are
  useEffect(() => {
    if (!user) {
      setActiveKeys(null);
      return;
    }
    setActiveKeys(user.settings.keys);
    document.documentElement.dataset.effects = user.settings.effects === false ? 'off' : 'on';
  }, [user ? JSON.stringify(user.settings) : '']);

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  // an announcement from an admin shows as a bar, checked every half minute while logged in
  useEffect(() => {
    if (!user) return;
    function check() {
      getAnnouncement()
        .then((data) => setAnnouncement(data.announcement))
        .catch(() => {});
    }
    check();
    const timer = setInterval(check, 30000);
    return () => clearInterval(timer);
  }, [!!user]);

  // the price and discount come from the server, so ask again whenever rankings may have changed
  function refreshUser() {
    getMe()
      .then(setUser)
      .catch(() => {});
  }

  function notify(label, name, icon, color) {
    setToasts((list) => [...list, { key: `n-${Date.now()}-${Math.random()}`, label, name, icon, color }]);
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
    setShowShop(false);
    setShowAdmin(false);
    setShowSettings(false);
    setAcceptedInvite(null);
    setAnnouncement(null);
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
    screen = (
      <Multiplayer
        user={user}
        socket={net.socket}
        online={net.online}
        lobby={net.lobby}
        invite={acceptedInvite}
        onInviteDone={() => setAcceptedInvite(null)}
        onBack={() => setInMulti(false)}
        onUnlock={handleUnlocks}
        onProfile={setProfileId}
        onRefresh={refreshUser}
      />
    );
    screenKey = 'multi';
  } else if (showSettings) {
    screen = (
      <Settings
        user={user}
        onBack={() => setShowSettings(false)}
        onChanged={refreshUser}
        onShop={() => {
          setShowSettings(false);
          setShowShop(true);
        }}
        onProfile={setProfileId}
      />
    );
    screenKey = 'settings';
  } else if (showShop) {
    screen = (
      <Shop
        user={user}
        onBack={() => setShowShop(false)}
        onChanged={refreshUser}
        onBought={(item) => {
          refreshUser();
          notify('Bought', item.name, item.kind === 'rank' ? 'R' : 'P', item.rare ? 'yellow' : 'green');
        }}
        onProfile={setProfileId}
      />
    );
    screenKey = 'shop';
  } else if (showAdmin && user.isAdmin) {
    screen = <Admin user={user} onBack={() => setShowAdmin(false)} onProfile={setProfileId} />;
    screenKey = 'admin';
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
        onShop={() => setShowShop(true)}
        onAdmin={() => setShowAdmin(true)}
        onSettings={() => setShowSettings(true)}
        onProfile={setProfileId}
        onLogout={handleLogout}
      />
    );
    screenKey = 'menu';
  }

  return (
    <>
      <Backdrop />
      {user && announcement && announcement.id !== hiddenNote && (
        <div className="announce" role="status">
          <b>Announcement</b>
          <span>{announcement.text}</span>
          <button type="button" className="btn small ghost" onClick={() => setHiddenNote(announcement.id)}>
            Close
          </button>
        </div>
      )}
      <div className="screen" key={screenKey}>
        {screen}
      </div>
      {user && net.replacedByTab && (
        <div className="announce" role="status">
          <b>Heads up</b>
          <span>Form-Tris is open in another tab, so invites and multiplayer now work there. Reload this page to use it here instead.</span>
        </div>
      )}
      {profileId && user && (
        <Profile id={profileId} user={user} lobby={net.lobby} onInvite={net.invitePlayer} onChanged={refreshUser} onClose={() => setProfileId(null)} />
      )}
      {user && (
        <Invites
          invites={net.invites}
          user={user}
          busy={!!round}
          onAccept={(id) => {
            net.dropInvite(id);
            setAcceptedInvite(id);
            setInMulti(true);
          }}
          onDecline={(id) => {
            net.socket && net.socket.send({ type: 'inviteDecline', id });
            net.dropInvite(id);
          }}
          onExpire={net.dropInvite}
        />
      )}
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
