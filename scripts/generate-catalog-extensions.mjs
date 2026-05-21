#!/usr/bin/env node
/**
 * Expands data/items.json with full vanilla mod list, vehicle parts, and robotics category.
 * Run: node scripts/generate-catalog-extensions.mjs && npm run stats:generate && npm run icons:refresh
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ITEMS_PATH = path.join(ROOT, "data/items.json");

/** @param {string} icon @param {object} opts */
function mod(icon, opts) {
  return {
    id: opts.id,
    name: opts.name,
    category: opts.category,
    tier: opts.tier ?? 2,
    stack: 50,
    weight: 0,
    modIcon: icon,
    summary: opts.summary,
    modSlot: opts.slot,
    ingredients: opts.ingredients ?? ["Forged Iron", "Mechanical Parts"],
    perk: opts.perk ?? "Advanced Engineering",
    uses: opts.uses ?? [],
  };
}

const MODS = [
  // —— Weapon mods ——
  mod("modGunBipod", { id: "mod-gun-bipod", name: "Bipod Mod", category: "mods-weapon", slot: "barrel", summary: "Less recoil when crouched. +10% mod power damage.", uses: ["Rifles", "MGs"] }),
  mod("modGunForegrip", { id: "mod-gun-foregrip", name: "Foregrip Mod", category: "mods-weapon", slot: "barrel", summary: "Improved handling and spread recovery.", uses: ["Most firearms"] }),
  mod("modGunRetractingStock", { id: "mod-gun-retracting-stock", name: "Retracting Stock Mod", category: "mods-weapon", slot: "stock", summary: "Better aim stability while moving.", uses: ["Rifles", "SMGs"] }),
  mod("modGunDuckbill", { id: "mod-gun-duckbill", name: "Duckbill Mod", category: "mods-weapon", slot: "barrel", summary: "Tighter shotgun spread pattern.", uses: ["Shotguns"] }),
  mod("modGunChoke", { id: "mod-gun-choke", name: "Choke Mod", category: "mods-weapon", slot: "barrel", summary: "Concentrates shotgun pellets for range.", uses: ["Shotguns"] }),
  mod("modGunBarrelExtender", { id: "mod-gun-barrel-extender", name: "Barrel Extender Mod", category: "mods-weapon", slot: "barrel", summary: "Extends effective range.", uses: ["Pistols", "Rifles"] }),
  mod("modGunMuzzleBrake", { id: "mod-gun-muzzle-brake", name: "Muzzle Brake Mod", category: "mods-weapon", slot: "barrel", summary: "Reduces recoil; louder shots.", uses: ["Rifles", "MGs"] }),
  mod("modGunSoundSuppressorSilencer", { id: "mod-gun-silencer", name: "Silencer Mod", category: "mods-weapon", slot: "barrel", summary: "Suppresses gunshot noise for stealth.", uses: ["Stealth builds"], perk: "From the Shadows" }),
  mod("modGunFlashlight", { id: "mod-gun-flashlight", name: "Weapon Flashlight Mod", category: "mods-weapon", slot: "accessory", summary: "Attachable light for dark POIs.", uses: ["Night raids"] }),
  mod("modGunLaserSight", { id: "mod-gun-laser-sight", name: "Laser Sight Mod", category: "mods-weapon", slot: "accessory", summary: "Hip-fire accuracy boost.", uses: ["CQB weapons"] }),
  mod("modGunReflexSight", { id: "mod-gun-reflex-sight", name: "Reflex Sight Mod", category: "mods-weapon", slot: "optic", summary: "Fast target acquisition optic.", uses: ["Pistols", "SMGs", "ARs"] }),
  mod("modGunScopeSmall", { id: "mod-gun-scope-small", name: "Small Scope Mod", category: "mods-weapon", slot: "optic", summary: "Low-zoom scope for pistols and SMGs.", uses: ["Short-range precision"] }),
  mod("modGunScopeMedium", { id: "mod-gun-scope-medium", name: "Medium Scope Mod", category: "mods-weapon", slot: "optic", summary: "Medium-zoom scope for rifles.", uses: ["Mid-long range"] }),
  mod("modGunScopeLarge", { id: "mod-gun-scope-large", name: "Large Scope Mod", category: "mods-weapon", slot: "optic", summary: "High-zoom scope for sniping.", uses: ["Hunting rifle", "Sniper"] }),
  mod("modGunMagazineExtender", { id: "mod-gun-mag-extender", name: "Magazine Extender Mod", category: "mods-weapon", slot: "receiver", summary: "+50% magazine capacity.", uses: ["Magazine-fed guns"] }),
  mod("modGunDrumMagazineExtender", { id: "mod-gun-drum-mag", name: "Drum Magazine Mod", category: "mods-weapon", slot: "receiver", summary: "Large drum mag; heavy reload.", uses: ["MGs", "SMGs"] }),
  mod("modGunShotgunTubeExtenderMagazine", { id: "mod-gun-shotgun-tube", name: "Shotgun Tube Extender Mod", category: "mods-weapon", slot: "receiver", summary: "Extra shells in tube mag.", uses: ["Pump shotgun"] }),
  mod("modGunTriggerGroupSemi", { id: "mod-gun-trigger-semi", name: "Semi-Auto Trigger Group", category: "mods-weapon", slot: "receiver", summary: "Semi-automatic fire mode.", uses: ["Selectable rifles"] }),
  mod("modGunTriggerGroupBurst", { id: "mod-gun-trigger-burst", name: "Burst Trigger Group", category: "mods-weapon", slot: "receiver", summary: "3-round burst fire mode.", uses: ["Tactical builds"] }),
  mod("modGunTriggerGroupAutomatic", { id: "mod-gun-trigger-auto", name: "Auto Trigger Group", category: "mods-weapon", slot: "receiver", summary: "Full-auto fire mode where supported.", uses: ["Machine gunner"] }),
  mod("modGunCrippleEm", { id: "mod-gun-cripple-em", name: "Cripple 'Em Mod", category: "mods-weapon", slot: "barrel", summary: "Chance to cripple legs on hit.", uses: ["Hunter builds"] }),
  mod("modGunMeleeTheHunter", { id: "mod-gun-hunter-mod", name: "The Hunter Mod", category: "mods-weapon", slot: "barrel", summary: "Bonus damage to animals.", uses: ["Hunting rifle", "Bow sidearm"] }),
  mod("modGunMeleeRadRemover", { id: "mod-gun-rad-remover", name: "Rad Remover Mod", category: "mods-weapon", slot: "barrel", summary: "Bonus damage vs radiated zombies.", uses: ["Wasteland POIs"] }),
  mod("modGunBowPolymerString", { id: "mod-bow-polymer-string", name: "Polymer String Mod", category: "mods-weapon", slot: "bow", summary: "Faster draw on bows.", uses: ["Wooden bow", "Compound bow"] }),
  mod("modGunBowArrowRest", { id: "mod-bow-arrow-rest", name: "Arrow Rest Mod", category: "mods-weapon", slot: "bow", summary: "Improved bow accuracy.", uses: ["Bows"] }),
  mod("modShotgunSawedOffBarrel", { id: "mod-shotgun-sawed-off", name: "Sawed-Off Barrel Mod", category: "mods-weapon", slot: "barrel", summary: "Shorter barrel; wider spread, faster handling.", uses: ["Shotguns"] }),

  // —— Armor mods ——
  mod("modArmorStoragePocket", { id: "mod-armor-storage-pocket", name: "Storage Pocket Mod", category: "mods-armor", tier: 1, slot: "armor", summary: "+1 carry slot on armor piece.", uses: ["All armor"], perk: "Pack Mule" }),
  mod("modArmorDoubleStoragePocket", { id: "mod-armor-double-pocket", name: "Double Storage Pocket Mod", category: "mods-armor", tier: 2, slot: "armor", summary: "+2 carry slots.", uses: ["All armor"], perk: "Pack Mule" }),
  mod("modArmorTripleStoragePocket", { id: "mod-armor-triple-pocket", name: "Triple Storage Pocket Mod", category: "mods-armor", tier: 3, slot: "armor", summary: "+3 carry slots.", uses: ["All armor"], perk: "Pack Mule" }),
  mod("modArmorQuadStoragePocket", { id: "mod-armor-quad-pocket", name: "Quad Storage Pocket Mod", category: "mods-armor", tier: 3, slot: "armor", summary: "+4 carry slots (max pocket tier).", uses: ["Endgame haulers"], perk: "Pack Mule" }),
  mod("modArmorPlatingBasic", { id: "mod-armor-plating-basic", name: "Armor Plating Mod", category: "mods-armor", tier: 1, slot: "armor", summary: "Basic damage resistance on piece.", uses: ["Tank builds"] }),
  mod("modArmorPlatingReinforced", { id: "mod-armor-plating-reinforced", name: "Reinforced Plating Mod", category: "mods-armor", tier: 2, slot: "armor", summary: "Stronger armor rating on piece.", uses: ["Heavy armor"] }),
  mod("modArmorImprovedFittings", { id: "mod-armor-improved-fittings", name: "Improved Fittings Mod", category: "mods-armor", tier: 2, slot: "armor", summary: "Better armor fit; mobility bonus.", uses: ["Mobility builds"] }),
  mod("modArmorCustomizedFittings", { id: "mod-armor-custom-fittings", name: "Customized Fittings Mod", category: "mods-armor", tier: 3, slot: "armor", summary: "Top-tier fit and stamina savings.", uses: ["Endgame armor"] }),
  mod("modArmorInsulatedLiner", { id: "mod-armor-insulated-liner", name: "Insulated Liner Mod", category: "mods-armor", tier: 1, slot: "armor", summary: "Cold resistance.", uses: ["Snow biome"], perk: "Lucky Looter" }),
  mod("modArmorCoolingMesh", { id: "mod-armor-cooling-mesh", name: "Cooling Mesh Mod", category: "mods-armor", tier: 1, slot: "armor", summary: "Heat resistance.", uses: ["Desert biome"], perk: "Lucky Looter" }),
  mod("modArmorMuffledConnectors", { id: "mod-armor-muffled-connectors", name: "Muffled Connectors Mod", category: "mods-armor", tier: 2, slot: "armor", summary: "Reduces armor noise for stealth.", uses: ["Stealth armor"], perk: "From the Shadows" }),
  mod("modArmorAdvancedMuffledConnectors", { id: "mod-armor-advanced-muffled", name: "Advanced Muffled Connectors", category: "mods-armor", tier: 3, slot: "armor", summary: "Maximum armor stealth.", uses: ["Silent POI runs"], perk: "From the Shadows" }),
  mod("modArmorHelmetLight", { id: "mod-armor-helmet-light", name: "Helmet Light Mod", category: "mods-armor", tier: 1, slot: "head", summary: "Headlamp on helmet.", uses: ["Cave mining", "Night"] }),
  mod("modArmorNightVision", { id: "mod-armor-night-vision", name: "Night Vision Goggles Mod", category: "mods-armor", tier: 3, slot: "head", summary: "NVG on helmet; power required.", uses: ["Night raids"] }),
  mod("modArmorBandolier", { id: "mod-armor-bandolier", name: "Bandolier Mod", category: "mods-armor", tier: 2, slot: "armor", summary: "Faster reload on firearms.", uses: ["Gunslinger builds"] }),
  mod("modArmorStealthBoots", { id: "mod-armor-stealth-boots", name: "Stealth Boots Mod", category: "mods-armor", tier: 2, slot: "feet", summary: "Quieter footsteps.", uses: ["Stealth"], perk: "From the Shadows" }),
  mod("modArmorImpactBracing", { id: "mod-armor-impact-bracing", name: "Impact Bracing Mod", category: "mods-armor", tier: 2, slot: "armor", summary: "Reduces explosion knockback.", uses: ["Demolisher nights"] }),
  mod("modArmorWaterPurifier", { id: "mod-armor-water-purifier", name: "Water Purifier Mod", category: "mods-armor", tier: 2, slot: "armor", summary: "Purifies water while worn.", uses: ["Exploration"] }),
  mod("modArmorTreasureHunter", { id: "mod-armor-treasure-hunter", name: "Treasure Hunter Mod", category: "mods-armor", tier: 3, slot: "armor", summary: "Better buried treasure sensing.", uses: ["Lucky Looter"], perk: "Lucky Looter" }),
  mod("modArmorPerception", { id: "mod-armor-perception", name: "Perception Armor Mod", category: "mods-armor", tier: 2, slot: "armor", summary: "+Perception on armor piece.", uses: ["Perception builds"] }),
  mod("modArmorStrength", { id: "mod-armor-strength", name: "Strength Armor Mod", category: "mods-armor", tier: 2, slot: "armor", summary: "+Strength on armor piece.", uses: ["Melee builds"] }),
  mod("modArmorFortitude", { id: "mod-armor-fortitude", name: "Fortitude Armor Mod", category: "mods-armor", tier: 2, slot: "armor", summary: "+Fortitude on armor piece.", uses: ["Tank builds"] }),
  mod("modArmorAgility", { id: "mod-armor-agility", name: "Agility Armor Mod", category: "mods-armor", tier: 2, slot: "armor", summary: "+Agility on armor piece.", uses: ["Archery / stealth"] }),
  mod("modArmorIntellect", { id: "mod-armor-intellect", name: "Intellect Armor Mod", category: "mods-armor", tier: 2, slot: "armor", summary: "+Intellect on armor piece.", uses: ["Robotics / traps"] }),

  // —— Melee & tool mods ——
  mod("modMeleeSerratedBlade", { id: "mod-melee-serrated-blade", name: "Serrated Blade Mod", category: "mods-melee", slot: "blade", summary: "Bleed damage on blades.", uses: ["Knives", "Machete"] }),
  mod("modMeleeTemperedBlade", { id: "mod-melee-tempered-blade", name: "Tempered Blade Mod", category: "mods-melee", slot: "blade", summary: "Higher blade damage.", uses: ["Knives", "Swords"] }),
  mod("modMeleeWeightedHead", { id: "mod-melee-weighted-head", name: "Weighted Head Mod", category: "mods-melee", slot: "head", summary: "More blunt damage; slower swings.", uses: ["Clubs", "Sledges"] }),
  mod("modMeleeErgonomicGrip", { id: "mod-melee-ergonomic-grip", name: "Ergonomic Grip Mod", category: "mods-melee", slot: "grip", summary: "Less stamina per swing.", uses: ["All melee"] }),
  mod("modMeleeFortifyingGrip", { id: "mod-melee-fortifying-grip", name: "Fortifying Grip Mod", category: "mods-melee", slot: "grip", summary: "Bonus damage vs blocks.", uses: ["Mining melee"] }),
  mod("modMeleeStructuralBrace", { id: "mod-melee-structural-brace", name: "Structural Brace Mod", category: "mods-melee", slot: "shaft", summary: "Extra block damage for breaching.", uses: ["Sledgehammers"] }),
  mod("modMeleeGraveDigger", { id: "mod-melee-grave-digger", name: "Grave Digger Mod", category: "mods-melee", slot: "head", summary: "Bonus earth/block damage.", uses: ["Shovels", "Pickaxes"] }),
  mod("modMeleeWoodSplitter", { id: "mod-melee-wood-splitter", name: "Wood Splitter Mod", category: "mods-melee", slot: "head", summary: "Bonus wood harvest damage.", uses: ["Axes"] }),
  mod("modMeleeIronBreaker", { id: "mod-melee-iron-breaker", name: "Iron Breaker Mod", category: "mods-melee", slot: "head", summary: "Bonus ore/stone damage.", uses: ["Pickaxes"] }),
  mod("modMeleeDiamondTip", { id: "mod-melee-diamond-tip", name: "Diamond Tip Mod", category: "mods-melee", slot: "tip", summary: "Top-tier harvest damage.", uses: ["Endgame tools"] }),
  mod("modMeleeBunkerBuster", { id: "mod-melee-bunker-buster", name: "Bunker Buster Mod", category: "mods-melee", slot: "head", summary: "Massive block damage; heavy stamina cost.", uses: ["POI breaching"] }),
  mod("modMeleeFiremansAxeMod", { id: "mod-melee-firemans-axe", name: "Fireman's Axe Mod", category: "mods-melee", slot: "head", summary: "Bonus wood and block damage on axes.", uses: ["Fire axes"] }),
  mod("modMeleeClubBarbedWire", { id: "mod-melee-club-barbed-wire", name: "Barbed Wire Mod", category: "mods-melee", slot: "head", summary: "Bleed on club hits.", uses: ["Clubs"] }),
  mod("modMeleeClubMetalSpikes", { id: "mod-melee-club-spikes", name: "Metal Spikes Mod", category: "mods-melee", slot: "head", summary: "Higher club damage.", uses: ["Clubs"] }),
  mod("modMeleeClubMetalChain", { id: "mod-melee-club-chain", name: "Metal Chain Mod", category: "mods-melee", slot: "head", summary: "Knockback boost on clubs.", uses: ["Clubs"] }),
  mod("modMeleeClubBurningShaft", { id: "mod-melee-burning-shaft", name: "Burning Shaft Mod", category: "mods-melee", slot: "shaft", summary: "Fire damage over time.", uses: ["Clubs", "Spears"] }),
  mod("modMeleeStunBatonRepulsor", { id: "mod-melee-stun-repulsor", name: "Stun Baton Repulsor Mod", category: "mods-melee", slot: "head", summary: "Stronger stun baton knockback.", uses: ["Stun baton"], perk: "Electrocutioner" }),

  // —— Vehicle mods ——
  mod("modVehicleFuelSaver", { id: "mod-vehicle-fuel-saver", name: "Fuel Saver Mod", category: "mods-vehicle", slot: "vehicle", summary: "Reduces fuel consumption.", uses: ["All fueled vehicles"], perk: "Grease Monkey" }),
  mod("modVehicleSuperCharger", { id: "mod-vehicle-super-charger", name: "Super Charger Mod", category: "mods-vehicle", slot: "vehicle", summary: "Increases top speed.", uses: ["Minibike+", "Grease Monkey"] }),
  mod("modVehiclePlow", { id: "mod-vehicle-plow", name: "Plow Mod", category: "mods-vehicle", slot: "vehicle", summary: "Front plow; damages zombies and soil.", uses: ["4x4", "Motorcycle"] }),
  mod("modVehicleArmor", { id: "mod-vehicle-armor", name: "Vehicle Armor Mod", category: "mods-vehicle", slot: "vehicle", summary: "More vehicle HP; heavier.", uses: ["Combat vehicles"] }),
  mod("modVehicleExpandedSeat", { id: "mod-vehicle-expanded-seat", name: "Expanded Seat Mod", category: "mods-vehicle", slot: "vehicle", summary: "Extra passenger/storage slot.", uses: ["4x4 truck"] }),
  mod("modVehicleReserveFuelTank", { id: "mod-vehicle-reserve-fuel", name: "Reserve Fuel Tank Mod", category: "mods-vehicle", slot: "vehicle", summary: "Extra fuel capacity.", uses: ["Long trips"] }),
  mod("modVehicleOffRoadHeadlights", { id: "mod-vehicle-offroad-lights", name: "Off-Road Headlights Mod", category: "mods-vehicle", slot: "vehicle", summary: "Brighter headlights for night.", uses: ["All motorized vehicles"] }),
  mod("modFuelTankSmall", { id: "mod-fuel-tank-small", name: "Small Fuel Tank Mod", category: "mods-vehicle", tier: 1, slot: "vehicle", summary: "Modest fuel capacity boost.", uses: ["Early vehicles"] }),
  mod("modFuelTankLarge", { id: "mod-fuel-tank-large", name: "Large Fuel Tank Mod", category: "mods-vehicle", tier: 3, slot: "vehicle", summary: "Large fuel capacity boost.", uses: ["4x4", "Gyrocopter"] }),

  // —— Drone mods ——
  mod("modRoboticDroneCargoMod", { id: "mod-drone-cargo", name: "Drone Cargo Mod", category: "mods-drone", slot: "drone", summary: "Extra remote storage on drone.", uses: ["Robotic drone"], perk: "Robotics Inventor" }),
  mod("modRoboticDroneMedicMod", { id: "mod-drone-medic", name: "Drone Medic Mod", category: "mods-drone", slot: "drone", summary: "Drone heals player over time.", uses: ["Robotic drone"], perk: "Robotics Inventor" }),
  mod("modRoboticDroneHeadlampMod", { id: "mod-drone-headlamp", name: "Drone Headlamp Mod", category: "mods-drone", slot: "drone", summary: "Drone provides light.", uses: ["Robotic drone"] }),
  mod("modRoboticDroneArmorPlatingMod", { id: "mod-drone-armor", name: "Drone Armor Plating Mod", category: "mods-drone", slot: "drone", summary: "More drone durability.", uses: ["Robotic drone"] }),
  mod("modRoboticDroneMoraleBoosterMod", { id: "mod-drone-morale", name: "Drone Morale Booster Mod", category: "mods-drone", slot: "drone", summary: "Stamina/wellness buff aura.", uses: ["Robotic drone"] }),
];

const VEHICLE_PARTS = [
  { id: "vehicle-wheels", name: "Wheels", category: "vehicle-parts", tier: 1, modIcon: "vehicleWheels", summary: "Standard wheel set. Required for every motorized vehicle build.", ingredients: ["Forged Iron", "Clay Soil", "Coal"], perk: "Grease Monkey", uses: ["All vehicles"] },
  { id: "small-engine", name: "Small Engine", category: "vehicle-parts", tier: 2, modIcon: "smallEngine", summary: "Powers minibike and motorcycle.", ingredients: ["Forged Iron", "Mechanical Parts", "Duct Tape"], perk: "Grease Monkey", uses: ["Minibike", "Motorcycle"] },
  { id: "bicycle-chassis", name: "Bicycle Chassis", category: "vehicle-parts", tier: 1, modIcon: "vehicleBicycleChassis", summary: "Bicycle frame.", ingredients: ["Forged Iron", "Wood", "Mechanical Parts"], perk: "Grease Monkey", uses: ["Bicycle"] },
  { id: "bicycle-handlebars", name: "Bicycle Handlebars", category: "vehicle-parts", tier: 1, modIcon: "vehicleBicycleHandlebars", summary: "Bicycle steering.", ingredients: ["Forged Iron", "Duct Tape"], perk: "Grease Monkey", uses: ["Bicycle"] },
  { id: "minibike-chassis", name: "Minibike Chassis", category: "vehicle-parts", tier: 2, modIcon: "vehicleMinibikeChassis", summary: "Minibike frame.", ingredients: ["Forged Iron", "Mechanical Parts"], perk: "Grease Monkey", uses: ["Minibike"] },
  { id: "minibike-handlebars", name: "Minibike Handlebars", category: "vehicle-parts", tier: 2, modIcon: "vehicleMinibikeHandlebars", summary: "Minibike steering.", ingredients: ["Forged Iron", "Duct Tape"], perk: "Grease Monkey", uses: ["Minibike"] },
  { id: "motorcycle-chassis", name: "Motorcycle Chassis", category: "vehicle-parts", tier: 2, modIcon: "vehicleMotorcycleChassis", summary: "Motorcycle frame.", ingredients: ["Forged Iron", "Mechanical Parts"], perk: "Grease Monkey", uses: ["Motorcycle"] },
  { id: "motorcycle-handlebars", name: "Motorcycle Handlebars", category: "vehicle-parts", tier: 2, modIcon: "vehicleMotorcycleHandlebars", summary: "Motorcycle steering.", ingredients: ["Forged Iron", "Leather"], perk: "Grease Monkey", uses: ["Motorcycle"] },
  { id: "truck-chassis", name: "4x4 Truck Chassis", category: "vehicle-parts", tier: 3, modIcon: "vehicleTruck4x4Chassis", summary: "4x4 truck frame.", ingredients: ["Forged Steel", "Mechanical Parts"], perk: "Grease Monkey", uses: ["4x4 Truck"] },
  { id: "truck-accessories", name: "4x4 Truck Accessories", category: "vehicle-parts", tier: 3, modIcon: "vehicleTruck4x4Accessories", summary: "Body panels and truck extras.", ingredients: ["Forged Steel", "Duct Tape"], perk: "Grease Monkey", uses: ["4x4 Truck"] },
  { id: "gyro-chassis", name: "Gyrocopter Chassis", category: "vehicle-parts", tier: 3, modIcon: "vehicleGyroCopterChassis", summary: "Gyrocopter frame.", ingredients: ["Forged Steel", "Mechanical Parts"], perk: "Grease Monkey", uses: ["Gyrocopter"] },
  { id: "gyro-accessories", name: "Gyrocopter Accessories", category: "vehicle-parts", tier: 3, modIcon: "vehicleGyroCopterAccessories", summary: "Rotor mast, tail, and gyro parts.", ingredients: ["Forged Steel", "Electrical Parts"], perk: "Grease Monkey", uses: ["Gyrocopter"] },
];

const NEW_CATEGORIES = [
  { id: "robotics", name: "Robotics", icon: "chip" },
  { id: "vehicle-parts", name: "Vehicle Parts", icon: "wheel" },
  { id: "mods-weapon", name: "Weapon Mods", icon: "bullet" },
  { id: "mods-armor", name: "Armor Mods", icon: "shield" },
  { id: "mods-melee", name: "Melee & Tool Mods", icon: "axe" },
  { id: "mods-vehicle", name: "Vehicle Mods", icon: "wheel" },
  { id: "mods-drone", name: "Drone Mods", icon: "chip" },
];

const ROBOTICS_IDS = new Set(["junk-turret", "robotic-sledge", "robotic-drone"]);

const OLD_MOD_IDS = new Set([
  "weapon-mod-bipod", "weapon-mod-scope", "weapon-mod-suppressor", "weapon-mod-extended-mag",
  "armor-mod-pockets", "armor-mod-padded", "armor-mod-insulated", "armor-mod-cooling",
]);

function main() {
  const data = JSON.parse(fs.readFileSync(ITEMS_PATH, "utf8"));

  // Replace categories: remove generic "mods", add split categories
  const catIds = new Set(data.categories.map((c) => c.id));
  data.categories = data.categories.filter((c) => c.id !== "mods");
  for (const c of NEW_CATEGORIES) {
    if (!catIds.has(c.id)) data.categories.push(c);
  }

  // Move robotics; drop old sample mods; append new mods + parts
  let items = data.items.filter((i) => !OLD_MOD_IDS.has(i.id));

  for (const item of items) {
    if (ROBOTICS_IDS.has(item.id)) item.category = "robotics";
  }

  const existingIds = new Set(items.map((i) => i.id));
  for (const m of MODS) {
    if (!existingIds.has(m.id)) {
      items.push(m);
      existingIds.add(m.id);
    }
  }
  for (const p of VEHICLE_PARTS) {
    if (!existingIds.has(p.id)) {
      items.push({ ...p, stack: p.stack ?? 1, weight: p.weight ?? 5 });
      existingIds.add(p.id);
    }
  }

  // Sort: keep category order, then name
  const catOrder = Object.fromEntries(data.categories.map((c, i) => [c.id, i]));
  items.sort((a, b) => {
    const ca = catOrder[a.category] ?? 99;
    const cb = catOrder[b.category] ?? 99;
    if (ca !== cb) return ca - cb;
    return a.name.localeCompare(b.name);
  });

  data.items = items;
  fs.writeFileSync(ITEMS_PATH, JSON.stringify(data, null, 2) + "\n");
  console.log(`Catalog: ${items.length} items, ${data.categories.length} categories`);
  console.log(`Added ${MODS.length} mods, ${VEHICLE_PARTS.length} vehicle parts`);
  console.log("Robotics:", [...ROBOTICS_IDS].join(", "));
}

main();
