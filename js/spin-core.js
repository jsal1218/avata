// 360 spin core: pure functions (no DOM) so they run in the browser and in `node --test`.
// Everything here works on the exact pixels the user supplied: nothing is generated or invented.

/** Natural compare ("img2" < "img10"). */
export const natCmp = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });

/**
 * Auto-order uploads: if every file name carries a number and the names are distinct, sort by name
 * (natural order, so 2 < 10); otherwise keep the order they were picked in.
 */
export function orderFiles(files) {
  const list = [...files];
  const names = list.map(f => (f.name || '').replace(/\.[^.]+$/, ''));
  const numbered = list.length > 1 && names.every(n => /\d/.test(n)) && new Set(names).size === names.length;
  if (!numbered) return { files: list, by: 'upload' };
  return { files: list.map((f, i) => [f, names[i]]).sort((a, b) => natCmp(a[1], b[1])).map(x => x[0]), by: 'name' };
}

export const evenAngles = n => Array.from({ length: n }, (_, i) => +(i * 360 / n).toFixed(3));
export const mod = (a, n = 360) => ((a % n) + n) % n;
export const smoothstep = x => x * x * (3 - 2 * x);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/** How many frames to pull from a turnaround video of `duration` seconds, and when. */
export function videoTimes(duration, n) {
  if (!(duration > 0) || !isFinite(duration)) return [];
  n ||= clamp(Math.round(duration * 4), 12, 36);
  // evenly spaced over one turn; the clip end is skipped because it repeats the start
  return Array.from({ length: n }, (_, i) => +Math.min(duration - 0.05, i * duration / n + 0.04).toFixed(3));
}

/** Which two frames surround angle `a`, how far between them (t) and the angular gap. */
export function bracket(angles, a) {
  const n = angles.length;
  if (n === 1) return { i: 0, j: 0, t: 0, gap: 360 };
  let i = n - 1;
  for (let k = 0; k < n; k++) if (angles[k] <= a) i = k;
  const j = (i + 1) % n, gap = mod(angles[j] - angles[i]) || 360;
  return { i, j, t: mod(a - angles[i]) / gap, gap };
}

/**
 * Crossfade weight of the next frame. Dense sets (≤16° apart) just switch to the nearest frame.
 * Sparse sets dissolve between neighbours: the wider the gap, the longer the dissolve,
 * so 3–4 photos still turn smoothly instead of jumping. Only real frames are blended.
 */
export function blendWeight(t, gap) {
  if (gap <= 16) return t < 0.5 ? 0 : 1;
  const half = gap <= 50 ? 0.16 : 0.3;
  return smoothstep(clamp((t - (0.5 - half)) / (2 * half), 0, 1));
}

/** Moving median, used to de-jitter alignment values across video frames. */
export function movingMedian(arr, win = 5) {
  const h = win >> 1;
  return arr.map((_, i) => { const s = arr.slice(Math.max(0, i - h), i + h + 1).sort((a, b) => a - b); return s[(s.length - 1) >> 1]; });
}
const median = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

/** Longest run of `true` in a boolean array, bridging gaps up to `gapMax`. */
function longestRun(flags, gapMax) {
  let best = null, start = -1, last = -1;
  const keep = () => { if (start >= 0 && (!best || last - start > best[1] - best[0])) best = [start, last]; };
  for (let i = 0; i < flags.length; i++) {
    if (!flags[i]) continue;
    if (start < 0) start = i;
    else if (i - last - 1 > gapMax) { keep(); start = i; }
    last = i;
  }
  keep();
  return best;
}

function boxFromMask(mask, w, h) {
  const rows = new Uint32Array(h), cols = new Uint32Array(w);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) { rows[y]++; cols[x]++; }
  const ry = longestRun([...rows].map(c => c >= Math.max(2, w * 0.012)), Math.ceil(h * 0.02));
  if (!ry) return null;
  // columns only count pixels inside the vertical run (ignores stray marks above/below the subject)
  const cc = new Uint32Array(w);
  for (let y = ry[0]; y <= ry[1]; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) cc[x]++;
  const rx = longestRun([...cc].map(c => c >= Math.max(2, (ry[1] - ry[0] + 1) * 0.01)), Math.ceil(w * 0.03));
  if (!rx) return null;
  // horizontal centre = weighted median of the mask columns (stable when an arm moves out)
  let tot = 0; for (let x = rx[0]; x <= rx[1]; x++) tot += cc[x];
  let acc = 0, cx = (rx[0] + rx[1] + 1) / 2;
  for (let x = rx[0]; x <= rx[1]; x++) { acc += cc[x]; if (acc >= tot / 2) { cx = x + 0.5; break; } }
  return { l: rx[0], t: ry[0], r: rx[1] + 1, b: ry[1] + 1, cx };
}
const plausible = (bx, w, h) => bx && (bx.b - bx.t) >= h * 0.2 && !((bx.r - bx.l) > w * 0.97 && (bx.b - bx.t) > h * 0.97);

/**
 * Find the subject in an RGBA buffer (w×h, usually a ~360px analysis copy).
 * 1) background colour = median of the four corner patches, foreground = colour distance above an
 *    adaptive threshold; 2) fallback: luminance-edge mask; 3) fallback: whole image.
 * Returns { box:{l,t,r,b,cx} in buffer px, bg:[r,g,b], method }.
 */
export function detectSubject(data, w, h) {
  const p = Math.max(2, Math.round(Math.min(w, h) * 0.06));
  const corner = [];
  for (const [x0, y0] of [[0, 0], [w - p, 0], [0, h - p], [w - p, h - p]])
    for (let y = y0; y < y0 + p; y++) for (let x = x0; x < x0 + p; x++) { const k = (y * w + x) * 4; corner.push([data[k], data[k + 1], data[k + 2]]); }
  const bg = [0, 1, 2].map(c => median(corner.map(px => px[c])));
  const dist = (k) => Math.abs(data[k] - bg[0]) + Math.abs(data[k + 1] - bg[1]) + Math.abs(data[k + 2] - bg[2]);
  const cornerD = corner.map(px => Math.abs(px[0] - bg[0]) + Math.abs(px[1] - bg[1]) + Math.abs(px[2] - bg[2]));
  const T = clamp(pct(cornerD, 0.95) * 1.5 + 24, 30, 120);
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) mask[i] = dist(i * 4) > T ? 1 : 0;
  let box = boxFromMask(mask, w, h);
  if (plausible(box, w, h)) return { box, bg, method: 'background', threshold: Math.round(T) };
  // edge fallback for busy / uneven backgrounds
  const Y = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) Y[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  const mag = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; mag[i] = Math.abs(Y[i + 1] - Y[i - 1]) + Math.abs(Y[i + w] - Y[i - w]); }
  const sample = []; for (let i = 0; i < mag.length; i += 7) sample.push(mag[i]);
  const ET = Math.max(36, pct(sample, 0.85));
  for (let i = 0; i < w * h; i++) mask[i] = mag[i] > ET ? 1 : 0;
  box = boxFromMask(mask, w, h);
  if (plausible(box, w, h)) return { box, bg, method: 'edges' };
  return { box: { l: 0, t: 0, r: w, b: h, cx: w / 2 }, bg, method: 'none' };
}

/**
 * Placement of a source image on the uniform canvas so every frame has the same subject height,
 * the same feet line and the subject centred. Box is in source pixels.
 */
export const LAYOUT = { aspect: 0.6, subject: 0.84, feet: 0.95 };
export function placement(box, cw, ch) {
  const s = (LAYOUT.subject * ch) / Math.max(1, box.b - box.t);
  return { s, dx: cw / 2 - box.cx * s, dy: LAYOUT.feet * ch - box.b * s };
}

/** Uniform hi-res canvas height: the subject's native pixel height (no upscaling), within limits. */
export function hiCanvasHeight(subjectHeights) {
  return Math.round(clamp(median(subjectHeights) / LAYOUT.subject, 1200, 3000) / 2) * 2;
}
