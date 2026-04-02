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
async function fetchTopGames(tags = ["strategy", "management", "tycoon", "4X", "colony sim", "city builder"], limit = 100) {
  const gameMap = new Map();
  
  // Specific games to always include (ONLY these 8 games)
  const forcedGameIds = [
    { appId: "294100", name: "RimWorld", genre: "colony sim" },
    { appId: "784150", name: "Workers & Resources: Soviet Republic", genre: "city builder" },
    { appId: "457140", name: "Oxygen Not Included", genre: "colony sim" },
    { appId: "323090", name: "Anno 1800", genre: "city builder" },
    { appId: "255710", name: "Cities: Skylines", genre: "city builder" },
    { appId: "248570", name: "Banished", genre: "city builder" },
    { appId: "1062090", name: "Timberborn", genre: "city builder" },
    { appId: "289070", name: "Sid Meier's Civilization VI", genre: "4X" },
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

  // Add forced games to map with extremely high score to guarantee they appear first
  for (const fg of forcedGameIds) {
    gameMap.set(parseInt(fg.appId), {
      appId: fg.appId,
      name: fg.name,
      score: 999999999,  // Extremely high score to always prioritize
      tags: [fg.genre],
    });
  }

  // Convert to array, sort by score, take top N
  const sorted = Array.from(gameMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(g => {
      // Assign primary genre based on tags
      let genre = "strategy";
      if (g.tags.includes("4X")) genre = "4X";
      else if (g.tags.includes("tycoon")) genre = "tycoon";
      else if (g.tags.includes("city builder")) genre = "city builder";
      else if (g.tags.includes("colony sim")) genre = "colony sim";
      else if (g.tags.includes("management")) genre = "management";
      else if (g.tags.includes("strategy")) genre = "strategy";
      
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

// Fetch up to 1000 reviews from Steam and calculate playtime statistics
async function fetchGameReviews(appId) {
  try {
    // Try multiple filters to get as many reviews as possible
    const filters = ['recent', 'updated', 'all'];
    let allReviews = [];

    for (const filter of filters) {
      if (allReviews.length >= 1000) break; // stop if we have enough
      
      const targetCount = 1000 - allReviews.length;
      const baseUrl = `https://store.steampowered.com/appreviews/${appId}?json=1&filter=${filter}&num_per_page=100&language=all`;
      let cursor = "*";
      let totalFetched = 0;

      console.log(`    Fetching ${filter} reviews for ${appId}...`);

      while (totalFetched < targetCount && allReviews.length < 1000) {
        const url = `${baseUrl}&cursor=${encodeURIComponent(cursor)}`;

        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          }
        });

        if (!res.ok) {
          console.log(`    Steam API returned ${res.status}`);
          break;
        }

        const data = await res.json();

        if (data.success !== 1 || !data.reviews || data.reviews.length === 0) {
          break;
        }

        allReviews.push(...data.reviews);
        totalFetched += data.reviews.length;
        cursor = data.cursor;

        await sleep(100); // be polite to Steam
      }
    }

    if (allReviews.length > 0) {
      // Calculate statistics from reviews (work with minutes first, then convert to hours)
      const totalForever = allReviews.reduce((sum, r) => sum + (r.author?.playtime_forever ?? 0), 0);
      const totalAtReview = allReviews.reduce((sum, r) => sum + (r.author?.playtime_at_review ?? 0), 0);
      const totalLastTwoWeeks = allReviews.reduce((sum, r) => sum + (r.author?.playtime_last_two_weeks ?? 0), 0);
      const maxForever = Math.max(...allReviews.map(r => r.author?.playtime_forever ?? 0));

      // Average from total minutes, then convert to hours and round
      const avgForever = Math.round(totalForever / allReviews.length / 60);
      const avgAtReview = Math.round(totalAtReview / allReviews.length / 60);
      const avgLastTwoWeeks = Math.round(totalLastTwoWeeks / allReviews.length / 60);
      const highestForever = Math.round(maxForever / 60);

      console.log(`    Got ${allReviews.length} reviews, avg: ${avgForever}h all-time, ${highestForever}h highest`);

      return {
        avg: avgForever,
        atReview: avgAtReview,
        lastTwoWeeks: avgLastTwoWeeks,
        highest: highestForever,
        reviewCount: allReviews.length,
      };
    }
  } catch (e) {
    console.log(`    Failed to fetch Steam reviews:`, e.message);
  }
  return { avg: 0, atReview: 0, lastTwoWeeks: 0, highest: 0, reviewCount: 0 };
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

// Main: fetch and process all games in the list (uses Steam reviews API for actual playtime stats)
async function fetchAllGames(gamesList, { onProgress } = {}) {
  const results = [];

  for (let i = 0; i < gamesList.length; i++) {
    const game = gamesList[i];
    if (onProgress) onProgress({ game: game.name, index: i, total: gamesList.length });

    console.log(`  [${i + 1}/${gamesList.length}] Fetching ${game.name}...`);

    const [reviewStats, meta] = await Promise.all([
      fetchGameReviews(game.appId),
      fetchGameMeta(game.appId),
    ]);

    results.push({
      ...game,
      ...meta,
      avg: reviewStats.avg,
      atReview: reviewStats.atReview,
      lastTwoWeeks: reviewStats.lastTwoWeeks,
      highest: reviewStats.highest,
      sampleSize: reviewStats.reviewCount,
      rating: 0,  // Rating data not included in reviews API response
      fetchedAt: new Date().toISOString(),
    });

    await sleep(200); // be polite to Steam
  }

  return results;
}

module.exports = { fetchAllGames, fetchTopGames };
