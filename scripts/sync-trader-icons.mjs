#!/usr/bin/env node
/**
 * Downloads trader portrait PNGs from 7daystodie.wiki.gg and normalizes them
 * for the trader reference page.
 *
 * Run: npm run icons:traders
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "images/traders");
const SOURCES_PATH = path.join(ROOT, "data/trader-icon-sources.json");

const WIKI_API = "https://7daystodie.wiki.gg/api.php";

const TRADERS = [
  { id: "rekt", wikiPage: "Trader_Rekt", portraitFile: "RektPortrait.png" },
  { id: "jen", wikiPage: "Trader_Jen", portraitFile: "JenPortrait.png" },
  { id: "bob", wikiPage: "Trader_Bob", portraitFile: "BobPortrait.png" },
  { id: "hugh", wikiPage: "Trader_Hugh", portraitFile: "HughPortrait.png" },
  { id: "joel", wikiPage: "Trader_Joel", portraitFile: "JoelPortrait.png" },
];

const WIDTH = 200;
const HEIGHT = 240;
const PAD = 12;
const BG = { r: 22, g: 21, b: 26, alpha: 1 };

async function wikiGet(params) {
  const url = `${WIKI_API}?${new URLSearchParams({ format: "json", ...params })}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "SurvivorsCodex/1.0 (fan catalog; local dev)" },
  });
  if (!res.ok) throw new Error(`Wiki API ${res.status}`);
  return res.json();
}

async function resolveImageUrl(fileTitle) {
  const data = await wikiGet({
    action: "query",
    titles: fileTitle,
    prop: "imageinfo",
    iiprop: "url",
  });
  const page = Object.values(data.query.pages)[0];
  return page?.imageinfo?.[0]?.url || null;
}

async function downloadBuffer(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "SurvivorsCodex/1.0 (fan catalog)" },
  });
  if (!res.ok) throw new Error(`Download ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    console.error("Missing dependency: run npm install (needs sharp)");
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const sources = {
    _comment: "Trader portraits from 7daystodie.wiki.gg — normalized for trader reference page.",
    _license: "Fan wiki images; © The Fun Pimps. Personal/fan use.",
    _source: "https://7daystodie.wiki.gg/wiki/Traders",
    traders: {},
  };

  for (const trader of TRADERS) {
    process.stdout.write(`  ${trader.id}… `);
    try {
      const fileTitle = `File:${trader.portraitFile}`;
      const url = await resolveImageUrl(fileTitle);
      if (!url) throw new Error(`No URL for ${fileTitle}`);

      const raw = await downloadBuffer(url);
      const innerW = WIDTH - PAD * 2;
      const innerH = HEIGHT - PAD * 2;
      const png = await sharp(raw)
        .flatten({ background: BG })
        .resize(innerW, innerH, { fit: "inside", withoutEnlargement: false })
        .extend({
          top: PAD,
          bottom: PAD,
          left: PAD,
          right: PAD,
          background: BG,
          extendWith: "background",
        })
        .png({ compressionLevel: 9 })
        .toBuffer();

      const outName = `${trader.id}.png`;
      fs.writeFileSync(path.join(OUT_DIR, outName), png);
      sources.traders[trader.id] = {
        file: outName,
        wikiPage: trader.wikiPage,
        portraitFile: fileTitle,
        sourceUrl: url.split("?")[0],
        wiki: "7daystodie.wiki.gg",
      };
      console.log("ok");
    } catch (err) {
      console.log(`fail (${err.message})`);
    }
  }

  fs.writeFileSync(SOURCES_PATH, JSON.stringify(sources, null, 2) + "\n");
  console.log(`Wrote ${Object.keys(sources.traders).length} portraits to images/traders/`);
}

main();
