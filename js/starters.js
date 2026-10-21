// Bundled starter models (assets in /assets/models). Measurements are estimates, editable in the app.
// assetRev = first 12 hex of SHA-256 over <file>-{sheet,front,back,thumb}.webp concatenated (see js/starter-sync.js);
// for a starter with outfits, over every outfit's four files in outfit order.
// When you replace a starter's images, update its assetRev (npm test fails until it matches); installed copies then
// refresh that starter's images on next launch, keeping the user's edits.
// Exact-reference models: Model 1-9 (ids starter-exact-5, 6, 7, 9, 10, 12, 13, 14, 17). On 2026-10-18 Jordan removed the old Models 1-4, 8,
// 11, 15 and 16 (REMOVED_STARTER_IDS in starter-sync.js) and the rest were renumbered Model 1-8 by display name only (RELABEL;
// ids are stable); exact-17 was added as Model 9, exact-18..22 as Model 10-14. Generated models (starter-generated-1..3)
// followed; the Photorealistic starters (Photoreal 1-2) were removed on 2026-10-19 and the Generated ones on 2026-10-21 (REMOVED_STARTER_IDS). Ids are stable, so renumbering display names never needs another migration. The old
// starter-model-N ids are mapped to these on existing installs by renumberStarters() (see starter-sync.js).
export const STARTERS = [
  {
    // re-added 2026-10-18 from Jordan's corrected 6-view sheet (real back three-quarter view); new id, so existing
    // installs gain her once via addNewStarters (the deleted old starter-model-5 is never brought back)
    id: 'starter-exact-5', name: 'Model 1', file: 'exact-5', assetRev: '51325ea83e03', heightCm: 160, bodyType: 'curvy', size: '12–14 / L',
    measurements: { bust: 40, waist: 32, hips: 44, inseam: 28 }, measureUnit: 'in', measurementsEstimated: true,
    note: 'Long wavy black hair, deep tan skin',
    // 2026-10-19 (Jordan): a second built-in outfit, Tank & shorts (generated with her own sheet as the reference); assetRev covers both
    outfits: [
      { id: 'base', name: 'Base', subtitle: 'Grey crop set', file: 'exact-5' },
      { id: 'tank-shorts', name: 'Tank & shorts', subtitle: 'Black tank · shorts · sneakers', file: 'exact-5-tank-shorts' },
      // 2026-10-19 (Jordan): Generated 2's Yoga set and Generated 1's Linen set, generated on her own sheet
      { id: 'yoga-set', name: 'Yoga set', subtitle: 'Rose yoga set', file: 'exact-5-yoga-set' },
      { id: 'linen-set', name: 'Linen set', subtitle: 'Sage tank · linen pants', file: 'exact-5-linen-set' },
      // 2026-10-20 (Jordan): the same red dress as Model 17, generated on her own sheet
      { id: 'red-dress', name: 'Red dress', subtitle: 'Red V-neck mini dress', file: 'exact-5-red-dress' },
    ],
  },
  {
    // Models 6-16 added 2026-10-18 (8, 11, 15, 16 since removed) from Jordan's 6-view sheets (same pipeline as Model 1); existing installs gain them once
    id: 'starter-exact-6', name: 'Model 2', file: 'exact-6', assetRev: '40a08b9f6a2a', heightCm: 160, bodyType: 'curvy', size: '12–14 / L',
    measurements: { bust: 40, waist: 31, hips: 44, inseam: 28 }, measureUnit: 'in', measurementsEstimated: true,
    note: 'Long straight pink hair, fair skin',
    // 2026-10-19 (Jordan): Generated 2's Yoga set, generated on her own sheet; existing installs gain it in place (assetRev covers both)
    outfits: [
      { id: 'base', name: 'Base', subtitle: 'Grey crop set', file: 'exact-6' },
      { id: 'yoga-set', name: 'Yoga set', subtitle: 'Rose yoga set', file: 'exact-6-yoga-set' },
      // 2026-10-21 (Jordan): Generated 3's outfits (she is Model 2); her own copies since the Generated section was removed
      { id: 'turtleneck', name: 'Turtleneck', subtitle: 'Black turtleneck · trousers', file: 'exact-6-turtleneck' },
      { id: 'slip-dress', name: 'Slip dress', subtitle: 'Black slip dress · sandals', file: 'exact-6-slip-dress' },
      { id: 'tank-shorts', name: 'Tank & shorts', subtitle: 'Black tank · shorts · sneakers', file: 'exact-6-tank-shorts' },
      // 2026-10-21 (Jordan): USA soccer home kit, generated on her own sheet
      { id: 'usa-jersey', name: 'USA jersey', subtitle: 'USA home kit · white jersey', file: 'exact-6-usa-jersey' },
    ],
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
    id: 'starter-exact-21', name: 'Model 13', file: 'exact-21', assetRev: '86e0dd266c1e', heightCm: 160, bodyType: 'slim', size: '4–6 / S',
    measurements: { bust: 35, waist: 26, hips: 37, inseam: 30 }, measureUnit: 'in', measurementsEstimated: true,
    note: 'Long wavy brown hair, fair skin',
    // 2026-10-20 (Jordan): Beige Linen, from Jordan's own 6-view sheet (no generation); existing installs refresh her in place
    outfits: [
      { id: 'base', name: 'Base', subtitle: 'Grey crop set', file: 'exact-21' },
      { id: 'beige-linen', name: 'Beige Linen', subtitle: 'Belted linen shirt dress', file: 'exact-21-beige-linen' },
      { id: 'a', name: 'A', subtitle: 'Beige crop tank · baggy jeans · sneakers', file: 'exact-21-a' },
    ],
  },
  {
    id: 'starter-exact-22', name: 'Model 14', file: 'exact-22', assetRev: '7b1c9e05547b', heightCm: 160, bodyType: 'average', size: 'M',
    measurements: { bust: 40, waist: 32, hips: 39, inseam: 31 }, measureUnit: 'in', measurementsEstimated: true,
    note: 'Brown cap, white graphic tee, black shorts, slides (male model; face blurred in the sheet)',
  },
  // added 2026-10-19 from Jordan's 6-view sheets (same pipeline); new stable ids exact-23, 24 (15 and 16 stay retired), labels Model 15-16; existing installs gain them once
  {
    id: 'starter-exact-23', name: 'Model 15', file: 'exact-23', assetRev: 'd5c10514d239', heightCm: 160, bodyType: 'curvy', size: '8–10 / M',
    measurements: { bust: 37, waist: 28, hips: 41, inseam: 29 }, measureUnit: 'in', measurementsEstimated: true,
    note: 'Long curly brown hair with caramel highlights, tan skin, grey crop set',
  },
  {
    id: 'starter-exact-24', name: 'Model 16', file: 'exact-24', assetRev: 'f8de9ba57c27', heightCm: 160, bodyType: 'curvy', size: '8–10 / M',
    measurements: { bust: 37, waist: 28, hips: 41, inseam: 29 }, measureUnit: 'in', measurementsEstimated: true,
    note: 'Long wavy burgundy hair with pink streaks, clear glasses, fair skin, pink crop set',
  },
  {
    // added 2026-10-20 (Jordan): Model 17 with a second built-in outfit, Red dress (generated on her own sheet; clothing only from the outfit reference)
    id: 'starter-exact-25', name: 'Model 17', file: 'exact-25', assetRev: '6f8c36180b7e', heightCm: 160, bodyType: 'curvy', size: '14–16 / XL',
    measurements: { bust: 42, waist: 35, hips: 46, inseam: 28 }, measureUnit: 'in', measurementsEstimated: true,
    note: 'Long straight platinum hair, fair skin, grey racerback crop set',
    outfits: [
      { id: 'base', name: 'Base', subtitle: 'Grey crop set', file: 'exact-25' },
      { id: 'red-dress', name: 'Red dress', subtitle: 'Red V-neck mini dress', file: 'exact-25-red-dress' },
      // 2026-10-20 (Jordan confirmed): Leather catsuit and Tech suit; existing installs refresh her in place (assetRev covers all four)
      { id: 'leather-catsuit', name: 'Leather catsuit', subtitle: 'Black leather · laced open back', file: 'exact-25-leather-catsuit' },
      { id: 'tech-suit', name: 'Tech suit', subtitle: 'Black armor · blue core', file: 'exact-25-tech-suit' },
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
// Sample looks: the last ones (old Model 2 → starter-photoreal-1) went with the Photorealistic section on 2026-10-19
// (removeStarters() drops app-seeded sample looks of removed starters; the user's own looks are kept, detached). None ship now.
export const SAMPLE_LOOKS = [].flatMap(([m, file, modelId]) => [
  { id: `sample-look-${m}-front`, file: `assets/models/${file}-front.webp`, view: 'front' },
  { id: `sample-look-${m}-back`, file: `assets/models/${file}-back.webp`, view: 'back' },
  { id: `sample-look-${m}-sheet`, file: `assets/models/${file}-sheet.webp`, view: 'sheet' },
].map(l => ({ ...l, modelId, styleIds: SET, colorway: 'Heather grey', title: 'Sample look (reference sheet)', notes: 'Sample mockup reusing the model reference image.', tags: ['sample'], source: 'sample' })));
