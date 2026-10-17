// Build a 360 spin in the browser from the user's own photos or a turnaround video.
// Exact pixels only: frames are ordered, aligned (translate + uniform scale) and re-encoded. No AI, no network.
import { loadBitmap } from './imaging.js';
import { orderFiles, videoTimes, detectSubject, placement, hiCanvasHeight, movingMedian, LAYOUT } from './spin-core.js';

const W = b => b.width || b.naturalWidth || b.videoWidth, H = b => b.height || b.naturalHeight || b.videoHeight;
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.round(w); c.height = Math.round(h); return c; };
const free = c => { c.width = c.height = 0; };
const close = b => { try { b.close?.(); } catch {} };
let webpOk;
const canWebp = () => webpOk ??= canvas(2, 2).toDataURL('image/webp').startsWith('data:image/webp');
// Safari can't encode WebP (it silently returns PNG), so use JPEG there.
const encode = (c, q) => new Promise(r => c.toBlob(b => r(b), canWebp() ? 'image/webp' : 'image/jpeg', q));
export const LO_H = 1200;

/** Split a picked file list into the source frames (images, or frames pulled from the first video). */
export async function collectSources(fileList, onProgress = () => {}) {
  const files = [...fileList];
  const video = files.find(f => (f.type || '').startsWith('video/') || /\.(mov|mp4|m4v|webm)$/i.test(f.name || ''));
  if (video) return { kind: 'video', by: 'video', blobs: await videoFrames(video, onProgress), ignored: files.length - 1 };
  const imgs = files.filter(f => (f.type || '').startsWith('image/') || /\.(jpe?g|png|webp|heic|heif|avif|gif)$/i.test(f.name || ''));
  const { files: ordered, by } = orderFiles(imgs);
  return { kind: 'photos', by, blobs: ordered, ignored: files.length - imgs.length };
}

/** Pull evenly spaced frames from a turnaround clip (one full turn assumed). */
export async function videoFrames(file, onProgress = () => {}, n) {
  const url = URL.createObjectURL(file);
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('muted', ''); v.preload = 'auto';
  // iOS only decodes frames for a video that is in the document
  v.style.cssText = 'position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
  document.body.append(v);
  try {
    await new Promise((res, rej) => {
      const to = setTimeout(() => rej(new Error('The video took too long to open.')), 20000);
      v.onloadeddata = () => { clearTimeout(to); res(); };
      v.onerror = () => { clearTimeout(to); rej(new Error('This video format can’t be read on this device.')); };
      v.src = url; v.load();
    });
    try { await v.play(); v.pause(); } catch {}
    let dur = v.duration;
    if (!isFinite(dur)) { v.currentTime = 1e7; await seeked(v); dur = v.currentTime; }
    const times = videoTimes(dur, n);
    if (!times.length) throw new Error('The video looks empty.');
    const s = Math.min(1, 2400 / Math.max(v.videoWidth, v.videoHeight));
    const c = canvas(v.videoWidth * s, v.videoHeight * s), x = c.getContext('2d');
    const out = [];
    for (const [i, t] of times.entries()) {
      onProgress({ phase: 'video', done: i, total: times.length });
      v.currentTime = t; await seeked(v);
      x.drawImage(v, 0, 0, c.width, c.height);
      out.push(await new Promise(r => c.toBlob(r, 'image/jpeg', 0.93)));
    }
    free(c);
    return out;
  } finally { v.removeAttribute('src'); v.load?.(); v.remove(); URL.revokeObjectURL(url); }
}
function seeked(v) {
  return new Promise(res => {
    let done = false; const fin = () => { if (done) return; done = true; v.removeEventListener('seeked', on); clearTimeout(to); res(); };
    const on = () => (v.requestVideoFrameCallback ? (v.requestVideoFrameCallback(fin), setTimeout(fin, 250)) : setTimeout(fin, 30));
    v.addEventListener('seeked', on); const to = setTimeout(fin, 4000);
  });
}

/** Detect the subject in one source image. Returns detection in source pixels. */
async function analyse(blob) {
  const b = await loadBitmap(blob);
  const w0 = W(b), h0 = H(b); const s = Math.min(1, 360 / Math.max(w0, h0));
  const w = Math.max(8, Math.round(w0 * s)), h = Math.max(8, Math.round(h0 * s));
  const c = canvas(w, h), x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(b, 0, 0, w, h); close(b);
  const det = detectSubject(x.getImageData(0, 0, w, h).data, w, h); free(c);
  const k = w0 / w, kk = h0 / h, bx = det.box;
  return { w: w0, h: h0, bg: det.bg, method: det.method, box: { l: bx.l * k, r: bx.r * k, t: bx.t * kk, b: bx.b * kk, cx: bx.cx * k } };
}

/**
 * Full pipeline: sources → aligned lo (spin) + hi (zoom) frames on one uniform canvas.
 * onProgress({phase, done, total}).
 */
export async function buildSpin(fileList, onProgress = () => {}) {
  const src = await collectSources(fileList, onProgress);
  const blobs = src.blobs;
  if (blobs.length < 2) throw new Error(src.kind === 'video' ? 'Could not read frames from that video.' : 'Pick at least 2 photos (8 or more works best).');
  const dets = [];
  for (const [i, b] of blobs.entries()) { onProgress({ phase: 'detect', done: i, total: blobs.length }); dets.push(await analyse(b)); }
  if (src.kind === 'video') {
    // camera distance is constant in a turnaround: smooth the detections so the spin doesn't wobble
    const sm = k => movingMedian(dets.map(d => d.box[k]), 5);
    const [t, b, cx] = ['t', 'b', 'cx'].map(sm);
    dets.forEach((d, i) => { d.box.t = t[i]; d.box.b = b[i]; d.box.cx = cx[i]; });
  }
  const hiH = hiCanvasHeight(dets.map(d => d.box.b - d.box.t)), hiW = Math.round(hiH * LAYOUT.aspect / 2) * 2;
  const loH = LO_H, loW = Math.round(loH * LAYOUT.aspect);
  const bg = dets[0].bg; const bgCss = `rgb(${bg.join(',')})`;
  const frames = [];
  for (const [i, blob] of blobs.entries()) {
    onProgress({ phase: 'align', done: i, total: blobs.length });
    const d = dets[i], b = await loadBitmap(blob);
    const draw = (cw, ch, q) => {
      const c = canvas(cw, ch), x = c.getContext('2d');
      x.fillStyle = `rgb(${d.bg.join(',')})`; x.fillRect(0, 0, cw, ch);   // pad with this photo's own background colour
      const p = placement(d.box, cw, ch);
      x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
      x.drawImage(b, p.dx, p.dy, W(b) * p.s, H(b) * p.s);
      return encode(c, q).then(bl => (free(c), bl));
    };
    const hi = await draw(hiW, hiH, 0.9), lo = await draw(loW, loH, 0.85);
    close(b);
    frames.push({ lo, hi, method: d.method });
  }
  onProgress({ phase: 'done', done: blobs.length, total: blobs.length });
  const thumb = await makeSpinThumb(frames[0].lo);
  return { frames, thumb, bg: bgCss, kind: src.kind, by: src.by, ignored: src.ignored, canvas: { lo: [loW, loH], hi: [hiW, hiH] }, detection: dets.map(d => d.method) };
}

export async function makeSpinThumb(lo) {
  const b = await loadBitmap(lo); const c = canvas(180, 300); const x = c.getContext('2d');
  x.imageSmoothingQuality = 'high'; x.drawImage(b, 0, 0, 180, 300); close(b);
  const out = await encode(c, 0.82); free(c); return out;
}
