# Form-Tris!

A Tetris game for Formbar, built with React (JavaScript) and Vite, with a small Express server for login and Digipog payments.

## Setup

1. Install Node 20.6 or newer, then run `npm install`.
2. Copy `.env.example` to `.env` and fill it in (session secret, Formbar addresses, `APP_URL`).
3. Open two terminals. Run `npm run server` in one and `npm run dev` in the other, then open http://localhost:5173.
4. User 91 plays free, so test payments with a different account.

## Leaderboards

Normal mode ranks by highest score and 40L by fastest time, one best result per Formbar user. They are saved in `data/leaderboard.json` (created on the first score, ignored by git), delete that file to reset them. The top 3 on either board get 25%, 15% and 10% off the entry fee (change `discounts` in `server/config.js`), and only the biggest discount applies.

## Multiplayer

The Multiplayer bar on the menu opens the lobby browser. Multiplayer is free, it does not cost any Digipogs.

- **Standard** holds 2 to 32 players. **Battle Royale** holds 2 to 99 players. The host picks the size when making the lobby.
- CPU opponents (levels 1 to 9) count toward the player limit. The limits are enforced on the server in `server/lobbies.js`, not just in the form.
- Lobbies are public (listed) or private (not listed, joined with the 5 letter code and a password).
- Everyone but the host has to ready up. The host can add or remove CPUs, kick people, hand over the host role and change the settings.
- Players who are knocked out can spectate. People can also join as spectators (up to 32 per lobby).
- In Battle Royale a KO gives a badge (up to 4) that makes your attacks 25% stronger and cancels some of your incoming garbage. You only see a few small opponent boards, not all 98.
- If a match goes past 3 minutes, garbage starts landing on everyone so it always ends.

How it works: `server/socket.js` is the websocket, `server/lobbies.js` handles rooms, `server/match.js` runs the match and `server/bot.js` plays the CPUs. Each player's own browser plays their game and the server checks attacks and boards, so a cheater is limited but not fully stopped.

In development the vite proxy forwards `/ws` to the server, so `npm run dev` works as before.

## Profiles, achievements and ranks

Every player who logs in gets a profile, saved in `data/profiles.json` under their Formbar user id (names are only for showing, and refresh at each login). Click a name in the leaderboards, a lobby, the match results or the menu to open it, or use **Find players** on the menu to search everyone.

- A profile shows the Formbar name, the picture, statistics, personal bests, the rank and every achievement (earned ones with their dates, locked ones greyed out).
- Personal bests for Normal and 40L come from the leaderboards, so nothing is stored twice.
- Wins and losses are 40L races and multiplayer matches. Normal rounds have no win or loss, they just end.
- Every finished solo round counts, including a lost 40L race or a 0 score, but only a score (or a finished race) goes on the leaderboard. Rounds you quit halfway don't count.
- A multiplayer match only counts if it lasted at least a minute (`MIN_MATCH_MS` in `server/profiles.js`), so two accounts can't trade quick wins.
- Achievements are only checked in the modes they list, so a 40L round can't earn a Normal score achievement and a match can't earn a T-spin.

**Ranks:** Blockhead (1 achievement), Stackademic (5), Tetrific (10), GrandStacker (15). Players choose up to 2 earned ranks to show next to their name from their own profile. If they never choose, their highest rank shows. Owner and Admin come from `server/config.js` and always show on top of that.

**Adding an achievement or rank:** add one line to the list in `src/game/achievements.js` (name, text, icon, color, the mode it applies to and a `test`). The server, profile page and gallery all read from that file.

**Profile pictures:** everyone uses `public/img/caticon1.png`. Each profile saves the key of its picture, so a future shop only has to add an entry to `src/game/pictures.js`. What is public is decided in one place, `publicProfile` in `server/profiles.js`, which is where privacy settings can go later.

**Lobby names:** admins (`adminIds` in `server/config.js`) can name their lobbies. Everyone else gets "{username}'s lobby", and the server refuses any attempt to set a name.

As before, the game itself runs in the browser, so the server only checks that results are possible (clear counts against lines, time against the round length). That stops obvious fakes but is not a full cheat prevention.
