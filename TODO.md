# TODO

Running list of follow-ups. Newest item at the top.

---

## Mod preview videos — needs a hosting strategy

**Date opened:** 2026-06-18

**Problem.** GitHub rejects any file over 100 MB. Mod preview videos (e.g. `videos/remote-inventory-tablet-v2.mp4`, 288 MB) exceed that limit and cannot be committed. Compressing to fit under 100 MB pixelates the clip too much to be useful.

**Current workaround.** The file is gitignored and the corresponding mod entry in `data/mods.json` has `videoSrc: ""` so the card renders the "No preview" empty state instead of a broken `<video>`. The original full-quality file still lives in the local `videos/` folder.

**What to decide next.** Pick one of:

1. **Git LFS.** Track `videos/*.mp4` via Git LFS. Pros: keeps the "drop file + commit" workflow. Cons: GitHub free tier caps LFS at 1 GB storage and 1 GB/month bandwidth across all clones and Railway deploys; will likely need a paid bandwidth pack within a few mods.
2. **External hosting (S3, R2, Bunny, etc.).** Upload mod clips to a CDN, set `videoSrc` in `mods.json` to the `https://…` URL. Pros: scales cheaply, fast playback worldwide. Cons: one more service to manage and pay for.
3. **YouTube / Vimeo embed.** Replace the `<video>` element on the Mods card with an `<iframe>` embed. Pros: free, familiar UX. Cons: changes the card layout and brings in a third-party player and analytics.

**When picked, also:**

- Restore the `videoSrc` on the affected mod entries in `data/mods.json`.
- Document the chosen workflow in `videos/README.md` so future mods follow the same path.
- Remove the specific `videos/remote-inventory-tablet-v2.mp4` line from `.gitignore` only if Option 1 is chosen.
