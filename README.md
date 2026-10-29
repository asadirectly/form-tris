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

uses web sockets ( will update readme later )

In development the vite proxy forwards `/ws` to the server, so `npm run dev` works as before.
