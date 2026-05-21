#!/usr/bin/env node
/**
 * Fetches per-quality item stats from 7daystodie.wiki.gg infoboxes.
 * Output: data/wiki-item-stats-cache.json
 * Run: npm run stats:wiki  (or as part of stats:generate)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const WIKI_API = "https://7daystodie.wiki.gg/api.php";
const OUT_PATH = path.join(ROOT, "data/wiki-item-stats-cache.json");
const OVERRIDES_PATH = path.join(ROOT, "data/item-wiki-stats-pages.json");

const SYNC_CATEGORIES = new Set([
  "weapons-melee",
  "weapons-ranged",
  "tools",
  "clothing",
  "food",
  "medical",
  "ammo",
  "traps",
  "vehicles",
  "robotics",
]);

const NAME_PREFIXES = [
  "Sledge ", "Club ", "Blade ", "Spear ", "Knuckles ", "Baton ",
  "Bow ", "Handgun ", "Rifle ", "Shotgun ", "MG ", "Explosives ", "Bot ",
  "Pick ", "Axe ", "Shovel ", "Repair ", "Salvage ", "All Steel ",
];

const wikiCache = new Map();

async function wikiGet(params) {
  const url = `${WIKI_API}?${new URLSearchParams({ format: "json", ...params })}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": "SurvivorsCodex/1.0 (fan catalog)" } });
    if (res.status === 429) {
      await sleep(1500 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(`Wiki ${res.status}`);
    return res.json();
  }
  throw new Error("Wiki rate limited");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseQualityValues(wikitext, key) {
  const re = new RegExp(`\\|${key}\\s*=\\s*\\{\\{QualityValues\\|([^}]+)\\}\\}`, "i");
  const m = wikitext.match(re);
  if (!m) return null;
  return m[1].split("|").map((s) => parseFloat(s.trim())).filter((n) => !Number.isNaN(n));
}

function parseSingle(wikitext, key) {
  const re = new RegExp(`^\\|${key}\\s*=\\s*([^\\n|]+)`, "im");
  const m = wikitext.match(re);
  if (!m) return null;
  let v = m[1].trim();
  if (v.startsWith("{{") || v.includes("{{")) return null;
  return v;
}

function parseMagazineQualities(wikitext) {
  const base = parseSingle(wikitext, "magazinecount");
  if (!base) return null;
  const arr = [parseFloat(base)];
  for (let q = 2; q <= 6; q++) {
    const v = parseSingle(wikitext, `magazinequal${q}`);
    arr.push(v != null ? parseFloat(v) : arr[arr.length - 1]);
  }
  return arr.length === 6 ? arr : null;
}

function parseAmmoDmgPrimary(wikitext) {
  const m = wikitext.match(/\{\{AmmoDmg\|([^|]+)\|damage(?:\|add=([-\d.]+))?\}\}/i);
  if (!m) return null;
  return { ammoPage: m[1].trim(), add: parseFloat(m[2] || 0) };
}

function parseAmmoBlockDmgPrimary(wikitext) {
  const m = wikitext.match(/\{\{AmmoDmg\|([^|]+)\|block_damage(?:\|add=([-\d.]+))?\}\}/i);
  if (!m) return null;
  return { ammoPage: m[1].trim(), add: parseFloat(m[2] || 0) };
}

async function fetchWikitext(pageTitle) {
  if (wikiCache.has(pageTitle)) return wikiCache.get(pageTitle);
  try {
    const data = await wikiGet({ action: "parse", page: pageTitle, prop: "wikitext" });
    const text = data.parse?.wikitext?.["*"] || null;
    wikiCache.set(pageTitle, text);
    return text;
  } catch {
    wikiCache.set(pageTitle, null);
    return null;
  }
}

async function fetchAmmoStat(ammoPage, field) {
  const text = await fetchWikitext(ammoPage);
  if (!text) return null;
  const v = parseSingle(text, field);
  if (!v) return null;
  const num = parseFloat(v.replace(/\*.*$/, ""));
  return Number.isNaN(num) ? null : num;
}

function catalogNameToWikiPage(name) {
  let n = name.trim();
  for (const p of NAME_PREFIXES) {
    if (n.startsWith(p)) {
      n = n.slice(p.length);
      break;
    }
  }
  return n;
}

function buildGunDamageArray(ammoBase, weaponAdd) {
  const base = (ammoBase ?? 0) + (weaponAdd ?? 0);
  return Array.from({ length: 6 }, (_, i) => Math.round((base * (1 + 0.1 * i)) * 10) / 10);
}

async function parseInfoboxStats(pageTitle, wikitext, category) {
  if (!wikitext || !wikitext.includes("{{Infobox")) return null;

  const qualityByTier = {};
  const staticEffects = [];
  const notes = [`Stats from [wiki.gg ${pageTitle}](https://7daystodie.wiki.gg/wiki/${encodeURIComponent(pageTitle.replace(/ /g, "_"))}).`];

  const entityQV = parseQualityValues(wikitext, "damage");
  const blockQV = parseQualityValues(wikitext, "block_damage");
  const durQV = parseQualityValues(wikitext, "durability_quality");
  const modSlotsQV = parseQualityValues(wikitext, "mod_slots");
  const rangeEffQV = parseQualityValues(wikitext, "range_effective");

  if (entityQV?.length === 6) qualityByTier.entityDamage = entityQV;
  if (blockQV?.length === 6) qualityByTier.blockDamage = blockQV;
  if (durQV?.length === 6) qualityByTier.durability = durQV;
  if (modSlotsQV?.length === 6) qualityByTier.modSlots = modSlotsQV;
  if (rangeEffQV?.length === 6) qualityByTier.effectiveRange = rangeEffQV;
  if (category === "weapons-ranged") {
    const magazineQV = parseMagazineQualities(wikitext);
    if (magazineQV?.length === 6) qualityByTier.magazineSize = magazineQV;
  }

  if (!entityQV) {
    const ammoDmg = parseAmmoDmgPrimary(wikitext);
    if (ammoDmg) {
      const ammoBase = await fetchAmmoStat(ammoDmg.ammoPage, "damage");
      if (ammoBase != null) {
        qualityByTier.entityDamage = buildGunDamageArray(ammoBase, ammoDmg.add);
        staticEffects.push({ label: "Ammo (default)", value: ammoDmg.ammoPage, tone: "neutral" });
      }
    }
  }

  if (!blockQV) {
    const ammoBlock = parseAmmoBlockDmgPrimary(wikitext);
    if (ammoBlock) {
      const ammoBase = await fetchAmmoStat(ammoBlock.ammoPage, "block_damage");
      if (ammoBase != null) {
        qualityByTier.blockDamage = buildGunDamageArray(ammoBase, ammoBlock.add);
      }
    }
  }

  const stamina = parseSingle(wikitext, "stamina_usage");
  if (stamina) staticEffects.push({ label: "Stamina per swing", value: stamina, tone: "warn" });

  const attackRate = parseSingle(wikitext, "attack_rate");
  if (attackRate) staticEffects.push({ label: "Attacks per minute", value: attackRate, tone: "neutral" });

  const range = parseSingle(wikitext, "range");
  if (range) staticEffects.push({ label: "Range (m)", value: range, tone: "neutral" });

  const food = parseSingle(wikitext, "food");
  const hydration = parseSingle(wikitext, "hydration") || parseSingle(wikitext, "water");
  if (food) staticEffects.push({ label: "Food", value: food, tone: "good" });
  if (hydration) staticEffects.push({ label: "Water", value: hydration, tone: "good" });

  const armor = parseQualityValues(wikitext, "armor_rating") || parseQualityValues(wikitext, "armor");
  if (armor?.length === 6) qualityByTier.armorRating = armor;

  const type = parseSingle(wikitext, "type") || parseSingle(wikitext, "category");
  if (type) staticEffects.unshift({ label: "Type", value: type, tone: "neutral" });

  if (!Object.keys(qualityByTier).length && !staticEffects.length) return null;

  const hasQuality = Object.keys(qualityByTier).some((k) => k !== "modSlots");

  return {
    qualityScale: hasQuality,
    qualityByTier,
    staticEffects,
    notes,
    wikiPage: pageTitle,
  };
}

async function main() {
  const items = JSON.parse(fs.readFileSync(path.join(ROOT, "data/items.json"), "utf8")).items;
  const overrides = fs.existsSync(OVERRIDES_PATH)
    ? JSON.parse(fs.readFileSync(OVERRIDES_PATH, "utf8")).pageOverrides || {}
    : {};

  const out = {
    _comment: "Cached wiki.gg infobox stats. Regenerate: npm run stats:wiki",
    _fetched: new Date().toISOString().slice(0, 10),
    items: {},
    missing: [],
  };

  let ok = 0;
  let skip = 0;

  for (const item of items) {
    if (!SYNC_CATEGORIES.has(item.category)) {
      skip++;
      continue;
    }

    const pageTitle = overrides[item.id] || catalogNameToWikiPage(item.name);
    process.stdout.write(`  ${item.id} → ${pageTitle}… `);

    const wikitext = await fetchWikitext(pageTitle);
    const stats = wikitext ? await parseInfoboxStats(pageTitle, wikitext, item.category) : null;

    if (stats) {
      out.items[item.id] = stats;
      console.log("✓");
      ok++;
    } else {
      out.missing.push({ id: item.id, page: pageTitle });
      console.log("✗");
    }

    await sleep(180);
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + "\n");
  console.log(`\nWiki stats: ${ok} synced, ${out.missing.length} missing, ${skip} skipped (non-stat categories).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
