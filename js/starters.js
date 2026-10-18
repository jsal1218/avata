// Bundled starter models (assets in /assets/models). Measurements are estimates, editable in the app.
// assetRev = first 12 hex of SHA-256 over <file>-{sheet,front,back,thumb}.webp concatenated (see js/starter-sync.js);
// for a starter with outfits, over every outfit's four files in outfit order.
// When you replace a starter's images, update its assetRev (npm test fails until it matches); installed copies then
// refresh that starter's images on next launch, keeping the user's edits.
// Exact-reference models: Model 1-9 (ids starter-exact-5, 6, 7, 9, 10, 12, 13, 14, 17). On 2026-10-18 Jordan removed the old Models 1-4, 8,
// 11, 15 and 16 (REMOVED_STARTER_IDS in starter-sync.js) and the rest were renumbered Model 1-8 by display name only (RELABEL;
// ids are stable); exact-17 was added as Model 9, exact-18..22 as Model 10-14. AI-generated photoreal models are listed separately
// (starter-photoreal-N), then generated models (starter-generated-N, with built-in outfits). Ids are stable, so renumbering display names never needs another migration. The old
// starter-model-N ids are mapped to these on existing installs by renumberStarters() (see starter-sync.js).
export const STARTERS = [
  {
    // re-added 2026-10-18 from Jordan's corrected 6-view sheet (real back three-quarter view); new id, so existing
    // installs gain her once via addNewStarters (the deleted old starter-model-5 is never brought back)
    id: 'starter-exact-5', name: 'Model 1', file: 'exact-5', assetRev: 'eab8d1ff6b34', heightCm: 160, bodyType: 'curvy', size: '12–14 / L',
    measurements: { bust: 40, waist: 32, hips: 44, inseam: 28 }, measureUnit: 'in', measurementsEstimated: true,
    note: 'Long wavy black hair, deep tan skin',
  },
  {
    // Models 6-16 added 2026-10-18 (8, 11, 15, 16 since removed) from Jordan's 6-view sheets (same pipeline as Model 1); existing installs gain them once
    id: 'starter-exact-6', name: 'Model 2', file: 'exact-6', assetRev: '16bc8fba9dc6', heightCm: 160, bodyType: 'curvy', size: '12–14 / L',
    measurements: { bust: 40, waist: 31, hips: 44, inseam: 28 }, measureUnit: 'in', measurementsEstimated: true,
    note: 'Long straight pink hair, fair skin',
  },
  {
    id: 'starter-exact-7', name: 'Model 3', file: 'exact-7', assetRev: '5f4ee9be18ea', heightCm: 160, bodyType: 'slim', size: '2–4 / XS',
    measurements: { bust: 32, waist: 24, hips: 34, inseam: 29 }, measureUnit: 'in', measurementsEstimated: true,
    note: 'Long wavy auburn hair, fair skin',
  },
  {
    id: 'starter-exact-9', name: 'Model 4', file: 'exact-9', assetRev: 'd740b1e55ed7', heightCm: 160, bodyType: 'slim', size: '2–4 / XS',
    measurements: { bust: 33, waist: 24, hips: 35, inseam: 29 }, measureUnit: 'in', measurementsEstimated: true,
    note: 'Long straight silver-platinum hair, fair skin',
  },
  {
    id: 'starter-exact-10', name: 'Model 5', file: 'exact-10', assetRev: '276c5999ba5e', heightCm: 160, bodyType: 'slim athletic', size: '4–6 / S',
    measurements: { bust: 34, waist: 25, hips: 36, inseam: 29 }, measureUnit: 'in', measurementsEstimated: true,
    note: 'Long curly black hair, tan skin',
  },
  {
    id: 'starter-exact-12', name: 'Model 6', file: 'exact-12', assetRev: '559ec56e6687', heightCm: 160, bodyType: 'slim', size: '2–4 / XS',
    measurements: { bust: 32, waist: 24, hips: 34, inseam: 29 }, measureUnit: 'in', measurementsEstimated: true,
    note: 'Black hair in a high bun, tan skin',
  },
  {
    id: 'starter-exact-13', name: 'Model 7', file: 'exact-13', assetRev: '101376e95972', heightCm: 160, bodyType: 'full-figured', size: '16–18 / XL',
    measurements: { bust: 44, waist: 37, hips: 48, inseam: 28 }, measureUnit: 'in', measurementsEstimated: true,
    note: 'Long wavy black hair with braids, tan skin',
  },
  {
    id: 'starter-exact-14', name: 'Model 8', file: 'exact-14', assetRev: '4f3301b5435a', heightCm: 160, bodyType: 'curvy', size: '12–14 / L',
    measurements: { bust: 40, waist: 31, hips: 44, inseam: 28 }, measureUnit: 'in', measurementsEstimated: true,
    note: 'Natural curly hair in a high puff, deep brown skin',
  },
  {
    // added 2026-10-18 from Jordan's 6-view sheet (same pipeline); new stable id exact-17, label Model 9; existing installs gain her once
    id: 'starter-exact-17', name: 'Model 9', file: 'exact-17', assetRev: 'f06a41c1b13f', heightCm: 160, bodyType: 'athletic', size: '6–8 / M',
    measurements: { bust: 36, waist: 28, hips: 40, inseam: 29 }, measureUnit: 'in', measurementsEstimated: true,
    note: 'Short wavy dark-brown bob, tan skin',
  },
  // added 2026-10-18 from Jordan's 6-view sheets (same pipeline); new stable ids exact-18..22, labels Model 10-14; existing installs gain them once
  {
    id: 'starter-exact-18', name: 'Model 10', file: 'exact-18', assetRev: 'f9d35ab210eb', heightCm: 160, bodyType: 'slim', size: '4–6 / S',
    measurements: { bust: 34, waist: 26, hips: 37, inseam: 30 }, measureUnit: 'in', measurementsEstimated: true,
    note: 'Long curly red hair, freckles, fair skin, layered necklace',
  },
  {
    id: 'starter-exact-19', name: 'Model 11', file: 'exact-19', assetRev: 'ea7997153b0b', heightCm: 160, bodyType: 'curvy', size: '6–8 / M',
    measurements: { bust: 36, waist: 27, hips: 40, inseam: 30 }, measureUnit: 'in', measurementsEstimated: true,
    note: 'Long straight copper hair, half-cyborg face (left side), black top and flared pants',
  },
  {
    id: 'starter-exact-20', name: 'Model 12', file: 'exact-20', assetRev: '90fad9235303', heightCm: 160, bodyType: 'curvy', size: '6–8 / M',
    measurements: { bust: 36, waist: 27, hips: 40, inseam: 30 }, measureUnit: 'in', measurementsEstimated: true,
    note: 'Platinum-blonde bob, half-cyborg face (left side), black top and flared pants',
  },
  {
    id: 'starter-exact-21', name: 'Model 13', file: 'exact-21', assetRev: '19029f72dedf', heightCm: 160, bodyType: 'slim', size: '4–6 / S',
    measurements: { bust: 35, waist: 26, hips: 37, inseam: 30 }, measureUnit: 'in', measurementsEstimated: true,
    note: 'Long wavy brown hair, fair skin',
  },
  {
    id: 'starter-exact-22', name: 'Model 14', file: 'exact-22', assetRev: '7b1c9e05547b', heightCm: 160, bodyType: 'average', size: 'M',
    measurements: { bust: 40, waist: 32, hips: 39, inseam: 31 }, measureUnit: 'in', measurementsEstimated: true,
    note: 'Brown cap, white graphic tee, black shorts, slides (male model; face blurred in the sheet)',
  },
  {
    id: 'starter-photoreal-1', name: 'Photoreal 1', file: 'photoreal-1', assetRev: 'dad36faeef8d', heightCm: 160, bodyType: 'slim hourglass', size: '4–6 / S',
    measurements: { bust: 34, waist: 25, hips: 38, inseam: 29 }, measureUnit: 'in', measurementsEstimated: true,
    note: 'Long dark curls, tan skin',
  },
  {
    // Generated 1 (added 2026-10-18): a generated fictional model with four built-in outfits (her own Generated section).
    // The first outfit is her base images (file); assetRev covers all four outfits' images in this order.
    id: 'starter-generated-1', name: 'Generated 1', file: 'generated-1', assetRev: '77df5d3b06b8', heightCm: 160, bodyType: 'slim', size: '4–6 / S',
    measurements: { bust: 34, waist: 26, hips: 36, inseam: 30 }, measureUnit: 'in', measurementsEstimated: true,
    note: 'Shoulder-length wavy chestnut hair, olive skin (generated model)', source: 'generated',
    outfits: [
      { id: 'base', name: 'Base', subtitle: 'Grey crop set', file: 'generated-1' },
      { id: 'summer-denim', name: 'Summer denim', subtitle: 'White tied shirt · denim shorts', file: 'generated-1-summer-denim' },
      { id: 'sundress', name: 'Sundress', subtitle: 'Yellow floral sundress', file: 'generated-1-sundress' },
      { id: 'linen-set', name: 'Linen set', subtitle: 'Sage tank · linen pants', file: 'generated-1-linen-set' },
    ],
  },
  {
    // Generated 2 (added 2026-10-18): a second generated fictional model, listed after Generated 1 in the Generated section,
    // with two built-in outfits. The first outfit is her base images (file); assetRev covers both outfits' images in this order.
    id: 'starter-generated-2', name: 'Generated 2', file: 'generated-2', assetRev: 'e1a458afce26', heightCm: 160, bodyType: 'athletic', size: '4–6 / S',
    measurements: { bust: 34, waist: 26, hips: 37, inseam: 31 }, measureUnit: 'in', measurementsEstimated: true,
    note: 'Sleek dark-brown ponytail, athletic build (generated model)', source: 'generated',
    outfits: [
      { id: 'base', name: 'Base', subtitle: 'Grey tank · leggings', file: 'generated-2' },
      { id: 'yoga-set', name: 'Yoga set', subtitle: 'Rose yoga set', file: 'generated-2-yoga-set' },
    ],
  },
];

// Clearly-labelled SAMPLE catalog so the app isn't empty. Not real factory data —
// delete any time in Settings → Data → Remove sample data.
const SAMPLE_NOTE = 'SAMPLE entry — illustrative only, not real factory data. Edit or delete.';
export const SAMPLE_STYLES = [
  { id: 'sample-style-1', sku: 'SAMPLE-001', name: 'Sample · Rib Crop Tank', collection: 'Sample Collection', season: 'Sample', category: 'Tops', fabric: 'Rib knit (sample)', composition: '95% cotton / 5% elastane (sample)', colorways: ['Heather grey'], sizes: ['XS', 'S', 'M', 'L', 'XL'], status: 'Approved', supplier: '', notes: SAMPLE_NOTE, cost: null, price: null, tags: ['sample', 'basics'], photoFiles: ['assets/samples/sketch-tank.svg'] },
  { id: 'sample-style-2', sku: 'SAMPLE-002', name: 'Sample · Fitted Short', collection: 'Sample Collection', season: 'Sample', category: 'Bottoms', fabric: 'Jersey (sample)', composition: '92% cotton / 8% elastane (sample)', colorways: ['Heather grey'], sizes: ['XS', 'S', 'M', 'L', 'XL'], status: 'Sampling', supplier: '', notes: SAMPLE_NOTE, cost: null, price: null, tags: ['sample', 'basics'], photoFiles: ['assets/samples/sketch-short.svg'] },
  { id: 'sample-style-3', sku: 'SAMPLE-003', name: 'Sample · Tank + Short Set', collection: 'Sample Collection', season: 'Sample', category: 'Sets', fabric: 'Rib knit + jersey (sample)', composition: 'See components (sample)', colorways: ['Heather grey'], sizes: ['XS', 'S', 'M', 'L', 'XL'], status: 'Concept', supplier: '', notes: SAMPLE_NOTE, cost: null, price: null, tags: ['sample', 'sets'], photoFiles: ['assets/samples/sketch-set.svg'] },
];
const SET = ['sample-style-3', 'sample-style-1', 'sample-style-2'];
// Look ids keep their original 'model-1'/'model-2' names (stable ids, already stored on installs); the looks follow
// their models: old Model 2 → starter-photoreal-1. (Model 1's sample looks went with her on 2026-10-18; removeStarters() drops them.)
export const SAMPLE_LOOKS = [['model-2', 'photoreal-1', 'starter-photoreal-1']].flatMap(([m, file, modelId]) => [
  { id: `sample-look-${m}-front`, file: `assets/models/${file}-front.webp`, view: 'front' },
  { id: `sample-look-${m}-back`, file: `assets/models/${file}-back.webp`, view: 'back' },
  { id: `sample-look-${m}-sheet`, file: `assets/models/${file}-sheet.webp`, view: 'sheet' },
].map(l => ({ ...l, modelId, styleIds: SET, colorway: 'Heather grey', title: 'Sample look (reference sheet)', notes: 'Sample mockup reusing the model reference image.', tags: ['sample'], source: 'sample' })));
