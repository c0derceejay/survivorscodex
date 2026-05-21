# Survivor's Codex — 7 Days to Die Resource Index

A modern, vanilla-only field guide to every base-game resource in 7 Days to Die. Static front-end (HTML / CSS / vanilla JS) plus a tiny Express auth backend.

## Pages

- `splash.html` — landing / cinematic entry
- `index.html` — home, sign-in / create-account, featured categories
- `guide.html` — Survival 101 new-player guide (blood moon, POIs, perk order)
- `catalog.html` — searchable & filterable item grid with detail modal
- `skills.html` — interactive perk build planner (attribute + skill points)
- `about.html` — what's in scope, what isn't, credits
- `profile.html` — favorites and field-photo gallery (auth-gated)

## What lives where

- **Accounts** (username, email, bcrypt-hashed password) — server-side JSON at `data/auth.json` (gitignored)
- **Sessions** — opaque tokens in an httpOnly cookie, server-side rows in `data/auth.json`
- **Skill builds** — server-side per account when signed in; guests use `localStorage` until they sign in
- **Favorites & uploaded photos** — client-side only, in `localStorage`, keyed per user
- **Catalog data** — `data/items.json` (~495 entries: craftables + zombies)
- **Zombie definitions** — `data/entities.json` (36 vanilla zombies, aligned with the [official wiki list](https://7daystodie.wiki.gg/wiki/List_of_Zombies))
- **Item icons** — `images/items/*.png` + `images/manifest.json`
- **Zombie portraits** — same folder; synced from community wikis (see below)

## Run it

Requires Node 18+.

```bash
npm install
npm start
```

Then open http://localhost:3000 — the root redirects to `splash.html`.

Stop the server with **Ctrl + C** in that terminal. If the site still loads afterward, another Node process may still be bound to port 3000 — run `lsof -i :3000` and `kill <PID>`.

## API

All endpoints accept / return JSON and use the `sdd_session` cookie.

| Method | Path           | Body                              | Notes                         |
|--------|----------------|-----------------------------------|-------------------------------|
| POST   | `/api/signup`  | `{ username, email, password }`   | 6+ char password, sets cookie |
| POST   | `/api/login`   | `{ email, password }`             | Sets cookie                   |
| POST   | `/api/logout`  | —                                 | Clears cookie + session row   |
| GET    | `/api/me`      | —                                 | Returns the signed-in user    |
| GET    | `/api/builds`  | —                                 | List saved skill builds (auth required) |
| POST   | `/api/builds`  | `{ name, buildType, playerLevel, unlimited, attributes, perks }` | Save a build (auth required, max 24) |
| PUT    | `/api/builds/:id` | same fields as POST          | Update a build (auth required) |
| DELETE | `/api/builds/:id` | —                            | Delete a build (auth required) |

## Catalog & zombies

The catalog is built from the community [7dtd-assets](https://github.com/tassoneroberto/7dtd-assets) icon index plus `data/entities.json` for enemies.

| Script | What it does |
|--------|-------------|
| `npm run catalog:build` | Rebuild `data/items.json` from assets + entities; prune legacy zombie PNGs |
| `npm run gear:build` | Build `data/perk-gear.json` — armor outfit sets + perk → item links for builds |
| `npm run catalog:refresh` | `catalog:build` → `gear:build` → `stats:generate` → `icons:refresh` (full data + item icons) |
| `npm run stats:generate` | Regenerate `data/item-stats.json` from items |
| `npm run icons:refresh` | Rebuild `data/icon-map.json` and download craftable item PNGs |
| `npm run icons:entities` | Download & normalize zombie portraits from wikis (needs `sharp`) |
| `npm run icons:all` | `icons:refresh` then `icons:entities` |

**Zombie list:** 36 in-game vanilla types only (current V1.0 / [wiki.gg](https://7daystodie.wiki.gg/wiki/List_of_Zombies)). Legacy Fandom-only lore names (e.g. Putrid Girl, Festering Cadaver) are not separate catalog entries — they map to in-game names like Zombie Arlene, Zombie Joe, etc.

**Zombie images:** `npm run icons:entities` tries [7daystodie.wiki.gg](https://7daystodie.wiki.gg) first (matches in-game page titles), then [Fandom](https://7daystodie.fandom.com/wiki/List_of_Zombies) as fallback. Page and file picks are tuned in `data/entity-wiki-pages.json`; attribution is logged in `data/entity-icon-sources.json`. Insect Swarm has no wiki portrait and uses a procedural thumbnail.

**Item images:** ~459 craftable icons from `7dtd-assets` via `icons:refresh`. Items without a PNG keep procedural SVG thumbnails in the UI.

To rebuild `images/manifest.json` from files already on disk (e.g. after a partial sync):

```bash
node scripts/rebuild-manifest.mjs
```

### Optional: icons from your game install

1. In-game console (`F1`): `exportitemicons`
2. `npm run icons:sync -- "/path/to/7 Days To Die/ItemIcons"`

## Adding or editing catalog entries

**Craftables:** Prefer updating the build pipeline (`data/github-icons-v2.1.json`, `scripts/build-full-catalog.mjs`) rather than hand-editing hundreds of rows. For one-offs, edit `data/items.json`:

```json
{
  "id": "unique-slug",
  "name": "Display Name",
  "category": "weapons-melee",
  "tier": 2,
  "stack": 1,
  "weight": 2,
  "summary": "One-line description.",
  "ingredients": ["Wood", "Forged Iron"],
  "perk": "Perk that boosts it",
  "uses": ["Use case 1", "Use case 2"]
}
```

**Zombies:** Edit `data/entities.json`, then `npm run catalog:build` and `npm run icons:entities`.

Categories live at the top of `data/items.json`.

## Skills planner

Edit `data/skills.json` to add or tune perk trees. Each attribute has perks with `levels[]` (effect text + optional `craftTier`). Use `catalogPerk` when the in-game perk name differs from the display name (e.g. `Miner 69'er` → `Miner 69er` in items).

Saved builds sync to your account when signed in (via `/api/builds`). Each build can be tagged with a **focus** (horde, PvP, crafting, etc.) — see `data/build-types.json`. Expanded builds show **perk gear** (craft unlocks with icons/stats) and **armor outfit sets** (Miner, Ranger, Farmer, etc.) via `data/perk-gear.json` — regenerate with `npm run gear:build`. Guests keep builds in `localStorage` until they sign in.

Starter presets live in `skills.json` under `presets[]`. Load via the planner UI or `skills.html?preset=first-week-miner`.

## Attribution

Site footers credit:

- **Item icons** — [tassoneroberto/7dtd-assets](https://github.com/tassoneroberto/7dtd-assets)
- **Zombie portraits** — [7daystodie.wiki.gg](https://7daystodie.wiki.gg) and [7daystodie.fandom.com](https://7daystodie.fandom.com/wiki/7_Days_to_Die_Wiki)

7 Days to Die is © The Fun Pimps. This is an unofficial fan project, not affiliated with or endorsed by them.

## Scope

Everything in the catalog is acquirable in the unmodded base game (craft / loot / buy). No mods, console-only items, or overhauls. Wildlife (bear, wolf, etc.) is excluded; undead animals (dog, bear, vulture) and insect swarms tied to zombies are included where they appear in the vanilla zombie list.
