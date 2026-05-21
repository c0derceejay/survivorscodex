#!/usr/bin/env node
/**
 * Copy 7D2D item icons (from `exportitemicons` console command) into images/items/.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "images", "items");
const MANIFEST_PATH = path.join(ROOT, "images", "manifest.json");

function existsDir(p) {
  try {
    return fs.existsSync(p) && fs.statSync(p).isDirectory();
  } catch (_) {
    return false;
  }
}

/** Common macOS / Windows install roots (ItemIcons may not exist until exportitemicons). */
function candidatePaths() {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  const list = [];

  if (process.platform === "darwin") {
    list.push(
      path.join(home, "Library/Application Support/Steam/steamapps/common/7 Days To Die/ItemIcons"),
      path.join(home, "Library/Application Support/Steam/steamapps/common/7DaysToDie/ItemIcons"),
      "/Applications/7 Days to Die/ItemIcons",
      path.join(home, "Games/7 Days To Die/ItemIcons")
    );
    // Steam Library folders (libraryfolders.vdf)
    const steamRoot = path.join(home, "Library/Application Support/Steam");
    const libVdf = path.join(steamRoot, "steamapps/libraryfolders.vdf");
    if (fs.existsSync(libVdf)) {
      const text = fs.readFileSync(libVdf, "utf8");
      const paths = [...text.matchAll(/"path"\s+"([^"]+)"/g)].map((m) => m[1].replace(/\\\\/g, "\\"));
      for (const lib of paths) {
        list.push(path.join(lib, "steamapps/common/7 Days To Die/ItemIcons"));
      }
    }
  }

  if (process.platform === "win32") {
    const pf = process.env.ProgramFiles || "C:\\Program Files";
    const pf86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
    list.push(
      path.join(pf86, "Steam/steamapps/common/7 Days To Die/ItemIcons"),
      path.join(pf, "Steam/steamapps/common/7 Days To Die/ItemIcons"),
      "C:\\Games\\7 Days To Die\\ItemIcons"
    );
  }

  if (process.env.SEVEN_DTD_ITEM_ICONS) {
    list.unshift(process.env.SEVEN_DTD_ITEM_ICONS);
  }

  return list;
}

function findItemIconsDir() {
  for (const p of candidatePaths()) {
    if (existsDir(p)) return p;
  }
  // Game folder without ItemIcons yet?
  for (const p of candidatePaths()) {
    const gameDir = path.dirname(p);
    if (existsDir(gameDir)) return { gameDir, missingItemIcons: true };
  }
  return null;
}

function syncFrom(sourceDir) {
  const iconMap = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "icon-map.json"), "utf8"));
  const sourceFiles = fs.readdirSync(sourceDir).filter((f) => /\.png$/i.test(f));

  if (!sourceFiles.length) {
    console.error("\nItemIcons folder exists but has no PNG files.");
    console.error("In-game: F1 → exportitemicons (admin/creative may be required), then run this script again.\n");
    process.exit(1);
  }

  const byLower = new Map(sourceFiles.map((f) => [f.replace(/\.png$/i, "").toLowerCase(), f]));
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const manifest = {};
  let copied = 0;
  let missing = 0;

  for (const [itemId, gameName] of Object.entries(iconMap)) {
    if (itemId.startsWith("_")) continue;
    const key = String(gameName).toLowerCase();
    let file = byLower.get(key);
    if (!file) {
      const partial = sourceFiles.find((f) =>
        f.replace(/\.png$/i, "").toLowerCase().includes(key)
      );
      if (partial) file = partial;
    }
    if (!file) {
      console.warn("  missing:", itemId, "→", gameName);
      missing++;
      continue;
    }
    fs.copyFileSync(path.join(sourceDir, file), path.join(OUT_DIR, `${itemId}.png`));
    manifest[itemId] = true;
    copied++;
    console.log("  ✓", itemId);
  }

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`\nDone: ${copied} icons copied, ${missing} not found in source.`);
  console.log("Manifest:", MANIFEST_PATH);
}

// --- CLI ---
let sourceDir = process.argv[2];

if (!sourceDir) {
  const found = findItemIconsDir();
  if (typeof found === "string") {
    sourceDir = found;
    console.log("Auto-detected ItemIcons:\n ", sourceDir, "\n");
  } else if (found?.missingItemIcons) {
    console.error(`
Found 7 Days to Die at:
  ${found.gameDir}

But there is no ItemIcons folder yet.

In-game (on the machine where the game is installed):
  1. Press F1 to open the console
  2. Run: exportitemicons
  3. Icons are created in: ${path.join(found.gameDir, "ItemIcons")}

Then run:
  npm run icons:sync -- "${path.join(found.gameDir, "ItemIcons")}"
`);
    process.exit(1);
  }
}

if (!sourceDir) {
  console.error(`
Could not find ItemIcons on this computer.

The folder is only created AFTER you run exportitemicons in-game.
It is not shipped with the game install by default.

Steps:
  1. On the PC/Mac where you PLAY 7 Days to Die, open console (F1)
  2. Run: exportitemicons
  3. Find the folder (usually next to the game .exe):
       Steam (Mac):  ~/Library/Application Support/Steam/steamapps/common/7 Days To Die/ItemIcons
       Steam (Win):  .../steamapps/common/7 Days To Die/ItemIcons
  4. Copy that entire ItemIcons folder to this Mac, OR run sync on that machine
  5. Point this script at it:

     npm run icons:sync -- "/full/path/to/ItemIcons"

Or set an env var:
  export SEVEN_DTD_ITEM_ICONS="/path/to/ItemIcons"
  npm run icons:sync

Checked paths (none had ItemIcons):
${candidatePaths().map((p) => "  - " + p).join("\n")}
`);
  process.exit(1);
}

if (!existsDir(sourceDir)) {
  console.error("Source folder not found:\n ", sourceDir);
  console.error(`
If the game is on another computer:
  - Run exportitemicons there, zip the ItemIcons folder, copy it here
  - Then: npm run icons:sync -- "/path/to/unzipped/ItemIcons"
`);
  process.exit(1);
}

syncFrom(sourceDir);
