import { holdWork, $, $$, esc, icon, toast, setTop, openSheet, closeSheet, shareOrDownload } from './ui.js';
import { S, settings, saveSettings, getKey, setKey, reload, seedStarters, seedSamples, removeSamples } from './store.js';
import { PROVIDERS, UPSCALERS, getModel } from './providers.js';
import { exportLibrary, parseBackup, applyBackup } from './backup.js';
import { exportCsv } from './styles-view.js';
import { modelOptions } from './studio.js';

export function applyTheme() {
  const r = document.documentElement;
  if (settings.theme === 'light' || settings.theme === 'dark') r.dataset.theme = settings.theme; else delete r.dataset.theme;
}

export async function renderSettings(v, version) {
  setTop('Settings');
  const keyBlock = p => { const P = PROVIDERS[p]; const k = getKey(p); return `<div class="field" style="margin-top:14px"><span>${P.label} key ${k ? '<span class="pill acc" style="letter-spacing:0;text-transform:none;margin-left:6px">saved on device</span>' : ''}</span>
    <div class="key-row"><input type="password" id="k-${p}" value="${esc(k)}" placeholder="${p === 'fal' ? 'key_id:key_secret' : 'AIza…'}" autocomplete="off" autocapitalize="off" spellcheck="false"><button class="icon-btn btn-line" data-show="${p}" aria-label="Show key">${icon('key', 'sm')}</button></div>
    <div class="row between small" style="margin-top:6px"><a href="${P.signup}" target="_blank" rel="noopener">${P.label} keys ↗</a>${k ? `<button class="btn-ghost btn-danger small" style="min-height:32px" data-clear="${p}">Remove</button>` : ''}</div></div>`; };
  const samples = S.styles.some(s => s.sample) || S.looks.some(l => l.sample);
  v.innerHTML = `<h1 class="display fade-in">Settings</h1>
  <section class="section"><p class="eyebrow">${icon('lock', 'xs')} Data &amp; backup</p>
    <p class="small muted" style="margin:0 0 12px">Everything lives on this device. Back up to one file and restore it on another phone — free, no account, no server.</p>
    <div class="stack">
      <button class="btn btn-solid btn-block" id="expZip">${icon('down', 'sm')} Export library (.zip)</button>
      <button class="btn btn-line btn-block" id="expJson">${icon('down', 'sm')} Export library (.json, single file)</button>
      <button class="btn btn-line btn-block" id="imp">${icon('up', 'sm')} Import backup (.zip / .json)</button><input type="file" id="impF" accept=".zip,.json,application/zip,application/json" hidden>
      <button class="btn btn-line btn-block" id="csv">${icon('grid', 'sm')} Export styles catalog (.csv)</button>
    </div>
    <p class="small" id="store" style="margin:12px 0 0">Calculating…</p>
    <div class="divider"></div>
    <div class="stack">
      ${samples ? `<button class="btn btn-line btn-block" id="rmSamples">${icon('trash', 'sm')} Remove sample styles &amp; looks</button>` : `<button class="btn btn-line btn-block" id="addSamples">${icon('redo', 'sm')} Add sample styles &amp; looks</button>`}
      <button class="btn btn-line btn-block" id="restore">${icon('redo', 'sm')} Restore starter models</button>
    </div>
    <p class="tiny muted" style="margin:10px 0 0">Backups never include API keys or settings.</p>
  </section>
  <section class="section"><p class="eyebrow">Appearance</p>
    <div class="seg" id="sTheme">${[['system', 'System'], ['light', 'Light'], ['dark', 'Dark']].map(([k, l]) => `<button type="button" data-v="${k}" aria-pressed="${settings.theme === k}">${l}</button>`).join('')}</div></section>
  <section class="section flat"><p class="eyebrow">Install on iPhone</p><p class="small muted" style="margin:0">Open in Safari → Share → <b>Add to Home Screen</b>. Avata runs full-screen and works offline.</p></section>
  <details class="section" id="adv" ${settings.byok ? 'open' : ''}><summary><p class="eyebrow" style="margin:0">Advanced</p></summary>
    <p style="margin:0 0 6px"><b>Bring your own API key (billed by provider)</b></p>
    <div class="note warn">${icon('info', 'sm')}<span>Avata is free and needs none of this. Turning it on lets the Studio call <b>paid</b> image APIs (fal.ai or Google Gemini) <b>directly from this device, billed to whoever owns the key</b>. Off by default; nothing is sent anywhere while it’s off. Keys stay in this browser only.</span></div>
    <label class="switch" style="margin-top:10px"><span><b>Enable in-app generation</b></span><input type="checkbox" id="byok" ${settings.byok ? 'checked' : ''}></label>
    ${settings.byok ? `${keyBlock('fal')}${keyBlock('gemini')}
      <label class="field" style="margin-top:14px"><span>Default model</span><select id="sModel">${modelOptions(settings.model)}</select></label>
      <p class="small muted" id="sBlurb" style="margin:8px 2px 0"></p>
      <div class="row between" style="margin-top:14px"><b>Resolution</b><div class="seg" id="sRes" style="min-width:170px">${['1K', '2K', '4K'].map(r => `<button type="button" data-v="${r}" aria-pressed="${settings.resolution === r}">${r}</button>`).join('')}</div></div>
      <label class="field" style="margin-top:14px"><span>Content filter strictness · <b id="sSafV">${settings.safety}</b> (1 strict – 6 permissive)</span><input type="range" id="sSaf" min="1" max="6" step="1" value="${settings.safety}"></label>
      <label class="field" style="margin-top:14px"><span>Default upscaler</span><select id="sUp">${UPSCALERS.map(u => `<option value="${u.id}" ${u.id === settings.upscaler ? 'selected' : ''}>${u.label}</option>`).join('')}</select></label>
      <button class="btn btn-line btn-block btn-danger" id="offAll" style="margin-top:14px">${icon('trash', 'sm')} Turn off &amp; delete keys</button>` : ''}
  </details>
  <p class="tiny muted" style="text-align:center">Avata ${version} · free · <a href="https://github.com/jsal1218/avata" target="_blank" rel="noopener">source</a></p>`;

  const rerender = () => renderSettings(v, version);
  $('#expZip').onclick = () => doExport('zip');
  $('#expJson').onclick = () => doExport('json');
  async function doExport(fmt) {
    const b = fmt === 'zip' ? $('#expZip') : $('#expJson'); b.disabled = true; const t = b.innerHTML; b.textContent = 'Packing…';
    const done = holdWork('export');
    try { const r = await exportLibrary(fmt, version); const how = await shareOrDownload(r.blob, r.name, 'Avata backup'); if (how !== 'cancelled') toast(`Backup ready (${r.counts}, ${(r.blob.size / 1048576).toFixed(1)} MB).`); }
    catch (e) { console.error(e); toast('Export failed: ' + e.message); }
    finally { done(); }
    b.disabled = false; b.innerHTML = t;
  }
  $('#imp').onclick = () => $('#impF').click();
  $('#impF').onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    let parsed; try { parsed = await parseBackup(f); } catch (err) { toast('Not a valid Avata backup: ' + err.message, { ms: 7000 }); return; }
    openSheet(`<div class="modal"><div class="row between"><h2 class="h">Import backup</h2><button class="icon-btn btn-ghost" data-close aria-label="Close">${icon('x')}</button></div>
      <p>${parsed.models.length} models · ${parsed.styles.length} styles · ${parsed.looks.length} looks${parsed.exportedAt ? `<br><span class="small muted">Exported ${new Date(parsed.exportedAt).toLocaleString()}</span>` : ''}</p>
      <div class="stack"><button class="btn btn-solid btn-block" id="mMerge">Merge into this library</button><p class="tiny muted" style="margin:0">Items with the same ID are updated; everything else is kept.</p>
      <button class="btn btn-line btn-block btn-danger" id="mReplace">Replace this library</button><p class="tiny muted" style="margin:0">Deletes current models, styles and looks first.</p></div></div>`, 'half');
    const go = async mode => { if (mode === 'replace' && !confirm('Replace everything on this device with the backup?')) return; const done = holdWork('restore'); try { await applyBackup(parsed, mode); await reload(); } finally { done(); } closeSheet(); toast('Backup imported.'); rerender(); };
    $('#mMerge').onclick = () => go('merge'); $('#mReplace').onclick = () => go('replace');
  };
  $('#csv').onclick = async () => { const r = await exportCsv(); if (r === 'downloaded') toast('CSV saved.'); };
  $('#rmSamples')?.addEventListener('click', async () => { if (!confirm('Remove all sample styles and sample looks?')) return; await removeSamples(); toast('Samples removed.'); rerender(); });
  $('#addSamples')?.addEventListener('click', async () => { await seedSamples(true); await reload(); toast('Samples added.'); rerender(); });
  $('#restore').onclick = async () => { await seedStarters(true); await reload(); toast('Starter models restored.'); };
  $('#sTheme').onclick = e => { const b = e.target.closest('button'); if (!b) return; settings.theme = b.dataset.v; saveSettings(); applyTheme(); $$('#sTheme button').forEach(x => x.setAttribute('aria-pressed', x === b)); };
  $('#byok').onchange = e => { settings.byok = e.target.checked; saveSettings(); toast(settings.byok ? 'In-app generation on — uses your key, billed by the provider.' : 'In-app generation off.'); rerender(); };
  if (settings.byok) {
    for (const p of Object.keys(PROVIDERS)) { const i = $(`#k-${p}`); i.addEventListener('change', () => { setKey(p, i.value); toast(i.value ? 'Key saved on this device.' : 'Key removed.'); rerender(); }); }
    $$('[data-show]').forEach(b => b.onclick = () => { const i = $(`#k-${b.dataset.show}`); i.type = i.type === 'password' ? 'text' : 'password'; });
    $$('[data-clear]').forEach(b => b.onclick = () => { setKey(b.dataset.clear, ''); rerender(); });
    const blurb = () => { const m = getModel(settings.model); $('#sBlurb').textContent = `${m.vendor} · ${m.blurb}`; }; blurb();
    $('#sModel').onchange = e => { settings.model = e.target.value; saveSettings(); blurb(); };
    $('#sRes').onclick = e => { const b = e.target.closest('button'); if (!b) return; settings.resolution = b.dataset.v; saveSettings(); $$('#sRes button').forEach(x => x.setAttribute('aria-pressed', x === b)); };
    $('#sSaf').oninput = e => { settings.safety = +e.target.value; $('#sSafV').textContent = settings.safety; saveSettings(); };
    $('#sUp').onchange = e => { settings.upscaler = e.target.value; saveSettings(); };
    $('#offAll').onclick = () => { settings.byok = false; saveSettings(); Object.keys(PROVIDERS).forEach(p => setKey(p, '')); toast('Generation off, keys deleted.'); rerender(); };
  }
  try { const e = await navigator.storage.estimate(); $('#store').textContent = `${S.models.length} models · ${S.styles.length} styles · ${S.looks.length} looks · ~${(e.usage / 1048576).toFixed(1)} MB on this device.`; } catch { $('#store').textContent = `${S.models.length} models · ${S.styles.length} styles · ${S.looks.length} looks.`; }
}
