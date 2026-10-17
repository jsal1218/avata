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
`js/settings-view.js`, `js/backup.js` (zip/json/csv), `js/prompt.js`, `js/providers.js`, `js/imaging.js`, `js/db.js`,
`js/ui.js`, `js/starters.js`, `sw.js`, `manifest.webmanifest`.
Tests: `npm test` (request shapes, zip round-trip, CSV). Smoke test + screenshots: `python3 tools/e2e_v2.py [url]`.

## Deploy
Push to `main`; GitHub Pages serves the repo root. Bump `VERSION` in `sw.js` and `js/app.js` for each release.
