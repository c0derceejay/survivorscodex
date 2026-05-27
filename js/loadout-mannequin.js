/* ==========================================================================
   Loadout mannequin — 2D gear preview (weapons, tools, armor, medical)
   ========================================================================== */

(() => {
  const GRID_VISIBLE = 4;
  const OUTFIT_PIECES = [
    { slot: "head", label: "Head" },
    { slot: "chest", label: "Chest" },
    { slot: "hands", label: "Hands" },
    { slot: "feet", label: "Feet" },
  ];

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

  function renderSlotItem(itemId, loadout, catalogItems, categories) {
    const esc = SDD.escapeHTML;
    const item = findCatalogItem(catalogItems, itemId);
    const mods = modCount(loadout, itemId);
    return `
      <div class="mannequin-slot__item" title="${esc(item.name)}">
        <span class="mannequin-slot__icon">${renderGameIcon(itemId, catalogItems, categories)}</span>
        <span class="mannequin-slot__name">${esc(item.name)}</span>
        ${qualityBadge(itemId, loadout, catalogItems)}
        ${mods ? `<span class="mannequin-slot__mods" title="${mods} mod${mods === 1 ? "" : "s"}">${mods}</span>` : ""}
      </div>`;
  }

  function renderEmptySlot(label) {
    const esc = SDD.escapeHTML;
    return `<span class="mannequin-slot__ghost" aria-hidden="true"><span class="mannequin-slot__ghost-label">${esc(label)}</span></span>`;
  }

  function renderGridCell(inner, filled = false) {
    return `<div class="mannequin-gear-grid__cell${filled ? " is-filled" : ""}">${inner}</div>`;
  }

  function renderTwoByTwo(cells, emptyLabel, extraCount = 0) {
    if (!cells.length) {
      return `
        <div class="mannequin-gear-grid mannequin-gear-grid--empty">
          ${renderEmptySlot(emptyLabel)}
        </div>`;
    }

    const extra = extraCount
      ? `<p class="mannequin-gear-grid__extra">+${extraCount} more</p>`
      : "";

    return `
      <div class="mannequin-gear-grid-wrap">
        <div class="mannequin-gear-grid">${cells.join("")}</div>
        ${extra}
      </div>`;
  }

  function resolveSlots(loadout, catalogItems) {
    const normalized = SDD.Loadout.normalizeLoadout(loadout || {}, catalogItems);
    const weapons = normalized.weapons || [];
    const tools = normalized.tools || [];

    return {
      normalized,
      slots: {
        armorSet: normalized.armorSet || null,
        weapons: weapons.slice(0, GRID_VISIBLE),
        belt: tools.slice(0, GRID_VISIBLE),
        medical: normalized.medical || [],
        _extra: {
          weapons: weapons.length > GRID_VISIBLE ? weapons.length - GRID_VISIBLE : 0,
          tools: tools.length > GRID_VISIBLE ? tools.length - GRID_VISIBLE : 0,
        },
      },
    };
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

  function renderOutfitSection(armorSet, loadout, catalogItems, categories) {
    if (!armorSet) {
      return renderTwoByTwo([], "Outfit");
    }

    const cells = OUTFIT_PIECES.map(({ slot, label }) => {
      const pieceId = armorPieceForSlot(armorSet, slot);
      const inner = pieceId
        ? renderSlotItem(pieceId, loadout, catalogItems, categories)
        : renderEmptySlot(label);
      return renderGridCell(inner, Boolean(pieceId));
    });

    return renderTwoByTwo(cells);
  }

  function renderItemGrid(itemIds, loadout, catalogItems, categories, emptyLabel, extraCount) {
    if (!itemIds?.length) {
      return renderTwoByTwo([], emptyLabel);
    }

    const cells = itemIds.map((id) =>
      renderGridCell(renderSlotItem(id, loadout, catalogItems, categories), true)
    );

    return renderTwoByTwo(cells, emptyLabel, extraCount);
  }

  function renderMedicalStack(itemIds, loadout, catalogItems, categories) {
    if (!itemIds?.length) {
      return renderEmptySlot("Medical");
    }

    return `
      <div class="mannequin-medical-stack">
        ${itemIds.map((id) => `
          <div class="mannequin-medical-stack__cell is-filled">
            ${renderSlotItem(id, loadout, catalogItems, categories)}
          </div>`).join("")}
      </div>`;
  }

  function renderSection(id, label, inner, filled, aside = false) {
    const esc = SDD.escapeHTML;
    return `
      <section class="mannequin-section mannequin-section--${id}${filled ? " is-filled" : ""}${aside ? " mannequin-section--aside" : ""}"
               data-slot="${esc(id)}" aria-label="${esc(label)}">
        <h3 class="mannequin-section__label">${esc(label)}</h3>
        ${inner}
      </section>`;
  }

  function renderMannequinHtml(loadout, ctx = {}, opts = {}) {
    const { catalogItems = ctx.items || [], categories = ctx.categories || [] } = ctx;
    const compact = Boolean(opts.compact);
    const { normalized, slots } = resolveSlots(loadout, catalogItems);

    const outfitHtml = renderSection(
      "outfit",
      "Outfit",
      renderOutfitSection(slots.armorSet, normalized, catalogItems, categories),
      Boolean(slots.armorSet)
    );

    const weaponsHtml = renderSection(
      "weapons",
      "Weapons",
      renderItemGrid(slots.weapons, normalized, catalogItems, categories, "Weapons", slots._extra.weapons),
      Boolean(slots.weapons?.length)
    );

    const toolsHtml = renderSection(
      "belt",
      "Tools",
      renderItemGrid(slots.belt, normalized, catalogItems, categories, "Tools", slots._extra.tools),
      Boolean(slots.belt?.length)
    );

    const medicalHtml = renderSection(
      "medical",
      "Medical",
      renderMedicalStack(slots.medical, normalized, catalogItems, categories),
      Boolean(slots.medical?.length),
      true
    );

    const gearLabel = hasMannequinGear(loadout, catalogItems)
      ? "Equipped gear preview"
      : "Loadout preview — pick gear below";

    return `
      <div class="loadout-mannequin${compact ? " loadout-mannequin--compact" : ""}" role="img" aria-label="${SDD.escapeHTML(gearLabel)}">
        <div class="loadout-mannequin__layout">
          <div class="loadout-mannequin__main">
            ${outfitHtml}
            ${weaponsHtml}
            ${toolsHtml}
          </div>
          <aside class="loadout-mannequin__aside">
            ${medicalHtml}
          </aside>
        </div>
      </div>`;
  }

  function hydrate(root) {
    if (!root) return;
    SDD.attachItemPhotoHandlers?.(root);
  }

  function mount(container, loadout, ctx = {}, opts = {}) {
    if (!container) return;
    container.innerHTML = renderMannequinHtml(loadout, ctx, opts);
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
