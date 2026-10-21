// Model library: list, detail/profile, sheet import.
import { $, $$, esc, icon, urlFor, toast, setTop, debounce, shareOrDownload } from './ui.js';
import { S, modelById, looksForModel, saveModel, deleteModel, uid } from './store.js';
import { formatHeight, cmToFtIn, ftInToCm, measurementsText } from './prompt.js';
import { analyseSheet, analyseWithSplit, cropHalf, resizeBlob, makeThumb } from './imaging.js';
import { lookCard, bindLooks, openShowcase } from './looks.js';

/** Share the model's reference images (front, back) so the assistant can use them — free. */
export async function shareRefs(m, extra = []) {
  const files = [];
  if (m.front) files.push(new File([m.front], `1-${m.name.replace(/\W+/g, '-')}-front.${m.front.type.includes('webp') ? 'webp' : 'jpg'}`, { type: m.front.type }));
  if (m.back) files.push(new File([m.back], `2-${m.name.replace(/\W+/g, '-')}-back.${m.back.type.includes('webp') ? 'webp' : 'jpg'}`, { type: m.back.type }));
  extra.forEach((b, i) => files.push(new File([b], `${files.length + 1}-garment-${i + 1}.${(b.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg').replace('svg+xml', 'svg')}`, { type: b.type })));
  if (navigator.canShare?.({ files })) { try { await navigator.share({ files, title: `${m.name} references` }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  for (const f of files) { const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; document.body.append(a); a.click(); a.remove(); }
  toast(`${files.length} reference file${files.length > 1 ? 's' : ''} downloaded.`);
}

function specPills(m) {
  return `<div class="specs">${m.heightCm ? `<span class="pill acc">${icon('ruler', 'xs')}${esc(formatHeight(m.heightCm))}</span>` : '<span class="pill warn">Set height</span>'}${m.size ? `<span class="pill">US ${esc(m.size)}</span>` : ''}${m.bodyType ? `<span class="pill">${esc(m.bodyType)}</span>` : ''}</div>`;
}
export function renderModels(v) {
  setTop('Model Library', `<a class="btn btn-solid" href="#/import-model" style="min-height:38px">${icon('plus', 'sm')} Import</a>`);
  v.innerHTML = `<h1 class="display fade-in">Your <em>models</em></h1><p class="lede">Reference sheets live only on this device. Front and back references, height and measurements — used to link mockups and to build prompts for your assistant.</p>
  ${S.models.length ? `<div class="lib">${S.models.map(m => `<a class="lib-card fade-in" href="#/model/${encodeURIComponent(m.id)}"><div class="ph"><img src="${urlFor(m.front)}" alt="${esc(m.name)} front" loading="lazy">${m.back ? `<img src="${urlFor(m.back)}" alt="${esc(m.name)} back" loading="lazy">` : ''}</div><div class="meta"><div class="nm">${esc(m.name)}</div>${specPills(m)}<div class="tiny muted" style="margin-top:6px">${m.outfits?.length > 1 ? `${m.outfits.length} outfits · ` : ''}${looksForModel(m.id).length} looks${m.measurements && measurementsText(m.measurements, m.measureUnit) ? ` · measurements${m.measurementsEstimated ? ' (est.)' : ''}` : ''}</div></div></a>`).join('')}</div>`
    : `<div class="empty"><div class="art">${icon('models')}</div><p class="display">No models yet</p><p>Import a front + back reference sheet to start.</p><a class="btn btn-solid" href="#/import-model">${icon('plus', 'sm')} Import sheet</a></div>`}
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

export function renderModelDetail(id) {
  const v = $('#view');
  const m = modelById(id);
  if (!m) { v.innerHTML = `<div class="empty"><p class="display">Model not found</p><a class="btn" href="#/models">Back to models</a></div>`; return; }
  setTop('Model', `<a class="btn btn-ghost" href="#/models" style="min-height:38px">${icon('back', 'sm')} Models</a>`);
  const n = looksForModel(m.id);
  const outfits = m.outfits?.length > 1 ? m.outfits : null; // built-in outfits of this model (e.g. Model 2): small chips swap the references shown
  v.innerHTML = `<h1 class="display fade-in">${esc(m.name)}</h1>${specPills(m)}
  ${outfits ? `<div class="oc-row" id="mOutfits" role="radiogroup" aria-label="Outfits">${outfits.map((o, i) => `<button type="button" class="oc" role="radio" data-i="${i}" aria-checked="${i === 0}" title="${esc(o.subtitle || o.name)}"><i style="background-image:url('${urlFor(o.front)}')"></i><span>${esc(o.name)}</span></button>`).join('')}</div>` : ''}
  <div class="hero-pair" style="margin-top:14px"><figure><img id="mFront" src="${urlFor(m.front)}" alt="Front reference"><figcaption>Front</figcaption></figure>${m.back ? `<figure><img id="mBack" src="${urlFor(m.back)}" alt="Back reference"><figcaption>Back</figcaption></figure>` : '<figure style="display:grid;place-items:center;color:#888">No back view</figure>'}</div>
  <div class="actions-grid" style="margin:14px 0"><button class="btn btn-solid" id="showM" ${n.length ? '' : 'disabled'}>${icon('play', 'sm')} Showcase</button><a class="btn btn-line" href="#/import-looks?model=${encodeURIComponent(m.id)}">${icon('plus', 'sm')} Add mockups</a><button class="btn btn-line" id="useM">${icon('copy', 'sm')} Build prompt</button><button class="btn btn-line" id="shareRefs">${icon('share', 'sm')} Share refs</button></div>
  <section class="section"><p class="eyebrow">Profile</p>
    <label class="field"><span>Name</span><input type="text" id="mName" value="${esc(m.name)}"></label>
    <div style="margin-top:12px">${heightFields(m.heightCm, 'ftin')}</div>
    ${bodyFields(m)}
    ${m.note ? `<p class="small muted" style="margin:10px 0 0">${esc(m.note)}</p>` : ''}
    <button class="btn btn-solid btn-block" id="saveM" style="margin-top:14px">${icon('check', 'sm')} Save profile</button>
  </section>
  ${m.sheet ? `<details class="section"><summary><p class="eyebrow" style="margin:0">Original reference sheet</p></summary><img id="mSheet" src="${urlFor(m.sheet)}" alt="Reference sheet" style="border-radius:14px;background:#fff"></details>` : ''}
  ${n.length ? `<p class="eyebrow" style="margin-top:20px">Mockups · ${n.length}</p><div class="masonry" id="mGens">${n.map(lookCard).join('')}</div>` : ''}
  <button class="btn btn-line btn-danger btn-block" id="delM" style="margin-top:18px">${icon('trash', 'sm')} Delete model</button>`;
  if (outfits) $('#mOutfits').onclick = e => {
    const b = e.target.closest('.oc'); if (!b) return; const o = outfits[+b.dataset.i];
    $$('#mOutfits .oc').forEach(x => x.setAttribute('aria-checked', x === b));
    $('#mFront').src = urlFor(o.front); if ($('#mBack')) $('#mBack').src = urlFor(o.back); if ($('#mSheet')) $('#mSheet').src = urlFor(o.sheet);
  };
  let height = m.heightCm;
  bindHeight(v, cm => { height = cm; });
  bindMeasureUnit(v);
  if ($('#mGens')) bindLooks($('#mGens'), n);
  $('#showM').onclick = () => openShowcase({ title: m.name, subtitle: `${formatHeight(m.heightCm)}${m.size ? ' · ' + m.size : ''}`, looks: n });
  $('#shareRefs').onclick = () => shareRefs(m);
  $('#useM').onclick = () => { location.hash = `#/studio?model=${encodeURIComponent(m.id)}`; };
  $('#saveM').onclick = async () => { m.name = $('#mName').value.trim() || m.name; m.heightCm = height; readBody(v, m); await saveModel(m); toast('Profile saved.'); renderModelDetail(id); };
  $('#delM').onclick = async () => { if (!confirm(`Delete ${m.name}?${n.length ? ` Its ${n.length} mockups stay in the lookbook (unlinked).` : ''}`)) return; await deleteModel(m.id, false); location.hash = '#/models'; };
}

/* ---------- import ---------- */
export function renderImportModel(v) {
  setTop('Import model', `<a class="btn btn-ghost" href="#/models" style="min-height:38px">${icon('back', 'sm')} Models</a>`);
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
      <label class="field"><span>Name</span><input type="text" id="iName" placeholder="e.g. Model 3" value="Model ${S.models.length + 1}"></label>
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
      const m = { id: uid(), name: $('#iName').value.trim() || `Model ${S.models.length + 1}`, sheet, front, back, thumb: await makeThumb(front), heightCm: st.height, createdAt: Date.now(), starter: false };
      readBody(v, m);
      await saveModel(m);
      toast(`${m.name} added.`); location.hash = `#/model/${encodeURIComponent(m.id)}`;
    } catch (err) { console.error(err); toast('Saving failed: ' + err.message); $('#saveI').disabled = false; }
  };
}

