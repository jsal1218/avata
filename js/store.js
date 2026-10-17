// Data layer: settings, models, styles (catalog), looks (mockups). All on-device.
import { db, uid } from './db.js';
import { STARTERS, SAMPLE_STYLES, SAMPLE_LOOKS } from './starters.js';
import { makeThumb } from './imaging.js';

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

export async function seedStarters(force = false) {
  if ((await db.get('kv', 'seeded')) && !force) return;
  for (const s of STARTERS) {
    if (!force && await db.get('models', s.id)) continue;
    const [sheet, front, back, thumb] = await Promise.all(['sheet', 'front', 'back', 'thumb'].map(k => fetchBlob(`assets/models/${s.file}-${k}.webp`)));
    const { file, ...rest } = s;
    await db.put('models', { ...rest, sheet, front, back, thumb, starter: true, createdAt: Date.now() - (s.id.endsWith('1') ? 2 : 1) });
  }
  await db.put('kv', true, 'seeded');
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
    const image = await fetchBlob(l.file);
    const thumb = await fetchBlob(l.thumbFile || l.file);
    const { file, thumbFile, ...rest } = l;
    await db.put('looks', { ...rest, image, thumb, sample: true, favorite: false, createdAt: now - 500 * (20 - i) });
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
  await seedSamples();
  await reload();
}
export async function reload() {
  S.models = (await db.all('models')).sort((a, b) => a.createdAt - b.createdAt);
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
