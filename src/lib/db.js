// db.js — flat-file JSON database
// In production: stores data as a JSON file in /data (committed to repo for Netlify to serve)
// On Netlify: use Netlify Blobs (key-value store) if available, else fall back to static JSON
//
// To upgrade to a real DB later: swap this module for a Supabase/PlanetScale client
// keeping the same getAll() / save() interface — nothing else needs to change.

const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "../../data/games.json");

function readDB() {
  try {
    if (fs.existsSync(DB_PATH)) {
      return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
    }
  } catch (e) {
    console.error("DB read error:", e.message);
  }
  return { games: [], lastUpdated: null };
}

function writeDB(payload) {
  try {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(payload, null, 2));
    return true;
  } catch (e) {
    console.error("DB write error:", e.message);
    return false;
  }
}

module.exports = {
  getAll() {
    return readDB();
  },

  save(games) {
    return writeDB({ games, lastUpdated: new Date().toISOString() });
  },

  getLastUpdated() {
    return readDB().lastUpdated;
  },
};
