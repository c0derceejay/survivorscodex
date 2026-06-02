/* ==========================================================================
   Trader reference — specialties and stock by game stage
   ========================================================================== */

(() => {
  let traderData = null;
  let catalogItems = {};
  let categories = [];
  let activeTraderId = null;

  function traderImageUrl(trader) {
    if (!trader?.image) return null;
    return `images/traders/${trader.image}`;
  }

  function traderPortraitHtml(trader, { size = "panel" } = {}) {
    const url = traderImageUrl(trader);
    const label = trader?.name || "Trader";
    const cls = size === "tab" ? "trader-portrait trader-portrait--tab" : "trader-portrait";
    if (!url) {
      return `<span class="${cls} trader-portrait--fallback" aria-hidden="true">${SDD.escapeHTML(label.charAt(0))}</span>`;
    }
    return `<img class="${cls}" src="${SDD.escapeHTML(url)}" alt="${SDD.escapeHTML(label)} portrait" loading="lazy" decoding="async" />`;
  }

  function renderMeta() {
    const meta = traderData.meta || {};
    const el = document.getElementById("trader-meta");
    if (!el) return;
    el.innerHTML = `
      <div class="trader-meta-grid">
        <div class="trader-meta-card">
          <span class="trader-meta-label">Hours</span>
          <strong>${SDD.escapeHTML(meta.hours || "—")}</strong>
        </div>
        <div class="trader-meta-card">
          <span class="trader-meta-label">Restock</span>
          <strong>Every ${meta.restockDays || 3} in-game days</strong>
        </div>
        <div class="trader-meta-card">
          <span class="trader-meta-label">Currency</span>
          <strong>${SDD.escapeHTML(meta.currency || "Dukes")}</strong>
        </div>
      </div>
      ${meta.notes?.length ? `<ul class="trader-meta-notes">${meta.notes.map((n) => `<li>${SDD.escapeHTML(n)}</li>`).join("")}</ul>` : ""}
      ${meta.secretStash?.length ? `
        <details class="trader-secret-stash">
          <summary>Secret Stash (Better Barter perk)</summary>
          <ul>${meta.secretStash.map((n) => `<li>${SDD.escapeHTML(n)}</li>`).join("")}</ul>
        </details>
      ` : ""}`;
  }

  function renderItemChip(entry) {
    if (entry.id && catalogItems[entry.id]) {
      const item = catalogItems[entry.id];
      const note = entry.note ? ` — ${entry.note}` : "";
      return `<a class="trader-item-chip" href="catalog.html?item=${encodeURIComponent(entry.id)}">
        <span class="trader-item-chip-icon">${SDD.itemIcon(item, categories)}</span>
        <span class="trader-item-chip-text">${SDD.escapeHTML(item.name)}<span class="muted">${SDD.escapeHTML(note)}</span></span>
      </a>`;
    }
    const label = entry.label || entry.id || "Various items";
    const note = entry.note ? ` — ${entry.note}` : "";
    return `<span class="trader-item-chip trader-item-chip--text">
      <span class="trader-item-chip-text">${SDD.escapeHTML(label)}<span class="muted">${SDD.escapeHTML(note)}</span></span>
    </span>`;
  }

  function renderTraderPanel(trader) {
    const panel = document.getElementById("trader-panel");
    if (!panel || !trader) return;
    const bands = traderData.stageBands || [];

    panel.innerHTML = `
      <header class="trader-panel-head">
        ${traderPortraitHtml(trader, { size: "panel" })}
        <div class="trader-panel-head-text">
          <h2>${SDD.escapeHTML(trader.name)}</h2>
          <p class="muted">${SDD.escapeHTML(trader.biome)} · ${SDD.escapeHTML(trader.specialty)}</p>
        </div>
      </header>
      <p class="trader-summary">${SDD.escapeHTML(trader.summary || "")}</p>
      <div class="trader-tips-grid">
        <div class="trader-tip-card">
          <h3>Good to buy</h3>
          <ul>${(trader.buyTips || []).map((t) => `<li>${SDD.escapeHTML(t)}</li>`).join("")}</ul>
        </div>
        <div class="trader-tip-card">
          <h3>Good to sell</h3>
          <ul>${(trader.sellTips || []).map((t) => `<li>${SDD.escapeHTML(t)}</li>`).join("")}</ul>
        </div>
      </div>
      <div class="trader-inventory">
        ${bands.map((band) => {
          const items = trader.inventory?.[band.id] || [];
          if (!items.length) return "";
          return `
            <section class="trader-stage-section">
              <header class="trader-stage-head">
                <h3>${SDD.escapeHTML(band.label)}</h3>
                <p class="muted">${SDD.escapeHTML(band.description || "")}</p>
              </header>
              <div class="trader-item-grid">
                ${items.map(renderItemChip).join("")}
              </div>
            </section>`;
        }).join("")}
      </div>`;
  }

  function renderTabs() {
    const tabs = document.getElementById("trader-tabs");
    if (!tabs) return;
    tabs.innerHTML = traderData.traders.map((t) =>
      `<button type="button" class="trader-tab${t.id === activeTraderId ? " active" : ""}" role="tab" aria-selected="${t.id === activeTraderId}" data-trader="${SDD.escapeHTML(t.id)}">
        ${traderPortraitHtml(t, { size: "tab" })}
        <span class="trader-tab-label">${SDD.escapeHTML(t.name.replace("Trader ", ""))}</span>
      </button>`
    ).join("");
    tabs.querySelectorAll("[data-trader]").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeTraderId = btn.dataset.trader;
        history.replaceState(null, "", `?trader=${encodeURIComponent(activeTraderId)}`);
        renderTabs();
        renderTraderPanel(traderData.traders.find((t) => t.id === activeTraderId));
      });
    });
  }

  async function boot() {
    await SDD.loadImageManifest();
    const [tradersRes, itemsRes] = await Promise.all([
      fetch("data/traders.json"),
      fetch("data/items.json"),
    ]);
    traderData = await tradersRes.json();
    const itemsJson = await itemsRes.json();
    categories = itemsJson.categories || [];
    (itemsJson.items || []).forEach((i) => { catalogItems[i.id] = i; });

    const params = new URLSearchParams(location.search);
    activeTraderId = params.get("trader") || traderData.traders[0]?.id;

    renderMeta();
    renderTabs();
    renderTraderPanel(traderData.traders.find((t) => t.id === activeTraderId));
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
