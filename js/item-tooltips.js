/**
 * In-game-style item tooltips with optional Quality 1–6 scaling (vanilla).
 */
(function () {
  let statsById = {};
  let qualityLevels = [];

  const DEFAULT_QUALITY_LEVELS = [
    { q: 1, name: "Junk", color: "#9aa0a6", modSlots: 1, level: "1–10" },
    { q: 2, name: "Common", color: "#e67e22", modSlots: 1, level: "11–20" },
    { q: 3, name: "Uncommon", color: "#f1c40f", modSlots: 2, level: "21–30" },
    { q: 4, name: "Rare", color: "#2ecc71", modSlots: 2, level: "31–40" },
    { q: 5, name: "Epic", color: "#3498db", modSlots: 2, level: "41–50" },
    { q: 6, name: "Legendary", color: "#9b59b6", modSlots: 3, level: "51–60" },
  ];

  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function loadItemStats() {
    try {
      const res = await fetch("data/item-stats.json", { cache: "no-store" });
      if (res.ok) {
        const raw = await res.json();
        qualityLevels = raw._qualityLevels || DEFAULT_QUALITY_LEVELS;
        statsById = raw;
      }
    } catch (_) {
      statsById = {};
      qualityLevels = DEFAULT_QUALITY_LEVELS;
    }
    return statsById;
  }

  function getItemStats(itemId) {
    const data = statsById[itemId];
    if (!data || typeof data !== "object" || itemId.startsWith("_")) return null;
    return data;
  }

  function supportsQuality(item) {
    const data = getItemStats(item.id);
    if (!data?.qualityScale) return false;
    return Boolean(data.scalable || data.qualityByTier);
  }

  function tierValue(arr, quality) {
    if (!arr?.length) return null;
    return arr[Math.min(Math.max(quality - 1, 0), arr.length - 1)];
  }

  /** +10% entity/block damage per quality above Q1 (vanilla fallback). */
  function damageMultiplier(quality) {
    return 1 + 0.1 * (quality - 1);
  }

  function scaleDurability(min, max, quality) {
    return Math.round(min + ((max - min) / 5) * (quality - 1));
  }

  function scaleStamina(base, quality) {
    return Math.round(base * damageMultiplier(quality));
  }

  function formatNum(n) {
    if (n == null || Number.isNaN(n)) return "—";
    return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
  }

  function qualityMeta(quality) {
    return qualityLevels.find((l) => l.q === quality) || DEFAULT_QUALITY_LEVELS[quality - 1];
  }

  function buildScaledEffects(data, quality) {
    const s = data.scalable || {};
    const q = data.qualityByTier || {};
    const mult = damageMultiplier(quality);
    const meta = qualityMeta(quality);
    const modSlots = tierValue(q.modSlots, quality) ?? meta.modSlots;
    const effects = [];

    effects.push(
      { label: "Item quality", value: `Q${quality} · ${meta.name}`, tone: "good", qualityColor: meta.color },
      { label: "Required level", value: meta.level, tone: "neutral" },
      { label: "Mod slots", value: String(modSlots), tone: "good" }
    );

    const entityDmg = tierValue(q.entityDamage, quality);
    if (entityDmg != null) {
      effects.push({ label: "Entity damage", value: formatNum(entityDmg), tone: "good" });
    } else if (s.entityDamage != null) {
      effects.push({ label: "Entity damage", value: formatNum(s.entityDamage * mult), tone: "good" });
    }

    const blockDmg = tierValue(q.blockDamage, quality);
    if (blockDmg != null) {
      effects.push({ label: "Block damage", value: formatNum(blockDmg), tone: "neutral" });
    } else if (s.blockDamage != null) {
      effects.push({ label: "Block damage", value: formatNum(s.blockDamage * mult), tone: "neutral" });
    }

    const staminaQV = tierValue(q.staminaCost, quality);
    if (staminaQV != null) {
      effects.push({ label: "Stamina per swing", value: formatNum(staminaQV), tone: "warn" });
    } else if (s.staminaCost != null) {
      effects.push({ label: "Stamina per swing", value: formatNum(scaleStamina(s.staminaCost, quality)), tone: "warn" });
    }

    const mag = tierValue(q.magazineSize, quality);
    if (mag != null) {
      effects.push({ label: "Magazine size", value: formatNum(mag), tone: "neutral" });
    } else if (s.magazineSize != null) {
      effects.push({ label: "Magazine size", value: formatNum(Math.round(s.magazineSize * mult)), tone: "neutral" });
    }

    const armor = tierValue(q.armorRating, quality);
    if (armor != null) {
      effects.push({ label: "Armor rating", value: `~${formatNum(armor)}%`, tone: "good" });
    } else if (s.armorRating != null) {
      effects.push({
        label: "Armor rating",
        value: `~${formatNum(Math.round(s.armorRating * mult))}%`,
        tone: "good",
      });
    }

    const dur = tierValue(q.durability, quality);
    if (dur != null) {
      effects.push({ label: "Max durability", value: formatNum(dur), tone: "neutral" });
    } else if (s.durabilityMin != null && s.durabilityMax != null) {
      effects.push({
        label: "Max durability",
        value: formatNum(scaleDurability(s.durabilityMin, s.durabilityMax, quality)),
        tone: "neutral",
      });
    }

    const effRange = tierValue(q.effectiveRange, quality);
    if (effRange != null) {
      effects.push({ label: "Effective range (m)", value: formatNum(effRange), tone: "neutral" });
    }

    return effects;
  }

  function profileStatColumns(itemId) {
    const data = getItemStats(itemId);
    if (!data?.qualityByTier) return [];
    const defs = [
      { id: "entityDamage", label: "Damage" },
      { id: "blockDamage", label: "Block dmg" },
      { id: "durability", label: "Durability" },
      { id: "magazineSize", label: "Magazine" },
      { id: "modSlots", label: "Mod slots" },
      { id: "physicalDamageResist", label: "Armor" },
      { id: "staminaCost", label: "Stamina" },
      { id: "effectiveRange", label: "Range (m)" },
    ];
    return defs.filter((col) => data.qualityByTier[col.id]?.length);
  }

  function formatStatCell(colId, value) {
    if (value == null) return "—";
    const n = formatNum(value);
    if (colId === "physicalDamageResist") return `${n}%`;
    return n;
  }

  function selectedProfileStats(item, selectedQuality) {
    const data = getItemStats(item.id);
    if (!data) return [];
    const effects = buildScaledEffects(data, selectedQuality);
    const keep = new Set([
      "Entity damage", "Block damage", "Max durability", "Magazine size",
      "Mod slots", "Armor rating", "Stamina per swing", "Effective range (m)",
    ]);
    return effects.filter((e) => keep.has(e.label));
  }

  function renderProfileSelectedStats(item, selectedQuality) {
    const data = getItemStats(item.id);
    if (!data) return "";
    let rows = [];
    if (supportsQuality(item)) {
      rows = selectedProfileStats(item, selectedQuality);
    } else if (data.effects?.length) {
      rows = data.effects;
    } else if (data.staticEffects?.length) {
      rows = data.staticEffects;
    }
    if (!rows.length) return "";
    const chips = rows.map((e) => {
      const valueStyle = e.qualityColor ? ` style="color:${e.qualityColor}"` : "";
      return `<span class="loadout-stat-chip"><span class="loadout-stat-label">${escapeHTML(e.label)}</span><span class="loadout-stat-value"${valueStyle}>${escapeHTML(e.value)}</span></span>`;
    }).join("");
    return `<div class="loadout-selected-stats">${chips}</div>`;
  }

  function renderProfileQualityTable(item, selectedQuality) {
    if (!supportsQuality(item)) return "";
    const data = getItemStats(item.id);
    const columns = profileStatColumns(item.id);
    if (!columns.length) return "";

    const head = `<tr><th>Quality</th>${columns.map((c) => `<th>${escapeHTML(c.label)}</th>`).join("")}</tr>`;
    const body = qualityLevels.map((lvl) => {
      const q = lvl.q;
      const active = q === selectedQuality;
      const cells = columns.map((col) => {
        const val = tierValue(data.qualityByTier[col.id], q);
        return `<td>${escapeHTML(formatStatCell(col.id, val))}</td>`;
      }).join("");
      return `
        <tr class="loadout-quality-row${active ? " is-selected" : ""}">
          <td>
            <span class="loadout-q-badge" style="--q-color:${lvl.color}">Q${q}</span>
            <span class="loadout-q-name">${escapeHTML(lvl.name)}</span>
          </td>
          ${cells}
        </tr>`;
    }).join("");

    return `
      <div class="loadout-quality-table-wrap">
        <table class="loadout-quality-table">
          <thead>${head}</thead>
          <tbody>${body}</tbody>
        </table>
      </div>`;
  }

  function renderQualityPicker(item, selectedQuality) {
    if (!supportsQuality(item)) return "";

    const buttons = qualityLevels
      .map((lvl) => {
        const active = lvl.q === selectedQuality;
        return `
          <button type="button"
            class="quality-btn ${active ? "is-active" : ""}"
            data-quality="${lvl.q}"
            style="--q-color: ${lvl.color}"
            title="${escapeHTML(lvl.name)} (Q${lvl.q})"
            aria-pressed="${active}">
            <span class="quality-btn-swatch" aria-hidden="true"></span>
            <span class="quality-btn-label">Q${lvl.q}</span>
          </button>`;
      })
      .join("");

    return `
      <div class="quality-picker" role="group" aria-label="Item quality tier">
        <span class="quality-picker-label">Quality</span>
        <div class="quality-picker-btns">${buttons}</div>
      </div>`;
  }

  function renderCompactQualityPicker(item, selectedQuality) {
    if (!supportsQuality(item)) return "";

    const buttons = qualityLevels
      .map((lvl) => {
        const active = lvl.q === selectedQuality;
        return `
          <button type="button"
            class="quality-btn ${active ? "is-active" : ""}"
            data-quality="${lvl.q}"
            style="--q-color: ${lvl.color}"
            title="${escapeHTML(lvl.name)} (Q${lvl.q})"
            aria-pressed="${active}">
            <span class="quality-btn-swatch" aria-hidden="true"></span>
            <span class="quality-btn-label">Q${lvl.q}</span>
          </button>`;
      })
      .join("");

    return `
      <div class="quality-picker quality-picker--compact" role="group" aria-label="Item quality for ${escapeHTML(item.name)}">
        <div class="quality-picker-btns">${buttons}</div>
      </div>`;
  }

  function renderItemTooltip(item, selectedQuality = 1) {
    const data = getItemStats(item.id);
    if (!data) {
      return `<p class="item-tooltip-empty muted">No detailed stat sheet for this item yet.</p>`;
    }

    let effects = [];
    if (data.qualityScale && (data.scalable || data.qualityByTier)) {
      effects = buildScaledEffects(data, selectedQuality);
      if (data.staticEffects?.length) effects = effects.concat(data.staticEffects);
    } else if (data.effects?.length) {
      effects = data.effects;
    } else {
      return `<p class="item-tooltip-empty muted">No detailed stat sheet for this item yet.</p>`;
    }

    const rows = effects
      .map((e) => {
        const tone = e.tone || "neutral";
        const valueStyle = e.qualityColor ? ` style="color:${e.qualityColor}"` : "";
        return `
          <div class="tooltip-row tooltip-row--${tone}">
            <span class="tooltip-label">${escapeHTML(e.label)}</span>
            <span class="tooltip-value"${valueStyle}>${escapeHTML(e.value)}</span>
          </div>`;
      })
      .join("");

    const notes = (data.notes || [])
      .map((n) => `<li>${escapeHTML(n)}</li>`)
      .join("");

    const disclaimer = statsById._disclaimer
      ? `<p class="tooltip-disclaimer">${escapeHTML(statsById._disclaimer)}</p>`
      : "";

    return `
      <div class="item-tooltip-panel" role="region" aria-label="Item effects at quality ${selectedQuality}">
        <div class="tooltip-rows">${rows}</div>
        ${notes ? `<ul class="tooltip-notes">${notes}</ul>` : ""}
        ${disclaimer}
      </div>`;
  }

  window.ItemTooltips = {
    loadItemStats,
    getItemStats,
    supportsQuality,
    buildScaledEffects,
    qualityMeta,
    renderQualityPicker,
    renderCompactQualityPicker,
    renderProfileSelectedStats,
    renderProfileQualityTable,
    renderItemTooltip,
    qualityLevels: () => qualityLevels,
  };
})();
