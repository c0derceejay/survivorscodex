/* Catalog page — item grid, filters, detail modal */
(() => {
let catalog = { items: [], categories: [] };
    let usedInMap = {};
    let itemById = {};
    let activeCategory = "";
    let activeTier = "";
    let query = "";
    let modalItem = null;
    let modalQuality = 6;

    const grid = document.getElementById("catalog");
    const chipBar = document.getElementById("cat-chips");
    const search = document.getElementById("search");
    const tierFilter = document.getElementById("tier-filter");
    const modal = document.getElementById("item-modal");

    // ---- Render category chips ----
    function renderChips() {
      const all = `<button class="chip ${activeCategory === "" ? "active" : ""}" data-cat="">All (${catalog.items.length})</button>`;
      const counts = {};
      catalog.items.forEach((i) => (counts[i.category] = (counts[i.category] || 0) + 1));
      const chips = catalog.categories.map((c) =>
        `<button class="chip ${activeCategory === c.id ? "active" : ""}" data-cat="${c.id}">${c.name} <span style="opacity:.55">${counts[c.id] || 0}</span></button>`
      ).join("");
      chipBar.innerHTML = all + chips;
      chipBar.querySelectorAll(".chip").forEach((b) => {
        b.addEventListener("click", () => {
          activeCategory = b.dataset.cat;
          renderChips();
          renderGrid();
          updateUrl();
        });
      });
    }

    // ---- Render the item grid ----
    function renderGrid() {
      const q = query.trim().toLowerCase();
      grid.classList.toggle("codex-enemy-grid", activeCategory === "enemies");
      const filtered = catalog.items.filter((i) => {
        if (activeCategory && i.category !== activeCategory) return false;
        if (activeTier && String(i.tier) !== activeTier) return false;
        if (!q) return true;
        const usedInNames = (usedInMap[i.id] || []).map((id) => itemById[id]?.name || "").join(" ");
        const ingredientNames = (i.recipe?.ingredients || [])
          .map((ing) => ing.name || "")
          .concat(i.ingredients || [])
          .join(" ");
        const recipeStation = i.recipe?.craftAreaLabel || i.recipe?.craftArea || "";
        const blob = (
          i.name + " " + (i.aliases || []).join(" ") + " " + (i.entityId || "") + " "
          + (i.summary || "") + " " + (i.perk || "") + " " + (i.uses || []).join(" ") + " "
          + ingredientNames + " " + usedInNames + " " + recipeStation
        ).toLowerCase();
        return blob.includes(q);
      });

      if (!filtered.length) {
        grid.innerHTML = `<div class="empty-state">No items match those filters. Try clearing the search or category.</div>`;
        return;
      }

      const cats = Object.fromEntries(catalog.categories.map((c) => [c.id, c.name]));
      grid.innerHTML = filtered.map((i) => {
        const fav = SDD.Store.isFavorite(i.id);
        const hasIcon = SDD.hasItemImage(i.id);
        const isEnemy = i.category === "enemies";
        const cardClass = [
          "item-card",
          hasIcon ? "has-game-icon" : "",
          isEnemy ? "item-card--enemy" : "",
        ].filter(Boolean).join(" ");
        const imgClass = isEnemy ? "item-img item-img--portrait" : "item-img";
        return `
          <article class="${cardClass}" data-id="${i.id}" tabindex="0" role="button" aria-label="${SDD.escapeHTML(i.name)}">
            <div class="${imgClass}">${SDD.itemImage(i, catalog.categories)}</div>
            <button class="fav-btn ${fav ? "is-fav" : ""}" data-fav="${i.id}" aria-label="Favorite ${SDD.escapeHTML(i.name)}" type="button">★</button>
            <div class="item-body">
              <div class="item-head">
                <div>
                  <div class="item-title">${SDD.escapeHTML(i.name)}</div>
                  <div class="item-cat">${SDD.escapeHTML(cats[i.category] || i.category)}</div>
                </div>
                <span class="tier-pill tier-${i.tier}">T${i.tier}</span>
              </div>
              <p class="item-summary">${SDD.escapeHTML(i.summary || "")}</p>
              <div class="item-meta">
                <span>Stack <strong>${i.stack ?? "—"}</strong></span>
                <span>Wt <strong>${i.weight ?? 0}</strong></span>
                ${i.perk ? `<span>Perk <strong>${SDD.escapeHTML(i.perk)}</strong></span>` : ""}
              </div>
            </div>
          </article>`;
      }).join("");

      grid.querySelectorAll(".item-card").forEach((card) => {
        card.addEventListener("click", (e) => {
          if (e.target.closest(".fav-btn")) return;
          openItem(card.dataset.id);
        });
        card.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openItem(card.dataset.id);
          }
        });
      });
      grid.querySelectorAll(".fav-btn").forEach((b) => {
        b.addEventListener("click", async (e) => {
          e.stopPropagation();
          const added = await SDD.Store.toggleFavorite(b.dataset.fav);
          b.classList.toggle("is-fav", added);
          SDD.toast(added ? "Added to favorites." : "Removed from favorites.");
        });
      });
    }

    function renderModalTooltip() {
      if (!modalItem) return;
      const wrap = modal.querySelector("#modal-quality-wrap");
      wrap.innerHTML = ItemTooltips.supportsQuality(modalItem)
        ? ItemTooltips.renderQualityPicker(modalItem, modalQuality)
        : "";
      modal.querySelector("#modal-tooltip").innerHTML = ItemTooltips.renderItemTooltip(modalItem, modalQuality);
    }

    function renderRecipeInputs(item) {
      const heading = modal.querySelector("#modal-recipe-heading");
      const wrap = modal.querySelector("#modal-ingredients");

      if (item.entityId) {
        heading.textContent = "Recipe inputs";
        wrap.innerHTML = `<span class="tag tag-muted">Spawned in world</span>`;
        return;
      }

      const recipe = item.recipe;
      if (recipe?.craftAreaLabel) {
        heading.textContent = `Recipe inputs · ${recipe.craftAreaLabel}`;
      } else {
        heading.textContent = "Recipe inputs";
      }

      if (recipe?.ingredients?.length) {
        wrap.innerHTML = recipe.ingredients.map((ing) => {
          const label = `${ing.count}× ${ing.name}`;
          if (ing.id && catalog.items.some((x) => x.id === ing.id)) {
            return `<button type="button" class="tag recipe-link" data-recipe-item="${SDD.escapeHTML(ing.id)}">${SDD.escapeHTML(label)}</button>`;
          }
          return `<span class="tag">${SDD.escapeHTML(label)}</span>`;
        }).join("");
        if (recipe.hasQualityScaling) {
          wrap.innerHTML += `<p class="recipe-note muted">Higher qualities require additional materials.</p>`;
        }
        return;
      }

      if (recipe?.forgeOnly) {
        wrap.innerHTML = `<span class="tag tag-muted">Forge or salvage (material-based)</span>`;
        return;
      }

      const legacy = item.ingredients || [];
      if (legacy.length && legacy[0] !== "See in-game recipe / loot tables") {
        wrap.innerHTML = legacy.map((g) => `<span class="tag">${SDD.escapeHTML(g)}</span>`).join("");
        return;
      }

      wrap.innerHTML = `<p class="muted" style="margin:0">Not in the standard recipe list. Loot, trader, or workstation only.</p>`;
    }

    function renderUsedIn(item) {
      const heading = modal.querySelector("#modal-used-in-heading");
      const wrap = modal.querySelector("#modal-used-in");
      const ids = usedInMap[item.id] || [];
      if (!ids.length) {
        heading.hidden = true;
        wrap.innerHTML = "";
        return;
      }
      heading.hidden = false;
      wrap.innerHTML = ids.map((id) => {
        const name = itemById[id]?.name || id;
        return `<button type="button" class="tag tag-link" data-used-in="${SDD.escapeHTML(id)}">${SDD.escapeHTML(name)}</button>`;
      }).join("");
    }

    // ---- Modal ----
    function openItem(id) {
      const i = catalog.items.find((x) => x.id === id);
      if (!i) return;
      modalItem = i;
      modalQuality = ItemTooltips.supportsQuality(i) ? 6 : 1;
      const cats = Object.fromEntries(catalog.categories.map((c) => [c.id, c.name]));
      const isEntity = Boolean(i.entityId);
      modal.querySelector("#modal-img").classList.toggle("modal-img--portrait", isEntity);
      modal.querySelector("#modal-img").innerHTML = SDD.itemImage(i, catalog.categories);
      modal.querySelector("#modal-title").textContent = i.name;
      modal.querySelector("#modal-cat").textContent = isEntity
        ? `${cats[i.category] || i.category} · ${i.threat || "Unknown"} threat`
        : `${cats[i.category] || i.category} · Craft tier ${i.tier}`;
      modal.querySelector("#modal-summary").textContent = i.summary || "";
      renderModalTooltip();
      modal.querySelector("#modal-kv").innerHTML = isEntity
        ? `
        <div><span>Threat</span><span>${SDD.escapeHTML(i.threat || "—")}</span></div>
        <div><span>Entity ID</span><span><code>${SDD.escapeHTML(i.entityId || "—")}</code></span></div>
        ${i.aliases?.length ? `<div><span>Also known as</span><span>${SDD.escapeHTML(i.aliases.join(", "))}</span></div>` : ""}
        <div><span>Game stage tier</span><span>T${i.tier}</span></div>
        ${i.biomes?.length ? `<div><span>Biomes</span><span>${SDD.escapeHTML(i.biomes.join(", "))}</span></div>` : ""}
      `
        : `
        <div><span>Craft tier</span><span>T${i.tier}</span></div>
        <div><span>Stack size</span><span>${i.stack ?? "—"}</span></div>
        <div><span>Weight</span><span>${i.weight ?? 0}</span></div>
        ${i.perk ? `<div><span>Boosts via</span><span>${SDD.escapeHTML(i.perk)}</span></div>` : ""}
      `;
      renderRecipeInputs(i);
      renderUsedIn(i);
      const profileLink = modal.querySelector("#modal-enemy-profile");
      if (profileLink) {
        if (isEntity) {
          profileLink.href = `enemy.html?id=${encodeURIComponent(i.id)}`;
          profileLink.hidden = false;
        } else {
          profileLink.hidden = true;
        }
      }
      modal.querySelector("#modal-uses").innerHTML = (i.uses || []).map((u) => `<span class="tag">${SDD.escapeHTML(u)}</span>`).join("");
      const favBtn = modal.querySelector("#modal-fav");
      const setFavLabel = () => {
        const isFav = SDD.Store.isFavorite(i.id);
        favBtn.textContent = isFav ? "★ Favorited" : "★ Favorite";
        favBtn.classList.toggle("btn-primary", !isFav);
        favBtn.classList.toggle("btn-ghost", isFav);
      };
      setFavLabel();
      favBtn.onclick = async () => {
        const added = await SDD.Store.toggleFavorite(i.id);
        SDD.toast(added ? "Added to favorites." : "Removed from favorites.");
        setFavLabel();
        const card = grid.querySelector(`[data-fav="${i.id}"]`);
        if (card) card.classList.toggle("is-fav", added);
      };
      modal.classList.add("open");
    }
    modal.querySelector("#modal-quality-wrap").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-quality]");
      if (!btn || !modalItem) return;
      modalQuality = Number(btn.dataset.quality);
      renderModalTooltip();
    });

    modal.querySelector("#modal-ingredients").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-recipe-item]");
      if (!btn) return;
      openItem(btn.dataset.recipeItem);
    });
    modal.querySelector("#modal-used-in").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-used-in]");
      if (!btn) return;
      openItem(btn.dataset.usedIn);
    });
    modal.querySelector(".modal-close").addEventListener("click", () => modal.classList.remove("open"));
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("open"); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") modal.classList.remove("open"); });

    // ---- URL state ----
    function updateUrl() {
      const params = new URLSearchParams();
      if (activeCategory) params.set("cat", activeCategory);
      if (activeTier) params.set("tier", activeTier);
      if (query) params.set("q", query);
      const qs = params.toString();
      history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
    }
    function readUrl() {
      const p = new URLSearchParams(location.search);
      activeCategory = p.get("cat") || "";
      activeTier = p.get("tier") || "";
      query = p.get("q") || "";
      search.value = query;
      tierFilter.value = activeTier;
      return p.get("item") || p.get("enemy") || "";
    }

    search.addEventListener("input", () => { query = search.value; renderGrid(); updateUrl(); });
    tierFilter.addEventListener("change", () => { activeTier = tierFilter.value; renderGrid(); updateUrl(); });

    async function bootCatalog() {
      const [itemsRes, usedInRes] = await Promise.all([
        fetch("data/items.json"),
        fetch("data/recipe-used-in.json"),
        SDD.loadImageManifest(),
        ItemTooltips.loadItemStats(),
      ]);
      catalog = await itemsRes.json();
      usedInMap = usedInRes.ok ? await usedInRes.json() : {};
      itemById = Object.fromEntries(catalog.items.map((i) => [i.id, i]));
      const openId = readUrl();
      renderChips();
      renderGrid();
      if (openId && itemById[openId]) {
        requestAnimationFrame(() => openItem(openId));
      }
    }
  bootCatalog();
})();
