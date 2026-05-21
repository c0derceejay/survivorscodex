#!/usr/bin/env node
/**
 * Remove PNGs + manifest entries for zombie ids that were dropped from entities.json.
 * Does NOT touch craftable item icons in the manifest.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const entitiesPath = path.join(ROOT, "data/entities.json");
const manifestPath = path.join(ROOT, "images/manifest.json");
const sourcesPath = path.join(ROOT, "data/entity-icon-sources.json");
const outDir = path.join(ROOT, "images/items");

const currentIds = new Set(
  JSON.parse(fs.readFileSync(entitiesPath, "utf8")).entities.map((e) => e.id)
);

/** Previous entity catalog ids (before vanilla trim) — safe to delete if still on disk. */
const LEGACY_ENTITY_IDS = [
  "burn-victim", "businessman", "crawler-zombie", "demolisher", "departed-woman", "dire-wolf",
  "fallen-soldier", "fat-hawaiian", "festering-cadaver", "frozen-lumberjack", "grace",
  "hazmat-zombie", "hungry-female", "infected-mother", "infected-police-officer",
  "infected-survivor", "lab-zombie", "party-girl", "plagued-nurse", "putrid-girl",
  "reanimated-corpse", "rotting-carcass", "screamer", "skater-punk", "spider-zombie",
  "utility-worker", "wight", "zombie-behemoth", "zombie-cheerleader", "zombie-chuck",
  "zombie-cowboy", "zombie-farmer", "zombie-football-player", "zombie-lumberjack",
  "zombie-miner", "zombie-rancher", "mutated-zombie",
];

const manifest = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  : {};

let removed = 0;
for (const id of LEGACY_ENTITY_IDS) {
  if (currentIds.has(id)) continue;
  if (manifest[id]) delete manifest[id];
  const f = path.join(outDir, `${id}.png`);
  if (fs.existsSync(f)) {
    fs.unlinkSync(f);
    removed++;
  }
}

if (fs.existsSync(sourcesPath)) {
  const sources = JSON.parse(fs.readFileSync(sourcesPath, "utf8"));
  if (sources.sources) {
    for (const key of Object.keys(sources.sources)) {
      if (!currentIds.has(key)) delete sources.sources[key];
    }
    fs.writeFileSync(sourcesPath, JSON.stringify(sources, null, 2) + "\n");
  }
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`Pruned ${removed} legacy entity image(s). Active zombies: ${currentIds.size}.`);
