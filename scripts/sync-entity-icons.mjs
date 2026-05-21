#!/usr/bin/env node
/**
 * Downloads zombie portraits from 7DTD wikis (wiki.gg first, Fandom fallback),
 * normalizes to 160×160 PNGs for catalog cards.
 *
 * Requires: npm install (sharp)
 * Run: npm run icons:entities
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENTITIES_PATH = path.join(ROOT, "data/entities.json");
const WIKI_CFG_PATH = path.join(ROOT, "data/entity-wiki-pages.json");
const OUT_DIR = path.join(ROOT, "images/items");
const MANIFEST_PATH = path.join(ROOT, "images/manifest.json");
const SOURCES_PATH = path.join(ROOT, "data/entity-icon-sources.json");

const WIKI_SOURCES = [
  { id: "wiki.gg", api: "https://7daystodie.wiki.gg/api.php", pageKey: "pageOverrides" },
  { id: "fandom", api: "https://7daystodie.fandom.com/api.php", pageKey: "fandomPageOverrides" },
];

const SIZE = 160;
const PAD = 14;
const INNER = SIZE - PAD * 2;
const BG = { r: 22, g: 21, b: 26, alpha: 1 };

const JUNK_RE =
  /book|hood|shirt|pants|cloth|denim|army|red x|ui game|symbol|logo|recipe|skill|perk|ammo|resource|casino|coin|mining|helmet|football|nightvision|militaryarmor|tungsten|satchel/i;
const PREFER_AVOID_RE = /a13|side|mk2|old|alpha\s*\d|screenshot|thumb|closeup|alt\d/i;
const ZOMBIE_WORD_RE =
  /zombie|infected|feral|screamer|wight|grace|bear|dog|vulture|crawl|cop|hazmat|stripper|arlene|steve|joe|yo|marlene|darlene|boe|lab|demol|spider|lumber|chuck|biker|rancher|janitor|tom|hawaiian|moe|mutat|business|soldier|utility|tourist|nurse|party|thug|skater|boar|swarm|fatso|fatcop|burn|putrid|festering|departed|reanimated|plagued|bloated|walker|demolish|hazmat|spider|screamer|wight|entity.id|burnvictim|fatso|stripper|survivor|mother|cadaver|carcass|rotting|yo\.jpg|grace boar/i;

function idToWikiTitle(id) {
  return id
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("_");
}

function pageTitleFor(entityId, source, wikiCfg) {
  const overrides = wikiCfg[source.pageKey] || wikiCfg.pageOverrides || {};
  return overrides[entityId] || idToWikiTitle(entityId);
}

async function wikiGet(apiBase, params, attempt = 0) {
  const url = `${apiBase}?${new URLSearchParams({ format: "json", ...params })}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "SurvivorsCodex/1.0 (fan catalog; local dev)" },
  });
  if (res.status === 429 && attempt < 4) {
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    return wikiGet(apiBase, params, attempt + 1);
  }
  if (!res.ok) throw new Error(`Wiki API ${res.status}`);
  return res.json();
}

async function listPageImages(apiBase, pageTitle) {
  const data = await wikiGet(apiBase, {
    action: "query",
    titles: pageTitle,
    prop: "images",
  });
  const page = Object.values(data.query.pages)[0];
  if (page.missing !== undefined) return null;
  return (page.images || []).map((i) => i.title);
}

async function resolveImageUrl(apiBase, fileTitle) {
  const data = await wikiGet(apiBase, {
    action: "query",
    titles: fileTitle,
    prop: "imageinfo",
    iiprop: "url|size|mime",
  });
  const page = Object.values(data.query.pages)[0];
  const info = page.imageinfo?.[0];
  if (!info?.url) return null;
  return { url: info.url, width: info.width, height: info.height, mime: info.mime };
}

function scoreFile(title, gameEntityId) {
  const name = title.replace(/^File:/i, "");
  const lower = name.toLowerCase();
  if (JUNK_RE.test(lower)) return -1000;
  if (!ZOMBIE_WORD_RE.test(lower)) return -500;
  let score = 0;
  if (/\.png$/i.test(name)) score += 80;
  else if (/\.(jpg|jpeg|webp)$/i.test(name)) score += 40;
  else return -500;
  if (PREFER_AVOID_RE.test(lower)) score -= 35;
  if (/zombie|infected|feral|screamer|wight|grace|bear|dog|vulture|swarm|demol|burn|cop|hazmat|spider|stripper|party|thug|skater|mutat|fatso|putrid|festering|departed|reanimated|plagued|bloated|walker|survivor|mother|carcass|rotting|yo/i.test(lower)) {
    score += 25;
  }
  const stem = (gameEntityId || "").replace(/^(zombie|animal)/i, "").toLowerCase();
  if (stem.length >= 4 && lower.includes(stem.slice(0, 4))) score += 30;
  if (/face|portrait|closeup/i.test(lower) && !/side/i.test(lower)) score += 20;
  if (/biome|symbol|treasure/i.test(lower)) score -= 50;
  return score;
}

function pickBestFile(files, gameEntityId, fileOverride) {
  if (fileOverride) {
    const want = fileOverride.replace(/^File:/i, "");
    const hit = files.find((f) => f.replace(/^File:/i, "").toLowerCase() === want.toLowerCase());
    if (hit) return hit;
    if (fileOverride.startsWith("File:")) return fileOverride;
  }
  const ranked = files
    .map((f) => ({ f, score: scoreFile(f, gameEntityId) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.f || null;
}

async function downloadBuffer(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "SurvivorsCodex/1.0 (fan catalog)" },
  });
  if (!res.ok) throw new Error(`Download ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function normalizeIcon(sharp, inputBuffer) {
  return sharp(inputBuffer)
    .flatten({ background: BG })
    .resize(INNER, INNER, { fit: "inside", withoutEnlargement: false })
    .extend({
      top: PAD,
      bottom: PAD,
      left: PAD,
      right: PAD,
      background: BG,
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function fetchPortraitFromWiki(source, entity, fileOverride) {
  const pageTitle = pageTitleFor(entity.id, source, wikiCfgGlobal);
  const files = await listPageImages(source.api, pageTitle);
  if (!files?.length) return null;

  const picked = pickBestFile(files, entity.entityId, fileOverride);
  if (!picked) return null;

  const meta = await resolveImageUrl(source.api, picked);
  if (!meta?.url) return null;

  return { pageTitle, picked, meta, wiki: source.id };
}

let wikiCfgGlobal = {};

async function main() {
  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    console.error("Missing dependency: run  npm install  (needs sharp in devDependencies)");
    process.exit(1);
  }

  const entities = JSON.parse(fs.readFileSync(ENTITIES_PATH, "utf8")).entities;
  wikiCfgGlobal = fs.existsSync(WIKI_CFG_PATH)
    ? JSON.parse(fs.readFileSync(WIKI_CFG_PATH, "utf8"))
    : {};
  const fileOverrides = wikiCfgGlobal.fileOverrides || {};
  const skip = new Set(wikiCfgGlobal.skip || []);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const manifest = fs.existsSync(MANIFEST_PATH)
    ? JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"))
    : { _version: new Date().toISOString().slice(0, 10) };

  const sources = {
    _comment: "Zombie portraits from 7daystodie.wiki.gg / fandom.com — normalized for catalog cards.",
    _license: "Fan wiki images; © The Fun Pimps. Personal/fan use.",
    sources: {},
  };

  let ok = 0;
  let fail = 0;

  for (const entity of entities) {
    if (skip.has(entity.id)) {
      console.log(`  ${entity.id}… skip (no wiki portrait)`);
      continue;
    }

    process.stdout.write(`  ${entity.id}… `);

    try {
      let result = null;
      for (const source of WIKI_SOURCES) {
        result = await fetchPortraitFromWiki(source, entity, fileOverrides[entity.id]);
        if (result) break;
        await new Promise((r) => setTimeout(r, 80));
      }

      if (!result) {
        console.log("✗ no portrait on wiki.gg or Fandom");
        fail++;
        continue;
      }

      const raw = await downloadBuffer(result.meta.url);
      const png = await normalizeIcon(sharp, raw);
      fs.writeFileSync(path.join(OUT_DIR, `${entity.id}.png`), png);
      manifest[entity.id] = true;
      sources.sources[entity.id] = {
        wiki: result.wiki,
        wikiPage: result.pageTitle,
        file: result.picked,
        url: result.meta.url,
        sourceWidth: result.meta.width,
        sourceHeight: result.meta.height,
      };
      console.log(`✓ [${result.wiki}] ${result.picked.replace(/^File:/, "")}`);
      ok++;
    } catch (err) {
      console.log(`✗ ${err.message}`);
      fail++;
    }

    await new Promise((r) => setTimeout(r, 250));
  }

  // Keep manifest in sync with any portraits already on disk (e.g. after rate limits).
  for (const entity of entities) {
    if (fs.existsSync(path.join(OUT_DIR, `${entity.id}.png`))) manifest[entity.id] = true;
  }

  manifest._entityIcons = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
  fs.writeFileSync(SOURCES_PATH, JSON.stringify(sources, null, 2) + "\n");

  console.log(`\nDone: ${ok} entity portraits → images/items/*.png`);
  if (fail) console.log(`${fail} entities still use procedural thumbnails.`);
  console.log("Attribution logged in data/entity-icon-sources.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
