// steamFetcher.js — uses SteamSpy API for fast playtime data
// SteamSpy provides playtime stats directly (much faster than Steam reviews API)
// Used by: netlify/functions/fetch-games.js AND scripts/fetch.js

const STEAMSPY_TAG_URL = (tag) =>
  `https://steamspy.com/api.php?request=tag&tag=${tag}`;

const STEAMSPY_APPDETAILS_URL = (appId) =>
  `https://steamspy.com/api.php?request=appdetails&appid=${appId}`;

const STEAM_APP_URL = (appId) =>
  `https://store.steampowered.com/api/appdetails?appids=${appId}&filters=basic,price_overview`;

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Fetch top strategy and management games from SteamSpy
async function fetchTopGames(tags = ["strategy", "management"], limit = 100) {
  const gameMap = new Map();

  try {
    for (const tag of tags) {
      console.log(`Fetching ${tag} games from SteamSpy...`);
      const res = await fetch(STEAMSPY_TAG_URL(tag));
      const data = await res.json();

      if (data && typeof data === "object") {
        // SteamSpy returns games keyed by appId
        for (const [appIdStr, gameInfo] of Object.entries(data)) {
          const appId = parseInt(appIdStr);
          if (!isNaN(appId) && gameInfo?.name) {
            // Store with a score based on reviews and ownership
            const score = (gameInfo.positive || 0) + (gameInfo.negative || 0);
            if (!gameMap.has(appId)) {
              gameMap.set(appId, {
                appId: appIdStr,
                name: gameInfo.name,
                score,
                tags: [tag],
              });
            } else {
              gameMap.get(appId).tags.push(tag);
            }
          }
        }
      }
      await sleep(200); // be polite to SteamSpy
    }
  } catch (e) {
    console.error("Error fetching from SteamSpy:", e.message);
  }

  // Convert to array, sort by score, take top N
  const sorted = Array.from(gameMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(g => {
      // Assign genre based on tags
      let genre = "strategy";
      if (g.tags.includes("management")) genre = "management";
      else if (g.tags.includes("colony sim")) genre = "colony";
      else if (g.tags.includes("city builder")) genre = "city";
      return {
        appId: g.appId,
        name: g.name,
        genre,
      };
    });

  console.log(`Found ${sorted.length} top strategy/management games`);
  return sorted;
}

// Fetch playtime stats from SteamSpy (much faster than Steam reviews API!)
async function fetchGameStats(appId) {
  try {
    const res = await fetch(STEAMSPY_APPDETAILS_URL(appId));
    const data = await res.json();
    
    if (data && data.appid) {
      return {
        avg: Math.round(data.average_forever || 0),
        median: Math.round(data.median_forever || 0),
        atReview: Math.round(data.average_2weeks || 0),
        lastTwoWeeks: Math.round(data.median_2weeks || 0),
        highest: Math.round(data.ccu || 0),
        sampleSize: data.owners ? data.owners : null,
      };
    }
  } catch (e) {
    console.error(`  Error fetching stats for ${appId}:`, e.message);
  }
  return { avg: 0, median: 0, atReview: 0, lastTwoWeeks: 0, highest: 0, sampleSize: 0 };
}

// Fetch a single game's metadata from Steam store API
async function fetchGameMeta(appId) {
  try {
    const res  = await fetch(STEAM_APP_URL(appId));
    const data = await res.json();
    const app  = data[appId]?.data;
    if (!app) return {};
    return {
      headerImage:  app.header_image || null,
      releaseDate:  app.release_date?.date || null,
      price:        app.price_overview?.final_formatted || "Free",
      totalReviews: null,
    };
  } catch {
    return {};
  }
}

// Main: fetch and process all games in the list (uses SteamSpy for fast stats!)
async function fetchAllGames(gamesList, { onProgress } = {}) {
  const results = [];

  for (let i = 0; i < gamesList.length; i++) {
    const game = gamesList[i];
    if (onProgress) onProgress({ game: game.name, index: i, total: gamesList.length });

    console.log(`  [${i + 1}/${gamesList.length}] Fetching ${game.name}...`);

    const [stats, meta] = await Promise.all([
      fetchGameStats(game.appId),
      fetchGameMeta(game.appId),
    ]);

    results.push({
      ...game,
      ...meta,
      ...stats,
      fetchedAt: new Date().toISOString(),
    });

    await sleep(100); // be polite to SteamSpy/Steam
  }

  return results;
}

module.exports = { fetchAllGames, fetchTopGames };
