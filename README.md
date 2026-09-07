# The Pickle Farm POS — Web Edition

This is a web version of the Pickle Farm POS desktop app. Same features — POS/checkout,
open play, reservations, members, inventory, expenses, dashboard, reports — but it runs as
an ordinary website instead of an installed Mac app, so any device with a browser (another
laptop, a tablet at the front desk, your phone) can use it once it's deployed, all sharing
the same data.

## What changed vs. the desktop app

- **One shared database, not one per device.** The desktop app kept its SQLite file on
  your Mac only. This version moves the same database onto a small server that all devices
  talk to over the internet, so a sale rung up on one device shows up everywhere else
  immediately.
- **Login works for multiple people at once.** The desktop app tracked "who's logged in"
  as a single global variable, which only works for one device at a time. The web version
  issues each login a signed token (JWT), so the owner on one tablet and a cashier on
  another can both be logged in simultaneously without stepping on each other.
- **Printing goes through the browser's print dialog**, not a direct USB/Bluetooth thermal
  printer connection (a browser can't drive a receipt printer directly the way a desktop
  app can). The receipt screen still shows the same 58mm receipt preview; "Print Receipt"
  opens your browser's print dialog, and if your thermal printer is set as your system's
  default printer, most browsers will print straight to it just like any other document.
- **Open Play's live leaderboard/session stats still live in the browser** (localStorage)
  rather than the shared database, same as before. That means rankings and session history
  built up on one device won't automatically show on another. Player check-in/court
  assignment IS shared across devices — it's specifically the win/loss leaderboard and
  session history that stays local for now. Worth revisiting in a follow-up if you want
  that shared too.

Everything else — the checkout flow, court rental booking, membership discounts, low-stock
alerts, expense tracking, daily reports — works the same way it did on the desktop app.

## Project layout

```
pickle-farm-pos-web/
  server/   Express + SQLite API (Node.js)
  client/   React web app (Vite)
```

## Default login

- **Owner** — PIN `082697`
- **Staff (Cashier)** — PIN `1234`

Change these PINs after your first login (there's no UI for it yet — ask me to add a
"change PIN" screen if you want one, or I can update a PIN directly in the database for you).

## Running it locally (to try it out before deploying)

You'll need [Node.js](https://nodejs.org) 20+ installed.

```bash
# from the pickle-farm-pos-web folder
npm run install:all

# terminal 1 — starts the API on http://localhost:4000
npm run dev:server

# terminal 2 — starts the web app on http://localhost:5173
npm run dev:client
```

Open http://localhost:5173 — the dev server proxies API calls to the server automatically.
The database file is created at `server/data/pickle-farm.db` the first time the server runs.

## Deploying it online (so other devices can reach it)

The app is one Node.js web service (it serves both the API and the built web app from the
same process) plus one SQLite file that needs to persist between deploys. Below is the
simplest path using **Railway** — a hosting platform with a free trial and a straightforward
UI. Render and Fly.io work too (both support "a Node web service with a persistent disk");
the steps are similar wherever you go.

### Option A — Railway (recommended, easiest)

1. **Put the code on GitHub.** Create a new repository (e.g. `pickle-farm-pos-web`) and
   push this folder to it. If you're not comfortable with git commands, GitHub Desktop
   (a free app) can do this by just pointing it at this folder and clicking "Publish".
2. **Sign up at [railway.app](https://railway.app)** (you can sign in with GitHub).
3. Click **New Project → Deploy from GitHub repo**, and pick the repository you just pushed.
4. Railway will detect a Node project. Set these in the service's **Settings**:
   - **Root Directory**: leave blank (it builds from the repo root)
   - **Build Command**: `npm run install:all && npm run build`
   - **Start Command**: `npm run start`
5. Add a **Volume** (Settings → Volumes → New Volume) and mount it at `/data`. This is
   where your database file will live permanently, surviving redeploys.
6. Add these **Variables** (Settings → Variables):
   - `JWT_SECRET` — any long random string (this signs login tokens — keep it secret)
   - `DB_PATH` — `/data/pickle-farm.db`
   - `PORT` — Railway sets this automatically, no need to add it
7. Click **Deploy**. Railway gives you a public URL like `pickle-farm-pos-web-production.up.railway.app` —
   that's the address every device will use. You can attach a custom domain later if you want
   something like `pos.thepicklefarm.ph`.

### Option B — Render

Same idea: create a "Web Service" from your GitHub repo, build command
`npm run install:all && npm run build`, start command `npm run start`, add a persistent
disk mounted at `/data`, set `DB_PATH=/data/pickle-farm.db` and `JWT_SECRET` as environment
variables. Render's free tier doesn't include persistent disks, so you'd need a paid
instance (their cheapest paid tier is fine for this app's traffic).

### Option C — Fly.io

More technical (uses their `flyctl` command-line tool rather than a web dashboard), but has
a generous free allowance including a small persistent volume. Worth it if you're comfortable
with a terminal and want to avoid a monthly bill; ask me to walk through the `fly.toml` setup
if you'd like to go this route.

## Using it day to day once deployed

Just open the deployed URL in a browser on any device — your laptop, a tablet at the front
desk, your phone. Everyone shares the same live data. No installation needed on each device,
unlike the old desktop app.

## Environment variables reference

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | Yes, in production | Secret key that signs login sessions. Use a long random string. |
| `DB_PATH` | Recommended | Where the SQLite file lives. Point this at your host's persistent disk (e.g. `/data/pickle-farm.db`), or it defaults to `./data/pickle-farm.db` next to the app — which gets wiped on redeploy if that's not a persistent volume. |
| `PORT` | No | Defaults to 4000; most hosts set this for you. |
| `CORS_ORIGIN` | No | Only needed if you deploy the client and server as two separate URLs instead of one combined service. Leave blank for the default single-service setup above. |

## Source

Ported from the original Electron desktop app (`pickle-farm-pos` in your Downloads folder).
The database schema, business logic (checkout math, stock movements, membership discounts,
reservation conflict checks, daily reports) are carried over as-is — only the storage layer
(one shared SQLite file on a server instead of one per device) and the login/session
handling changed to support multiple devices at once.
