// Shared UI helpers.
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const icon = (n, cls = '') => `<svg class="i ${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const urls = new WeakMap();
export const urlFor = b => { if (!b) return ''; if (typeof b === 'string') return b; let u = urls.get(b); if (!u) { u = URL.createObjectURL(b); urls.set(b, u); } return u; };
export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export const fmtDate = t => new Date(t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
export const fmtDay = t => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
export function chip(group, val, label, on, extra = '') { return `<button type="button" class="chip" data-g="${esc(group)}" data-v="${esc(val)}" aria-pressed="${!!on}" ${extra}>${label}</button>`; }
export function toast(msg, { action, onAction, ms = 3800 } = {}) {
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status');
  t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button">${esc(action)}</button>` : ''}`;
  if (action) t.querySelector('button').onclick = () => { onAction?.(); t.remove(); };
  $('#toasts').append(t); setTimeout(() => t.remove(), ms);
}
export function openSheet(html, cls = '') {
  const d = $('#sheet'); d.className = `sheet ${cls}`; d.innerHTML = html;
  d.querySelectorAll('[data-close]').forEach(b => b.onclick = () => d.close());
  if (!d.open) d.showModal();
  return d;
}
export const closeSheet = () => { const d = $('#sheet'); if (d.open) d.close(); };
export function setTop(tag, actions = '') { $('#topTag').textContent = tag; $('#topActions').innerHTML = actions; }
export function downloadBlob(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
/** Share files via the OS sheet when possible (iOS: Save to Files / AirDrop), else download. */
export async function shareOrDownload(blob, name, title = 'Avata') {
  const done = holdWork('share'); try { return await shareOrDownload_(blob, name, title); } finally { done(); }
}
async function shareOrDownload_(blob, name, title) {
  const file = new File([blob], name, { type: blob.type || 'application/octet-stream' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title }); return 'shared'; } catch (e) { if (e.name === 'AbortError') return 'cancelled'; }
  }
  downloadBlob(blob, name); return 'downloaded';
}
/** Long-running work the auto-updater must not interrupt (360 builds, generations, saves, share sheets).
 * Usage: const done = holdWork('spin-build'); try { ... } finally { done(); } */
export const work = new Map();
export function holdWork(name) { const k = Symbol(name); work.set(k, name); return () => work.delete(k); }
export const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
