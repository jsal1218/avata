// Bundled starter models (assets in /assets/models). Measurements are estimates, editable in the app.
// assetRev = first 12 hex of SHA-256 over <file>-{sheet,front,back,thumb}.webp concatenated (see js/starter-sync.js);
// for a starter with outfits, over every outfit's four files in outfit order.
// When you replace a starter's images, update its assetRev (npm test fails until it matches); installed copies then
// refresh that starter's images on next launch, keeping the user's edits.
// Exact-reference models: Model 1-9 (ids starter-exact-5, 6, 7, 9, 10, 12, 13, 14, 17). On 2026-10-18 Jordan removed the old Models 1-4, 8,
// 11, 15 and 16 (REMOVED_STARTER_IDS in starter-sync.js) and the rest were renumbered Model 1-8 by display name only (RELABEL;
// ids are stable); exact-17 was added as Model 9, exact-18..22 as Model 10-14. Generated models (starter-generated-1..3)
// followed; the Photorealistic starters (Photoreal 1-2) were removed on 2026-10-19 and the Generated ones on 2026-10-21 (REMOVED_STARTER_IDS). Ids are stable, so renumbering display names never needs another migration. The old
// 2026-10-22 (Jordan): Model 1, 3, 4, 5, 9, 10 (exact-5, 7, 9, 10, 18, 19) removed; lineup Model 1-6 = exact-6, 12, 13, 14, 21, 26 (RELABEL).
// Later 2026-10-22: Model 5 (exact-21) removed too. Then reordered (Jordan, old 2, 5, 1, 4, 3): Model 1-5 = exact-12, 26, 6, 14, 13, in this array order.
// starter-model-N ids are mapped to these on existing installs by renumberStarters() (see starter-sync.js).
export const STARTERS = [
  {
    id: 'starter-exact-12', name: 'Model 1', file: 'exact-12', assetRev: '559ec56e6687', heightCm: 160, bodyType: 'slim', size: '2–4 / XS',
    measurements: { bust: 32, waist: 24, hips: 34, inseam: 29 }, measureUnit: 'in', measurementsEstimated: true,
    note: 'Black hair in a high bun, tan skin',
  },
  // (exact-23, 24 and 25, added 2026-10-19/20 as Model 15-17, were removed 2026-10-21)
  {
    // added 2026-10-21 (Jordan): Model 18 from Jordan's own 6-view sheets (no generation); existing installs gain her once. Base first; her outfits follow and refresh her in place (assetRev)
    id: 'starter-exact-26', name: 'Model 2', file: 'exact-26', assetRev: 'b4b3f89abcad', heightCm: 160, bodyType: 'curvy', size: '8–10 / M',
    measurements: { bust: 36, waist: 27, hips: 39, inseam: 30 }, measureUnit: 'in', measurementsEstimated: true,
    note: 'Long wavy blonde hair, fair skin, grey crop set',
    outfits: [
      { id: 'base', name: 'Base', subtitle: 'Grey crop set', file: 'exact-26' },
      { id: 'outfit-1', name: 'Outfit 1', subtitle: 'Pink zip hoodie crop · flared pants', file: 'exact-26-outfit-1' },
      { id: 'outfit-2', name: 'Outfit 2', subtitle: 'Brown halter crop · shorts', file: 'exact-26-outfit-2' },
      { id: 'outfit-3', name: 'Outfit 3', subtitle: 'Cream long-sleeve crop · cargo jeans', file: 'exact-26-outfit-3' },
      { id: 'outfit-4', name: 'Outfit 4', subtitle: 'White halter top · denim cargo jorts', file: 'exact-26-outfit-4' },
      { id: 'outfit-5', name: 'Outfit 5', subtitle: 'Cream cami crop · grey wide sweatpants', file: 'exact-26-outfit-5' },
      { id: 'outfit-6', name: 'Outfit 6', subtitle: 'Pale yellow tank crop · baggy jeans', file: 'exact-26-outfit-6' },
      { id: 'outfit-7', name: 'Outfit 7', subtitle: 'White lace cami · black denim pleated mini', file: 'exact-26-outfit-7' },
      { id: 'outfit-8', name: 'Outfit 8', subtitle: 'Dark grey cami · faded wide jeans · shoulder bag', file: 'exact-26-outfit-8' },
      { id: 'outfit-9', name: 'Outfit 9', subtitle: 'Black halter top · ruched mini skirt · heels', file: 'exact-26-outfit-9' },
      { id: 'outfit-10', name: 'Outfit 10', subtitle: 'Black sports bra · running shorts', file: 'exact-26-outfit-10' },
      { id: 'outfit-11', name: 'Outfit 11', subtitle: 'Red/black/white leather moto suit · boots', file: 'exact-26-outfit-11' },
      { id: 'outfit-12', name: 'Outfit 12', subtitle: 'Black pantsuit · white shirt · heels', file: 'exact-26-outfit-12' },
      { id: 'outfit-13', name: 'Outfit 13', subtitle: 'Chef whites · hat · apron · pinstripe pants', file: 'exact-26-outfit-13' },
      { id: 'outfit-14', name: 'Outfit 14', subtitle: 'Light blue satin short robe', file: 'exact-26-outfit-14' },
      { id: 'outfit-15', name: 'Outfit 15', subtitle: 'Black crop tank · pink satin shorts', file: 'exact-26-outfit-15' },
      { id: 'outfit-16', name: 'Outfit 16', subtitle: 'Grey tie-dye oversized tee · grey shorts', file: 'exact-26-outfit-16' },
    ],
  },
  {
    // Models 6-16 added 2026-10-18 (8, 11, 15, 16 since removed) from Jordan's 6-view sheets (same pipeline as Model 1); existing installs gain them once
    id: 'starter-exact-6', name: 'Model 3', file: 'exact-6', assetRev: '40a08b9f6a2a', heightCm: 160, bodyType: 'curvy', size: '12–14 / L',
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
    id: 'starter-exact-14', name: 'Model 4', file: 'exact-14', assetRev: '4f3301b5435a', heightCm: 160, bodyType: 'curvy', size: '12–14 / L',
    measurements: { bust: 40, waist: 31, hips: 44, inseam: 28 }, measureUnit: 'in', measurementsEstimated: true,
    note: 'Natural curly hair in a high puff, deep brown skin',
  },
  {
    id: 'starter-exact-13', name: 'Model 5', file: 'exact-13', assetRev: '101376e95972', heightCm: 160, bodyType: 'full-figured', size: '16–18 / XL',
    measurements: { bust: 44, waist: 37, hips: 48, inseam: 28 }, measureUnit: 'in', measurementsEstimated: true,
    note: 'Long wavy black hair with braids, tan skin',
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
