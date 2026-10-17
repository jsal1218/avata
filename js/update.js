// Fast service-worker auto-update (same approach as the Dash hub).
// - registers with updateViaCache:'none' and checks for a new sw.js on load, on return to the foreground
//   (visibilitychange / pageshow / focus) and every 60 s while open;
// - sw.js uses skipWaiting + clients.claim, so a new deploy takes control within seconds (controllerchange);
// - then we reload right away when that's safe (page hidden, or the user isn't mid-task). Otherwise a small
//   "Updated, tap to reload" toast appears and the reload happens the next time the app comes back to the foreground.
// - loop guard: never reload for a worker whose version this page already runs; at most 2 auto-reloads per new version.
import { work } from './ui.js';

const EDIT_ROUTES = new Set(['style-edit', 'import-looks', 'import-model', 'model', 'studio']);
const LOOP_KEY = 'avata.swReloads';

export function initUpdates(VERSION) {
  if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
  const sw = navigator.serviceWorker;
  let firstClaim = !sw.controller; // a first install claiming this page isn't an update
  let reloading = false, pending = false, picker = 0, dirty = false, wasHidden = document.hidden;
  const S = window.__avataUpdate = { VERSION, pending: () => pending, busy: () => busyReason(false) };

  /* ---------- "is the user mid-task?" ---------- */
  const route = () => (location.hash || '#/looks').slice(2).split(/[/?]/)[0];
  // file pickers: an <input type=file> was clicked and hasn't reported change/cancel yet (iOS can hide the page meanwhile)
  document.addEventListener('click', e => { if (e.target instanceof HTMLInputElement && e.target.type === 'file') picker = Date.now(); }, true);
  const pickerDone = () => { picker = 0; };
  document.addEventListener('change', e => { if (e.target.type === 'file') pickerDone(); }, true);
  document.addEventListener('cancel', e => { if (e.target.type === 'file') pickerDone(); }, true);
  // older iOS fires no 'cancel': once the page is back (focus/visible) and 2 s pass without 'change', treat the picker as closed
  const pickerBack = () => { const at = picker; if (at) setTimeout(() => { if (picker === at && Date.now() - at > 2000) pickerDone(); }, 2000); };
  addEventListener('focus', pickerBack); document.addEventListener('visibilitychange', () => { if (!document.hidden) pickerBack(); });
  // unsaved edits: any field touched in an edit/import/prompt view until the route changes
  const markDirty = e => { const t = e.target; if (EDIT_ROUTES.has(route()) && t.closest?.('#view') && /INPUT|SELECT|TEXTAREA/.test(t.tagName) && t.type !== 'search') dirty = true; };
  document.addEventListener('input', markDirty, true); document.addEventListener('change', markDirty, true);
  addEventListener('hashchange', () => { dirty = false; });

  function busyReason(soft = true) {
    if (work.size) return [...work.values()][0];                                   // 360 build, generation, save, share…
    if (document.querySelector('.sv-busy:not([hidden])')) return 'spin-build';
    if (picker && Date.now() - picker < 10 * 60e3) return 'file-picker';
    if (dirty) return 'unsaved-edit';
    if (document.querySelector('dialog[open]')) return 'modal';
    if (soft) { const a = document.activeElement; if (a && (a.isContentEditable || (/INPUT|SELECT|TEXTAREA/.test(a.tagName) && !/button|submit|checkbox|radio|range|file/.test(a.type)))) return 'typing'; }
    return '';
  }

  /* ---------- reload with a loop guard ---------- */
  // loop guard: at most 2 auto-reloads for the same new version (10 min) and 5 in total per minute
  function canAutoReload(target) {
    try {
      const now = Date.now(), log = JSON.parse(sessionStorage.getItem(LOOP_KEY) || '[]').filter(x => now - x.t < 600e3);
      if (target && log.filter(x => x.v === target).length >= 2) return false;
      if (log.filter(x => now - x.t < 60e3).length >= 5) return false;
      log.push({ t: now, v: target || '' }); sessionStorage.setItem(LOOP_KEY, JSON.stringify(log));
    } catch {}
    return true;
  }
  function reload(auto = true) {
    if (reloading) return;
    if (auto && !canAutoReload(S.lastControllerVersion)) { console.warn('[avata] auto-reload suppressed (loop guard)'); return showToast(); }
    reloading = true; location.reload();
  }

  function showToast() {
    if (document.getElementById('updToast')) return;
    const t = document.createElement('button');
    t.id = 'updToast'; t.type = 'button'; t.className = 'upd-toast'; t.setAttribute('role', 'status');
    t.textContent = 'Updated, tap to reload';
    t.onclick = () => reload(false);
    document.body.append(t);
    try { t.popover = 'manual'; t.showPopover(); } catch {} // top layer: stays visible above an open sheet/modal
  }

  // ask the active worker which version it is (old workers don't answer, resolves '')
  const controllerVersion = () => new Promise(res => {
    const c = sw.controller; if (!c) return res('');
    const ch = new MessageChannel(); const to = setTimeout(() => res(''), 1500);
    ch.port1.onmessage = e => { clearTimeout(to); res(String(e.data?.version || '')); };
    try { c.postMessage({ type: 'version' }, [ch.port2]); } catch { clearTimeout(to); res(''); }
  });

  sw.addEventListener('controllerchange', async () => {
    if (reloading) return;
    if (firstClaim) { firstClaim = false; return; }           // first install: this page already runs the latest code
    const v = await controllerVersion();
    if (v && v === VERSION) return;                            // network-first already served this page the new files
    S.lastControllerVersion = v;
    if (document.hidden ? !busyReason(false) : !busyReason()) return reload();
    pending = true; showToast();
  });

  /* ---------- update checks ---------- */
  let reg = null, last = 0;
  const check = (force) => { if (!reg || (!force && Date.now() - last < 5000)) return; last = Date.now(); reg.update().catch(() => {}); };
  const foreground = () => {
    if (pending && !busyReason(false)) return reload();        // update arrived while busy: apply it on return
    check();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { wasHidden = true; return; }
    if (wasHidden) { wasHidden = false; foreground(); }
  });
  addEventListener('pageshow', e => { if (e.persisted) foreground(); else check(); });
  addEventListener('focus', () => check());
  setInterval(() => { if (!document.hidden) check(true); }, 60e3);
  S.check = () => check(true);

  sw.register('sw.js', { updateViaCache: 'none' }).then(r => { reg = r; check(true); }).catch(() => {});
}
