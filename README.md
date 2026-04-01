# SteamPlaytime — Steam Playtime Tracker

A self-hosted Steam playtime dashboard. Fetches review data from Steam's public API,
stores it as JSON, and serves it as a clean filterable dashboard on Netlify.

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Seed the database (fetch from Steam)
```bash
npm run fetch
```
This hits Steam's API for all games in `src/lib/games.js` and writes results
to `data/games.json`. Takes about 2–3 minutes for the default game list.

### 3. Run locally
```bash
npm run dev
# Opens at http://localhost:8888
```

---

## Deploy to Netlify

### Option A — Netlify CLI (recommended)
```bash
npm install -g netlify-cli
netlify login
netlify init        # follow prompts, set publish dir to "public"
npm run fetch       # seed data locally first
git add data/games.json
git commit -m "seed game data"
netlify deploy --prod
```

### Option B — GitHub + Netlify UI
1. Push this repo to GitHub
2. Go to [app.netlify.com](https://app.netlify.com) → New site from Git
3. Set **Publish directory** to `public`
4. Set **Functions directory** to `netlify/functions`
5. Deploy

---

## Adding games

**In the UI:** Use the "Add game" panel in the sidebar, enter the name, Steam App ID,
and genre, then click "Refresh data".

**In code:** Edit `src/lib/games.js` and add an entry:
```js
{ name: "My Game", appId: "123456", genre: "survival" }
```
Find the App ID in the Steam store URL: `store.steampowered.com/app/APPID/GameName`

Then run `npm run fetch` and redeploy.

---

## Refreshing data

### Manually via the UI
Click **Refresh data** in the top nav. This calls the `/api/fetch-games` endpoint.
Takes ~2 minutes. You can protect it with a secret:

```
# In Netlify environment variables:
FETCH_SECRET=your-secret-here
```

Then the button will only work if you add the header `x-fetch-secret: your-secret-here`.

### Automatically (Netlify Pro)
The `netlify/functions/scheduled-fetch.js` function runs every day at 06:00 UTC
if you have Netlify Pro or higher. No setup needed beyond deploying.

### Via git (free tier)
Run `npm run fetch` locally, commit `data/games.json`, and push.
Netlify will redeploy automatically.

---

## Project structure

```
steamdb/
├── public/                  # Static frontend
│   ├── index.html           # Main page
│   ├── style.css            # All styles
│   └── app.js               # Frontend JS
│
├── netlify/functions/       # Serverless backend
│   ├── games.js             # GET  /api/games
│   ├── fetch-games.js       # POST /api/fetch-games
│   └── scheduled-fetch.js   # Daily auto-refresh (Netlify Pro)
│
├── src/lib/
│   ├── games.js             # Master game list
│   ├── steamFetcher.js      # Steam API logic (Fetcher Agent)
│   └── db.js                # Database read/write layer
│
├── scripts/
│   └── fetch.js             # CLI: npm run fetch
│
├── data/
│   └── games.json           # The database (flat JSON file)
│
└── netlify.toml             # Netlify config
```

---

## Upgrading the database

The `src/lib/db.js` module has a simple `getAll()` / `save()` interface.
To swap to a real database (Supabase, PlanetScale, MongoDB Atlas):

1. Install the relevant SDK
2. Replace the contents of `db.js` keeping the same exports
3. Nothing else needs to change

---

## Environment variables

| Variable       | Required | Description                              |
|----------------|----------|------------------------------------------|
| `FETCH_SECRET` | No       | Protects the /api/fetch-games endpoint   |

Set these in **Netlify → Site settings → Environment variables**.
