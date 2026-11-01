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

The Multiplayer bar on the menu opens the lobby browser. Making a lobby or joining to play costs the entry fee, which you confirm with your PIN first. Watching is free.

- **Standard** holds 2 to 32 players. **Battle Royale** holds 2 to 99 players. **Rush** holds 2 to 32 players. The host picks the size when making the lobby.
- **Rush** is a race with no garbage: the first player to clear the chosen number of lines (the host picks 1 to 999, default 40) wins. The server checks every line count against the time played, and it ends the match as soon as someone reaches the goal.
- CPU opponents (levels 1 to 9) count toward the player limit. The limits are enforced on the server in `server/lobbies.js`, not just in the form.
- Lobbies are public (listed) or private (not listed, joined with the 5 letter code and a password).
- Everyone but the host has to ready up. The host can add or remove CPUs, kick people, hand over the host role and change the settings.
- Players who are knocked out can spectate. People can also join as spectators (up to 32 per lobby).
- In Battle Royale a KO gives a badge (up to 4) that makes your attacks 25% stronger and cancels some of your incoming garbage. You only see a few small opponent boards, not all 98.
- If a match goes past 3 minutes, garbage starts landing on everyone so it always ends.

How it works: `server/socket.js` is the websocket, `server/lobbies.js` handles rooms, `server/match.js` runs the match and `server/bot.js` plays the CPUs. Each player's own browser plays their game and the server checks attacks and boards, so a cheater is limited but not fully stopped.

In development the vite proxy forwards `/ws` to the server, so `npm run dev` works as before.

## Profiles, achievements and ranks

Every player who logs in gets a profile, saved in `data/profiles.json` under their Formbar user id (names are only for showing, and refresh at each login). Click a name in the leaderboards, a lobby, the match results or the menu to open it, or open the account menu (your name at the top right) and pick **Players** to search everyone.

- A profile shows the Formbar name, the picture, statistics, personal bests, the rank and every achievement (earned ones with their dates, locked ones greyed out).
- Personal bests for Normal and 40L come from the leaderboards, so nothing is stored twice.
- Wins and losses are 40L races and multiplayer matches. Normal rounds have no win or loss, they just end.
- Every finished solo round counts, including a lost 40L race or a 0 score, but only a score (or a finished race) goes on the leaderboard. Rounds you quit halfway don't count.
- A multiplayer match only counts if it lasted at least a minute (`MIN_MATCH_MS` in `server/profiles.js`), so two accounts can't trade quick wins.
- Achievements are only checked in the modes they list, so a 40L round can't earn a Normal score achievement and a match can't earn a T-spin.

**Ranks:** Blockhead (1 achievement), Stackademic (5), Tetrific (10), GrandStacker (15). Players choose up to 2 ranks (earned or bought) to show next to their name, in the shop or on their own profile. If they never choose, their highest earned rank shows. The order is the order they were picked in and is saved: hide a title and pick it again to move it to the end. The first title sets the color of the profile. Owner and Admin are optional titles that only people with those Formbar ids (`server/config.js`) can pick, and they don't use up the 2 choices.

**Adding an achievement or rank:** add one line to the list in `src/game/achievements.js` (name, text, icon, color, the mode it applies to and a `test`). The server, profile page and gallery all read from that file.

**Profile pictures:** everyone starts with `public/img/caticon1.png`. Each profile saves the key of its picture, and the shop sells the others (entries in `src/game/pictures.js`). What is public is decided in one place, `publicProfile` in `server/profiles.js`, which is where privacy settings can go later.

**Lobby names:** admins (`adminIds` in `server/config.js`) can name their lobbies. Everyone else gets "{username}'s lobby", and the server refuses any attempt to set a name.

As before, the game itself runs in the browser, so the server only checks that results are possible (clear counts against lines, time against the round length). That stops obvious fakes but is not a full cheat prevention.


## Shop, multiplayer entry and the admin panel

**Shop** (menu, "Open shop"): profile pictures and cosmetic ranks, paid in Digipogs through Formbar's pool transfer, the same as rounds. Items are kept forever and can be equipped or hidden for free. Ranks and pictures are only for show, they never change permissions or gameplay. Default prices and descriptions are in `src/game/shop.js` and `src/game/pictures.js`.

- The server sets every price. The browser sends the price it was shown and the server refuses if it changed. Each purchase has a request id so a retry never charges twice, and a player can only have one payment at a time.
- Every purchase is written to `data/shop.json` before the payment, then again after it. If the server stops after Formbar took the money, the item is given when it starts again. A payment Formbar never answered is marked "unknown" in the admin Logs tab, and an admin checks Formbar and gives the item or dismisses it.
- Formbar has no documented balance lookup, so there is no pre-check: Formbar refuses the transfer if the player can't afford it, and nothing is given in that case.
- The "sans." rank is a picture of the text drawn in Pixel Comic Sans by ColorSwitchFan25 (FontStruct, non-commercial). Its license doesn't allow the font file as a web font, so only the rendered image `public/img/sans.png` is used. Keep the credit line in the shop.

**Multiplayer entry fee:** creating a lobby, joining one to play, or going from watching to playing asks for confirmation first. The box shows the fee (`multiplayerCost` in `server/config.js`, 30 by default), any leaderboard discount, what you pay, and your balance if Formbar's login token includes it (there is no documented balance lookup, so otherwise Formbar checks it when you pay). Nothing is charged until you confirm with your PIN. The owner is exempt, and watching is free.

- `server/entry.js` checks that the entry can work (right password, room left, not banned) before asking for money, so a full lobby or a wrong password never costs anything. After you confirm, `server/shop.js` charges once (a request id and a one-payment-at-a-time lock stop double charges) and then puts you in the lobby.
- Formbar has no refund for a transfer, so a failed join is never refunded after the fact. The rare case is a lobby filling up in the second the payment takes. Then you get a saved entry that makes your next entry free (shown in the confirm box). An admin closing a lobby gives paid players one too. Admins can also give one from the Players tab.
- Once you paid for a lobby you can watch and play again in it without paying. Leaving and coming back is a new entry.
- Creating and joining no longer go through the websocket at all, only through `POST /api/multiplayer/enter`, so the fee can't be skipped.

**Admin panel** (menu, "Admin panel"): only for the Formbar ids in `adminIds`, checked on the server for every request. Tabs: overview (site stats, announcements, achievement counts), players (search, ban/kick/remove score, set or upload any profile picture, give or take items, achievements and saved entries), lobbies (view and close), shop (price, description, hide, sales) and logs (transactions and admin actions). Risky buttons ask twice. Admins can't change anyone's Formbar balance. Admin data is in `data/admin.json`.

Soft drop moves at 20x gravity (`SOFT_DROP` in `src/game/constants.js`), like the Tetris guideline. The engine keeps the fall as a fraction of a row (`game.fall` in `src/game/engine.js`), so the speed is the same at any frame rate, the piece moves one cell at a time with a collision check on each, and a long frame can't push a piece through blocks. Letting go of the key (or leaving the window) stops it at once, and it never hard drops.

## Account menu and settings

The top right of the menu shows your equipped ranks, your name and your picture. Click it for **Profile**, **Players**, **Settings**, **Admin panel** (admins only) and **Logout** at the bottom.

Settings has four parts and everything saves as soon as you change it (stored with the profile in `data/profiles.json`, checked again on the server in `saveSettings`):

- **Controls:** two keys per action. Click one, press the new key, Esc cancels. A key can only do one thing, so a key that is already in use is refused with a message. Restore defaults puts the original keys back. The game reads the keys through `src/game/keys.js`, so a change works right away.
- **Ranks:** choose the titles you show and move them up or down. The first one sets your profile color.
- **Pictures:** equip any picture you own.
- **Cosmetics:** turn effects such as sparkles on or off (this only changes what you see).

## Cosmetic effects

Owning and equipping **Golden Dominus** (picture) or **BLOCKILLIONAIRE** (rank) adds a small sparkle around the picture or the rank, using `public/img/sparkle.png`. It follows the equipped item, not your balance. If both are equipped the sparkle shows once, on the picture. Effects are plain CSS animation, are switched off by the Cosmetics setting and by the system "reduce motion" setting, and never touch gameplay.

To give another item an effect: add its name to `EFFECTS` in `src/cosmetics.js`, draw it in the `Fx` component (`src/components/Fx.jsx`) and put `effect: 'name'` on the item in `src/game/pictures.js` or `src/game/shop.js`. Every place that shows a picture or rank already goes through `Avatar`, `Badge` or `Fx`, so nothing else changes.

## Invitations

When you are in a lobby that has not started, **Invite players** opens a player search, and a profile shows **Invite to Lobby**. The other player gets a card with the lobby name, mode, player count and entry fee, and can accept or decline. Accepting opens the usual fee box, so nothing is charged without a confirmed PIN.

- The server (`server/invites.js`) refuses invites to people who are offline, already in the lobby or already invited, to a full or started lobby, and to your own account. Only the host can invite to a private lobby, and an invite lasts 2 minutes. At most 10 can be sent per minute.
- An invite lets the person skip the lobby password but nothing else: bans, capacity and the fee are still checked when they accept. The code and password are never sent to them.
- Invites reach players on any screen because the game connection stays open while logged in (`src/useConnection.js`). A friends list can be added later by calling the same `sendInvite` function from a friends screen.

## Leaderboard boards for wins and KOs

Besides Normal and 40L there are **Most wins** (Standard and Battle Royale wins plus Rush wins) and **Most KOs** (Battle Royale only). A match only counts when at least one other real player was in it, so rounds with only CPUs never count. These boards do not give entry discounts. Standard and Battle Royale need 60 seconds and Rush needs 20 seconds to count (`MIN_MATCH_MS`, `MIN_RUSH_MS` in `server/profiles.js`).
