import { useEffect, useState } from 'react';
import Logo from './Logo.jsx';
import { MODES } from '../game/constants.js';
import { getLeaderboards } from '../api.js';
import { formatTime } from '../format.js';
import { titlesQuiet } from '../cosmetics.js';
import PlayerLink, { Avatar, Badges } from './PlayerLink.jsx';

// the five boards: three are the solo modes (they give the discounts), two come from multiplayer
const BOARDS = [
  { id: 'normal', tab: MODES.normal.name, title: `${MODES.normal.name} · Score`, rule: 'Highest score wins.', art: '/img/Pattern01.png', discounts: true },
  { id: 'sprint', tab: MODES.sprint.name, title: `${MODES.sprint.name} · Time`, rule: 'Fastest time to clear 40 lines wins.', art: '/img/Pattern02.png', discounts: true },
  { id: 'blast', tab: MODES.blast.name, title: `${MODES.blast.name} · Score`, rule: 'Highest score wins.', art: '/img/Pattern04.png', discounts: true },
  {
    id: 'wins',
    tab: 'Wins',
    title: 'Most wins',
    rule: 'Wins in Standard, Battle Royale and Rush.',
    art: '/img/Pattern03.png',
    note: "Wins and KOs only count in matches with at least one other real player, CPUs alone don't count.",
  },
  {
    id: 'kos',
    tab: 'KOs',
    title: 'Battle Royale · Most KOs',
    rule: 'Most KOs in Battle Royale matches.',
    art: '/img/Pattern03.png',
    note: "Wins and KOs only count in matches with at least one other real player, CPUs alone don't count.",
  },
];

const PLACES = ['1st', '2nd', '3rd'];

function showValue(boardId, value) {
  return boardId === 'sprint' ? formatTime(value) : value.toLocaleString();
}

// where the player stands on a board, or null if they are not on it
function standingOn(board, userId) {
  const entry = board.entries.find((e) => e.userId === userId);
  if (entry) return { rank: entry.rank, value: entry.value };
  return board.you;
}

// one of the three blocks of the podium
function Step({ entry, place, boardId, userId, onProfile }) {
  if (!entry) {
    return (
      <div className={`step place-${place} empty`}>
        <span className="step-place">{place}</span>
        <span className="step-open">Open spot</span>
      </div>
    );
  }

  return (
    <div className={entry.userId === userId ? `step place-${place} me` : `step place-${place}`}>
      <span className="step-place">{place}</span>
      <Avatar picture={entry.picture} size={place === 1 ? 64 : 48} />
      <PlayerLink id={entry.userId} name={entry.name} onProfile={onProfile} className="step-name" />
      <span className="step-badges">
        <Badges ids={entry.badges} quiet={titlesQuiet(entry.picture)} />
      </span>
      {entry.discount > 0 && <span className="tag">{entry.discount}% off</span>}
      <span className="step-value">{showValue(boardId, entry.value)}</span>
    </div>
  );
}

// places 4 and below, and the player's own row when they are further down
function Row({ entry, boardId, isMe, onProfile }) {
  return (
    <li className={isMe ? 'rank-row me' : 'rank-row'}>
      <span className="rank-pos">{entry.rank}</span>
      <Avatar picture={entry.picture} size={32} />
      <span className="rank-who">
        <PlayerLink id={entry.userId} name={entry.name} onProfile={onProfile} className="rank-name" />
        <span className="rank-badges">
          <Badges ids={entry.badges} quiet={titlesQuiet(entry.picture)} />
        </span>
      </span>
      <span className="rank-value">{showValue(boardId, entry.value)}</span>
    </li>
  );
}

export default function Leaderboard({ user, onBack, onProfile }) {
  const [boards, setBoards] = useState(null);
  const [error, setError] = useState('');
  const [activeId, setActiveId] = useState('normal');

  useEffect(() => {
    getLeaderboards()
      .then(setBoards)
      .catch((err) => setError(err.message));
  }, []);

  const active = BOARDS.find((b) => b.id === activeId);
  const board = boards ? boards[activeId] : null;

  return (
    <div className="menu">
      <header className="topbar">
        <Logo small />
        <div className="user">
          <span className="username">{user.name}</span>
          <button className="btn small ghost" onClick={onBack}>
            Back
          </button>
        </div>
      </header>

      <section className="boards-top">
        <h2 className="heading">Leaderboards</h2>
        {error && <p className="error">{error}</p>}
        {!boards && !error && <p className="fine">LOADING...</p>}

        {boards && (
          <div className="tabs board-tabs">
            {BOARDS.map((b) => {
              const mine = standingOn(boards[b.id], user.id);
              return (
                <button key={b.id} type="button" className={b.id === activeId ? `tab ${b.id} on` : `tab ${b.id}`} onClick={() => setActiveId(b.id)}>
                  {b.tab}
                  {mine && <small>#{mine.rank}</small>}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {board && (
        <>
          <section className={`box board ${active.id}`} key={active.id} style={{ '--i': 0, '--art': `url(${active.art})` }}>
            <h3 className="box-title">{active.title}</h3>
            <p className="board-rule">
              {active.rule}
              {active.discounts && ' The top 3 get entry discounts.'}
            </p>

            <div className="podium">
              {[1, 0, 2].map((i) => (
                <Step key={i} entry={board.entries[i]} place={i + 1} boardId={active.id} userId={user.id} onProfile={onProfile} />
              ))}
            </div>

            {board.entries.length === 0 && <p className="fine">Nobody is on this board yet.</p>}

            <ul className="board-list">
              {board.entries.slice(3).map((entry) => (
                <Row key={entry.userId} entry={entry} boardId={active.id} isMe={entry.userId === user.id} onProfile={onProfile} />
              ))}

              {board.you && (
                <>
                  <li className="board-gap" aria-hidden="true">
                    ···
                  </li>
                  <Row
                    entry={{ rank: board.you.rank, value: board.you.value, userId: user.id, name: user.name, picture: user.picture, badges: user.badges }}
                    boardId={active.id}
                    isMe
                    onProfile={onProfile}
                  />
                </>
              )}
            </ul>

            {active.note && <p className="fine">{active.note}</p>}
          </section>

          <aside className="side-col">
            <div className="box">
              <h3 className="box-title">Your standings</h3>
              <ul className="standings">
                {BOARDS.map((b) => {
                  const mine = standingOn(boards[b.id], user.id);
                  return (
                    <li key={b.id}>
                      <button type="button" className={b.id === activeId ? `standing ${b.id} on` : `standing ${b.id}`} onClick={() => setActiveId(b.id)}>
                        <span className="standing-name">{b.tab}</span>
                        <b>{mine ? `#${mine.rank} · ${showValue(b.id, mine.value)}` : '--'}</b>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="box">
              <h3 className="box-title">Entry discounts</h3>
              <ul className="perks">
                {user.discounts.map((percent, i) => (
                  <li key={i}>
                    <span>{PLACES[i]} place</span>
                    <b>{percent}% off</b>
                  </li>
                ))}
              </ul>
              <p className="fine">Finish in the top 3 on Normal, 40L or Block Blast. Only your biggest discount counts.</p>
              <p className="fine">{user.discount > 0 ? `You get ${user.discount}% off right now.` : 'You have no discount right now.'}</p>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
