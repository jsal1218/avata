import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { STARTERS, SAMPLE_LOOKS } from '../js/starters.js';
import { REMOVED_STARTER_IDS, removedLook, removedKnown, RELABEL, relabeledStarter } from '../js/starter-sync.js';
const KEEP = [12, 26, 6, 14, 13]; // exact starter ids after the 2026-10-18, 2026-10-21 and 2026-10-22 removals (exact-21 too), in the 2026-10-22 order; labelled Model 1-5 in this order
import { contentRev, modelNeedsRefresh, lookNeedsRefresh, refreshedModel, refreshedLook, IMAGE_KEYS } from '../js/starter-sync.js';

const files = file => Object.fromEntries(IMAGE_KEYS.map(k => [k, new Blob([readFileSync(new URL(`../assets/models/${file}-${k}.webp`, import.meta.url))])]));
// what store.js fetchStarterImages() returns: the four images, plus every outfit's four images for a starter with outfits
const shipped = s => s.outfits ? { ...files(s.file), outfits: s.outfits.map(o => ({ id: o.id, name: o.name, ...files(o.file) })) } : files(s.file);

test('each starter assetRev matches its shipped images (bump assetRev when assets change)', async () => {
  for (const s of STARTERS) assert.equal(await contentRev(shipped(s)), s.assetRev, `${s.id}: set assetRev to the new hash`);
});

test('refresh decision: only stale bundled starters / app-seeded sample looks', () => {
  const s = STARTERS.find(x => x.id === 'starter-exact-6'), sample = { id: 'sample-look-x-front', modelId: s.id, view: 'front' }; // no sample looks ship now (the last went with Photoreal 1)
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

test('every starter (Model 1-17) and every built-in outfit ship the same four WebP images at Model 1\'s sizes', () => {
  const read = (s, k) => readFileSync(new URL(`../assets/models/${s.file}-${k}.webp`, import.meta.url));
  const m1 = STARTERS.find(s => s.id === 'starter-exact-6'); /* old Model 1 removed; every exact starter shares her sizes */ const ref = Object.fromEntries(IMAGE_KEYS.map(k => [k, webpSize(read(m1, k))]));
  assert.deepEqual(ref, { sheet: [1500, 1500], front: [1025, 1536], back: [1023, 1535], thumb: [360, 539] });
  for (const s of STARTERS) for (const o of (s.outfits || [s])) for (const k of IMAGE_KEYS) assert.deepEqual(webpSize(read(o, k)), ref[k], `${o.file}-${k}.webp size`);
  assert.equal(new Set(STARTERS.map(s => s.id)).size, STARTERS.length, 'unique starter ids');
  for (const s of STARTERS) assert.match(s.assetRev, /^[0-9a-f]{12}$/);
});

test('new starters reach existing installs once; deleted starters are never re-added', () => {
  const ids = STARTERS.map(s => s.id);
  assert.ok(ids.length === 5 && !ids.some(id => id.startsWith('starter-generated-')) && !ids.includes('starter-photoreal-1') && !ids.includes('starter-photoreal-2') && !ids.includes('starter-exact-1')); // legacy Model 1 itself was removed
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

test('lineup: Model 1-18 only (renumbered, stable ids); removed models (incl. Photoreal 1-2, Generated 1-3) gone', () => {
  assert.deepEqual(STARTERS.map(s => [s.id, s.name, s.file]), [
    ...KEEP.map((n, i) => [`starter-exact-${n}`, `Model ${i + 1}`, `exact-${n}`])]);
  assert.deepEqual(STARTERS.map(s => s.note.split(',')[0]), ['Black hair in a high bun',
    'Long wavy blonde hair', 'Long straight pink hair', 'Natural curly hair in a high puff', 'Long wavy black hair with braids']);
  assert.ok(!STARTERS.some(s => s.id === 'starter-model-5'), 'old Model 5 id is gone (re-added under the new id starter-exact-5)');
  assert.ok(!existsSync(new URL('../assets/models/model-5-front.webp', import.meta.url)) && !existsSync(new URL('../assets/models/model-6-front.webp', import.meta.url)));
  // every renumber target is a shipped starter; sample looks follow their models
  // (renumber targets are shipped starters or since removed ones)
  for (const to of Object.values(RENUMBER)) assert.ok(STARTERS.some(s => s.id === to.id && s.name === to.name) || REMOVED_STARTER_IDS.includes(to.id), to.id);
  for (const id of REMOVED_STARTER_IDS) { assert.ok(!STARTERS.some(s => s.id === id), id); const f = id.replace('starter-', ''); for (const k of IMAGE_KEYS) assert.ok(!existsSync(new URL(`../assets/models/${f}-${k}.webp`, import.meta.url)), `${f}-${k} removed`); }
  assert.deepEqual(SAMPLE_LOOKS, []);   // the last sample looks (Photoreal 1's) were removed with her
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
  const kept = KEEP.map(n => `starter-exact-${n}`); // every kept exact starter
  assert.deepEqual(startersToAdd(STARTERS, k).map(s => s.id), kept);      // only the kept exact starters are new; nothing duplicated / resurrected
  assert.deepEqual(startersToAdd(STARTERS, withKnown(k, kept)), []);
  assert.equal(renumberedKnown(undefined), undefined);
  // legacy install that only ever had Models 1+2: the remaining exact models are offered once (removed ones never)
  assert.deepEqual(startersToAdd(STARTERS, renumberedKnown(['starter-model-1', 'starter-model-2'])).map(s => s.id), [...KEEP.map(n => `starter-exact-${n}`)]);
  // looks follow their model; Model 5's user looks detached, its app-seeded sample looks removed; others untouched
  const sample2 = { id: 'sample-look-model-2-front', modelId: 'starter-model-2', sample: true, source: 'sample', title: 'Edited' };
  assert.deepEqual(renumberedLook(sample2), { ...sample2, modelId: 'starter-photoreal-1' });
  assert.equal(renumberedLook({ id: 'g', modelId: 'starter-model-6', source: 'generated' }).modelId, 'starter-exact-4');
  assert.deepEqual(renumberedLook({ id: 'g5', modelId: 'starter-model-5', source: 'generated', title: 'mine' }), { id: 'g5', modelId: null, source: 'generated', title: 'mine' });
  assert.equal(renumberedLook({ id: 's5', modelId: 'starter-model-5', sample: true, source: 'sample' }), null);
  const u = { id: 'u', modelId: 'user-1' }; assert.equal(renumberedLook(u), u);
  const done = { id: 'n', modelId: 'starter-exact-2' }; assert.equal(renumberedLook(done), done);   // idempotent
});

import { orderedModels } from '../js/starter-sync.js';

test('Models tab order: starters in canonical order (Model 1-17), then user models in their own createdAt order', () => {
  const ids = STARTERS.map(s => s.id);
  // install from the Model 1-5 release: Model 1-5 + Photoreal 1 seeded, user models made later, Models 6-10 added later still
  const recs = [
    { id: 'starter-exact-6', starter: true, createdAt: 300 },             // added by addNewStarters after the user's first model
    { id: 'u-b', starter: false, createdAt: 250, name: 'Mine B' }, { id: 'u-a', starter: false, createdAt: 200, name: 'Mine A' },
    { id: 'u-c', starter: false, createdAt: 400, name: 'Model 7' },        // user model that happens to share a starter's name
    ...[26, 14, 13, 12].map((n, i) => ({ id: `starter-exact-${n}`, starter: true, createdAt: 500 + i })),   // the other kept exact starters, added later, added later (any createdAt order)
  ];
  const shuffled = [...recs].reverse();
  const out = orderedModels(shuffled, STARTERS).map(m => m.id);
  assert.deepEqual(out, [...ids, 'u-a', 'u-b', 'u-c']);
  // a user-created record that reuses a starter-like id but is not a starter (starter !== true) stays with the user models
  assert.deepEqual(orderedModels([{ id: 'starter-exact-12', starter: false, createdAt: 1 }, { id: 'starter-exact-6', starter: true, createdAt: 9 }], STARTERS).map(m => [m.id, m.starter]),
    [['starter-exact-6', true], ['starter-exact-12', false]]);
  // deleted starters simply are absent; records are returned unchanged (same objects, nothing migrated)
  const few = [{ id: 'u', starter: false, createdAt: 1 }, { id: 'starter-exact-26', starter: true, createdAt: 2 }, { id: 'starter-exact-12', starter: true, createdAt: 3 }];
  const o = orderedModels(few, STARTERS); assert.deepEqual(o.map(m => m.id), ['starter-exact-12', 'starter-exact-26', 'u']); assert.ok(o.every(m => few.includes(m)));
  assert.deepEqual(orderedModels([], STARTERS), []);
});

import { starterOutfits } from '../js/starter-sync.js';

test('built-in outfits (Model 12 = exact-26 as the example): one record, assetRev covers every outfit, refresh keeps edits', async () => {
  const g = STARTERS.find(s => s.id === 'starter-exact-26');
  assert.equal(STARTERS[1], g); assert.ok(STARTERS.every(s => !s.source), 'no generated starters remain');
  assert.equal(g.outfits[0].file, g.file, 'first outfit = the model\'s own images');
  for (const o of g.outfits) for (const k of IMAGE_KEYS) assert.ok(existsSync(new URL(`../assets/models/${o.file}-${k}.webp`, import.meta.url)), `${o.file}-${k}`);
  // no outfit is a separate model; other starters have just their base
  assert.deepEqual(STARTERS.filter(s => /generated/.test(s.id)).map(s => s.id), []);
  for (const s of STARTERS.filter(s => s.id !== 'starter-exact-5' && s.id !== 'starter-exact-6' && s.id !== 'starter-exact-26')) assert.deepEqual(starterOutfits(s), [{ id: 'base', name: 'Base', file: s.file }]);
  // the outfits' images differ (no duplicate outfit) and assetRev covers all of them (changing any outfit changes it)
  const b = shipped(g), fronts = await Promise.all(b.outfits.map(o => o.front.arrayBuffer().then(x => Buffer.from(x).toString('base64'))));
  assert.equal(new Set(fronts).size, g.outfits.length);
  assert.notEqual(await contentRev(files(g.file)), g.assetRev, 'rev is not just the base images');
  const swapped = { ...b, outfits: [b.outfits[0], b.outfits[2], b.outfits[1], b.outfits[3]] };
  assert.notEqual(await contentRev(swapped), g.assetRev);
  // the stored record carries every outfit (Blobs) and no file names; the top-level images are the base outfit
  const r = newStarterRecord(g, b, g.assetRev, 1);
  assert.deepEqual(r.outfits.map(o => o.id), g.outfits.map(o => o.id)); assert.equal(r.outfits.length, 17); assert.ok(r.outfits.every(o => IMAGE_KEYS.every(k => o[k] instanceof Blob) && !('file' in o)));
  for (const k of IMAGE_KEYS) assert.equal(r[k], b[k]);
  // a refresh replaces the outfit images too, keeping the user's edits
  const old = { ...r, name: 'Gen (mine)', outfits: [r.outfits[0]], assetRev: 'old' };
  const nr = refreshedModel(old, g, b); assert.equal(nr.name, 'Gen (mine)'); assert.equal(nr.outfits.length, 17); assert.equal(nr.assetRev, g.assetRev);
  // a plain starter record never gains an outfits field
  const p = STARTERS.find(s => !s.outfits); assert.ok(!('outfits' in newStarterRecord(p, shipped(p), p.assetRev, 1)));
});

test('removal of Models 1-4, 8, 11, 15, 16, Photoreal 1-2 and Generated 1-3: starter records dropped once, sample looks removed, user looks detached, never re-added', () => {
  assert.deepEqual(REMOVED_STARTER_IDS, ['starter-exact-1', 'starter-exact-2', 'starter-exact-3', 'starter-exact-4', 'starter-exact-8', 'starter-exact-11', 'starter-exact-15', 'starter-exact-16', 'starter-photoreal-1', 'starter-photoreal-2', 'starter-generated-1', 'starter-generated-2', 'starter-generated-3', 'starter-exact-17', 'starter-exact-20', 'starter-exact-22', 'starter-exact-23', 'starter-exact-24', 'starter-exact-25', 'starter-exact-5', 'starter-exact-7', 'starter-exact-9', 'starter-exact-10', 'starter-exact-18', 'starter-exact-19', 'starter-exact-21']);
  // 2026-10-21: Model 9, 12, 14 (exact-17, 20, 22): their own looks kept, detached
  for (const id of ['starter-exact-17', 'starter-exact-20', 'starter-exact-22', 'starter-exact-23', 'starter-exact-24', 'starter-exact-25']) assert.deepEqual(removedLook({ id: 'y', modelId: id, source: 'generated' }), { id: 'y', modelId: null, source: 'generated' });
  // looks: app-seeded sample looks of a removed starter go; the user's own / generated looks are kept, detached; others untouched (same object)
  assert.equal(removedLook({ id: 'sample-look-model-1-front', modelId: 'starter-exact-1', sample: true, source: 'sample', favorite: true }), null);
  assert.deepEqual(removedLook({ id: 'g', modelId: 'starter-exact-8', source: 'generated', title: 'mine' }), { id: 'g', modelId: null, source: 'generated', title: 'mine' });
  for (const l of [{ id: 'a', modelId: 'starter-exact-12' }, { id: 'b', modelId: 'user-1' }, { id: 'c', modelId: null }, { id: 'g3', modelId: 'starter-exact-6', sample: true, source: 'sample' }]) assert.equal(removedLook(l), l);
  // Generated 1-3: the user's own looks of them are kept, detached; none re-added
  for (const id of ['starter-generated-1', 'starter-generated-2', 'starter-generated-3']) assert.deepEqual(removedLook({ id: 'x', modelId: id, source: 'generated', title: 'mine', favorite: true }), { id: 'x', modelId: null, source: 'generated', title: 'mine', favorite: true });
  // Photoreal 1's app-seeded sample looks go with her; the user's own looks of Photoreal 1/2 are kept, detached
  assert.equal(removedLook({ id: 'sample-look-model-2-front', modelId: 'starter-photoreal-1', sample: true, source: 'sample' }), null);
  assert.deepEqual(removedLook({ id: 'm', modelId: 'starter-photoreal-2', source: 'generated' }), { id: 'm', modelId: null, source: 'generated' });
  // known list gains the removed ids (idempotent); nothing is offered again, whatever an install knew before
  const k = removedKnown(['starter-exact-1', 'starter-photoreal-1', 'starter-exact-5']);
  assert.deepEqual(removedKnown(k), k); assert.equal(removedKnown(undefined), undefined);
  for (const known of [k, undefined, [], ['starter-exact-1', 'starter-photoreal-1'], renumberedKnown(['starter-model-1', 'starter-model-2', 'starter-model-3'])])
    assert.ok(!startersToAdd(STARTERS, known).some(s => REMOVED_STARTER_IDS.includes(s.id)));
  // a leftover removed starter record (should it survive) is never refreshed, and orders like a non-starter
  for (const s of STARTERS) assert.equal(modelNeedsRefresh({ id: 'starter-exact-1', starter: true }, s), false);
});

test('relabel to Model 1-5 (2026-10-22; ids unchanged): default names follow from any earlier default, user names / user models / other fields kept, idempotent', () => {
  assert.deepEqual(Object.entries(RELABEL).map(([id, r]) => [id, r.name]), KEEP.map((n, i) => [`starter-exact-${n}`, `Model ${i + 1}`]));
  for (const [id, r] of Object.entries(RELABEL)) assert.equal(STARTERS.find(s => s.id === id).name, r.name, 'shipped name = new label');
  // every earlier default name (2026-10-18 original, after the 10-18 relabel, after the 10-21 relabel) maps to the new label
  const hist = { 6: ['Model 6', 'Model 2', 'Model 1'], 12: ['Model 12', 'Model 6', 'Model 2'], 13: ['Model 13', 'Model 7', 'Model 3'], 14: ['Model 14', 'Model 8'], 26: ['Model 18', 'Model 15', 'Model 12', 'Model 6', 'Model 5'] };
  KEEP.forEach((n, i) => { for (const old of hist[n]) { const m = { id: `starter-exact-${n}`, name: old, note: 'mine', heightCm: 170, starter: true, assetRev: 'x', createdAt: 3 };
    assert.deepEqual(relabeledStarter(m), { ...m, name: `Model ${i + 1}` }); assert.equal(relabeledStarter(relabeledStarter(m)).name, `Model ${i + 1}`); } });   // idempotent, no chain
  for (const [id, r] of Object.entries(RELABEL)) { const done = { id, name: r.name, starter: true }; assert.equal(relabeledStarter(done), done); }   // already new
  const renamed = { id: 'starter-exact-6', name: 'Pink (mine)', starter: true }; assert.equal(relabeledStarter(renamed), renamed);
  const user = { id: 'u', name: 'Model 6', starter: false }; assert.equal(relabeledStarter(user), user);  // user model named like a starter
  const notStarter = { id: 'starter-exact-12', name: 'Model 12', starter: false }; assert.equal(relabeledStarter(notStarter), notStarter);
  assert.equal(relabeledStarter({ id: 'starter-exact-5', name: 'Model 1', starter: true }).name, 'Model 1');
  for (const r of Object.values(RELABEL)) assert.ok(!r.oldName.includes(r.name), 'no list contains its own new name');   // removed ids are not relabelled (removeStarters drops them)
  assert.equal(relabeledStarter(undefined), undefined);
  // a full install of any earlier lineup relabels its survivors to unique Model 1-5
  const after = KEEP.map(n => relabeledStarter({ id: `starter-exact-${n}`, name: hist[n][hist[n].length - 1], starter: true }).name);
  assert.deepEqual(after, KEEP.map((_, i) => `Model ${i + 1}`)); assert.equal(new Set(after).size, KEEP.length);
});

test('Photorealistic section removed (2026-10-19): Photoreal 1-2 not shipped, never offered again', () => {
  assert.ok(!STARTERS.some(s => /photoreal/.test(s.id)));
  for (const k of IMAGE_KEYS) assert.ok(!existsSync(new URL(`../assets/models/photoreal-1-${k}.webp`, import.meta.url)), `photoreal-1-${k} archived`);
  // an install that had both (known list incl. them) is offered nothing; one that never saw them is not offered them either
  const all = STARTERS.map(s => s.id);
  assert.deepEqual(startersToAdd(STARTERS, removedKnown(all.concat(['starter-photoreal-1', 'starter-photoreal-2']))), []);
  assert.deepEqual(startersToAdd(STARTERS, all), []);
});

test('Generated section removed (2026-10-21): Generated 1-3 not shipped, files archived, never offered again; Model 2 keeps all six outfits under her own files', () => {
  assert.ok(!STARTERS.some(s => /generated/.test(s.id) || s.source === 'generated'));
  for (const f of ['generated-1', 'generated-1-summer-denim', 'generated-1-sundress', 'generated-1-linen-set', 'generated-2', 'generated-2-yoga-set', 'generated-3', 'generated-3-turtleneck', 'generated-3-slip-dress', 'generated-3-tank-shorts'])
    for (const k of IMAGE_KEYS) assert.ok(!existsSync(new URL(`../assets/models/${f}-${k}.webp`, import.meta.url)), `${f}-${k} archived`);
  const m2 = STARTERS.find(s => s.id === 'starter-exact-6');
  assert.deepEqual(m2.outfits.map(o => o.file), ['exact-6', 'exact-6-yoga-set', 'exact-6-turtleneck', 'exact-6-slip-dress', 'exact-6-tank-shorts', 'exact-6-usa-jersey']);
  for (const s of STARTERS) for (const o of (s.outfits || [s])) assert.ok(!/generated/.test(o.file), o.file);
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8'); assert.ok(!/generated-\d/.test(sw), 'sw.js precaches no generated-* files');
  for (const o of m2.outfits.slice(1)) assert.ok(sw.includes(`'${o.file}'`), `${o.file} precached`);
  // installs that had them (known, whatever they were renamed to) are offered nothing; one that never saw them is not offered them either
  const all = STARTERS.map(s => s.id), gen = ['starter-generated-1', 'starter-generated-2', 'starter-generated-3'];
  assert.deepEqual(startersToAdd(STARTERS, removedKnown(all.concat(gen))), []); assert.deepEqual(startersToAdd(STARTERS, all), []);
  assert.ok(gen.every(id => removedKnown([]).includes(id)));
  for (const s of STARTERS) assert.equal(modelNeedsRefresh({ id: 'starter-generated-3', name: 'Pink black (mine)', starter: true }, s), false);
});

test('Model 1, 3, 4, 5, 9, 10 (exact-5, 7, 9, 10, 18, 19) removed 2026-10-22: not shipped, files gone, never offered again, user looks kept', () => {
  const gone = [5, 7, 9, 10, 18, 19];
  for (const n of gone) { const id = `starter-exact-${n}`; assert.ok(!STARTERS.some(s => s.id === id) && REMOVED_STARTER_IDS.includes(id), id);
    assert.deepEqual(removedLook({ id: 'y', modelId: id, source: 'generated', title: 'mine' }), { id: 'y', modelId: null, source: 'generated', title: 'mine' }); }
  for (const f of ['exact-5', 'exact-5-tank-shorts', 'exact-5-yoga-set', 'exact-5-linen-set', 'exact-5-red-dress', ...gone.slice(1).map(n => `exact-${n}`)])
    for (const k of IMAGE_KEYS) assert.ok(!existsSync(new URL(`../assets/models/${f}-${k}.webp`, import.meta.url)), `${f}-${k} archived`);
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8'); assert.ok(!/exact-5-|\[5, |, (7|9|10|18|19),/.test(sw), 'sw.js precaches none of them');
  // installs that had them (any state) are offered nothing removed; one that never saw them is not offered them either
  const all = STARTERS.map(s => s.id);
  assert.deepEqual(startersToAdd(STARTERS, removedKnown(all.concat(gone.map(n => `starter-exact-${n}`)))), []); assert.deepEqual(startersToAdd(STARTERS, all), []);
  for (const known of [undefined, [], removedKnown([])]) assert.ok(!startersToAdd(STARTERS, known).some(s => REMOVED_STARTER_IDS.includes(s.id)));
  assert.deepEqual(STARTERS.map(s => s.name), ['Model 1', 'Model 2', 'Model 3', 'Model 4', 'Model 5']);
});

test('Model 2 gains built-in Yoga set plus Generated 3\'s Turtleneck, Slip dress, Tank & shorts (her own copies) and USA jersey on her own record; existing installs refresh her in place, edits kept', async () => {
  const m = STARTERS.find(s => s.id === 'starter-exact-6');
  assert.equal(STARTERS[2], m); assert.equal(m.name, 'Model 3'); assert.ok(!m.source);
  assert.deepEqual(m.outfits.map(o => [o.id, o.name, o.file]), [['base', 'Base', 'exact-6'], ['yoga-set', 'Yoga set', 'exact-6-yoga-set'], ['turtleneck', 'Turtleneck', 'exact-6-turtleneck'], ['slip-dress', 'Slip dress', 'exact-6-slip-dress'], ['tank-shorts', 'Tank & shorts', 'exact-6-tank-shorts'], ['usa-jersey', 'USA jersey', 'exact-6-usa-jersey']]);
  for (const o of m.outfits) for (const k of IMAGE_KEYS) assert.ok(existsSync(new URL(`../assets/models/${o.file}-${k}.webp`, import.meta.url)), `${o.file}-${k}`);
  const b = shipped(m); assert.equal(await contentRev(b), m.assetRev); assert.ok(!['16bc8fba9dc6', 'd833e5ca404f', '2be37db713de', '40a08b9f6a2a'].includes(m.assetRev), 'assetRev bumped (40a08b9f6a2a = before the 2026-10-22 barefoot fix)');
  for (const k of IMAGE_KEYS) assert.equal(Buffer.compare(Buffer.from(await b[k].arrayBuffer()), Buffer.from(await b.outfits[0][k].arrayBuffer())), 0, 'base images unchanged');
  const old = { id: m.id, name: 'Pink (mine)', heightCm: 171, starter: true, assetRev: '16bc8fba9dc6', createdAt: 5 };
  assert.equal(modelNeedsRefresh(old, m), true);
  const nr = refreshedModel(old, m, b); assert.equal(nr.name, 'Pink (mine)'); assert.equal(nr.heightCm, 171); assert.deepEqual(nr.outfits.map(o => o.id), ['base', 'yoga-set', 'turtleneck', 'slip-dress', 'tank-shorts', 'usa-jersey']); assert.equal(nr.assetRev, m.assetRev);
  const two = { ...old, assetRev: 'd833e5ca404f', outfits: [{ id: 'base' }, { id: 'yoga-set' }] }; assert.equal(modelNeedsRefresh(two, m), true);
  const nr2 = refreshedModel(two, m, b); assert.equal(nr2.name, 'Pink (mine)'); assert.equal(nr2.heightCm, 171); assert.deepEqual(nr2.outfits.map(o => o.id), ['base', 'yoga-set', 'turtleneck', 'slip-dress', 'tank-shorts', 'usa-jersey']);
  // an install with the shoes / socks images (rev 40a08b9f6a2a) refreshes in place to the barefoot ones, edits kept
  const shod = { ...old, assetRev: '40a08b9f6a2a', outfits: ['base', 'yoga-set', 'turtleneck', 'slip-dress', 'tank-shorts', 'usa-jersey'].map(id => ({ id })) }; assert.equal(modelNeedsRefresh(shod, m), true);
  const nr4 = refreshedModel(shod, m, b); assert.equal(nr4.name, 'Pink (mine)'); assert.equal(nr4.heightCm, 171); assert.equal(nr4.assetRev, m.assetRev);
  const five = { ...old, assetRev: '2be37db713de', outfits: [{ id: 'base' }, { id: 'yoga-set' }, { id: 'turtleneck' }, { id: 'slip-dress' }, { id: 'tank-shorts' }] }; assert.equal(modelNeedsRefresh(five, m), true);
  const nr3 = refreshedModel(five, m, b); assert.equal(nr3.name, 'Pink (mine)'); assert.equal(nr3.heightCm, 171); assert.deepEqual(nr3.outfits.map(o => o.id), ['base', 'yoga-set', 'turtleneck', 'slip-dress', 'tank-shorts', 'usa-jersey']);
  assert.equal(modelNeedsRefresh(nr, m), false);
  assert.ok(!STARTERS.some(s => s !== m && s.outfits?.some(o => o.file === 'exact-6-yoga-set')), 'not a separate model');
});

test('original Model 15, 16, 17 (exact-23, 24, 25) removed 2026-10-21: not shipped, files gone, never offered again', () => {
  for (const n of [23, 24, 25]) { const id = `starter-exact-${n}`; assert.ok(!STARTERS.some(s => s.id === id) && REMOVED_STARTER_IDS.includes(id)); assert.ok(!existsSync(new URL(`../assets/models/exact-${n}-front.webp`, import.meta.url))); }
  assert.ok(!existsSync(new URL('../assets/models/exact-25-red-dress-front.webp', import.meta.url)));
  assert.equal(STARTERS.find(s => s.id === 'starter-exact-26').name, 'Model 2');
});

test('Model 5 (exact-21, Base / Beige Linen / A) removed later 2026-10-22: not shipped, files gone, never offered again, user looks kept; exact-26 = Model 5', () => {
  const id = 'starter-exact-21'; assert.ok(!STARTERS.some(s => s.id === id) && REMOVED_STARTER_IDS.includes(id));
  for (const f of ['exact-21', 'exact-21-beige-linen', 'exact-21-a']) for (const k of IMAGE_KEYS) assert.ok(!existsSync(new URL(`../assets/models/${f}-${k}.webp`, import.meta.url)), `${f}-${k} archived`);
  assert.ok(!/exact-21|, 21,/.test(readFileSync(new URL('../sw.js', import.meta.url), 'utf8')), 'sw.js precaches none of her files');
  assert.deepEqual(removedLook({ id: 'y', modelId: id, source: 'generated', title: 'mine' }), { id: 'y', modelId: null, source: 'generated', title: 'mine' });
  assert.deepEqual(startersToAdd(STARTERS, removedKnown(STARTERS.map(s => s.id).concat([id]))), []); assert.ok(!startersToAdd(STARTERS, undefined).some(s => s.id === id));
  assert.ok(!(id in RELABEL)); assert.equal(relabeledStarter({ id: 'starter-exact-26', name: 'Model 6', starter: true }).name, 'Model 2'); assert.equal(relabeledStarter({ id: 'starter-exact-26', name: 'Model 5', starter: true }).name, 'Model 2');
});
