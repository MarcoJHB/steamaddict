// netlify/functions/scheduled-fetch.js
// Runs automatically every day at 6am UTC via Netlify's scheduled functions
// Requires Netlify Pro or higher for scheduled functions

const { schedule } = require("@netlify/functions");
const { fetchAllGames } = require("../../src/lib/steamFetcher");
const { GAMES }         = require("../../src/lib/games");
const db                = require("../../src/lib/db");

const handler = async () => {
  try {
    console.log("[Scheduled] Starting daily Steam fetch...");
    const games = await fetchAllGames(GAMES);
    db.save(games);
    console.log(`[Scheduled] Done. Fetched ${games.length} games.`);
    return { statusCode: 200 };
  } catch (e) {
    console.error("[Scheduled] Error:", e.message);
    return { statusCode: 500 };
  }
};

// Runs every day at 06:00 UTC
module.exports.handler = schedule("0 6 * * *", handler);
