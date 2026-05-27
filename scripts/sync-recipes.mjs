#!/usr/bin/env node
/**
 * Syncs crafting recipes from 7dtd-assets recipes.xml into data/items.json.
 * Run: npm run recipes:sync  (or as part of catalog:refresh)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const RECIPES_URL =
  "https://raw.githubusercontent.com/tassoneroberto/7dtd-assets/main/v2.1/Config/recipes.xml";
const LOCAL_RECIPES = path.join(ROOT, "data/recipes-v2.1.xml");
const ITEMS_PATH = path.join(ROOT, "data/items.json");
const ICON_MAP_PATH = path.join(ROOT, "data/icon-map.json");
const CACHE_PATH = path.join(ROOT, "data/recipe-ingredients.json");

const CRAFT_AREA_LABELS = {
  forge: "Forge",
  workbench: "Workbench",
  chemistryStation: "Chemistry Station",
  cementMixer: "Cement Mixer",
  campfire: "Campfire",
};

const UNIT_NAMES = {
  unit_clay: "Clay",
  unit_glass: "Glass",
  unit_stone: "Stone",
  unit_brass: "Brass",
  unit_iron: "Iron",
  unit_lead: "Lead",
  unit_steel: "Steel",
};

function humanizeIcon(icon) {
  if (UNIT_NAMES[icon]) return UNIT_NAMES[icon];
  let s = icon
    .replace(/^(gun|meleeWpn|meleeTool|ammo|resource|mod|armor|food|drink|medical|drug|vehicle)/, "")
    .replace(/T[0-3]/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .trim();
  if (!s) s = icon.replace(/([A-Z])/g, " $1").trim();
  return s.replace(/\s+/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function parseAttrs(attrString) {
  const attrs = {};
  const re = /(\w+)="([^"]*)"/g;
  let m;
  while ((m = re.exec(attrString)) !== null) attrs[m[1]] = m[2];
  return attrs;
}

function scoreRecipe(recipe) {
  if (recipe.ingredients.length > 0) return 10 + recipe.ingredients.length;
  if (recipe.hasWildcard) return 1;
  return 0;
}

function parseRecipes(xml) {
  const byName = new Map();
  const recipeRe = /<recipe\s+([^>]+)>([\s\S]*?)<\/recipe>/g;
  let match;
  while ((match = recipeRe.exec(xml)) !== null) {
    const attrs = parseAttrs(match[1]);
    const name = attrs.name;
    if (!name) continue;

    const body = match[2];
    const ingredients = [];
    const ingRe = /<ingredient\s+([^/>]+)\/>/g;
    let ingMatch;
    while ((ingMatch = ingRe.exec(body)) !== null) {
      const ingAttrs = parseAttrs(ingMatch[1]);
      const count = Number.parseInt(ingAttrs.count, 10) || 0;
      if (count <= 0 || !ingAttrs.name) continue;
      ingredients.push({ gameName: ingAttrs.name, count });
    }

    const recipe = {
      craftArea: attrs.craft_area || null,
      craftTool: attrs.craft_tool || null,
      yield: Number.parseInt(attrs.count, 10) || 1,
      hasWildcard: body.includes("wildcard_forge_category"),
      hasQualityScaling: body.includes("CraftingIngredientCount"),
      ingredients,
    };

    const existing = byName.get(name);
    if (!existing || scoreRecipe(recipe) > scoreRecipe(existing)) {
      byName.set(name, recipe);
    }
  }
  return byName;
}

function buildLookups(items, iconMap) {
  const byModIcon = new Map();
  const byId = new Map();
  for (const item of items) {
    if (item.modIcon) byModIcon.set(item.modIcon, item);
    byId.set(item.id, item);
  }
  const iconReverse = new Map();
  for (const [id, modIcon] of Object.entries(iconMap)) {
    if (!iconReverse.has(modIcon)) iconReverse.set(modIcon, id);
  }
  return { byModIcon, byId, iconReverse };
}

function resolveIngredient(gameName, lookups) {
  const catalogItem = lookups.byModIcon.get(gameName);
  if (catalogItem) {
    return { id: catalogItem.id, name: catalogItem.name, count: 0, gameName };
  }
  const mappedId = lookups.iconReverse.get(gameName);
  if (mappedId) {
    const item = lookups.byId.get(mappedId);
    if (item) return { id: item.id, name: item.name, count: 0, gameName };
  }
  return { id: null, name: humanizeIcon(gameName), count: 0, gameName };
}

function formatIngredientStrings(ingredients) {
  return ingredients.map((ing) => `${ing.count}× ${ing.name}`);
}

function buildRecipePayload(rawRecipe, lookups) {
  if (rawRecipe.ingredients.length > 0) {
    const ingredients = rawRecipe.ingredients.map(({ gameName, count }) => {
      const resolved = resolveIngredient(gameName, lookups);
      return { id: resolved.id, name: resolved.name, count, gameName };
    });
    return {
      craftArea: rawRecipe.craftArea,
      craftAreaLabel: rawRecipe.craftArea
        ? CRAFT_AREA_LABELS[rawRecipe.craftArea] || humanizeIcon(rawRecipe.craftArea)
        : null,
      craftTool: rawRecipe.craftTool,
      yield: rawRecipe.yield,
      hasQualityScaling: rawRecipe.hasQualityScaling,
      forgeOnly: false,
      ingredients,
    };
  }

  if (rawRecipe.hasWildcard) {
    return {
      craftArea: rawRecipe.craftArea || "forge",
      craftAreaLabel: "Forge",
      forgeOnly: true,
      ingredients: [],
    };
  }

  return null;
}

async function loadRecipesXml() {
  if (process.env.RECIPES_LOCAL === "1" && fs.existsSync(LOCAL_RECIPES)) {
    console.log("Using local recipes file:", LOCAL_RECIPES);
    return fs.readFileSync(LOCAL_RECIPES, "utf8");
  }
  console.log("Fetching recipes.xml from 7dtd-assets…");
  const res = await fetch(RECIPES_URL, {
    headers: { "User-Agent": "SurvivorsCodex/1.0 (fan catalog)" },
  });
  if (!res.ok) throw new Error(`Failed to fetch recipes.xml: ${res.status}`);
  return res.text();
}

function main() {
  return loadRecipesXml().then((xml) => {
    const parsed = parseRecipes(xml);
    const catalog = JSON.parse(fs.readFileSync(ITEMS_PATH, "utf8"));
    const iconMap = fs.existsSync(ICON_MAP_PATH)
      ? JSON.parse(fs.readFileSync(ICON_MAP_PATH, "utf8"))
      : {};
    const lookups = buildLookups(catalog.items, iconMap);

    const cache = {};
    let matched = 0;
    let withIngredients = 0;
    let forgeOnly = 0;
    let unchanged = 0;

    for (const item of catalog.items) {
      if (item.entityId) continue;

      const raw = item.modIcon ? parsed.get(item.modIcon) : null;
      if (!raw) {
        if (
          !item.recipe &&
          Array.isArray(item.ingredients) &&
          item.ingredients[0] === "See in-game recipe / loot tables"
        ) {
          unchanged += 1;
        }
        continue;
      }

      const recipe = buildRecipePayload(raw, lookups);
      if (!recipe) continue;

      matched += 1;
      cache[item.id] = recipe;

      if (recipe.forgeOnly) {
        forgeOnly += 1;
        item.recipe = recipe;
        item.ingredients = ["Forge or salvage (material-based)"];
      } else {
        withIngredients += 1;
        item.recipe = recipe;
        item.ingredients = formatIngredientStrings(recipe.ingredients);
      }
    }

    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2) + "\n");
    fs.writeFileSync(ITEMS_PATH, JSON.stringify(catalog, null, 2) + "\n");

    console.log(`Parsed ${parsed.size} unique recipe names from recipes.xml`);
    console.log(`Matched ${matched} catalog items (${withIngredients} with ingredients, ${forgeOnly} forge-only)`);
    console.log(`  ${unchanged} items still without recipe data`);
    console.log(`Wrote ${Object.keys(cache).length} entries → data/recipe-ingredients.json`);
    console.log(`Updated data/items.json`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
