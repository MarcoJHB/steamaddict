// netlify/functions/scheduled-fetch.js
// Runs automatically every day at 6am UTC via Netlify's scheduled functions
// Requires Netlify Pro or higher for scheduled functions

const { schedule } = require("@netlify/functions");
const { fetchAllGames, fetchTopGames } = require("../../src/lib/steamFetcher");
const db                = require("../../src/lib/db");

const handler = async () => {
  try {
    console.log("[Scheduled] Starting daily Steam fetch...");
    const games = await fetchTopGames(["strategy", "management", "colony sim", "city builder"], 100);
    const enrichedGames = await fetchAllGames(games);
    await db.save(enrichedGames);
    console.log(`[Scheduled] Done. Fetched ${enrichedGames.length} games.`);
    return { statusCode: 200 };
  } catch (e) {
    console.error("[Scheduled] Error:", e.message);
    return { statusCode: 500 };
  }
};

// Runs every day at 06:00 UTC
module.exports.handler = schedule("0 6 * * *", handler);
