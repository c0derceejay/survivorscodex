/* ==========================================================================
   Enemy codex index — browse all vanilla zombies
   ========================================================================== */

(() => {
  const VARIANTS = [
    { key: "normal", label: "Normal" },
    { key: "feral", label: "Feral" },
    { key: "radiated", label: "Radiated" },
    { key: "charged", label: "Charged" },
    { key: "infernal", label: "Infernal" },
  ];

  let enemies = [];
  let categories = [];
  let query = "";
  let threatFilter = "all";

  const THREAT_ORDER = ["Low", "Medium", "High", "Critical", "Boss"];

  function threatClass(threat) {
    const t = String(threat || "").toLowerCase();
    if (t === "boss" || t === "critical") return "threat-bad";
    if (t === "high") return "threat-warn";
    return "threat-neutral";
  }

  function hpSummary(enemy) {
    const h = enemy.health || {};
    const normal = h.normal;
    const feral = h.feral;
    if (normal != null && feral != null) return `${normal} / ${feral} HP`;
    if (normal != null) return `${normal} HP`;
    const first = VARIANTS.map((v) => h[v.key]).find((n) => n != null);
    return first != null ? `${first} HP` : "—";
  }

  function filteredEnemies() {
    const q = query.trim().toLowerCase();
    return enemies.filter((e) => {
      if (threatFilter !== "all" && e.threat !== threatFilter) return false;
      if (!q) return true;
      const blob = [
        e.name,
        ...(e.aliases || []),
        e.entityId,
        e.summary,
        e.threat,
        ...(e.biomes || []),
        ...(e.uses || []),
      ].join(" ").toLowerCase();
      return blob.includes(q);
    });
  }

  function renderThreatFilters() {
    const wrap = document.getElementById("enemy-threat-filters");
    if (!wrap) return;
    const counts = { all: enemies.length };
    enemies.forEach((e) => {
      counts[e.threat] = (counts[e.threat] || 0) + 1;
    });
    const buttons = [
      `<button type="button" class="build-type-filter${threatFilter === "all" ? " active" : ""}" data-threat="all">All (${counts.all})</button>`,
      ...THREAT_ORDER.filter((t) => counts[t]).map((t) =>
        `<button type="button" class="build-type-filter${threatFilter === t ? " active" : ""}" data-threat="${SDD.escapeHTML(t)}">${SDD.escapeHTML(t)} (${counts[t]})</button>`
      ),
    ];
    wrap.innerHTML = buttons.join("");
    wrap.querySelectorAll("[data-threat]").forEach((btn) => {
      btn.addEventListener("click", () => {
        threatFilter = btn.dataset.threat;
        renderThreatFilters();
        renderGrid();
      });
    });
  }

  function renderGrid() {
    const grid = document.getElementById("enemy-grid");
    const countEl = document.getElementById("enemy-result-count");
    const list = filteredEnemies();
    if (countEl) {
      countEl.textContent = list.length
        ? `${list.length} enem${list.length === 1 ? "y" : "ies"}`
        : "No enemies match your filters.";
    }
    if (!grid) return;
    if (!list.length) {
      grid.innerHTML = `<div class="empty-state">No enemies match. Try clearing the search or threat filter.</div>`;
      return;
    }
    grid.innerHTML = list.map((e) => {
      const hasIcon = SDD.hasItemImage(e.id);
      return `
        <a class="item-card codex-enemy-card item-card--enemy ${hasIcon ? "has-game-icon" : ""}" href="enemy.html?id=${encodeURIComponent(e.id)}">
          <div class="item-img item-img--portrait">${SDD.itemImage(e, categories)}</div>
          <div class="item-body">
            <div class="item-head">
              <div>
                <div class="item-title">${SDD.escapeHTML(e.name)}</div>
                <div class="item-cat">${SDD.escapeHTML((e.biomes || []).slice(0, 2).join(" · ") || "Various biomes")}</div>
              </div>
              <span class="threat-pill ${threatClass(e.threat)}">${SDD.escapeHTML(e.threat || "?")}</span>
            </div>
            <p class="item-summary">${SDD.escapeHTML(e.summary || "")}</p>
            <div class="item-meta">
              <span>HP <strong>${SDD.escapeHTML(hpSummary(e))}</strong></span>
              <span>Tier <strong>T${e.tier}</strong></span>
            </div>
          </div>
        </a>`;
    }).join("");
    SDD.attachItemPhotoHandlers?.(grid);
  }

  async function boot() {
    await SDD.loadImageManifest();
    const [itemsRes] = await Promise.all([fetch("data/items.json")]);
    const data = await itemsRes.json();
    categories = data.categories || [];
    enemies = (data.items || [])
      .filter((i) => i.category === "enemies")
      .sort((a, b) => a.name.localeCompare(b.name));

    const searchEl = document.getElementById("enemy-search");
    let timer = null;
    searchEl?.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        query = searchEl.value;
        renderGrid();
      }, 180);
    });

    renderThreatFilters();
    renderGrid();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
