// Lookbook: grid, filters, bulk import, look viewer/editor, buyer showcase.
import { holdWork, $, $$, esc, icon, urlFor, chip, toast, openSheet, closeSheet, setTop, shareOrDownload, slug, fmtDay, debounce } from './ui.js';
import { S, settings, CATEGORIES, STATUSES, VIEW_LABEL, modelById, styleById, lookById, collections, allTags, lookCollections, filterLooks, saveLook, deleteLook, uid } from './store.js';
import { resizeBlob, makeThumb } from './imaging.js';
import { formatHeight } from './prompt.js';

const F0 = { q: '', collection: '', category: '', status: '', model: '', tag: '', view: '', fav: false, unlinked: false, sort: 'new' };
let F = { ...F0, ...JSON.parse(sessionStorage.getItem('avata.lookFilter') || '{}') };
const saveF = () => sessionStorage.setItem('avata.lookFilter', JSON.stringify(F));

export function lookTitle(l) {
  const st = (l.styleIds || []).map(styleById).filter(Boolean);
  return l.title && !st.length ? l.title : st.length ? st[0].name + (st.length > 1 ? ` +${st.length - 1}` : '') : (l.title || 'Unlinked mockup');
}
export function lookCard(l) {
  const m = modelById(l.modelId);
  return `<button type="button" class="look fade-in" data-lid="${l.id}"><img src="${urlFor(l.thumb || l.image)}" alt="${esc(lookTitle(l))}" loading="lazy">
    ${l.sample ? '<span class="badge tl">Sample</span>' : ''}${l.favorite ? `<span class="fav">${icon('heart-f', 'sm')}</span>` : ''}
    <span class="cap"><b>${esc(lookTitle(l))}</b><span>${esc([m?.name, VIEW_LABEL[l.view], l.colorway].filter(Boolean).join(' · '))}</span></span></button>`;
}
export function bindLooks(root, list) {
  root.querySelectorAll('.look').forEach(b => b.onclick = () => openLook(b.dataset.lid, list));
}

/* ---------------- Lookbook tab ---------------- */
export function renderLookbook(v) {
  setTop('Lookbook', `<a class="btn btn-solid" href="#/import-looks" style="min-height:38px">${icon('plus', 'sm')} Import</a>`);
  const cols = collections();
  const active = Object.entries(F).filter(([k, x]) => !['q', 'sort'].includes(k) && x);
  v.innerHTML = `<h1 class="display fade-in">The <em>lookbook</em></h1>
  <p class="lede">${S.looks.length} mockup${S.looks.length === 1 ? '' : 's'} on this device. Import from your camera roll, link to styles and models, then show buyers in Showcase.</p>
  ${cols.length ? `<div class="collections">${cols.map(c => { const ls = filterLooks({ collection: c }); return `<button type="button" class="coll" data-c="${esc(c)}"><span class="cov">${ls.slice(0, 3).map(l => `<img src="${urlFor(l.thumb || l.image)}" alt="">`).join('') || icon('image')}</span><b>${esc(c)}</b><span>${ls.length} look${ls.length === 1 ? '' : 's'} · ${icon('play', 'xs')} Showcase</span></button>`; }).join('')}</div>` : ''}
  <div class="searchbar"><svg class="i sm" aria-hidden="true"><use href="#i-search"/></svg><input type="search" id="lq" placeholder="Search style, SKU, model, colour, tag" value="${esc(F.q)}" enterkeyhint="search"></div>
  <div class="row between" style="margin:10px 0 12px;flex-wrap:nowrap">
    <div class="chips scroll grow" style="margin:0;padding:2px 0">
      <button type="button" class="chip" id="lFilt" aria-pressed="${active.length > 0}">${icon('filter', 'xs')} Filters${active.length ? ` · ${active.length}` : ''}</button>
      ${active.map(([k, x]) => `<button type="button" class="chip on-x" data-clear="${k}">${esc(filterLabel(k, x))} ${icon('x', 'xs')}</button>`).join('')}
    </div>
    <select id="lSort" class="mini" aria-label="Sort">${[['new', 'Newest'], ['old', 'Oldest'], ['style', 'Style A–Z'], ['sku', 'SKU'], ['model', 'Model']].map(([k, l]) => `<option value="${k}" ${F.sort === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
  </div>
  <div id="lres"></div>`;
  const draw = () => {
    const list = filterLooks(F);
    $('#lres').innerHTML = list.length ? `<div class="row between" style="margin-bottom:10px"><span class="small muted">${list.length} shown</span><button class="btn btn-line" id="lShow" style="min-height:36px">${icon('play', 'sm')} Showcase these</button></div><div class="masonry" id="lgrid">${list.map(lookCard).join('')}</div>`
      : `<div class="empty"><div class="art">${icon('grid')}</div><p class="display">${S.looks.length ? 'Nothing matches' : 'No mockups yet'}</p><p>${S.looks.length ? 'Try clearing a filter.' : 'Import mockups your assistant generated — single or many at once.'}</p>${S.looks.length ? '' : `<a class="btn btn-solid" href="#/import-looks">${icon('plus', 'sm')} Import mockups</a>`}</div>`;
    if ($('#lgrid')) { bindLooks($('#lgrid'), list); $('#lShow').onclick = () => openShowcase({ title: F.collection || (F.model && modelById(F.model)?.name) || 'Lookbook', subtitle: `${list.length} looks`, looks: list }); }
  };
  draw();
  $('#lq').oninput = debounce(e => { F.q = e.target.value; saveF(); draw(); }, 150);
  $('#lSort').onchange = e => { F.sort = e.target.value; saveF(); draw(); };
  $('#lFilt').onclick = () => openFilterSheet(() => renderLookbook(v));
  $$('[data-clear]').forEach(b => b.onclick = () => { F[b.dataset.clear] = F0[b.dataset.clear]; saveF(); renderLookbook(v); });
  $$('.coll').forEach(b => b.onclick = () => { const c = b.dataset.c; const list = filterLooks({ collection: c, sort: 'style' }); if (!list.length) { F.collection = c; saveF(); renderLookbook(v); return; } openShowcase({ title: c, subtitle: `${list.length} looks`, looks: list }); });
}
function filterLabel(k, x) {
  if (k === 'model') return modelById(x)?.name || 'Model';
  if (k === 'fav') return 'Favorites'; if (k === 'unlinked') return 'Unlinked'; if (k === 'view') return VIEW_LABEL[x];
  return x;
}
function openFilterSheet(done) {
  const sel = (id, label, opts, val) => `<label class="field"><span>${label}</span><select id="${id}"><option value="">All</option>${opts.map(([k, l]) => `<option value="${esc(k)}" ${k === val ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
  openSheet(`<div class="modal"><div class="row between"><h2 class="h">Filter looks</h2><button class="icon-btn btn-ghost" data-close aria-label="Close">${icon('x')}</button></div>
  <div class="stack" style="margin-top:12px">
    ${sel('fC', 'Collection', collections().map(c => [c, c]), F.collection)}
    <div class="grid2">${sel('fK', 'Category', CATEGORIES.map(c => [c, c]), F.category)}${sel('fS', 'Status', STATUSES.map(c => [c, c]), F.status)}</div>
    <div class="grid2">${sel('fM', 'Model', S.models.map(m => [m.id, m.name]), F.model)}${sel('fV', 'View', Object.entries(VIEW_LABEL), F.view)}</div>
    ${sel('fT', 'Tag', allTags().map(t => [t, t]), F.tag)}
    <label class="switch"><span>Favorites only</span><input type="checkbox" id="fF" ${F.fav ? 'checked' : ''}></label>
    <label class="switch"><span>Not linked to a style yet</span><input type="checkbox" id="fU" ${F.unlinked ? 'checked' : ''}></label>
  </div>
  <div class="row" style="margin-top:16px"><button class="btn btn-line grow" id="fReset">Reset</button><button class="btn btn-solid grow" id="fApply">Show results</button></div></div>`, 'half');
  $('#fReset').onclick = () => { F = { ...F0, q: F.q, sort: F.sort }; saveF(); closeSheet(); done(); };
  $('#fApply').onclick = () => { Object.assign(F, { collection: $('#fC').value, category: $('#fK').value, status: $('#fS').value, model: $('#fM').value, view: $('#fV').value, tag: $('#fT').value, fav: $('#fF').checked, unlinked: $('#fU').checked }); saveF(); closeSheet(); done(); };
}

/* ---------------- Bulk import ---------------- */
export function renderImportLooks(v, params) {
  setTop('Import mockups', `<a class="btn btn-ghost" href="#/looks" style="min-height:38px">${icon('back', 'sm')} Lookbook</a>`);
  const st = { items: [], modelId: params.get('model') || '', styleIds: params.get('style') ? [params.get('style')] : [], busy: false };
  v.innerHTML = `<h1 class="display fade-in">Import <em>mockups</em></h1><p class="lede">Pick one or many images from Photos or Files. Link them to a model and styles now (or later, one by one).</p>
  <input type="file" id="lf" accept="image/*" multiple hidden>
  <button class="tile add btn-block" id="lpick" style="aspect-ratio:auto;min-height:150px;width:100%;border-radius:var(--r)">${icon('image')}<b style="color:var(--ink)">Choose images</b><span class="small">JPEG · PNG · WebP · HEIC (Safari) — bulk OK</span></button>
  <div id="lsel" style="margin-top:14px"></div>
  <section class="section" style="margin-top:14px"><p class="eyebrow">Apply to all</p>
    <label class="field"><span>Model</span><select id="lm"><option value="">— None —</option>${S.models.map(m => `<option value="${m.id}" ${m.id === st.modelId ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>
    <div class="field" style="margin-top:12px"><span>Styles</span><div id="lstyles"></div></div>
    <label class="field" style="margin-top:12px"><span>Colorway</span><input type="text" id="lc" list="lcList" placeholder="e.g. Espresso"><datalist id="lcList"></datalist></label>
    <label class="field" style="margin-top:12px"><span>Tags (comma separated)</span><input type="text" id="lt" placeholder="e.g. SS27, buyer-pick"></label>
  </section>
  <button class="btn btn-solid btn-lg btn-block" id="lsave" disabled>${icon('check')} Import</button>`;
  const stylesUI = mountStylePicker($('#lstyles'), st.styleIds, ids => { st.styleIds = ids; colorList(); });
  const colorList = () => { $('#lcList').innerHTML = [...new Set(st.styleIds.flatMap(id => styleById(id)?.colorways || []))].map(c => `<option value="${esc(c)}">`).join(''); if (!$('#lc').value) { const c = styleById(st.styleIds[0])?.colorways?.[0]; if (c) $('#lc').value = c; } };
  colorList();
  const drawSel = () => {
    $('#lsel').innerHTML = st.items.length ? `<p class="eyebrow">${st.items.length} selected · set each view</p><div class="imp-grid">${st.items.map((it, i) => `<div class="imp"><img src="${urlFor(it.thumb)}" alt=""><select data-i="${i}" aria-label="View">${Object.entries(VIEW_LABEL).map(([k, l]) => `<option value="${k}" ${it.view === k ? 'selected' : ''}>${l}</option>`).join('')}</select><button class="x" data-rm="${i}" aria-label="Remove">${icon('x', 'xs')}</button></div>`).join('')}</div>` : '';
    $$('#lsel select').forEach(s => s.onchange = () => { st.items[+s.dataset.i].view = s.value; });
    $$('#lsel [data-rm]').forEach(b => b.onclick = () => { st.items.splice(+b.dataset.rm, 1); drawSel(); });
    $('#lsave').disabled = !st.items.length; $('#lsave').innerHTML = `${icon('check')} Import ${st.items.length || ''} mockup${st.items.length === 1 ? '' : 's'}`;
  };
  $('#lpick').onclick = () => $('#lf').click();
  $('#lf').onchange = async e => {
    const files = [...e.target.files]; e.target.value = '';
    $('#lpick').querySelector('b').textContent = `Reading ${files.length}…`;
    for (const f of files) {
      try {
        const image = await resizeBlob(f, 2400, 'image/webp', 0.9); const thumb = await makeThumb(image, 640);
        const bmp = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = urlFor(thumb); });
        const ar = bmp ? bmp.naturalWidth / bmp.naturalHeight : 0.75;
        st.items.push({ image, thumb, view: ar > 0.9 && ar < 1.1 ? 'sheet' : ar >= 1.1 ? 'other' : /back/i.test(f.name) ? 'back' : 'front', name: f.name });
      } catch { toast(`Couldn't read ${f.name}`); }
    }
    $('#lpick').querySelector('b').textContent = 'Add more images';
    drawSel();
  };
  $('#lsave').onclick = async () => {
    if (st.busy) return; st.busy = true; $('#lsave').disabled = true; const done = holdWork('import-save');
    const tags = $('#lt').value.split(',').map(t => t.trim()).filter(Boolean);
    const base = Date.now();
    for (const [i, it] of st.items.entries()) await saveLook({ id: uid(), image: it.image, thumb: it.thumb, modelId: $('#lm').value || null, styleIds: [...st.styleIds], colorway: $('#lc').value.trim(), view: it.view, title: '', notes: '', tags, favorite: false, source: 'import', fileName: it.name, createdAt: base - i });
    done(); toast(`${st.items.length} mockup${st.items.length === 1 ? '' : 's'} imported.`);
    location.hash = st.styleIds.length === 1 ? `#/style/${encodeURIComponent(st.styleIds[0])}` : '#/looks';
  };
  void stylesUI;
}

/** Searchable multi-select of styles. */
export function mountStylePicker(el, initial, onChange) {
  let ids = [...initial]; let q = '';
  const draw = () => {
    const t = q.toLowerCase();
    const list = S.styles.filter(s => !t || `${s.sku} ${s.name} ${s.collection}`.toLowerCase().includes(t)).sort((a, b) => (a.sku || '').localeCompare(b.sku || '', undefined, { numeric: true }));
    el.innerHTML = `<div class="chips" style="margin-bottom:8px">${ids.map(id => { const s = styleById(id); return s ? `<button type="button" class="chip" aria-pressed="true" data-rm="${id}">${esc(s.sku || s.name)} ${icon('x', 'xs')}</button>` : ''; }).join('') || '<span class="small muted">None linked</span>'}</div>
    ${S.styles.length ? `<input type="search" class="sp-q" placeholder="Find style by SKU or name" value="${esc(q)}"><div class="picklist">${list.slice(0, 40).map(s => `<label class="pick"><input type="checkbox" value="${s.id}" ${ids.includes(s.id) ? 'checked' : ''}><span><b>${esc(s.sku || '—')}</b> ${esc(s.name)}<span class="tiny muted"> ${esc(s.collection || '')}</span></span></label>`).join('')}</div>` : '<p class="small muted">No styles yet — <a href="#/style-edit/new">create one</a>.</p>'}`;
    el.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { ids = ids.filter(x => x !== b.dataset.rm); onChange(ids); draw(); });
    el.querySelectorAll('.pick input').forEach(c => c.onchange = () => { ids = c.checked ? [...ids, c.value] : ids.filter(x => x !== c.value); onChange(ids); draw(); });
    const qi = el.querySelector('.sp-q'); if (qi) qi.oninput = debounce(e => { q = e.target.value; draw(); const n = el.querySelector('.sp-q'); n.focus(); n.setSelectionRange(q.length, q.length); }, 200);
  };
  draw();
  return { get: () => ids };
}

/* ---------------- Look viewer ---------------- */
export function openLook(id, list = null, mode = 'single') {
  const l = lookById(id); if (!l) return;
  const m = modelById(l.modelId);
  const st = (l.styleIds || []).map(styleById).filter(Boolean);
  const ref = !m ? null : l.view === 'back' ? m.back : l.view === 'sheet' ? m.sheet : m.front;
  const src = urlFor(l.image);
  const idx = list ? list.findIndex(x => x.id === id) : -1;
  const stage = mode === 'side' && ref ? `<div class="compare"><figure><img src="${urlFor(ref)}" alt="Reference"><figcaption>Reference</figcaption></figure><figure><img src="${src}" alt="Mockup"><figcaption>Mockup</figcaption></figure></div>`
    : mode === 'wipe' && ref ? `<div class="wipe" id="wipe"><img src="${urlFor(ref)}" alt="Reference"><img class="top-img" src="${src}" alt="Mockup"><div class="bar"></div></div>`
    : `<img src="${src}" alt="Mockup" id="vImg">`;
  openSheet(`<div class="viewer">
    <div class="viewer-top"><button class="icon-btn btn-ghost" data-close aria-label="Close">${icon('back')}</button><div class="ttl"><b>${esc(lookTitle(l))}</b><span class="tiny muted">${esc([m?.name, VIEW_LABEL[l.view], l.colorway].filter(Boolean).join(' · '))}${l.sample ? ' · SAMPLE' : ''}</span></div>${idx >= 0 ? `<span class="tiny muted">${idx + 1}/${list.length}</span>` : ''}</div>
    <div class="viewer-sub"><div class="seg" id="cmpSeg">${[['single', 'Mockup'], ['side', 'Side by side'], ['wipe', 'Wipe']].map(([k, lb]) => `<button type="button" data-v="${k}" aria-pressed="${mode === k}" ${!ref && k !== 'single' ? 'disabled' : ''}>${lb}</button>`).join('')}</div></div>
    <div class="viewer-stage" id="vStage">${stage}</div>
    ${st.length ? `<div class="viewer-links">${st.map(s => `<a class="pill" href="#/style/${encodeURIComponent(s.id)}">${esc(s.sku || '')} ${esc(s.name)}</a>`).join('')}</div>` : ''}
    <div class="viewer-actions">
      <button id="vFav">${icon(l.favorite ? 'heart-f' : 'heart')}<span>${l.favorite ? 'Saved' : 'Favorite'}</span></button>
      <button id="vShare">${icon('share')}<span>Share</span></button>
      <button id="vEdit">${icon('edit')}<span>Edit</span></button>
      <button id="vInfo">${icon('info')}<span>Details</span></button>
      ${settings.byok && l.source === 'generated' ? `<button id="vUp">${icon('up')}<span>Upscale</span></button>` : ''}
      <button id="vDel" class="btn-danger">${icon('trash')}<span>Delete</span></button>
    </div></div>`, 'full');
  if (l.favorite) $('#vFav').style.color = 'var(--acc)';
  $('#cmpSeg').onclick = e => { const b = e.target.closest('button'); if (b && !b.disabled) openLook(id, list, b.dataset.v); };
  const w = $('#wipe');
  if (w) { const mv = e => { const r = w.getBoundingClientRect(); w.style.setProperty('--x', Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)) + '%'); }; w.addEventListener('pointerdown', e => { w.setPointerCapture(e.pointerId); mv(e); }); w.addEventListener('pointermove', e => { if (e.buttons) mv(e); }); }
  if (list && list.length > 1 && mode === 'single') swipeNav($('#vStage'), d => { const n = list[(idx + d + list.length) % list.length]; openLook(n.id, list); });
  $('#vFav').onclick = async () => { l.favorite = !l.favorite; await saveLook(l); openLook(id, list, mode); };
  $('#vShare').onclick = async () => { const r = await shareOrDownload(l.image, `${slug(lookTitle(l))}-${slug(m?.name)}-${l.view}.${(l.image.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg').replace('svg+xml', 'svg')}`, lookTitle(l)); if (r === 'downloaded') toast('Saved to downloads.'); };
  $('#vEdit').onclick = () => editLook(l, () => openLook(id, list));
  $('#vInfo').onclick = () => openSheet(`<div class="modal"><div class="row between"><h2 class="h">Mockup details</h2><button class="icon-btn btn-ghost" id="bk" aria-label="Back">${icon('x')}</button></div>
    <dl class="kv" style="margin:12px 0"><dt>Styles</dt><dd>${st.map(s => `<a href="#/style/${encodeURIComponent(s.id)}">${esc(s.sku)} ${esc(s.name)}</a>`).join('<br>') || '—'}</dd><dt>Model</dt><dd>${m ? `<a href="#/model/${encodeURIComponent(m.id)}">${esc(m.name)}</a> · ${esc(formatHeight(m.heightCm))}` : '—'}</dd><dt>Colorway</dt><dd>${esc(l.colorway || '—')}</dd><dt>View</dt><dd>${esc(VIEW_LABEL[l.view] || '—')}</dd><dt>Collection</dt><dd>${esc(lookCollections(l).join(', ') || '—')}</dd><dt>Tags</dt><dd>${esc((l.tags || []).join(', ') || '—')}</dd><dt>Source</dt><dd>${esc(l.source === 'generated' ? 'Generated in Avata (BYOK)' : l.source === 'sample' ? 'Sample (reference image)' : `Imported${l.fileName ? ` · ${l.fileName}` : ''}`)}</dd><dt>Added</dt><dd>${fmtDay(l.createdAt)}</dd>${l.notes ? `<dt>Notes</dt><dd>${esc(l.notes)}</dd>` : ''}</dl>
    ${l.prompt ? `<details><summary class="small muted">Prompt used</summary><pre class="prompt" style="margin-top:8px">${esc(l.prompt)}</pre></details>` : ''}</div>`) && ($('#bk').onclick = () => openLook(id, list, mode));
  if ($('#vUp')) $('#vUp').onclick = () => import('./studio.js').then(s => s.openUpscale(l));
  $('#vDel').onclick = async () => { if (!confirm('Delete this mockup?')) return; await deleteLook(l.id); closeSheet(); window.dispatchEvent(new HashChangeEvent('hashchange')); };
}
function swipeNav(el, go) {
  let x0 = null, y0 = 0;
  el.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  el.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1); });
}

export function editLook(l, done) {
  let ids = [...(l.styleIds || [])];
  openSheet(`<div class="modal"><div class="row between"><h2 class="h">Edit mockup</h2><button class="icon-btn btn-ghost" id="bk" aria-label="Close">${icon('x')}</button></div>
    <div class="stack" style="margin-top:12px">
      <img src="${urlFor(l.thumb || l.image)}" alt="" style="max-height:180px;margin:0 auto;border-radius:12px">
      <label class="field"><span>Model</span><select id="em"><option value="">— None —</option>${S.models.map(m => `<option value="${m.id}" ${m.id === l.modelId ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>
      <div class="field"><span>View</span><div class="seg" id="ev">${Object.entries(VIEW_LABEL).map(([k, lb]) => `<button type="button" data-v="${k}" aria-pressed="${l.view === k}">${lb === 'Front + back' ? 'Sheet' : lb}</button>`).join('')}</div></div>
      <div class="field"><span>Styles</span><div id="es"></div></div>
      <label class="field"><span>Colorway</span><input type="text" id="ec" value="${esc(l.colorway || '')}"></label>
      <label class="field"><span>Title (optional)</span><input type="text" id="eti" value="${esc(l.title || '')}"></label>
      <label class="field"><span>Tags (comma separated)</span><input type="text" id="et" value="${esc((l.tags || []).join(', '))}"></label>
      <label class="field"><span>Notes</span><textarea id="en">${esc(l.notes || '')}</textarea></label>
      <button class="btn btn-solid btn-block" id="esave">${icon('check', 'sm')} Save</button>
    </div></div>`);
  let view = l.view;
  mountStylePicker($('#es'), ids, x => { ids = x; });
  $('#ev').onclick = e => { const b = e.target.closest('button'); if (!b) return; view = b.dataset.v; $$('#ev button').forEach(x => x.setAttribute('aria-pressed', x === b)); };
  $('#bk').onclick = done;
  $('#esave').onclick = async () => { Object.assign(l, { modelId: $('#em').value || null, view, styleIds: ids, colorway: $('#ec').value.trim(), title: $('#eti').value.trim(), tags: $('#et').value.split(',').map(t => t.trim()).filter(Boolean), notes: $('#en').value.trim() }); await saveLook(l); toast('Mockup saved.'); done(); };
}

/* ---------------- Showcase (buyer mode) ---------------- */
export function openShowcase({ title, subtitle = '', looks }) {
  if (!looks.length) { toast('No looks to show yet.'); return; }
  const slide = l => {
    const st = (l.styleIds || []).map(styleById).filter(Boolean); const m = modelById(l.modelId);
    const sizes = [...new Set(st.flatMap(s => s.sizes || []))];
    return `<section class="slide"><div class="slide-img"><img src="${urlFor(l.image)}" alt="${esc(lookTitle(l))}" loading="lazy"></div>
      <div class="slide-cap">${st.length ? st.map(s => `<div class="sc-row"><span class="sc-name">${esc(s.name)}</span><span class="sc-sku">${esc(s.sku || '')}</span></div>`).join('') : `<div class="sc-row"><span class="sc-name">${esc(lookTitle(l))}</span></div>`}
      <div class="sc-meta">${[l.colorway, st[0]?.composition || st[0]?.fabric, sizes.length ? `Sizes ${sizes.join(' · ')}` : '', m ? `Model ${formatHeight(m.heightCm).split(' · ')[0]}${m.size ? `, wears ${m.size.split('/').pop().trim()}` : ''}` : ''].filter(Boolean).map(esc).join('<span class="dot">·</span>')}</div></div></section>`;
  };
  const d = openSheet(`<div class="show" id="show">
    <div class="show-top"><button class="icon-btn" data-close aria-label="Close showcase">${icon('x')}</button><span class="show-count" id="sc">1 / ${looks.length + 1}</span><span style="width:44px"></span></div>
    <div class="show-track" id="track">
      <section class="slide cover"><div><p class="eyebrow" style="justify-content:center;color:inherit;opacity:.7">Avata lookbook</p><h1 class="show-title">${esc(title)}</h1><p class="show-sub">${esc(subtitle)}</p><p class="show-hint">Swipe ${icon('back', 'xs')}</p></div></section>
      ${looks.map(slide).join('')}
    </div></div>`, 'full showcase');
  const tr = $('#track'); const n = looks.length + 1;
  tr.addEventListener('scroll', debounce(() => { $('#sc').textContent = `${Math.round(tr.scrollLeft / tr.clientWidth) + 1} / ${n}`; }, 40), { passive: true });
  tr.addEventListener('click', e => { if (e.target.closest('button')) return; $('#show').classList.toggle('bare'); });
  const key = e => { if (e.key === 'ArrowRight') tr.scrollBy({ left: tr.clientWidth, behavior: 'smooth' }); if (e.key === 'ArrowLeft') tr.scrollBy({ left: -tr.clientWidth, behavior: 'smooth' }); };
  addEventListener('keydown', key); d.addEventListener('close', () => removeEventListener('keydown', key), { once: true });
}
