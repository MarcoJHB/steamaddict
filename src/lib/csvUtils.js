// csvUtils.js — Convert between CSV and JSON formats for data storage
const fs = require("fs");

// Convert games array to CSV string
function toCSV(games) {
  if (!games || games.length === 0) return "";
  
  // CSV headers
  const headers = [
    "appId", "name", "genre", "headerImage", "releaseDate", "price",
    "avg", "median", "atReview", "lastTwoWeeks", "highest", "sampleSize", "fetchedAt"
  ];
  
  const rows = games.map(g => [
    g.appId,
    `"${(g.name || "").replace(/"/g, '""')}"`, // escape quotes
    g.genre,
    g.headerImage || "",
    g.releaseDate || "",
    g.price || "",
    g.avg || 0,
    g.median || 0,
    g.atReview || 0,
    g.lastTwoWeeks || 0,
    g.highest || 0,
    g.sampleSize || 0,
    g.fetchedAt || ""
  ]);
  
  return [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
}

// Convert CSV string to games array
function fromCSV(csvString) {
  const lines = csvString.trim().split("\n");
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(",");
  const games = [];
  
  for (let i = 1; i < lines.length; i++) {
    // Simple CSV parsing (handles quoted fields with commas)
    const fields = [];
    let current = "";
    let inQuotes = false;
    
    for (let j = 0; j < lines[i].length; j++) {
      const char = lines[i][j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        fields.push(current.replace(/^"|"$/g, "").replace(/""/g, '"'));
        current = "";
      } else {
        current += char;
      }
    }
    fields.push(current.replace(/^"|"$/g, "").replace(/""/g, '"'));
    
    if (fields.length === headers.length) {
      const game = {};
      headers.forEach((h, idx) => {
        const value = fields[idx];
        if (["avg", "median", "atReview", "lastTwoWeeks", "highest", "sampleSize"].includes(h)) {
          game[h] = parseInt(value) || 0;
        } else {
          game[h] = value;
        }
      });
      games.push(game);
    }
  }
  
  return games;
}

module.exports = { toCSV, fromCSV };
