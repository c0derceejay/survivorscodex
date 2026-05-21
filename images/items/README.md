# Item icons

## Option A — GitHub (no game install needed)

Icons come from [tassoneroberto/7dtd-assets](https://github.com/tassoneroberto/7dtd-assets) (community-extracted vanilla assets, `v2.1` by default):

```bash
npm run icons:github
```

Refresh the catalog. Mapped items are listed in `data/icon-map.json`.

## Option B — Your own game export

1. In-game: **F1** → `exportitemicons`
2. Copy `ItemIcons` from your Steam folder
3. `npm run icons:sync -- "/path/to/ItemIcons"`

## Notes

- Icons are game assets © The Fun Pimps. The GitHub repo is a fan extraction; use for reference / personal fan projects.
- `steel-shovel` reuses the iron shovel icon (no separate file in `v2.1`).
- `stone` and `small-stone` share `resourceRockSmall.png`.
- Fandom [GUI Icon Images](https://7daystodie.fandom.com/wiki/Category:GUI_Icon_Images) only has ~45 UI symbols — not full item icons. The GitHub repo is much better for catalog coverage.
