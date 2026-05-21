#!/usr/bin/env node
/**
 * Builds data/perk-gear.json — armor outfit sets + perk → craftable item links.
 * Run: npm run gear:build
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ITEMS_PATH = path.join(ROOT, "data/items.json");
const SKILLS_PATH = path.join(ROOT, "data/skills.json");
const OUT_PATH = path.join(ROOT, "data/perk-gear.json");

/** craftTier label (from skills.json) → catalog item ids */
const CRAFT_TIER_ITEMS = {
  "Stone Axe / Pickaxe": ["melee-tool-repair-t0-stone-axe"],
  "Iron Pickaxe / Fireaxe": ["melee-tool-pick-t1-iron-pickaxe", "melee-tool-axe-t1-iron-fireaxe"],
  "Steel Pickaxe / Fireaxe": ["melee-tool-pick-t2-steel-pickaxe", "melee-tool-axe-t2-steel-axe"],
  "Stone Salvage Tools": ["melee-tool-salvage-t1-wrench"],
  "Iron Salvage Tools": ["melee-tool-salvage-t2-ratchet"],
  "Steel Salvage Tools": ["melee-tool-salvage-t3-impact-driver"],
  "Hubcap Land Mine": ["electricfencepost"],
  "Dynamite Bundle": ["gun-explosives-t3-rocket-launcher"],
  "Pressure Plate Mine": ["barbed-fence"],
  "Farm Plot": [],
  "Super Corn Seed": [],
  "Wooden / Stone Club": ["melee-wpn-club-t0-wooden-club"],
  "Iron Reinforced Club": ["melee-wpn-club-t1-baseball-bat"],
  "Steel Club": ["melee-wpn-club-t3-steel-club"],
  "Stone Sledgehammer": ["melee-wpn-sledge-t0-stone-sledgehammer"],
  "Steel Sledgehammer": ["melee-wpn-sledge-t3-steel-sledgehammer"],
  "Wooden Bow": ["gun-bow-t1-wooden-bow"],
  "Iron Crossbow": ["gun-bow-t1-iron-crossbow"],
  "Compound Bow": ["gun-bow-t3-compound-bow"],
  "Compound Crossbow": ["gun-bow-t3-compound-crossbow"],
  "Pipe Pistol": ["gun-handgun-t0-pipe-pistol"],
  "9mm Pistol": ["gun-handgun-t1-pistol"],
  ".44 Magnum": ["gun-handgun-t2-magnum44"],
  "Desert Vulture": ["gun-handgun-t3-desert-vulture"],
  "Bone Knife": ["melee-wpn-blade-t0-bone-knife"],
  "Hunting Knife": ["melee-wpn-blade-t1-hunting-knife"],
  "Machete": ["melee-wpn-blade-t3-machete"],
  "Stone Spear": ["melee-wpn-spear-t0-stone-spear"],
  "Iron Spear": ["melee-wpn-spear-t1-iron-spear"],
  "Steel Spear": ["melee-wpn-spear-t3-steel-spear"],
  "Pipe Shotgun": ["gun-shotgun-t0-pipe-shotgun"],
  "Double Barrel Shotgun": ["gun-shotgun-t1-double-barrel"],
  "Pump Shotgun": ["gun-shotgun-t2-pump-shotgun"],
  "Auto Shotgun": ["gun-shotgun-t3-auto-shotgun"],
  "Pipe Rifle": ["gun-rifle-t0-pipe-rifle"],
  "Hunting Rifle": ["gun-rifle-t1-hunting-rifle"],
  "Lever Action Rifle": ["gun-rifle-t2-lever-action-rifle"],
  "Sniper Rifle": ["gun-rifle-t3-sniper-rifle"],
  "Pipe Machine Gun": ["gun-m-g-t0-pipe-machine-gun"],
  "SMG-5": ["gun-handgun-t3-s-m-g5"],
  "AK-47 Machine Gun": ["gun-m-g-t1-a-k47"],
  "Tactical Assault Rifle": ["gun-m-g-t2-tactical-a-r"],
  "M60 Machine Gun": ["gun-m-g-t3-m60"],
  "Grilled Meat": ["food-grilled-meat"],
  "Vegetable Stew": ["food-gumbo-stew"],
  "Sham Chowder": ["food-sham-chowder"],
  "Bicycle": ["vehicle-bicycle-placeable", "bicycle-chassis"],
  "Minibike": ["vehicle-minibike-placeable", "minibike-chassis"],
  "Motorcycle": ["vehicle-motorcycle-placeable", "motorcycle-chassis"],
  "4x4 Truck": ["vehicle-truck4x4-placeable"],
  "Gyrocopter": ["vehicle-gyrocopter-placeable"],
  "Pipe Baton": ["melee-wpn-baton-t0-pipe-baton"],
  "Stun Baton": ["melee-wpn-baton-t2-stun-baton"],
  "Electric Fence Post": ["electricfencepost"],
  "Junk Turret": ["gun-bot-t2-junk-turret"],
  "Robotic Sledge": ["gun-bot-t1-junk-sledge"],
  "Robotic Drone": ["gun-bot-t1-junk-drone"],
  "Pipe Bomb": [],
  "Timed Charge": [],
  "Rocket Launcher": ["gun-explosives-t3-rocket-launcher"],
  "Rocket HE": ["ammo-rocket-h-e"],
};

/** Perk id → thematic armor set slug */
const PERK_ARMOR_SET = {
  "lucky-looter": "scavenger",
  "salvage-operations": "scavenger",
  "treasure-hunter": "scavenger",
  "infiltrator": "rogue",
  "the-penetrator": "commando",
  "pack-mule": "hoarder",
  "living-off-the-land": "farmer",
  "healing-factor": "athletic",
  "miner-69er": "miner",
  "mother-lode": "miner",
  "pummel-pete": "lumberjack",
  "skull-crusher": "raider",
  "grand-slam": "raider",
  archery: "ranger",
  gunslinger: "commando",
  "deep-cuts": "assassin",
  "javelin-master": "nomad",
  boomstick: "biker",
  "dead-eye": "ranger",
  "machine-gunner": "commando",
  "run-and-gun": "athletic",
  "better-barter": "preacher",
  "master-chef": "farmer",
  "grease-monkey": "biker",
  electrocutioner: "nerd",
  "robotics-inventor": "nerd",
  "demolitions-expert": "raider",
};

/** Extra related items by id prefix / pattern per perk */
const PERK_ITEM_IDS = {
  "miner-69er": ["melee-tool-pick-t3-auger"],
  "mother-lode": ["melee-tool-pick-t3-auger", "drink-jar-pure-mineral-water"],
  archery: ["ammo-arrow-stone", "ammo-arrow-iron", "ammo-arrow-steel-a-p"],
  gunslinger: ["ammo9mm-bullet-a-p", "ammo44magnum-bullet-a-p"],
  boomstick: ["ammo-shotgun-shell"],
  "dead-eye": ["ammo762mm-bullet-a-p"],
  "machine-gunner": ["ammo762mm-bullet-a-p"],
  "robotics-inventor": ["gun-bot-robotics-parts", "ammo-junk-turret-regular"],
  "demolitions-expert": ["ammo-rocket-frag", "ammo-rocket-h-e"],
  electrocutioner: ["mod-melee-stun-repulsor"],
};

const ARMOR_SET_META = {
  assassin: "Stealth and blade combat.",
  athletic: "Mobility and stamina.",
  biker: "Shotgun and close-range mayhem.",
  commando: "Rifles and automatic weapons.",
  "crimson-warlord": "Heavy battle armor.",
  desert: "Heat-resistant scavenger gear.",
  enforcer: "Batons and crowd control.",
  farmer: "Farming and sustenance.",
  hoarder: "Inventory and loot hauling.",
  lumberjack: "Axes and wood processing.",
  marauder: "Aggressive melee raider.",
  miner: "Mining tools and ore yields.",
  nerd: "Robotics and electrical traps.",
  nomad: "Spears and thrown weapons.",
  preacher: "Trading and bartering.",
  primitive: "Early-game scrap armor.",
  raider: "Explosives and heavy melee.",
  ranger: "Bows and marksmanship.",
  rogue: "Sneak attacks and traps.",
  samurai: "Blades and precision strikes.",
  scavenger: "Salvage and looting.",
};

const PIECE_SUFFIXES = ["outfit", "helmet", "gloves", "boots"];

function buildArmorSets(items) {
  const armor = items.filter((i) => i.id.startsWith("armor-"));
  const slugs = [...new Set(
    armor.map((i) => {
      const m = i.id.match(/^armor-(.+)-(boots|gloves|helmet|outfit)$/);
      return m ? m[1] : null;
    }).filter(Boolean)
  )].sort();

  const itemIds = new Set(items.map((i) => i.id));
  const armorSets = {};

  for (const slug of slugs) {
    const pieces = PIECE_SUFFIXES
      .map((s) => `armor-${slug}-${s}`)
      .filter((id) => itemIds.has(id));
    if (!pieces.length) continue;

    const label = slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    const perks = Object.entries(PERK_ARMOR_SET)
      .filter(([, setSlug]) => setSlug === slug)
      .map(([perkId]) => perkId);

    armorSets[slug] = {
      label: `${label} Armor`,
      description: ARMOR_SET_META[slug] || `${label} outfit set (4 pieces).`,
      pieces,
      perks,
    };
  }
  return armorSets;
}

function buildPerkLinks(items, skills, armorSets) {
  const itemIds = new Set(items.map((i) => i.id));
  const byPerkName = new Map();
  for (const item of items) {
    if (!item.perk?.trim()) continue;
    const key = item.perk.trim();
    if (!byPerkName.has(key)) byPerkName.set(key, []);
    byPerkName.get(key).push(item.id);
  }

  const perks = {};

  for (const attr of skills.attributes) {
    for (const perk of attr.perks) {
      const unlocksByLevel = {};
      perk.levels.forEach((row, i) => {
        const level = String(i + 1);
        const ids = new Set();
        if (row.craftTier) {
          for (const part of row.craftTier.split(/\s*\/\s*|\s*,\s*|\s*&\s*/)) {
            const key = part.trim();
            const mapped = CRAFT_TIER_ITEMS[row.craftTier] || CRAFT_TIER_ITEMS[key];
            if (mapped) mapped.forEach((id) => { if (itemIds.has(id)) ids.add(id); });
          }
          const full = CRAFT_TIER_ITEMS[row.craftTier];
          if (full) full.forEach((id) => { if (itemIds.has(id)) ids.add(id); });
        }
        if (ids.size) unlocksByLevel[level] = [...ids];
      });

      const related = new Set(PERK_ITEM_IDS[perk.id] || []);
      const catalogName = perk.catalogPerk || perk.name.replace(/'/g, "");
      (byPerkName.get(catalogName) || []).forEach((id) => related.add(id));
      (byPerkName.get(perk.name) || []).forEach((id) => related.add(id));

      for (const ids of Object.values(unlocksByLevel)) {
        ids.forEach((id) => related.add(id));
      }

      const armorSet = PERK_ARMOR_SET[perk.id] || null;
      if (armorSet && armorSets[armorSet]) {
        armorSets[armorSet].perks = [...new Set([...(armorSets[armorSet].perks || []), perk.id])];
      }

      perks[perk.id] = {
        name: perk.name,
        catalogPerk: perk.catalogPerk || null,
        armorSet,
        unlocksByLevel,
        relatedItems: [...related].filter((id) => itemIds.has(id)).sort(),
      };
    }
  }

  return perks;
}

function main() {
  const { items } = JSON.parse(fs.readFileSync(ITEMS_PATH, "utf8"));
  const skills = JSON.parse(fs.readFileSync(SKILLS_PATH, "utf8"));
  const armorSets = buildArmorSets(items);
  const perks = buildPerkLinks(items, skills, armorSets);

  const missingTiers = new Set();
  for (const attr of skills.attributes) {
    for (const perk of attr.perks) {
      for (const row of perk.levels) {
        if (!row.craftTier) continue;
        if (!CRAFT_TIER_ITEMS[row.craftTier]) missingTiers.add(row.craftTier);
      }
    }
  }

  const out = {
    _generated: new Date().toISOString(),
    _note: "Armor outfit sets + perk craft links for build/planner gear display.",
    armorSets,
    perks,
    _gaps: {
      unmappedCraftTiers: [...missingTiers].sort(),
      catalogItemsWithoutIcons: (CRAFT_TIER_ITEMS["Farm Plot"] ? [] : ["farm plot", "pipe bomb", "timed charge", "stone pickaxe"]),
    },
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + "\n");
  console.log(`Wrote ${OUT_PATH}`);
  console.log(`  Armor sets: ${Object.keys(armorSets).length}`);
  console.log(`  Perk links: ${Object.keys(perks).length}`);
  if (missingTiers.size) {
    console.log(`  Unmapped craft tiers: ${missingTiers.size} (see _gaps in JSON)`);
  }
}

main();
