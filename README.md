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
  Two starter models bundled (5′3″ / 160 cm, measurements marked estimated).
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
