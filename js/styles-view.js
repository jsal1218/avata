// Styles catalog: list, detail, editor.
import { $, $$, esc, icon, urlFor, chip, toast, setTop, debounce, fmtDay, shareOrDownload } from './ui.js';
import { S, CATEGORIES, STATUSES, STATUS_TONE, SIZES_ALPHA, SIZES_US, styleById, modelById, looksForStyle, collections, allTags, filterStyles, saveStyle, deleteStyle, newStyle } from './store.js';
import { lookCard, bindLooks, openShowcase } from './looks.js';
import { resizeBlob } from './imaging.js';
import { stylesCsv } from './backup.js';

const SF0 = { q: '', collection: '', category: '', status: '', tag: '', sort: 'updated' };
let SF = { ...SF0, ...JSON.parse(sessionStorage.getItem('avata.styleFilter') || '{}') };
const saveSF = () => sessionStorage.setItem('avata.styleFilter', JSON.stringify(SF));
export const statusPill = s => `<span class="pill status ${STATUS_TONE[s] || ''}">${esc(s || '—')}</span>`;
const money = v => (v === null || v === undefined || v === '' || isNaN(v)) ? '' : Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cover = s => s.photos?.[0] || looksForStyle(s.id)[0]?.thumb || null;

export function exportCsv() {
  const blob = new Blob([stylesCsv(S.styles, S.looks)], { type: 'text/csv;charset=utf-8' });
  return shareOrDownload(blob, `avata-styles-${new Date().toISOString().slice(0, 10)}.csv`, 'Avata styles');
}

export function renderStyles(v) {
  setTop('Catalog', `<a class="btn btn-solid" href="#/style-edit/new" style="min-height:38px">${icon('plus', 'sm')} New style</a>`);
  const sel = (id, label, opts, val) => `<select id="${id}" class="mini" aria-label="${label}"><option value="">${label}: all</option>${opts.map(o => `<option value="${esc(o)}" ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  const counts = Object.fromEntries(STATUSES.map(s => [s, S.styles.filter(x => x.status === s).length]));
  v.innerHTML = `<h1 class="display fade-in">Styles <em>catalog</em></h1><p class="lede">${S.styles.length} style${S.styles.length === 1 ? '' : 's'} · SKUs, fabrics, colorways, sizes and factory status.</p>
  <div class="statusbar">${STATUSES.map(s => `<button type="button" class="st ${STATUS_TONE[s]}" data-s="${s}" aria-pressed="${SF.status === s}"><b>${counts[s]}</b><span>${s}</span></button>`).join('')}</div>
  <div class="searchbar"><svg class="i sm" aria-hidden="true"><use href="#i-search"/></svg><input type="search" id="sq" placeholder="Search SKU, name, fabric, colour, supplier" value="${esc(SF.q)}" enterkeyhint="search"></div>
  <div class="filters">${sel('sC', 'Collection', collections(), SF.collection)}${sel('sK', 'Category', CATEGORIES, SF.category)}${sel('sT', 'Tag', allTags(), SF.tag)}
    <select id="sSort" class="mini" aria-label="Sort">${[['updated', 'Recently updated'], ['sku', 'SKU'], ['name', 'Name'], ['status', 'Status'], ['collection', 'Collection']].map(([k, l]) => `<option value="${k}" ${SF.sort === k ? 'selected' : ''}>Sort: ${l}</option>`).join('')}</select></div>
  <div id="sres"></div>
  <button class="btn btn-line btn-block" id="csv" style="margin-top:16px">${icon('down', 'sm')} Export catalog CSV</button>`;
  const draw = () => {
    const list = filterStyles(SF);
    $('#sres').innerHTML = list.length ? `<div class="srows">${list.map(s => { const c = cover(s); const n = looksForStyle(s.id).length; return `<a class="srow fade-in" href="#/style/${encodeURIComponent(s.id)}"><span class="sthumb">${c ? `<img src="${urlFor(c)}" alt="" loading="lazy">` : icon('hanger')}</span><span class="sbody"><span class="ssku">${esc(s.sku || 'No SKU')}${s.sample ? ' <span class="pill tiny-pill">Sample</span>' : ''}</span><b>${esc(s.name || 'Untitled style')}</b><span class="smeta">${esc([s.collection, s.category].filter(Boolean).join(' · '))}${n ? ` · ${n} look${n > 1 ? 's' : ''}` : ''}</span></span>${statusPill(s.status)}</a>`; }).join('')}</div>`
      : `<div class="empty"><div class="art">${icon('hanger')}</div><p class="display">${S.styles.length ? 'No matches' : 'No styles yet'}</p><p>${S.styles.length ? 'Clear a filter or search.' : 'Add your first style with its SKU, fabric and photos.'}</p><a class="btn btn-solid" href="#/style-edit/new">${icon('plus', 'sm')} New style</a></div>`;
  };
  draw();
  $('#sq').oninput = debounce(e => { SF.q = e.target.value; saveSF(); draw(); }, 150);
  const bindSel = (id, k) => $('#' + id).onchange = e => { SF[k] = e.target.value; saveSF(); draw(); };
  bindSel('sC', 'collection'); bindSel('sK', 'category'); bindSel('sT', 'tag'); bindSel('sSort', 'sort');
  $$('.statusbar .st').forEach(b => b.onclick = () => { SF.status = SF.status === b.dataset.s ? '' : b.dataset.s; saveSF(); $$('.statusbar .st').forEach(x => x.setAttribute('aria-pressed', x.dataset.s === SF.status)); draw(); });
  $('#csv').onclick = async () => { const r = await exportCsv(); if (r === 'downloaded') toast('CSV saved to downloads.'); };
}

export function renderStyleDetail(v, id) {
  const s = styleById(id);
  if (!s) { v.innerHTML = `<div class="empty"><p class="display">Style not found</p><a class="btn" href="#/styles">Back to catalog</a></div>`; return; }
  setTop('Style', `<a class="btn btn-ghost" href="#/styles" style="min-height:38px">${icon('back', 'sm')} Catalog</a>`);
  const looks = looksForStyle(s.id);
  const byModel = {}; for (const l of looks) (byModel[l.modelId || '_'] ||= []).push(l);
  const margin = s.cost && s.price ? Math.round((1 - s.cost / s.price) * 100) : null;
  const row = (k, val) => val ? `<dt>${k}</dt><dd>${val}</dd>` : '';
  v.innerHTML = `${s.sample ? '<div class="note" style="margin:8px 0">' + icon('info', 'sm') + '<span><b>Sample style</b> — illustrative placeholder, not real factory data. Edit it or remove all samples in Settings → Data.</span></div>' : ''}
  <p class="ssku" style="margin:14px 0 0">${esc(s.sku || 'No SKU')}</p>
  <h1 class="display" style="margin-top:2px">${esc(s.name || 'Untitled style')}</h1>
  <div class="row" style="margin-bottom:14px">${statusPill(s.status)}<select id="qStatus" class="mini" aria-label="Change status">${STATUSES.map(x => `<option ${x === s.status ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
  ${(s.photos || []).length ? `<div class="photos">${s.photos.map(p => `<img src="${urlFor(p)}" alt="Garment photo">`).join('')}</div>` : ''}
  <div class="actions-grid">
    <button class="btn btn-solid" id="dShow" ${looks.length ? '' : 'disabled'}>${icon('play', 'sm')} Showcase</button>
    <a class="btn btn-line" href="#/import-looks?style=${encodeURIComponent(s.id)}">${icon('plus', 'sm')} Add mockups</a>
    <a class="btn btn-line" href="#/studio?style=${encodeURIComponent(s.id)}">${icon('copy', 'sm')} Build prompt</a>
    <a class="btn btn-line" href="#/style-edit/${encodeURIComponent(s.id)}">${icon('edit', 'sm')} Edit</a>
  </div>
  <section class="section"><dl class="kv big">
    ${row('Collection', esc([s.collection, s.season].filter(Boolean).join(' · ')))}${row('Category', esc(s.category))}${row('Fabric', esc(s.fabric))}${row('Composition', esc(s.composition))}
    ${row('Colorways', (s.colorways || []).map(c => `<span class="pill">${esc(c)}</span>`).join(' '))}${row('Sizes', (s.sizes || []).map(c => `<span class="pill">${esc(c)}</span>`).join(' '))}
    ${row('Supplier / line', esc(s.supplier))}${row('Cost', money(s.cost))}${row('Price', money(s.price) + (margin !== null ? ` <span class="muted small">· ${margin}% margin</span>` : ''))}
    ${row('Tags', (s.tags || []).map(t => `<span class="pill">#${esc(t)}</span>`).join(' '))}${row('Notes', esc(s.notes).replace(/\n/g, '<br>'))}
    <dt>Updated</dt><dd>${s.updatedAt ? fmtDay(s.updatedAt) : '—'}</dd></dl></section>
  <div class="row between" style="margin:22px 0 10px"><p class="eyebrow" style="margin:0">Mockups · ${looks.length}</p></div>
  ${looks.length ? Object.entries(byModel).map(([mid, ls]) => { const m = modelById(mid); return `<p class="small" style="margin:12px 0 8px"><b>${esc(m?.name || 'No model')}</b>${m ? ` <span class="muted">· ${esc((m.heightCm ? `${Math.floor(m.heightCm / 30.48)}′${Math.round((m.heightCm / 2.54) % 12)}″` : ''))}${m.size ? ` · ${esc(m.size)}` : ''}</span>` : ''}</p><div class="masonry" data-m="${esc(mid)}">${ls.map(lookCard).join('')}</div>`; }).join('')
    : `<div class="empty" style="padding:20px"><p>No mockups linked yet.</p><a class="btn btn-solid" href="#/import-looks?style=${encodeURIComponent(s.id)}">${icon('plus', 'sm')} Add mockups</a></div>`}
  <button class="btn btn-line btn-danger btn-block" id="dDel" style="margin-top:22px">${icon('trash', 'sm')} Delete style</button>`;
  $$('.masonry[data-m]').forEach(g => bindLooks(g, looks));
  $('#qStatus').onchange = async e => { s.status = e.target.value; await saveStyle(s); toast(`Status → ${s.status}`); renderStyleDetail(v, id); };
  $('#dShow').onclick = () => openShowcase({ title: s.name, subtitle: [s.collection, s.sku].filter(Boolean).join(' · '), looks });
  $('#dDel').onclick = async () => { if (!confirm(`Delete ${s.sku || s.name}? Mockups stay in the lookbook (unlinked).`)) return; await deleteStyle(s.id); location.hash = '#/styles'; };
}

export function renderStyleEdit(v, id) {
  const isNew = id === 'new';
  const s = isNew ? newStyle() : JSON.parse(JSON.stringify({ ...styleById(id), photos: [] }));
  if (!isNew && !styleById(id)) { v.innerHTML = '<div class="empty"><p class="display">Style not found</p></div>'; return; }
  let photos = isNew ? [] : [...(styleById(id).photos || [])];
  setTop(isNew ? 'New style' : 'Edit style', `<a class="btn btn-ghost" href="${isNew ? '#/styles' : `#/style/${encodeURIComponent(id)}`}" style="min-height:38px">${icon('x', 'sm')} Cancel</a>`);
  const sizeChips = arr => arr.map(z => chip('size', z, z, s.sizes.includes(z))).join('');
  v.innerHTML = `<h1 class="display">${isNew ? 'New <em>style</em>' : esc(s.name || 'Edit style')}</h1>
  <form id="sf" class="stack" autocomplete="off">
  <section class="section stack"><p class="eyebrow">Identity</p>
    <div class="grid2"><label class="field"><span>SKU / style no.</span><input type="text" name="sku" value="${esc(s.sku)}" placeholder="e.g. AV-2401" autocapitalize="characters"></label>
    <label class="field"><span>Category</span><select name="category">${CATEGORIES.map(c => `<option ${c === s.category ? 'selected' : ''}>${c}</option>`).join('')}</select></label></div>
    <label class="field"><span>Name</span><input type="text" name="name" value="${esc(s.name)}" placeholder="e.g. Bias-cut satin slip dress" required></label>
    <div class="grid2"><label class="field"><span>Collection</span><input type="text" name="collection" value="${esc(s.collection)}" list="collList" placeholder="e.g. Resort 27"><datalist id="collList">${collections().map(c => `<option value="${esc(c)}">`).join('')}</datalist></label>
    <label class="field"><span>Season</span><input type="text" name="season" value="${esc(s.season)}" placeholder="e.g. SS27"></label></div>
    <div class="field"><span>Factory status</span><div class="chips">${STATUSES.map(x => chip('status', x, x, x === s.status)).join('')}</div></div>
  </section>
  <section class="section stack"><p class="eyebrow">Material</p>
    <label class="field"><span>Fabric</span><input type="text" name="fabric" value="${esc(s.fabric)}" placeholder="e.g. 19mm silk charmeuse"></label>
    <label class="field"><span>Composition</span><input type="text" name="composition" value="${esc(s.composition)}" placeholder="e.g. 100% silk"></label>
    <label class="field"><span>Colorways (comma separated)</span><input type="text" name="colorways" value="${esc(s.colorways.join(', '))}" placeholder="e.g. Ivory, Espresso, Black"></label>
    <div class="field"><span>Sizes</span><div class="chips">${sizeChips(SIZES_ALPHA)}</div><div class="chips" style="margin-top:8px">${sizeChips(SIZES_US.map(z => 'US ' + z))}</div></div>
  </section>
  <section class="section stack"><p class="eyebrow">Photos · flat lays &amp; tech sketches</p>
    <div class="tiles" id="ph"></div><input type="file" id="phf" accept="image/*" multiple hidden>
  </section>
  <section class="section stack"><p class="eyebrow">Back office</p>
    <label class="field"><span>Supplier / line notes</span><input type="text" name="supplier" value="${esc(s.supplier)}" placeholder="e.g. Line 3 · trims from …"></label>
    <div class="grid2"><label class="field"><span>Cost</span><input type="number" inputmode="decimal" step="0.01" min="0" name="cost" value="${s.cost ?? ''}" placeholder="0.00"></label>
    <label class="field"><span>Price</span><input type="number" inputmode="decimal" step="0.01" min="0" name="price" value="${s.price ?? ''}" placeholder="0.00"></label></div>
    <label class="field"><span>Tags (comma separated)</span><input type="text" name="tags" value="${esc(s.tags.join(', '))}" placeholder="e.g. hero, buyer-pick"></label>
    <label class="field"><span>Notes</span><textarea name="notes" placeholder="Fit notes, trims, approvals…">${esc(s.notes)}</textarea></label>
    <p class="tiny muted" style="margin:0">Status, supplier, cost, price and notes never appear in Showcase.</p>
  </section>
  <button class="btn btn-solid btn-lg btn-block" type="submit">${icon('check')} ${isNew ? 'Create style' : 'Save style'}</button>
  </form>`;
  const drawPh = () => {
    $('#ph').innerHTML = photos.map((p, i) => `<div class="tile"><img src="${urlFor(p)}" alt=""><button type="button" class="x" data-i="${i}" aria-label="Remove photo">${icon('x', 'xs')}</button></div>`).join('') + `<button type="button" class="tile add" id="phAdd">${icon('image')}<span>Add photos</span></button>`;
    $('#phAdd').onclick = () => $('#phf').click();
    $$('#ph .x').forEach(b => b.onclick = () => { photos.splice(+b.dataset.i, 1); drawPh(); });
  };
  drawPh();
  $('#phf').onchange = async e => { for (const f of e.target.files) { try { photos.push(await resizeBlob(f, 1800, 'image/webp', 0.88)); } catch { toast(`Couldn't read ${f.name}`); } } e.target.value = ''; drawPh(); };
  v.addEventListener('click', e => {
    const c = e.target.closest('.chip[data-g]'); if (!c) return;
    if (c.dataset.g === 'status') { s.status = c.dataset.v; $$('.chip[data-g=status]').forEach(x => x.setAttribute('aria-pressed', x === c)); }
    if (c.dataset.g === 'size') { const z = c.dataset.v; const i = s.sizes.indexOf(z); i < 0 ? s.sizes.push(z) : s.sizes.splice(i, 1); c.setAttribute('aria-pressed', i < 0); }
  });
  $('#sf').onsubmit = async e => {
    e.preventDefault(); const f = new FormData(e.target);
    const list = k => String(f.get(k) || '').split(',').map(x => x.trim()).filter(Boolean);
    const num = k => { const x = f.get(k); return x === '' || x === null ? null : Number(x); };
    const base = isNew ? s : styleById(id);
    const order = [...SIZES_ALPHA, ...SIZES_US.map(z => 'US ' + z)];
    Object.assign(base, { sku: String(f.get('sku')).trim(), name: String(f.get('name')).trim(), category: f.get('category'), collection: String(f.get('collection')).trim(), season: String(f.get('season')).trim(), status: s.status, fabric: String(f.get('fabric')).trim(), composition: String(f.get('composition')).trim(), colorways: list('colorways'), sizes: s.sizes.sort((a, b) => order.indexOf(a) - order.indexOf(b)), supplier: String(f.get('supplier')).trim(), cost: num('cost'), price: num('price'), tags: list('tags'), notes: String(f.get('notes')).trim(), photos });
    if (!base.name && !base.sku) { toast('Add at least a name or SKU.'); return; }
    if (base.sku && S.styles.some(x => x.id !== base.id && x.sku && x.sku.toLowerCase() === base.sku.toLowerCase())) { if (!confirm(`Another style already uses SKU ${base.sku}. Save anyway?`)) return; }
    await saveStyle(base); toast(isNew ? 'Style created.' : 'Style saved.');
    location.hash = `#/style/${encodeURIComponent(base.id)}`;
  };
}
