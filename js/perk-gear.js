/* ==========================================================================
   Perk gear — armor sets + craft unlocks for build display
   ========================================================================== */

(() => {
  let gearData = null;

  async function loadPerkGear() {
    if (gearData) return gearData;
    try {
      const res = await fetch("data/perk-gear.json", { cache: "no-store" });
      gearData = await res.json();
    } catch (_) {
      gearData = { armorSets: {}, perks: {} };
    }
    return gearData;
  }

  function statSnippet(itemId, itemStats, quality = 6) {
    const s = itemStats?.[itemId];
    if (!s || typeof s !== "object") return null;
    const parts = [];
    const q = Math.min(Math.max(quality - 1, 0), 5);
    const tier = s.qualityByTier || {};

    if (tier.entityDamage?.[q] != null) parts.push(`DMG ${tier.entityDamage[q]}`);
    if (tier.blockDamage?.[q] != null && !tier.entityDamage) parts.push(`Block ${tier.blockDamage[q]}`);
    if (tier.physicalDamageResist?.[q] != null) parts.push(`Phys ${tier.physicalDamageResist[q]}%`);
    if (tier.durability?.[q] != null) parts.push(`Dur ${tier.durability[q]}`);
    if (tier.modSlots?.[q] != null) parts.push(`${tier.modSlots[q]} mod slots`);

    if (!parts.length && s.staticEffects?.length) {
      s.staticEffects.slice(0, 2).forEach((e) => {
        if (e.label && e.value && e.label !== "Note") parts.push(`${e.label}: ${e.value}`);
      });
    }
    if (!parts.length && s.effects?.length) {
      s.effects.slice(0, 2).forEach((e) => {
        if (e.label && e.value && e.label !== "Note") parts.push(`${e.label}: ${e.value}`);
      });
    }
    return parts.length ? parts.join(" · ") : null;
  }

  function findItem(items, id) {
    return items?.find((i) => i.id === id) || null;
  }

  const BUILD_TYPE_ARMOR = {
    horde: ["commando", "raider", "biker"],
    pvp: ["commando", "assassin", "rogue"],
    solo: ["nomad", "scavenger", "ranger"],
    crafting: ["nerd", "lumberjack", "farmer"],
    gathering: ["miner", "scavenger", "lumberjack"],
    farming: ["farmer", "hoarder"],
    general: [],
  };

  function gearForBuild(build, skillsData, gearConfig) {
    if (!gearConfig || !skillsData) return { armorSets: [], perkGear: [] };

    const activePerks = [];
    for (const attr of skillsData.attributes) {
      for (const perk of attr.perks) {
        const level = build.perks?.[perk.id] || 0;
        if (level > 0) activePerks.push({ perk, level, attr });
      }
    }

    const armorSetIds = new Set();
    const perkGear = [];

    for (const { perk, level, attr } of activePerks) {
      const link = gearConfig.perks?.[perk.id];
      if (!link) continue;

      const unlockIds = new Set();
      for (let lv = 1; lv <= level; lv += 1) {
        (link.unlocksByLevel?.[String(lv)] || []).forEach((id) => unlockIds.add(id));
      }

      const itemIds = [...unlockIds];
      if (link.armorSet && !build.loadout?.armorSet) armorSetIds.add(link.armorSet);

      if (itemIds.length) {
        perkGear.push({
          perkId: perk.id,
          perkName: perk.name,
          level,
          maxLevel: perk.maxLevel,
          attrColor: attr.color,
          itemIds,
        });
      } else if (link.armorSet) {
        perkGear.push({
          perkId: perk.id,
          perkName: perk.name,
          level,
          maxLevel: perk.maxLevel,
          attrColor: attr.color,
          itemIds: [],
          armorSetOnly: link.armorSet,
        });
      }
    }

    // Include explicitly chosen outfit from saved loadout
    if (build.loadout?.armorSet) {
      armorSetIds.add(build.loadout.armorSet);
    }

    // Armor sets from build focus tags when no perk-linked sets yet (skip if loadout picks outfit)
    if (!armorSetIds.size && !build.loadout?.armorSet) {
      SDD.BuildTypes.normalizeBuildTypes(build.buildTypes ?? build.buildType).forEach((bt) => {
        (BUILD_TYPE_ARMOR[bt] || []).forEach((slug) => armorSetIds.add(slug));
      });
    }

    const armorSetsFixed = [...armorSetIds]
      .map((slug) => {
        const set = gearConfig.armorSets?.[slug];
        return set ? { slug, ...set } : null;
      })
      .filter(Boolean);

    return { armorSets: armorSetsFixed, perkGear };
  }

  function listModsForItem(loadout, itemId) {
    const slots = loadout?.mods?.[itemId];
    if (!slots || typeof slots !== "object") return [];
    return Object.entries(slots)
      .sort(([a], [b]) => {
        const ai = /^\d+$/.test(a);
        const bi = /^\d+$/.test(b);
        if (ai && bi) return Number(a) - Number(b);
        if (ai) return 1;
        if (bi) return -1;
        return a.localeCompare(b);
      })
      .map(([, modId]) => modId)
      .filter(Boolean);
  }

  function renderItemModList(itemId, loadout, items, categories, esc) {
    const modIds = listModsForItem(loadout, itemId);
    if (!modIds.length) return "";
    const chips = modIds.map((modId) => {
      const mod = findItem(items, modId) || { id: modId, name: modId };
      const img = window.SDD?.itemIcon
        ? SDD.itemIcon(mod, categories)
        : `<span class="build-gear-fallback">${esc(String(mod.name).charAt(0))}</span>`;
      return `<span class="build-gear-mod" title="${esc(mod.name)}">${img}<span>${esc(mod.name)}</span></span>`;
    }).join("");
    return `<span class="build-gear-mods">${chips}</span>`;
  }

  function renderGearItem(item, categories, itemStats, esc, loadout, items) {
    if (!item) return "";
    const stats = statSnippet(item.id, itemStats);
    const modList = renderItemModList(item.id, loadout, items, categories, esc);
    const img = window.SDD?.itemIcon
      ? SDD.itemIcon(item, categories)
      : `<span class="build-gear-fallback">${esc(item.name.charAt(0))}</span>`;
    return `
      <a class="build-gear-item${modList ? " has-mods" : ""}" href="catalog.html?q=${encodeURIComponent(item.name)}" title="${esc(item.name)}">
        <span class="build-gear-icon">${img}</span>
        <span class="build-gear-info">
          <span class="build-gear-name">${esc(item.name)}</span>
          ${stats ? `<span class="build-gear-stats muted">${esc(stats)}</span>` : ""}
          ${modList}
        </span>
      </a>`;
  }

  function renderArmorSet(set, items, categories, itemStats, esc, loadout) {
    const pieces = (set.pieces || [])
      .map((id) => findItem(items, id))
      .filter(Boolean);
    if (!pieces.length) return "";

    const pieceHtml = pieces
      .map((item) => renderGearItem(item, categories, itemStats, esc, loadout, items))
      .join("");

    return `
      <section class="build-armor-set" style="--attr-color:var(--color-red-bright)">
        <div class="build-armor-set-head">
          <h4 class="build-armor-set-title">${esc(set.label)}</h4>
          <p class="build-armor-set-desc muted">${esc(set.description || "")}</p>
        </div>
        <div class="build-gear-grid build-gear-grid--armor">${pieceHtml}</div>
      </section>`;
  }

  function renderBuildGear(build, skillsData, ctx) {
    const esc = window.SDD?.escapeHTML || ((s) => s);
    const { items = [], categories = [], itemStats = {}, gearConfig } = ctx || {};
    if (!gearConfig) return "";

    const loadout = build.loadout || {};
    const { armorSets, perkGear } = gearForBuild(build, skillsData, gearConfig);
    if (!armorSets.length && !perkGear.some((p) => p.itemIds.length)) return "";

    const armorHtml = armorSets
      .map((set) => renderArmorSet(set, items, categories, itemStats, esc, loadout))
      .join("");

    const perkHtml = perkGear
      .filter((p) => p.itemIds.length)
      .map((p) => {
        const gearItems = p.itemIds
          .map((id) => findItem(items, id))
          .filter(Boolean)
          .map((item) => renderGearItem(item, categories, itemStats, esc, loadout, items))
          .join("");
        if (!gearItems) return "";
        return `
          <section class="build-perk-gear" style="--attr-color:${p.attrColor}">
            <h5 class="build-perk-gear-title">${esc(p.perkName)} <span class="muted">Lv ${p.level}</span></h5>
            <div class="build-gear-grid">${gearItems}</div>
          </section>`;
      })
      .join("");

    if (!armorHtml && !perkHtml) return "";

    return `
      <section class="build-section build-section-gear">
        <h4 class="build-section-title">Perk gear &amp; outfits</h4>
        ${armorHtml}
        ${perkHtml}
      </section>`;
  }

  window.SDD = window.SDD || {};
  window.SDD.PerkGear = {
    loadPerkGear,
    gearForBuild,
    statSnippet,
    renderBuildGear,
  };
})();
