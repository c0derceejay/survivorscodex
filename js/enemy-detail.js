/* ==========================================================================
   Enemy detail page — full profile for a single zombie
   ========================================================================== */

(() => {
  const VARIANTS = [
    { key: "normal", label: "Normal", tone: "neutral" },
    { key: "feral", label: "Feral", tone: "warn" },
    { key: "radiated", label: "Radiated", tone: "neutral" },
    { key: "charged", label: "Charged", tone: "neutral" },
    { key: "infernal", label: "Infernal", tone: "bad" },
  ];

  function threatClass(threat) {
    const t = String(threat || "").toLowerCase();
    if (t === "boss" || t === "critical") return "threat-bad";
    if (t === "high") return "threat-warn";
    return "threat-neutral";
  }

  function detailFor(enemy, detailsJson) {
    const extra = detailsJson.enemies?.[enemy.id] || {};
    const defaults = detailsJson.defaults || {};
    return {
      behavior: extra.behavior || null,
      loot: extra.loot || defaults.loot || "Rotting flesh and a loot bag.",
      combatTips: extra.combatTips || defaults.combatTips || [],
    };
  }

  function renderHealthTable(enemy) {
    const h = enemy.health || {};
    const rows = VARIANTS.filter((v) => h[v.key] != null);
    if (!rows.length) {
      return `<p class="muted">No HP data for this enemy.</p>`;
    }
    return `
      <table class="enemy-hp-table">
        <thead>
          <tr><th>Variant</th><th>Hit points</th></tr>
        </thead>
        <tbody>
          ${rows.map((v) => `
            <tr class="enemy-hp-row enemy-hp-${v.tone}">
              <td>${SDD.escapeHTML(v.label)}</td>
              <td><strong>${h[v.key]}</strong></td>
            </tr>`).join("")}
        </tbody>
      </table>`;
  }

  function renderDetail(enemy, categories, detailsJson, allEnemies) {
    const detail = detailFor(enemy, detailsJson);
    const hasIcon = SDD.hasItemImage(enemy.id);
    const tips = Array.isArray(detail.combatTips) ? detail.combatTips : [detail.combatTips].filter(Boolean);

    document.getElementById("enemy-breadcrumb-name").textContent = enemy.name;
    document.title = `${enemy.name} · Enemy codex · Survivor's Codex`;

    const idx = allEnemies.findIndex((e) => e.id === enemy.id);
    const nav = document.getElementById("enemy-nav");
    const prev = document.getElementById("enemy-prev");
    const next = document.getElementById("enemy-next");
    if (nav && idx >= 0) {
      nav.hidden = false;
      if (prev) {
        if (idx > 0) {
          prev.href = `enemy.html?id=${encodeURIComponent(allEnemies[idx - 1].id)}`;
          prev.textContent = `← ${allEnemies[idx - 1].name}`;
          prev.hidden = false;
        } else prev.hidden = true;
      }
      if (next) {
        if (idx < allEnemies.length - 1) {
          next.href = `enemy.html?id=${encodeURIComponent(allEnemies[idx + 1].id)}`;
          next.textContent = `${allEnemies[idx + 1].name} →`;
          next.hidden = false;
        } else next.hidden = true;
      }
    }

    document.getElementById("enemy-detail").innerHTML = `
      <header class="enemy-detail-head">
        <div class="enemy-detail-portrait ${hasIcon ? "has-game-icon" : ""}">
          <div class="item-img item-img--portrait">${SDD.itemImage(enemy, categories)}</div>
        </div>
        <div class="enemy-detail-meta">
          <span class="eyebrow">Vanilla enemy</span>
          <h1>${SDD.escapeHTML(enemy.name)}</h1>
          ${enemy.aliases?.length ? `<p class="muted enemy-aliases">Also known as: ${SDD.escapeHTML(enemy.aliases.join(", "))}</p>` : ""}
          <p class="enemy-detail-summary">${SDD.escapeHTML(enemy.summary || "")}</p>
          <div class="enemy-detail-badges">
            <span class="threat-pill ${threatClass(enemy.threat)}">${SDD.escapeHTML(enemy.threat || "Unknown")} threat</span>
            <span class="tier-pill tier-${enemy.tier}">Stage tier T${enemy.tier}</span>
            ${enemy.entityId ? `<code class="enemy-entity-id">${SDD.escapeHTML(enemy.entityId)}</code>` : ""}
          </div>
        </div>
      </header>

      <div class="enemy-detail-grid">
        <section class="enemy-detail-section">
          <h2>Health by variant</h2>
          ${renderHealthTable(enemy)}
          <p class="muted enemy-hp-note">Feral and higher variants appear at increased game stage and in harder biomes.</p>
        </section>

        <section class="enemy-detail-section">
          <h2>Where they spawn</h2>
          <div class="tag-list">${(enemy.biomes || []).map((b) => `<span class="tag">${SDD.escapeHTML(b)}</span>`).join("") || `<span class="tag tag-muted">Various</span>`}</div>
          ${(enemy.uses || []).length ? `
            <h3 class="enemy-subhead">Best known for</h3>
            <div class="tag-list">${enemy.uses.map((u) => `<span class="tag">${SDD.escapeHTML(u)}</span>`).join("")}</div>
          ` : ""}
        </section>

        ${detail.behavior ? `
          <section class="enemy-detail-section enemy-detail-wide">
            <h2>Behavior</h2>
            <p>${SDD.escapeHTML(detail.behavior)}</p>
          </section>
        ` : ""}

        <section class="enemy-detail-section">
          <h2>Loot</h2>
          <p>${SDD.escapeHTML(detail.loot)}</p>
        </section>

        <section class="enemy-detail-section enemy-detail-wide">
          <h2>Combat tips</h2>
          <ul class="enemy-tips">${tips.map((t) => `<li>${SDD.escapeHTML(t)}</li>`).join("")}</ul>
        </section>
      </div>

      <div class="enemy-detail-actions">
        <a class="btn btn-primary" href="catalog.html?cat=enemies&enemy=${encodeURIComponent(enemy.id)}">Open in catalog</a>
        <a class="btn btn-ghost" href="enemies.html">Back to codex</a>
      </div>`;

    const detailRoot = document.getElementById("enemy-detail");
    SDD.attachItemPhotoHandlers?.(detailRoot);
  }

  async function boot() {
    const id = new URLSearchParams(location.search).get("id");
    const container = document.getElementById("enemy-detail");
    if (!id) {
      location.replace("enemies.html");
      return;
    }

    await SDD.loadImageManifest();
    const [itemsRes, detailsRes] = await Promise.all([
      fetch("data/items.json"),
      fetch("data/enemy-details.json"),
    ]);
    const data = await itemsRes.json();
    const detailsJson = await detailsRes.json();
    const categories = data.categories || [];
    const allEnemies = (data.items || [])
      .filter((i) => i.category === "enemies")
      .sort((a, b) => a.name.localeCompare(b.name));
    const enemy = allEnemies.find((e) => e.id === id);

    if (!enemy) {
      document.getElementById("enemy-breadcrumb-name").textContent = "Not found";
      container.innerHTML = `<div class="empty-state">Enemy not found. <a href="enemies.html">Browse the codex</a>.</div>`;
      return;
    }

    renderDetail(enemy, categories, detailsJson, allEnemies);
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
