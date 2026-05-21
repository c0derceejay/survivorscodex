#!/usr/bin/env node
/**
 * Generates data/item-stats.json — in-game-style tooltip lines per catalog item.
 * Run: node scripts/generate-item-stats.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/** @param {string} label @param {string} value @param {'good'|'bad'|'warn'|'neutral'} [tone] */
function fx(label, value, tone = "neutral") {
  return { label, value, tone };
}

/** @param {string[]} lines @returns {{ effects: object[], notes?: string[] }} */
function entry(effects, notes = []) {
  const out = { effects };
  if (notes.length) out.notes = notes;
  return out;
}

/** Vanilla: +10% entity/block damage per quality above Q1; linear durability Q1→Q6. */
function melee(entity, block, stamina, durMin, durMax, extra = [], notes = []) {
  return {
    qualityScale: true,
    scalable: {
      entityDamage: Number(entity),
      blockDamage: Number(block),
      staminaCost: Number(stamina),
      durabilityMin: durMin,
      durabilityMax: durMax,
    },
    staticEffects: extra,
    notes: [
      "Select quality below — damage & durability scale per vanilla (+10% damage per tier).",
      ...notes,
    ],
  };
}

function gun(entity, rpm, mag, range, durMin, durMax, extra = [], notes = []) {
  const magMatch = String(mag).match(/^(\d+)/);
  const scalable = {
    entityDamage: parseEntityBase(entity),
    durabilityMin: durMin,
    durabilityMax: durMax,
  };
  if (magMatch) scalable.magazineSize = Number(magMatch[1]);

  return {
    qualityScale: true,
    scalable,
    staticEffects: [
      fx("Fire rate", rpm),
      ...(magMatch ? [] : [fx("Magazine", mag)]),
      fx("Effective range", range),
      ...extra,
    ],
    notes: [
      "Select quality below — damage scales +10% per quality tier in vanilla.",
      ...notes,
    ],
  };
}

function parseEntityBase(val) {
  const s = String(val);
  const m = s.match(/^([\d.]+)/);
  return m ? Number(m[1]) : null;
}

function toolStats(block, entity, durMin, durMax, extra = [], notes = []) {
  const scalable = { durabilityMin: durMin, durabilityMax: durMax };
  if (block != null) scalable.blockDamage = Number(block);
  if (entity != null) scalable.entityDamage = Number(entity);
  return {
    qualityScale: true,
    scalable,
    staticEffects: extra,
    notes: ["Select quality below — tool stats scale with item quality.", ...notes],
  };
}

function armorStats(armorPct, durMin, durMax, extra = [], notes = []) {
  const pct = String(armorPct).replace(/[^\d.]/g, "");
  return {
    qualityScale: true,
    scalable: {
      armorRating: Number(pct),
      durabilityMin: durMin,
      durabilityMax: durMax,
    },
    staticEffects: extra,
    notes: ["Select quality below — armor rating scales with quality.", ...notes],
  };
}

function food(fullness, hydration, extra = [], notes = []) {
  const effects = [];
  if (fullness) effects.push(fx("Food", fullness, "good"));
  if (hydration) effects.push(fx("Water", hydration, "good"));
  effects.push(...extra);
  return entry(effects, notes);
}

const STATS = {
  // —— Melee ——
  "wooden-club": melee("9", "6", "12", 60, 110, [fx("Special", "Knockback on power attack")]),
  "stone-axe": melee("16", "22", "14", 80, 140, [fx("Role", "Tool + weapon (wood/stone harvest)")]),
  "stone-spear": melee("14", "8", "16", 80, 130, [fx("Special", "Throwable (consumes spear)")]),
  "stone-sledgehammer": melee("18", "28", "22", 90, 150, [fx("Special", "High knockdown; slow swings")]),
  "iron-club": melee("28", "12", "18", 200, 380, [fx("Special", "Stun chance with Pummel Pete")]),
  "pipe-baton": melee("22", "10", "16", 180, 340, [fx("Special", "Electrical stun with Electrocutioner")]),
  "stun-baton": melee("38", "14", "20", 280, 520, [fx("Special", "Strong electric stun")]),
  "steel-club": melee("52", "16", "22", 350, 650, [fx("Special", "Heavy knockdown")]),
  "steel-sledgehammer": melee("58", "42", "28", 400, 720, [fx("Special", "Wide arc; highest blunt DPS")]),
  "iron-spear": melee("32", "12", "18", 200, 360, [fx("Special", "Throwable; returns with perk")]),
  "steel-spear": melee("48", "16", "20", 340, 600, [fx("Special", "Throwable; returns at max Javelin Master")]),
  "bone-knife": melee("6", "4", "8", 50, 90, [fx("Special", "Bonus animal harvest")]),
  "hunting-knife": melee("18", "6", "10", 120, 220, [fx("Special", "Best early harvest knife")]),
  machete: melee("44", "10", "14", 300, 550, [fx("Special", "Deep cuts / dismember with perks")]),

  // —— Ranged ——
  "wooden-bow": gun("35", "~60 RPM", "1 arrow", "Medium", 80, 150, [fx("Type", "Silent; recovers ammo")]),
  "iron-crossbow": gun("95", "Slow reload", "1 bolt", "Long", 200, 380, [fx("Type", "Silent; high burst")]),
  "compound-bow": gun("68", "~90 RPM", "1 arrow", "Long", 250, 480, [fx("Type", "Silent; fast draw")]),
  "compound-crossbow": gun("120", "Slow reload", "1 bolt", "Very long", 320, 580, [fx("Type", "Silent; top-tier bolt")]),
  "pipe-pistol": gun("24", "~120 RPM", "6 rounds", "Short", 120, 220),
  "pipe-shotgun": gun("12", "Break action", "2 shells", "Very short", 140, 260, [fx("Pellets", "×8 per shot")]),
  "pipe-machine-gun": gun("22", "~600 RPM", "30 rounds", "Medium", 180, 320),
  "pipe-rifle": gun("42", "Bolt-action", "1 round", "Medium-long", 160, 300),
  "9mm-pistol": gun("41", "~180 RPM", "15 rounds", "Medium", 200, 380),
  "44-magnum": gun("72", "Revolver", "6 rounds", "Medium", 220, 400),
  "desert-vulture": gun("88", "Revolver", "6 rounds", "Medium-long", 260, 460),
  "hunting-rifle": gun("78", "Bolt-action", "1 round", "Long", 240, 440),
  "lever-action-rifle": gun("68", "Lever", "8 rounds", "Long", 260, 480),
  "marksman-rifle": gun("82", "Semi-auto", "20 rounds", "Very long", 300, 540),
  "sniper-rifle": gun("95", "Bolt-action", "1 round", "Extreme", 320, 580),
  "smg-5": gun("36", "~750 RPM", "30 rounds", "Short-medium", 220, 400),
  "ak-47": gun("48", "~550 RPM", "30 rounds", "Medium-long", 320, 580),
  "tactical-ar": gun("44", "~600 RPM", "30 rounds", "Medium-long", 300, 550),
  m60: gun("52", "~600 RPM", "60 belt", "Medium-long", 400, 700, [fx("Special", "Sustained suppression")]),
  "double-barrel": gun("14", "Break action", "2 shells", "Short", 200, 360, [fx("Pellets", "×10 per shot")]),
  "pump-shotgun": gun("16", "Pump", "6 shells", "Short", 260, 480, [fx("Pellets", "×10 per shot")]),
  "auto-shotgun": gun("18", "Auto", "12 shells", "Short", 300, 540, [fx("Pellets", "×10 per shot")]),
  "rocket-launcher": {
    qualityScale: true,
    scalable: { entityDamage: 220, durabilityMin: 80, durabilityMax: 140 },
    staticEffects: [
      fx("Blast radius", "~4 m", "warn"),
      fx("Ammo", "Rocket HE / Frag"),
    ],
    notes: ["Explosion damage scales with quality."],
  },
  "junk-turret": entry([
    fx("Damage", "9mm rounds (player-fed)", "good"),
    fx("Range", "Medium"),
    fx("Power", "Requires electrical trap wiring"),
  ], ["Robotics Inventor perk improves rate and HP."]),
  "robotic-sledge": entry([
    fx("Damage", "Heavy knockback ram", "good"),
    fx("Role", "Wall-mounted lane control"),
    fx("Power", "Requires electrical trap wiring"),
  ]),
  "robotic-drone": entry([
    fx("Heal", "Periodic heal pulse to player", "good"),
    fx("Carry", "Remote loot pickup (mod slots)", "good"),
    fx("Damage", "Light ranged support"),
  ]),

  // —— Ammo ——
  "stone-arrow": entry([fx("Damage", "Low (stone tip)"), fx("Special", "Recoverable from targets")]),
  "iron-arrow": entry([fx("Damage", "Medium"), fx("Special", "Recoverable")]),
  "steel-arrow": entry([fx("Damage", "High"), fx("Special", "Recoverable; best bow ammo")]),
  "stone-bolt": entry([fx("Damage", "Low"), fx("Used by", "Crossbows")]),
  "iron-bolt": entry([fx("Damage", "Medium"), fx("Used by", "Crossbows")]),
  "steel-bolt": entry([fx("Damage", "High"), fx("Used by", "Crossbows")]),
  "9mm-bullet": entry([fx("Type", "Ball — standard round"), fx("Compatible", "9mm Pistol, SMG-5, Pipe MG")]),
  "9mm-bullet-hp": entry([fx("Type", "HP — bonus flesh damage", "good"), fx("Trade-off", "Less armor penetration", "warn")]),
  "9mm-bullet-ap": entry([fx("Type", "AP — armor piercing", "good"), fx("Trade-off", "Lower flesh damage", "warn")]),
  "762-bullet": entry([fx("Type", "Ball — rifles & MGs"), fx("Compatible", "Hunting, Lever, AR, M60")]),
  "762-bullet-hp": entry([fx("Type", "HP — bonus flesh damage", "good")]),
  "762-bullet-ap": entry([fx("Type", "AP — armor piercing", "good")]),
  "44-bullet": entry([fx("Type", "Magnum round"), fx("Compatible", ".44 Magnum, Desert Vulture")]),
  "shotgun-shell": entry([fx("Type", "Buckshot spread"), fx("Best at", "Close range")]),
  "shotgun-slug": entry([fx("Type", "Single slug"), fx("Best at", "Medium range precision")]),
  "rocket-he": entry([fx("Damage", "High explosive (blocks + entities)", "good"), fx("Use", "Structure demolition")]),
  "rocket-frag": entry([fx("Damage", "Fragmentation (anti-personnel)", "good"), fx("Use", "Horde clear")]),

  // —— Tools ——
  "iron-pickaxe": toolStats(28, 18, 200, 400, [fx("Role", "Mining stone & ore")]),
  "steel-pickaxe": toolStats(42, 26, 350, 650, [fx("Role", "Top-tier pick")]),
  "iron-fireaxe": toolStats(32, 22, 200, 380, [fx("Role", "Lumberjacking")]),
  "steel-fireaxe": toolStats(48, 32, 340, 620, [fx("Role", "Fast wood harvest")]),
  "iron-shovel": toolStats(18, null, 180, 340, [fx("Role", "Sand, snow, clay")]),
  "steel-shovel": toolStats(28, null, 320, 580, [fx("Role", "Soft terrain digging")]),
  auger: toolStats(90, 12, 400, 750, [fx("Fuel", "Gas Can"), fx("Noise", "Attracts zombies", "warn")]),
  chainsaw: toolStats(85, 15, 380, 700, [fx("Fuel", "Gas Can"), fx("Noise", "Very loud", "warn")]),
  wrench: toolStats(null, null, 150, 280, [fx("Role", "Salvage cars & appliances")]),
  ratchet: toolStats(null, null, 200, 380, [fx("Role", "Faster salvage"), fx("Yield", "Improved scrap returns", "good")]),
  "impact-driver": toolStats(null, null, 280, 520, [fx("Role", "Fastest salvage tool", "good")]),
  "claw-hammer": toolStats(8, 6, 120, 220, [fx("Role", "Place & repair blocks")]),
  nailgun: toolStats(12, 8, 200, 380, [fx("Role", "Fast block upgrade/repair"), fx("Ammo", "Nails")]),
  forge: entry([fx("Role", "Smelt ore, scrap, stone"), fx("Fuel", "Wood, coal, biomass")]),
  workbench: entry([fx("Role", "Craft guns, tools, vehicles"), fx("Unlocks", "Tier 2–3 recipes")]),
  "chemistry-station": entry([fx("Role", "Medical, ammo, chemicals"), fx("Speed", "Faster than campfire")]),
  "cement-mixer": entry([fx("Role", "Concrete Mix production"), fx("Unlocks", "Concrete block upgrades")]),

  // —— Food & drink ——
  "murky-water": food("0", "+10", [fx("Dysentery risk", "~50% without treatment", "bad")]),
  "boiled-water": food("0", "+15", [fx("Dysentery risk", "None", "good")]),
  "yucca-juice": food("0", "+35", [fx("Stamina", "Small regen buff", "good")]),
  "goldenrod-tea": food("0", "+24", [fx("Wellness", "+1", "good")]),
  coffee: food("0", "+10", [fx("Stamina regen", "Strong buff (~180s)", "good")]),
  beer: food("0", "+10", [fx("Damage", "+10% melee/ranged", "good"), fx("Accuracy", "Debuff while active", "bad")]),
  "can-pasta": food("+15", "0"),
  "can-chili": food("+18", "0", [fx("Stamina", "Small boost", "good")]),
  "can-sham": food("+12", "0"),
  "bacon-eggs": food("+55", "0", [fx("Stamina", "+40 max temporarily", "good")]),
  "hobo-stew": food("+48", "+8"),
  "meat-stew": food("+58", "+10", [fx("Stamina", "Large restore", "good")]),
  spaghetti: food("+62", "+12", [fx("Wellness", "+2", "good")]),
  "sham-sandwich": food("+45", "0"),
  "blueberry-pie": food("+68", "0", [fx("Wellness", "+3", "good")]),
  "pumpkin-pie": food("+72", "0", [fx("Stamina", "Top-tier food buff", "good")]),
  "raw-meat": food("+8", "0", [fx("Food poisoning risk", "If eaten raw", "bad")]),
  "charred-meat": food("+10", "0", [fx("Safety", "Safe cooked snack", "good")]),
  corn: food("+2", "0", [fx("Use", "Cooking ingredient")]),
  potato: food("+2", "0", [fx("Use", "Stew ingredient")]),
  blueberries: food("+4", "+1", [fx("Use", "Snack / pie ingredient")]),

  // —— Medical ——
  "medical-bandage": entry([
    fx("Max health", "+15 (restores cap)", "good"),
    fx("Stops bleeding", "Yes", "good"),
    fx("Health restored", "No direct HP", "neutral"),
  ], ["Does not regenerate health — use First Aid Bandage for HoT."]),
  "medical-first-aid-bandage": entry([
    fx("Health restored", "+30 over 30s (HoT)", "good"),
    fx("Stops bleeding", "Yes", "good"),
    fx("Treats", "Abrasions → Treated Abrasion", "good"),
  ], ["Heals 1 HP/sec at Physician 0; faster with Physician perk."]),
  "medical-first-aid-kit": entry([
    fx("Health restored", "+50 HP instant", "good"),
    fx("Stops bleeding", "Yes", "good"),
    fx("Treats", "Abrasions", "good"),
  ], ["Best burst heal; consumed on use."]),
  "medical-splint": entry([
    fx("Effect", "Mends broken leg over time", "good"),
    fx("Duration", "Until leg fully healed"),
  ], ["Required after leg break from falls or zombies."]),
  "medical-plaster-cast": entry([
    fx("Effect", "Mends broken arm over time", "good"),
    fx("Duration", "Until arm fully healed"),
  ], ["Required after arm break from falls or zombies."]),
  "medical-aloe-cream": entry([
    fx("Effect", "Treats abrasions over time", "good"),
    fx("Use", "Alternative to First Aid Bandage"),
  ]),
  "medical-blood-bag": entry([
    fx("Effect", "Treats lacerations over time", "good"),
    fx("Use", "Advanced wound treatment"),
  ]),
  "drug-painkillers": entry([
    fx("Effect", "Reduces pain / injury penalties", "good"),
    fx("Duration", "Several minutes"),
  ]),
  "drug-antibiotics": entry([
    fx("Cures", "Infection", "good"),
    fx("Use", "Critical after bites / dirty wounds"),
  ]),
  "drug-herbal-antibiotics": entry([
    fx("Cures", "Infection", "good"),
    fx("Use", "Craftable alternative to antibiotics"),
  ]),
  "drug-vitamins": entry([
    fx("Wellness", "+2", "good"),
    fx("Buff", "Improved food & water gain", "good"),
  ]),
  "drug-recog": entry([
    fx("Effect", "Radiation resistance / cure", "good"),
    fx("Duration", "Long buff"),
  ], ["Essential for extended radiated zone trips."]),
  "drug-steroids": entry([
    fx("Melee damage", "+25%", "good"),
    fx("Stamina regen", "Massive boost", "good"),
    fx("Duration", "~3 minutes"),
  ]),
  "drug-health-bar": entry([
    fx("Max health", "+10", "good"),
    fx("Duration", "~3 minutes"),
  ]),
  "drug-oh-shitz-drops": entry([
    fx("Effect", "Prevents 50% fall damage once", "good"),
    fx("Use", "Single-use safety net"),
  ]),
  "drug-atom-junkies": entry([
    fx("Type", "Skill magazine"),
    fx("Grants", "Agility attribute XP", "good"),
  ], ["Reading grants Agility skill points without spending perk points."]),
  "drug-covert-cats": entry([
    fx("Type", "Skill magazine"),
    fx("Grants", "Stealth / Infiltrator perk XP", "good"),
  ]),
  "drug-eye-kandy": entry([
    fx("Type", "Skill magazine"),
    fx("Grants", "Perception / Lucky Looter perk XP", "good"),
  ]),
  "drug-fort-bites": entry([
    fx("Type", "Skill magazine"),
    fx("Grants", "Fortitude attribute XP", "good"),
  ]),
  "drug-hackers": entry([
    fx("Type", "Skill magazine"),
    fx("Grants", "Intellect attribute XP", "good"),
  ]),
  "drug-jail-breakers": entry([
    fx("Type", "Skill magazine"),
    fx("Grants", "Strength attribute XP", "good"),
  ]),
  "drug-nerd-tats": entry([
    fx("Type", "Skill magazine"),
    fx("Grants", "Intellect / Better Barter perk XP", "good"),
  ]),
  "drug-rock-busters": entry([
    fx("Type", "Skill magazine"),
    fx("Grants", "Mining / Miner 69er perk XP", "good"),
  ]),
  "drug-skull-crushers": entry([
    fx("Type", "Skill magazine"),
    fx("Grants", "Strength / Skull Crusher perk XP", "good"),
  ]),
  "drug-sugar-butts": entry([
    fx("Type", "Skill magazine"),
    fx("Grants", "Fortitude / Healing Factor perk XP", "good"),
  ]),

  // —— Resources ——
  wood: entry([fx("Type", "Crafting material"), fx("Use", "Frames, fuel, recipes")]),
  "plant-fibers": entry([fx("Type", "Crafting material"), fx("Use", "Cloth, primitive gear")]),
  stone: entry([fx("Type", "Crafting material"), fx("Use", "Cobblestone, forge")]),
  "small-stone": entry([fx("Type", "Crafting material"), fx("Use", "Primitive tools & ammo")]),
  iron: entry([fx("Type", "Ore"), fx("Smelts to", "Forged Iron")]),
  lead: entry([fx("Type", "Ore"), fx("Use", "Bullet tips")]),
  brass: entry([fx("Type", "Scrap"), fx("Smelts to", "Brass casings")]),
  coal: entry([fx("Type", "Ore"), fx("Use", "Fuel & gunpowder")]),
  "nitrate-powder": entry([fx("Type", "Ore"), fx("Use", "Gunpowder (with coal)")]),
  gunpowder: entry([fx("Type", "Crafted"), fx("Use", "All firearms ammo")]),
  "forged-iron": entry([fx("Type", "Refined ingot"), fx("Use", "Tier 2 crafting")]),
  "forged-steel": entry([fx("Type", "Refined ingot"), fx("Use", "Tier 3 crafting")]),
  leather: entry([fx("Type", "Crafting material"), fx("Use", "Armor, grips")]),
  cloth: entry([fx("Type", "Crafting material"), fx("Use", "Bandages, clothing")]),
  "duct-tape": entry([fx("Type", "Binding"), fx("Use", "Weapons, tools, repairs")]),
  glue: entry([fx("Type", "Crafting material"), fx("Use", "Duct tape, recipes")]),
  "mechanical-parts": entry([fx("Type", "Salvaged"), fx("Use", "Guns, vehicles, traps")]),
  "electrical-parts": entry([fx("Type", "Salvaged"), fx("Use", "Traps, turrets, electronics")]),
  spring: entry([fx("Type", "Salvaged"), fx("Use", "Firearms & vehicles")]),
  "oil-shale": entry([fx("Type", "Ore (desert)"), fx("Refines to", "Gas Can")]),
  gasoline: entry([fx("Type", "Fuel"), fx("Use", "Vehicles, auger, chainsaw")]),
  acid: entry([fx("Type", "Rare resource"), fx("Use", "AP ammo, advanced recipes")]),

  // —— Blocks ——
  "frame-shape": entry([fx("Block HP", "225", "good"), fx("Role", "Upgrade skeleton")]),
  "wood-block": entry([fx("Block HP", "750", "good"), fx("Role", "Early base walls")]),
  "cobblestone-block": entry([fx("Block HP", "3,000", "good"), fx("Role", "Mid-tier base")]),
  "concrete-block": entry([fx("Block HP", "7,500", "good"), fx("Role", "Horde-night standard")]),
  "steel-block": entry([fx("Block HP", "20,000", "good"), fx("Role", "Endgame defense")]),
  "secure-door": entry([fx("Block HP", "~750 (wood tier)", "good"), fx("Special", "Lockable")]),
  "iron-bars": entry([fx("Block HP", "~500", "good"), fx("Special", "See-through window")]),
  "secure-storage-chest": entry([fx("Storage", "56 slots", "good"), fx("Special", "Lockable")]),

  // —— Traps ——
  "wood-spike": entry([fx("Damage", "Low contact damage"), fx("Special", "Slows zombies")]),
  "iron-spike": entry([fx("Damage", "Medium contact damage", "good"), fx("Special", "Bleed chance")]),
  "barbed-wire": entry([fx("Damage", "Low over time"), fx("Special", "Slows movement", "good")]),
  "blade-trap": entry([fx("Damage", "High (powered)", "good"), fx("Power", "Electrical wiring required")]),
  "dart-trap": entry([fx("Damage", "Medium poison darts", "good"), fx("Role", "Hallway choke")]),
  "smg-turret": entry([fx("Damage", "9mm (auto)", "good"), fx("Ammo", "Player must supply 9mm")]),
  "shotgun-turret": entry([fx("Damage", "Shotgun spread", "good"), fx("Best at", "Close choke points")]),
  "electric-fence": entry([fx("Damage", "Electric shock", "good"), fx("Special", "Stuns / slows")]),

  // —— Vehicles ——
  bicycle: entry([fx("Speed", "Slow", "neutral"), fx("Fuel", "None (stamina)", "good"), fx("Seats", "1")]),
  minibike: entry([fx("Speed", "Medium"), fx("Fuel", "Gas Can"), fx("Storage", "Small")]),
  motorcycle: entry([fx("Speed", "Fast", "good"), fx("Fuel", "Gas Can"), fx("Storage", "Medium")]),
  "4x4-truck": entry([fx("Speed", "Fast", "good"), fx("Fuel", "Gas Can"), fx("Seats", "4"), fx("Storage", "Large", "good")]),
  gyrocopter: entry([fx("Speed", "Air — fastest travel", "good"), fx("Fuel", "Gas Can"), fx("Special", "VTOL flight")]),

  // —— Armor ——
  "leather-armor": armorStats("15", 120, 240, [fx("Mobility", "Light / quiet")]),
  "iron-armor": armorStats("30", 280, 520, [fx("Mobility", "Heavy")]),
  "steel-armor": armorStats("45", 400, 750, [fx("Mobility", "Very heavy")]),
  "military-armor": armorStats("38", 350, 650, [fx("Mobility", "Medium-heavy")]),
  "padded-armor": armorStats("8", 80, 150, [fx("Mobility", "No penalty")]),
  "scrap-armor": armorStats("20", 200, 380, [fx("Mobility", "Moderate")]),
  "lumberjack-shirt": entry([fx("Cold resist", "Minor", "good"), fx("Role", "Cosmetic / light warmth")]),
  "cowboy-hat": entry([fx("Effect", "Cosmetic"), fx("Armor", "Minimal")]),
  "football-helmet": armorStats("6", 60, 110, [fx("Slot", "Head only")]),
  "hazmat-suit": entry([fx("Radiation resist", "High", "good"), fx("Use", "Radiated POIs & zones")]),

};

function modEntryFromItem(item) {
  const slot = item.modSlot ? item.modSlot.charAt(0).toUpperCase() + item.modSlot.slice(1) : "—";
  return entry(
    [
      fx("Install slot", slot, "good"),
      fx("Mod power", "+10% weapon damage per mod", "good"),
      fx("Stacks", "Up to mod slot limit on host item", "neutral"),
    ],
    [
      item.summary,
      "Each installed mod adds 10% of base damage (vanilla mod power rule).",
    ].filter(Boolean)
  );
}

const VARIANT_LABELS = [
  ["normal", "Normal"],
  ["feral", "Feral"],
  ["radiated", "Radiated"],
  ["charged", "Charged"],
  ["infernal", "Infernal"],
];

function threatTone(threat) {
  const t = String(threat || "").toLowerCase();
  if (t === "boss" || t === "critical") return "bad";
  if (t === "high") return "warn";
  if (t === "harmless") return "good";
  return "neutral";
}

function entityStats(item) {
  const effects = [];
  if (item.threat) effects.push(fx("Threat level", item.threat, threatTone(item.threat)));
  if (item.entityId) effects.push(fx("Entity ID", item.entityId, "neutral"));

  const h = item.health || {};
  for (const [key, label] of VARIANT_LABELS) {
    if (h[key] != null) effects.push(fx(`${label} HP`, String(h[key]), key === "feral" ? "warn" : "neutral"));
  }

  if (item.biomes?.length) {
    effects.push(fx("Biomes / spawns", item.biomes.join(", "), "neutral"));
  }

  const notes = [item.summary].filter(Boolean);
  if (h.feral != null || h.radiated != null) {
    notes.push("Feral+ variants appear at higher game stage and in harder biomes.");
  }

  return entry(effects, notes);
}

function categoryFallback(category) {
  const map = {
    "weapons-melee": entry([fx("Type", "Melee weapon"), fx("Note", "See quality & perks for exact numbers")]),
    "weapons-ranged": entry([fx("Type", "Ranged weapon"), fx("Note", "See quality & perks for exact numbers")]),
    ammo: entry([fx("Type", "Ammunition"), fx("Note", "Pairs with matching firearms")]),
    tools: entry([fx("Type", "Tool"), fx("Note", "Used for harvest, build, or craft")]),
    food: entry([fx("Type", "Food or drink"), fx("Use", "Consume to restore stats")]),
    medical: entry([fx("Type", "Medical supply"), fx("Use", "Right-click to apply")]),
    resources: entry([fx("Type", "Resource"), fx("Use", "Crafting ingredient")]),
    blocks: entry([fx("Type", "Building block"), fx("Note", "Upgrade for higher HP")]),
    traps: entry([fx("Type", "Trap"), fx("Note", "Many require electrical power")]),
    vehicles: entry([fx("Type", "Vehicle"), fx("Fuel", "Gas Can (except bicycle)")]),
    clothing: entry([fx("Type", "Armor / apparel"), fx("Note", "Protection scales with quality")]),
    robotics: entry([fx("Type", "Deployable robot"), fx("Power", "Electrical + Robotics Inventor")]),
    "vehicle-parts": entry([fx("Type", "Vehicle component"), fx("Use", "Assemble at workbench")]),
    "mods-weapon": entry([fx("Type", "Weapon mod"), fx("Install", "Gun / bow slots")]),
    "mods-armor": entry([fx("Type", "Armor mod"), fx("Install", "Armor/clothing slots")]),
    "mods-melee": entry([fx("Type", "Melee mod"), fx("Install", "Melee & tool slots")]),
    "mods-vehicle": entry([fx("Type", "Vehicle mod"), fx("Install", "Vehicle mod slots")]),
    "mods-drone": entry([fx("Type", "Drone mod"), fx("Install", "Robotic drone only")]),
    enemies: entry([fx("Type", "Zombie / infected"), fx("Note", "HP varies by variant")]),
  };
  return map[category] || entry([fx("Type", "Catalog item")]);
}

function main() {
  const items = JSON.parse(fs.readFileSync(path.join(ROOT, "data/items.json"), "utf8")).items;
  const wikiCachePath = path.join(ROOT, "data/wiki-item-stats-cache.json");
  const wikiCache = fs.existsSync(wikiCachePath)
    ? JSON.parse(fs.readFileSync(wikiCachePath, "utf8")).items || {}
    : {};

  const out = {
    _comment: "In-game tooltip stats. Regenerate: npm run stats:generate",
    _disclaimer: "Vanilla stats from wiki.gg at selected quality. Perks, mods, and difficulty further modify results.",
    _qualityLevels: [
      { q: 1, name: "Junk", color: "#9aa0a6", modSlots: 1, level: "1–10" },
      { q: 2, name: "Common", color: "#e67e22", modSlots: 1, level: "11–20" },
      { q: 3, name: "Uncommon", color: "#f1c40f", modSlots: 2, level: "21–30" },
      { q: 4, name: "Rare", color: "#2ecc71", modSlots: 2, level: "31–40" },
      { q: 5, name: "Epic", color: "#3498db", modSlots: 2, level: "41–50" },
      { q: 6, name: "Legendary", color: "#9b59b6", modSlots: 3, level: "51–60" },
    ],
  };

  const missing = [];
  let wikiCount = 0;
  for (const item of items) {
    if (wikiCache[item.id]) {
      const entry = structuredClone(wikiCache[item.id]);
      if (item.category !== "weapons-ranged" && entry.qualityByTier?.magazineSize) {
        delete entry.qualityByTier.magazineSize;
      }
      out[item.id] = entry;
      wikiCount++;
      continue;
    }
    if (item.entityId && item.health) {
      out[item.id] = entityStats(item);
    } else if (STATS[item.id]) {
      out[item.id] = STATS[item.id];
    } else if (item.modSlot || String(item.category || "").startsWith("mods-")) {
      out[item.id] = modEntryFromItem(item);
    } else {
      missing.push(item.id);
      out[item.id] = categoryFallback(item.category);
    }
  }

  fs.writeFileSync(path.join(ROOT, "data/item-stats.json"), JSON.stringify(out, null, 2) + "\n");
  console.log(`Wrote ${items.length} item stat entries to data/item-stats.json (${wikiCount} from wiki.gg).`);
  if (missing.length) console.log(`Category fallbacks used for: ${missing.length} items`);
}

main();
