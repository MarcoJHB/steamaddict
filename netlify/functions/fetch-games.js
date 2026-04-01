// netlify/functions/fetch-games.js
// POST /api/fetch-games — triggers a fresh fetch from Steam and updates the DB
// Protect this with a secret token in production (set FETCH_SECRET env var)

const { fetchAllGames } = require("../../src/lib/steamFetcher");
const { GAMES }         = require("../../src/lib/games");
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

  // Optional: protect with a secret token
  const secret = process.env.FETCH_SECRET;
  if (secret) {
    const provided = event.headers["x-fetch-secret"] || "";
    if (provided !== secret) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: "Unauthorized" }) };
    }
  }

  try {
    console.log("Starting Steam data fetch...");
    const games = await fetchAllGames(GAMES);
    await db.save(games);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        count: games.length,
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
