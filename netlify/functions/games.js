// netlify/functions/games.js
// GET /api/games — returns stored game data from DB
// Called by the frontend on page load

const db = require("../../src/lib/db");

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const payload = db.getAll();
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(payload),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: e.message }),
    };
  }
};
