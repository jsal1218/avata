// Keeps the bundled starter models (and their sample looks) in step with the shipped assets.
// Pure helpers only (no IndexedDB), so they can be unit-tested in Node. store.js does the I/O.
// Each starter in starters.js carries `assetRev` = contentRev() of its four shipped images. When a stored
// starter's assetRev differs, only its image fields are replaced; name, notes, measurements and everything
// else the user may have edited are kept. User-created models and user/generated looks are never touched.
export const IMAGE_KEYS = ['sheet', 'front', 'back', 'thumb'];

/* ---------- outfits ----------
 * A starter may ship several outfits of the same model (e.g. Generated 1: Base, Summer denim, Sundress, Linen set):
 *   outfits: [{ id: 'base', name: 'Base', file: 'generated-1' }, { id: 'sundress', name: 'Sundress', subtitle, file: 'generated-1-sundress' }, ...]
 * The first outfit is the model's own images (file === starter.file), so every existing screen keeps using m.front /
 * m.back / m.sheet / m.thumb. The stored record gets outfits: [{ id, name, subtitle, sheet, front, back, thumb }] (Blobs),
 * all outfits included, and assetRev covers every outfit's images (base first), so changing any outfit refreshes it. */
export const starterOutfits = s => s.outfits?.length ? s.outfits : [{ id: 'base', name: 'Base', file: s.file }];

/** Short SHA-256 over the images in IMAGE_KEYS order (for a model with outfits: every outfit's images, in outfit order,
 *  i.e. pass blobs with blobs.outfits). null when crypto.subtle is unavailable (non-secure context). */
export async function contentRev(blobs) {
  const subtle = globalThis.crypto?.subtle; if (!subtle) return null;
  const sets = blobs.outfits?.length ? blobs.outfits : [blobs];
  const parts = await Promise.all(sets.flatMap(b => IMAGE_KEYS.map(k => b[k].arrayBuffer())));
  const all = new Uint8Array(parts.reduce((n, p) => n + p.byteLength, 0)); let o = 0;
  for (const p of parts) { all.set(new Uint8Array(p), o); o += p.byteLength; }
  return [...new Uint8Array(await subtle.digest('SHA-256', all))].slice(0, 6).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** A stored model needs new images only if it is still the bundled starter and its assets are from another revision. */
export const modelNeedsRefresh = (stored, starter) => !!stored && stored.starter === true && stored.id === starter.id && stored.assetRev !== starter.assetRev;

/** Only untouched-origin sample looks (seeded by the app, never generated/imported by the user) are refreshed. */
export const lookNeedsRefresh = (stored, sample, starter) => !!stored && stored.id === sample.id && stored.sample === true && stored.source === 'sample' && stored.modelId === starter.id && stored.assetRev !== starter.assetRev;

/** New model record: every existing field kept, only the image fields + assetRev replaced. */
export const refreshedModel = (stored, starter, blobs) => ({ ...stored, ...Object.fromEntries(IMAGE_KEYS.map(k => [k, blobs[k]])), ...(blobs.outfits ? { outfits: blobs.outfits } : {}), assetRev: starter.assetRev });

/** New sample-look record: title, tags, favourite, links etc. kept; only image/thumb + assetRev replaced. */
export const refreshedLook = (stored, starter, blob) => ({ ...stored, image: blob, thumb: blob, assetRev: starter.assetRev });

/** Which shipped image a sample look shows (sample looks use the model's sheet/front/back file directly). */
export const lookImageKey = sample => IMAGE_KEYS.includes(sample.view) ? sample.view : 'front';

/* ---------- new starters on existing installs ----------
 * kv 'knownStarters' = ids of every bundled starter this install has ever been given (kept OR deleted by the user).
 * A starter shipped later (not in the list) is added once on the next launch and then recorded, so deleting it later
 * sticks. Installs from before this list existed were seeded with exactly LEGACY_STARTER_IDS, so those count as known
 * (a legacy starter the user deleted is never re-added). User models, looks and edits are never read or changed. */
export const LEGACY_STARTER_IDS = ['starter-exact-1', 'starter-photoreal-1']; // the original Model 1 + Model 2 (renumbered ids; Model 1 itself was removed 2026-10-18, its id stays known)

/** Known-starter list for an install that has none yet: the legacy seed set plus any starter records it still holds. */
export const initialKnownStarters = (storedModels = []) =>
  [...new Set([...LEGACY_STARTER_IDS, ...storedModels.filter(m => m && m.starter === true && typeof m.id === 'string').map(m => m.id)])];

/** Shipped starters this install has never been given, in STARTERS order. */
export const startersToAdd = (starters, known) => { const k = new Set(known || []); return starters.filter(s => !k.has(s.id)); };

/** Known list after offering `ids` (order-preserving, no duplicates). */
export const withKnown = (known, ids) => [...new Set([...(known || []), ...ids])];

/** Model record for a newly added starter (same shape seedStarters writes). rev = verified assetRev or undefined. */
export const newStarterRecord = (starter, blobs, rev, createdAt) => {
  const { file, assetRev, outfits, ...rest } = starter;
  return { ...rest, ...Object.fromEntries(IMAGE_KEYS.map(k => [k, blobs[k]])), ...(blobs.outfits ? { outfits: blobs.outfits } : {}), ...(rev ? { assetRev: rev } : {}), starter: true, createdAt };
};

/* ---------- 2026-10 renumbering ----------
 * Old ids → new stable ids. The old Model 5 was deleted; Model 2 (AI photoreal frames) became Photoreal 1; the exact-
 * reference models were renumbered Model 1-4. On existing installs renumberStarters() (store.js) re-keys each old starter
 * record (starter === true only) keeping every field the user edited; the default name follows the renumbering, a name the
 * user chose is kept. Looks follow their model; looks of the deleted Model 5 are detached (app-seeded sample looks of
 * it are removed). knownStarters is mapped too, so deleted starters stay deleted and nothing is added twice. */
export const RENUMBER = {
  'starter-model-1': { id: 'starter-exact-1', oldName: 'Model 1', name: 'Model 1' },
  'starter-model-2': { id: 'starter-photoreal-1', oldName: 'Model 2', name: 'Photoreal 1' },
  'starter-model-3': { id: 'starter-exact-2', oldName: 'Model 3', name: 'Model 2' },
  'starter-model-4': { id: 'starter-exact-3', oldName: 'Model 4', name: 'Model 3' },
  'starter-model-6': { id: 'starter-exact-4', oldName: 'Model 6', name: 'Model 4' },
};
export const DELETED_STARTER_IDS = ['starter-model-5'];

/** Old starter record → the same record under its new id (all fields kept; default name renumbered). */
export const renumberedStarter = (stored, to) => ({ ...stored, id: to.id, name: stored.name === to.oldName ? to.name : stored.name });

/** knownStarters after the renumbering (non-arrays, i.e. "not recorded yet", pass through unchanged). */
export const renumberedKnown = known => Array.isArray(known)
  ? [...new Set(known.filter(id => !DELETED_STARTER_IDS.includes(id)).map(id => RENUMBER[id]?.id || id))] : known;

/** What to do with a stored look: the same object (unchanged), a relinked copy, or null (delete: an app-seeded sample
 *  look of a deleted starter). User/generated looks of a deleted starter are kept and detached (modelId null). */
export const renumberedLook = look => {
  if (!look) return look;
  if (RENUMBER[look.modelId]) return { ...look, modelId: RENUMBER[look.modelId].id };
  if (DELETED_STARTER_IDS.includes(look.modelId)) return look.sample === true && look.source === 'sample' ? null : { ...look, modelId: null };
  return look;
};

/* ---------- 2026-10-18 removal of Models 1-4, 8, 11, 15, 16 (Jordan's request) ----------
 * These starters are no longer shipped. On existing installs removeStarters() (store.js) deletes each of their starter
 * records (starter === true only, whatever the user renamed it to) once; user-created models are never touched.
 * App-seeded sample looks of a removed starter (Model 1's) are removed; the user's own / generated looks of a removed
 * starter are kept and detached (modelId null), like the old Model 5. The ids stay in knownStarters, and they are not in
 * STARTERS, so seedStarters / addNewStarters / syncStarters can never bring them back. The remaining models keep
 * their labels (Model 5, 6, 7, 9, 10, 12, 13, 14); nothing is renumbered. */
export const REMOVED_STARTER_IDS = [1, 2, 3, 4, 8, 11, 15, 16].map(n => `starter-exact-${n}`);

/** What to do with a stored look after the removal: unchanged (same object), detached copy, or null (delete). */
export const removedLook = look => {
  if (!look || !REMOVED_STARTER_IDS.includes(look.modelId)) return look;
  return look.sample === true && look.source === 'sample' ? null : { ...look, modelId: null };
};

/** knownStarters after the removal: the removed ids are recorded as known (so nothing re-adds them); non-arrays pass through. */
export const removedKnown = known => Array.isArray(known) ? withKnown(known, REMOVED_STARTER_IDS) : known;

/* ---------- 2026-10-18 renumbering, round 2 (after the removal) ----------
 * Jordan asked for continuous numbers again: the remaining exact models (old Model 5, 6, 7, 9, 10, 12, 13, 14) are now
 * Model 1-8, in the same order. Ids stay the same (stable ids: only display names change, so no record is re-keyed and
 * nothing can be duplicated or re-added). relabelStarters() (store.js) renames each starter record once, only if it still
 * has the old default name; a name the user chose is kept. User-created models (starter !== true) are never touched. */
export const RELABEL = {
  'starter-exact-5': { oldName: 'Model 5', name: 'Model 1' },
  'starter-exact-6': { oldName: 'Model 6', name: 'Model 2' },
  'starter-exact-7': { oldName: 'Model 7', name: 'Model 3' },
  'starter-exact-9': { oldName: 'Model 9', name: 'Model 4' },
  'starter-exact-10': { oldName: 'Model 10', name: 'Model 5' },
  'starter-exact-12': { oldName: 'Model 12', name: 'Model 6' },
  'starter-exact-13': { oldName: 'Model 13', name: 'Model 7' },
  'starter-exact-14': { oldName: 'Model 14', name: 'Model 8' },
};

/** Stored record after the relabel: the same object when nothing changes (not a starter, user-chosen name, already done). */
export const relabeledStarter = stored => {
  const to = stored && stored.starter === true && RELABEL[stored.id];
  return to && stored.name === to.oldName ? { ...stored, name: to.name } : stored;
};

/* ---------- list order ----------
 * The Models tab lists models in S.models order. Starters added to an existing install later (addNewStarters) get a
 * newer createdAt, so sorting by createdAt alone would show e.g. Model 1-5, Photoreal 1, <user models>, Model 6-10.
 * orderedModels() shows bundled starters first in their canonical STARTERS order (Model 1..N, then Photoreal N) and then
 * every other model (user-created) in createdAt order, exactly like a fresh install. Pure: no record is changed, so user
 * models keep their relative order and nothing is migrated. Starter = starter === true with a shipped STARTERS id. */
export const orderedModels = (models, starters) => {
  const rank = new Map(starters.map((s, i) => [s.id, i]));
  const isStarter = m => m && m.starter === true && rank.has(m.id);
  const byTime = (a, b) => (a.createdAt || 0) - (b.createdAt || 0);
  return [...models.filter(isStarter).sort((a, b) => rank.get(a.id) - rank.get(b.id)), ...models.filter(m => !isStarter(m)).sort(byTime)];
};
