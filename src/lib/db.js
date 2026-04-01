// db.js — flat-file JSON database
// Reads from data/games.json (committed to git)
// When running CLI locally, updates data/games.json
// On Netlify: serves static data/games.json file
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
  async getAll() {
    return readDB();
  },

  async save(games) {
    return writeDB({ games, lastUpdated: new Date().toISOString() });
  },

  async getLastUpdated() {
    return readDB().lastUpdated;
  },
};
