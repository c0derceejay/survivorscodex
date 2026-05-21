#!/usr/bin/env node
/**
 * Download item icons from tassoneroberto/7dtd-assets (GitHub).
 * https://github.com/tassoneroberto/7dtd-assets
 *
 * Usage:
 *   npm run icons:github
 *   DTD_ASSETS_VERSION=v1.0 npm run icons:github
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "images", "items");
const MANIFEST_PATH = path.join(ROOT, "images", "manifest.json");

const REPO = "tassoneroberto/7dtd-assets";
const BRANCH = "main";
function iconUrl(version, gameName) {
  return `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${version}/ItemIcons/${encodeURIComponent(gameName)}.png`;
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) return false;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 200) return false;
  fs.writeFileSync(dest, buf);
  return true;
}

async function main() {
  const iconMapPath = path.join(ROOT, "data", "icon-map.json");
  const iconMap = JSON.parse(fs.readFileSync(iconMapPath, "utf8"));
  const version = process.env.DTD_ASSETS_VERSION || iconMap._github?.version || "v2.1";

  console.log(`Downloading from ${REPO} (${version}/ItemIcons)…\n`);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const manifest = {
    _version: new Date().toISOString().slice(0, 10),
    _github: iconMap._github || { repo: `https://github.com/${REPO}`, version },
  };
  let ok = 0;
  let fail = 0;

  for (const [itemId, gameName] of Object.entries(iconMap)) {
    if (itemId.startsWith("_")) continue;
    const url = iconUrl(version, gameName);
    const dest = path.join(OUT_DIR, `${itemId}.png`);
    process.stdout.write(`  ${itemId}… `);
    try {
      if (await download(url, dest)) {
        manifest[itemId] = true;
        ok++;
        console.log("✓");
      } else {
        fail++;
        console.log(`✗ (${gameName}.png)`);
      }
    } catch (err) {
      fail++;
      console.log(`✗ ${err.message}`);
    }
  }

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`\nDone: ${ok} downloaded, ${fail} missing.`);
  console.log("Manifest:", MANIFEST_PATH);
  console.log(`\nAttribution: icons from ${iconMap._github?.repo || REPO}`);
  if (fail) {
    console.log("Tip: try another version, e.g. DTD_ASSETS_VERSION=v1.4 npm run icons:github");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
