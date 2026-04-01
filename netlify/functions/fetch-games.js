// netlify/functions/fetch-games.js
// POST /api/fetch-games — triggers a fresh fetch of top strategy/management games from Steam and updates the DB

const { fetchAllGames, fetchTopGames } = require("../../src/lib/steamFetcher");
const db                = require("../../src/lib/db");

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
    console.log("Fetching top strategy, management, colony sim, and city building games from Steam...");
    
    // Step 1: Get top 100 games
    const games = await fetchTopGames(["strategy", "management", "colony sim", "city builder"], 100);
    
    // Step 2: Fetch playtime stats for each game
    const enrichedGames = await fetchAllGames(games, {
      onProgress: ({ game, index, total }) => {
        console.log(`  [${index + 1}/${total}] ${game}...`);
      },
    });
    
    // Step 3: Save to DB
    await db.save(enrichedGames);

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
