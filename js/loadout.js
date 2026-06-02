/* ==========================================================================
   Loadout — outfit selection + compatible mod slots (vanilla-style)
   Armor: multiple indexed mod slots by quality tier.
   Weapons/tools: one mod per named slot type (barrel, optic, etc.).
   ========================================================================== */

(() => {
  let modCompat = null;
  let armorSets = null;

  const ARMOR_TYPES = new Set(["armor_chest", "armor_head", "armor_hands", "armor_feet"]);
  const DEFAULT_ARMOR_QUALITY = 6;

  async function loadData() {
    if (modCompat && armorSets) return { modCompat, armorSets };
    const [compatRes, gearRes] = await Promise.all([
      fetch("data/mod-compatibility.json"),
      fetch("data/perk-gear.json"),
    ]);
    modCompat = await compatRes.json();
    const gear = await gearRes.json();
    armorSets = gear.armorSets || {};
    return { modCompat, armorSets };
  }

  function emptyLoadout() {
    return {
      weapons: [],
      armorSet: null,
      armorQuality: DEFAULT_ARMOR_QUALITY,
      mods: {},
      food: [],
      water: [],
      medical: [],
      tools: [],
      vehicles: [],
      itemQualities: {},
    };
  }

  function isIndexedSlotKey(key) {
    return /^\d+$/.test(String(key));
  }

  function isArmorItemId(itemId) {
    const type = modCompat?.items?.[itemId]?.type;
    return ARMOR_TYPES.has(type);
  }

  function clampQuality(q) {
    return Math.min(6, Math.max(1, Number(q) || DEFAULT_ARMOR_QUALITY));
  }

  function getModSlotCount(itemId, armorQuality) {
    const profile = modCompat?.items?.[itemId];
    if (!profile) return 0;
    if (isArmorItemId(itemId)) {
      const tiers = profile.modSlotsByQuality;
      if (Array.isArray(tiers) && tiers.length) {
        return tiers[clampQuality(armorQuality) - 1] ?? tiers[tiers.length - 1];
      }
      return 2;
    }
    return profile.slots?.length || 0;
  }

  function migrateLegacyItemMods(itemId, slots) {
    if (!slots || typeof slots !== "object") return {};
    const out = {};
    for (const [key, modId] of Object.entries(slots)) {
      if (!modId || !modCompat?.mods?.[modId]) continue;
      if (isIndexedSlotKey(key) || !isArmorItemId(itemId)) {
        out[key] = modId;
        continue;
      }
      // Legacy armor keys like { armor: "mod-x" } → indexed slots
      const used = Object.keys(out).filter(isIndexedSlotKey).map(Number);
      const nextIdx = used.length ? Math.max(...used) + 1 : 0;
      out[String(nextIdx)] = modId;
    }
    return out;
  }

  function trimItemMods(itemId, slots, armorQuality) {
    const clean = migrateLegacyItemMods(itemId, slots);
    if (!isArmorItemId(itemId)) return clean;
    const max = getModSlotCount(itemId, armorQuality);
    const out = {};
    for (const [key, modId] of Object.entries(clean)) {
      if (!isIndexedSlotKey(key)) continue;
      if (Number(key) < max) out[key] = modId;
    }
    return out;
  }

  function normalizeIdList(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const id of raw) {
      const s = String(id || "").trim();
      if (s && !out.includes(s)) out.push(s);
    }
    return out;
  }

  const LOADOUT_TOOL_EXCLUDE = new Set([
    "melee-tool-flashlight02",
    "melee-tool-torch",
  ]);

  /** Handheld tools for gathering resources or building/upgrading — not stations or parts. */
  function isLoadoutTool(item) {
    if (!item || item.category !== "tools") return false;
    if (!item.id.startsWith("melee-tool-")) return false;
    if (item.id.endsWith("-parts")) return false;
    if (LOADOUT_TOOL_EXCLUDE.has(item.id)) return false;
    return true;
  }

  function filterCatalogItems(catalogItems, kind) {
    const items = catalogItems || [];
    if (kind === "weapons") {
      return items.filter((i) =>
        (i.category === "weapons-melee" || i.category === "weapons-ranged")
        && !i.id.endsWith("-parts")
      );
    }
    if (kind === "food") {
      return items.filter((i) => i.category === "food" && !i.id.startsWith("drink-"));
    }
    if (kind === "water") {
      return items.filter((i) => i.category === "food" && i.id.startsWith("drink-"));
    }
    if (kind === "medical") {
      return items.filter((i) => i.category === "medical");
    }
    if (kind === "tools") {
      return items.filter(isLoadoutTool);
    }
    if (kind === "vehicles") {
      return items.filter((i) =>
        i.category === "vehicles" && i.id.startsWith("vehicle-") && i.id.endsWith("-placeable")
      );
    }
    return [];
  }

  function isArmorPieceId(itemId, armorSet) {
    return getArmorPieceIds(armorSet).includes(itemId);
  }

  function getItemQuality(loadout, itemId) {
    if (isArmorPieceId(itemId, loadout.armorSet)) return clampQuality(loadout.armorQuality);
    const q = loadout.itemQualities?.[itemId];
    return clampQuality(q || DEFAULT_ARMOR_QUALITY);
  }

  function normalizeItemQualities(raw, selectedIds, catalogItems, armorSet) {
    const out = {};
    if (!raw || typeof raw !== "object") return out;
    for (const [itemId, q] of Object.entries(raw)) {
      if (!selectedIds.has(itemId)) continue;
      if (isArmorPieceId(itemId, armorSet)) continue;
      const item = findCatalogItem(catalogItems, itemId);
      if (window.ItemTooltips?.supportsQuality?.(item)) {
        out[itemId] = clampQuality(q);
      }
    }
    return out;
  }

  function applyItemQuality(loadout, itemId, quality, catalogItems) {
    if (isArmorPieceId(itemId, loadout.armorSet)) {
      return { ...loadout, armorQuality: clampQuality(quality) };
    }
    const item = findCatalogItem(catalogItems, itemId);
    if (!window.ItemTooltips?.supportsQuality?.(item)) return loadout;
    return {
      ...loadout,
      itemQualities: { ...(loadout.itemQualities || {}), [itemId]: clampQuality(quality) },
    };
  }

  function normalizeGearList(raw, kind, catalogItems) {
    const allowed = new Set(filterCatalogItems(catalogItems, kind).map((i) => i.id));
    return normalizeIdList(raw).filter((id) => allowed.has(id));
  }

  function getSelectedLoadoutItemIds(loadout) {
    const ids = new Set(getArmorPieceIds(loadout.armorSet));
    (loadout.weapons || []).forEach((id) => ids.add(id));
    (loadout.food || []).forEach((id) => ids.add(id));
    (loadout.water || []).forEach((id) => ids.add(id));
    (loadout.medical || []).forEach((id) => ids.add(id));
    (loadout.tools || []).forEach((id) => ids.add(id));
    (loadout.vehicles || []).forEach((id) => ids.add(id));
    return ids;
  }

  function normalizeLoadout(raw, catalogItems) {
    if (!raw || typeof raw !== "object") return emptyLoadout();
    const armorSet = raw.armorSet && armorSets?.[raw.armorSet] ? raw.armorSet : null;
    const armorQuality = clampQuality(raw.armorQuality);
    const weapons = normalizeGearList(raw.weapons, "weapons", catalogItems);
    const tools = normalizeGearList(raw.tools, "tools", catalogItems);
    const food = normalizeGearList(raw.food, "food", catalogItems);
    const water = normalizeGearList(raw.water, "water", catalogItems);
    const medical = normalizeGearList(raw.medical, "medical", catalogItems);
    const vehicles = normalizeGearList(raw.vehicles, "vehicles", catalogItems);
    const selectedIds = new Set([
      ...getArmorPieceIds(armorSet),
      ...weapons,
      ...tools,
      ...food,
      ...water,
      ...medical,
      ...vehicles,
    ]);
    const itemQualities = normalizeItemQualities(raw.itemQualities, selectedIds, catalogItems, armorSet);
    const mods = {};
    if (raw.mods && typeof raw.mods === "object") {
      for (const [itemId, slots] of Object.entries(raw.mods)) {
        if (!selectedIds.has(itemId)) continue;
        const trimmed = trimItemMods(itemId, slots, armorQuality);
        if (Object.keys(trimmed).length) mods[itemId] = trimmed;
      }
    }
    return { weapons, tools, armorSet, armorQuality, mods, food, water, medical, vehicles, itemQualities };
  }

  function getArmorPieceIds(setSlug) {
    if (!setSlug || !armorSets?.[setSlug]) return [];
    return armorSets[setSlug].pieces || [];
  }

  function getLoadoutItemIds(loadout) {
    return [...getSelectedLoadoutItemIds(loadout)].filter((id) => modCompat?.items?.[id]);
  }

  function modsForItem(itemId) {
    if (!modCompat) return [];
    return Object.entries(modCompat.mods)
      .filter(([, m]) => m.compatibleItems?.includes(itemId))
      .map(([id, m]) => ({ id, ...m }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function modsForItemSlot(itemId, slot) {
    return modsForItem(itemId).filter((m) => m.slot === slot);
  }

  function findCatalogItem(items, id) {
    return items?.find((i) => i.id === id) || { id, name: id, category: "resources", tier: 1 };
  }

  function renderGameIcon(itemId, catalogItems, categories) {
    const item = findCatalogItem(catalogItems, itemId);
    if (window.SDD?.itemIcon) return SDD.itemIcon(item, categories);
    if (window.SDD?.itemImage) return SDD.itemImage(item, categories);
    return `<span class="loadout-game-icon-fallback">${item.name?.charAt(0) || "?"}</span>`;
  }

  function renderOutfitGrid(selectedSlug, loadout, catalogItems, categories) {
    const esc = window.SDD.escapeHTML;
    const sets = Object.entries(armorSets || {}).sort((a, b) => a[1].label.localeCompare(b[1].label));
    const grid = sets.map(([slug, set]) => {
      const outfitId = (set.pieces || []).find((p) => p.endsWith("-outfit")) || set.pieces?.[0];
      return `
        <button type="button" class="loadout-outfit-btn${selectedSlug === slug ? " active" : ""}"
          data-outfit="${esc(slug)}" title="${esc(set.label)}">
          <span class="loadout-outfit-icon">${renderGameIcon(outfitId, catalogItems, categories)}</span>
          <span class="loadout-outfit-name">${esc(set.label.replace(" Armor", ""))}</span>
        </button>`;
    }).join("");

    let qualityHtml = "";
    if (selectedSlug && armorSets?.[selectedSlug]) {
      const sampleId = (armorSets[selectedSlug].pieces || []).find((p) => p.endsWith("-outfit"))
        || armorSets[selectedSlug].pieces?.[0];
      const sampleItem = findCatalogItem(catalogItems, sampleId);
      if (window.ItemTooltips?.supportsQuality?.(sampleItem)) {
        qualityHtml = `
          <div class="loadout-outfit-quality" data-quality-item="__armor__">
            <span class="loadout-subsection-title">Armor quality</span>
            ${window.ItemTooltips.renderCompactQualityPicker(sampleItem, loadout.armorQuality)}
            <p class="muted loadout-quality-hint">Q1–Q6 — same as the catalog. Higher quality unlocks more mod slots.</p>
          </div>`;
      }
    }

    return `${grid}${qualityHtml}`;
  }

  function bindOutfitGrid(container, loadout, onChange, catalogItems) {
    container.querySelectorAll("[data-outfit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const slug = btn.dataset.outfit;
        const next = { ...loadout, armorSet: loadout.armorSet === slug ? null : slug };
        onChange(next);
      });
    });
    bindQualityPickers(container, loadout, onChange, catalogItems);
  }

  function renderGearPickerGrid(kind, selectedIds, loadout, catalogItems, categories) {
    const esc = window.SDD.escapeHTML;
    const items = filterCatalogItems(catalogItems, kind)
      .sort((a, b) => (a.tier || 0) - (b.tier || 0) || a.name.localeCompare(b.name));
    if (!items.length) {
      return `<p class="muted loadout-empty">No ${esc(kind)} items in catalog.</p>`;
    }
    const selected = new Set(selectedIds || []);
    const showQuality = kind === "weapons" || kind === "tools";
    return items.map((item) => {
      const active = selected.has(item.id);
      const tier = item.tier != null ? `<span class="tier-pill tier-${item.tier}">T${item.tier}</span>` : "";
      const qualityHtml = active && showQuality && window.ItemTooltips?.supportsQuality?.(item)
        ? `<div class="loadout-gear-quality" data-quality-item="${esc(item.id)}">
            ${window.ItemTooltips.renderCompactQualityPicker(item, getItemQuality(loadout, item.id))}
          </div>`
        : "";
      return `
        <div class="loadout-gear-card${active ? " active" : ""}" data-gear-kind="${esc(kind)}" data-gear-id="${esc(item.id)}">
          <button type="button" class="loadout-gear-card-main" title="${esc(item.name)}">
            <span class="loadout-gear-icon">${renderGameIcon(item.id, catalogItems, categories)}</span>
            <span class="loadout-gear-name">${esc(item.name)}</span>
            ${tier}
          </button>
          ${qualityHtml}
        </div>`;
    }).join("");
  }

  function bindQualityPickers(container, loadout, onChange, catalogItems) {
    container.querySelectorAll("[data-quality-item]").forEach((wrap) => {
      const itemKey = wrap.dataset.qualityItem;
      wrap.querySelectorAll("[data-quality]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const quality = Number(btn.dataset.quality);
          let next;
          if (itemKey === "__armor__") {
            next = { ...loadout, armorQuality: clampQuality(quality) };
          } else {
            next = applyItemQuality(loadout, itemKey, quality, catalogItems);
          }
          onChange(normalizeLoadout(next, catalogItems));
        });
      });
    });
  }

  function bindGearGrid(container, loadout, onChange, catalogItems) {
    container.querySelectorAll(".loadout-gear-card").forEach((card) => {
      const main = card.querySelector(".loadout-gear-card-main");
      if (main) {
        main.addEventListener("click", () => {
          const kind = card.dataset.gearKind;
          const itemId = card.dataset.gearId;
          const list = [...(loadout[kind] || [])];
          const idx = list.indexOf(itemId);
          if (idx >= 0) list.splice(idx, 1);
          else list.push(itemId);
          onChange(normalizeLoadout({ ...loadout, [kind]: list }, catalogItems));
        });
      }
    });
    bindQualityPickers(container, loadout, onChange, catalogItems);
  }

  function renderModOptionButtons(itemId, slotKey, selected, options, catalogItems, categories) {
    const esc = window.SDD.escapeHTML;
    return [
      `<button type="button" class="loadout-mod-option${!selected ? " active" : ""}"
        data-item="${esc(itemId)}" data-slot="${esc(slotKey)}" data-mod="" title="None">
        <span class="loadout-mod-none">—</span>
      </button>`,
      ...options.map((m) => {
        const modItem = findCatalogItem(catalogItems, m.id);
        const modMeta = modCompat.mods[m.id];
        const slotLabel = modCompat.slotLabels?.[m.slot] || m.slot;
        return `
        <button type="button" class="loadout-mod-option${selected === m.id ? " active" : ""}"
          data-item="${esc(itemId)}" data-slot="${esc(slotKey)}" data-mod="${esc(m.id)}"
          title="${esc(modItem.name || m.name)} (${esc(slotLabel)})${modMeta?.summary ? " — " + esc(modMeta.summary) : ""}">
          <span class="loadout-mod-option-icon">${renderGameIcon(m.id, catalogItems, categories)}</span>
          <span class="loadout-mod-option-name">${esc(modItem.name || m.name)}</span>
        </button>`;
      }),
    ].join("");
  }

  function renderNamedModPicker(itemId, slot, loadout, catalogItems, categories) {
    const esc = window.SDD.escapeHTML;
    const options = modsForItemSlot(itemId, slot);
    if (!options.length) return "";
    const label = modCompat.slotLabels?.[slot] || slot;
    const selected = (loadout.mods[itemId] || {})[slot] || "";
    return `
      <div class="loadout-mod-picker">
        <span class="loadout-mod-slot-label">${esc(label)}</span>
        <div class="loadout-mod-options">${renderModOptionButtons(itemId, slot, selected, options, catalogItems, categories)}</div>
      </div>`;
  }

  function renderIndexedModPicker(itemId, index, loadout, catalogItems, categories) {
    const esc = window.SDD.escapeHTML;
    const slotKey = String(index);
    const options = modsForItem(itemId);
    if (!options.length) return "";
    const selected = (loadout.mods[itemId] || {})[slotKey] || "";
    return `
      <div class="loadout-mod-picker">
        <span class="loadout-mod-slot-label">Mod slot ${index + 1}</span>
        <div class="loadout-mod-options">${renderModOptionButtons(itemId, slotKey, selected, options, catalogItems, categories)}</div>
      </div>`;
  }

  function renderModRow(itemId, loadout, catalogItems, categories) {
    const esc = window.SDD.escapeHTML;
    const profile = modCompat?.items?.[itemId];
    if (!profile) return "";
    const item = findCatalogItem(catalogItems, itemId);
    const isArmor = isArmorItemId(itemId);
    let pickersHtml = "";

    if (isArmor) {
      const count = getModSlotCount(itemId, loadout.armorQuality);
      pickersHtml = Array.from({ length: count }, (_, i) =>
        renderIndexedModPicker(itemId, i, loadout, catalogItems, categories)
      ).filter(Boolean).join("");
    } else {
      pickersHtml = profile.slots
        .map((slot) => renderNamedModPicker(itemId, slot, loadout, catalogItems, categories))
        .filter(Boolean)
        .join("");
    }

    if (!pickersHtml) return "";

    const slotMeta = isArmor
      ? `${getModSlotCount(itemId, loadout.armorQuality)} mod slots · Q${loadout.armorQuality}`
      : `${profile.slots.map((s) => modCompat.slotLabels?.[s] || s).join(" · ")}${window.ItemTooltips?.supportsQuality?.(item) ? ` · Q${getItemQuality(loadout, itemId)}` : ""}`;

    return `
      <article class="loadout-mod-row">
        <div class="loadout-mod-row-head">
          <span class="loadout-mod-row-icon">${renderGameIcon(itemId, catalogItems, categories)}</span>
          <div class="loadout-mod-row-meta">
            <strong class="loadout-mod-row-name">${esc(item.name)}</strong>
            <span class="loadout-mod-row-type muted">${esc(profile.type.replace(/_/g, " "))} · ${esc(slotMeta)}</span>
          </div>
        </div>
        <div class="loadout-mod-row-pickers">${pickersHtml}</div>
      </article>`;
  }

  function renderQualityBar(loadout) {
    const q = clampQuality(loadout.armorQuality);
    const options = [1, 2, 3, 4, 5, 6].map((tier) => {
      const sample = getModSlotCount("armor-commando-outfit", tier);
      return `<option value="${tier}"${q === tier ? " selected" : ""}>Quality ${tier} (${sample} mod slots on outfit)</option>`;
    }).join("");
    return `
      <div class="loadout-quality-bar">
        <label class="loadout-quality-label" for="loadout-armor-quality">
          <span class="loadout-quality-title">Armor quality</span>
          <span class="muted loadout-quality-hint">Higher quality unlocks more mod slots per piece (vanilla Q1–Q6).</span>
        </label>
        <select id="loadout-armor-quality" class="loadout-quality-select">${options}</select>
      </div>`;
  }

  function collectModWarnings(loadout, catalogItems) {
    const warnings = [];
    const normalized = normalizeLoadout(loadout, catalogItems);

    for (const itemId of getSelectedLoadoutItemIds(normalized)) {
      if (!modCompat?.items?.[itemId]) continue;
      const item = findCatalogItem(catalogItems, itemId);
      const maxSlots = isArmorItemId(itemId)
        ? getModSlotCount(itemId, normalized.armorQuality)
        : (modCompat.items[itemId].slots?.length || 0);
      if (!maxSlots) continue;

      const installed = normalized.mods?.[itemId] || {};
      const filled = Object.values(installed).filter(Boolean).length;
      const empty = maxSlots - filled;

      if (empty > 0) {
        warnings.push({
          severity: empty === maxSlots ? "info" : "info",
          message: `${item.name}: ${empty} empty mod slot${empty === 1 ? "" : "s"} (${filled}/${maxSlots} filled)`,
          itemId,
        });
      }
    }

    if (normalized.armorSet && normalized.armorQuality < 6) {
      const pieces = getArmorPieceIds(normalized.armorSet);
      const sampleId = pieces.find((p) => p.endsWith("-outfit")) || pieces[0];
      if (sampleId) {
        const atMax = getModSlotCount(sampleId, 6);
        const atCur = getModSlotCount(sampleId, normalized.armorQuality);
        if (atCur < atMax) {
          warnings.push({
            severity: "info",
            message: `Armor quality Q${normalized.armorQuality} limits mod slots — raise quality to unlock more.`,
          });
        }
      }
    }

    return warnings;
  }

  function renderModWarningsHtml(warnings) {
    if (!warnings?.length) return "";
    const esc = window.SDD.escapeHTML;
    return `
      <div class="loadout-mod-warnings" role="status">
        ${warnings.map((w) => `<p class="loadout-mod-warning loadout-mod-warning--${w.severity}">${esc(w.message)}</p>`).join("")}
      </div>`;
  }

  function countModsBeforeQualityTrim(rawLoadout, newQuality, catalogItems) {
    const before = normalizeLoadout(rawLoadout, catalogItems);
    let count = 0;
    for (const slots of Object.values(before.mods || {})) {
      count += Object.values(slots || {}).filter(Boolean).length;
    }
    const after = normalizeLoadout({ ...rawLoadout, armorQuality: newQuality }, catalogItems);
    let afterCount = 0;
    for (const slots of Object.values(after.mods || {})) {
      afterCount += Object.values(slots || {}).filter(Boolean).length;
    }
    return before.mods ? count - afterCount : 0;
  }

  function renderModsGrid(loadout, ctx) {
    const { catalogItems = [], categories = [] } = ctx;
    const itemIds = getLoadoutItemIds(loadout);
    const hasArmor = itemIds.some(isArmorItemId);
    const warnings = collectModWarnings(loadout, catalogItems);

    if (!itemIds.length) {
      return `<p class="muted loadout-empty">Pick weapons, tools, an outfit, or vehicles above to configure compatible mods.</p>`;
    }

    const rows = itemIds.map((id) => renderModRow(id, loadout, catalogItems, categories)).filter(Boolean);
    if (!rows.length) {
      return `<p class="muted loadout-empty">No mod slots available for the current gear.</p>`;
    }

    return `${renderModWarningsHtml(warnings)}${hasArmor ? renderQualityBar(loadout) : ""}${rows.join("")}`;
  }

  function renderLoadoutPanel(loadout, ctx) {
    const { catalogItems = [], categories = [] } = ctx;
    const normalized = normalizeLoadout(loadout, catalogItems);
    return {
      weaponsHtml: renderGearPickerGrid("weapons", normalized.weapons, normalized, catalogItems, categories),
      toolsHtml: renderGearPickerGrid("tools", normalized.tools, normalized, catalogItems, categories),
      outfitsHtml: renderOutfitGrid(normalized.armorSet, normalized, catalogItems, categories),
      modsHtml: renderModsGrid(normalized, ctx),
      foodHtml: renderGearPickerGrid("food", normalized.food, normalized, catalogItems, categories),
      waterHtml: renderGearPickerGrid("water", normalized.water, normalized, catalogItems, categories),
      medicalHtml: renderGearPickerGrid("medical", normalized.medical, normalized, catalogItems, categories),
      vehiclesHtml: renderGearPickerGrid("vehicles", normalized.vehicles, normalized, catalogItems, categories),
    };
  }

  function bindModPickers(container, loadout, onChange, catalogItems) {
    container.querySelectorAll(".loadout-mod-option[data-item][data-slot]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const itemId = btn.dataset.item;
        const slot = btn.dataset.slot;
        const modId = btn.dataset.mod || null;
        const next = {
          ...loadout,
          mods: { ...loadout.mods, [itemId]: { ...(loadout.mods[itemId] || {}) } },
        };
        if (modId) next.mods[itemId][slot] = modId;
        else delete next.mods[itemId][slot];
        if (!Object.keys(next.mods[itemId]).length) delete next.mods[itemId];
        onChange(normalizeLoadout(next, catalogItems));
      });
    });

    const qualitySel = container.querySelector("#loadout-armor-quality");
    if (qualitySel) {
      qualitySel.addEventListener("change", () => {
        const newQ = clampQuality(qualitySel.value);
        const dropped = countModsBeforeQualityTrim(loadout, newQ, catalogItems);
        onChange(normalizeLoadout(
          { ...loadout, armorQuality: newQ },
          catalogItems
        ));
        if (dropped > 0 && window.SDD?.toast) {
          SDD.toast(`${dropped} mod${dropped === 1 ? "" : "s"} removed — lower quality has fewer slots.`, "error");
        }
      });
    }
  }

  function bindModSelects(container, loadout, onChange, catalogItems) {
    bindModPickers(container, loadout, onChange, catalogItems);
  }

  function listInstalledMods(itemMods) {
    if (!itemMods || typeof itemMods !== "object") return [];
    return Object.entries(itemMods)
      .sort(([a], [b]) => {
        const ai = isIndexedSlotKey(a);
        const bi = isIndexedSlotKey(b);
        if (ai && bi) return Number(a) - Number(b);
        if (ai) return 1;
        if (bi) return -1;
        return a.localeCompare(b);
      })
      .map(([, modId]) => modId);
  }

  function renderWeaponSummaryItem(itemId, normalized, catalogItems, categories, itemStats) {
    const esc = window.SDD.escapeHTML;
    const item = findCatalogItem(catalogItems, itemId);
    const quality = getItemQuality(normalized, itemId);
    const qMeta = window.ItemTooltips?.qualityMeta?.(quality);
    const tier = item.tier != null
      ? `<span class="tier-pill tier-${item.tier}">T${item.tier}</span>`
      : "";
    const qBadge = window.ItemTooltips?.supportsQuality?.(item) && qMeta
      ? `<span class="loadout-q-badge loadout-q-badge--lg" style="--q-color:${qMeta.color}">Q${quality} · ${esc(qMeta.name)}</span>`
      : "";
    const selectedStats = window.ItemTooltips?.renderProfileSelectedStats?.(item, quality) || "";
    const qualityTable = window.ItemTooltips?.renderProfileQualityTable?.(item, quality) || "";
    const modList = listInstalledMods(normalized.mods[itemId]).map((modId) => {
      const mod = findCatalogItem(catalogItems, modId);
      return `<span class="loadout-summary-mod">${renderGameIcon(modId, catalogItems, categories)}<span>${esc(mod.name)}</span></span>`;
    }).join("");

    return `
      <article class="loadout-weapon-card${modList ? " has-mods" : ""}">
        <div class="loadout-weapon-head">
          <span class="build-gear-icon">${renderGameIcon(itemId, catalogItems, categories)}</span>
          <div class="loadout-weapon-meta">
            <div class="loadout-weapon-title">
              <strong class="loadout-weapon-name">${esc(item.name)}</strong>
              ${tier}
              ${qBadge}
            </div>
            ${selectedStats}
          </div>
        </div>
        ${qualityTable}
        ${modList ? `<div class="loadout-summary-mods">${modList}</div>` : ""}
      </article>`;
  }

  function renderSummaryItem(itemId, normalized, catalogItems, categories, itemStats) {
    const esc = window.SDD.escapeHTML;
    const item = findCatalogItem(catalogItems, itemId);
    const quality = getItemQuality(normalized, itemId);
    const stats = SDD.PerkGear?.statSnippet(itemId, itemStats, quality);
    const qLabel = window.ItemTooltips?.supportsQuality?.(item) ? ` · Q${quality}` : "";
    const modList = listInstalledMods(normalized.mods[itemId]).map((modId) => {
      const mod = findCatalogItem(catalogItems, modId);
      return `<span class="loadout-summary-mod">${renderGameIcon(modId, catalogItems, categories)}<span>${esc(mod.name)}</span></span>`;
    }).join("");
    return `
      <div class="build-gear-item loadout-summary-piece${modList ? " has-mods" : ""}">
        <span class="build-gear-icon">${renderGameIcon(itemId, catalogItems, categories)}</span>
        <span class="build-gear-info">
          <span class="build-gear-name">${esc(item.name)}${esc(qLabel)}</span>
          ${stats ? `<span class="build-gear-stats muted">${esc(stats)}</span>` : ""}
          ${modList ? `<span class="loadout-summary-mods">${modList}</span>` : ""}
        </span>
      </div>`;
  }

  function renderSummaryGroup(title, itemIds, normalized, catalogItems, categories, itemStats, opts = {}) {
    if (!itemIds?.length) return "";
    const esc = window.SDD.escapeHTML;
    const renderItem = opts.weaponDetail ? renderWeaponSummaryItem : renderSummaryItem;
    const itemsHtml = itemIds
      .map((id) => renderItem(id, normalized, catalogItems, categories, itemStats))
      .join("");
    const gridClass = opts.weaponDetail ? "build-gear-grid build-gear-grid--weapons" : "build-gear-grid";
    return `
      <div class="loadout-summary-group">
        <h5 class="build-perk-gear-title">${esc(title)}</h5>
        <div class="${gridClass}">${itemsHtml}</div>
      </div>`;
  }

  function renderLoadoutSummary(loadout, catalogItems, categories, itemStats) {
    const esc = window.SDD.escapeHTML;
    const normalized = normalizeLoadout(loadout || {}, catalogItems);
    const hasGear = normalized.weapons.length
      || normalized.tools.length
      || normalized.armorSet
      || normalized.food.length
      || normalized.water.length
      || normalized.medical.length
      || normalized.vehicles.length;
    if (!hasGear) return "";

    const set = armorSets?.[normalized.armorSet];
    let html = `<section class="build-section build-section-loadout"><h4 class="build-section-title">Loadout</h4>`;

    html += renderSummaryGroup(
      "Weapons",
      normalized.weapons,
      normalized,
      catalogItems,
      categories,
      itemStats,
      { weaponDetail: true }
    );

    html += renderSummaryGroup("Tools", normalized.tools, normalized, catalogItems, categories, itemStats);

    if (set) {
      const qLabel = normalized.armorQuality ? ` · Quality ${normalized.armorQuality}` : "";
      html += `<div class="loadout-summary-group"><h5 class="build-perk-gear-title">${esc("Outfit")}</h5>`;
      html += `<p class="loadout-summary-set"><strong>${esc(set.label)}</strong>${esc(qLabel)} — ${esc(set.description || "")}</p>`;
      html += `<div class="build-gear-grid build-gear-grid--armor">`;
      for (const pieceId of set.pieces || []) {
        html += renderSummaryItem(pieceId, normalized, catalogItems, categories, itemStats);
      }
      html += `</div></div>`;
    }

    html += renderSummaryGroup("Food", normalized.food, normalized, catalogItems, categories, itemStats);
    html += renderSummaryGroup("Water", normalized.water, normalized, catalogItems, categories, itemStats);
    html += renderSummaryGroup("Medical supplies", normalized.medical, normalized, catalogItems, categories, itemStats);
    html += renderSummaryGroup("Vehicles", normalized.vehicles, normalized, catalogItems, categories, itemStats);

    html += `</section>`;
    return html;
  }

  window.SDD = window.SDD || {};
  window.SDD.Loadout = {
    loadData,
    emptyLoadout,
    normalizeLoadout,
    getLoadoutItemIds,
    getItemQuality,
    getModSlotCount,
    isArmorItemId,
    isLoadoutTool,
    renderLoadoutPanel,
    bindOutfitGrid,
    bindGearGrid,
    bindModPickers,
    bindModSelects,
    renderLoadoutSummary,
    collectModWarnings,
    renderModWarningsHtml,
    get armorSets() { return armorSets; },
  };
})();
