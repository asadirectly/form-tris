# Form-Tris!

A Tetris game for Formbar. React and Vite on the front end, a small Express server for login, Digipog payments and multiplayer.

## Setup

1. Install Node 20.19+ (or 22.12+) and run `npm install`.
2. Copy `.env.example` to `.env` and fill it in.
3. Run `npm run server` and `npm run dev` in two terminals, then open http://localhost:5173.

## Running with PM2

1. Install Node 20.19+ (or 22.12+) and PM2 (`npm install -g pm2`).
2. `npm install`
3. `cp .env.example .env`, then set `SESSION_SECRET` and set `APP_URL` to the public URL
4. `npm run build` (creates `dist/`, which the server serves)
5. `pm2 start npm --name form-tris -- start`
6. `pm2 save`

port 3000 is default

## What's in it

- Solo modes: Normal (highest score), 40L (fastest time) and Block Blast (an 8x8 puzzle, highest score). Each round costs an entry fee.
- Multiplayer: Standard, Battle Royale and Rush lobbies, public or private, with CPU opponents, invites and spectating.
- Leaderboards for Normal, 40L, Block Blast, wins and KOs. The top 3 on the solo boards get entry discounts.
- Profiles, achievements and ranks.
- A shop for profile pictures and ranks, paid in Digipogs.
- An admin panel for players, lobbies, the shop and logs.

The game runs in the browser and the server only checks that results are possible. That stops obvious cheating, but it isn't airtight.

## Config and data

Prices, discounts, lobby limits and admin ids are in `server/config.js`. Profiles, leaderboards, shop and admin data are saved as JSON in `data/`, which is created on first use and ignored by git. Delete a file to reset it.

To add an achievement, add a line to `src/game/achievements.js`. Shop items live in `src/game/shop.js` and `src/game/pictures.js`.

The "sans." rank image uses Pixel Comic Sans by ColorSwitchFan25 (FontStruct, non-commercial). Keep the credit in the shop.

---

Note: user 91 is the owner and plays free. To change that, edit `ownerId` (and `adminIds`) in `server/config.js`. Test payments with a different account.
