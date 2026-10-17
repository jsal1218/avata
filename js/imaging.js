// Browser image helpers: decode, resize, auto-split reference sheets.
export async function loadBitmap(src) {
  const blob = src instanceof Blob ? src : await (await fetch(src)).blob();
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); } catch {}
  }
  const url = URL.createObjectURL(blob);
  try { const img = new Image(); img.decoding = 'async'; img.src = url; await img.decode(); return img; } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
const W = b => b.width || b.naturalWidth, H = b => b.height || b.naturalHeight;
function canvas(w, h) { const c = document.createElement('canvas'); c.width = Math.round(w); c.height = Math.round(h); return c; }
const toBlob = (c, type = 'image/webp', q = 0.9) => new Promise(r => c.toBlob(b => r(b || c.toBlob(r, 'image/jpeg', q)), type, q));

/** Resize to fit maxSide and encode. */
export async function resizeBlob(src, maxSide = 1536, type = 'image/jpeg', q = 0.9) {
  const b = await loadBitmap(src);
  const s = Math.min(1, maxSide / Math.max(W(b), H(b)));
  const c = canvas(W(b) * s, H(b) * s); const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  x.imageSmoothingQuality = 'high'; x.drawImage(b, 0, 0, c.width, c.height);
  return toBlob(c, type, q);
}
export const blobToDataUrl = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
export async function dataUrlForUpload(blob, maxSide = 1536) { return blobToDataUrl(await resizeBlob(blob, maxSide, 'image/jpeg', 0.92)); }

/**
 * Analyse a front|back reference sheet. Mirrors tools/build_assets.py.
 * Returns {split (0..1), bg [r,g,b], boxes:{front,back} in 0..1 coords, confidence}
 */
export async function analyseSheet(src, T = 38) {
  const b = await loadBitmap(src);
  const s = Math.min(1, 512 / Math.max(W(b), H(b)));
  const w = Math.max(1, Math.round(W(b) * s)), h = Math.max(1, Math.round(H(b) * s));
  const c = canvas(w, h); const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(b, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data;
  const px = (i) => [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]];
  const border = [];
  for (let i = 0; i < w; i++) { border.push(px(i), px((h - 1) * w + i)); }
  for (let j = 0; j < h; j++) { border.push(px(j * w), px(j * w + w - 1)); }
  const med = k => { const a = border.map(p => p[k]).sort((p, q) => p - q); return a[a.length >> 1]; };
  const bg = [med(0), med(1), med(2)];
  const fg = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) fg[i] = (Math.abs(d[i * 4] - bg[0]) + Math.abs(d[i * 4 + 1] - bg[1]) + Math.abs(d[i * 4 + 2] - bg[2])) > T ? 1 : 0;
  const cols = new Array(w).fill(0);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) cols[i] += fg[j * w + i];
  const lo = Math.floor(w * 0.3), hi = Math.floor(w * 0.7), limit = Math.max(1, Math.floor(h * 0.004));
  let best = 0, bestX = null, run = null;
  for (let i = lo; i <= hi; i++) {
    if (cols[i] <= limit) { if (run === null) run = i; if (i - run + 1 > best) { best = i - run + 1; bestX = (run + i) >> 1; } }
    else run = null;
  }
  let confidence = 'high';
  if (bestX === null) { confidence = 'low'; bestX = lo; for (let i = lo; i <= hi; i++) if (cols[i] < cols[bestX]) bestX = i; }
  const box = (x0, x1) => {
    let l = w, t = h, r = -1, bt = -1;
    for (let j = 0; j < h; j++) for (let i = x0; i < x1; i++) if (fg[j * w + i]) { if (i < l) l = i; if (i > r) r = i; if (j < t) t = j; if (j > bt) bt = j; }
    if (r < 0) return { l: x0 / w, t: 0, r: x1 / w, b: 1 };
    return { l: l / w, t: t / h, r: (r + 1) / w, b: (bt + 1) / h };
  };
  return { split: bestX / w, bg, boxes: { front: box(0, bestX), back: box(bestX, w) }, confidence, gap: best / w };
}

/** Crop one half onto a 2:3 portrait canvas filled with the background colour. */
export async function cropHalf(src, info, side, maxH = 1536) {
  const b = await loadBitmap(src); const iw = W(b), ih = H(b);
  const bx = info.boxes[side]; const hx0 = side === 'front' ? 0 : info.split * iw, hx1 = side === 'front' ? info.split * iw : iw;
  const l = bx.l * iw, r = bx.r * iw, t = bx.t * ih, btm = bx.b * ih;
  const pad = (btm - t) * 0.04;
  let Hh = btm - t + 2 * pad; let Ww = Math.max(Hh * 2 / 3, r - l + 2 * pad); Hh = Math.max(Hh, Ww * 1.5);
  const cx = (l + r) / 2, cy = (t + btm) / 2;
  const sc = Math.min(1, maxH / Hh);
  const c = canvas(Ww * sc, Hh * sc); const x = c.getContext('2d');
  x.fillStyle = `rgb(${info.bg.join(',')})`; x.fillRect(0, 0, c.width, c.height);
  const sx0 = Math.max(0, cx - Ww / 2, hx0), sx1 = Math.min(iw, cx + Ww / 2, hx1), sy0 = Math.max(0, cy - Hh / 2), sy1 = Math.min(ih, cy + Hh / 2);
  x.imageSmoothingQuality = 'high';
  x.drawImage(b, sx0, sy0, sx1 - sx0, sy1 - sy0, (sx0 - (cx - Ww / 2)) * sc, (sy0 - (cy - Hh / 2)) * sc, (sx1 - sx0) * sc, (sy1 - sy0) * sc);
  return toBlob(c, 'image/webp', 0.9);
}

/** Re-run bbox detection with a manual split (fraction). */
export async function analyseWithSplit(src, split) {
  const base = await analyseSheet(src);
  if (Math.abs(base.split - split) < 0.005) return base;
  // recompute boxes with the forced split
  const b = await loadBitmap(src);
  const s = Math.min(1, 512 / Math.max(W(b), H(b)));
  const w = Math.round(W(b) * s), h = Math.round(H(b) * s);
  const c = canvas(w, h); const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(b, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data; const bg = base.bg; const sx = Math.round(split * w);
  const box = (x0, x1) => {
    let l = w, t = h, r = -1, bt = -1;
    for (let j = 0; j < h; j++) for (let i = x0; i < x1; i++) { const k = (j * w + i) * 4; if (Math.abs(d[k] - bg[0]) + Math.abs(d[k + 1] - bg[1]) + Math.abs(d[k + 2] - bg[2]) > 38) { if (i < l) l = i; if (i > r) r = i; if (j < t) t = j; if (j > bt) bt = j; } }
    if (r < 0) return { l: x0 / w, t: 0, r: x1 / w, b: 1 };
    return { l: l / w, t: t / h, r: (r + 1) / w, b: (bt + 1) / h };
  };
  return { ...base, split, boxes: { front: box(0, sx), back: box(sx, w) }, confidence: 'manual' };
}

export async function makeThumb(src, max = 360) { return resizeBlob(src, max, 'image/webp', 0.82); }
