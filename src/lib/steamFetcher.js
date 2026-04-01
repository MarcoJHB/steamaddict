// steamFetcher.js — the Fetcher Agent
// Responsible for: hitting Steam's review API, paginating, computing stats
// Used by: netlify/functions/fetch-games.js AND scripts/fetch.js

const STEAM_REVIEW_URL = (appId) =>
  `https://store.steampowered.com/appreviews/${appId}?json=1&filter=recent&num_per_page=100&language=all`;

const STEAM_APP_URL = (appId) =>
  `https://store.steampowered.com/api/appdetails?appids=${appId}&filters=basic,price_overview`;

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Fetch up to `targetReviews` reviews for a single game
async function fetchGameReviews(appId, targetReviews = 200) {
  let cursor = "*";
  let fetched = [];
  let attempts = 0;

  while (fetched.length < targetReviews && attempts < 10) {
    attempts++;
    try {
      const url = `${STEAM_REVIEW_URL(appId)}&cursor=${encodeURIComponent(cursor)}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.success !== 1 || !data.reviews || data.reviews.length === 0) break;

      fetched = fetched.concat(data.reviews);
      cursor = data.cursor;

      if (data.reviews.length < 100) break; // last page
      await sleep(300);
    } catch (e) {
      console.error(`  Error fetching appId ${appId}:`, e.message);
      break;
    }
  }

  return fetched;
}

// Compute statistics from an array of review objects
function computeStats(reviews) {
  if (!reviews.length) return { avg: 0, median: 0, atReview: 0, lastTwoWeeks: 0, highest: 0, sampleSize: 0 };

  const totals     = reviews.map((r) => Math.round((r.author?.playtime_forever        ?? 0) / 60));
  const atReviews  = reviews.map((r) => Math.round((r.author?.playtime_at_review      ?? 0) / 60));
  const twoWeeks   = reviews.map((r) => Math.round((r.author?.playtime_last_two_weeks ?? 0) / 60));

  const avg = (arr) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  const median = (arr) => {
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
  };

  return {
    avg:          avg(totals),
    median:       median(totals),
    atReview:     avg(atReviews),
    lastTwoWeeks: avg(twoWeeks),
    highest:      Math.max(...totals),
    sampleSize:   reviews.length,
  };
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

// Main: fetch and process all games in the list
async function fetchAllGames(gamesList, { onProgress } = {}) {
  const results = [];

  for (let i = 0; i < gamesList.length; i++) {
    const game = gamesList[i];
    if (onProgress) onProgress({ game: game.name, index: i, total: gamesList.length });

    console.log(`  [${i + 1}/${gamesList.length}] Fetching ${game.name}...`);

    const [reviews, meta] = await Promise.all([
      fetchGameReviews(game.appId),
      fetchGameMeta(game.appId),
    ]);

    const stats = computeStats(reviews);

    results.push({
      ...game,
      ...meta,
      ...stats,
      fetchedAt: new Date().toISOString(),
    });

    await sleep(500); // be polite to Steam's API
  }

  return results;
}

module.exports = { fetchAllGames, fetchGameReviews, computeStats };
