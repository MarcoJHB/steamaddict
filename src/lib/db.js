// db.js — flat-file JSON database with Netlify Blobs fallback
// In production on Netlify: uses Netlify Blobs (key-value store)
// Locally or on other platforms: uses filesystem JSON file in /data
// Falls back gracefully based on environment
//
// To upgrade to a real DB later: swap this module for a Supabase/PlanetScale client
// keeping the same getAll() / save() interface — nothing else needs to change.

const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "../../data/games.json");
const BLOB_KEY = "steam-games-data";

// Try to get Netlify Blobs if available (only in Netlify Functions)
let blobsAvailable = false;
let blobnModule = null;
try {
  if (process.env.NETLIFY === "true") {
    blobnModule = require("@netlify/blobs");
    blobsAvailable = true;
  }
} catch (e) {
  // Blobs not available, fall back to filesystem
}

async function readBlobDB() {
  try {
    if (!blobnModule) return null;
    const { getStore } = blobnModule;
    const store = getStore("games");
    const data = await store.get(BLOB_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("Blob read error:", e.message);
  }
  return null;
}

async function writeBlobDB(payload) {
  try {
    if (!blobnModule) return false;
    const { getStore } = blobnModule;
    const store = getStore("games");
    await store.set(BLOB_KEY, JSON.stringify(payload));
    return true;
  } catch (e) {
    console.error("Blob write error:", e.message);
    return false;
  }
}

function readFileDB() {
  try {
    if (fs.existsSync(DB_PATH)) {
      return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
    }
  } catch (e) {
    console.error("File DB read error:", e.message);
  }
  return { games: [], lastUpdated: null };
}

function writeFileDB(payload) {
  try {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(payload, null, 2));
    return true;
  } catch (e) {
    console.error("File DB write error:", e.message);
    return false;
  }
}

module.exports = {
  async getAll() {
    if (blobsAvailable) {
      const blobData = await readBlobDB();
      if (blobData) return blobData;
    }
    // Fall back to filesystem
    return readFileDB();
  },

  async save(games) {
    const payload = { games, lastUpdated: new Date().toISOString() };
    if (blobsAvailable) {
      const blobSuccess = await writeBlobDB(payload);
      if (blobSuccess) return true;
    }
    // Fall back to filesystem (works locally, fails silently on Netlify)
    return writeFileDB(payload);
  },

  async getLastUpdated() {
    if (blobsAvailable) {
      const blobData = await readBlobDB();
      if (blobData) return blobData.lastUpdated;
    }
    return readFileDB().lastUpdated;
  },
};
