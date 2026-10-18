import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { STARTERS, SAMPLE_LOOKS } from '../js/starters.js';
import { contentRev, modelNeedsRefresh, lookNeedsRefresh, refreshedModel, refreshedLook, IMAGE_KEYS } from '../js/starter-sync.js';

const shipped = s => Object.fromEntries(IMAGE_KEYS.map(k => [k, new Blob([readFileSync(new URL(`../assets/models/${s.file}-${k}.webp`, import.meta.url))])]));

test('each starter assetRev matches its shipped images (bump assetRev when assets change)', async () => {
  for (const s of STARTERS) assert.equal(await contentRev(shipped(s)), s.assetRev, `${s.id}: set assetRev to the new hash`);
});

test('refresh decision: only stale bundled starters / app-seeded sample looks', () => {
  const s = STARTERS[0], sample = SAMPLE_LOOKS.find(l => l.modelId === s.id);
  assert.equal(modelNeedsRefresh({ id: s.id, starter: true }, s), true);                       // legacy copy, no rev
  assert.equal(modelNeedsRefresh({ id: s.id, starter: true, assetRev: 'old' }, s), true);
  assert.equal(modelNeedsRefresh({ id: s.id, starter: true, assetRev: s.assetRev }, s), false); // idempotent
  assert.equal(modelNeedsRefresh({ id: 'u1', starter: false }, s), false);                     // user model
  assert.equal(modelNeedsRefresh({ id: s.id, starter: false }, s), false);
  assert.equal(modelNeedsRefresh(undefined, s), false);                                         // deleted starter stays deleted
  assert.equal(lookNeedsRefresh({ id: sample.id, sample: true, source: 'sample', modelId: s.id }, sample, s), true);
  assert.equal(lookNeedsRefresh({ id: sample.id, sample: true, source: 'sample', modelId: s.id, assetRev: s.assetRev }, sample, s), false);
  assert.equal(lookNeedsRefresh({ id: 'g1', source: 'generated', modelId: s.id }, sample, s), false);
  assert.equal(lookNeedsRefresh({ id: sample.id, sample: true, source: 'sample', modelId: 'other' }, sample, s), false); // relinked by user
});

test('refreshed records keep user edits and change only images + rev', () => {
  const s = STARTERS[0], img = new Blob(['new']);
  const old = { id: s.id, name: 'Ava (renamed)', note: 'my note', heightCm: 170, measurements: { bust: 1 }, starter: true, createdAt: 5, sheet: 'o', front: 'o', back: 'o', thumb: 'o' };
  const m = refreshedModel(old, s, { sheet: img, front: img, back: img, thumb: img });
  assert.deepEqual({ ...m, sheet: 0, front: 0, back: 0, thumb: 0 }, { ...old, sheet: 0, front: 0, back: 0, thumb: 0, assetRev: s.assetRev });
  for (const k of IMAGE_KEYS) assert.equal(m[k], img);
  const l = refreshedLook({ id: 'x', title: 'Mine', tags: ['a'], favorite: true, image: 'o', thumb: 'o' }, s, img);
  assert.deepEqual(l, { id: 'x', title: 'Mine', tags: ['a'], favorite: true, image: img, thumb: img, assetRev: s.assetRev });
});

import { LEGACY_STARTER_IDS, initialKnownStarters, startersToAdd, withKnown, newStarterRecord } from '../js/starter-sync.js';

// WebP canvas size from the RIFF header (VP8X / VP8 / VP8L), so the test needs no image library.
const webpSize = buf => {
  assert.equal(buf.toString('ascii', 0, 4), 'RIFF'); assert.equal(buf.toString('ascii', 8, 12), 'WEBP');
  const c = buf.toString('ascii', 12, 16);
  if (c === 'VP8X') return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
  if (c === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
  if (c === 'VP8L') { const b = buf.readUInt32LE(21); return [1 + (b & 0x3fff), 1 + ((b >> 14) & 0x3fff)]; }
  throw new Error('unknown webp chunk ' + c);
};

test('exact-reference starters (Model 1-4) and Photoreal 1 ship the same four WebP images at Model 1\'s sizes', () => {
  const read = (s, k) => readFileSync(new URL(`../assets/models/${s.file}-${k}.webp`, import.meta.url));
  const m1 = STARTERS.find(s => s.id === 'starter-exact-1'); const ref = Object.fromEntries(IMAGE_KEYS.map(k => [k, webpSize(read(m1, k))]));
  assert.deepEqual(ref, { sheet: [1500, 1500], front: [1025, 1536], back: [1023, 1535], thumb: [360, 539] });
  // Photoreal 1 (old Model 2) predates the exact-reference pipeline (slightly different crops), so it is the one exception
  for (const s of STARTERS.filter(s => s.id !== 'starter-photoreal-1')) for (const k of IMAGE_KEYS) assert.deepEqual(webpSize(read(s, k)), ref[k], `${s.file}-${k}.webp size`);
  assert.equal(new Set(STARTERS.map(s => s.id)).size, STARTERS.length, 'unique starter ids');
  for (const s of STARTERS) assert.match(s.assetRev, /^[0-9a-f]{12}$/);
});

test('new starters reach existing installs once; deleted starters are never re-added', () => {
  const ids = STARTERS.map(s => s.id);
  assert.ok(ids.length === 6 && LEGACY_STARTER_IDS.every(id => ids.includes(id)));
  // legacy install (no knownStarters yet) that still has Model 1 and a user model, and deleted Model 2
  const legacy = initialKnownStarters([{ id: 'starter-exact-1', starter: true }, { id: 'u1', starter: false }]);
  assert.deepEqual(legacy, LEGACY_STARTER_IDS);                                              // Photoreal 1 (old Model 2) counts as known → stays deleted
  const add = startersToAdd(STARTERS, legacy).map(s => s.id);
  assert.deepEqual(add, ids.filter(id => !LEGACY_STARTER_IDS.includes(id)));                // only the newly shipped ones, in order
  assert.ok(!add.includes('u1') && !add.includes('starter-photoreal-1'));
  // after adding they're known; the user deletes Model 4 → nothing to add on later launches
  const known = withKnown(legacy, add);
  assert.deepEqual(startersToAdd(STARTERS, known), []);
  assert.deepEqual(withKnown(known, add), known);                                            // idempotent, no duplicates
  // fresh install: seeding records every shipped starter, so nothing is added twice
  assert.deepEqual(startersToAdd(STARTERS, withKnown(undefined, ids)), []);
  assert.deepEqual(startersToAdd(STARTERS, undefined).map(s => s.id), ids);
});

test('new starter record has the seeded shape (no file/assetRev leak, rev only when verified)', () => {
  const s = STARTERS[STARTERS.length - 1], img = new Blob(['x']), blobs = { sheet: img, front: img, back: img, thumb: img };
  const r = newStarterRecord(s, blobs, s.assetRev, 123);
  assert.equal(r.id, s.id); assert.equal(r.starter, true); assert.equal(r.createdAt, 123); assert.equal(r.assetRev, s.assetRev);
  assert.ok(!('file' in r)); for (const k of IMAGE_KEYS) assert.equal(r[k], img);
  assert.ok(!('assetRev' in newStarterRecord(s, blobs, undefined, 1)));                      // unverified → syncStarters retries
  assert.deepEqual(r.measurements, s.measurements); assert.equal(r.name, s.name);
});

import { RENUMBER, DELETED_STARTER_IDS, renumberedStarter, renumberedKnown, renumberedLook } from '../js/starter-sync.js';

test('lineup: Model 1-5 = exact-reference (strawberry blonde, black hair, dark-brown, platinum, wavy black), Photoreal 1 separate; old Model 5 gone', () => {
  assert.deepEqual(STARTERS.map(s => [s.id, s.name, s.file]), [
    ['starter-exact-1', 'Model 1', 'exact-1'], ['starter-exact-2', 'Model 2', 'exact-2'], ['starter-exact-3', 'Model 3', 'exact-3'],
    ['starter-exact-4', 'Model 4', 'exact-4'], ['starter-exact-5', 'Model 5', 'exact-5'], ['starter-photoreal-1', 'Photoreal 1', 'photoreal-1']]);
  assert.deepEqual(STARTERS.map(s => s.note.split(',')[0]), ['Straight strawberry-blonde hair', 'Long straight black hair', 'Long straight dark-brown hair', 'Long straight platinum-blonde hair', 'Long wavy black hair', 'Long dark curls']);
  assert.ok(!STARTERS.some(s => s.id === 'starter-model-5'), 'old Model 5 id is gone (re-added under the new id starter-exact-5)');
  assert.ok(!existsSync(new URL('../assets/models/model-5-front.webp', import.meta.url)) && !existsSync(new URL('../assets/models/model-6-front.webp', import.meta.url)));
  // every renumber target is a shipped starter; sample looks follow their models
  for (const to of Object.values(RENUMBER)) assert.ok(STARTERS.some(s => s.id === to.id && s.name === to.name), to.id);
  assert.deepEqual([...new Set(SAMPLE_LOOKS.map(l => l.modelId))], ['starter-exact-1', 'starter-photoreal-1']);
  for (const l of SAMPLE_LOOKS) assert.ok(existsSync(new URL('../' + l.file, import.meta.url)), l.file);
});

test('renumbering existing installs: ids/names mapped, user edits kept, only old Model 5 deleted, known list mapped', () => {
  const r6 = renumberedStarter({ id: 'starter-model-6', name: 'Model 6', note: 'my note', heightCm: 170, starter: true, assetRev: 'x', createdAt: 9 }, RENUMBER['starter-model-6']);
  assert.deepEqual(r6, { id: 'starter-exact-4', name: 'Model 4', note: 'my note', heightCm: 170, starter: true, assetRev: 'x', createdAt: 9 });
  assert.equal(renumberedStarter({ id: 'starter-model-2', name: 'Curly (mine)', starter: true }, RENUMBER['starter-model-2']).name, 'Curly (mine)'); // user's name kept
  assert.equal(renumberedStarter({ id: 'starter-model-2', name: 'Model 2', starter: true }, RENUMBER['starter-model-2']).name, 'Photoreal 1');
  assert.equal(renumberedStarter({ id: 'starter-model-3', name: 'Model 3', starter: true }, RENUMBER['starter-model-3']).name, 'Model 2');
  assert.deepEqual(DELETED_STARTER_IDS, ['starter-model-5']);
  // knownStarters: mapped, old Model 5 dropped, deleted starters stay known (never re-added), idempotent
  const k = renumberedKnown(['starter-model-1', 'starter-model-2', 'starter-model-3', 'starter-model-4', 'starter-model-5', 'starter-model-6']);
  assert.deepEqual(k, ['starter-exact-1', 'starter-photoreal-1', 'starter-exact-2', 'starter-exact-3', 'starter-exact-4']);
  assert.deepEqual(renumberedKnown(k), k);
  assert.deepEqual(startersToAdd(STARTERS, k).map(s => s.id), ['starter-exact-5']);                // only the re-added Model 5 is new; nothing duplicated / resurrected
  assert.deepEqual(startersToAdd(STARTERS, withKnown(k, ['starter-exact-5'])), []);
  assert.equal(renumberedKnown(undefined), undefined);
  // legacy install that only ever had Models 1+2: the exact models 2-4 are offered once
  assert.deepEqual(startersToAdd(STARTERS, renumberedKnown(['starter-model-1', 'starter-model-2'])).map(s => s.id), ['starter-exact-2', 'starter-exact-3', 'starter-exact-4', 'starter-exact-5']);
  // looks follow their model; Model 5's user looks detached, its app-seeded sample looks removed; others untouched
  const sample2 = { id: 'sample-look-model-2-front', modelId: 'starter-model-2', sample: true, source: 'sample', title: 'Edited' };
  assert.deepEqual(renumberedLook(sample2), { ...sample2, modelId: 'starter-photoreal-1' });
  assert.equal(renumberedLook({ id: 'g', modelId: 'starter-model-6', source: 'generated' }).modelId, 'starter-exact-4');
  assert.deepEqual(renumberedLook({ id: 'g5', modelId: 'starter-model-5', source: 'generated', title: 'mine' }), { id: 'g5', modelId: null, source: 'generated', title: 'mine' });
  assert.equal(renumberedLook({ id: 's5', modelId: 'starter-model-5', sample: true, source: 'sample' }), null);
  const u = { id: 'u', modelId: 'user-1' }; assert.equal(renumberedLook(u), u);
  const done = { id: 'n', modelId: 'starter-exact-2' }; assert.equal(renumberedLook(done), done);   // idempotent
});
