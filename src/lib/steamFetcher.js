// steamFetcher.js — uses SteamSpy API for playtime + Steam API for reviews/ratings
// SteamSpy provides playtime stats; Steam API provides reviews and ratings
// Used by: netlify/functions/fetch-games.js AND scripts/fetch.js

const STEAMSPY_TAG_URL = (tag) =>
  `https://steamspy.com/api.php?request=tag&tag=${tag}`;

const STEAMSPY_APPDETAILS_URL = (appId) =>
  `https://steamspy.com/api.php?request=appdetails&appid=${appId}`;

const STEAM_APP_URL = (appId) =>
  `https://store.steampowered.com/api/appdetails?appids=${appId}&filters=basic,price_overview`;

const STEAM_REVIEWS_URL = (appId, cursor = "*") =>
  `https://steamcommunity.com/appreviews/${appId}?json=1&num_per_page=100&cursor=${cursor}`;

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Fetch top strategy and management games from SteamSpy
async function fetchTopGames(tags = ["strategy", "management"], limit = 100) {
  const gameMap = new Map();
  
  // Specific games to always include
  const forcedGameIds = [
    { appId: "294100", name: "RimWorld", genre: "management" },
    { appId: "784150", name: "Workers & Resources: Soviet Republic", genre: "management" },
    { appId: "457140", name: "Oxygen Not Included", genre: "management" },
    { appId: "323090", name: "Anno 1800", genre: "management" },
    { appId: "255710", name: "Cities: Skylines", genre: "management" },
    { appId: "248570", name: "Banished", genre: "management" },
    { appId: "1062090", name: "Timberborn", genre: "management" },
    { appId: "289070", name: "Sid Meier's Civilization VI", genre: "management" },
  ];

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

  // Add forced games to map if not already present
  for (const fg of forcedGameIds) {
    if (!gameMap.has(parseInt(fg.appId))) {
      gameMap.set(parseInt(fg.appId), {
        appId: fg.appId,
        name: fg.name,
        score: 999999,  // High score to prioritize
        tags: [fg.genre],
      });
    }
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
        avg: Math.round((data.average_forever || 0) / 60),          // convert minutes -> hours
        median: Math.round((data.median_forever || 0) / 60),        // convert minutes -> hours
        atReview: Math.round((data.average_2weeks || 0) / 60),      // convert minutes -> hours
        lastTwoWeeks: Math.round((data.median_2weeks || 0) / 60),   // convert minutes -> hours
        highest: Math.round((data.average_forever || 0) / 60) * 1.5, // estimate from historical avg
        sampleSize: data.owners ? data.owners : null,
        steamspyRating: data.userscore || 0,  // SteamSpy rating as fallback (0-100)
      };
    }
  } catch (e) {
    console.error(`  Error fetching stats for ${appId}:`, e.message);
  }
  return { avg: 0, median: 0, atReview: 0, lastTwoWeeks: 0, highest: 0, sampleSize: 0, steamspyRating: 0 };
}

// Fetch game reviews from Steam API and calculate recommendation percentage (up to 1000 reviews)
async function fetchGameRating(appId) {
  try {
    let allReviews = [];
    let cursor = "*";
    let pageCount = 0;
    const maxPages = 10; // 10 pages * 100 reviews = 1000 max
    
    console.log(`    Fetching reviews for ${appId}...`);
    
    while (cursor && pageCount < maxPages && allReviews.length < 1000) {
      const res = await fetch(STEAM_REVIEWS_URL(appId, cursor), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
      });
      
      if (!res.ok) {
        console.log(`    Steam API returned ${res.status}, trying SteamSpy rating instead`);
        break;
      }
      
      const data = await res.json();
      
      if (!data?.reviews || data.reviews.length === 0) break;
      
      allReviews = allReviews.concat(data.reviews);
      cursor = data.cursor;
      pageCount++;
      
      await sleep(100); // be polite to Steam
    }
    
    if (allReviews.length > 0) {
      const positive = allReviews.filter(r => r.voted_up).length;
      const rating = Math.round((positive / allReviews.length) * 100);
      console.log(`    Got ${allReviews.length} reviews, ${rating}% positive`);
      return { rating, reviewCount: allReviews.length };
    }
  } catch (e) {
    console.log(`    Failed to fetch Steam reviews, will use SteamSpy rating:`, e.message);
  }
  return { rating: null, reviewCount: 0 };  // Return null to fallback to SteamSpy rating
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

// Main: fetch and process all games in the list (uses SteamSpy for stats, Steam API for reviews)
async function fetchAllGames(gamesList, { onProgress } = {}) {
  const results = [];

  for (let i = 0; i < gamesList.length; i++) {
    const game = gamesList[i];
    if (onProgress) onProgress({ game: game.name, index: i, total: gamesList.length });

    console.log(`  [${i + 1}/${gamesList.length}] Fetching ${game.name}...`);

    const [stats, meta, steamRating] = await Promise.all([
      fetchGameStats(game.appId),
      fetchGameMeta(game.appId),
      fetchGameRating(game.appId),
    ]);

    // Use Steam reviews rating if available, otherwise use SteamSpy rating
    const finalRating = steamRating.rating || stats.steamspyRating || 0;
    const reviewCount = steamRating.reviewCount || 0;

    results.push({
      ...game,
      ...meta,
      ...stats,
      rating: finalRating,  // Combined rating: Steam reviews > SteamSpy > 0
      reviewCount: reviewCount,  // Number of reviews fetched
      fetchedAt: new Date().toISOString(),
    });

    await sleep(100); // be polite to SteamSpy/Steam
  }

  return results;
}

module.exports = { fetchAllGames, fetchTopGames };
