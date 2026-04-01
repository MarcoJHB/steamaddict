// netlify/functions/fetch-games.js
// POST /api/fetch-games — manually trigger a fresh fetch and save to CSV + JSON

const { fetchAllGames, fetchTopGames } = require("../../src/lib/steamFetcher");
const { toCSV } = require("../../src/lib/csvUtils");
const fs = require("fs");
const path = require("path");

const CSV_PATH = path.join(__dirname, "../../data/games.csv");
const JSON_PATH = path.join(__dirname, "../../data/games.json");

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    console.log("Manually triggered Steam data fetch...");
    
    // Step 1: Get top 20 management games
    const games = await fetchTopGames(["management"], 20);
    
    // Step 2: Fetch playtime stats for each game
    const enrichedGames = await fetchAllGames(games, {
      onProgress: ({ game, index, total }) => {
        console.log(`  [${index + 1}/${total}] ${game}...`);
      },
    });
    
    // Step 3: Save to CSV
    const csv = toCSV(enrichedGames);
    fs.mkdirSync(path.dirname(CSV_PATH), { recursive: true });
    fs.writeFileSync(CSV_PATH, csv, "utf8");
    
    // Step 4: Save to JSON
    const jsonPayload = { games: enrichedGames, lastUpdated: new Date().toISOString() };
    fs.writeFileSync(JSON_PATH, JSON.stringify(jsonPayload, null, 2), "utf8");

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        count: enrichedGames.length,
        lastUpdated: new Date().toISOString(),
      }),
    };
  } catch (e) {
    console.error("Fetch error:", e);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: e.message }),
    };
  }
};
