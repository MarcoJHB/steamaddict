#!/usr/bin/env node
// scripts/fetch.js
// Run with: node scripts/fetch.js
// or:        npm run fetch
//
// Fetches the top 100 strategy and management games and writes results to data/games.json
// Commit that file to git so Netlify serves it immediately on deploy

const { fetchAllGames, fetchTopGames } = require("../src/lib/steamFetcher");
const db                = require("../src/lib/db");

(async () => {
  console.log(`\nSteam Strategy & Management Games Fetcher`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  const start = Date.now();

  try {
    // Step 1: Get top 100 games
    console.log("Fetching top strategy & management games from SteamSpy...\n");
    const games = await fetchTopGames(["strategy", "management"], 100);

    // Step 2: Fetch playtime stats
    console.log(`\nFetching playtime stats for ${games.length} games...\n`);
    const enrichedGames = await fetchAllGames(games, {
      onProgress: ({ game, index, total }) => {
        const pct = Math.round(((index) / total) * 100);
        process.stdout.write(`\r  Progress: ${pct}% — ${game.padEnd(30)}`);
      },
    });

    // Step 3: Save to DB
    db.save(enrichedGames);

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`\n\nDone in ${elapsed}s`);
    console.log(`Saved ${enrichedGames.length} games to data/games.json`);
    console.log(`\nTop 5 by avg playtime:`);

    enrichedGames
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
