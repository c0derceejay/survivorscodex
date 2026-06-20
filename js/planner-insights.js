/* ==========================================================================
   Planner insights — craft rollup, loadout totals, perk hints, build compare
   ========================================================================== */

(() => {
  let recipeCache = null;

  async function loadRecipeCache() {
    if (recipeCache) return recipeCache;
    try {
      const res = await fetch("data/recipe-ingredients.json", { cache: "no-store" });
      recipeCache = res.ok ? await res.json() : {};
    } catch (_) {
      recipeCache = {};
    }
    return recipeCache;
  }

  function findItem(items, id) {
    return items?.find((i) => i.id === id) || null;
  }

  function getRecipe(item, cache) {
    if (item?.recipe?.ingredients?.length) return item.recipe;
    return cache?.[item?.id] || null;
  }

  function activePerks(state, skillsData) {
    const rows = [];
    for (const attr of skillsData.attributes) {
      for (const perk of attr.perks) {
        const level = state.perks?.[perk.id] || 0;
        if (level > 0) rows.push({ perk, level, attr });
      }
    }
    return rows;
  }

  function collectLoadoutItemIds(loadout, catalogItems) {
    const normalized = SDD.Loadout.normalizeLoadout(loadout || {}, catalogItems);
    const ids = new Set();
    const set = SDD.Loadout.armorSets?.[normalized.armorSet];
    (set?.pieces || []).forEach((id) => ids.add(id));
    ["weapons", "tools", "food", "water", "medical", "vehicles"].forEach((key) => {
      (normalized[key] || []).forEach((id) => ids.add(id));
    });
    if (normalized.mods) {
      for (const slots of Object.values(normalized.mods)) {
        for (const modId of Object.values(slots || {})) {
          if (modId) ids.add(modId);
        }
      }
    }
    return { normalized, ids: [...ids], idSet: ids };
  }

  function getLoadoutIdSet(loadout, catalogItems) {
    return collectLoadoutItemIds(loadout, catalogItems).idSet;
  }

  function loadoutHasGear(normalized) {
    return Boolean(
      normalized.weapons?.length
      || normalized.tools?.length
      || normalized.armorSet
      || normalized.food?.length
      || normalized.water?.length
      || normalized.medical?.length
      || normalized.vehicles?.length
    );
  }

  function itemsUnlockedAtPerkLevel(perkId, level, gearConfig) {
    return gearConfig?.perks?.[perkId]?.unlocksByLevel?.[String(level)] || [];
  }

  function textCraftTierMatchesLoadout(craftTier, loadoutIds, catalogItems) {
    const text = craftTier.toLowerCase();
    for (const id of loadoutIds) {
      const item = findItem(catalogItems, id);
      if (!item) continue;
      const name = item.name.toLowerCase();
      const words = name.split(/\s+/).filter((w) => w.length > 3);
      if (words.some((w) => text.includes(w))) return true;

      const tierHints = [
        { words: ["stone", "primitive", "wooden", "pipe"], tier: 0 },
        { words: ["iron"], tier: 1 },
        { words: ["steel"], tier: 2 },
        { words: ["mechanical", "auto", "compound"], tier: 3 },
      ];
      for (const hint of tierHints) {
        if (!hint.words.some((w) => text.includes(w))) continue;
        if (item.tier === hint.tier) return true;
        if (hint.words.some((w) => item.id.includes(w))) return true;
      }

      const categoryHints = [
        ["salvage", "salvage"],
        ["pickaxe", "pick"],
        ["pick", "pick"],
        ["bow", "bow"],
        ["crossbow", "crossbow"],
        ["shotgun", "shotgun"],
        ["club", "club"],
        ["baton", "baton"],
        ["knife", "blade"],
        ["machete", "blade"],
        ["vehicle", "vehicle"],
        ["minibike", "minibike"],
        ["motorcycle", "motorcycle"],
      ];
      for (const [token, idPart] of categoryHints) {
        if (text.includes(token) && item.id.includes(idPart)) return true;
      }
    }
    return false;
  }

  function isCraftUnlockRelevant({
    perkId,
    level,
    craftTier,
    itemId,
    loadoutIds,
    catalogItems,
    gearConfig,
  }) {
    if (itemId) return loadoutIds.has(itemId);

    const unlockedItems = itemsUnlockedAtPerkLevel(perkId, level, gearConfig);
    if (unlockedItems.some((id) => loadoutIds.has(id))) return true;

    if (!craftTier) return false;
    return textCraftTierMatchesLoadout(craftTier, loadoutIds, catalogItems);
  }

  function collectPerkCraftUnlocks(state, skillsData, gearConfig, catalogItems, loadoutIds) {
    const unlocks = [];
    const seenItems = new Set();
    const seenText = new Set();

    for (const { perk, level, attr } of activePerks(state, skillsData)) {
      for (let lv = 1; lv <= level; lv += 1) {
        const row = perk.levels[lv - 1];
        if (row?.craftTier) {
          const relevant = isCraftUnlockRelevant({
            perkId: perk.id,
            level: lv,
            craftTier: row.craftTier,
            loadoutIds,
            catalogItems,
            gearConfig,
          });
          if (relevant && !seenText.has(`${perk.id}:${lv}:${row.craftTier}`)) {
            seenText.add(`${perk.id}:${lv}:${row.craftTier}`);
            unlocks.push({
              kind: "text",
              label: row.craftTier,
              source: `${perk.name} Lv ${lv}`,
              attrColor: attr.color,
            });
          }
        }

        const link = gearConfig?.perks?.[perk.id];
        if (!link) continue;
        for (const itemId of link.unlocksByLevel?.[String(lv)] || []) {
          if (!loadoutIds.has(itemId) || seenItems.has(itemId)) continue;
          seenItems.add(itemId);
          const item = findItem(catalogItems, itemId);
          unlocks.push({
            kind: "item",
            itemId,
            name: item?.name || itemId,
            source: `${perk.name} Lv ${lv}`,
            attrColor: attr.color,
          });
        }
      }
    }

    return unlocks;
  }

  function renderPerkCraftUnlockCell(perk, levelIndex, ctx) {
    const esc = SDD.escapeHTML;
    const lv = levelIndex + 1;
    const row = perk.levels[levelIndex];
    const { perkLevel, loadoutIds, catalogItems, gearConfig } = ctx;

    if (lv > perkLevel) return "—";

    const itemIds = itemsUnlockedAtPerkLevel(perk.id, lv, gearConfig);
    const loadoutItemNames = itemIds
      .filter((id) => loadoutIds.has(id))
      .map((id) => findItem(catalogItems, id)?.name || id);

    if (loadoutItemNames.length) {
      return loadoutItemNames
        .map((name) => `<span class="tag">${esc(name)}</span>`)
        .join(" ");
    }

    if (row?.craftTier && isCraftUnlockRelevant({
      perkId: perk.id,
      level: lv,
      craftTier: row.craftTier,
      loadoutIds,
      catalogItems,
      gearConfig,
    })) {
      return `<span class="tag">${esc(row.craftTier)}</span>`;
    }

    return "—";
  }

  function aggregateIngredients(recipes, catalogItems) {
    const totals = new Map();
    for (const { itemId, recipe, yieldCount } of recipes) {
      if (!recipe?.ingredients?.length || recipe.forgeOnly) continue;
      const mult = yieldCount || 1;
      for (const ing of recipe.ingredients) {
        if (!ing.id) continue;
        const prev = totals.get(ing.id) || {
          id: ing.id,
          name: ing.name || findItem(catalogItems, ing.id)?.name || ing.id,
          count: 0,
        };
        prev.count += (ing.count || 1) * mult;
        totals.set(ing.id, prev);
      }
    }
    return [...totals.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  async function buildCraftRollup(state, ctx) {
    const { skillsData, catalogItems, gearConfig } = ctx;
    const cache = await loadRecipeCache();
    const { normalized, ids, idSet } = collectLoadoutItemIds(state.loadout, catalogItems);
    const perkUnlocks = collectPerkCraftUnlocks(state, skillsData, gearConfig, catalogItems, idSet);

    const stationMap = new Map();
    const recipeRows = [];

    for (const itemId of ids) {
      const item = findItem(catalogItems, itemId);
      if (!item) continue;
      const recipe = getRecipe(item, cache);
      if (!recipe?.ingredients?.length) continue;

      const station = recipe.forgeOnly
        ? "Forge / salvage"
        : recipe.craftAreaLabel || recipe.craftArea || "Hand craft / loot";
      recipeRows.push({ itemId, itemName: item.name, recipe, station });

      if (!stationMap.has(station)) {
        stationMap.set(station, { station, items: [], ingredients: new Map() });
      }
      const group = stationMap.get(station);
      group.items.push({ id: itemId, name: item.name });

      if (!recipe.forgeOnly) {
        for (const ing of recipe.ingredients) {
          if (!ing.id) continue;
          const prev = group.ingredients.get(ing.id) || {
            id: ing.id,
            name: ing.name || findItem(catalogItems, ing.id)?.name || ing.id,
            count: 0,
          };
          prev.count += ing.count || 1;
          group.ingredients.set(ing.id, prev);
        }
      }
    }

    const stations = [...stationMap.values()]
      .map((g) => ({
        station: g.station,
        items: g.items.sort((a, b) => a.name.localeCompare(b.name)),
        ingredients: [...g.ingredients.values()].sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.station.localeCompare(b.station));

    const shoppingList = aggregateIngredients(
      recipeRows.map((r) => ({ itemId: r.itemId, recipe: r.recipe, yieldCount: 1 })),
      catalogItems
    );

    return {
      perkUnlocks,
      stations,
      shoppingList,
      hasRecipes: recipeRows.length > 0,
      loadoutHasGear: loadoutHasGear(normalized),
      loadout: normalized,
    };
  }

  function computeLoadoutTotals(loadout, ctx) {
    const { catalogItems, itemStats } = ctx;
    const normalized = SDD.Loadout.normalizeLoadout(loadout || {}, catalogItems);
    const esc = SDD.escapeHTML;

    const weapons = (normalized.weapons || []).map((id) => {
      const item = findItem(catalogItems, id);
      const q = SDD.Loadout.getItemQuality(normalized, id);
      const stats = itemStats?.[id];
      const tier = stats?.qualityByTier;
      const qi = Math.min(Math.max(q - 1, 0), 5);
      const dmg = tier?.entityDamage?.[qi] ?? tier?.blockDamage?.[qi];
      return {
        id,
        name: item?.name || id,
        quality: q,
        damage: dmg != null ? dmg : null,
      };
    });

    let armorPhys = 0;
    let armorPieces = 0;
    const set = SDD.Loadout.armorSets?.[normalized.armorSet];
    if (set?.pieces?.length) {
      const q = normalized.armorQuality || 6;
      const qi = Math.min(Math.max(q - 1, 0), 5);
      for (const pieceId of set.pieces) {
        const stats = itemStats?.[pieceId];
        const resist = stats?.qualityByTier?.physicalDamageResist?.[qi];
        if (resist != null) {
          armorPhys += resist;
          armorPieces += 1;
        }
      }
    }

    return { weapons, armorPhys, armorPieces, armorSetLabel: set?.label || null, armorQuality: normalized.armorQuality };
  }

  function renderLoadoutTotalsHtml(totals) {
    const esc = SDD.escapeHTML;
    if (!totals.weapons.length && !totals.armorPieces) {
      return `<p class="muted planner-insights-empty">Select weapons or an outfit to see combat stats.</p>`;
    }

    let html = `<div class="planner-totals-grid">`;

    if (totals.armorPieces) {
      html += `
        <article class="planner-total-card">
          <span class="planner-total-label">Armor (physical resist)</span>
          <strong class="planner-total-value">${totals.armorPhys}%</strong>
          <span class="muted planner-total-meta">${esc(totals.armorSetLabel || "Outfit")} · Q${totals.armorQuality} · ${totals.armorPieces} pieces</span>
        </article>`;
    }

    for (const w of totals.weapons) {
      html += `
        <article class="planner-total-card">
          <span class="planner-total-label">${esc(w.name)}</span>
          <strong class="planner-total-value">${w.damage != null ? w.damage : "—"}</strong>
          <span class="muted planner-total-meta">${w.damage != null ? "Entity damage" : "No stat data"} · Q${w.quality}</span>
        </article>`;
    }

    html += `</div>`;
    return html;
  }

  function renderCraftRollupHtml(rollup) {
    const esc = SDD.escapeHTML;
    if (!rollup.perkUnlocks.length && !rollup.hasRecipes) {
      if (!rollup.loadoutHasGear) {
        return `<p class="muted planner-insights-empty">Pick loadout gear above — perk craft unlocks only show crafts your build actually uses.</p>`;
      }
      return `<p class="muted planner-insights-empty">No craft recipes or perk unlocks match your current loadout.</p>`;
    }

    const cards = [];

    for (const u of rollup.perkUnlocks) {
      const title = u.kind === "item"
        ? `<a class="planner-craft-card__link" href="catalog.html?q=${encodeURIComponent(u.name)}">${esc(u.name)}</a>`
        : esc(u.label);
      cards.push({
        label: "Perk unlock",
        labelStyle: `--attr-color:${u.attrColor}`,
        title,
        meta: esc(u.source),
        kind: "unlock",
      });
    }

    for (const group of rollup.stations) {
      const itemLine = group.items.map((i) => esc(i.name)).join(", ");
      const ingLine = group.ingredients.length
        ? group.ingredients.map((ing) => `${esc(ing.name)} ×${ing.count}`).join(", ")
        : "No ingredient data";
      cards.push({
        label: group.station,
        title: itemLine,
        meta: ingLine,
        kind: "station",
      });
    }

    for (const ing of rollup.shoppingList) {
      cards.push({
        label: "Material",
        title: esc(ing.name),
        meta: `<strong class="planner-craft-card__qty">×${ing.count}</strong>`,
        kind: "material",
      });
    }

    let html = `<div class="planner-craft-grid">`;
    let lastKind = "";

    for (const card of cards) {
      if (card.kind !== lastKind) {
        const sectionLabel = card.kind === "unlock"
          ? "Perk unlocks for this loadout"
          : card.kind === "station"
            ? "Loadout by station"
            : "Combined materials";
        html += `<p class="planner-craft-grid__label">${sectionLabel}</p>`;
        lastKind = card.kind;
      }
      html += `
        <article class="planner-craft-card planner-craft-card--${card.kind}"${card.labelStyle ? ` style="${card.labelStyle}"` : ""}>
          <span class="planner-craft-card__tag">${esc(card.label)}</span>
          <div class="planner-craft-card__title">${card.title}</div>
          <div class="planner-craft-card__meta muted">${card.meta}</div>
        </article>`;
    }

    html += `</div>`;
    return html;
  }

  const FOCUS_PERK_HINTS = {
    horde: ["boomstick", "machine-gunner", "healing-factor", "pain-tolerance", "robotics-inventor"],
    pvp: ["gunslinger", "deep-cuts", "hidden-strike", "from-the-shadows", "the-penetrator"],
    solo: ["lucky-looter", "pack-mule", "healing-factor", "rule-1-cardio", "parkour"],
    crafting: ["grease-monkey", "better-barter", "master-chef", "advanced-engineering", "electrocutioner"],
    gathering: ["miner-69er", "mother-lode", "salvage-operations", "lucky-looter"],
    farming: ["living-off-the-land", "master-chef", "iron-gut"],
    general: ["lucky-looter", "pack-mule", "healing-factor", "master-chef"],
  };

  function collectPerkHints(state, skillsData) {
    const hints = [];
    const remain = SDD.SkillPoints.budget(skillsData.meta, state.playerLevel)
      - SDD.SkillPoints.calcSpent(state.attributes, state.perks, skillsData.meta).total;

    if (remain > 0) {
      hints.push({
        type: "points",
        message: `${remain} skill point${remain === 1 ? "" : "s"} left to spend.`,
      });
    } else if (remain < 0) {
      hints.push({ type: "warn", message: "Over budget — lower perks or attributes before saving." });
    }

    const selectedPerk = state.selectedPerkId ? findPerk(skillsData, state.selectedPerkId) : null;
    if (selectedPerk) {
      const lvl = state.perks?.[selectedPerk.id] || 0;
      if (lvl < selectedPerk.maxLevel) {
        const next = selectedPerk.levels[lvl];
        if (next?.craftTier) {
          hints.push({
            type: "unlock",
            message: `Next level unlocks: ${next.craftTier}`,
            perkId: selectedPerk.id,
          });
        }
      }
    }

    const focusIds = SDD.BuildTypes?.getSelectedFromUI?.() || ["general"];
    const suggested = new Set();
    focusIds.forEach((fid) => {
      (FOCUS_PERK_HINTS[fid] || FOCUS_PERK_HINTS.general).forEach((id) => suggested.add(id));
    });

    for (const perkId of suggested) {
      const perk = findPerk(skillsData, perkId);
      if (!perk) continue;
      const lvl = state.perks?.[perkId] || 0;
      if (lvl >= perk.maxLevel) continue;
      if (perk.requires?.general) {
        if (remain > 0) {
          hints.push({
            type: "focus",
            message: `${perk.name} can go to Lv ${lvl + 1} — strong pick for ${focusIds.join(", ")} builds.`,
            perkId,
          });
          break;
        }
        continue;
      }
      const attrLvl = state.attributes?.[perk.attrId] || 0;
      const reqLevels = perk.requires?.attributeLevels;
      const req = Array.isArray(reqLevels) ? (reqLevels[lvl] ?? reqLevels[0]) : (perk.requires?.attribute || lvl + 1);
      if (attrLvl < req) {
        hints.push({
          type: "focus",
          message: `Raise ${perk.attrName} to ${req}+ to start ${perk.name} (matches your build focus).`,
        });
        continue;
      }
      if (remain > 0) {
        hints.push({
          type: "focus",
          message: `${perk.name} can go to Lv ${lvl + 1} — strong pick for ${focusIds.join(", ")} builds.`,
          perkId,
        });
        break;
      }
    }

    if (selectedPerk && remain > 0) {
      const lvl = state.perks?.[selectedPerk.id] || 0;
      const attr = skillsData.attributes.find((a) => a.id === selectedPerk.attrId);
      const reqLevels = selectedPerk.requires?.attributeLevels;
      const nextReq = selectedPerk.requires?.general
        ? 0
        : (Array.isArray(reqLevels) ? (reqLevels[lvl] ?? lvl + 1) : (selectedPerk.requires?.attribute || lvl + 1));
      if (lvl < selectedPerk.maxLevel && (selectedPerk.requires?.general || (state.attributes?.[selectedPerk.attrId] || 0) >= nextReq)) {
        hints.push({ type: "next", message: `You can raise ${selectedPerk.name} to Lv ${lvl + 1}.`, perkId: selectedPerk.id });
      } else if (lvl >= selectedPerk.maxLevel) {
        hints.push({ type: "info", message: `${selectedPerk.name} is maxed for your current points.` });
      } else if (attr && !selectedPerk.requires?.general) {
        hints.push({
          type: "info",
          message: `${selectedPerk.name} needs ${attr.name} ${nextReq}+ before the next perk level.`,
        });
      }
    }

    return hints.slice(0, 4);
  }

  function findPerk(skillsData, perkId) {
    for (const attr of skillsData.attributes) {
      const perk = attr.perks.find((p) => p.id === perkId);
      if (perk) return { ...perk, attrId: attr.id, attrName: attr.name, attrColor: attr.color };
    }
    return null;
  }

  function renderPerkHintsHtml(hints) {
    if (!hints.length) return "";
    return `<ul class="planner-hints-list">${hints.map((h) =>
      `<li class="planner-hint planner-hint--${h.type}">${SDD.escapeHTML(h.message)}</li>`
    ).join("")}</ul>`;
  }

  function snapshotForCompare(state) {
    return {
      playerLevel: state.playerLevel,
      attributes: { ...state.attributes },
      perks: { ...state.perks },
      loadout: SDD.Loadout.normalizeLoadout(state.loadout, []),
    };
  }

  function diffBuilds(current, other, skillsData, catalogItems) {
    if (!other) return null;
    const diffs = { attributes: [], perks: [], loadout: [] };

    for (const attr of skillsData.attributes) {
      const a = current.attributes?.[attr.id] || 0;
      const b = other.attributes?.[attr.id] || 0;
      if (a !== b) diffs.attributes.push({ id: attr.id, name: attr.name, color: attr.color, from: b, to: a, delta: a - b });
    }

    const allPerkIds = new Set();
    skillsData.attributes.forEach((attr) => attr.perks.forEach((p) => allPerkIds.add(p.id)));
    for (const perkId of allPerkIds) {
      const a = current.perks?.[perkId] || 0;
      const b = other.perks?.[perkId] || 0;
      if (a !== b) {
        const perk = findPerk(skillsData, perkId);
        diffs.perks.push({
          id: perkId,
          name: perk?.name || perkId,
          color: perk?.attrColor,
          from: b,
          to: a,
          delta: a - b,
        });
      }
    }

    if (current.playerLevel !== other.playerLevel) {
      diffs.level = { from: other.playerLevel, to: current.playerLevel, delta: current.playerLevel - other.playerLevel };
    }

    const curL = SDD.Loadout.normalizeLoadout(current.loadout || {}, catalogItems);
    const othL = SDD.Loadout.normalizeLoadout(other.loadout || {}, catalogItems);

    const listKeys = ["weapons", "tools", "food", "water", "medical", "vehicles"];
    for (const key of listKeys) {
      const curSet = new Set(curL[key] || []);
      const othSet = new Set(othL[key] || []);
      for (const id of curSet) {
        if (!othSet.has(id)) {
          const item = findItem(catalogItems, id);
          diffs.loadout.push({ kind: "add", category: key, id, name: item?.name || id });
        }
      }
      for (const id of othSet) {
        if (!curSet.has(id)) {
          const item = findItem(catalogItems, id);
          diffs.loadout.push({ kind: "remove", category: key, id, name: item?.name || id });
        }
      }
    }

    if (curL.armorSet !== othL.armorSet) {
      diffs.loadout.push({
        kind: "change",
        category: "outfit",
        from: othL.armorSet,
        to: curL.armorSet,
        name: `${othL.armorSet || "none"} → ${curL.armorSet || "none"}`,
      });
    } else if (curL.armorSet && curL.armorQuality !== othL.armorQuality) {
      diffs.loadout.push({
        kind: "change",
        category: "outfit-quality",
        name: `Outfit quality Q${othL.armorQuality} → Q${curL.armorQuality}`,
      });
    }

    const hasChanges = diffs.attributes.length || diffs.perks.length || diffs.loadout.length || diffs.level;
    return hasChanges ? diffs : { empty: true };
  }

  function renderCompareHtml(diff, compareName) {
    const esc = SDD.escapeHTML;
    if (!diff) {
      return `<p class="muted planner-insights-empty">Pick a saved build to compare against your current planner state.</p>`;
    }
    if (diff.empty) {
      return `<p class="muted planner-insights-empty">No differences — current planner matches "${esc(compareName)}".</p>`;
    }

    let html = `<p class="planner-compare-intro muted">Compared to <strong>${esc(compareName)}</strong> (current planner → saved build values shown as change).</p><div class="planner-compare-grid">`;

    if (diff.level) {
      html += `<div class="planner-compare-block"><h4>Survivor level</h4><p>${diff.level.from} → <strong>${diff.level.to}</strong> (${diff.level.delta >= 0 ? "+" : ""}${diff.level.delta})</p></div>`;
    }

    if (diff.attributes.length) {
      html += `<div class="planner-compare-block"><h4>Attributes</h4><ul>${diff.attributes.map((r) =>
        `<li style="--attr-color:${r.color}">${esc(r.name)}: ${r.from} → <strong>${r.to}</strong> (${r.delta >= 0 ? "+" : ""}${r.delta})</li>`
      ).join("")}</ul></div>`;
    }

    if (diff.perks.length) {
      html += `<div class="planner-compare-block"><h4>Perks</h4><ul>${diff.perks.map((r) =>
        `<li style="--attr-color:${r.color || "inherit"}">${esc(r.name)}: ${r.from} → <strong>${r.to}</strong> (${r.delta >= 0 ? "+" : ""}${r.delta})</li>`
      ).join("")}</ul></div>`;
    }

    if (diff.loadout.length) {
      html += `<div class="planner-compare-block"><h4>Loadout</h4><ul>${diff.loadout.map((r) => {
        if (r.kind === "add") return `<li class="planner-diff-add">+ ${esc(r.name)} <span class="muted">(${esc(r.category)})</span></li>`;
        if (r.kind === "remove") return `<li class="planner-diff-remove">− ${esc(r.name)} <span class="muted">(${esc(r.category)})</span></li>`;
        return `<li class="planner-diff-change">${esc(r.name)}</li>`;
      }).join("")}</ul></div>`;
    }

    html += `</div>`;
    return html;
  }

  window.SDD = window.SDD || {};
  window.SDD.PlannerInsights = {
    loadRecipeCache,
    buildCraftRollup,
    computeLoadoutTotals,
    collectPerkHints,
    diffBuilds,
    getLoadoutIdSet,
    isCraftUnlockRelevant,
    renderPerkCraftUnlockCell,
    renderCraftRollupHtml,
    renderLoadoutTotalsHtml,
    renderPerkHintsHtml,
    renderCompareHtml,
    snapshotForCompare,
  };
})();
