// netlify/functions/scheduled-fetch.js
// Runs automatically every hour via Netlify's scheduled functions
// Fetches fresh data and stores as both CSV (for audit) and JSON (for serving)

const { schedule } = require("@netlify/functions");
const { fetchAllGames, fetchTopGames } = require("../../src/lib/steamFetcher");
const { toCSV, fromCSV } = require("../../src/lib/csvUtils");
const fs = require("fs");
const path = require("path");

const CSV_PATH = path.join(__dirname, "../../data/games.csv");
const JSON_PATH = path.join(__dirname, "../../data/games.json");

const handler = async () => {
  try {
    console.log("[Scheduled] Starting hourly Steam data fetch...");
    
    // Step 1: Fetch top 100 games
    const games = await fetchTopGames(["strategy", "management", "colony sim", "city builder"], 100);
    console.log(`[Scheduled] Fetched ${games.length} games, fetching stats...`);
    
    // Step 2: Fetch playtime stats
    const enrichedGames = await fetchAllGames(games);
    console.log(`[Scheduled] Got stats for ${enrichedGames.length} games`);
    
    // Step 3: Save to CSV
    const csv = toCSV(enrichedGames);
    fs.mkdirSync(path.dirname(CSV_PATH), { recursive: true });
    fs.writeFileSync(CSV_PATH, csv, "utf8");
    console.log(`[Scheduled] Saved ${enrichedGames.length} games to CSV`);
    
    // Step 4: Save to JSON for instant serving
    const jsonPayload = { games: enrichedGames, lastUpdated: new Date().toISOString() };
    fs.writeFileSync(JSON_PATH, JSON.stringify(jsonPayload, null, 2), "utf8");
    console.log(`[Scheduled] Updated JSON file`);
    
    console.log("[Scheduled] Done!");
    return { statusCode: 200 };
  } catch (e) {
    console.error("[Scheduled] Error:", e.message);
    return { statusCode: 500 };
  }
};

// Runs every hour (0 minutes past every hour)
module.exports.handler = schedule("0 * * * *", handler);
