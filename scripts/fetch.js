#!/usr/bin/env node
// scripts/fetch.js
// Run with: node scripts/fetch.js
// or:        npm run fetch
//
// Fetches the top 100 strategy and management games from SteamSpy
// Saves to both CSV (for audit/backup) and JSON (for serving)

const { fetchAllGames, fetchTopGames } = require("../src/lib/steamFetcher");
const { toCSV } = require("../src/lib/csvUtils");
const fs = require("fs");
const path = require("path");

const CSV_PATH = path.join(__dirname, "../data/games.csv");
const JSON_PATH = path.join(__dirname, "../data/games.json");

(async () => {
  console.log(`\nSteam Strategy & Management Games Fetcher`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  const start = Date.now();

  try {
    // Step 1: Get top 20 management games
    console.log("Fetching top 20 management games from SteamSpy...\n");
    const games = await fetchTopGames(["management"], 20);

    // Step 2: Fetch playtime stats
    console.log(`\nFetching playtime stats for ${games.length} games...\n`);
    const enrichedGames = await fetchAllGames(games, {
      onProgress: ({ game, index, total }) => {
        const pct = Math.round(((index) / total) * 100);
        process.stdout.write(`\r  Progress: ${pct}% — ${game.padEnd(30)}`);
      },
    });

    // Step 3: Save to CSV
    const csv = toCSV(enrichedGames);
    fs.mkdirSync(path.dirname(CSV_PATH), { recursive: true });
    fs.writeFileSync(CSV_PATH, csv, "utf8");

    // Step 4: Save to JSON
    const jsonPayload = { games: enrichedGames, lastUpdated: new Date().toISOString() };
    fs.writeFileSync(JSON_PATH, JSON.stringify(jsonPayload, null, 2), "utf8");

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`Done in ${elapsed}s`);
    console.log(`✓ Saved ${enrichedGames.length} management games to data/games.csv`);
    console.log(`✓ Saved ${enrichedGames.length} management games to data/games.json`);
    console.log(`\nTop 5 by avg playtime:`);

    enrichedGames
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5)
      .forEach((g, i) => {
        console.log(`  ${i + 1}. ${g.name.padEnd(30)} ${g.avg}h avg`);
      });

    console.log(`\nCommit both CSV and JSON files to deploy updated data.\n`);
  } catch (e) {
    console.error("\nFetch failed:", e.message);
    process.exit(1);
  }
})();
