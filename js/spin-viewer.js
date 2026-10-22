// 360 viewer, ported from the Atelier 360 gallery (jsal1218.github.io/model-gallery):
// drag/swipe spin with inertia, auto-rotate, angle dial, pinch / wheel / double-tap zoom up to 5× with pan,
// hi-res frames swapped in while zoomed. Sparse sets crossfade between neighbouring real frames.
import { bracket, blendWeight, mod, evenAngles } from './spin-core.js';

const AUTO_SPEED = 0.03;           // deg per ms (30°/s)
const MAX_ZOOM = 5, DBL_ZOOM = 2.5, HI_AT = 1.15;
const SVG = p => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;

export function mountViewer(root, { onAngle } = {}) {
  root.innerHTML = `<div class="sv" tabindex="0" role="img" aria-roledescription="360 viewer" aria-label="360 view. Drag or use arrow keys to rotate.">
    <div class="sv-stage"><img class="sv-a" alt="" draggable="false"><img class="sv-b" alt="" draggable="false" aria-hidden="true"></div>
    <div class="sv-hint">Drag to spin · pinch or double‑tap to zoom</div>
    <div class="sv-zoom" hidden><span>1.0×</span><button type="button">Reset</button></div>
    <div class="sv-hd" hidden>HD</div>
    <div class="sv-busy" hidden><div><span class="sv-busy-t">Building…</span><div class="sv-bar"><i></i></div></div></div>
  </div>
  <div class="sv-controls">
    <button class="icon-btn sv-prev" type="button" aria-label="Previous angle">${SVG('<path d="M15 5l-7 7 7 7"/>')}</button>
    <div class="sv-dialwrap"><svg class="sv-dial" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="27" class="ring"/><g class="ticks"></g><g class="hand"><circle cx="32" cy="7" r="4.2" class="dot"/></g><path d="M32 24 l5 8 h-10z" class="cam" transform="rotate(180 32 32) translate(0 22)"/></svg>
      <div class="sv-angle"><b>0°</b><span>Frame 1</span></div></div>
    <button class="icon-btn sv-next" type="button" aria-label="Next angle">${SVG('<path d="M9 5l7 7-7 7"/>')}</button>
    <button class="sv-auto" type="button" aria-pressed="false">${SVG('<path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4"/>')}<span>Auto</span></button>
  </div>`;
  const q = s => root.querySelector(s);
  const viewer = q('.sv'), stage = q('.sv-stage'), imgA = q('.sv-a'), imgB = q('.sv-b');
  const S = { frames: [], angles: [], angle: 0, vel: 0, auto: false, lastT: 0, snapTo: null, zoom: 1, tx: 0, ty: 0, hiLoaded: new Set(), shown: 0, name: '', alive: true, urls: [] };
  root.__spin = S; // exposed for tests

  /* ---------- frames ---------- */
  function load(frames, { name = '', bg = '#fff', angle = 0, auto = false } = {}) {
    S.urls.forEach(u => URL.revokeObjectURL(u)); S.urls = [];
    const url = x => { if (typeof x === 'string') return x; const u = URL.createObjectURL(x); S.urls.push(u); return u; };
    S.frames = frames.map(f => ({ lo: url(f.lo), hi: url(f.hi || f.lo) }));
    S.angles = frames.every(f => typeof f.angle === 'number') ? frames.map(f => f.angle) : evenAngles(frames.length);
    S.hiLoaded = new Set(); S.name = name; viewer.style.background = bg;
    resetZoom(true); S.angle = mod(angle); S.vel = 0; S.snapTo = null; lastKey = '';
    buildDial();
    const pre = Promise.all(S.frames.map(f => new Promise(r => { const i = new Image(); i.onload = i.onerror = () => (i.decode ? i.decode().catch(() => {}) : Promise.resolve()).then(r); i.src = f.lo; })));
    render(true); toggleAuto(auto);
    return pre;
  }

  /** Same model, another outfit: swap the frames in place, keeping the angle, auto-rotate and spin (outfit frames share
   *  the base outfit's angles and framing, so nothing jumps). */
  function swap(frames) {
    const f2 = frames.map(f => ({ lo: f.lo, hi: f.hi || f.lo }));
    const pre = Promise.all(f2.map(f => new Promise(r => { const i = new Image(); i.onload = i.onerror = () => (i.decode ? i.decode().catch(() => {}) : Promise.resolve()).then(r); i.src = f.lo; })));
    return pre.then(() => {
      S.frames = f2; S.angles = frames.every(f => typeof f.angle === 'number') ? frames.map(f => f.angle) : evenAngles(frames.length);
      S.hiLoaded = new Set(); if (S.zoom > 1) resetZoom(true); lastKey = ''; buildDial(); render(true);
    });
  }
  /* ---------- rendering ---------- */
  const srcFor = i => (S.zoom > HI_AT && S.hiLoaded.has(S.frames[i].hi)) ? S.frames[i].hi : S.frames[i].lo;
  let lastKey = '';
  function render(force) {
    if (!S.frames.length) return;
    const { i, j, t, gap } = bracket(S.angles, S.angle);
    let A = i, B = j, w = blendWeight(t, gap);
    if (w === 1 && gap <= 16) { A = j; w = 0; }
    if (S.zoom > 1.001) { A = w < 0.5 ? i : j; w = 0; }   // no ghosting while inspecting detail
    const sa = srcFor(A), sb = srcFor(B), key = sa + '|' + sb + '|' + w.toFixed(3);
    if (force || key !== lastKey) {
      if (imgA.getAttribute('src') !== sa) imgA.src = sa;
      if (w > 0.001) { if (imgB.getAttribute('src') !== sb) imgB.src = sb; imgB.style.opacity = w; } else imgB.style.opacity = 0;
      lastKey = key;
    }
    const shown = w > 0.5 ? B : A; S.shown = shown;
    viewer.dataset.frame = shown; viewer.dataset.angle = Math.round(mod(S.angle));
    imgA.alt = `${S.name}, frame ${shown + 1} of ${S.frames.length}`;
    q('.sv-angle b').textContent = Math.round(mod(S.angle)) % 360 + '°';
    q('.sv-angle span').textContent = `Frame ${shown + 1} / ${S.frames.length}`;
    q('.hand').style.transform = `rotate(${S.angle}deg)`;
    onAngle?.(S.angle, shown);
  }
  function buildDial() {
    q('.ticks').innerHTML = S.angles.map(a => `<line x1="32" y1="2.5" x2="32" y2="6" class="tick" transform="rotate(${a} 32 32)"/>`).join('');
  }

  /* ---------- motion loop ---------- */
  function nearest(a) { let best = S.angles[0] ?? 0, bd = 999; S.angles.forEach(f => { const d = Math.abs(mod(f - a + 180) - 180); if (d < bd) { bd = d; best = f; } }); return best; }
  const goTo = a => { S.vel = 0; S.snapTo = a; };
  function tick(now) {
    if (!root.isConnected) return destroy();
    const dt = Math.min(48, now - (S.lastT || now)); S.lastT = now;
    if (S.frames.length) {
      if (S.auto && !drag.active) S.angle = mod(S.angle + AUTO_SPEED * dt);
      else if (Math.abs(S.vel) > 0.004 && !drag.active) {
        S.angle = mod(S.angle + S.vel * dt); S.vel *= Math.pow(0.94, dt / 16.7);
        if (Math.abs(S.vel) <= 0.004) { S.vel = 0; S.snapTo = nearest(S.angle); }
      } else if (S.snapTo !== null && !drag.active) {
        const diff = mod(S.snapTo - S.angle + 180) - 180;
        if (Math.abs(diff) < 0.3) { S.angle = mod(S.snapTo); S.snapTo = null; } else S.angle = mod(S.angle + diff * Math.min(1, dt / 90));
      }
      render();
    }
    raf = requestAnimationFrame(tick);
  }
  let raf = requestAnimationFrame(tick);
  function destroy() { if (!S.alive) return; S.alive = false; cancelAnimationFrame(raf); S.urls.forEach(u => URL.revokeObjectURL(u)); S.urls = []; removeEventListener('resize', applyZoom); }
  const stopAuto = () => { if (S.auto) toggleAuto(false); };
  function toggleAuto(on = !S.auto) {
    S.auto = on; q('.sv-auto').setAttribute('aria-pressed', on);
    if (on) { resetZoom(); S.vel = 0; S.snapTo = null; } else if (S.frames.length) S.snapTo = nearest(S.angle);
  }

  /* ---------- zoom / pan ---------- */
  function applyZoom() {
    const Wd = viewer.clientWidth, Hd = viewer.clientHeight;
    S.zoom = Math.min(MAX_ZOOM, Math.max(1, S.zoom));
    S.tx = Math.min(0, Math.max(Wd - Wd * S.zoom, S.tx)); S.ty = Math.min(0, Math.max(Hd - Hd * S.zoom, S.ty));
    if (S.zoom <= 1.001) { S.zoom = 1; S.tx = 0; S.ty = 0; }
    stage.style.transform = `translate(${S.tx}px,${S.ty}px) scale(${S.zoom})`;
    const z = S.zoom > 1; viewer.classList.toggle('zoomed', z);
    q('.sv-zoom').hidden = !z; q('.sv-zoom span').textContent = S.zoom.toFixed(1) + '×';
    if (z) { stopAuto(); S.vel = 0; if (S.zoom > HI_AT) loadHi(); }
    q('.sv-hd').hidden = !(S.zoom > HI_AT && S.frames.length && imgA.getAttribute('src') === S.frames[S.shown]?.hi);
    viewer.dataset.zoom = S.zoom.toFixed(2);
  }
  function zoomAt(ns, px, py) { const s = S.zoom; ns = Math.min(MAX_ZOOM, Math.max(1, ns)); S.tx = px - (px - S.tx) * (ns / s); S.ty = py - (py - S.ty) * (ns / s); S.zoom = ns; applyZoom(); }
  function resetZoom(instant) {
    S.zoom = 1; S.tx = 0; S.ty = 0; stage.style.transition = instant ? 'none' : 'transform .28s ease';
    applyZoom(); setTimeout(() => stage.style.transition = '', 300); lastKey = '';
  }
  function loadHi() {
    if (!S.frames.length) return;
    const { i, j, t } = bracket(S.angles, S.angle), f = S.frames[t < 0.5 ? i : j];
    if (S.hiLoaded.has(f.hi)) { lastKey = ''; return; }
    if (f._loading) return; f._loading = true;
    const im = new Image();
    im.onload = () => { (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => { S.hiLoaded.add(f.hi); f._loading = false; lastKey = ''; render(true); applyZoom(); }); };
    im.onerror = () => { f._loading = false; }; im.src = f.hi;
  }

  /* ---------- pointer input ---------- */
  const pts = new Map();
  const drag = { active: false, x: 0, y: 0, hist: [], pinch: null, moved: 0 };
  let lastTap = { t: 0, x: 0, y: 0 };
  const local = e => { const r = viewer.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const degPerPx = () => 360 / Math.max(320, viewer.clientWidth * 1.15);
  const hideHint = () => q('.sv-hint').classList.add('gone');
  setTimeout(hideHint, 6000);
  viewer.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    viewer.classList.add('ptr'); viewer.focus({ preventScroll: true }); try { viewer.setPointerCapture(e.pointerId); } catch {}
    pts.set(e.pointerId, local(e)); hideHint();
    if (pts.size === 1) { const p = local(e); Object.assign(drag, { active: true, x: p.x, y: p.y, hist: [{ x: p.x, t: e.timeStamp }], moved: 0, pinch: null }); S.vel = 0; S.snapTo = null; stopAuto(); viewer.classList.add('dragging'); }
    else if (pts.size === 2) { const [a, b] = [...pts.values()]; drag.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: S.zoom, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, tx: S.tx, ty: S.ty }; drag.moved = 99; }
  });
  viewer.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    const p = local(e); pts.set(e.pointerId, p);
    if (drag.pinch && pts.size >= 2) {
      const [a, b] = [...pts.values()], P = drag.pinch, d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const ns = Math.min(MAX_ZOOM, Math.max(1, P.z * d / P.d)); S.zoom = ns;
      S.tx = mx - (P.mx - P.tx) * (ns / P.z); S.ty = my - (P.my - P.ty) * (ns / P.z); applyZoom(); return;
    }
    if (!drag.active) return;
    const dx = p.x - drag.x, dy = p.y - drag.y; drag.x = p.x; drag.y = p.y; drag.moved += Math.abs(dx) + Math.abs(dy);
    if (S.zoom > 1) { S.tx += dx; S.ty += dy; applyZoom(); return; }   // rotation locked while zoomed
    S.angle = mod(S.angle - dx * degPerPx());
    drag.hist.push({ x: p.x, t: e.timeStamp }); if (drag.hist.length > 6) drag.hist.shift();
  });
  const end = e => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (pts.size === 1 && drag.pinch) { const [p] = [...pts.values()]; drag.pinch = null; drag.x = p.x; drag.y = p.y; drag.hist = []; return; }
    if (pts.size) return;
    viewer.classList.remove('dragging');
    const wasPinch = !!drag.pinch; drag.active = false; drag.pinch = null;
    if (wasPinch) return;
    if (S.zoom === 1) {
      const h = drag.hist, a = h[0], b = h[h.length - 1];
      if (h.length > 1 && e.timeStamp - b.t < 80 && b.t > a.t) S.vel = Math.max(-1.2, Math.min(1.2, -(b.x - a.x) / (b.t - a.t) * degPerPx()));
      if (Math.abs(S.vel) <= 0.004) S.snapTo = nearest(S.angle);
    }
    if (drag.moved < 10) {
      const p = local(e), now = e.timeStamp;
      if (now - lastTap.t < 320 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 30) {
        if (S.zoom > 1) resetZoom(); else { stage.style.transition = 'transform .25s ease'; zoomAt(DBL_ZOOM, p.x, p.y); setTimeout(() => stage.style.transition = '', 260); }
        lastTap.t = 0;
      } else lastTap = { t: now, x: p.x, y: p.y };
    }
  };
  viewer.addEventListener('pointerup', end); viewer.addEventListener('pointercancel', end);
  viewer.addEventListener('wheel', e => { e.preventDefault(); hideHint(); const p = local(e), k = e.ctrlKey ? 0.01 : 0.0018; zoomAt(S.zoom * Math.exp(-e.deltaY * k), p.x, p.y); }, { passive: false });
  viewer.addEventListener('dblclick', e => e.preventDefault());
  ['gesturestart', 'gesturechange'].forEach(t => viewer.addEventListener(t, e => e.preventDefault()));

  /* ---------- keyboard & buttons ---------- */
  function step(dir) {
    if (!S.frames.length) return; stopAuto(); if (S.zoom > 1) resetZoom();
    const A = S.angles, cur = nearest(S.snapTo ?? S.angle), next = A[mod(A.indexOf(cur) + dir, A.length)];
    let delta = mod(next - cur); if (dir < 0) delta -= 360; if (delta === 0 || delta === -360) delta = dir * 360 / Math.max(1, A.length);
    S.angle = cur; goTo(cur + delta);
  }
  viewer.addEventListener('keydown', e => {
    viewer.classList.remove('ptr');
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.key === ' ') { e.preventDefault(); toggleAuto(); } else if (e.key === 'Escape' || e.key === '0') resetZoom();
    else if (e.key === '+' || e.key === '=') zoomAt(S.zoom * 1.4, viewer.clientWidth / 2, viewer.clientHeight / 2);
    else if (e.key === '-') zoomAt(S.zoom / 1.4, viewer.clientWidth / 2, viewer.clientHeight / 2);
  });
  q('.sv-prev').onclick = () => step(-1); q('.sv-next').onclick = () => step(1); q('.sv-auto').onclick = () => toggleAuto();
  q('.sv-zoom button').onclick = e => { e.stopPropagation(); resetZoom(); };
  addEventListener('resize', applyZoom);

  function busy(on, text = '', frac = 0) {
    q('.sv-busy').hidden = !on; if (!on) return;
    q('.sv-busy-t').textContent = text; q('.sv-bar i').style.width = Math.round(frac * 100) + '%';
  }
  return { S, load, swap, busy, destroy, toggleAuto, resetZoom, zoomAt, get angle() { return S.angle; } };
}
