#!/usr/bin/env node
// scripts/fetch.js
// Run with: node scripts/fetch.js
// or:        npm run fetch
//
// Fetches all games and writes results to data/games.json
// Commit that file to git so Netlify serves it immediately on deploy

const { fetchAllGames } = require("../src/lib/steamFetcher");
const { GAMES }         = require("../src/lib/games");
const db                = require("../src/lib/db");

(async () => {
  console.log(`\nSteam Playtime Fetcher`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Fetching ${GAMES.length} games...\n`);

  const start = Date.now();

  try {
    const games = await fetchAllGames(GAMES, {
      onProgress: ({ game, index, total }) => {
        const pct = Math.round(((index) / total) * 100);
        process.stdout.write(`\r  Progress: ${pct}% — ${game.padEnd(30)}`);
      },
    });

    db.save(games);

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`\n\nDone in ${elapsed}s`);
    console.log(`Saved ${games.length} games to data/games.json`);
    console.log(`\nTop 5 by avg playtime:`);

    games
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5)
      .forEach((g, i) => {
        console.log(`  ${i + 1}. ${g.name.padEnd(30)} ${g.avg}h avg`);
      });

    console.log(`\nCommit data/games.json to deploy updated data.\n`);
  } catch (e) {
    console.error("\nFetch failed:", e.message);
    process.exit(1);
  }
})();
