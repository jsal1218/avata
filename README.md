# Avata — Lookbook, Styles & Showcase

Free, installable mobile web app (PWA) for the back office of a clothing factory: store model references, a styles catalog
and imported outfit mockups, and show them to buyers in a clean full-screen showcase. Static site, no build step, no
server, no paid services. Live: https://jsal1218.github.io/avata/

## Sections
- **Lookbook** — every imported mockup in a masonry grid; collection cards; search (style, SKU, model, colour, tag);
  filters (collection, category, status, model, view, tag, favorites, unlinked); sort. Bulk import from Photos/Files,
  link each batch to a model + styles + colorway + view (auto-guessed: square → sheet, portrait → front). Look viewer
  with side-by-side / wipe compare against the model reference, edit links, share/save, favorite.
- **Showcase** — full-screen swipe lookbook per collection, style, model or any filtered set. Shows style name, SKU,
  colorway, composition, sizes and model height/size. **Never shows status, cost, price, supplier or notes.**
- **Styles** — SKU/style no., name, collection, season, category, fabric, composition, colorways, sizes (XXS–XXL, US 0–16),
  factory status (Concept → Sampling → Approved → In production → Shipped / Archived), supplier/line notes, cost, price
  (margin shown), tags, photos (flat lays, tech sketches). Status bar with counts; detail page shows all mockups grouped
  by model; quick status change; CSV export.
- **Models** — front/back reference sheets (auto-split), height (ft/in ⇄ cm), body type, size, measurements.
  Six starter models bundled (5′3″ / 160 cm, measurements marked estimated).
- **360** — make a spin of a model from your own photos: tap **New 360**, pick several photos from different angles
  (multi-select from Photos) or one short turnaround video, done. Everything runs on the phone with the exact pixels — no AI,
  no uploads, nothing generated. Photos are auto-ordered (filename order when names are numbered, else picked order; drag to
  reorder, or Reverse), auto-aligned (subject found against the corner-sampled background colour, edge fallback; every frame
  scaled to the same subject height and feet line, centred on one uniform canvas), and sparse sets (e.g. front/side/back)
  crossfade between neighbouring real frames while spinning. Video: evenly spaced frames (12–36) are pulled in the browser.
  Viewer (ported from the Atelier 360 gallery): drag/swipe with inertia, auto-rotate, angle dial, pinch/wheel/double-tap zoom
  to 5× using the full-resolution aligned frames. Spins are saved in IndexedDB, appear in the model switcher next to the
  gallery models (read from `../model-gallery/` when available), and can be renamed or deleted. Not included in backups yet.
- **Prompt builder** (from a style or model) — builds a ready-to-use, identity-locked prompt (height, size, measurements,
  fabric physics, realism, lighting, camera, view) to copy for the assistant, and shares the numbered reference images.
  Free; nothing is sent anywhere.
- **Settings → Data** — export the whole library as one `.zip` (library.json + images) or one `.json`, import (merge or
  replace) on another device, export styles CSV, remove/add sample data. Backups never include keys or settings.
- **Settings → Advanced (collapsed, off by default)** — *Bring your own API key (billed by provider)*: optional in-app
  generation via fal.ai / Google Gemini. While off, the app makes no requests to any third-party service.

Sample styles (`SAMPLE-001…003`) and sample looks are clearly labelled and reuse the reference sheets; remove them in
Settings → Data.

## Files
`js/app.js` (boot/router), `js/store.js` (IndexedDB data layer, filters), `js/looks.js` (lookbook, import, viewer,
showcase), `js/styles-view.js` (catalog), `js/models-view.js`, `js/studio.js` (prompt builder + optional BYOK),
`js/settings-view.js`, `js/spin-view.js` (360 tab), `js/spin-viewer.js` (viewer), `js/spin-build.js` (ordering, video frames,
alignment), `js/spin-core.js` (pure maths, unit-tested), `js/backup.js` (zip/json/csv), `js/prompt.js`, `js/providers.js`, `js/imaging.js`, `js/db.js`,
`js/ui.js`, `js/update.js` (auto-update), `js/starters.js`, `sw.js`, `manifest.webmanifest`.
Tests: `npm test` (request shapes, zip round-trip, CSV). Smoke test + screenshots: `python3 tools/e2e_v2.py [url]`;
360 e2e: `python3 tools/e2e_spin.py [url]` (serve the parent folder so `../model-gallery/` resolves).

## Deploy
Push to `main`; GitHub Pages serves the repo root.

**Versioning is automatic.** A pre-commit hook (`.githooks/pre-commit`) stamps a fresh timestamp version
(`YYYY.MM.DD-HHMMSS-<sha>`, UTC) into `sw.js`, `js/app.js` and anywhere else the old version string appears, on every
commit. Enable it once per clone: `git config core.hooksPath .githooks`. Don't edit `VERSION` by hand.

**Updates reach installed copies in seconds** (`js/update.js`, same approach as the Dash hub): the service worker is
registered with `updateViaCache: 'none'` and checked on load, whenever the app returns to the foreground and every 60 s
while open. Same-origin HTML/JS/CSS/JSON/manifest are network-first (cache only when offline); large images/fonts are
cache-first; cross-origin requests are never touched. A new worker takes over immediately (`skipWaiting` +
`clients.claim`) and the page reloads itself if it's hidden or idle. If you're mid-task (360 build, generation, save,
file picker, open sheet, unsaved edit, typing) it shows "Updated, tap to reload" and reloads the next time the app comes
back from the background. Long tasks register with `holdWork()` from `js/ui.js`.
Update e2e: `python3 tools/e2e_update.py` (serves a temp copy, deploys new versions, checks reload / toast / no loops).
Starter re-sync e2e: `python3 tools/e2e_starters.py` (installs the previous release, adds user edits, deploys this tree, checks starter images refresh while user data is untouched, newly shipped starters are added once, and deleted starters stay deleted).

**Changing a starter's images:** replace `assets/models/<file>-*.webp`, then set that starter's `assetRev` in `js/starters.js` (`npm test` prints the expected hash). Installed copies refresh only that starter's images on next launch; renames, notes, measurements, user models and looks are kept.

**Adding a starter:** add its four images (Model 1's sizes: sheet 1500×1500, front 1025×1536, back 1023×1535, thumb 360×539 WebP; built with `/workspace/shared/model-gallery/tools/build_avata.py --model N` → `exact-N-*.webp`), append it to `STARTERS` with its `assetRev`, and add the files to the `SHELL` list in `sw.js`. Existing installs get it once on next launch (`addNewStarters`): kv `knownStarters` records every starter id an install has been given, so a starter the user deleted is never re-added. Sample looks are limited to Photoreal 1 (Model 1's went with her). Starter ids are stable (`starter-exact-N` for the exact-reference Model N, `starter-photoreal-N` for AI-photoreal models, shown in their own 360 row); `renumberStarters()` maps the pre-2026-10-18 `starter-model-N` ids once per install.

**Removed starters (2026-10-18):** Models 1-4, 8, 11, 15 and 16 were removed at Jordan's request; the rest were then renumbered Model 1-8 by display name only (stable ids `starter-exact-5, 6, 7, 9, 10, 12, 13, 14`; `relabelStarters()` with the `RELABEL` map renames default-named records once, user names kept), and `starter-exact-17` was added as Model 9. Order: Model 1-14, then Photoreal 1, then Generated 1, Generated 2. New exact starters take the next unused id (exact-18, ...), never a removed one. `removeStarters()` (store.js, list `REMOVED_STARTER_IDS` in starter-sync.js) deletes their starter records once per install (also after importing an older backup), removes their app-seeded sample looks, keeps the user's own looks of them (detached), never touches user-created models, and records the ids as known so nothing re-adds them. To remove another starter, add its id there, drop it from `STARTERS` and `sw.js`, and bump the kv flag name in `removeStarters()` so existing installs run it again.

**Models 10-14 (2026-10-18):** `starter-exact-18..22` (labels Model 10-14, after Model 9), each with its assetRev and in the `sw.js` precache; existing installs gain them once. Model 14 is a male model (the Studio prompt text still assumes a woman in the grey crop set).

**Generated 2 (2026-10-18):** `starter-generated-2` (Generated section, after Generated 1), a generated model with two built-in outfits (Base, Yoga set; `outfits[]`, files `generated-2-*` and `generated-2-yoga-set-*`). Her assetRev covers both outfits; existing installs gain her once via `addNewStarters`; both file sets are in the `sw.js` precache. The 360 chip label width was widened slightly (max 72px) so "Generated 2" is not cut off on a phone.

**Generated 3 and Photoreal 2 (2026-10-19):** `starter-generated-3` (Generated section, after Generated 2) is Model 2 (pink hair; `starter-exact-6` unchanged) in four built-in outfits: Base (her grey sheet), Turtleneck, Slip dress, Tank & shorts (all black; files `generated-3`, `generated-3-turtleneck`, `generated-3-slip-dress`, `generated-3-tank-shorts`). `starter-photoreal-2` (Photorealistic section, after Photoreal 1) is the same model: a separate starter record that points at the same files and `assetRev` (no duplicate images). Both are added once to existing installs via `knownStarters`.

**Model 1 outfit + Photorealistic section removed (2026-10-19):** `starter-exact-5` (Model 1) gains a second built-in outfit on her own record, Tank & shorts (`outfits[]`: Base `exact-5`, Tank & shorts `exact-5-tank-shorts`; assetRev bumped, so existing installs refresh her in place and keep the user's edits). The Photorealistic section was removed: `starter-photoreal-1` and `starter-photoreal-2` are in `REMOVED_STARTER_IDS`, so `removeStarters()` (second round, kv `removed-starters-2026-10-19`) drops their starter records once, removes Photoreal 1's app-seeded sample looks, keeps the user's own looks detached, and never re-adds them. User models are untouched. Photoreal 1's images are archived outside the repo; Generated 3 keeps the files Photoreal 2 shared. The 360 tab has no Photorealistic row; old `gallery:photoreal-*` / `gallery:model-2` links fall back to Model 1.

**Yoga / Linen outfits and Models 15-16 (2026-10-19):** Model 1 (`starter-exact-5`) gains Yoga set (`exact-5-yoga-set`, after Generated 2's) and Linen set (`exact-5-linen-set`, after Generated 1's): outfits Base, Tank & shorts, Yoga set, Linen set; assetRev a1d4c39dc847. Model 2 (`starter-exact-6`) gains `outfits[]` Base + Yoga set (`exact-6-yoga-set`); assetRev d833e5ca404f. Existing installs refresh both in place via `refreshedModel` (names and edits kept). New exact starters `starter-exact-23` (Model 15, curly brown hair, grey set) and `starter-exact-24` (Model 16, burgundy/pink hair, glasses, pink set) follow Model 14; existing installs gain them once (ids 15/16 stay retired). All new files are in the `sw.js` precache. e2e scenario K covers the upgrade from the c217703 release.

**Model 17 (2026-10-20):** `starter-exact-25` (Model 17, long straight platinum hair, grey racerback set) after Model 16, with two built-in outfits: Base (`exact-25`) and Red dress (`exact-25-red-dress`); assetRev 5eb22514a354; existing installs gain her once; precached in `sw.js`. Leather catsuit and Tech suit were deferred (references kept in the gallery's reference/).
