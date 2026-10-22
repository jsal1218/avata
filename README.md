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

**Model 17 (2026-10-20):** `starter-exact-25` (Model 17, long straight platinum hair, grey racerback set) after Model 16, with two built-in outfits: Base (`exact-25`) and Red dress (`exact-25-red-dress`); assetRev 5eb22514a354; existing installs gain her once; precached in `sw.js`.

**Model 17 outfits + Model 13 outfits (2026-10-20):** Model 17 (`starter-exact-25`) now has Base, Red dress, Leather catsuit (`exact-25-leather-catsuit`), Tech suit (`exact-25-tech-suit`); assetRev 6f8c36180b7e. Model 13 (`starter-exact-21`) gains Beige Linen (`exact-21-beige-linen`) and A (`exact-21-a`), both from Jordan's own 6-view sheets (no generation); assetRev 86e0dd266c1e. Existing installs refresh both in place with edits kept (e2e scenario L, from f2c6373).

**Model 1 Red dress (2026-10-20):** `starter-exact-5` gains Red dress (`exact-5-red-dress`, the same dress as Model 17, generated on her own sheet): outfits Base, Tank & shorts, Yoga set, Linen set, Red dress; assetRev 51325ea83e03; existing installs refresh her in place, edits kept (e2e scenario M, from a20674e).

**Model 2 + Generated 3 outfits (2026-10-21):** `starter-exact-6` (Model 2) gains Generated 3's Turtleneck, Slip dress and Tank & shorts (Generated 3 is the same woman; files `generated-3-*` are reused, no duplicates): outfits Base, Yoga set, Turtleneck, Slip dress, Tank & shorts; assetRev 2be37db713de; Generated 3 unchanged; existing installs refresh her in place, edits kept (e2e scenario N, from a1a2db9).

**Model 2 USA jersey (2026-10-21):** `starter-exact-6` gains USA jersey (`exact-6-usa-jersey`, USA home kit generated on her own sheet) after Tank & shorts: Base, Yoga set, Turtleneck, Slip dress, Tank & shorts, USA jersey; assetRev 40a08b9f6a2a; precached in `sw.js`; existing installs refresh her in place, edits kept (e2e scenario O, from bbd088a). Generated 3 unchanged.

**Generated section removed (2026-10-21, Jordan):** Generated 1-3 (`starter-generated-1..3`) are no longer shipped, and the 360 tab's Generated row (and its heading) is gone. Existing installs drop their starter records once, even if renamed (`removeStarters`, flag `removed-starters-2026-10-21`). The user's own looks on them are kept but detached (no model), user models are untouched, and the ids stay in knownStarters so they are never re-added. Model 2 keeps Generated 3's Turtleneck, Slip dress and Tank & shorts as her own copies (`exact-6-{turtleneck,slip-dress,tank-shorts}`, same bytes, assetRev unchanged). The `generated-*` images and the old starter entries are archived in the gallery's `work/removed-models/` (e2e scenario P, from 2dcfa92).

**Model 18 (2026-10-21):** `starter-exact-26` (Model 18, long wavy blonde hair, grey crop set) after Model 17, from Jordan's own 6-view sheet (no generation); assetRev b2521b3e10cc; existing installs gain her once; precached in `sw.js`. She ships with Base first; her outfits (Outfit 1-7, also Jordan's own sheets) are added in later releases and refresh her in place (assetRev bump, edits kept).

**Model 18 outfits, batch 1 (2026-10-21):** `starter-exact-26` gains Outfit 1-4 (`exact-26-outfit-1..4`, Jordan's own sheets): outfits Base, Outfit 1-4; assetRev b4e9d6f5039b; existing installs (Base only) refresh her in place, edits kept.

**Model 18 outfits, batch 2 (2026-10-21):** `starter-exact-26` gains Outfit 5-7 (`exact-26-outfit-5..7`, Jordan's own sheets): outfits Base, Outfit 1-7; assetRev 118b7cdbb414; existing installs (Base only, or Base + Outfit 1-4) refresh her in place, edits kept.

**Model 18 Outfit 8 (2026-10-21):** `starter-exact-26` gains Outfit 8 (`exact-26-outfit-8`, dark grey cami, faded wide jeans, shoulder bag on her left shoulder; back view mirrored so the bag is on her left): outfits Base, Outfit 1-8; assetRev 020b48cbe49d; existing installs refresh her in place, edits kept.

**Model 18 Outfits 9-10 (2026-10-21):** `starter-exact-26` gains Outfit 9 and Outfit 10 (Jordan's own sheets): outfits Base, Outfit 1-10; assetRev 2bf088ab4314; existing installs refresh her in place, edits kept. 360 view: 10+ outfit chips sit in exactly two rows on phones (sideways scroll only if they overflow).

**Model 18 Outfits 11-12 (2026-10-21):** `starter-exact-26` gains Outfit 11 and Outfit 12 (Jordan's own sheets): outfits Base, Outfit 1-12; assetRev 30baf6de2226; existing installs refresh her in place, edits kept.

**Model 18 Outfit 13 (2026-10-21):** `starter-exact-26` gains Outfit 13 (chef whites; Jordan's own sheet): outfits Base, Outfit 1-13; assetRev 27dc7c2d90ed; existing installs refresh her in place, edits kept.

**Model 18 Outfits 14-15 (2026-10-21):** `starter-exact-26` gains Outfit 14 (light blue satin short robe) and Outfit 15 (black crop tank + pink satin shorts), both Jordan's own sheets: outfits Base, Outfit 1-15; assetRev ee76fe5dcc22; existing installs refresh her in place, edits kept. 360 outfit chips with 10+ outfits use a dense two-row grid (no swatch, 9.5px).

**Model 18 Outfit 16 + Outfit 14 tie fix (2026-10-21):** `starter-exact-26` gains Outfit 16 (grey tie-dye oversized tee + grey shorts; Jordan's own sheet): outfits Base, Outfit 1-16; assetRev b4b3f89abcad; existing installs refresh her in place, edits kept. Outfit 14's 315° frame (gallery manifest) now has the robe tie on her left like every other angle.

**Removed Models 9, 12, 14 (2026-10-21):** `starter-exact-17`, `-20`, `-22` added to `REMOVED_STARTER_IDS` (dropped once per install under the `removed-starters-2026-10-21b` flag, never re-added; files archived in the gallery's work/removed-models). The rest were renumbered by display name only: exact-18, 19, 21, 23, 24, 25, 26 = Model 9-15 (`RELABEL`, once under `relabel-2026-10-21`; user names kept).

**Removed original Models 15, 16, 17 (2026-10-21, same pass):** `starter-exact-23`, `-24`, `-25` (incl. exact-25's Red dress / Leather catsuit / Tech suit files) dropped once (flag `removed-starters-2026-10-21c`), never re-added. Final lineup Model 1-12: exact-18, 19, 21, 26 = Model 9, 10, 11, 12 (`RELABEL` under `relabel-2026-10-21c`; exact-26 relabels from 'Model 18' or the brief 'Model 15'; user names kept).

**360 Outfits dropdown (2026-10-21):** the outfit chips on the viewer were replaced by an "Outfits" button under it (every gallery model, Base first and selected by default); it opens a grid of cards the size of the model cards, each with that outfit's front (0°) frame (lazy) and its name only; picking one collapses it and swaps the outfit into the spin, keeping the angle. Gallery model cards in the 360 switcher show the name only (no description).

**360 outfits integrated into the model row (2026-10-22):** no Outfits button. Gallery model cards are the same card as the outfit cards (Base front view + name, ~78px x 96px). Tapping a model selects her (Base) and opens her outfit gallery right under the row (outlined, with a notch under her card); tapping her again closes/reopens it; picking an outfit closes it and swaps the outfit into the spin, keeping the angle.

**Removed Models 1, 3, 4, 5, 9, 10 (2026-10-22):** `starter-exact-5` (incl. its Tank & shorts / Yoga set / Linen set / Red dress files), `-7`, `-9`, `-10`, `-18`, `-19` added to `REMOVED_STARTER_IDS` (dropped once per install under the `removed-starters-2026-10-22` flag, never re-added; their app-seeded sample looks removed, the user's own looks kept and detached; files archived in the gallery's work/removed-models). The survivors were renumbered by display name only, no gaps: exact-6, 12, 13, 14, 21, 26 = Model 1-6 (`RELABEL`, once under `relabel-2026-10-22`; `oldName` lists every earlier default name so an install from any earlier release is renamed; user names kept).

**Removed Model 5 (exact-21), later 2026-10-22:** `starter-exact-21` (Base, Beige Linen, A) added to `REMOVED_STARTER_IDS` (flag `removed-starters-2026-10-22b`; files archived in the gallery's work/removed-models); exact-26 relabelled Model 6 -> Model 5 (`RELABEL` under `relabel-2026-10-22b`, user names kept). Lineup Model 1-5 = exact-6, 12, 13, 14, 26.

**Reordered Model 1-5 (2026-10-22, Jordan: old 2, 5, 1, 4, 3):** `STARTERS` order and default names are now Model 1 = exact-12, 2 = exact-26, 3 = exact-6, 4 = exact-14, 5 = exact-13. The Models tab and the 360 row follow that order (`orderedModels` / gallery manifest order); `relabelStarters()` renames default-named records once (`relabel-2026-10-22c`; `oldName` lists every earlier default, never the new name; user names kept). Removed gallery ids fall back to the new Model 1 (exact-12).

**Model 3 barefoot (2026-10-22, Jordan):** `starter-exact-6` (Model 3) is barefoot in every outfit. Slip dress (lace-up sandals), Tank & shorts (sneakers) and USA jersey (socks + sneakers) got her own Base lower legs and feet from the same angle composited in (per-leg aligned, skin-tone matched, edge-matched blend above the footwear; no generation); front/back/thumb/sheet rebuilt from those frames. assetRev 40a08b9f6a2a -> 48394159d4cb, so installs refresh her in place (names and edits kept).

**Model 2 outfits trimmed (2026-10-22, Jordan):** `starter-exact-26` lost Outfit 6, 7, 13, 14 (`outfit-6`, `-7`, `-13`, `-14`; files archived in the gallery's work/removed-models/exact-26-outfits, dropped from `sw.js`). The rest are renamed Outfit 1-12 by name only (ids kept: outfit-8, -9, -10, -11, -12, -15, -16 = Outfit 6-12). assetRev b4b3f89abcad -> fdd410de3bce, so installs refresh her in place (outfits list replaced; her name and edits kept; looks link to the model, not an outfit, so none are touched).

**Drag to reorder outfits (360 tab, 2026-10-22):** long-press an outfit card (~350 ms) to lift it, drag, release to drop; a tap still selects and a swipe still scrolls. `js/outfit-drag.js` (same core as the gallery's). Order is saved per model in IndexedDB kv `outfitOrders` (by outfit id); new outfits append at the end, removed ones drop. Opening a model still shows Base. Tests: `tests/outfit-order.test.mjs`.

**Model 1 (exact-12) removed (later 2026-10-22, Jordan):** `starter-exact-12` is in `REMOVED_STARTER_IDS` (flag `removed-starters-2026-10-22c`): her starter record is dropped once, never re-added, user looks of her are kept and unlinked (modelId null). Files archived in the gallery's work/removed-models. Lineup Model 1-4 = exact-26, exact-6, exact-14, exact-13 (`relabel-2026-10-22d`; user names kept). Links to removed gallery models (e.g. #/spin/gallery:exact-12) open the new Model 1 (exact-26). Saved outfit drag orders (kv `outfitOrders`, keyed by model) are untouched.
