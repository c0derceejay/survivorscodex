/* ==========================================================================
   Loadout mannequin — 2D paper-doll (armor) + gear panels
   ========================================================================== */

(() => {
  const GRID_VISIBLE = 4;

  const BODY_SLOTS = [
    { id: "head", label: "Head", area: "head", armorKey: "head" },
    { id: "chest", label: "Chest", area: "chest", armorKey: "chest" },
    { id: "hands", label: "Hands", area: "hands", armorKey: "hands" },
    { id: "feet", label: "Feet", area: "feet", armorKey: "feet" },
  ];

  const SILHOUETTE_HTML = `<img class="paper-doll__silhouette" src="images/mannequin-base.svg" alt="" width="120" height="200" decoding="async" />`;

  function findCatalogItem(items, id) {
    return items?.find((i) => i.id === id) || { id, name: id, category: "resources", tier: 1 };
  }

  function renderGameIcon(itemId, catalogItems, categories) {
    const item = findCatalogItem(catalogItems, itemId);
    if (window.SDD?.itemIcon) return SDD.itemIcon(item, categories);
    if (window.SDD?.itemImage) return SDD.itemImage(item, categories);
    return `<span class="loadout-game-icon-fallback">${item.name?.charAt(0) || "?"}</span>`;
  }

  function armorPieceForSlot(armorSet, slotId) {
    const pieces = SDD.Loadout?.armorSets?.[armorSet]?.pieces || [];
    const suffix = {
      head: "-helmet",
      chest: "-outfit",
      hands: "-gloves",
      feet: "-boots",
    }[slotId];
    if (!suffix) return null;
    return pieces.find((p) => p.endsWith(suffix)) || null;
  }

  function modCount(loadout, itemId) {
    const mods = loadout.mods?.[itemId];
    if (!mods || typeof mods !== "object") return 0;
    return Object.values(mods).filter(Boolean).length;
  }

  function qualityBadge(itemId, loadout, catalogItems) {
    const item = findCatalogItem(catalogItems, itemId);
    if (!window.ItemTooltips?.supportsQuality?.(item)) return "";
    const quality = SDD.Loadout.getItemQuality(loadout, itemId);
    const meta = ItemTooltips.qualityMeta(quality);
    const color = meta?.color || "var(--color-text-mute)";
    return `<span class="mannequin-slot__q" style="--q-color:${color}">Q${quality}</span>`;
  }

  function renderSlotItem(itemId, loadout, catalogItems, categories, iconOnly = false) {
    const esc = SDD.escapeHTML;
    const item = findCatalogItem(catalogItems, itemId);
    const mods = modCount(loadout, itemId);
    return `
      <div class="mannequin-slot__item" title="${esc(item.name)}">
        <span class="mannequin-slot__icon">${renderGameIcon(itemId, catalogItems, categories)}</span>
        ${iconOnly ? "" : `<span class="mannequin-slot__name">${esc(item.name)}</span>`}
        ${qualityBadge(itemId, loadout, catalogItems)}
        ${mods ? `<span class="mannequin-slot__mods" title="${mods} mod${mods === 1 ? "" : "s"}">${mods}</span>` : ""}
      </div>`;
  }

  function renderEmptySlot(label) {
    const esc = SDD.escapeHTML;
    return `<span class="mannequin-slot__ghost" aria-hidden="true"><span class="mannequin-slot__ghost-label">${esc(label)}</span></span>`;
  }

  function resolveSlots(loadout, catalogItems) {
    const normalized = SDD.Loadout.normalizeLoadout(loadout || {}, catalogItems);
    return {
      normalized,
      slots: {
        armorSet: normalized.armorSet || null,
        weapons: normalized.weapons || [],
        tools: normalized.tools || [],
        medical: normalized.medical || [],
      },
    };
  }

  function resolvePaperDoll(loadout, catalogItems) {
    const { normalized, slots } = resolveSlots(loadout, catalogItems);
    const body = {};
    for (const key of ["head", "chest", "hands", "feet"]) {
      body[key] = slots.armorSet ? armorPieceForSlot(slots.armorSet, key) : null;
    }
    return { normalized, armorSet: slots.armorSet, body, ...slots };
  }

  function hasMannequinGear(loadout, catalogItems = []) {
    const { normalized } = resolveSlots(loadout, catalogItems);
    return Boolean(
      normalized.weapons?.length
      || normalized.tools?.length
      || normalized.armorSet
      || normalized.medical?.length
    );
  }

  function armorSetLabel(armorSetSlug) {
    const set = SDD.Loadout?.armorSets?.[armorSetSlug];
    return set?.label || armorSetSlug;
  }

  function renderBodyCell(slot, doll, loadout, catalogItems, categories) {
    const esc = SDD.escapeHTML;
    const itemId = doll.body[slot.armorKey];
    const filled = Boolean(itemId);
    const inner = itemId
      ? renderSlotItem(itemId, loadout, catalogItems, categories, true)
      : renderEmptySlot(slot.label);

    return `
      <div class="paper-doll__cell paper-doll__cell--body paper-doll__cell--${slot.area}${filled ? " is-filled" : ""}"
           style="grid-area:${slot.area}" data-slot="${esc(slot.id)}" aria-label="${esc(slot.label)}">
        <span class="paper-doll__cell-label">${esc(slot.label)}</span>
        ${inner}
      </div>`;
  }

  function renderMedicalPanel(itemIds, loadout, catalogItems, categories, compact) {
    return renderGearPanel("Medical", itemIds, loadout, catalogItems, categories, compact, {
      showAll: true,
      wide: true,
      defaultOpen: false,
    });
  }

  function renderGearPanel(title, itemIds, loadout, catalogItems, categories, compact, opts = {}) {
    const { showAll = false, wide = false, defaultOpen = false } = opts;
    const esc = SDD.escapeHTML;
    const filled = Boolean(itemIds?.length);
    const count = itemIds?.length || 0;
    const visible = showAll ? (itemIds || []) : (itemIds || []).slice(0, GRID_VISIBLE);
    const extra = showAll ? 0 : Math.max(0, count - visible.length);
    const panelClass = wide ? " paper-doll__gear-panel--wide" : "";
    const gridClass = wide ? " paper-doll__gear-grid--wide" : "";
    const openAttr = defaultOpen ? " open" : "";

    const inner = filled
      ? `<div class="paper-doll__gear-grid${gridClass}">
          ${visible.map((id) => `
            <div class="paper-doll__gear-cell is-filled">
              ${renderSlotItem(id, loadout, catalogItems, categories, compact)}
            </div>`).join("")}
        </div>${extra ? `<p class="paper-doll__gear-extra">+${extra} more</p>` : ""}`
      : `<div class="paper-doll__gear-grid paper-doll__gear-grid--empty${gridClass}">${renderEmptySlot(title)}</div>`;

    return `
      <details class="paper-doll__gear-details${panelClass}${filled ? " is-filled" : ""}" data-gear-panel="${esc(title)}"${openAttr}>
        <summary class="paper-doll__gear-summary">
          <span class="paper-doll__gear-chevron" aria-hidden="true"></span>
          <span class="paper-doll__gear-panel-label">${esc(title)}</span>
          ${filled ? `<span class="paper-doll__gear-count">${count}</span>` : ""}
        </summary>
        <div class="paper-doll__gear-body">
          ${inner}
        </div>
      </details>`;
  }

  function renderMannequinHtml(loadout, ctx = {}, opts = {}) {
    const { catalogItems = ctx.items || [], categories = ctx.categories || [] } = ctx;
    const compact = Boolean(opts.compact);
    const doll = resolvePaperDoll(loadout, catalogItems);
    const { normalized, weapons, tools, medical } = doll;

    const bodyCells = BODY_SLOTS.map((slot) =>
      renderBodyCell(slot, doll, normalized, catalogItems, categories)
    ).join("");

    const setMeta = doll.armorSet
      ? `<p class="paper-doll__set-meta">${SDD.escapeHTML(armorSetLabel(doll.armorSet))}${normalized.armorQuality ? ` · Q${normalized.armorQuality}` : ""}</p>`
      : "";

    const gearLabel = hasMannequinGear(loadout, catalogItems)
      ? "Equipped gear preview"
      : "Loadout preview — pick gear below";

    return `
      <div class="loadout-mannequin loadout-mannequin--paper${compact ? " loadout-mannequin--compact" : ""}" role="img" aria-label="${SDD.escapeHTML(gearLabel)}">
        <div class="loadout-mannequin__layout">
          <div class="paper-doll__grid">
            <div class="paper-doll__backdrop" aria-hidden="true">${SILHOUETTE_HTML}</div>
            ${bodyCells}
          </div>
          ${setMeta}
          <div class="paper-doll__gear-stack">
            <div class="paper-doll__gear-row">
              ${renderGearPanel("Weapons", weapons, normalized, catalogItems, categories, compact)}
              ${renderGearPanel("Tools", tools, normalized, catalogItems, categories, compact)}
            </div>
            ${renderMedicalPanel(medical, normalized, catalogItems, categories, compact)}
          </div>
        </div>
      </div>`;
  }

  function hydrate(root) {
    if (!root) return;
    SDD.attachItemPhotoHandlers?.(root);
  }

  function mount(container, loadout, ctx = {}, opts = {}) {
    if (!container) return;
    const openPanels = new Set();
    container.querySelectorAll(".paper-doll__gear-details[open]").forEach((el) => {
      const key = el.dataset.gearPanel;
      if (key) openPanels.add(key);
    });
    container.innerHTML = renderMannequinHtml(loadout, ctx, opts);
    if (openPanels.size) {
      container.querySelectorAll(".paper-doll__gear-details").forEach((el) => {
        if (openPanels.has(el.dataset.gearPanel)) el.open = true;
      });
    }
    hydrate(container);
  }

  window.SDD = window.SDD || {};
  window.SDD.Mannequin = {
    hasMannequinGear,
    renderMannequinHtml,
    mount,
    hydrate,
  };
})();
