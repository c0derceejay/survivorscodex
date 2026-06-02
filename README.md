# Survivor's Codex — 7 Days to Die Resource Index

A modern, vanilla-only field guide to every base-game resource in 7 Days to Die. Static front-end (HTML / CSS / vanilla JS) plus a tiny Express auth backend.

## Pages

- `splash.html` — landing / cinematic entry
- `index.html` — home, sign-in / create-account, featured categories
- `guide.html` — Survival 101 new-player guide (blood moon, POIs, perk order)
- `catalog.html` — searchable & filterable item grid with detail modal
- `skills.html` — interactive perk build planner (attribute + skill points)
- `builds.html` — starter templates + public community builds gallery
- `enemies.html` — enemy codex index (all vanilla zombies)
- `enemy.html` — single enemy detail profile (`?id=zombie-steve`)
- `traders.html` — trader specialties and stock by game stage
- `about.html` — what's in scope, changelog, credits
- `profile.html` — favorites, saved builds, field photos, profile settings (auth-gated)

## What lives where

- **Accounts** (username, email, bcrypt-hashed password) — server-side JSON at `var/auth.json` (gitignored)
- **Sessions** — opaque tokens in an httpOnly cookie, server-side rows in `var/auth.json`
- **Railway volume** — mount at `/app/var` (not `/app/data`; `data/` holds catalog JSON from git)
- **Skill builds** — server-side per account when signed in; guests use `localStorage` until they sign in
- **Favorites** — synced to account when signed in (`/api/favorites`); guests use `localStorage`
- **Uploaded photos** — client-side only, in `localStorage`, keyed per user
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

**Important:** Sign-in, password reset, and saved builds require the Express server. Opening HTML with Live Server, VS Code “Open with Live Preview”, or `python -m http.server` will show the site but auth API calls fail (405/501). Always use `npm start` locally or your deployed Railway URL.

Stop the server with **Ctrl + C** in that terminal. If the site still loads afterward, another Node process may still be bound to port 3000 — run `lsof -i :3000` and `kill <PID>`.

## Deploy on Railway

The repo includes `railway.json` with the recommended settings:

| Setting | Value |
|---------|--------|
| **Start command** | `node server.js` (not `npm start` — npm can swallow SIGTERM and confuse restarts) |
| **Health check** | `GET /health` |
| **Volume mount** | `/app/var` only — for `auth.json` and saved builds |

**Do not mount a volume at `/app/data`.** That replaces catalog JSON from git with an empty disk and breaks the site (or prevents boot if `build-types.json` is missing).

### If deploys restart in a loop

1. **Railway → Service → Settings → Deploy** — confirm start command is `node server.js` and health check path is `/health`.
2. **Volumes** — one volume at mount path `/app/var`. Remove any volume on `/app/data`.
3. **Logs after “listening on 8080”** — look for `[fatal]` lines (uncaught errors) or `Stopping Container` / `SIGTERM` ~30–60s later (often failed health check or memory limit).
4. **Metrics** — memory spikes on the free tier can OOM-kill the container; bump RAM if needed.
5. **Smoke test** — open `https://YOUR-APP.up.railway.app/health` — should return `{"ok":true,...}`.

Optional env vars:

| Variable | Purpose |
|----------|---------|
| `APP_BASE_URL` | Canonical site URL for password-reset and share links |
| `NODE_ENV=production` | Hides dev-only reset URLs from API responses |
| `RESEND_API_KEY` | Sends password-reset emails via [Resend](https://resend.com) |
| `EMAIL_FROM` | From address for reset emails (must be verified in Resend) |

## Password reset

When `RESEND_API_KEY` is set, reset links are emailed and never returned in the API response. Without it:

1. **Development** — reset link appears in the forgot-password success panel.
2. **Production** — generic success message only; link is logged on the server for admin recovery.

Steps:

1. Open the site via **`npm start`** (local) or your **Railway URL** (production).
2. Sign in modal → **Forgot password?** → enter your account email → **Send reset link**.
3. If the account exists, use the emailed link or dev panel link (expires in 1 hour, single use).
4. On Railway without email, check deploy logs: `[password-reset] Link for user@email.com: …`

**Admin recovery** (direct edit of `var/auth.json` on the server):

```bash
npm run auth:reset-password -- user@example.com newpassword123
```

On Railway, run that in a one-off shell against the volume mounted at `/app/var`.

## API

All endpoints accept / return JSON and use the `sdd_session` cookie.

| Method | Path           | Body                              | Notes                         |
|--------|----------------|-----------------------------------|-------------------------------|
| POST   | `/api/signup`  | `{ username, email, password }`   | 6+ char password, sets cookie |
| POST   | `/api/login`   | `{ email, password }`             | Sets cookie                   |
| POST   | `/api/logout`  | —                                 | Clears cookie + session row   |
| POST   | `/api/forgot-password` | `{ email }`               | Starts password reset (see below) |
| POST   | `/api/reset-password`  | `{ token, password }`     | Set new password from reset link |
| GET    | `/api/me`      | —                                 | Returns the signed-in user    |
| GET    | `/api/favorites` | —                               | List favorited item IDs (auth required) |
| PUT    | `/api/favorites` | `{ favorites: string[] }`       | Replace favorites (auth required, max 200) |
| GET    | `/api/builds`  | —                                 | List saved skill builds (auth required) |
| POST   | `/api/builds`  | `{ name, buildType, playerLevel, unlimited, attributes, perks }` | Save a build (auth required, max 24) |
| PUT    | `/api/builds/:id` | same fields as POST          | Update a build (auth required) |
| DELETE | `/api/builds/:id` | —                            | Delete a build (auth required) |
| GET    | `/api/builds/public` | — (query: `sort`, `type`, `q`, filters) | List public builds; `sort=trending` for trending |
| GET    | `/api/builds/public/:id` | —                        | Single public build with author + stats |
| GET    | `/api/builds/public/:id/comments` | —               | List comments on a public build |
| POST   | `/api/builds/public/:id/comments` | `{ text }` (auth) | Add comment (rate limited) |
| POST   | `/api/builds/public/:id/upvote` | — (auth)            | Toggle upvote; returns `{ upvoted, upvoteCount }` |
| POST   | `/api/builds/public/:id/copy` | —                     | Increment copy counter (planner / save copy) |
| GET    | `/api/users/:username/profile` | —                    | Public profile + shared builds |
| PUT    | `/api/profile` | `{ bio?, profilePublic? }` (auth) | Update bio and profile visibility |

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
| `npm run icons:traders` | Download trader portrait PNGs from wiki.gg for the trader reference page |
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

Saved builds sync to your account when signed in (via `/api/builds`). **Favorites** sync the same way (`/api/favorites`) — guest favorites merge on sign-in. Each build can be tagged with a **focus** (horde, PvP, crafting, etc.) — see `data/build-types.json`. Expanded builds show **perk gear** (craft unlocks with icons/stats) and **armor outfit sets** (Miner, Ranger, Farmer, etc.) via `data/perk-gear.json` — regenerate with `npm run gear:build`. Guests keep builds in `localStorage` until they sign in.

Starter presets live in `skills.json` under `presets[]`. Load via the planner UI or `skills.html?preset=first-week-miner`.

## Attribution

Site footers credit:

- **Item icons** — [tassoneroberto/7dtd-assets](https://github.com/tassoneroberto/7dtd-assets)
- **Zombie portraits** — [7daystodie.wiki.gg](https://7daystodie.wiki.gg) and [7daystodie.fandom.com](https://7daystodie.fandom.com/wiki/7_Days_to_Die_Wiki)

7 Days to Die is © The Fun Pimps. This is an unofficial fan project, not affiliated with or endorsed by them.

## Scope

Everything in the catalog is acquirable in the unmodded base game (craft / loot / buy). No mods, console-only items, or overhauls. Wildlife (bear, wolf, etc.) is excluded; undead animals (dog, bear, vulture) and insect swarms tied to zombies are included where they appear in the vanilla zombie list.
