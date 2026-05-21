#!/usr/bin/env node
/**
 * Auto-build data/icon-map.json by matching catalog items to 7dtd-assets v2.1 ItemIcons.
 * Run: node scripts/build-icon-map.mjs && npm run icons:github
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const VERSION = process.env.DTD_ASSETS_VERSION || "v2.1";

/** Hand-tuned overrides (catalog id → exact icon basename). */
const OVERRIDES = {
  "iron-pickaxe": "meleeToolPickT1IronPickaxe",
  "steel-pickaxe": "meleeToolPickT2SteelPickaxe",
  "iron-fireaxe": "meleeToolAxeT1IronFireaxe",
  "steel-fireaxe": "meleeToolAxeT2SteelAxe",
  "iron-shovel": "meleeToolShovelT1IronShovel",
  "steel-shovel": "meleeToolShovelT1IronShovel",
  auger: "meleeToolPickT3Auger",
  chainsaw: "meleeToolAxeT3Chainsaw",
  wrench: "meleeToolSalvageT1Wrench",
  ratchet: "meleeToolSalvageT2Ratchet",
  "impact-driver": "meleeToolSalvageT3ImpactDriver",
  "claw-hammer": "meleeToolRepairT1ClawHammer",
  nailgun: "meleeToolRepairT3Nailgun",
  forge: "forge",
  workbench: "workbench",
  "chemistry-station": "chemistryStation",
  "cement-mixer": "cementMixer",
  "stone-axe": "meleeToolRepairT0StoneAxe",
  wood: "resourceWood",
  "plant-fibers": "resourceYuccaFibers",
  stone: "resourceRockSmall",
  "small-stone": "resourceRockSmall",
  iron: "oreIronBoulder",
  lead: "resourceScrapLead",
  brass: "resourceScrapBrass",
  coal: "resourceCoal",
  "nitrate-powder": "resourcePotassiumNitratePowder",
  gunpowder: "resourceGunPowder",
  "forged-iron": "resourceForgedIron",
  "forged-steel": "resourceForgedSteel",
  leather: "resourceLeather",
  cloth: "resourceCloth",
  "duct-tape": "resourceDuctTape",
  glue: "resourceGlue",
  "mechanical-parts": "resourceMechanicalParts",
  "electrical-parts": "resourceElectricParts",
  spring: "resourceSpring",
  "oil-shale": "resourceOilShale",
  gasoline: "ammoGasCan",
  acid: "resourceAcid",
  "wooden-club": "meleeWpnClubT0WoodenClub",
  "stone-spear": "meleeWpnSpearT0StoneSpear",
  "stone-sledgehammer": "meleeWpnSledgeT0StoneSledgehammer",
  "iron-club": "meleeWpnClubT1BaseballBat",
  "pipe-baton": "meleeWpnBatonT0PipeBaton",
  "stun-baton": "meleeWpnBatonT2StunBaton",
  "steel-club": "meleeWpnClubT3SteelClub",
  "steel-sledgehammer": "meleeWpnSledgeT3SteelSledgehammer",
  "iron-spear": "meleeWpnSpearT1IronSpear",
  "steel-spear": "meleeWpnSpearT3SteelSpear",
  "bone-knife": "meleeWpnBladeT0BoneKnife",
  "hunting-knife": "meleeWpnBladeT1HuntingKnife",
  machete: "meleeWpnBladeT3Machete",
  "wooden-bow": "gunBowT0PrimitiveBow",
  "iron-crossbow": "gunBowT1IronCrossbow",
  "compound-bow": "gunBowT3CompoundBow",
  "compound-crossbow": "gunBowT3CompoundCrossbow",
  "pipe-pistol": "gunHandgunT0PipePistol",
  "pipe-shotgun": "gunShotgunT0PipeShotgun",
  "pipe-machine-gun": "gunMGT0PipeMachineGun",
  "pipe-rifle": "gunRifleT0PipeRifle",
  "9mm-pistol": "gunHandgunT1Pistol",
  "44-magnum": "gunHandgunT2Magnum44",
  "desert-vulture": "gunHandgunT3DesertVulture",
  "hunting-rifle": "gunRifleT1HuntingRifle",
  "lever-action-rifle": "gunRifleT2LeverActionRifle",
  "marksman-rifle": "gunMGT2TacticalAR",
  "sniper-rifle": "gunRifleT3SniperRifle",
  "smg-5": "gunHandgunT3SMG5",
  "ak-47": "gunMGT1AK47",
  "tactical-ar": "gunMGT2TacticalAR",
  m60: "gunMGT3M60",
  "double-barrel": "gunShotgunT1DoubleBarrel",
  "pump-shotgun": "gunShotgunT2PumpShotgun",
  "auto-shotgun": "gunShotgunT3AutoShotgun",
  "rocket-launcher": "gunExplosivesT3RocketLauncher",
  "junk-turret": "gunBotT2JunkTurret",
  "robotic-sledge": "gunBotT1JunkSledge",
  "robotic-drone": "gunBotT3JunkDrone",
  "stone-arrow": "ammoArrowStone",
  "iron-arrow": "ammoArrowIron",
  "steel-arrow": "ammoArrowSteelAP",
  "stone-bolt": "ammoCrossbowBoltStone",
  "iron-bolt": "ammoCrossbowBoltIron",
  "steel-bolt": "ammoCrossbowBoltSteelAP",
  "9mm-bullet": "ammo9mmBulletBall",
  "9mm-bullet-hp": "ammo9mmBulletHP",
  "9mm-bullet-ap": "ammo9mmBulletAP",
  "762-bullet": "ammo762mmBulletBall",
  "762-bullet-hp": "ammo762mmBulletHP",
  "762-bullet-ap": "ammo762mmBulletAP",
  "44-bullet": "ammo44MagnumBulletBall",
  "shotgun-shell": "ammoShotgunShell",
  "shotgun-slug": "ammoShotgunSlug",
  "rocket-he": "ammoRocketHE",
  "rocket-frag": "ammoRocketFrag",
  "murky-water": "drinkJarRiverWater",
  corn: "foodCropCorn",
  potato: "foodCropPotato",
  honey: "foodHoney",
  "frame-shape": "woodMaster",
  "wood-block": "woodMaster",
  "cobblestone-block": "cobblestoneMaster",
  "concrete-block": "concreteMaster",
  "steel-block": "steelMaster",
  "secure-door": "doorWoodLargeGate",
  "iron-bars": "ironBarsCentered",
  "secure-storage-chest": "cntWoodenChestClosed",
  "barbed-wire": "barbedFence",
  "dart-trap": "dartTrap",
  "smg-turret": "autoTurret",
  "shotgun-turret": "shotgunTurret",
  "leather-armor": "armorRogueOutfit",
  "iron-armor": "armorCommandoOutfit",
  "steel-armor": "armorEnforcerOutfit",
  "military-armor": "armorRangerOutfit",
  "padded-armor": "armorPrimitiveOutfit",
  "scrap-armor": "armorRaiderOutfit",
  "lumberjack-shirt": "armorLumberjackOutfit",
  "cowboy-hat": "armorFarmerHelmet",
  "football-helmet": "armorAthleticHelmet",
  "hazmat-suit": "armorNomadOutfit",
  "weapon-mod-scope": "modGunReflexSight",
  "armor-mod-pockets": "modArmorStoragePocket",
  "armor-mod-padded": "modArmorPlatingBasic",
};

/**
 * Optional entity portraits (catalog id → ItemIcons basename).
 * The assets repo has no zombie portraits; leave empty unless you add real icons.
 */
const ENTITY_ICON_OVERRIDES = {};

/** Categories where fuzzy auto-match often picks decor/props — require a higher score. */
const CATEGORY_MIN_SCORE = {
  blocks: 700,
  traps: 600,
  clothing: 600,
  food: 500,
  vehicles: 500,
};

function norm(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function slugTokens(slug) {
  return slug.split("-").filter(Boolean);
}

function scoreIcon(iconNorm, item) {
  const idNorm = norm(item.id);
  const nameNorm = norm(item.name);
  const tokens = slugTokens(item.id);

  if (iconNorm === idNorm) return 1000;
  if (iconNorm === nameNorm) return 950;
  if (iconNorm.endsWith(idNorm) || iconNorm.includes(idNorm)) return 800;

  let tokenHits = 0;
  for (const t of tokens) {
    if (t.length >= 3 && iconNorm.includes(t)) tokenHits++;
  }
  if (tokenHits === tokens.length && tokens.length) return 600 + tokenHits * 20;

  // tier hints in game files: T0, T1, T2, T3
  const tier = item.tier;
  if (tier && iconNorm.includes(`t${tier - 1}`)) return 400 + tokenHits * 10;

  if (tokenHits >= 2) return 300 + tokenHits * 15;
  if (tokenHits === 1 && tokens[0].length >= 4) return 200;

  return 0;
}

const CATEGORY_PREFIX_HINTS = {
  enemies: [],
  "weapons-melee": ["meleewpn", "meleetool"],
  "weapons-ranged": ["gun", "meleewpn"],
  ammo: ["ammo"],
  food: ["food", "drink"],
  medical: ["medical", "drug", "resource"],
  resources: ["resource", "ore"],
  blocks: ["woodmaster", "cobblestonemaster", "concretemaster", "steelmaster", "door", "ironbars", "cntwooden"],
  traps: ["trap", "electricfence", "blade", "barbed", "darttrap", "turret", "autoturret", "shotgunturret"],
  vehicles: ["vehicle", "minibike", "motorcycle", "bicycle", "4x4", "gyro"],
  clothing: ["armor", "apparel"],
  mods: ["modgun", "modarmor", "mod"],
};

async function fetchIconList() {
  const cachePath = path.join(ROOT, "data", `github-icons-${VERSION}.json`);
  if (fs.existsSync(cachePath) && !process.env.REFRESH_ICON_CACHE) {
    return JSON.parse(fs.readFileSync(cachePath, "utf8"));
  }
  console.log("Fetching icon list from GitHub tree…");
  const res = await fetch(
    `https://api.github.com/repos/tassoneroberto/7dtd-assets/git/trees/main?recursive=1`
  );
  const data = await res.json();
  const icons = data.tree
    .filter((t) => t.path.startsWith(`${VERSION}/ItemIcons/`) && t.path.endsWith(".png"))
    .map((t) => t.path.replace(`${VERSION}/ItemIcons/`, "").replace(/\.png$/i, ""));
  fs.writeFileSync(cachePath, JSON.stringify(icons, null, 2));
  console.log(`Cached ${icons.length} icons → ${cachePath}`);
  return icons;
}

function findBestIcon(item, icons) {
  if (OVERRIDES[item.id]) {
    const o = OVERRIDES[item.id];
    if (icons.includes(o)) return { icon: o, score: 10000 };
  }

  const prefixes = CATEGORY_PREFIX_HINTS[item.category] || [];
  const idNorm = norm(item.id);
  let best = { icon: null, score: 0 };

  for (const icon of icons) {
    const iconNorm = norm(icon);
    const prefixOk = prefixes.length === 0 || prefixes.some((p) => iconNorm.startsWith(p));
    if (!prefixOk && item.category !== "tools") continue;

    const s = scoreIcon(iconNorm, item);
    if (s > best.score) best = { icon, score: s };
  }

  const minScore = CATEGORY_MIN_SCORE[item.category] ?? 200;
  return best.score >= minScore ? best : { icon: null, score: 0 };
}

function loadWikiSyncedEntityIds() {
  const p = path.join(ROOT, "data/entity-icon-sources.json");
  if (!fs.existsSync(p)) return new Set();
  const raw = JSON.parse(fs.readFileSync(p, "utf8"));
  return new Set(Object.keys(raw.sources || {}));
}

/** Remove wrongly auto-mapped entity PNGs; keep wiki-synced portraits (npm run icons:entities). */
function pruneEntityImages(items) {
  const wikiSynced = loadWikiSyncedEntityIds();
  const entityIds = new Set(
    items
      .filter((i) => (i.entityId || i.proceduralIcon) && !wikiSynced.has(i.id))
      .map((i) => i.id)
  );
  if (!entityIds.size) return;

  const manifestPath = path.join(ROOT, "images/manifest.json");
  const outDir = path.join(ROOT, "images/items");
  if (!fs.existsSync(manifestPath)) return;

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  let removed = 0;
  for (const id of entityIds) {
    delete manifest[id];
    const file = path.join(outDir, `${id}.png`);
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      removed++;
    }
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  if (removed) console.log(`\nPruned ${removed} entity image(s) — using procedural thumbnails.`);
}

/** Drop manifest/PNG files for catalog ids no longer in icon-map (e.g. removed wildlife). */
function pruneOrphanImages(map) {
  const manifestPath = path.join(ROOT, "images/manifest.json");
  const outDir = path.join(ROOT, "images/items");
  if (!fs.existsSync(manifestPath)) return;

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  let removed = 0;
  for (const id of Object.keys(manifest)) {
    if (id.startsWith("_") || map[id]) continue;
    delete manifest[id];
    const file = path.join(outDir, `${id}.png`);
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      removed++;
    }
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  if (removed) console.log(`Pruned ${removed} orphan image(s) no longer in catalog.`);
}

async function main() {
  const items = JSON.parse(fs.readFileSync(path.join(ROOT, "data/items.json"), "utf8")).items;
  const icons = await fetchIconList();
  const iconSet = new Set(icons);

  const map = {
    _comment: "Auto + manual mapping → npm run icons:github",
    _github: {
      repo: "https://github.com/tassoneroberto/7dtd-assets",
      version: VERSION,
    },
  };

  const unmatched = [];

  for (const item of items) {
    if (item.entityId || item.proceduralIcon) {
      const entityIcon = ENTITY_ICON_OVERRIDES[item.id];
      if (!entityIcon || !iconSet.has(entityIcon)) continue;
    }

    let gameIcon = OVERRIDES[item.id];
    if (!gameIcon && item.modIcon && iconSet.has(item.modIcon)) {
      gameIcon = item.modIcon;
    }
    if (gameIcon && !iconSet.has(gameIcon)) {
      console.warn(`  override missing in repo: ${item.id} → ${gameIcon}`);
      gameIcon = null;
    }

    if (!gameIcon) {
      const { icon, score } = findBestIcon(item, icons);
      if (icon) gameIcon = icon;
      else unmatched.push(item);
    }

    if (gameIcon) map[item.id] = gameIcon;
  }

  fs.writeFileSync(path.join(ROOT, "data/icon-map.json"), JSON.stringify(map, null, 2) + "\n");
  pruneEntityImages(items);
  pruneOrphanImages(map);

  const mapped = Object.keys(map).filter((k) => !k.startsWith("_")).length;
  const procedural = items.filter((i) => i.entityId || i.proceduralIcon).length;
  console.log(`\nMapped ${mapped} / ${items.length} items (${procedural} entities use procedural thumbnails)`);
  const needIcons = unmatched.filter((i) => !i.entityId && !i.proceduralIcon);
  if (needIcons.length) {
    console.log(`\nStill unmatched (${needIcons.length}):`);
    needIcons.forEach((i) => console.log(`  ${i.category}\t${i.id}\t${i.name}`));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
