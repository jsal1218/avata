// Data layer: settings, models, styles (catalog), looks (mockups). All on-device.
import { db, uid } from './db.js';
import { STARTERS, SAMPLE_STYLES, SAMPLE_LOOKS } from './starters.js';
import { makeThumb } from './imaging.js';
import { IMAGE_KEYS, contentRev, modelNeedsRefresh, lookNeedsRefresh, refreshedModel, refreshedLook, lookImageKey, initialKnownStarters, startersToAdd, withKnown, newStarterRecord, RENUMBER, DELETED_STARTER_IDS, renumberedStarter, renumberedKnown, renumberedLook, orderedModels, starterOutfits, REMOVED_STARTER_IDS, removedLook, removedKnown, RELABEL, relabeledStarter } from './starter-sync.js';

export const CATEGORIES = ['Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Sets', 'Knitwear', 'Activewear', 'Swim', 'Loungewear', 'Accessories', 'Other'];
export const STATUSES = ['Concept', 'Sampling', 'Approved', 'In production', 'Shipped', 'Archived'];
export const STATUS_TONE = { Concept: 'tone-0', Sampling: 'tone-1', Approved: 'tone-2', 'In production': 'tone-3', Shipped: 'tone-4', Archived: 'tone-5' };
export const SIZES_ALPHA = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'];
export const SIZES_US = ['0', '2', '4', '6', '8', '10', '12', '14', '16'];
export const VIEW_LABEL = { front: 'Front', back: 'Back', three: '3/4', sheet: 'Front + back', other: 'Other' };

const DEFAULTS = { theme: 'system', byok: false, model: 'fal-ai/nano-banana-pro/edit', resolution: '2K', safety: 4, upscaler: 'fal-ai/seedvr/upscale/image', autoUpscale: false, lookSort: 'new', styleSort: 'updated' };
export let settings = { ...DEFAULTS, ...JSON.parse(localStorage.getItem('avata.settings') || '{}') };
if (!('byok' in JSON.parse(localStorage.getItem('avata.settings') || '{}'))) settings.byok = false; // v1 installs: paid providers OFF
export const saveSettings = () => localStorage.setItem('avata.settings', JSON.stringify(settings));
export const getKey = p => localStorage.getItem(`avata.key.${p}`) || '';
export const setKey = (p, v) => v ? localStorage.setItem(`avata.key.${p}`, v.trim()) : localStorage.removeItem(`avata.key.${p}`);

export const S = { models: [], styles: [], looks: [] };

const fetchBlob = async path => { const r = await fetch(path); if (!r.ok) throw new Error('asset ' + path); return r.blob(); };

/** Fetch a starter's four images. fresh=true adds ?v=<assetRev>, which misses every cache (an older service worker's
 *  cache-first image cache and the HTTP cache), so a just-deployed starters.js never pairs with stale images. */
async function fetchStarterImages(s, fresh = false) {
  const one = async file => { const b = await Promise.all(IMAGE_KEYS.map(k => fetchBlob(`assets/models/${file}-${k}.webp${fresh ? `?v=${s.assetRev}` : ''}`))); return Object.fromEntries(IMAGE_KEYS.map((k, i) => [k, b[i]])); };
  if (!s.outfits?.length) return one(s.file);
  // a model with outfits: every outfit's images (the first outfit is the model's own images); see starterOutfits()
  const sets = await Promise.all(starterOutfits(s).map(async o => ({ id: o.id, name: o.name, ...(o.subtitle ? { subtitle: o.subtitle } : {}), ...(await one(o.file)) })));
  return { ...Object.fromEntries(IMAGE_KEYS.map(k => [k, sets[0][k]])), outfits: sets };
}
/** Before downloading starter images on an existing install: let a just-deployed service worker take over first.
 *  Right after a deploy the page still runs under the previous worker while the new one installs; a burst of image
 *  fetches through the old worker at that moment can leave Chrome unable to activate the new one (the next navigation
 *  then hangs). So: check for an update now (cheap: one sw.js request), and while a worker is installing/waiting wait
 *  for it to take control (max ~10 s, then carry on regardless). No-op without a controlling worker (fresh install). */
async function swSettled(ms = 10000) {
  const sw = navigator.serviceWorker; if (!sw?.controller) return;
  const sleep = t => new Promise(r => setTimeout(r, t));
  try {
    const reg = await sw.getRegistration(); if (!reg) return;
    await Promise.race([reg.update().catch(() => {}), sleep(3000)]);
    const t0 = Date.now();
    while ((reg.installing || reg.waiting) && Date.now() - t0 < ms) await sleep(100);
  } catch {}
}
/** assetRev to record for fetched images: the starter's rev if the bytes verifiably match it (or can't be checked). */
async function verifiedRev(s, blobs) { const h = await contentRev(blobs).catch(() => null); return h === null || h === s.assetRev ? s.assetRev : undefined; }

export async function seedStarters(force = false) {
  if ((await db.get('kv', 'seeded')) && !force) return;
  const t0 = Date.now();
  for (const [i, s] of STARTERS.entries()) {
    if (!force && await db.get('models', s.id)) continue;
    const blobs = await fetchStarterImages(s, force);
    const rev = await verifiedRev(s, blobs); // unverified (stale cache) → no rev → syncStarters retries next launch
    await db.put('models', newStarterRecord(s, blobs, rev, t0 - (STARTERS.length - i))); // keeps STARTERS order
  }
  await db.put('kv', withKnown(await db.get('kv', 'knownStarters'), STARTERS.map(s => s.id)), 'knownStarters');
  await db.put('kv', true, 'seeded');
}

/** Existing installs: add bundled starters that shipped after this install was seeded (once each). A starter the user
 *  deleted stays deleted (its id is in kv 'knownStarters'); user models/looks/edits are untouched. A failed download
 *  isn't recorded as known, so it is retried on the next launch. */
export async function addNewStarters() {
  if (!(await db.get('kv', 'seeded'))) return;
  let known = await db.get('kv', 'knownStarters');
  if (!Array.isArray(known)) { known = initialKnownStarters(await db.all('models')); await db.put('kv', known, 'knownStarters'); }
  const todo = startersToAdd(STARTERS, known); if (todo.length) await swSettled();
  const t0 = Date.now();
  for (const [i, s] of todo.entries()) {
    try {
      if (!(await db.get('models', s.id))) {
        const blobs = await fetchStarterImages(s, true);
        await db.put('models', newStarterRecord(s, blobs, await verifiedRev(s, blobs), t0 + i));
      }
      known = withKnown(known, [s.id]); await db.put('kv', known, 'knownStarters');
    } catch (e) { console.warn('Avata: could not add new starter', s.id, '— will retry', e); }
  }
}

/** Re-sync installed starters with the shipped assets. Replaces ONLY image fields of a starter model whose assetRev
 *  differs (name/notes/measurements kept), plus the image of the app-seeded sample looks for it. Never creates
 *  starters the user deleted, never touches user models or user/generated looks. Idempotent; failures are retried
 *  on the next launch because assetRev is only written after verified images are stored. */
export async function syncStarters() {
  if (!(await db.get('kv', 'seeded'))) return;
  let settled = false;
  for (const s of STARTERS) {
    try {
      const m = await db.get('models', s.id);
      const samples = SAMPLE_LOOKS.filter(l => l.modelId === s.id);
      const stale = [];
      for (const l of samples) { const cur = await db.get('looks', l.id); if (lookNeedsRefresh(cur, l, s)) stale.push(l); }
      if (!modelNeedsRefresh(m, s) && !stale.length) continue;
      if (!settled) { settled = true; await swSettled(); }
      const blobs = await fetchStarterImages(s, true);
      if (await verifiedRev(s, blobs) !== s.assetRev) { console.warn('Avata: starter assets for', s.id, 'did not match', s.assetRev, '— will retry'); continue; }
      const m2 = await db.get('models', s.id); // re-read right before writing
      if (modelNeedsRefresh(m2, s)) await db.put('models', refreshedModel(m2, s, blobs));
      for (const l of stale) { const cur = await db.get('looks', l.id); if (lookNeedsRefresh(cur, l, s)) await db.put('looks', refreshedLook(cur, s, blobs[lookImageKey(l)])); }
    } catch (e) { console.warn('Avata: starter sync skipped for', s.id, e); }
  }
}

/** One-time (per install) move from the old starter-model-N ids to the stable exact-N / photoreal-N ids, deleting the
 *  old Model 5 starter only. Never touches user-created models (starter !== true). Crash-safe and idempotent: the new
 *  record is written before the old one is removed, an existing new record is never overwritten, and the done-flag is
 *  only set at the end. force=true re-runs it (used after importing an older backup). */
export async function renumberStarters(force = false) {
  if (!force && await db.get('kv', 'renumbered-2026-10')) return;
  for (const [old, to] of Object.entries(RENUMBER)) {
    const m = await db.get('models', old);
    if (!m || m.starter !== true) continue;
    if (!(await db.get('models', to.id))) await db.put('models', renumberedStarter(m, to));
    await db.del('models', old);
  }
  for (const id of DELETED_STARTER_IDS) { const m = await db.get('models', id); if (m && m.starter === true) await db.del('models', id); }
  // list order matches a fresh install: Model 1-4, then Photoreal 1 (it was 2nd; only its createdAt sort key moves)
  const pr = await db.get('models', 'starter-photoreal-1'), ex = (await Promise.all(['starter-exact-1', 'starter-exact-2', 'starter-exact-3', 'starter-exact-4'].map(id => db.get('models', id)))).filter(m => m?.starter === true);
  if (pr?.starter === true && ex.length && pr.createdAt < Math.max(...ex.map(m => m.createdAt))) await db.put('models', { ...pr, createdAt: Math.max(...ex.map(m => m.createdAt)) + 1 });
  for (const l of await db.all('looks')) {
    const r = renumberedLook(l);
    if (r === null) await db.del('looks', l.id); else if (r !== l) await db.put('looks', r);
  }
  const known = await db.get('kv', 'knownStarters');
  if (Array.isArray(known)) await db.put('kv', renumberedKnown(known), 'knownStarters');
  await db.put('kv', true, 'renumbered-2026-10');
}

/** One-time (per install) removal of the starters Jordan removed on 2026-10-18 (Models 1-4, 8, 11, 15, 16). Deletes only
 *  their starter records (starter === true); user-created models are never touched. Their app-seeded sample looks are
 *  removed, the user's own looks of them are kept and detached. Their ids are recorded in knownStarters (never re-added).
 *  Idempotent; the done-flag is set last. force=true re-runs it (after importing an older backup). */
export async function removeStarters(force = false) {
  if (!force && await db.get('kv', 'removed-starters-2026-10-18')) return;
  // an older install without a known list yet: record it now (from the records it holds), so the removed ids are recorded too
  if ((await db.get('kv', 'seeded')) && !Array.isArray(await db.get('kv', 'knownStarters'))) await db.put('kv', initialKnownStarters(await db.all('models')), 'knownStarters');
  for (const id of REMOVED_STARTER_IDS) { const m = await db.get('models', id); if (m && m.starter === true) await db.del('models', id); }
  for (const l of await db.all('looks')) {
    const r = removedLook(l);
    if (r === null) await db.del('looks', l.id); else if (r !== l) await db.put('looks', r);
  }
  const known = await db.get('kv', 'knownStarters');
  if (Array.isArray(known)) await db.put('kv', removedKnown(known), 'knownStarters');
  await db.put('kv', true, 'removed-starters-2026-10-18');
}

/** One-time (per install) relabel of the remaining exact starters to Model 1-8 (old Model 5, 6, 7, 9, 10, 12, 13, 14; ids
 *  unchanged). Only a starter record still carrying its old default name is renamed; user names, user models and every
 *  other field are kept. Idempotent; force=true re-runs it (after importing an older backup). */
export async function relabelStarters(force = false) {
  if (!force && await db.get('kv', 'relabel-2026-10-18')) return;
  for (const id of Object.keys(RELABEL)) { const m = await db.get('models', id); const r = relabeledStarter(m); if (r && r !== m) await db.put('models', r); }
  await db.put('kv', true, 'relabel-2026-10-18');
}

export async function seedSamples(force = false) {
  if ((await db.get('kv', 'seededV2')) && !force) return;
  const now = Date.now();
  for (const [i, s] of SAMPLE_STYLES.entries()) {
    const photos = await Promise.all((s.photoFiles || []).map(fetchBlob));
    const { photoFiles, ...rest } = s;
    await db.put('styles', { ...rest, photos, sample: true, createdAt: now - 1000 * (10 - i), updatedAt: now - 1000 * (10 - i) });
  }
  for (const [i, l] of SAMPLE_LOOKS.entries()) {
    // reuse the starter's stored images when they are the current revision (no second download, tagged as current)
    const st = STARTERS.find(s => s.id === l.modelId), m = st && await db.get('models', l.modelId);
    const cur = st && m?.starter && m.assetRev === st.assetRev && !l.thumbFile && m[lookImageKey(l)];
    const image = cur || await fetchBlob(l.file);
    const thumb = cur || await fetchBlob(l.thumbFile || l.file);
    const { file, thumbFile, ...rest } = l;
    await db.put('looks', { ...rest, image, thumb, ...(cur ? { assetRev: st.assetRev } : {}), sample: true, favorite: false, createdAt: now - 500 * (20 - i) });
  }
  await db.put('kv', true, 'seededV2');
}

/** v1 → v2: move generated renders ('gens') into looks. */
async function migrateGens() {
  if (await db.get('kv', 'gensMigrated')) return;
  const gens = await db.all('gens').catch(() => []);
  for (const g of gens) {
    if (!g.blob) continue;
    await db.put('looks', { id: g.id, image: g.blob, thumb: await makeThumb(g.blob, 640).catch(() => g.blob), modelId: g.modelId, styleIds: [], colorway: '', view: g.view || 'front', title: '', notes: '', tags: [], favorite: !!g.favorite, source: 'generated', prompt: g.prompt, aiModel: g.aiModel, params: g.params, garments: g.garments, createdAt: g.createdAt });
  }
  await db.put('kv', true, 'gensMigrated');
}

export async function initData() {
  await seedStarters();
  await migrateGens();
  await renumberStarters(); // old starter-model-N ids → exact-N / photoreal-N; old Model 5 deleted (before anything adds starters)
  await removeStarters(); // Models 1-4, 8, 11, 15, 16 removed (2026-10-18): their starter records go once, never re-added
  await relabelStarters(); // then the remaining exact models are renamed Model 1-8 once (ids unchanged; user names kept)
  await seedSamples();
  await addNewStarters(); // starters shipped after this install was seeded (never re-adds deleted ones)
  await syncStarters(); // refresh starters whose shipped images changed since they were stored
  await reload();
}
export async function reload() {
  S.models = orderedModels(await db.all('models'), STARTERS); // starters in canonical order (Model 1-14, Photoreal 1, Generated 1, Generated 2), then user models by createdAt
  S.styles = await db.all('styles');
  S.looks = (await db.all('looks')).sort((a, b) => b.createdAt - a.createdAt);
}

export const modelById = id => S.models.find(m => m.id === id);
export const styleById = id => S.styles.find(s => s.id === id);
export const lookById = id => S.looks.find(l => l.id === id);
export const looksForStyle = id => S.looks.filter(l => (l.styleIds || []).includes(id));
export const looksForModel = id => S.looks.filter(l => l.modelId === id);
export const collections = () => [...new Set(S.styles.map(s => s.collection).filter(Boolean))].sort();
export const allTags = () => [...new Set([...S.styles.flatMap(s => s.tags || []), ...S.looks.flatMap(l => l.tags || [])])].sort();
export const lookCollections = l => [...new Set((l.styleIds || []).map(id => styleById(id)?.collection).filter(Boolean))];

export async function saveStyle(s) { s.updatedAt = Date.now(); s.createdAt ||= s.updatedAt; await db.put('styles', s); const i = S.styles.findIndex(x => x.id === s.id); i < 0 ? S.styles.push(s) : (S.styles[i] = s); return s; }
export async function deleteStyle(id) { await db.del('styles', id); S.styles = S.styles.filter(s => s.id !== id); for (const l of S.looks) if (l.styleIds?.includes(id)) { l.styleIds = l.styleIds.filter(x => x !== id); await db.put('looks', l); } }
export async function saveLook(l) { await db.put('looks', l); const i = S.looks.findIndex(x => x.id === l.id); i < 0 ? S.looks.unshift(l) : (S.looks[i] = l); return l; }
export async function deleteLook(id) { await db.del('looks', id); S.looks = S.looks.filter(l => l.id !== id); }
export async function saveModel(m) { await db.put('models', m); await reload(); }
export async function deleteModel(id, withLooks) {
  if (withLooks) for (const l of looksForModel(id)) await db.del('looks', l.id);
  else for (const l of looksForModel(id)) { l.modelId = null; await db.put('looks', l); }
  await db.del('models', id); await reload();
}
export async function removeSamples() {
  for (const l of S.looks.filter(l => l.sample)) await db.del('looks', l.id);
  for (const s of S.styles.filter(s => s.sample)) await db.del('styles', s.id);
  await reload();
}
export function newStyle() { return { id: uid(), sku: '', name: '', collection: '', season: '', category: 'Tops', fabric: '', composition: '', colorways: [], sizes: [], status: 'Concept', supplier: '', notes: '', cost: null, price: null, tags: [], photos: [] }; }
export { uid };

/** Free-text search + filters for styles. */
export function filterStyles({ q = '', collection = '', category = '', status = '', tag = '', sort = 'updated' } = {}) {
  const t = q.trim().toLowerCase();
  let list = S.styles.filter(s => (!collection || s.collection === collection) && (!category || s.category === category) && (!status || s.status === status) && (!tag || (s.tags || []).includes(tag)) &&
    (!t || [s.sku, s.name, s.collection, s.season, s.category, s.fabric, s.composition, s.supplier, s.notes, ...(s.colorways || []), ...(s.tags || [])].join(' ').toLowerCase().includes(t)));
  const by = { updated: (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0), sku: (a, b) => (a.sku || '').localeCompare(b.sku || '', undefined, { numeric: true }), name: (a, b) => (a.name || '').localeCompare(b.name || ''), status: (a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status), collection: (a, b) => (a.collection || '').localeCompare(b.collection || '') }[sort];
  return list.sort(by || (() => 0));
}
export function filterLooks({ q = '', collection = '', category = '', status = '', model = '', tag = '', view = '', fav = false, unlinked = false, sort = 'new' } = {}) {
  const t = q.trim().toLowerCase();
  let list = S.looks.filter(l => {
    const st = (l.styleIds || []).map(styleById).filter(Boolean);
    if (model && l.modelId !== model) return false;
    if (view && l.view !== view) return false;
    if (fav && !l.favorite) return false;
    if (unlinked && st.length) return false;
    if (collection && !st.some(s => s.collection === collection)) return false;
    if (category && !st.some(s => s.category === category)) return false;
    if (status && !st.some(s => s.status === status)) return false;
    if (tag && !(l.tags || []).includes(tag) && !st.some(s => (s.tags || []).includes(tag))) return false;
    if (t) { const m = modelById(l.modelId); const hay = [l.title, l.colorway, l.notes, ...(l.tags || []), m?.name, ...st.flatMap(s => [s.sku, s.name, s.collection, s.season, ...(s.tags || [])])].join(' ').toLowerCase(); if (!hay.includes(t)) return false; }
    return true;
  });
  const firstStyle = l => styleById((l.styleIds || [])[0]);
  const by = { new: (a, b) => b.createdAt - a.createdAt, old: (a, b) => a.createdAt - b.createdAt, style: (a, b) => (firstStyle(a)?.name || '~').localeCompare(firstStyle(b)?.name || '~'), sku: (a, b) => (firstStyle(a)?.sku || '~').localeCompare(firstStyle(b)?.sku || '~', undefined, { numeric: true }), model: (a, b) => (modelById(a.modelId)?.name || '~').localeCompare(modelById(b.modelId)?.name || '~') }[sort];
  return list.sort(by || (() => 0));
}
