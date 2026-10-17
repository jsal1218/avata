# Avata — Outfit Studio

Installable mobile web app (PWA) that renders photorealistic outfit mockups on **consistent model references**.
Static site, no build step, no backend. Live: https://jsal1218.github.io/avata/

## What it does
- **Model library** (IndexedDB, on-device): import a square front|back reference sheet; Avata auto-detects the gap between the
  two figures, crops front and back onto 2:3 portraits (manual split slider, swap, or single-photo mode). Each model stores
  height (ft/in ⇄ cm), body type, US size and optional bust/waist/hips/inseam (marked *estimated* if you like).
  Two starter models are bundled (`assets/models/`), both 5′3″ / 160 cm with estimated measurements.
- **Identity lock**: every render sends the model's front + back crops (or the full sheet for sheet output) plus a prompt
  that maps each input image, locks face/hair/skin/body, and injects height, body type, size and measurements so hems,
  inseams, sleeves and fit land realistically on her frame.
- **Outfit**: garment photos (flat lay, product, hanger) and/or text, fabric presets with physical descriptions, fit,
  colour, footwear, accessories, keep/remove reference jewellery.
- **Realism**: Off/Natural/Max for skin texture, fabric physics, anatomy; lighting presets (white seamless, softbox
  e-commerce, golden hour, editorial, overcast, direct flash); camera/lens presets; views: front, back, 3/4, front+back sheet (1:1).
- **Providers (bring your own key, called straight from the browser):**
  - fal.ai queue API — `fal-ai/nano-banana-pro/edit` (default), `fal-ai/nano-banana-2/edit`, `bytedance/seedream/v5/pro/edit`,
    `fal-ai/bytedance/seedream/v4.5/edit`, `fal-ai/flux-2-pro/edit`, `fal-ai/fashn/tryon/v1.6`.
  - Google Gemini API (Interactions API) — `gemini-3-pro-image`, `gemini-nano-banana-2.1`.
  - Upscale/detail (fal): `fal-ai/seedvr/upscale/image`, `fal-ai/topaz/upscale/image`, or a skin-detail refine edit pass.
- **Gallery**: per-model history, favourites, side-by-side and wipe compare with the reference, download, Web Share,
  re-run with the exact saved settings and garments, prompt inspector, upscale.

Keys live in `localStorage` on the device and are sent only to the chosen provider.

## Files
`index.html`, `styles.css`, `js/app.js` (UI), `js/prompt.js` (prompt engine), `js/providers.js` (model registry, request
builders, fal queue + Gemini runners), `js/imaging.js` (sheet split/crop), `js/db.js`, `js/starters.js`, `sw.js`,
`manifest.webmanifest`, `tools/build_assets.py` (starter assets + icons), `tools/e2e.py` (headless smoke test + screenshots,
provider calls mocked), `tests/` (`npm test` → request-shape tests).

## Deploy
Push to `main`; GitHub Pages serves the repo root. Bump `VERSION` in `sw.js` and `js/app.js` when shipping so installed
apps pick up the update (they show a "Reload" toast).
