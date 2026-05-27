#!/usr/bin/env node
/**
 * Builds a comprehensive data/items.json from 7dtd-assets ItemIcons + data/entities.json.
 * Run: npm run catalog:build
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ICONS_PATH = path.join(ROOT, "data/github-icons-v2.1.json");
const ENTITIES_PATH = path.join(ROOT, "data/entities.json");
const ITEMS_PATH = path.join(ROOT, "data/items.json");

const STANDALONE_ICONS = {
  forge: "tools",
  workbench: "tools",
  chemistryStation: "tools",
  cementMixer: "tools",
  bladeTrap: "traps",
  dartTrap: "traps",
  autoTurret: "traps",
  shotgunTurret: "traps",
  barbedFence: "traps",
  electricfencepost: "traps",
  gyrocopterStatic: "vehicles",
};

const SKIP_PREFIXES = [
  "cnt", "deco", "sign", "terr", "shape", "wood", "concrete", "brick",
  "cobblestone", "scrapIron", "metal", "glass", "curtain", "drapes",
  "awning", "couch", "chair", "table", "toilet", "sink", "pipeSmall",
  "modular", "book", "note", "quest", "challenge", "buff", "perk",
  "bundle", "cnt", "gore", "rug", "sleeper", "planted", "tree",
  "shrub", "bush", "grass", "rock", "oreDeposit", "terrAsphalt",
];

/** Vanilla drug* icons that are medical consumables (not candy / skill magazines). */
const MEDICAL_DRUG_ICONS = new Set([
  "drugPainkillers",
  "drugAntibiotics",
  "drugHerbalAntibiotics",
  "drugVitamins",
  "drugRecog",
  "drugSteroids",
  "drugOhShitzDrops",
]);

const CATEGORIES = [
  { id: "weapons-melee", name: "Melee Weapons", icon: "axe" },
  { id: "weapons-ranged", name: "Ranged Weapons", icon: "crosshair" },
  { id: "ammo", name: "Ammunition", icon: "bullet" },
  { id: "tools", name: "Tools", icon: "hammer" },
  { id: "food", name: "Food & Drink", icon: "drumstick" },
  { id: "medical", name: "Medical", icon: "cross" },
  { id: "resources", name: "Resources", icon: "ore" },
  { id: "traps", name: "Traps & Defense", icon: "spike" },
  { id: "vehicles", name: "Vehicles", icon: "wheel" },
  { id: "vehicle-parts", name: "Vehicle Parts", icon: "wheel" },
  { id: "clothing", name: "Armor & Apparel", icon: "shield" },
  { id: "robotics", name: "Robotics", icon: "chip" },
  { id: "mods-weapon", name: "Weapon Mods", icon: "bullet" },
  { id: "mods-armor", name: "Armor Mods", icon: "shield" },
  { id: "mods-melee", name: "Melee & Tool Mods", icon: "axe" },
  { id: "mods-vehicle", name: "Vehicle Mods", icon: "wheel" },
  { id: "mods-drone", name: "Drone Mods", icon: "chip" },
  { id: "enemies", name: "Zombies & Infected", icon: "skull" },
];

function classifyMod(icon) {
  if (icon.startsWith("modGun") || icon.startsWith("modShotgun")) return "mods-weapon";
  if (icon.startsWith("modArmor") || icon === "modRadiationReady") return "mods-armor";
  if (icon.startsWith("modMelee")) return "mods-melee";
  if (icon.startsWith("modVehicle") || icon.startsWith("modFuel")) return "mods-vehicle";
  if (icon.startsWith("modRobotic")) return "mods-drone";
  return "mods-melee";
}

function classifyVehicle(icon) {
  if (
    icon.includes("Chassis") ||
    icon.includes("Handlebars") ||
    icon.includes("Accessories") ||
    icon === "vehicleWheels" ||
    icon === "smallEngine"
  ) {
    return "vehicle-parts";
  }
  if (icon.startsWith("bundleVehicle")) return "vehicles";
  return "vehicles";
}

function shouldSkipIcon(icon) {
  return SKIP_PREFIXES.some((p) => icon.startsWith(p));
}

function classifyIcon(icon) {
  if (shouldSkipIcon(icon)) return null;
  if (STANDALONE_ICONS[icon]) return STANDALONE_ICONS[icon];
  if (/^(resource|ore)/.test(icon)) return "resources";
  if (icon.startsWith("meleeWpn")) return "weapons-melee";
  if (/^gun(Bow|Crossbow|Handgun|Rifle|Shotgun|MG|Explosives)/.test(icon)) return "weapons-ranged";
  if (icon.startsWith("meleeTool")) return "tools";
  if (icon.startsWith("ammo")) return "ammo";
  if (icon.startsWith("mod")) return classifyMod(icon);
  if (icon.startsWith("vehicle") || icon === "gyrocopterStatic") return classifyVehicle(icon);
  if (icon.startsWith("food") || icon.startsWith("drink")) return "food";
  if (icon.startsWith("medical")) return "medical";
  if (icon.startsWith("drug")) {
    return MEDICAL_DRUG_ICONS.has(icon) ? "medical" : "food";
  }
  if (icon.startsWith("armor")) return "clothing";
  if (icon.startsWith("gunBot")) return "robotics";
  if (/^(trap|bladeTrap|dartTrap|autoTurret|shotgunTurret|barbedFence|electricfence)/.test(icon)) {
    return "traps";
  }
  return null;
}

function humanizeIcon(icon) {
  let s = icon
    .replace(/^(gun|meleeWpn|meleeTool|ammo|resource|mod|armor|food|drink|medical|drug|vehicle)/, "")
    .replace(/T[0-3]/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .trim();
  if (!s) s = icon.replace(/([A-Z])/g, " $1").trim();
  return s.replace(/\s+/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function iconToId(icon) {
  return icon
    .replace(/([A-Z])/g, "-$1")
    .replace(/_/g, "-")
    .toLowerCase()
    .replace(/^-/, "")
    .replace(/-+/g, "-");
}

function inferTier(icon, category) {
  if (/T3|steel|Steel|compound|Compound|auger|chainsaw|m60|M60|sniper|Sniper|legendary/i.test(icon)) {
    return 3;
  }
  if (/T2|iron|Iron|steel|Steel|forged|Forged/i.test(icon)) return 2;
  if (category === "resources" || category === "ammo" || category === "food") return 1;
  if (category.startsWith("mods")) return 2;
  return 1;
}

function inferStack(category) {
  if (category === "resources") return 6000;
  if (category === "ammo") return 250;
  if (category.startsWith("mods")) return 50;
  if (category === "food" || category === "medical") return 50;
  return 1;
}

function defaultSummary(icon, category, name) {
  if (icon.startsWith("drug") && category === "food") {
    return `Skill magazine (snack): ${name}.`;
  }
  const templates = {
    resources: `Crafting resource: ${name}.`,
    ammo: `Ammunition type: ${name}.`,
    "weapons-melee": `Melee weapon: ${name}.`,
    "weapons-ranged": `Ranged weapon: ${name}.`,
    tools: `Tool: ${name}.`,
    food: `Consumable: ${name}.`,
    medical: `Medical item: ${name}.`,
    clothing: `Armor or apparel piece: ${name}.`,
    traps: `Trap or defensive device: ${name}.`,
    vehicles: `Vehicle: ${name}.`,
    "vehicle-parts": `Vehicle component: ${name}.`,
    robotics: `Robotics deployable: ${name}.`,
    "mods-weapon": `Weapon mod: ${name}.`,
    "mods-armor": `Armor mod: ${name}.`,
    "mods-melee": `Melee/tool mod: ${name}.`,
    "mods-vehicle": `Vehicle mod: ${name}.`,
    "mods-drone": `Drone mod: ${name}.`,
  };
  return templates[category] || `Base-game item: ${name}.`;
}

function inferModSlot(icon, category) {
  if (!category.startsWith("mods")) return undefined;
  if (icon.includes("Scope") || icon.includes("Sight")) return "optic";
  if (icon.includes("Silencer") || icon.includes("Muzzle") || icon.includes("Barrel") || icon.includes("Choke") || icon.includes("Bipod") || icon.includes("Foregrip")) return "barrel";
  if (icon.includes("Magazine") || icon.includes("Drum") || icon.includes("Trigger")) return "receiver";
  if (icon.includes("Bow")) return "bow";
  if (category === "mods-drone") return "drone";
  if (category === "mods-vehicle") return "vehicle";
  if (category === "mods-armor") return "armor";
  return "mod";
}

function buildItemFromIcon(icon, category, curated = {}) {
  const name = curated.name || humanizeIcon(icon);
  const id = curated.id || iconToId(icon);
  const item = {
    id,
    name,
    category,
    tier: curated.tier ?? inferTier(icon, category),
    stack: curated.stack ?? inferStack(category),
    weight: curated.weight ?? (category === "resources" ? 0 : category.startsWith("mods") ? 0 : 1),
    modIcon: icon,
    summary: curated.summary || defaultSummary(icon, category, name),
    ingredients: curated.ingredients ?? ["See in-game recipe / loot tables"],
    perk: curated.perk ?? "",
    uses: curated.uses ?? [],
  };
  if (curated.recipe) item.recipe = curated.recipe;
  const slot = inferModSlot(icon, category);
  if (slot) item.modSlot = slot;
  return item;
}

function buildEntityItem(e) {
  return {
    id: e.id,
    name: e.name,
    category: e.category,
    tier: e.tier ?? 2,
    stack: 1,
    weight: 0,
    proceduralIcon: true,
    entityId: e.entityId,
    aliases: e.aliases,
    threat: e.threat,
    health: e.health,
    biomes: e.biomes,
    summary: e.summary,
    ingredients: ["Spawned in world"],
    perk: "",
    uses: e.uses ?? [],
  };
}

function loadCuratedSummaries() {
  const map = new Map();
  if (!fs.existsSync(ITEMS_PATH)) return map;
  try {
    const data = JSON.parse(fs.readFileSync(ITEMS_PATH, "utf8"));
    for (const item of data.items || []) {
      if (item.modIcon && item.summary) map.set(item.modIcon, item);
      if (item.id && item.summary) map.set(`id:${item.id}`, item);
    }
  } catch (_) {}
  return map;
}

function main() {
  const icons = JSON.parse(fs.readFileSync(ICONS_PATH, "utf8"));
  const entities = JSON.parse(fs.readFileSync(ENTITIES_PATH, "utf8")).entities.filter(
    (e) => e.category === "enemies"
  );
  const curated = loadCuratedSummaries();

  const items = [];
  const usedIds = new Set();

  for (const icon of icons) {
    const category = classifyIcon(icon);
    if (!category) continue;

    const cur = curated.get(icon) || {};
    let id = cur.id || iconToId(icon);
    if (usedIds.has(id)) id = `${id}-${icon.slice(-4).toLowerCase()}`;
    usedIds.add(id);

    items.push(buildItemFromIcon(icon, category, { ...cur, id }));
  }

  for (const e of entities) {
    if (usedIds.has(e.id)) continue;
    usedIds.add(e.id);
    items.push(buildEntityItem(e));
  }

  const catOrder = Object.fromEntries(CATEGORIES.map((c, i) => [c.id, i]));
  items.sort((a, b) => {
    const d = (catOrder[a.category] ?? 99) - (catOrder[b.category] ?? 99);
    return d !== 0 ? d : a.name.localeCompare(b.name);
  });

  const out = { categories: CATEGORIES, items };
  fs.writeFileSync(ITEMS_PATH, JSON.stringify(out, null, 2) + "\n");

  const counts = {};
  items.forEach((i) => (counts[i.category] = (counts[i.category] || 0) + 1));
  console.log(`Wrote ${items.length} catalog entries → data/items.json\n`);
  for (const c of CATEGORIES) {
    console.log(`  ${c.name.padEnd(22)} ${counts[c.id] || 0}`);
  }
}

main();
