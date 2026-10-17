// Studio / Prompt builder. Free by default: builds a ready-to-use prompt + reference files for the assistant.
// In-app generation only exists when the user turns on Settings → Advanced → Bring your own API key.
import { holdWork, $, $$, esc, icon, urlFor, chip, toast, openSheet, closeSheet, setTop, debounce } from './ui.js';
import { S, settings, getKey, modelById, styleById, saveLook, uid } from './store.js';
import { db } from './db.js';
import { buildPrompt, FABRICS, FITS, FOOTWEAR, LIGHTING, CAMERAS, VIEWS, REALISM, formatHeight, measurementsText } from './prompt.js';
import { MODELS, UPSCALERS, PROVIDERS, REFINE_PROMPT, getModel, buildRequest, runFal, runGemini, parseFalImages, ProviderError } from './providers.js';
import { resizeBlob, dataUrlForUpload, blobToDataUrl, makeThumb } from './imaging.js';
import { shareRefs } from './models-view.js';
import { openLook } from './looks.js';

const DRAFT0 = { modelId: null, styleIds: [], view: 'front', outfitText: '', fabric: 'auto', fit: 'auto', color: '', footwear: 'barefoot', footwearText: '', accessories: [], accessoriesText: '', keepJewelry: false, lighting: 'studio', camera: 'ecom85', realism: { skin: 2, fabric: 2, anatomy: 2 }, extra: '', aiModel: '', numImages: 1 };
let draft = { ...DRAFT0, ...JSON.parse(localStorage.getItem('avata.draft') || '{}') };
draft.realism = { ...DRAFT0.realism, ...(draft.realism || {}) }; draft.styleIds ||= [];
const saveDraft = debounce(() => localStorage.setItem('avata.draft', JSON.stringify(draft)), 250);
let garments = null; // [{id, blob}] lazily loaded
const saveGarments = () => db.put('kv', garments, 'garments').catch(() => {});
let job = null;
const ACCESSORIES = ['Sunglasses', 'Shoulder bag', 'Tote', 'Belt', 'Gold jewellery', 'Silver jewellery', 'Hat', 'Scarf', 'Watch'];
const guessFabric = t => { t = (t || '').toLowerCase(); return Object.keys(FABRICS).find(k => k !== 'auto' && (t.includes(k) || t.includes(FABRICS[k].label.toLowerCase()))) || (/rib|knit/.test(t) ? 'knit' : /jersey/.test(t) ? 'jersey' : 'auto'); };
const canGenerate = () => settings.byok;

async function prefillFromStyle(s) {
  draft.styleIds = [s.id];
  draft.outfitText = `${s.name.replace(/^Sample · /, '')}${s.category ? ` (${s.category.toLowerCase()})` : ''}${[s.fabric, s.composition].filter(Boolean).map(x => `, ${x}`).join('')}`;
  draft.color = s.colorways?.[0] || ''; draft.fabric = guessFabric(`${s.fabric} ${s.composition}`);
  garments = [];
  for (const p of s.photos || []) { try { garments.push({ id: uid(), blob: await resizeBlob(p, 1280, 'image/jpeg', 0.9) }); } catch {} }
  saveGarments(); saveDraft();
}

export async function renderStudio(v, params) {
  if (!garments) garments = (await db.get('kv', 'garments').catch(() => null)) || [];
  if (params.get('style') && styleById(params.get('style'))) { await prefillFromStyle(styleById(params.get('style'))); history.replaceState(null, '', '#/studio'); }
  if (params.get('model') && modelById(params.get('model'))) { draft.modelId = params.get('model'); saveDraft(); history.replaceState(null, '', '#/studio'); }
  if (!modelById(draft.modelId)) draft.modelId = S.models[0]?.id || null;
  const gen = canGenerate();
  const ai = getModel(draft.aiModel || settings.model);
  const m = modelById(draft.modelId);
  setTop(gen ? 'Studio' : 'Prompt builder', `<button class="icon-btn btn-ghost" id="pp" aria-label="Preview prompt">${icon('info')}</button>`);
  $('#pp').onclick = () => openPromptPreview();
  const linked = draft.styleIds.map(styleById).filter(Boolean);
  v.innerHTML = `
  <h1 class="display fade-in">${gen ? 'Dress your model,<br><em>keep her exactly.</em>' : 'Build a prompt,<br><em>keep her exactly.</em>'}</h1>
  <p class="lede">${gen ? 'Pick a model, add garment photos or describe the look, and render it with your own API key.' : 'Pick a model and a style, set the realism, then copy a ready-to-use prompt and share the reference images with your assistant. Free — nothing is sent anywhere.'}</p>
  ${linked.length ? `<div class="note" style="margin-bottom:14px">${icon('hanger', 'sm')}<span>Linked style: ${linked.map(s => `<a href="#/style/${encodeURIComponent(s.id)}"><b>${esc(s.sku)}</b> ${esc(s.name)}</a>`).join(', ')} <button class="btn-ghost small" id="unlink" style="min-height:28px;padding:0 6px">Unlink</button></span></div>` : ''}
  <section class="section"><div class="section-head"><p class="eyebrow"><span class="n">i.</span> Model</p><a class="btn btn-ghost small" href="#/import-model" style="min-height:32px">${icon('plus', 'xs')} Import</a></div>
    <div class="models-strip" id="modelStrip">${S.models.map(x => `<button type="button" class="card-model" data-id="${x.id}" aria-pressed="${x.id === draft.modelId}"><div class="ph"><img src="${urlFor(x.thumb || x.front)}" alt="" loading="lazy"></div><div class="meta"><div class="nm">${esc(x.name)}</div><div class="ht">${esc(formatHeight(x.heightCm) || 'Height not set')}</div></div></button>`).join('')}</div>
    <div class="row small muted" style="margin-top:4px">${icon('lock', 'xs')}<span id="lockNote"></span></div>
  </section>
  <section class="section"><div class="section-head"><p class="eyebrow"><span class="n">ii.</span> Outfit</p><span class="small muted" id="gCount"></span></div>
    <div class="tiles" id="tiles"></div><input type="file" id="gFile" accept="image/*" multiple hidden>
    <label class="field" style="margin-top:14px"><span>Describe the look</span><textarea id="outfitText" placeholder="e.g. ivory silk slip dress with thin straps, bias cut, midi length">${esc(draft.outfitText)}</textarea></label>
    <div class="grid2" style="margin-top:12px">
      <label class="field"><span>Fabric</span><select id="fabric">${Object.entries(FABRICS).map(([k, f]) => `<option value="${k}" ${k === draft.fabric ? 'selected' : ''}>${f.label}</option>`).join('')}</select></label>
      <label class="field"><span>Fit</span><select id="fit">${Object.entries(FITS).map(([k, f]) => `<option value="${k}" ${k === draft.fit ? 'selected' : ''}>${f.label}</option>`).join('')}</select></label></div>
    <label class="field" style="margin-top:12px"><span>Colour / print</span><input type="text" id="color" value="${esc(draft.color)}" placeholder="e.g. deep espresso brown"></label>
    <div class="field" style="margin-top:14px"><span>Footwear</span><div class="chips scroll">${Object.keys(FOOTWEAR).map(k => chip('foot', k, { barefoot: 'Barefoot', sneakers: 'Sneakers', heels: 'Heels', sandals: 'Sandals', boots: 'Tall boots', ankle: 'Ankle boots', loafers: 'Loafers', flats: 'Flats', match: 'Stylist’s pick' }[k], draft.footwear === k)).join('')}${chip('foot', 'custom', 'Custom…', draft.footwear === 'custom')}</div>
      <input type="text" id="footText" value="${esc(draft.footwearText)}" placeholder="Describe the shoes" style="margin-top:8px;${draft.footwear === 'custom' ? '' : 'display:none'}"></div>
    <div class="field" style="margin-top:14px"><span>Accessories</span><div class="chips">${ACCESSORIES.map(a => chip('acc', a, a, draft.accessories.includes(a))).join('')}</div>
      <input type="text" id="accText" value="${esc(draft.accessoriesText)}" placeholder="Anything else (optional)" style="margin-top:8px"></div>
    <label class="switch" style="margin-top:6px"><span><b>Keep reference jewellery</b><br><span class="small muted">Otherwise jewellery in the reference is removed.</span></span><input type="checkbox" id="keepJewelry" ${draft.keepJewelry ? 'checked' : ''}></label>
  </section>
  <section class="section"><p class="eyebrow"><span class="n">iii.</span> View</p>
    <div class="seg" id="viewSeg">${Object.entries(VIEWS).map(([k, x]) => `<button type="button" data-v="${k}" aria-pressed="${draft.view === k}">${k === 'sheet' ? 'Sheet' : x.label}</button>`).join('')}</div>
    <p class="small muted" id="viewHint" style="margin:8px 2px 0"></p></section>
  <details class="section" id="realismBox" ${localStorage.getItem('avata.realismOpen') === '0' ? '' : 'open'}>
    <summary><p class="eyebrow" style="margin:0"><span class="n">iv.</span> Skin, fabric &amp; human realism</p></summary>
    <div id="levels">${Object.entries(REALISM).map(([k, r]) => `<div class="level"><div><div class="t">${r.label}</div><div class="d">${{ skin: 'Pores, fine hair, no plastic look', fabric: 'Drape, folds, tension, seams, sheen', anatomy: 'Hands, feet, joints, balance' }[k]}</div></div><div class="seg" data-k="${k}">${['Off', 'Natural', 'Max'].map((l, i) => `<button type="button" data-v="${i}" aria-pressed="${draft.realism[k] === i}">${l}</button>`).join('')}</div></div>`).join('')}</div>
    <div class="divider"></div>
    <div class="field"><span>Lighting &amp; set</span><div class="chips scroll">${Object.entries(LIGHTING).map(([k, l]) => chip('light', k, l.label, draft.lighting === k)).join('')}</div></div>
    <div class="field" style="margin-top:14px"><span>Camera &amp; lens</span><div class="chips scroll">${Object.entries(CAMERAS).map(([k, c]) => chip('cam', k, c.label, draft.camera === k)).join('')}</div></div>
    <label class="field" style="margin-top:14px"><span>Extra direction (optional)</span><input type="text" id="extra" value="${esc(draft.extra)}" placeholder="e.g. hands in pockets, soft smile"></label>
  </details>
  ${gen ? `<section class="section"><p class="eyebrow"><span class="n">v.</span> Render with your key</p>
    <label class="field"><span>AI model</span><select id="aiModel">${modelOptions(ai.id)}</select></label>
    <p class="small muted" id="aiBlurb" style="margin:8px 2px 0"></p>
    <div class="row between" style="margin-top:12px"><span class="small"><b>Variations</b></span><div class="seg" id="numSeg" style="min-width:160px">${[1, 2, 3, 4].map(n => `<button type="button" data-v="${n}" aria-pressed="${draft.numImages === n}">${n}</button>`).join('')}</div></div></section>
  <div id="job"></div>` : ''}
  <div class="gen-bar">${gen ? `<div class="row" style="flex-wrap:nowrap"><button class="btn btn-line" id="copyP" style="min-height:56px">${icon('copy', 'sm')}</button><button class="btn btn-solid btn-lg grow" id="go">${icon('spark')} <span>Generate</span></button></div>`
    : `<div class="row" style="flex-wrap:nowrap"><button class="btn btn-solid btn-lg grow" id="copyP">${icon('copy')} Copy prompt</button><button class="btn btn-line btn-lg" id="shareP" aria-label="Share prompt and reference images">${icon('share')}</button></div><p class="cost">Copy the prompt, then share the numbered reference images (model front, back, garments) with your assistant.</p>`}</div>`;

  $('#unlink')?.addEventListener('click', () => { draft.styleIds = []; saveDraft(); renderStudio(v, new URLSearchParams()); });
  $('#modelStrip').onclick = e => { const b = e.target.closest('.card-model[data-id]'); if (!b) return; draft.modelId = b.dataset.id; saveDraft(); $$('#modelStrip .card-model').forEach(x => x.setAttribute('aria-pressed', x === b)); bits(); };
  renderTiles();
  $('#gFile').onchange = async e => { for (const f of e.target.files) { try { garments.push({ id: uid(), blob: await resizeBlob(f, 1280, 'image/jpeg', 0.9) }); } catch { toast(`Couldn't read ${f.name}`); } } e.target.value = ''; saveGarments(); renderTiles(); bits(); };
  const bind = (id, key) => $('#' + id).addEventListener('input', e => { draft[key] = e.target.value; saveDraft(); });
  bind('outfitText', 'outfitText'); bind('color', 'color'); bind('footText', 'footwearText'); bind('accText', 'accessoriesText'); bind('extra', 'extra');
  $('#keepJewelry').onchange = e => { draft.keepJewelry = e.target.checked; saveDraft(); };
  $('#fabric').onchange = e => { draft.fabric = e.target.value; saveDraft(); };
  $('#fit').onchange = e => { draft.fit = e.target.value; saveDraft(); };
  v.addEventListener('click', e => {
    const c = e.target.closest('.chip[data-g]'); if (!c) return; const g = c.dataset.g, val = c.dataset.v;
    if (g === 'acc') { const i = draft.accessories.indexOf(val); i < 0 ? draft.accessories.push(val) : draft.accessories.splice(i, 1); c.setAttribute('aria-pressed', i < 0); }
    else { draft[{ foot: 'footwear', light: 'lighting', cam: 'camera' }[g]] = val; $$(`.chip[data-g="${g}"]`).forEach(x => x.setAttribute('aria-pressed', x === c)); if (g === 'foot') $('#footText').style.display = val === 'custom' ? '' : 'none'; }
    saveDraft();
  });
  $('#viewSeg').onclick = e => { const b = e.target.closest('button'); if (!b || b.disabled) return; draft.view = b.dataset.v; saveDraft(); bits(); };
  $('#levels').onclick = e => { const b = e.target.closest('button'); if (!b) return; draft.realism[b.parentElement.dataset.k] = +b.dataset.v; $$('button', b.parentElement).forEach(x => x.setAttribute('aria-pressed', x === b)); saveDraft(); };
  $('#realismBox').ontoggle = e => localStorage.setItem('avata.realismOpen', e.target.open ? '1' : '0');
  if (gen) {
    $('#aiModel').onchange = e => { draft.aiModel = e.target.value; saveDraft(); bits(); };
    $('#numSeg').onclick = e => { const b = e.target.closest('button'); if (!b || b.disabled) return; draft.numImages = +b.dataset.v; saveDraft(); bits(); };
    $('#go').onclick = generate;
  }
  $('#copyP').onclick = copyPrompt;
  $('#shareP')?.addEventListener('click', async () => { const mm = modelById(draft.modelId); if (!mm) return; await copyPrompt(); await shareRefs(mm, garments.map(g => g.blob)); });
  bits(); renderJob();
}

function modelOptions(sel) {
  return Object.entries(PROVIDERS).map(([p, P]) => `<optgroup label="${P.label}${getKey(p) ? '' : ' — add key in Settings'}">${MODELS.filter(m => m.provider === p).map(m => `<option value="${m.id}" ${m.id === sel ? 'selected' : ''}>${m.label}</option>`).join('')}</optgroup>`).join('');
}
export { modelOptions };

function bits() {
  const gen = canGenerate();
  const ai = getModel(draft.aiModel || settings.model);
  const m = modelById(draft.modelId);
  const allowed = k => (!gen || ai.views === 'all' || ai.views.includes(k)) && !(!m?.back && (k === 'back' || k === 'sheet')) && !(k === 'sheet' && !m?.sheet);
  if (!allowed(draft.view)) draft.view = 'front';
  $$('#viewSeg button').forEach(b => { b.disabled = !allowed(b.dataset.v); b.setAttribute('aria-pressed', b.dataset.v === draft.view); });
  $('#viewHint').textContent = { front: 'Full body, facing camera — 3:4 portrait.', back: 'Full body from behind, using the back reference — 3:4.', three: 'Full body, turned ~45° — 3:4.', sheet: 'Square sheet: front left, back right — matches your reference format (1:1).' }[draft.view];
  $('#lockNote').textContent = m ? `Identity lock — ${m.back ? 'front + back' : 'front'} reference${m.back ? 's' : ''}${m.heightCm ? `, height ${formatHeight(m.heightCm)}` : ''}${m.size ? `, size ${m.size}` : ''}${measurementsText(m.measurements, m.measureUnit) ? ', measurements' : ''} included.` : 'Import a model to begin.';
  $('#gCount').textContent = garments.length ? `${garments.length} photo${garments.length > 1 ? 's' : ''}` : '';
  if (gen) {
    $('#aiBlurb').innerHTML = `${esc(ai.vendor)} · ${esc(ai.blurb)}${getKey(ai.provider) ? '' : ` <a href="#/settings">Add key in Settings → Advanced →</a>`}`;
    if (ai.single && draft.numImages > 1) draft.numImages = 1;
    $$('#numSeg button').forEach(b => { b.disabled = ai.single && b.dataset.v !== '1'; b.setAttribute('aria-pressed', +b.dataset.v === draft.numImages); });
    $('#go').disabled = !!job?.running || !m;
  }
}

function renderTiles() {
  const t = $('#tiles'); if (!t) return;
  t.innerHTML = garments.map(g => `<div class="tile"><img src="${urlFor(g.blob)}" alt="Garment photo"><button class="x" data-id="${g.id}" aria-label="Remove garment">${icon('x', 'xs')}</button></div>`).join('') +
    `<button type="button" class="tile add" id="addG">${icon('hanger')}<span>${garments.length ? 'Add more' : 'Add garment photos'}</span><span class="tiny">flat lay · product · hanger</span></button>`;
  $('#addG').onclick = () => $('#gFile').click();
  t.querySelectorAll('.x').forEach(b => b.onclick = () => { garments = garments.filter(g => g.id !== b.dataset.id); saveGarments(); renderTiles(); bits(); });
}

function promptRefs(m, ai) {
  const refs = [];
  if (draft.view === 'sheet') refs.push({ role: 'sheet' }); else { refs.push({ role: 'front' }); if (m.back) refs.push({ role: 'back' }); }
  const room = canGenerate() ? (ai.usesPrompt ? Math.max(0, ai.maxImages - refs.length) : 1) : 12;
  const used = garments.slice(0, room); used.forEach(() => refs.push({ role: 'garment' }));
  return { refs, used };
}
function currentPrompt() {
  const m = modelById(draft.modelId); if (!m) throw new Error('Choose or import a model first.');
  const ai = getModel(draft.aiModel || settings.model);
  const { refs, used } = promptRefs(m, ai);
  const p = buildPrompt({ ...draft, model: m, refs });
  return { m, ai, refs, used, prompt: p };
}
async function copyPrompt() {
  let c; try { c = currentPrompt(); } catch (e) { toast(e.message); return; }
  const out = `${c.prompt}\n\nOutput: one photorealistic image, aspect ratio ${VIEWS[draft.view].aspect}${draft.view === 'sheet' ? ' (square)' : ' portrait'}, high resolution.`;
  try { await navigator.clipboard.writeText(out); toast('Prompt copied — paste it to your assistant.'); }
  catch { openPromptPreview(); toast('Clipboard blocked — select and copy from the preview.'); }
}

async function openPromptPreview() {
  let c; try { c = currentPrompt(); } catch (e) { toast(e.message); return; }
  const files = c.refs.map((r, i) => `${i + 1}. ${r.role === 'garment' ? 'garment photo' : `${c.m.name} — ${r.role}`}`).join('<br>');
  openSheet(`<div class="modal"><div class="row between"><h2 class="h">Prompt</h2><button class="icon-btn btn-ghost" data-close aria-label="Close">${icon('x')}</button></div>
  <p class="small muted">Attach the reference images in this order:<br>${files}</p>
  <pre class="prompt" id="pTxt">${esc(c.prompt)}</pre>
  <div class="row" style="margin:12px 0"><button class="btn btn-solid" id="cpy">${icon('copy', 'sm')} Copy prompt</button><button class="btn btn-line" id="shr">${icon('share', 'sm')} Share images</button></div></div>`);
  $('#cpy').onclick = copyPrompt;
  $('#shr').onclick = () => shareRefs(c.m, c.used.map(g => g.blob));
}

/* ---------- BYOK generation (only when enabled in Settings → Advanced) ---------- */
const linkify = s => s.replace(/https?:\/\/[^\s)]+/g, u => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
function renderJob() {
  const el = $('#job'); if (!el) return;
  if (!job) { el.innerHTML = ''; return; }
  if (job.running) {
    const s = job.status || {}; const secs = Math.round((Date.now() - job.startedAt) / 1000);
    el.innerHTML = `<div class="section job"><div class="spinner" aria-hidden="true"></div><div><b>${s.phase === 'queued' ? `In queue${s.position != null ? ` · position ${s.position + 1}` : ''}` : s.phase === 'preparing' ? 'Preparing references…' : 'Rendering'}</b><div class="small muted">${esc(job.label)} · ${secs}s${s.log ? ` · ${esc(s.log.slice(0, 80))}` : ''}</div></div><button class="btn-line small" id="cancelJob">Cancel</button></div>`;
    $('#cancelJob').onclick = () => job.controller.abort();
  } else if (job.error) {
    const e = job.error;
    el.innerHTML = `<div class="section err" role="alert"><div class="row between"><b>${esc(e.message)}</b><button class="icon-btn btn-ghost" id="dismissErr" aria-label="Dismiss">${icon('x', 'sm')}</button></div>${e.hint ? `<p class="small" style="margin:6px 0 0">${linkify(esc(e.hint))}</p>` : ''}${e.raw && e.raw !== e.message ? `<details class="small muted" style="margin-top:6px"><summary>Details</summary><code style="word-break:break-all">${esc(String(e.raw).slice(0, 600))}</code></details>` : ''}</div>`;
    $('#dismissErr').onclick = () => { job = null; renderJob(); };
  }
}
setInterval(() => { if (job?.running && $('#job')) renderJob(); }, 1000);
const fetchAsBlob = async url => { try { const r = await fetch(url, { mode: 'cors' }); if (!r.ok) throw 0; return await r.blob(); } catch { return null; } };
const dataUrlToBlob = u => fetch(u).then(r => r.blob());

async function generate() {
  if (!canGenerate() || job?.running) return;
  const ai = getModel(draft.aiModel || settings.model); const key = getKey(ai.provider);
  const fail = e => { job = { error: e instanceof ProviderError ? e : new ProviderError(e.message || String(e)) }; renderJob(); bits(); };
  if (!key) return fail(new ProviderError(`Add your ${PROVIDERS[ai.provider].label} key first.`, { hint: 'Settings → Advanced → Bring your own API key.' }));
  if (ai.needsGarment && !garments.length) return fail(new ProviderError(`${ai.label} needs a garment photo.`));
  if (!garments.length && !draft.outfitText.trim()) return fail(new ProviderError('Add a garment photo or describe the outfit.'));
  const controller = new AbortController();
  job = { running: true, startedAt: Date.now(), controller, label: ai.label, status: { phase: 'preparing' } }; renderJob(); bits();
  const done = holdWork('generate');
  try {
    const { m, prompt, refs, used } = currentPrompt();
    const images = [];
    if (draft.view === 'sheet') images.push(await dataUrlForUpload(m.sheet, 1536)); else { images.push(await dataUrlForUpload(m.front, 1536)); if (m.back) images.push(await dataUrlForUpload(m.back, 1536)); }
    const gUrls = []; for (const g of used) { const u = await dataUrlForUpload(g.blob, 1280); gUrls.push(u); images.push(u); }
    void refs;
    const req = buildRequest(ai.id, { prompt, images, aspect: VIEWS[draft.view].aspect, resolution: settings.resolution, numImages: draft.numImages, safety: settings.safety, modelImage: draft.view === 'sheet' ? await dataUrlForUpload(m.front, 1536) : images[0], garmentImages: gUrls });
    const onStatus = s => { job.status = s; renderJob(); };
    const outs = req.provider === 'fal' ? parseFalImages(await runFal({ endpoint: req.endpoint, body: req.body, key, onStatus, signal: controller.signal })) : await runGemini({ body: req.body, key, onStatus, signal: controller.signal });
    if (!outs.length) throw new ProviderError('The provider returned no images.');
    const saved = [];
    for (const o of outs) {
      const blob = o.dataUrl ? await dataUrlToBlob(o.dataUrl) : await fetchAsBlob(o.url); if (!blob) continue;
      saved.push(await saveLook({ id: uid(), image: blob, thumb: await makeThumb(blob, 640), remoteUrl: o.url || null, modelId: m.id, styleIds: [...draft.styleIds], colorway: draft.color, view: draft.view, title: '', notes: '', tags: [], favorite: false, source: 'generated', prompt, aiModel: ai.id, createdAt: Date.now() }));
    }
    job = null; renderJob(); bits();
    if (saved.length) { toast(`${saved.length} look${saved.length > 1 ? 's' : ''} saved to the lookbook.`); openLook(saved[0].id); }
  } catch (e) { if (e.name === 'AbortError') { job = null; renderJob(); bits(); toast('Cancelled.'); return; } console.error(e); fail(e); }
  finally { done(); }
}

export function openUpscale(l) {
  if (!settings.byok) return;
  openSheet(`<div class="modal"><div class="row between"><h2 class="h">Upscale &amp; detail</h2><button class="icon-btn btn-ghost" data-close aria-label="Close">${icon('x')}</button></div>
  <p class="small muted">Uses your own API key (billed by the provider). Saves a new copy.</p><div class="stack">${UPSCALERS.map(u => `<button class="btn-line btn-block" data-u="${u.id}" style="justify-content:flex-start;border-radius:14px">${icon(u.refine ? 'spark' : 'up', 'sm')} ${esc(u.label)}</button>`).join('')}</div></div>`);
  $$('[data-u]').forEach(b => b.onclick = () => { closeSheet(); upscale(l, b.dataset.u); });
}
async function upscale(l, upId) {
  const u = UPSCALERS.find(x => x.id === upId) || UPSCALERS[0];
  const em0 = getModel(draft.aiModel || settings.model); const provider = u.refine && em0.provider === 'gemini' ? 'gemini' : 'fal';
  const key = getKey(provider); if (!key) { toast(`Add your ${PROVIDERS[provider].label} key in Settings → Advanced.`); return; }
  toast(`${u.label} started…`, { ms: 2500 });
  const done = holdWork('upscale');
  try {
    const imgUrl = l.remoteUrl && /fal\.media/.test(l.remoteUrl) ? l.remoteUrl : await blobToDataUrl(l.image);
    let outs;
    if (u.refine) {
      const em = em0.usesPrompt ? em0 : getModel('fal-ai/nano-banana-pro/edit'); const m = modelById(l.modelId);
      const images = [await dataUrlForUpload(l.image, 2048)]; if (m?.front) images.push(await dataUrlForUpload(m.front, 1536));
      const req = buildRequest(em.id, { prompt: REFINE_PROMPT + (m?.front ? ' Image 2 is the identity reference of the same woman — match her face exactly.' : ''), images, aspect: VIEWS[l.view]?.aspect || '3:4', resolution: '2K', numImages: 1, safety: settings.safety });
      outs = req.provider === 'fal' ? parseFalImages(await runFal({ endpoint: req.endpoint, body: req.body, key })) : await runGemini({ body: req.body, key });
    } else outs = parseFalImages(await runFal({ endpoint: u.endpoint || u.id, body: u.build(imgUrl), key }));
    const o = outs[0]; if (!o) throw new ProviderError('No image returned.');
    const blob = o.dataUrl ? await dataUrlToBlob(o.dataUrl) : await fetchAsBlob(o.url);
    const n = await saveLook({ ...l, id: uid(), image: blob, thumb: await makeThumb(blob, 640), remoteUrl: o.url || null, parentId: l.id, favorite: false, title: `${u.refine ? 'Refined' : 'Upscaled'}`, createdAt: Date.now() });
    toast('New copy saved.', { action: 'View', onAction: () => openLook(n.id) });
  } catch (e) { toast(`${e.message}${e.hint ? ' ' + e.hint : ''}`, { ms: 9000 }); }
  finally { done(); }
}
