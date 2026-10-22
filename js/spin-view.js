// 360 tab: model switcher (your spins + gallery models), one-tap "New 360" from photos or a video,
// the spin viewer, and a small editor (drag to reorder, reverse, rename, delete). All on-device.
import { holdWork, $, $$, esc, icon, toast, setTop, openSheet, closeSheet, urlFor } from './ui.js';
import { db, uid } from './db.js';
import { mountViewer } from './spin-viewer.js';
import { buildSpin, makeSpinThumb } from './spin-build.js';

const GALLERY = '../model-gallery/data/manifest.json';
let galleryCache = null, galleryAliases = {};
let onResizeFade = null; addEventListener('resize', () => onResizeFade?.(), { passive: true }); // one listener for every render
async function galleryModels() {
  if (galleryCache) return galleryCache;
  try {
    const url = new URL(GALLERY, location.href), base = new URL('../', url); const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) throw 0; const m = await r.json();
    galleryAliases = Object.fromEntries(Object.entries(m.aliases || {}).filter(([k]) => !k.startsWith('_')).map(([k, x]) => [`gallery:${k}`, `gallery:${x}`])); // retired #model-N ids
    const frames = o => [...o.frames].sort((a, b) => a.angle - b.angle).map(f => ({ angle: f.angle, lo: new URL(f.lo, base).href, hi: new URL(f.hi, base).href }));
    // every outfit is kept (Model 2 has six); frames = the first (base) outfit's frames
    galleryCache = m.models.map(md => { const outfits = md.outfits.map(o => { const fr = frames(o); return { id: o.id, name: o.name, title: `${o.name} · ${o.subtitle || ''}`, swatch: (fr.find(f => f.angle === 0) || fr[0]).lo, frames: fr }; });
      return { id: `gallery:${md.id}`, gallery: true, group: md.group || 'exact', name: md.name, sub: md.descriptor || '', thumbUrl: new URL(md.thumb, base).href, outfits, frames: outfits[0].frames }; });
  } catch { galleryCache = []; }
  return galleryCache;
}
const listSpins = async () => (await db.all('spins').catch(() => [])).sort((a, b) => b.createdAt - a.createdAt);
const defaultName = () => `360 · ${new Date().toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;

export async function renderSpin(v, id) {
  setTop('360 spin');
  v.classList.add('spin-page');
  v.innerHTML = `<div class="sp-switch" id="spSwitch" role="tablist" aria-label="360 models"></div>
    <div id="spView"></div>
    <div class="sp-of" id="spOf" hidden><button type="button" class="sp-of-btn" id="spOfBtn" aria-expanded="false" aria-controls="spOfGrid">${icon('hanger')}<b>Outfits</b><em id="spOfCur"></em><svg class="i chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      <div class="sp-of-grid" id="spOfGrid" role="listbox" aria-label="Outfits" hidden></div></div>
    <div id="spEmpty" hidden></div>
    <details class="section sp-edit" id="spEdit" hidden><summary><span class="eyebrow" style="margin:0" id="spEditT">Edit</span></summary><div id="spEditBody"></div></details>
    <input type="file" id="spFile" accept="image/*,video/*" multiple hidden>`;
  const st = { spins: await listSpins(), gallery: [], cur: null };
  const viewer = mountViewer($('#spView', v));
  const items = () => [...st.spins.map(s => ({ ...s, thumbUrl: urlFor(s.thumb) })), ...st.gallery];

  // one row: New 360, your spins, the gallery models (the Generated row was removed 2026-10-21)
  function drawSwitch() {
    const chip = m => `<button type="button" class="sp-item" role="tab" data-id="${esc(m.id)}" aria-selected="${st.cur?.id === m.id}"${m.gallery ? ` title="${esc(m.name)}"` : ''}><img src="${esc(m.thumbUrl)}" alt=""><b>${esc(m.name)}</b>${m.gallery ? '' : `<small>${m.frames.length} photos</small>`}</button>`;   // gallery models: name only, no description (2026-10-21)
    const all = items();
    $('#spSwitch', v).innerHTML = `<button type="button" class="sp-new" id="spNew" aria-label="New 360 from photos or video"><span class="sp-plus">${icon('plus')}</span><b>New 360</b></button>` + all.map(chip).join('');
    $('#spNew', v).onclick = () => $('#spFile', v).click();
    $$('.sp-item', v).forEach(b => b.onclick = () => select(b.dataset.id));
    edgeFade();
  }
  // edge fades on the scrolling switcher (6 gallery models + your spins rarely fit a phone width)
  function edgeFade() {
    const sw = $('#spSwitch', v); if (!sw) return;
    sw.classList.toggle('fade-l', sw.scrollLeft > 4); sw.classList.toggle('fade-r', sw.scrollLeft + sw.clientWidth < sw.scrollWidth - 4);
  }
  $('#spSwitch', v).addEventListener('scroll', edgeFade, { passive: true });
  onResizeFade = edgeFade;
  function drawEmpty() {
    const none = !items().length;
    $('#spEmpty', v).hidden = !none; $('#spView', v).hidden = none;
    if (none) $('#spEmpty', v).innerHTML = `<div class="empty"><div class="art">${icon('spin')}</div><p class="display">Make a 360</p><p>Pick photos of your model from all sides — or one slow turnaround video. Avata lines them up and builds the spin on this phone.</p><button class="btn btn-solid btn-lg" id="spNew2">${icon('plus', 'sm')} New 360</button></div>${tipsHtml()}`;
    $('#spNew2', v)?.addEventListener('click', () => $('#spFile', v).click());
  }
  async function select(id, { auto = false } = {}) {
    id = galleryAliases[id] || id;                                   // old #/spin/gallery:model-N links → renumbered model
    const m = items().find(x => x.id === id) || (String(id).startsWith('gallery:') && st.gallery[0]) || items()[0]; // gone (old Model 5) → Model 1
    st.cur = m || null; drawSwitch(); drawEmpty(); drawEdit();
    if (!m) return;
    history.replaceState(null, '', `#/spin/${encodeURIComponent(m.id)}`);
    const chip = $$('.sp-item', v).find(b => b.dataset.id === m.id), sw = chip?.parentElement || $('#spSwitch', v);
    if (chip && (chip.offsetLeft < sw.scrollLeft || chip.offsetLeft + chip.offsetWidth > sw.scrollLeft + sw.clientWidth)) sw.scrollTo({ left: chip.offsetLeft - 16, behavior: 'smooth' });
    // "Outfits" dropdown under the viewer for every gallery model (Base first; opening a model always shows Base): a grid of
    // cards the size of the model cards above, each with that outfit's front (0°) frame and only its name. Cards are built
    // when it opens (lazy images); picking one collapses it and swaps that outfit into the 360 view, keeping the angle.
    const outfits = m.outfits || []; st.outfit = outfits[0]?.id || null;
    drawOutfits(m, outfits);
    await viewer.load(m.frames, { name: m.name, bg: m.bg || '#fff', auto });
  }

  function drawOutfits(m, outfits) {
    const box = $('#spOf', v), grid = $('#spOfGrid', v), btn = $('#spOfBtn', v);
    box.hidden = !m.gallery || !outfits.length; grid.hidden = true; grid.innerHTML = ''; btn.setAttribute('aria-expanded', 'false');
    const cur = () => outfits.find(o => o.id === st.outfit) || outfits[0];
    const label = () => { $('#spOfCur', v).textContent = `${outfits.length} · ${cur()?.name || ''}`; };
    label();
    btn.onclick = () => {
      const open = grid.hidden;
      if (open && !grid.children.length) {
        grid.innerHTML = outfits.map(o => `<button type="button" class="sp-oc" role="option" data-id="${esc(o.id)}" aria-selected="${o.id === st.outfit}" title="${esc(o.name)}"><img loading="lazy" decoding="async" src="${esc(o.swatch)}" alt=""><b>${esc(o.name)}</b></button>`).join('');
        grid.querySelectorAll('.sp-oc').forEach(b => b.onclick = async () => {
          grid.hidden = true; btn.setAttribute('aria-expanded', 'false');
          const vr = $('#spView', v).getBoundingClientRect(); if (vr.top < 0) scrollBy({ top: vr.top - 12, behavior: 'smooth' });
          const o = outfits.find(x => x.id === b.dataset.id); if (!o || st.cur !== m || o.id === st.outfit) return;
          st.outfit = o.id; grid.querySelectorAll('.sp-oc').forEach(x => x.setAttribute('aria-selected', x === b)); label();
          await viewer.swap(o.frames);
        });
      }
      grid.hidden = !open; btn.setAttribute('aria-expanded', String(open));
    };
  }

  /* ---------- create ---------- */
  $('#spFile', v).onchange = async e => {
    const files = [...e.target.files]; e.target.value = '';
    if (!files.length) return;
    $('#spEmpty', v).hidden = true; $('#spView', v).hidden = false;
    const label = { video: 'Reading video', detect: 'Finding the model', align: 'Lining up frames' };
    viewer.busy(true, 'Starting…', 0);
    const done = holdWork('spin-build');
    try {
      const r = await buildSpin(files, p => viewer.busy(true, p.phase === 'done' ? 'Saving…' : `${label[p.phase]} · ${p.done + 1} / ${p.total}`, p.phase === 'video' ? p.done / p.total * 0.3 : p.phase === 'detect' ? 0.3 + p.done / p.total * 0.2 : 0.5 + p.done / p.total * 0.5));
      const spin = { id: uid(), name: defaultName(), createdAt: Date.now(), updatedAt: Date.now(), source: r.kind, frames: r.frames, thumb: r.thumb, bg: r.bg, canvas: r.canvas };
      await db.put('spins', spin);
      st.spins.unshift(spin);
      viewer.busy(false);
      await select(spin.id, { auto: true });
      scrollTo({ top: 0, behavior: 'smooth' });
      const misses = r.detection.filter(m => m === 'none').length;
      toast(`360 saved · ${r.frames.length} ${r.kind === 'video' ? 'video frames' : 'photos'}${r.kind === 'photos' ? ` in ${r.by === 'name' ? 'filename' : 'picked'} order` : ''}${misses ? ` · ${misses} not auto-aligned` : ''}. Drag to spin.`, { ms: 5000 });
      if (r.ignored && r.kind === 'video') toast('Used the video; the other picked files were skipped.');
    } catch (err) { console.error(err); viewer.busy(false); toast(err.message || 'Could not build the 360.'); drawEmpty(); }
    finally { done(); }
  };

  /* ---------- edit: reorder / reverse / rename / delete ---------- */
  function drawEdit() {
    const m = st.cur, box = $('#spEdit', v);
    box.hidden = !m; if (!m) return;
    $('#spEditT', v).textContent = m.gallery ? 'About this model' : `Edit · ${m.frames.length} frames`;
    if (m.gallery) { $('#spEditBody', v).innerHTML = `<p class="small muted" style="margin:0 0 10px">${esc(m.sub)} — built-in gallery model (${m.frames.length} angles), shown read-only. Tap <b>New 360</b> to make your own from photos.</p>${tipsHtml()}`; return; }
    $('#spEditBody', v).innerHTML = `<p class="tiny muted" style="margin:0 0 8px">Drag a frame to reorder. Frame 1 is the starting view.</p>
      <div class="sp-frames" id="spFrames">${m.frames.map((f, i) => `<div class="sp-fr" data-i="${i}"><img src="${urlFor(f.lo)}" alt="Frame ${i + 1}" draggable="false"><span>${i + 1}</span></div>`).join('')}</div>
      <div class="row" style="margin:12px 0"><button class="btn btn-line" id="spRev">${icon('swap', 'sm')} Reverse</button><button class="btn btn-line" id="spRen">${icon('edit', 'sm')} Rename</button><button class="btn btn-line btn-danger" id="spDel">${icon('trash', 'sm')} Delete</button></div>${tipsHtml()}`;
    bindReorder($('#spFrames', v), order => applyOrder(order));
    $('#spRev', v).onclick = () => applyOrder([0, ...m.frames.map((_, i) => i).slice(1).reverse()]);
    $('#spRen', v).onclick = rename; $('#spDel', v).onclick = remove;
  }
  async function saveCur() { const m = st.spins.find(s => s.id === st.cur.id); m.updatedAt = Date.now(); await db.put('spins', m); return m; }
  async function applyOrder(order) {
    const m = st.spins.find(s => s.id === st.cur.id); if (order.every((x, i) => x === i)) return;
    m.frames = order.map(i => m.frames[i]);
    if (order[0] !== 0) m.thumb = await makeSpinThumb(m.frames[0].lo);
    await saveCur(); await select(m.id); $('#spEdit', v).open = true; toast('Order saved.');
  }
  function rename() {
    const m = st.spins.find(s => s.id === st.cur.id);
    const d = openSheet(`<div class="modal"><h2 class="h">Rename 360</h2><form id="rnF" style="margin-top:12px"><label class="field"><span>Name</span><input type="text" id="rnI" value="${esc(m.name)}" maxlength="60" autocomplete="off"></label>
      <div class="grid2" style="margin-top:14px"><button type="button" class="btn btn-line" data-close>Cancel</button><button class="btn btn-solid" type="submit">${icon('check', 'sm')} Save</button></div></form></div>`, 'half');
    const inp = $('#rnI', d); setTimeout(() => { inp.focus(); inp.select(); }, 60);
    $('#rnF', d).onsubmit = async e => { e.preventDefault(); m.name = inp.value.trim() || m.name; await saveCur(); closeSheet(); await select(m.id); toast('Renamed.'); };
  }
  async function remove() {
    const m = st.cur;
    if (!confirm(`Delete “${m.name}”? Its ${m.frames.length} aligned frames will be removed from this device.`)) return;
    await db.del('spins', m.id); st.spins = st.spins.filter(s => s.id !== m.id);
    st.cur = null; await select(items()[0]?.id); toast('360 deleted.');
  }

  drawSwitch(); drawEmpty();
  if (st.spins.length && !String(id).startsWith('gallery:')) await select(st.spins.some(s => s.id === id) ? id : st.spins[0].id);
  st.gallery = await galleryModels();
  if (!st.cur) await select(id); else { drawSwitch(); drawEmpty(); }
}

/** Pointer-based drag-to-reorder (works with touch on iOS, where HTML5 drag & drop doesn't). */
function bindReorder(grid, onDone) {
  let d = null;
  grid.addEventListener('pointerdown', e => {
    const el = e.target.closest('.sp-fr'); if (!el) return;
    e.preventDefault(); el.setPointerCapture(e.pointerId);
    const r = el.getBoundingClientRect(); d = { el, id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: e.clientX - r.left, oy: e.clientY - r.top, moved: false };
  });
  grid.addEventListener('pointermove', e => {
    if (!d || e.pointerId !== d.id) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 6) return;
    d.moved = true; d.el.classList.add('lift');
    const over = [...grid.children].find(c => { if (c === d.el) return false; const r = c.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; });
    if (over) { const kids = [...grid.children]; grid.insertBefore(d.el, kids.indexOf(over) > kids.indexOf(d.el) ? over.nextSibling : over); }
    d.el.style.transform = 'none'; const r = d.el.getBoundingClientRect();
    d.el.style.transform = `translate(${e.clientX - d.ox - r.left}px,${e.clientY - d.oy - r.top}px) scale(1.06)`;
  });
  const up = e => {
    if (!d || e.pointerId !== d.id) return;
    d.el.classList.remove('lift'); d.el.style.transform = '';
    const moved = d.moved; d = null;
    if (moved) onDone([...grid.children].map(c => +c.dataset.i));
  };
  grid.addEventListener('pointerup', up); grid.addEventListener('pointercancel', up);
}

export function tipsHtml() {
  return `<div class="note" style="margin-top:6px">${icon('info', 'sm')}<span><b>Best results:</b> plain, even background · same distance and camera height for every shot · whole body in frame, feet visible · 8+ photos going around in one direction (front first), or one slow, steady 360° turnaround video (5–10 s). Photos are used exactly as taken — nothing is generated.</span></div>`;
}
