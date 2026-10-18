import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

test('exact-reference starters (Model 1 and 3+) ship the same four WebP images at Model 1\'s sizes', () => {
  const read = (s, k) => readFileSync(new URL(`../assets/models/${s.file}-${k}.webp`, import.meta.url));
  const m1 = STARTERS.find(s => s.id === 'starter-model-1'); const ref = Object.fromEntries(IMAGE_KEYS.map(k => [k, webpSize(read(m1, k))]));
  assert.deepEqual(ref, { sheet: [1500, 1500], front: [1025, 1536], back: [1023, 1535], thumb: [360, 539] });
  // Model 2 predates the exact-reference pipeline (slightly different crops), so it is the one exception
  for (const s of STARTERS.filter(s => s.id !== 'starter-model-2')) for (const k of IMAGE_KEYS) assert.deepEqual(webpSize(read(s, k)), ref[k], `${s.file}-${k}.webp size`);
  assert.equal(new Set(STARTERS.map(s => s.id)).size, STARTERS.length, 'unique starter ids');
  for (const s of STARTERS) assert.match(s.assetRev, /^[0-9a-f]{12}$/);
});

test('new starters reach existing installs once; deleted starters are never re-added', () => {
  const ids = STARTERS.map(s => s.id);
  assert.ok(ids.length >= 6 && LEGACY_STARTER_IDS.every(id => ids.includes(id)));
  // legacy install (no knownStarters yet) that still has Model 1 and a user model, and deleted Model 2
  const legacy = initialKnownStarters([{ id: 'starter-model-1', starter: true }, { id: 'u1', starter: false }]);
  assert.deepEqual(legacy, LEGACY_STARTER_IDS);                                              // Model 2 counts as known → stays deleted
  const add = startersToAdd(STARTERS, legacy).map(s => s.id);
  assert.deepEqual(add, ids.filter(id => !LEGACY_STARTER_IDS.includes(id)));                // only the newly shipped ones, in order
  assert.ok(!add.includes('u1') && !add.includes('starter-model-2'));
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
