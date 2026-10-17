// Bundled starter models (assets in /assets/models). Measurements are estimates, editable in the app.
// assetRev = first 12 hex of SHA-256 over <file>-{sheet,front,back,thumb}.webp concatenated (see js/starter-sync.js).
// When you replace a starter's images, update its assetRev (npm test fails until it matches); installed copies then
// refresh that starter's images on next launch, keeping the user's edits.
export const STARTERS = [
  {
    id: 'starter-model-1', name: 'Model 1', file: 'model-1', assetRev: '208554b59a1a', heightCm: 160, bodyType: 'curvy hourglass', size: '10–12 / L',
    measurements: { bust: 38, waist: 30, hips: 42, inseam: 28 }, measureUnit: 'in', measurementsEstimated: true,
    note: 'Straight strawberry-blonde hair, fair skin',
  },
  {
    id: 'starter-model-2', name: 'Model 2', file: 'model-2', assetRev: 'dad36faeef8d', heightCm: 160, bodyType: 'slim hourglass', size: '4–6 / S',
    measurements: { bust: 34, waist: 25, hips: 38, inseam: 29 }, measureUnit: 'in', measurementsEstimated: true,
    note: 'Long dark curls, tan skin',
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
export const SAMPLE_LOOKS = ['model-1', 'model-2'].flatMap((m, mi) => [
  { id: `sample-look-${m}-front`, file: `assets/models/${m}-front.webp`, view: 'front' },
  { id: `sample-look-${m}-back`, file: `assets/models/${m}-back.webp`, view: 'back' },
  { id: `sample-look-${m}-sheet`, file: `assets/models/${m}-sheet.webp`, view: 'sheet' },
].map(l => ({ ...l, modelId: `starter-model-${mi + 1}`, styleIds: SET, colorway: 'Heather grey', title: 'Sample look (reference sheet)', notes: 'Sample mockup reusing the model reference image.', tags: ['sample'], source: 'sample' })));
