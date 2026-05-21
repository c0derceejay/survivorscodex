#!/usr/bin/env node
/** Rebuild images/manifest.json from icon-map + entities + files on disk. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const map = JSON.parse(fs.readFileSync(path.join(ROOT, "data/icon-map.json"), "utf8"));
const items = JSON.parse(fs.readFileSync(path.join(ROOT, "data/items.json"), "utf8")).items;
const entities = JSON.parse(fs.readFileSync(path.join(ROOT, "data/entities.json"), "utf8")).entities;
const outDir = path.join(ROOT, "images/items");

const manifest = {
  _version: new Date().toISOString().slice(0, 10),
  _github: map._github || {},
};

const ids = new Set(items.map((i) => i.id));
for (const e of entities) ids.add(e.id);

let n = 0;
for (const id of ids) {
  if (fs.existsSync(path.join(outDir, `${id}.png`))) {
    manifest[id] = true;
    n++;
  }
}

fs.writeFileSync(path.join(ROOT, "images/manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`Manifest: ${n} icons on disk`);
