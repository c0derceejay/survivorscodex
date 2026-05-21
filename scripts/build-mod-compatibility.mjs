#!/usr/bin/env node
/**
 * Builds data/mod-compatibility.json — which mods fit which items (vanilla-style slots).
 * Run: npm run mods:build
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ITEMS_PATH = path.join(ROOT, "data/items.json");
const ITEM_STATS_PATH = path.join(ROOT, "data/item-stats.json");
const OUT_PATH = path.join(ROOT, "data/mod-compatibility.json");

/** mod `uses` tag → item types that accept the mod */
const USES_TO_TYPES = {
  "Pistols": ["pistol"],
  "Rifles": ["rifle"],
  "Shotguns": ["shotgun"],
  "MGs": ["mg"],
  "SMGs": ["pistol"],
  "ARs": ["rifle", "mg"],
  "Machine gunner": ["mg", "rifle"],
  "Bows": ["bow"],
  "Wooden bow": ["bow"],
  "Compound bow": ["bow"],
  "Hunting rifle": ["rifle"],
  "Sniper": ["rifle"],
  "Pump shotgun": ["shotgun"],
  "Magazine-fed guns": ["pistol", "rifle", "mg"],
  "Most firearms": ["pistol", "rifle", "shotgun", "mg"],
  "Selectable rifles": ["rifle", "mg"],
  "Tactical builds": ["rifle", "mg"],
  "Short-range precision": ["pistol"],
  "Mid-long range": ["rifle"],
  "CQB weapons": ["pistol", "shotgun"],
  "Stealth builds": ["pistol", "rifle", "shotgun", "mg"],
  "Hunter builds": ["rifle", "bow"],
  "Bow sidearm": ["pistol", "bow"],
  "All armor": ["armor_chest", "armor_head", "armor_hands", "armor_feet"],
  "Heavy armor": ["armor_chest", "armor_head", "armor_hands", "armor_feet"],
  "Tank builds": ["armor_chest", "armor_head", "armor_hands", "armor_feet"],
  "Mobility builds": ["armor_chest", "armor_head", "armor_hands", "armor_feet"],
  "Endgame armor": ["armor_chest", "armor_head", "armor_hands", "armor_feet"],
  "Stealth armor": ["armor_chest", "armor_head", "armor_hands", "armor_feet"],
  "Endgame haulers": ["armor_chest"],
  "Gunslinger builds": ["armor_chest", "armor_hands"],
  "Perception builds": ["armor_chest"],
  "Melee builds": ["armor_chest"],
  "Archery / stealth": ["armor_chest"],
  "Robotics / traps": ["armor_chest"],
  "Cave mining": ["armor_head"],
  "Night": ["armor_head"],
  "Night raids": ["armor_head"],
  "Stealth": ["armor_feet"],
  "Desert biome": ["armor_chest"],
  "Snow biome": ["armor_chest"],
  "Exploration": ["armor_chest"],
  "Demolisher nights": ["armor_chest"],
  "Knives": ["blade"],
  "Machete": ["blade"],
  "Swords": ["blade"],
  "Clubs": ["club"],
  "Sledges": ["sledge"],
  "Sledgehammers": ["sledge"],
  "Spears": ["spear"],
  "All melee": ["club", "sledge", "spear", "blade", "baton"],
  "Pickaxes": ["pickaxe"],
  "Axes": ["axe"],
  "Fire axes": ["axe"],
  "Shovels": ["shovel"],
  "Mining melee": ["pickaxe", "axe", "sledge"],
  "Endgame tools": ["pickaxe", "axe"],
  "POI breaching": ["sledge"],
  "Stun baton": ["baton"],
  "All fueled vehicles": ["vehicle"],
  "All motorized vehicles": ["vehicle"],
  "Early vehicles": ["vehicle"],
  "Minibike+": ["vehicle"],
  "4x4": ["vehicle"],
  "4x4 truck": ["vehicle"],
  "Motorcycle": ["vehicle"],
  "Gyrocopter": ["vehicle"],
  "Long trips": ["vehicle"],
  "Combat vehicles": ["vehicle"],
  "Robotic drone": ["drone"],
};

const SLOT_ALIASES = {
  stock: "barrel",
  accessory: "barrel",
};

const ITEM_SLOTS = {
  pistol: ["barrel", "optic", "receiver"],
  rifle: ["barrel", "optic", "receiver"],
  shotgun: ["barrel", "receiver"],
  mg: ["barrel", "optic", "receiver"],
  bow: ["bow"],
  blade: ["blade", "grip"],
  club: ["head", "grip", "shaft"],
  sledge: ["head", "grip", "shaft"],
  spear: ["head", "grip", "shaft"],
  baton: ["head", "grip"],
  pickaxe: ["head", "grip"],
  axe: ["head", "grip"],
  shovel: ["head", "grip"],
  armor_chest: ["armor"],
  armor_head: ["head", "armor"],
  armor_hands: ["armor"],
  armor_feet: ["feet", "armor"],
  vehicle: ["vehicle"],
  drone: ["drone"],
};

function inferItemProfile(item) {
  const id = item.id;
  if (id.startsWith("gun-handgun-") && !id.includes("-parts")) {
    return { type: "pistol", slots: ITEM_SLOTS.pistol };
  }
  if (id.startsWith("gun-rifle-") && !id.includes("-parts")) {
    return { type: "rifle", slots: ITEM_SLOTS.rifle };
  }
  if (id.startsWith("gun-shotgun-") && !id.includes("-parts")) {
    return { type: "shotgun", slots: ITEM_SLOTS.shotgun };
  }
  if (id.startsWith("gun-m-g-") && !id.includes("-parts")) {
    return { type: "mg", slots: ITEM_SLOTS.mg };
  }
  if (id.startsWith("gun-bow-") && !id.includes("-parts")) {
    return { type: "bow", slots: ITEM_SLOTS.bow };
  }
  if (id.startsWith("melee-wpn-blade-")) return { type: "blade", slots: ITEM_SLOTS.blade };
  if (id.startsWith("melee-wpn-club-")) return { type: "club", slots: ITEM_SLOTS.club };
  if (id.startsWith("melee-wpn-sledge-")) return { type: "sledge", slots: ITEM_SLOTS.sledge };
  if (id.startsWith("melee-wpn-spear-")) return { type: "spear", slots: ITEM_SLOTS.spear };
  if (id.startsWith("melee-wpn-baton-")) return { type: "baton", slots: ITEM_SLOTS.baton };
  if (id.startsWith("melee-tool-pick-")) return { type: "pickaxe", slots: ITEM_SLOTS.pickaxe };
  if (id.startsWith("melee-tool-axe-")) return { type: "axe", slots: ITEM_SLOTS.axe };
  if (id.startsWith("melee-tool-shovel-")) return { type: "shovel", slots: ITEM_SLOTS.shovel };
  if (id.startsWith("melee-tool-salvage-")) return { type: "pickaxe", slots: ITEM_SLOTS.pickaxe };
  if (id.match(/^armor-.+-outfit$/)) return { type: "armor_chest", slots: ITEM_SLOTS.armor_chest };
  if (id.match(/^armor-.+-helmet$/)) return { type: "armor_head", slots: ITEM_SLOTS.armor_head };
  if (id.match(/^armor-.+-gloves$/)) return { type: "armor_hands", slots: ITEM_SLOTS.armor_hands };
  if (id.match(/^armor-.+-boots$/)) return { type: "armor_feet", slots: ITEM_SLOTS.armor_feet };
  if (id.startsWith("vehicle-") || id.includes("-chassis") || id.includes("-handlebars")) {
    return { type: "vehicle", slots: ITEM_SLOTS.vehicle };
  }
  if (id.startsWith("gun-bot-") && id.includes("drone")) return { type: "drone", slots: ITEM_SLOTS.drone };
  return null;
}

function modFitsItemType(mod, itemType, itemSlots) {
  const slot = SLOT_ALIASES[mod.modSlot] || mod.modSlot;
  if (!itemSlots.includes(slot)) return false;

  const fitTypes = new Set();
  for (const use of mod.uses || []) {
    for (const t of USES_TO_TYPES[use] || []) fitTypes.add(t);
  }

  if (mod.category === "mods-armor" && itemType.startsWith("armor_")) {
    if (mod.modSlot === "head" && itemType !== "armor_head") return false;
    if (mod.modSlot === "feet" && itemType !== "armor_feet") return false;
    if (fitTypes.size > 0) return fitTypes.has(itemType);
    return true;
  }
  if (mod.category === "mods-vehicle" && itemType === "vehicle") return true;
  if (mod.category === "mods-drone" && itemType === "drone") return true;

  if (fitTypes.size === 0) {
    if (mod.category === "mods-weapon") {
      return ["pistol", "rifle", "shotgun", "mg", "bow"].includes(itemType);
    }
    if (mod.category === "mods-melee") {
      return ["blade", "club", "sledge", "spear", "baton", "pickaxe", "axe", "shovel"].includes(itemType);
    }
    return false;
  }

  return fitTypes.has(itemType);
}

function main() {
  const { items } = JSON.parse(fs.readFileSync(ITEMS_PATH, "utf8"));
  let itemStats = {};
  try {
    itemStats = JSON.parse(fs.readFileSync(ITEM_STATS_PATH, "utf8"));
  } catch (_) {}

  const mods = items.filter((i) => String(i.category || "").startsWith("mods-"));

  const itemsMap = {};
  for (const item of items) {
    const profile = inferItemProfile(item);
    if (profile) {
      const stats = itemStats[item.id];
      const modSlotsByQuality = stats?.qualityByTier?.modSlots || null;
      itemsMap[item.id] = {
        type: profile.type,
        slots: profile.slots,
        modSlotsByQuality,
        name: item.name,
        category: item.category,
      };
    }
  }

  const modsMap = {};
  for (const mod of mods) {
    const slot = SLOT_ALIASES[mod.modSlot] || mod.modSlot || "mod";
    const compatibleItems = [];
    for (const [itemId, profile] of Object.entries(itemsMap)) {
      if (modFitsItemType(mod, profile.type, profile.slots)) {
        compatibleItems.push(itemId);
      }
    }
    modsMap[mod.id] = {
      slot,
      name: mod.name,
      category: mod.category,
      modIcon: mod.modIcon,
      summary: mod.summary,
      compatibleItems,
    };
  }

  const out = {
    _generated: new Date().toISOString(),
    slotLabels: {
      barrel: "Barrel / underbarrel",
      optic: "Optic / scope",
      receiver: "Receiver / magazine",
      bow: "Bow string / rest",
      armor: "Armor mod",
      head: "Head mod",
      feet: "Foot mod",
      blade: "Blade mod",
      head_melee: "Head (melee)",
      grip: "Grip",
      shaft: "Shaft",
      vehicle: "Vehicle mod",
      drone: "Drone mod",
    },
    itemSlots: ITEM_SLOTS,
    items: itemsMap,
    mods: modsMap,
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + "\n");
  console.log(`Wrote ${OUT_PATH}`);
  console.log(`  Equippable items: ${Object.keys(itemsMap).length}`);
  console.log(`  Mods: ${Object.keys(modsMap).length}`);
  const withItems = Object.values(modsMap).filter((m) => m.compatibleItems.length).length;
  console.log(`  Mods with ≥1 compatible item: ${withItems}`);
}

main();
