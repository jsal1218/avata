// Keeps the bundled starter models (and their sample looks) in step with the shipped assets.
// Pure helpers only (no IndexedDB), so they can be unit-tested in Node. store.js does the I/O.
// Each starter in starters.js carries `assetRev` = contentRev() of its four shipped images. When a stored
// starter's assetRev differs, only its image fields are replaced; name, notes, measurements and everything
// else the user may have edited are kept. User-created models and user/generated looks are never touched.
export const IMAGE_KEYS = ['sheet', 'front', 'back', 'thumb'];

/** Short SHA-256 over the images in IMAGE_KEYS order. null when crypto.subtle is unavailable (non-secure context). */
export async function contentRev(blobs) {
  const subtle = globalThis.crypto?.subtle; if (!subtle) return null;
  const parts = await Promise.all(IMAGE_KEYS.map(k => blobs[k].arrayBuffer()));
  const all = new Uint8Array(parts.reduce((n, p) => n + p.byteLength, 0)); let o = 0;
  for (const p of parts) { all.set(new Uint8Array(p), o); o += p.byteLength; }
  return [...new Uint8Array(await subtle.digest('SHA-256', all))].slice(0, 6).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** A stored model needs new images only if it is still the bundled starter and its assets are from another revision. */
export const modelNeedsRefresh = (stored, starter) => !!stored && stored.starter === true && stored.id === starter.id && stored.assetRev !== starter.assetRev;

/** Only untouched-origin sample looks (seeded by the app, never generated/imported by the user) are refreshed. */
export const lookNeedsRefresh = (stored, sample, starter) => !!stored && stored.id === sample.id && stored.sample === true && stored.source === 'sample' && stored.modelId === starter.id && stored.assetRev !== starter.assetRev;

/** New model record: every existing field kept, only the image fields + assetRev replaced. */
export const refreshedModel = (stored, starter, blobs) => ({ ...stored, ...Object.fromEntries(IMAGE_KEYS.map(k => [k, blobs[k]])), assetRev: starter.assetRev });

/** New sample-look record: title, tags, favourite, links etc. kept; only image/thumb + assetRev replaced. */
export const refreshedLook = (stored, starter, blob) => ({ ...stored, image: blob, thumb: blob, assetRev: starter.assetRev });

/** Which shipped image a sample look shows (sample looks use the model's sheet/front/back file directly). */
export const lookImageKey = sample => IMAGE_KEYS.includes(sample.view) ? sample.view : 'front';

/* ---------- new starters on existing installs ----------
 * kv 'knownStarters' = ids of every bundled starter this install has ever been given (kept OR deleted by the user).
 * A starter shipped later (not in the list) is added once on the next launch and then recorded, so deleting it later
 * sticks. Installs from before this list existed were seeded with exactly LEGACY_STARTER_IDS, so those count as known
 * (a legacy starter the user deleted is never re-added). User models, looks and edits are never read or changed. */
export const LEGACY_STARTER_IDS = ['starter-model-1', 'starter-model-2'];

/** Known-starter list for an install that has none yet: the legacy seed set plus any starter records it still holds. */
export const initialKnownStarters = (storedModels = []) =>
  [...new Set([...LEGACY_STARTER_IDS, ...storedModels.filter(m => m && m.starter === true && typeof m.id === 'string').map(m => m.id)])];

/** Shipped starters this install has never been given, in STARTERS order. */
export const startersToAdd = (starters, known) => { const k = new Set(known || []); return starters.filter(s => !k.has(s.id)); };

/** Known list after offering `ids` (order-preserving, no duplicates). */
export const withKnown = (known, ids) => [...new Set([...(known || []), ...ids])];

/** Model record for a newly added starter (same shape seedStarters writes). rev = verified assetRev or undefined. */
export const newStarterRecord = (starter, blobs, rev, createdAt) => {
  const { file, assetRev, ...rest } = starter;
  return { ...rest, ...Object.fromEntries(IMAGE_KEYS.map(k => [k, blobs[k]])), ...(rev ? { assetRev: rev } : {}), starter: true, createdAt };
};
