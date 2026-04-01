// app.js — Frontend logic for SteamPlaytime dashboard

// ── State ──────────────────────────────────────────────
let allGames    = [];
let activeGenre = "all";
let sortKey     = "avg";
let sortDir     = -1; // -1 = descending



// ── Boot ───────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  loadData();
});

async function loadData() {
  showState("loading");
  try {
    const res  = await fetch("/api/games");
    const json = await res.json();

    if (json.games && json.games.length > 0) {
      allGames = json.games;
      updateLastUpdated(json.lastUpdated);
      updateStats();
      updateBadges();
      renderTable();
      showState("table");
    } else {
      showState("empty");
    }
  } catch (e) {
    console.error("Failed to load:", e);
    showState("empty");
  }
}

// ── Fetch trigger ──────────────────────────────────────
async function triggerFetch() {
  const btn  = document.getElementById("refreshBtn");
  const icon = document.getElementById("refreshIcon");
  btn.disabled = true;
  btn.classList.add("loading");
  toast("Fetching from Steam... this takes ~2 minutes", "");

  try {
    const res  = await fetch("/api/fetch-games", { method: "POST" });
    const json = await res.json();
    if (json.success) {
      toast(`Updated ${json.count} games`, "ok");
      await loadData();
    } else {
      toast("Fetch failed: " + (json.error || "unknown error"), "err");
    }
  } catch (e) {
    toast("Network error: " + e.message, "err");
  } finally {
    btn.disabled = false;
    btn.classList.remove("loading");
  }
}

// ── Filters ────────────────────────────────────────────
function setGenre(genre, el) {
  activeGenre = genre;
  document.querySelectorAll("[data-genre]").forEach(b => b.classList.remove("active"));
  el.classList.add("active");
  renderTable();
}

function setSort(key, el) {
  if (sortKey === key) {
    sortDir *= -1;
  } else {
    sortKey = key;
    sortDir = -1;
  }
  if (el) {
    document.querySelectorAll("[data-sort]").forEach(b => b.classList.remove("active-sort"));
    el.classList.add("active-sort");
  }
  updateSortHeaders();
  renderTable();
}

function updateSortHeaders() {
  document.querySelectorAll("thead th[data-col]").forEach(th => {
    const col = th.dataset.col;
    th.classList.toggle("sorted", col === sortKey);
    if (col === sortKey) {
      th.textContent = th.textContent.replace(/[▼▲]/g, "").trim() + " " + (sortDir === -1 ? "▼" : "▲");
    } else {
      th.textContent = th.textContent.replace(/[▼▲]/g, "").trim();
    }
  });
}

// ── Render ─────────────────────────────────────────────
function renderTable() {
  const q    = document.getElementById("search").value.toLowerCase();
  const data = allGames;

  let list = data.filter(g =>
    (activeGenre === "all" || g.genre === activeGenre) &&
    g.name.toLowerCase().includes(q)
  );

  list.sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    if (typeof av === "string") return sortDir * av.localeCompare(bv);
    return sortDir * ((av || 0) - (bv || 0));
  });

  const maxAvg = Math.max(...data.map(g => g.avg || 0), 1);

  document.getElementById("resultCount").textContent = `${list.length} game${list.length !== 1 ? "s" : ""}`;

  const tbody = document.getElementById("tbody");
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:50px;color:var(--muted);font-family:var(--mono);font-size:12px">no results</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(g => {
    const imgHtml = g.headerImage
      ? `<img class="game-img" src="${g.headerImage}" alt="${g.name}" loading="lazy" onerror="this.style.display='none'" />`
      : `<div class="game-img-placeholder">IMG</div>`;

    const barWidth = Math.round((g.avg / maxAvg) * 60);

    return `
      <tr>
        <td>
          <div class="game-cell">
            ${imgHtml}
            <span class="game-name">${g.name}</span>
          </div>
        </td>
        <td><span class="genre-tag genre-${g.genre || "survival"}">${g.genre || "—"}</span></td>
        <td class="col-num">
          <div class="bar-wrap">
            <div class="bar" style="width:${barWidth}px"></div>
            <span class="num-cell ${numClass(g.avg)}">${fmt(g.avg)}h</span>
          </div>
        </td>
        <td class="col-num num-cell ${numClass(g.atReview)}">${fmt(g.atReview)}h</td>
        <td class="col-num num-cell ${numClass(g.lastTwoWeeks)}">${fmt(g.lastTwoWeeks)}h</td>
        <td class="col-num num-cell ${numClass(g.median)}">${fmt(g.median)}h</td>
        <td class="col-num num-cell num-low">${fmtK(g.sampleSize)}</td>
      </tr>
    `;
  }).join("");
}

// ── Stats ──────────────────────────────────────────────
function updateStats() {
  const n = allGames.length;
  if (!n) return;

  const avgAll  = Math.round(allGames.reduce((a, b) => a + (b.avg || 0), 0) / n);
  const highest = allGames.reduce((a, b) => (b.avg || 0) > (a.avg || 0) ? b : a);
  const topRev  = allGames.reduce((a, b) => (b.sampleSize || 0) > (a.sampleSize || 0) ? b : a);

  setText("s-count",        n);
  setText("s-avg",          avgAll + "h");
  setText("s-high",         (highest.avg || 0) + "h");
  setText("s-high-name",    highest.name || "—");
  setText("s-reviews",      fmtK(topRev.sampleSize || 0));
  setText("s-reviews-name", topRev.name || "—");
}

function updateBadges() {
  const genres = ["all", "strategy", "management", "colony", "city", "survival", "automation", "rpg"];
  genres.forEach(g => {
    const count = g === "all" ? allGames.length : allGames.filter(d => d.genre === g).length;
    const el = document.getElementById("b-" + g);
    if (el) el.textContent = count;
  });
}

function updateLastUpdated(iso) {
  const el = document.getElementById("lastUpdated");
  if (!iso) { el.textContent = "never updated"; return; }
  const d = new Date(iso);
  el.textContent = "updated " + d.toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" });
}

// ── UI helpers ─────────────────────────────────────────
function showState(state) {
  document.getElementById("loadingState").style.display = state === "loading" ? "flex" : "none";
  document.getElementById("emptyState").style.display   = state === "empty"   ? "flex" : "none";
  document.getElementById("tableWrap").style.display    = state === "table"   ? "block" : "none";
}

function numClass(v) {
  if (!v || v === 0) return "num-zero";
  if (v >= 200) return "num-high";
  if (v >= 30)  return "num-med";
  return "num-low";
}

function fmt(n) { return n != null ? Math.round(n).toLocaleString() : "—"; }
function fmtK(n) {
  if (n == null) return "—";
  if (n >= 1000) return (n / 1000).toFixed(0) + "k";
  return n.toString();
}
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

let toastTimer;
function toast(msg, type = "") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = "toast show " + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove("show"); }, 3500);
}
