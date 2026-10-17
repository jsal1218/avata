import { db, uid } from './db.js';
import { STARTERS } from './starters.js';
import { buildPrompt, FABRICS, FITS, FOOTWEAR, LIGHTING, CAMERAS, VIEWS, REALISM, formatHeight, cmToFtIn, ftInToCm, measurementsText } from './prompt.js';
import { MODELS, UPSCALERS, PROVIDERS, REFINE_PROMPT, getModel, buildRequest, runFal, runGemini, parseFalImages, ProviderError } from './providers.js';
import { analyseSheet, analyseWithSplit, cropHalf, resizeBlob, dataUrlForUpload, blobToDataUrl, makeThumb } from './imaging.js';

export const VERSION = '2026.10.17-1';

/* ---------- tiny utils ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = (n, cls = '') => `<svg class="i ${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const urls = new WeakMap();
const urlFor = b => { if (!b) return ''; if (typeof b === 'string') return b; let u = urls.get(b); if (!u) { u = URL.createObjectURL(b); urls.set(b, u); } return u; };
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const fmtDate = t => new Date(t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/* ---------- settings & keys (device only) ---------- */
const DEFAULTS = { theme: 'system', model: 'fal-ai/nano-banana-pro/edit', resolution: '2K', safety: 4, upscaler: 'fal-ai/seedvr/upscale/image', autoUpscale: false };
let settings = { ...DEFAULTS, ...JSON.parse(localStorage.getItem('avata.settings') || '{}') };
const saveSettings = () => localStorage.setItem('avata.settings', JSON.stringify(settings));
const getKey = p => localStorage.getItem(`avata.key.${p}`) || '';
const setKey = (p, v) => v ? localStorage.setItem(`avata.key.${p}`, v.trim()) : localStorage.removeItem(`avata.key.${p}`);
function applyTheme() {
  const r = document.documentElement;
  if (settings.theme === 'light' || settings.theme === 'dark') r.dataset.theme = settings.theme; else delete r.dataset.theme;
}

/* ---------- state ---------- */
const DRAFT0 = { modelId: null, view: 'front', outfitText: '', fabric: 'auto', fit: 'auto', color: '', footwear: 'barefoot', footwearText: '', accessories: [], accessoriesText: '', keepJewelry: false, lighting: 'studio', camera: 'ecom85', realism: { skin: 2, fabric: 2, anatomy: 2 }, extra: '', aiModel: '', numImages: 1 };
let draft = { ...DRAFT0, ...JSON.parse(localStorage.getItem('avata.draft') || '{}') };
draft.realism = { ...DRAFT0.realism, ...(draft.realism || {}) };
const saveDraft = debounce(() => localStorage.setItem('avata.draft', JSON.stringify(draft)), 250);
let garments = []; // [{id, blob}]
const saveGarments = () => db.put('kv', garments, 'garments').catch(() => {});
let models = [];
let gens = [];
let job = null; // {status, startedAt, error, controller, modelLabel}

/* ---------- toasts ---------- */
function toast(msg, { action, onAction, ms = 3800 } = {}) {
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status');
  t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button">${esc(action)}</button>` : ''}`;
  if (action) t.querySelector('button').onclick = () => { onAction?.(); t.remove(); };
  $('#toasts').append(t); setTimeout(() => t.remove(), ms);
}

/* ---------- boot ---------- */
async function seedStarters(force = false) {
  const seeded = await db.get('kv', 'seeded');
  if (seeded && !force) return;
  for (const s of STARTERS) {
    if (!force && await db.get('models', s.id)) continue;
    const [sheet, front, back, thumb] = await Promise.all(['sheet', 'front', 'back', 'thumb'].map(k => fetch(`assets/models/${s.file}-${k}.webp`).then(r => { if (!r.ok) throw new Error('asset ' + k); return r.blob(); })));
    const { file, ...rest } = s;
    await db.put('models', { ...rest, sheet, front, back, thumb, starter: true, createdAt: Date.now() - (s.id.endsWith('1') ? 2 : 1) });
  }
  await db.put('kv', true, 'seeded');
}
async function loadAll() {
  models = (await db.all('models')).sort((a, b) => a.createdAt - b.createdAt);
  gens = (await db.all('gens')).sort((a, b) => b.createdAt - a.createdAt);
  if (!models.find(m => m.id === draft.modelId)) draft.modelId = models[0]?.id || null;
}
async function boot() {
  applyTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
  try { await seedStarters(); } catch (e) { console.warn(e); toast('Could not load starter models (offline?)'); }
  garments = (await db.get('kv', 'garments').catch(() => null)) || [];
  await loadAll();
  addEventListener('hashchange', route);
  addEventListener('scroll', () => $('#top').classList.toggle('scrolled', scrollY > 4), { passive: true });
  route();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw?.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) toast('A new version of Avata is ready.', { action: 'Reload', onAction: () => location.reload(), ms: 15000 }); });
      });
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
    }).catch(() => {});
  }
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
}

/* ---------- router ---------- */
function route() {
  const [, tab = 'studio', arg] = (location.hash || '#/studio').split('/');
  $$('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab || (tab === 'import' && a.dataset.tab === 'models') || (tab === 'model' && a.dataset.tab === 'models')));
  const v = $('#view'); v.innerHTML = ''; $('#topActions').innerHTML = '';
  scrollTo(0, 0);
  const r = { studio: renderStudio, models: renderModels, model: () => renderModelDetail(decodeURIComponent(arg || '')), import: renderImport, gallery: renderGallery, settings: renderSettings }[tab] || renderStudio;
  $('#topTag').textContent = { studio: 'Outfit Studio', models: 'Model Library', model: 'Model', import: 'Import model', gallery: 'Gallery', settings: 'Settings' }[tab] || 'Outfit Studio';
  r(v);
}

/* ======================================================================
   STUDIO
   ====================================================================== */
function chip(group, val, label, on) { return `<button type="button" class="chip" data-g="${group}" data-v="${esc(val)}" aria-pressed="${on}">${esc(label)}</button>`; }
const ACCESSORIES = ['Sunglasses', 'Shoulder bag', 'Tote', 'Belt', 'Gold jewellery', 'Silver jewellery', 'Hat', 'Scarf', 'Watch'];

function renderStudio(v) {
  const ai = getModel(draft.aiModel || settings.model);
  const m = models.find(x => x.id === draft.modelId);
  $('#topActions').innerHTML = `<button class="icon-btn btn-ghost" id="pp" aria-label="Preview prompt">${icon('copy')}</button>`;
  $('#pp').onclick = () => openPromptPreview();
  v.innerHTML = `
  <h1 class="display fade-in">Dress your model,<br><em>keep her exactly.</em></h1>
  <p class="lede">Pick a model, add garment photos or describe the look, and Avata renders it on the same face and body every time.</p>

  <section class="section" aria-labelledby="s1">
    <div class="section-head"><p class="eyebrow" id="s1"><span class="n">i.</span> Model</p><a class="btn btn-ghost small" href="#/import" style="min-height:32px">${icon('plus', 'xs')} Import</a></div>
    <div class="models-strip" id="modelStrip">
      ${models.map(x => `<button type="button" class="card-model" data-id="${x.id}" aria-pressed="${x.id === draft.modelId}"><div class="ph"><img src="${urlFor(x.thumb || x.front)}" alt="" loading="lazy"></div><div class="meta"><div class="nm">${esc(x.name)}</div><div class="ht">${esc(formatHeight(x.heightCm) || 'Height not set')}</div></div></button>`).join('')}
      <a class="card-model card-add" href="#/import">${icon('plus')}<span>Import sheet</span></a>
    </div>
    <div class="row small muted" id="lockNote" style="margin-top:4px">${icon('lock', 'xs')}<span>${m ? `Identity lock on — ${m.back ? 'front + back' : 'front'} reference${m.back ? 's' : ''} sent with every render${m.heightCm ? `, height ${esc(formatHeight(m.heightCm))}` : ''}${measurementsText(m.measurements, m.measureUnit) ? ' and measurements' : ''}.` : 'Import a model to begin.'}</span></div>
  </section>

  <section class="section" aria-labelledby="s2">
    <div class="section-head"><p class="eyebrow" id="s2"><span class="n">ii.</span> Outfit</p><span class="small muted" id="gCount"></span></div>
    <div class="tiles" id="tiles"></div>
    <input type="file" id="gFile" accept="image/*" multiple hidden>
    <label class="field" style="margin-top:14px"><span>Describe the look</span><textarea id="outfitText" placeholder="e.g. ivory silk slip dress with thin straps, bias cut, midi length; oversized camel wool coat open over it">${esc(draft.outfitText)}</textarea></label>
    <div class="grid2" style="margin-top:12px">
      <label class="field"><span>Fabric</span><select id="fabric">${Object.entries(FABRICS).map(([k, f]) => `<option value="${k}" ${k === draft.fabric ? 'selected' : ''}>${f.label}</option>`).join('')}</select></label>
      <label class="field"><span>Fit</span><select id="fit">${Object.entries(FITS).map(([k, f]) => `<option value="${k}" ${k === draft.fit ? 'selected' : ''}>${f.label}</option>`).join('')}</select></label>
    </div>
    <label class="field" style="margin-top:12px"><span>Colour / print (optional)</span><input type="text" id="color" value="${esc(draft.color)}" placeholder="e.g. deep espresso brown, or navy pinstripe" autocomplete="off"></label>
    <div class="field" style="margin-top:14px"><span>Footwear</span>
      <div class="chips scroll" id="footChips">${Object.keys(FOOTWEAR).map(k => chip('foot', k, { barefoot: 'Barefoot', sneakers: 'Sneakers', heels: 'Heels', sandals: 'Sandals', boots: 'Tall boots', ankle: 'Ankle boots', loafers: 'Loafers', flats: 'Flats', match: 'Stylist’s pick' }[k], draft.footwear === k)).join('')}${chip('foot', 'custom', 'Custom…', draft.footwear === 'custom')}</div>
      <input type="text" id="footText" value="${esc(draft.footwearText)}" placeholder="Describe the shoes" style="margin-top:8px;${draft.footwear === 'custom' ? '' : 'display:none'}">
    </div>
    <div class="field" style="margin-top:14px"><span>Accessories</span>
      <div class="chips" id="accChips">${ACCESSORIES.map(a => chip('acc', a, a, draft.accessories.includes(a))).join('')}</div>
      <input type="text" id="accText" value="${esc(draft.accessoriesText)}" placeholder="Anything else (optional)" style="margin-top:8px">
    </div>
    <label class="switch" style="margin-top:6px"><span><b>Keep reference jewellery</b><br><span class="small muted">Otherwise necklaces/bracelets in the reference are removed.</span></span><input type="checkbox" id="keepJewelry" ${draft.keepJewelry ? 'checked' : ''}></label>
  </section>

  <section class="section" aria-labelledby="s3">
    <p class="eyebrow" id="s3"><span class="n">iii.</span> View</p>
    <div class="seg" id="viewSeg">${Object.entries(VIEWS).map(([k, x]) => `<button type="button" data-v="${k}" aria-pressed="${draft.view === k}">${x.label === 'Front + back sheet' ? 'Sheet' : x.label}</button>`).join('')}</div>
    <p class="small muted" id="viewHint" style="margin:8px 2px 0"></p>
  </section>

  <details class="section" id="realismBox" ${localStorage.getItem('avata.realismOpen') === '0' ? '' : 'open'}>
    <summary><p class="eyebrow" style="margin:0"><span class="n">iv.</span> Skin, fabric &amp; human realism</p></summary>
    <div id="levels">${Object.entries(REALISM).map(([k, r]) => `<div class="level"><div><div class="t">${r.label}</div><div class="d">${{ skin: 'Pores, fine hair, no plastic look', fabric: 'Drape, folds, tension, seams, sheen', anatomy: 'Hands, feet, joints, balance' }[k]}</div></div><div class="seg" data-k="${k}">${['Off', 'Natural', 'Max'].map((l, i) => `<button type="button" data-v="${i}" aria-pressed="${draft.realism[k] === i}">${l}</button>`).join('')}</div></div>`).join('')}</div>
    <div class="divider"></div>
    <div class="field"><span>Lighting &amp; set</span><div class="chips scroll">${Object.entries(LIGHTING).map(([k, l]) => chip('light', k, l.label, draft.lighting === k)).join('')}</div></div>
    <div class="field" style="margin-top:14px"><span>Camera &amp; lens</span><div class="chips scroll">${Object.entries(CAMERAS).map(([k, c]) => chip('cam', k, c.label, draft.camera === k)).join('')}</div></div>
    <label class="field" style="margin-top:14px"><span>Extra direction (optional)</span><input type="text" id="extra" value="${esc(draft.extra)}" placeholder="e.g. hands in coat pockets, soft smile"></label>
  </details>

  <section class="section" aria-labelledby="s5">
    <p class="eyebrow" id="s5"><span class="n">v.</span> Render with</p>
    <label class="field"><span>AI model</span><select id="aiModel">${modelOptions(ai.id)}</select></label>
    <p class="small muted" id="aiBlurb" style="margin:8px 2px 0"></p>
    <div class="row between" style="margin-top:12px"><span class="small"><b>Variations</b></span><div class="seg" id="numSeg" style="min-width:160px">${[1, 2, 3, 4].map(n => `<button type="button" data-v="${n}" aria-pressed="${draft.numImages === n}">${n}</button>`).join('')}</div></div>
  </section>

  <div id="job"></div>
  <div class="gen-bar"><button class="btn btn-solid btn-lg btn-block" id="go">${icon('spark')} <span>Generate</span></button>
  <p class="cost" id="costNote"></p></div>

  <section style="margin-top:22px" id="recentWrap"></section>`;

  // model picker
  $('#modelStrip').onclick = e => { const b = e.target.closest('.card-model[data-id]'); if (!b) return; draft.modelId = b.dataset.id; saveDraft(); $$('#modelStrip .card-model[data-id]').forEach(x => x.setAttribute('aria-pressed', x === b)); renderStudioBits(); renderRecent(); };
  // garments
  renderTiles();
  $('#gFile').onchange = async e => { await addGarments([...e.target.files]); e.target.value = ''; };
  // inputs
  const bind = (id, key) => $('#' + id).addEventListener('input', e => { draft[key] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; saveDraft(); });
  bind('outfitText', 'outfitText'); bind('color', 'color'); bind('footText', 'footwearText'); bind('accText', 'accessoriesText'); bind('extra', 'extra');
  $('#keepJewelry').onchange = e => { draft.keepJewelry = e.target.checked; saveDraft(); };
  $('#fabric').onchange = e => { draft.fabric = e.target.value; saveDraft(); };
  $('#fit').onchange = e => { draft.fit = e.target.value; saveDraft(); };
  v.addEventListener('click', e => {
    const c = e.target.closest('.chip[data-g]'); if (!c) return;
    const g = c.dataset.g, val = c.dataset.v;
    if (g === 'acc') { const i = draft.accessories.indexOf(val); i < 0 ? draft.accessories.push(val) : draft.accessories.splice(i, 1); c.setAttribute('aria-pressed', i < 0); }
    else {
      const key = { foot: 'footwear', light: 'lighting', cam: 'camera' }[g]; draft[key] = val;
      $$(`.chip[data-g="${g}"]`).forEach(x => x.setAttribute('aria-pressed', x === c));
      if (g === 'foot') { $('#footText').style.display = val === 'custom' ? '' : 'none'; if (val === 'custom') $('#footText').focus(); }
    }
    saveDraft();
  });
  $('#viewSeg').onclick = e => { const b = e.target.closest('button'); if (!b || b.disabled) return; draft.view = b.dataset.v; saveDraft(); renderStudioBits(); };
  $('#levels').onclick = e => { const b = e.target.closest('button'); if (!b) return; const k = b.parentElement.dataset.k; draft.realism[k] = +b.dataset.v; $$('button', b.parentElement).forEach(x => x.setAttribute('aria-pressed', x === b)); saveDraft(); };
  $('#realismBox').ontoggle = e => localStorage.setItem('avata.realismOpen', e.target.open ? '1' : '0');
  $('#aiModel').onchange = e => { draft.aiModel = e.target.value; saveDraft(); renderStudioBits(); };
  $('#numSeg').onclick = e => { const b = e.target.closest('button'); if (!b || b.disabled) return; draft.numImages = +b.dataset.v; saveDraft(); renderStudioBits(); };
  $('#go').onclick = generate;
  renderStudioBits(); renderJob(); renderRecent();
}

function modelOptions(sel) {
  return Object.entries(PROVIDERS).map(([p, P]) => `<optgroup label="${P.label}${getKey(p) ? '' : ' — add key in Settings'}">${MODELS.filter(m => m.provider === p).map(m => `<option value="${m.id}" ${m.id === sel ? 'selected' : ''}>${m.label}</option>`).join('')}</optgroup>`).join('');
}

function renderStudioBits() {
  const ai = getModel(draft.aiModel || settings.model);
  const m = models.find(x => x.id === draft.modelId);
  if (ai.views !== 'all' && !ai.views.includes(draft.view)) draft.view = ai.views[0];
  if (draft.view === 'back' && m && !m.back) draft.view = 'front';
  $$('#viewSeg button').forEach(b => { const k = b.dataset.v; b.disabled = (ai.views !== 'all' && !ai.views.includes(k)) || (!m?.back && (k === 'back' || k === 'sheet')) || (k === 'sheet' && !m?.sheet); b.setAttribute('aria-pressed', k === draft.view); });
  $('#viewHint').textContent = { front: 'Full body, facing camera — 3:4 portrait.', back: 'Full body from behind, using the back reference for hair and figure — 3:4.', three: 'Full body, turned ~45° — 3:4.', sheet: 'Square sheet: front left, back right — matches your reference format (1:1).' }[draft.view] + (ai.views !== 'all' ? ` ${ai.label} only supports the front view.` : '');
  $('#aiBlurb').innerHTML = `${esc(ai.vendor)} · ${esc(ai.blurb)}${getKey(ai.provider) ? '' : ` <a href="#/settings">Add your ${PROVIDERS[ai.provider].label} key →</a>`}`;
  if (ai.single && draft.numImages > 1) draft.numImages = 1;
  $$('#numSeg button').forEach(b => { b.disabled = ai.single && b.dataset.v !== '1'; b.setAttribute('aria-pressed', +b.dataset.v === draft.numImages); });
  const gl = garments.length;
  $('#gCount').textContent = gl ? `${gl} photo${gl > 1 ? 's' : ''}` : '';
  const refs = (draft.view === 'sheet' ? 1 : (m?.back ? 2 : 1));
  const over = ai.usesPrompt ? Math.max(0, refs + gl - ai.maxImages) : Math.max(0, gl - 1);
  $('#costNote').innerHTML = `${esc(PROVIDERS[ai.provider].label)} bills your own account per image · ${ai.usesPrompt ? `${refs} reference${refs > 1 ? 's' : ''} + ${gl} garment${gl === 1 ? '' : 's'}` : 'front reference + 1 garment'}${over ? ` · <b>${over} garment photo${over > 1 ? 's' : ''} over this model’s limit will be skipped</b>` : ''}`;
  const lock = $('#lockNote span'); if (lock && m) lock.textContent = `Identity lock on — ${m.back ? 'front + back' : 'front'} reference${m.back ? 's' : ''} sent with every render${m.heightCm ? `, height ${formatHeight(m.heightCm)}` : ''}${measurementsText(m.measurements, m.measureUnit) ? ' and measurements' : ''}.`;
  $('#go').disabled = !!job?.running || !m;
}

function renderTiles() {
  const t = $('#tiles'); if (!t) return;
  t.innerHTML = garments.map(g => `<div class="tile"><img src="${urlFor(g.blob)}" alt="Garment photo"><button class="x" data-id="${g.id}" aria-label="Remove garment">${icon('x', 'xs')}</button></div>`).join('') +
    `<button type="button" class="tile add" id="addG">${icon('hanger')}<span>${garments.length ? 'Add more' : 'Add garment photos'}</span><span class="tiny">flat lay · product · hanger</span></button>`;
  $('#addG').onclick = () => $('#gFile').click();
  t.querySelectorAll('.x').forEach(b => b.onclick = () => { garments = garments.filter(g => g.id !== b.dataset.id); saveGarments(); renderTiles(); renderStudioBits(); });
}
async function addGarments(files) {
  for (const f of files) {
    if (!f.type.startsWith('image/') && !/\.(heic|heif|jpe?g|png|webp)$/i.test(f.name)) continue;
    try { garments.push({ id: uid(), blob: await resizeBlob(f, 1280, 'image/jpeg', 0.9) }); }
    catch { toast(`Couldn't read ${f.name} — try a JPEG or PNG.`); }
  }
  saveGarments(); renderTiles(); renderStudioBits();
}

function renderRecent() {
  const w = $('#recentWrap'); if (!w) return;
  const list = gens.filter(g => g.modelId === draft.modelId).slice(0, 6);
  if (!list.length) { w.innerHTML = ''; return; }
  w.innerHTML = `<div class="row between" style="margin-bottom:10px"><p class="eyebrow" style="margin:0">Latest for this model</p><a class="small muted" href="#/gallery">See all</a></div><div class="masonry">${list.map(shotHtml).join('')}</div>`;
  bindShots(w);
}
function shotHtml(g) {
  return `<button type="button" class="shot fade-in" data-gid="${g.id}"><img src="${urlFor(g.blob || g.remoteUrl)}" alt="${esc(VIEWS[g.view]?.label || '')} render" loading="lazy">${g.kind && g.kind !== 'generation' ? `<span class="badge">${g.kind === 'upscale' ? 'Upscaled' : 'Refined'}</span>` : `<span class="badge">${esc(VIEWS[g.view]?.label === 'Front + back sheet' ? 'Sheet' : VIEWS[g.view]?.label || '')}</span>`}${g.favorite ? `<span class="fav">${icon('heart-f', 'sm')}</span>` : ''}</button>`;
}
function bindShots(root) { root.querySelectorAll('.shot').forEach(b => b.onclick = () => openViewer(b.dataset.gid)); }

/* ---------- job ---------- */
function renderJob() {
  const el = $('#job'); if (!el) return;
  if (!job) { el.innerHTML = ''; return; }
  if (job.running) {
    const s = job.status || {};
    const secs = Math.round((Date.now() - job.startedAt) / 1000);
    el.innerHTML = `<div class="section job"><div class="spinner" aria-hidden="true"></div><div><b>${s.phase === 'queued' ? `In queue${s.position != null ? ` · position ${s.position + 1}` : ''}` : s.phase === 'preparing' ? 'Preparing references…' : 'Rendering'}</b><div class="small muted">${esc(job.label)} · ${secs}s${s.log ? ` · ${esc(s.log.slice(0, 80))}` : ''}</div></div><button class="btn-line small" id="cancelJob">Cancel</button></div>`;
    $('#cancelJob').onclick = () => job.controller.abort();
  } else if (job.error) {
    const e = job.error;
    el.innerHTML = `<div class="section err" role="alert"><div class="row between"><b>${esc(e.message)}</b><button class="icon-btn btn-ghost" id="dismissErr" aria-label="Dismiss">${icon('x', 'sm')}</button></div>${e.hint ? `<p class="small" style="margin:6px 0 0">${linkify(esc(e.hint))}</p>` : ''}${e.raw && e.raw !== e.message ? `<details class="small muted" style="margin-top:6px"><summary>Details</summary><code style="word-break:break-all">${esc(String(e.raw).slice(0, 600))}</code></details>` : ''}</div>`;
    $('#dismissErr').onclick = () => { job = null; renderJob(); };
  } else el.innerHTML = '';
}
const linkify = s => s.replace(/https?:\/\/[^\s)]+/g, u => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
setInterval(() => { if (job?.running && $('#job')) renderJob(); }, 1000);

async function fetchAsBlob(url) {
  try { const r = await fetch(url, { mode: 'cors' }); if (!r.ok) throw 0; return await r.blob(); } catch { return null; }
}
async function dataUrlToBlob(u) { return (await fetch(u)).blob(); }

/** Build images + prompt for the current draft. Exported for the prompt preview. */
async function assemble({ preview = false } = {}) {
  const ai = getModel(draft.aiModel || settings.model);
  const m = models.find(x => x.id === draft.modelId);
  if (!m) throw new ProviderError('Choose or import a model first.');
  const refs = [], images = [];
  const enc = async (b, side) => preview ? `[${side}]` : dataUrlForUpload(b, side === 'garment' ? 1280 : 1536);
  if (draft.view === 'sheet') { refs.push({ role: 'sheet' }); images.push(await enc(m.sheet, 'sheet')); }
  else { refs.push({ role: 'front' }); images.push(await enc(m.front, 'front')); if (m.back) { refs.push({ role: 'back' }); images.push(await enc(m.back, 'back')); } }
  const room = ai.usesPrompt ? Math.max(0, ai.maxImages - images.length) : 1;
  const used = garments.slice(0, room);
  const gUrls = [];
  for (const g of used) { const u = await enc(g.blob, 'garment'); gUrls.push(u); refs.push({ role: 'garment' }); images.push(u); }
  const prompt = buildPrompt({ ...draft, model: m, refs });
  const modelImage = draft.view === 'sheet' ? images[0] : images[0];
  const req = buildRequest(ai.id, { prompt, images, aspect: VIEWS[draft.view].aspect, resolution: settings.resolution, numImages: draft.numImages, safety: settings.safety, modelImage: preview ? '[front]' : (draft.view === 'sheet' ? await enc(m.front, 'front') : modelImage), garmentImages: gUrls });
  return { ai, m, prompt, req, used, skipped: garments.length - used.length };
}

async function generate() {
  if (job?.running) return;
  const ai = getModel(draft.aiModel || settings.model);
  const key = getKey(ai.provider);
  const fail = e => { job = { error: e instanceof ProviderError ? e : new ProviderError(e.message || String(e), { raw: e.stack }) }; renderJob(); renderStudioBits(); };
  if (!key) return fail(new ProviderError(`Add your ${PROVIDERS[ai.provider].label} API key to generate.`, { hint: `Settings → ${PROVIDERS[ai.provider].label}. Get a key at ${PROVIDERS[ai.provider].signup}` }));
  if (ai.needsGarment && !garments.length) return fail(new ProviderError(`${ai.label} needs a garment photo.`, { hint: 'Add one garment photo, or switch to Nano Banana / Seedream for text-only outfits.' }));
  if (!garments.length && !draft.outfitText.trim()) return fail(new ProviderError('Add a garment photo or describe the outfit.', { hint: 'Either works — both together give the most control.' }));
  const controller = new AbortController();
  job = { running: true, startedAt: Date.now(), controller, label: ai.label, status: { phase: 'preparing' } };
  renderJob(); renderStudioBits();
  $('#job')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  try {
    const { m, prompt, req, used, skipped } = await assemble();
    if (skipped > 0) toast(`${skipped} garment photo${skipped > 1 ? 's' : ''} skipped (model limit).`);
    const onStatus = s => { job.status = s; renderJob(); };
    let outs;
    if (req.provider === 'fal') outs = parseFalImages(await runFal({ endpoint: req.endpoint, body: req.body, key, onStatus, signal: controller.signal }));
    else outs = await runGemini({ body: req.body, key, onStatus, signal: controller.signal });
    if (!outs.length) throw new ProviderError('The provider returned no images.', { hint: 'Possibly filtered — try again or adjust the outfit.' });
    const snapshot = JSON.parse(JSON.stringify(draft));
    const saved = [];
    for (const o of outs) {
      const blob = o.dataUrl ? await dataUrlToBlob(o.dataUrl) : await fetchAsBlob(o.url);
      const g = { id: uid(), modelId: m.id, createdAt: Date.now(), blob, remoteUrl: o.url || null, view: draft.view, prompt, aiModel: ai.id, provider: ai.provider, params: snapshot, garments: used.map(x => x.blob), favorite: false, kind: 'generation', resolution: settings.resolution, width: o.width, height: o.height };
      await db.put('gens', g); gens.unshift(g); saved.push(g);
    }
    job = null; renderJob(); renderStudioBits(); renderRecent();
    toast(`${saved.length} look${saved.length > 1 ? 's' : ''} ready.`, { action: 'View', onAction: () => openViewer(saved[0].id) });
    if (navigator.vibrate) navigator.vibrate(18);
    if (settings.autoUpscale && ai.provider === 'fal') for (const g of saved) upscale(g, settings.upscaler).catch(() => {});
    openViewer(saved[0].id);
  } catch (e) {
    if (e.name === 'AbortError') { job = null; renderJob(); renderStudioBits(); toast('Cancelled.'); return; }
    console.error(e); fail(e);
  }
}

async function openPromptPreview() {
  let a;
  try { a = await assemble({ preview: true }); } catch (e) { toast(e.message); return; }
  const body = JSON.stringify(a.req.body, (k, v) => (typeof v === 'string' && v.startsWith('data:') ? '[image]' : v), 2);
  openSheet(`<div class="modal"><div class="row between"><h2 class="h">Prompt preview</h2><button class="icon-btn btn-ghost" data-close aria-label="Close">${icon('x')}</button></div>
  <p class="small muted">Exactly what will be sent to <b>${esc(a.ai.label)}</b> (${esc(a.req.url)}). Image slots are shown as placeholders.</p>
  ${a.ai.usesPrompt ? `<pre class="prompt" id="pTxt">${esc(a.prompt)}</pre>` : '<p class="note">This try-on model takes images only — the text prompt and realism presets are not used.</p>'}
  <div class="row" style="margin:12px 0"><button class="btn-line" id="cpy">${icon('copy', 'sm')} Copy prompt</button></div>
  <details><summary class="small muted">Request body</summary><pre class="prompt" style="margin-top:8px">${esc(body)}</pre></details></div>`);
  $('#cpy').onclick = async () => { try { await navigator.clipboard.writeText(a.prompt); toast('Prompt copied.'); } catch { toast('Copy failed.'); } };
}

/* ---------- sheet/dialog ---------- */
function openSheet(html) {
  const d = $('#sheet'); d.innerHTML = html;
  d.querySelectorAll('[data-close]').forEach(b => b.onclick = () => d.close());
  if (!d.open) d.showModal();
  return d;
}
$('#sheet').addEventListener('close', () => { $('#sheet').innerHTML = ''; });

/* ======================================================================
   VIEWER
   ====================================================================== */
function openViewer(id, mode = 'single') {
  const g = gens.find(x => x.id === id); if (!g) return;
  const m = models.find(x => x.id === g.modelId);
  const ref = !m ? null : g.view === 'back' ? m.back : g.view === 'sheet' ? m.sheet : m.front;
  const src = urlFor(g.blob || g.remoteUrl);
  const ar = g.width && g.height ? `${g.width}/${g.height}` : (VIEWS[g.view]?.aspect || '3:4').replace(':', '/');
  const stage = mode === 'side' && ref ? `<div class="compare"><figure><img src="${urlFor(ref)}" alt="Reference"><figcaption>Reference</figcaption></figure><figure><img src="${src}" alt="Render"><figcaption>Render</figcaption></figure></div>`
    : mode === 'wipe' && ref ? `<div class="wipe" id="wipe" style="--ar:${ar}"><img src="${urlFor(ref)}" alt="Reference"><img class="top-img" src="${src}" alt="Render"><div class="bar"></div></div>`
    : `<img src="${src}" alt="Render">`;
  openSheet(`<div class="viewer">
    <div class="viewer-top"><button class="icon-btn btn-ghost" data-close aria-label="Close">${icon('back')}</button><div class="ttl"><b>${esc(m?.name || 'Model')} · ${esc(VIEWS[g.view]?.label || '')}</b><span class="tiny muted">${esc(getModel(g.aiModel).label)}${g.kind === 'upscale' ? ' · upscaled' : g.kind === 'refine' ? ' · refined' : ''} · ${fmtDate(g.createdAt)}</span></div>
</div>
    <div class="viewer-sub">    <div class="seg" id="cmpSeg">${[['single', 'Render'], ['side', 'Side by side'], ['wipe', 'Wipe']].map(([k, l]) => `<button type="button" data-v="${k}" aria-pressed="${mode === k}" ${!ref && k !== 'single' ? 'disabled' : ''}>${l}</button>`).join('')}</div></div>
    <div class="viewer-stage">${stage}</div>
    <div class="viewer-actions">
      <button id="vFav" aria-pressed="${!!g.favorite}">${icon(g.favorite ? 'heart-f' : 'heart')}<span>${g.favorite ? 'Saved' : 'Favorite'}</span></button>
      <button id="vShare">${icon('share')}<span>Share</span></button>
      <button id="vDown">${icon('down')}<span>Save</span></button>
      <button id="vRerun">${icon('redo')}<span>Re-run</span></button>
      <button id="vUp">${icon('up')}<span>Upscale</span></button>
      <button id="vInfo">${icon('copy')}<span>Prompt</span></button>
      <button id="vDel" class="btn-danger">${icon('trash')}<span>Delete</span></button>
    </div></div>`);
  if (g.favorite) $('#vFav').style.color = 'var(--acc)';
  $('#cmpSeg').onclick = e => { const b = e.target.closest('button'); if (b && !b.disabled) openViewer(id, b.dataset.v); };
  const w = $('#wipe');
  if (w) { const mv = e => { const r = w.getBoundingClientRect(); const x = Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)); w.style.setProperty('--x', x + '%'); }; w.addEventListener('pointerdown', e => { w.setPointerCapture(e.pointerId); mv(e); }); w.addEventListener('pointermove', e => { if (e.buttons) mv(e); }); }
  $('#vFav').onclick = async () => { g.favorite = !g.favorite; await db.put('gens', g); openViewer(id, mode); };
  const fname = () => `avata-${(m?.name || 'model').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${g.view}-${new Date(g.createdAt).toISOString().slice(0, 16).replace(/[:T]/g, '')}.${(g.blob?.type || 'image/png').split('/')[1].replace('jpeg', 'jpg')}`;
  const getBlob = async () => g.blob || await fetchAsBlob(g.remoteUrl);
  $('#vDown').onclick = async () => { const b = await getBlob(); if (!b) { window.open(g.remoteUrl, '_blank'); return; } const a = document.createElement('a'); a.href = urlFor(b); a.download = fname(); document.body.append(a); a.click(); a.remove(); };
  $('#vShare').onclick = async () => {
    const b = await getBlob(); if (!b) return toast('Image not stored locally.');
    const file = new File([b], fname(), { type: b.type || 'image/png' });
    if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: 'Avata look' }); } catch (e) { if (e.name !== 'AbortError') toast('Share failed.'); } }
    else { $('#vDown').click(); toast('Sharing files isn’t supported here — saved instead.'); }
  };
  $('#vRerun').onclick = () => { draft = { ...DRAFT0, ...g.params, modelId: g.modelId }; draft.realism = { ...DRAFT0.realism, ...(g.params?.realism || {}) }; garments = (g.garments || []).map(blob => ({ id: uid(), blob })); saveDraft(); saveGarments(); $('#sheet').close(); location.hash = '#/studio'; route(); toast('Settings loaded — tweak and generate.'); };
  $('#vInfo').onclick = () => openSheet(`<div class="modal"><div class="row between"><h2 class="h">Render details</h2><button class="icon-btn btn-ghost" id="backV" aria-label="Back">${icon('x')}</button></div>
    <dl class="kv" style="margin:10px 0 14px"><dt>Model</dt><dd>${esc(m?.name || '—')}</dd><dt>AI</dt><dd>${esc(getModel(g.aiModel).label)} <span class="muted">(${esc(g.aiModel)})</span></dd><dt>View</dt><dd>${esc(VIEWS[g.view]?.label)}</dd><dt>Created</dt><dd>${fmtDate(g.createdAt)}</dd>${g.width ? `<dt>Size</dt><dd>${g.width}×${g.height}</dd>` : ''}</dl>
    ${g.prompt ? `<pre class="prompt">${esc(g.prompt)}</pre><div class="row" style="margin-top:10px"><button class="btn-line" id="cpy2">${icon('copy', 'sm')} Copy prompt</button></div>` : ''}</div>`) && (($('#backV').onclick = () => openViewer(id, mode)), $('#cpy2') && ($('#cpy2').onclick = () => navigator.clipboard.writeText(g.prompt).then(() => toast('Copied.')).catch(() => toast('Copy failed.'))));
  $('#vUp').onclick = () => openSheet(`<div class="modal"><div class="row between"><h2 class="h">Upscale &amp; detail</h2><button class="icon-btn btn-ghost" id="backV" aria-label="Back">${icon('x')}</button></div>
    <p class="small muted">Runs on fal.ai with your key and saves a new copy (the original is kept).</p><div class="stack">${UPSCALERS.map(u => `<button class="btn-line btn-block" data-u="${u.id}" style="justify-content:flex-start;border-radius:14px">${icon(u.refine ? 'spark' : 'up', 'sm')} ${esc(u.label)}</button>`).join('')}</div></div>`) && (($('#backV').onclick = () => openViewer(id, mode)), $$('[data-u]').forEach(b => b.onclick = () => { $('#sheet').close(); upscale(g, b.dataset.u); }));
  $('#vDel').onclick = async () => { if (!confirm('Delete this render?')) return; await db.del('gens', g.id); gens = gens.filter(x => x.id !== g.id); $('#sheet').close(); route(); };
}

async function upscale(g, upId) {
  const u = UPSCALERS.find(x => x.id === upId) || UPSCALERS[0];
  const refineModel = getModel(draft.aiModel || settings.model);
  const provider = u.refine && refineModel.provider === 'gemini' ? 'gemini' : 'fal';
  const key = getKey(provider);
  if (!key) { toast(`Add your ${PROVIDERS[provider].label} key in Settings first.`, { action: 'Settings', onAction: () => (location.hash = '#/settings') }); return; }
  toast(`${u.label} started…`, { ms: 2500 });
  try {
    const imgUrl = g.remoteUrl && /fal\.media|fal\.run|falserverless/.test(g.remoteUrl) ? g.remoteUrl : await blobToDataUrl(g.blob);
    let outs;
    if (u.refine) {
      const em = refineModel.usesPrompt ? refineModel : getModel('fal-ai/nano-banana-pro/edit');
      const m = models.find(x => x.id === g.modelId);
      const images = [g.blob ? await dataUrlForUpload(g.blob, 2048) : imgUrl];
      const p = REFINE_PROMPT + (m?.front ? ' Image 2 is the identity reference of the same woman — match her face exactly.' : '');
      if (m?.front) images.push(await dataUrlForUpload(m.front, 1536));
      const req = buildRequest(em.id, { prompt: p, images, aspect: VIEWS[g.view]?.aspect || '3:4', resolution: em.resolutions.includes('2K') ? '2K' : em.resolutions[0], numImages: 1, safety: settings.safety });
      outs = req.provider === 'fal' ? parseFalImages(await runFal({ endpoint: req.endpoint, body: req.body, key })) : await runGemini({ body: req.body, key });
    } else {
      outs = parseFalImages(await runFal({ endpoint: u.endpoint || u.id, body: u.build(imgUrl), key }));
    }
    if (!outs.length) throw new ProviderError('No image returned.');
    const o = outs[0];
    const blob = o.dataUrl ? await dataUrlToBlob(o.dataUrl) : await fetchAsBlob(o.url);
    const n = { ...g, id: uid(), createdAt: Date.now(), blob, remoteUrl: o.url || null, kind: u.refine ? 'refine' : 'upscale', parentId: g.id, favorite: false, width: o.width, height: o.height, upscaler: u.id };
    await db.put('gens', n); gens.unshift(n);
    toast(`${u.refine ? 'Refined' : 'Upscaled'} copy saved.`, { action: 'View', onAction: () => openViewer(n.id) });
    if (location.hash.startsWith('#/gallery') || location.hash.startsWith('#/studio') || !location.hash) { if (!$('#sheet').open) route(); }
  } catch (e) { console.error(e); toast(`${e.message}${e.hint ? ' ' + e.hint : ''}`, { ms: 9000 }); }
}

/* ======================================================================
   MODELS
   ====================================================================== */
function specPills(m) {
  return `<div class="specs">${m.heightCm ? `<span class="pill acc">${icon('ruler', 'xs')}${esc(formatHeight(m.heightCm))}</span>` : '<span class="pill warn">Set height</span>'}${m.size ? `<span class="pill">US ${esc(m.size)}</span>` : ''}${m.bodyType ? `<span class="pill">${esc(m.bodyType)}</span>` : ''}</div>`;
}
function renderModels(v) {
  $('#topActions').innerHTML = `<a class="btn btn-solid" href="#/import" style="min-height:38px">${icon('plus', 'sm')} Import</a>`;
  v.innerHTML = `<h1 class="display fade-in">Your <em>models</em></h1><p class="lede">Reference sheets live only on this device. Every render sends the front and back views so she stays identical.</p>
  ${models.length ? `<div class="lib">${models.map(m => `<a class="lib-card fade-in" href="#/model/${encodeURIComponent(m.id)}"><div class="ph"><img src="${urlFor(m.front)}" alt="${esc(m.name)} front" loading="lazy">${m.back ? `<img src="${urlFor(m.back)}" alt="${esc(m.name)} back" loading="lazy">` : ''}</div><div class="meta"><div class="nm">${esc(m.name)}</div>${specPills(m)}<div class="tiny muted" style="margin-top:6px">${gens.filter(g => g.modelId === m.id).length} renders${m.measurements && measurementsText(m.measurements, m.measureUnit) ? ` · measurements${m.measurementsEstimated ? ' (est.)' : ''}` : ''}</div></div></a>`).join('')}</div>`
    : `<div class="empty"><div class="art">${icon('models')}</div><p class="display">No models yet</p><p>Import a front + back reference sheet to start.</p><a class="btn btn-solid" href="#/import">${icon('plus', 'sm')} Import sheet</a></div>`}
  <div class="note" style="margin-top:16px">${icon('image', 'sm')}<span><b>Sheet format:</b> one square image on white, the same model twice — front on the left, back on the right — full body head to toe, neutral pose, plain grey crop tank and fitted shorts, barefoot.</span></div>`;
}

function heightFields(cm, unit) {
  const { ft, inch } = cm ? cmToFtIn(cm) : { ft: '', inch: '' };
  return `<div class="row between" style="margin-bottom:6px"><span class="field" style="margin:0"><span style="margin:0">Height</span></span><div class="seg" id="hUnit" style="min-width:120px"><button type="button" data-v="ftin" aria-pressed="${unit !== 'cm'}">ft / in</button><button type="button" data-v="cm" aria-pressed="${unit === 'cm'}">cm</button></div></div>
  <div id="hFt" class="grid2" style="${unit === 'cm' ? 'display:none' : ''}"><label class="field"><input type="number" inputmode="numeric" id="hf" min="3" max="7" value="${ft}" placeholder="ft" aria-label="Feet"></label><label class="field"><input type="number" inputmode="numeric" id="hi" min="0" max="11" value="${inch}" placeholder="in" aria-label="Inches"></label></div>
  <div id="hCm" style="${unit === 'cm' ? '' : 'display:none'}"><input type="number" inputmode="numeric" id="hc" min="120" max="210" value="${cm || ''}" placeholder="cm" aria-label="Centimetres"></div>`;
}
function bindHeight(root, onChange) {
  let unit = $('#hUnit [aria-pressed=true]', root).dataset.v;
  const sync = from => {
    if (from === 'ftin') { const f = +$('#hf', root).value, i = +$('#hi', root).value || 0; const cm = f ? ftInToCm(f, i) : 0; $('#hc', root).value = cm || ''; onChange(cm || null); }
    else { const cm = +$('#hc', root).value; const t = cm ? cmToFtIn(cm) : { ft: '', inch: '' }; $('#hf', root).value = t.ft; $('#hi', root).value = t.inch; onChange(cm || null); }
  };
  $('#hf', root).oninput = $('#hi', root).oninput = () => sync('ftin');
  $('#hc', root).oninput = () => sync('cm');
  $('#hUnit', root).onclick = e => { const b = e.target.closest('button'); if (!b) return; unit = b.dataset.v; $$('#hUnit button', root).forEach(x => x.setAttribute('aria-pressed', x === b)); $('#hFt', root).style.display = unit === 'cm' ? 'none' : ''; $('#hCm', root).style.display = unit === 'cm' ? '' : 'none'; };
}
function bodyFields(m) {
  const u = m.measureUnit || 'in'; const M = m.measurements || {};
  return `<div class="grid2" style="margin-top:12px"><label class="field"><span>Body type</span><input type="text" id="bType" value="${esc(m.bodyType || '')}" placeholder="e.g. curvy hourglass"></label><label class="field"><span>US size</span><input type="text" id="bSize" value="${esc(m.size || '')}" placeholder="e.g. 4–6 / S"></label></div>
  <div class="row between" style="margin:16px 0 6px"><span class="field" style="margin:0"><span style="margin:0">Measurements (optional)</span></span><div class="seg" id="mUnit" style="min-width:110px"><button type="button" data-v="in" aria-pressed="${u === 'in'}">in</button><button type="button" data-v="cm" aria-pressed="${u === 'cm'}">cm</button></div></div>
  <div class="meas">${['bust', 'waist', 'hips', 'inseam'].map(k => `<label class="field"><span style="text-align:center">${k}</span><input type="number" inputmode="decimal" step="0.5" data-m="${k}" value="${M[k] ?? ''}" placeholder="—"></label>`).join('')}</div>
  <label class="switch" style="margin-top:6px"><span class="small">Mark measurements as <b>estimated</b></span><input type="checkbox" id="mEst" ${m.measurementsEstimated ? 'checked' : ''}></label>
  <p class="tiny muted" style="margin:2px 0 0">Height, body type, size and any filled measurements are written into every prompt so hems, inseams, sleeves and fit land realistically.</p>`;
}
function readBody(root, m) {
  m.bodyType = $('#bType', root).value.trim(); m.size = $('#bSize', root).value.trim();
  const newUnit = $('#mUnit [aria-pressed=true]', root).dataset.v;
  m.measurements = {}; $$('[data-m]', root).forEach(i => { if (i.value !== '') m.measurements[i.dataset.m] = +i.value; });
  m.measureUnit = newUnit; m.measurementsEstimated = $('#mEst', root).checked;
}
function bindMeasureUnit(root) {
  $('#mUnit', root).onclick = e => {
    const b = e.target.closest('button'); if (!b) return; const prev = $('#mUnit [aria-pressed=true]', root).dataset.v; const next = b.dataset.v; if (prev === next) return;
    $$('[data-m]', root).forEach(i => { if (i.value !== '') i.value = Math.round((next === 'cm' ? +i.value * 2.54 : +i.value / 2.54) * 2) / 2; });
    $$('#mUnit button', root).forEach(x => x.setAttribute('aria-pressed', x === b));
  };
}

function renderModelDetail(id) {
  const v = $('#view');
  const m = models.find(x => x.id === id);
  if (!m) { v.innerHTML = `<div class="empty"><p class="display">Model not found</p><a class="btn" href="#/models">Back to models</a></div>`; return; }
  $('#topActions').innerHTML = `<a class="btn btn-ghost" href="#/models" style="min-height:38px">${icon('back', 'sm')} Models</a>`;
  const n = gens.filter(g => g.modelId === m.id);
  v.innerHTML = `<h1 class="display fade-in">${esc(m.name)}</h1>${specPills(m)}
  <div class="hero-pair" style="margin-top:14px"><figure><img src="${urlFor(m.front)}" alt="Front reference"><figcaption>Front</figcaption></figure>${m.back ? `<figure><img src="${urlFor(m.back)}" alt="Back reference"><figcaption>Back</figcaption></figure>` : '<figure style="display:grid;place-items:center;color:#888">No back view</figure>'}</div>
  <div class="row" style="margin:14px 0"><button class="btn btn-solid grow" id="useM">${icon('spark', 'sm')} Style this model</button></div>
  <section class="section"><p class="eyebrow">Profile</p>
    <label class="field"><span>Name</span><input type="text" id="mName" value="${esc(m.name)}"></label>
    <div style="margin-top:12px">${heightFields(m.heightCm, 'ftin')}</div>
    ${bodyFields(m)}
    ${m.note ? `<p class="small muted" style="margin:10px 0 0">${esc(m.note)}</p>` : ''}
    <button class="btn btn-solid btn-block" id="saveM" style="margin-top:14px">${icon('check', 'sm')} Save profile</button>
  </section>
  ${m.sheet ? `<details class="section"><summary><p class="eyebrow" style="margin:0">Original reference sheet</p></summary><img src="${urlFor(m.sheet)}" alt="Reference sheet" style="border-radius:14px;background:#fff"></details>` : ''}
  ${n.length ? `<p class="eyebrow" style="margin-top:20px">Renders · ${n.length}</p><div class="masonry" id="mGens">${n.slice(0, 12).map(shotHtml).join('')}</div>` : ''}
  <button class="btn btn-line btn-danger btn-block" id="delM" style="margin-top:18px">${icon('trash', 'sm')} Delete model${n.length ? ' and its renders' : ''}</button>`;
  let height = m.heightCm;
  bindHeight(v, cm => { height = cm; });
  bindMeasureUnit(v);
  if ($('#mGens')) bindShots($('#mGens'));
  $('#useM').onclick = () => { draft.modelId = m.id; saveDraft(); location.hash = '#/studio'; };
  $('#saveM').onclick = async () => { m.name = $('#mName').value.trim() || m.name; m.heightCm = height; readBody(v, m); await db.put('models', m); toast('Profile saved.'); route(); };
  $('#delM').onclick = async () => { if (!confirm(`Delete ${m.name}${n.length ? ` and ${n.length} renders` : ''}? This can’t be undone.`)) return; for (const g of n) await db.del('gens', g.id); await db.del('models', m.id); await loadAll(); location.hash = '#/models'; };
}

/* ---------- import ---------- */
function renderImport(v) {
  $('#topActions').innerHTML = `<a class="btn btn-ghost" href="#/models" style="min-height:38px">${icon('back', 'sm')} Models</a>`;
  const st = { file: null, info: null, split: 0.5, swap: false, single: false, height: 160, previews: {} };
  v.innerHTML = `<h1 class="display fade-in">Import a <em>model</em></h1><p class="lede">Choose a reference sheet from your camera roll. Avata finds the gap between the front and back views and crops each one.</p>
  <input type="file" id="sFile" accept="image/*" hidden>
  <div id="pick"><button class="tile add btn-block" id="pickBtn" style="aspect-ratio:auto;min-height:220px;width:100%;border-radius:var(--r)">${icon('image')}<b style="color:var(--ink)">Choose reference sheet</b><span class="small">Square · white background · front left, back right</span></button></div>
  <div id="work" hidden>
    <div class="sheet-preview" id="sp"><img id="spImg" alt="Reference sheet"><div class="cut" id="cut"></div><span class="lbl" style="left:10px" id="lblL">Front</span><span class="lbl" style="right:10px" id="lblR">Back</span></div>
    <p class="small muted" id="detect" style="margin:8px 2px"></p>
    <label class="field"><span>Split position</span><input type="range" id="splitR" min="20" max="80" step="0.5" value="50"></label>
    <div class="row" style="margin:6px 0 12px"><button type="button" class="chip" id="swapB" aria-pressed="false">${icon('swap', 'xs')} Back is on the left</button><button type="button" class="chip" id="singleB" aria-pressed="false">Single front photo</button></div>
    <div class="hero-pair" id="crops"><figure><img id="cF" alt="Front crop"><figcaption>Front</figcaption></figure><figure><img id="cB" alt="Back crop"><figcaption>Back</figcaption></figure></div>
    <section class="section" style="margin-top:14px"><p class="eyebrow">Profile</p>
      <label class="field"><span>Name</span><input type="text" id="iName" placeholder="e.g. Model 3" value="Model ${models.length + 1}"></label>
      <div style="margin-top:12px">${heightFields(160, 'ftin')}</div>
      ${bodyFields({ measureUnit: 'in' })}
    </section>
    <button class="btn btn-solid btn-lg btn-block" id="saveI">${icon('check')} Save model</button>
  </div>`;
  bindHeight(v, cm => { st.height = cm; }); bindMeasureUnit(v);
  $('#pickBtn').onclick = () => $('#sFile').click();
  const refreshCrops = debounce(async () => {
    if (!st.info) return;
    const info = await analyseWithSplit(st.file, st.split);
    st.info = info;
    if (st.single) { $('#cF').src = urlFor(await resizeBlob(st.file, 1200, 'image/webp', 0.9)); $('#crops figure:last-child').style.display = 'none'; return; }
    $('#crops figure:last-child').style.display = '';
    const [a, b] = await Promise.all([cropHalf(st.file, info, 'front'), cropHalf(st.file, info, 'back')]);
    st.previews = st.swap ? { front: b, back: a } : { front: a, back: b };
    $('#cF').src = urlFor(st.previews.front); $('#cB').src = urlFor(st.previews.back);
  }, 120);
  const placeCut = () => { $('#cut').style.left = (st.split * 100) + '%'; $('#cut').style.display = st.single ? 'none' : ''; $('#lblL').textContent = st.swap ? 'Back' : 'Front'; $('#lblR').textContent = st.swap ? 'Front' : 'Back'; $('#lblR').style.display = st.single ? 'none' : ''; };
  $('#sFile').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      st.file = await resizeBlob(f, 2048, 'image/webp', 0.92);
      $('#spImg').src = urlFor(st.file);
      st.info = await analyseSheet(st.file); st.split = st.info.split;
      const img = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = urlFor(st.file); });
      const portrait = img.naturalWidth / img.naturalHeight < 0.8;
      st.single = portrait; $('#singleB').setAttribute('aria-pressed', portrait);
      $('#detect').innerHTML = portrait ? 'This looks like a single portrait photo — saved as a front-only model (back view renders disabled).' : st.info.confidence === 'high' ? `${icon('check', 'xs')} Found a clean gap between the two views. Drag the slider if it’s off.` : 'Couldn’t find a clean gap — adjust the split slider so the line sits between the two figures.';
      $('#splitR').value = (st.split * 100).toFixed(1);
      $('#pick').hidden = true; $('#work').hidden = false; placeCut(); refreshCrops();
    } catch (err) { console.error(err); toast('Couldn’t read that image. Try a JPEG or PNG.'); }
  };
  $('#splitR').oninput = e => { st.split = +e.target.value / 100; placeCut(); refreshCrops(); };
  const sp = $('#sp');
  sp.addEventListener('pointerdown', e => { if (st.single) return; sp.setPointerCapture(e.pointerId); const mv = ev => { const r = sp.getBoundingClientRect(); st.split = Math.min(.8, Math.max(.2, (ev.clientX - r.left) / r.width)); $('#splitR').value = (st.split * 100).toFixed(1); placeCut(); refreshCrops(); }; mv(e); sp.onpointermove = ev => ev.buttons && mv(ev); });
  $('#swapB').onclick = () => { st.swap = !st.swap; $('#swapB').setAttribute('aria-pressed', st.swap); placeCut(); refreshCrops(); };
  $('#singleB').onclick = () => { st.single = !st.single; $('#singleB').setAttribute('aria-pressed', st.single); placeCut(); refreshCrops(); };
  $('#saveI').onclick = async () => {
    if (!st.file) return;
    $('#saveI').disabled = true;
    try {
      let front, back = null, sheet = null;
      if (st.single) front = await resizeBlob(st.file, 1536, 'image/webp', 0.9);
      else {
        const info = await analyseWithSplit(st.file, st.split);
        const [a, b] = await Promise.all([cropHalf(st.file, info, 'front'), cropHalf(st.file, info, 'back')]);
        [front, back] = st.swap ? [b, a] : [a, b]; sheet = st.file;
        if (st.swap) { toast('Note: the sheet view will use your original left/right layout.'); }
      }
      const m = { id: uid(), name: $('#iName').value.trim() || `Model ${models.length + 1}`, sheet, front, back, thumb: await makeThumb(front), heightCm: st.height, createdAt: Date.now(), starter: false };
      readBody(v, m);
      await db.put('models', m); await loadAll(); draft.modelId = m.id; saveDraft();
      toast(`${m.name} added.`); location.hash = `#/model/${encodeURIComponent(m.id)}`;
    } catch (err) { console.error(err); toast('Saving failed: ' + err.message); $('#saveI').disabled = false; }
  };
}

/* ======================================================================
   GALLERY
   ====================================================================== */
let galleryFilter = { model: 'all', fav: false };
function renderGallery(v) {
  const list = gens.filter(g => (galleryFilter.model === 'all' || g.modelId === galleryFilter.model) && (!galleryFilter.fav || g.favorite));
  v.innerHTML = `<h1 class="display fade-in">The <em>gallery</em></h1><p class="lede">${gens.length ? `${gens.length} render${gens.length > 1 ? 's' : ''}, saved on this device.` : 'Your renders will appear here.'}</p>
  <div class="chips scroll" id="gf" style="margin-bottom:14px">${chip('gm', 'all', 'All models', galleryFilter.model === 'all')}${models.map(m => chip('gm', m.id, m.name, galleryFilter.model === m.id)).join('')}<button type="button" class="chip" id="favF" aria-pressed="${galleryFilter.fav}">${icon('heart', 'xs')} Favorites</button></div>
  ${list.length ? `<div class="masonry" id="gal">${list.map(shotHtml).join('')}</div>` : `<div class="empty"><div class="art">${icon('grid')}</div><p class="display">${gens.length ? 'Nothing matches' : 'No looks yet'}</p><p>${gens.length ? 'Try another filter.' : 'Head to the Studio to dress your first model.'}</p>${gens.length ? '' : `<a class="btn btn-solid" href="#/studio">${icon('spark', 'sm')} Open Studio</a>`}</div>`}`;
  $('#gf').onclick = e => { const c = e.target.closest('.chip'); if (!c) return; if (c.id === 'favF') galleryFilter.fav = !galleryFilter.fav; else galleryFilter.model = c.dataset.v; renderGallery(v); };
  if ($('#gal')) bindShots($('#gal'));
}

/* ======================================================================
   SETTINGS
   ====================================================================== */
async function renderSettings(v) {
  const keyBlock = p => { const P = PROVIDERS[p]; const k = getKey(p); return `<div class="field" style="margin-top:14px"><span>${P.label} key ${k ? '<span class="pill acc" style="letter-spacing:0;text-transform:none;margin-left:6px">saved on device</span>' : ''}</span>
    <div class="key-row"><input type="password" id="k-${p}" value="${esc(k)}" placeholder="${p === 'fal' ? 'key_id:key_secret' : 'AIza…'}" autocomplete="off" autocapitalize="off" spellcheck="false"><button class="icon-btn btn-line" data-show="${p}" aria-label="Show key">${icon('key', 'sm')}</button></div>
    <div class="row between small" style="margin-top:6px"><a href="${P.signup}" target="_blank" rel="noopener">Get a ${P.label} key ↗</a>${k ? `<button class="btn-ghost btn-danger small" style="min-height:32px" data-clear="${p}">Remove</button>` : ''}</div></div>`; };
  v.innerHTML = `<h1 class="display fade-in">Settings</h1>
  <section class="section"><p class="eyebrow">${icon('lock', 'xs')} API keys</p>
    <div class="note">${icon('lock', 'sm')}<span>Keys are stored only in this browser on this device. Avata has no server: your key and images are sent <b>directly from your phone to the provider</b> you choose (fal.ai or Google) and nowhere else. Anyone with access to this device/browser profile could read them; remove a key here any time.</span></div>
    ${keyBlock('fal')}${keyBlock('gemini')}
  </section>
  <section class="section"><p class="eyebrow">Default render model</p>
    <label class="field"><select id="sModel">${modelOptions(settings.model)}</select></label>
    <p class="small muted" id="sBlurb" style="margin:8px 2px 0"></p>
    <div class="row between" style="margin-top:14px"><span><b>Resolution</b><br><span class="small muted">Where the model supports it</span></span><div class="seg" id="sRes" style="min-width:170px">${['1K', '2K', '4K'].map(r => `<button type="button" data-v="${r}" aria-pressed="${settings.resolution === r}">${r}</button>`).join('')}</div></div>
    <label class="field" style="margin-top:14px"><span>Content filter strictness · <b id="sSafV">${settings.safety}</b> (1 strict – 6 permissive)</span><input type="range" id="sSaf" min="1" max="6" step="1" value="${settings.safety}"></label>
  </section>
  <section class="section"><p class="eyebrow">Upscale &amp; detail</p>
    <label class="field"><span>Default upscaler</span><select id="sUp">${UPSCALERS.map(u => `<option value="${u.id}" ${u.id === settings.upscaler ? 'selected' : ''}>${u.label}</option>`).join('')}</select></label>
    <label class="switch" style="margin-top:8px"><span><b>Auto-upscale every fal render</b><br><span class="small muted">Extra cost per image</span></span><input type="checkbox" id="sAuto" ${settings.autoUpscale ? 'checked' : ''}></label>
  </section>
  <section class="section"><p class="eyebrow">Appearance</p>
    <div class="seg" id="sTheme">${[['system', 'System'], ['light', 'Light'], ['dark', 'Dark']].map(([k, l]) => `<button type="button" data-v="${k}" aria-pressed="${settings.theme === k}">${l}</button>`).join('')}</div>
  </section>
  <section class="section"><p class="eyebrow">Storage</p>
    <p class="small" id="store">Calculating…</p>
    <div class="stack"><button class="btn-line btn-block" id="restore">${icon('redo', 'sm')} Restore starter models</button>
    <button class="btn-line btn-block btn-danger" id="wipeG">${icon('trash', 'sm')} Delete all renders</button></div>
  </section>
  <section class="section flat"><p class="eyebrow">Install on iPhone</p><p class="small muted" style="margin:0">Open in Safari → Share → <b>Add to Home Screen</b>. Avata then runs full-screen and works offline (generation needs a connection).</p></section>
  <p class="tiny muted" style="text-align:center">Avata ${VERSION} · <a href="https://github.com/jsal1218/avata" target="_blank" rel="noopener">source</a></p>`;
  for (const p of Object.keys(PROVIDERS)) {
    const inp = $(`#k-${p}`);
    inp.addEventListener('change', () => { setKey(p, inp.value); toast(inp.value ? `${PROVIDERS[p].label} key saved on this device.` : 'Key removed.'); renderSettings(v); });
  }
  $$('[data-show]').forEach(b => b.onclick = () => { const i = $(`#k-${b.dataset.show}`); i.type = i.type === 'password' ? 'text' : 'password'; });
  $$('[data-clear]').forEach(b => b.onclick = () => { setKey(b.dataset.clear, ''); toast('Key removed.'); renderSettings(v); });
  const blurb = () => { const m = getModel(settings.model); $('#sBlurb').textContent = `${m.vendor} · ${m.blurb}`; };
  blurb();
  $('#sModel').onchange = e => { settings.model = e.target.value; draft.aiModel = ''; saveDraft(); saveSettings(); blurb(); };
  $('#sRes').onclick = e => { const b = e.target.closest('button'); if (!b) return; settings.resolution = b.dataset.v; saveSettings(); $$('#sRes button').forEach(x => x.setAttribute('aria-pressed', x === b)); };
  $('#sSaf').oninput = e => { settings.safety = +e.target.value; $('#sSafV').textContent = settings.safety; saveSettings(); };
  $('#sUp').onchange = e => { settings.upscaler = e.target.value; saveSettings(); };
  $('#sAuto').onchange = e => { settings.autoUpscale = e.target.checked; saveSettings(); };
  $('#sTheme').onclick = e => { const b = e.target.closest('button'); if (!b) return; settings.theme = b.dataset.v; saveSettings(); applyTheme(); $$('#sTheme button').forEach(x => x.setAttribute('aria-pressed', x === b)); };
  $('#restore').onclick = async () => { await seedStarters(true); await loadAll(); toast('Starter models restored.'); };
  $('#wipeG').onclick = async () => { if (!confirm(`Delete all ${gens.length} renders?`)) return; await db.clear('gens'); gens = []; toast('All renders deleted.'); renderSettings(v); };
  try { const e = await navigator.storage.estimate(); $('#store').textContent = `${models.length} models · ${gens.length} renders · ~${(e.usage / 1048576).toFixed(1)} MB used on this device.`; } catch { $('#store').textContent = `${models.length} models · ${gens.length} renders.`; }
}

boot();
