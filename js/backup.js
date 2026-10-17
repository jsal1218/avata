// Free, offline backup: whole library → one .zip (library.json + image files) or one .json
// (images inlined). API keys and settings are never exported.
import { db } from './db.js';
import { blobToDataUrl } from './imaging.js';

/* ---------- CRC32 + minimal ZIP (store / read store+deflate) ---------- */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32(u8) { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function dosTime(d = new Date()) { return { time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() }; }

/** files: [{name, data: Uint8Array}] → Blob (application/zip), STORE method (images are already compressed). */
export function makeZip(files) {
  const enc = new TextEncoder(); const parts = []; const central = []; let offset = 0; const { time, date } = dosTime();
  for (const f of files) {
    const name = enc.encode(f.name); const data = f.data; const crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint16(10, time, true); h.setUint16(12, date, true);
    h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
    parts.push(h.buffer, name, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true); c.setUint16(12, time, true); c.setUint16(14, date, true);
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
    central.push(c.buffer, name);
    offset += 30 + name.length + data.length;
  }
  const cdSize = central.reduce((n, p) => n + (p.byteLength ?? p.length), 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cdSize, true); e.setUint32(16, offset, true);
  return new Blob([...parts, ...central, e.buffer], { type: 'application/zip' });
}

/** Read a zip (store or deflate entries) → Map(name → Uint8Array). */
export async function readZip(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer()); const dv = new DataView(buf.buffer);
  let eocd = -1; for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('Not a zip file');
  const count = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder(); const out = new Map();
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('Corrupt zip directory');
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nlen));
    const start = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true);
    const raw = buf.subarray(start, start + csize);
    if (method === 0) out.set(name, raw);
    else if (method === 8) {
      if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot read compressed zips — export again from Avata.');
      out.set(name, new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()));
    } else throw new Error(`Unsupported zip method ${method}`);
    p += 46 + nlen + xlen + clen;
  }
  return out;
}

/* ---------- library (de)serialisation ---------- */
const STORES = ['models', 'styles', 'looks'];
const extOf = t => ({ 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/svg+xml': 'svg', 'image/gif': 'gif', 'image/heic': 'heic' }[t] || 'bin');

async function walk(v, fn, path) {
  if (v instanceof Blob) return fn(v, path);
  if (Array.isArray(v)) { const a = []; for (let i = 0; i < v.length; i++) a.push(await walk(v[i], fn, `${path}-${i}`)); return a; }
  if (v && typeof v === 'object' && !(v instanceof Date)) { const o = {}; for (const [k, x] of Object.entries(v)) o[k] = await walk(x, fn, `${path}-${k}`); return o; }
  return v;
}

export async function exportLibrary(format = 'zip', version = '') {
  const data = { app: 'avata', format: 1, version, exportedAt: new Date().toISOString() };
  const files = [];
  for (const store of STORES) {
    const rows = await db.all(store);
    data[store] = [];
    for (const r of rows) {
      data[store].push(await walk(r, async (blob, path) => {
        if (format === 'json') return { $data: await blobToDataUrl(blob) };
        const name = `images/${store}/${path.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120)}.${extOf(blob.type)}`;
        files.push({ name, data: new Uint8Array(await blob.arrayBuffer()) });
        return { $file: name, type: blob.type };
      }, r.id));
    }
  }
  const counts = STORES.map(s => `${data[s].length} ${s}`).join(', ');
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === 'json') return { blob: new Blob([JSON.stringify(data)], { type: 'application/json' }), name: `avata-library-${stamp}.json`, counts };
  files.unshift({ name: 'library.json', data: new TextEncoder().encode(JSON.stringify(data, null, 1)) });
  files.push({ name: 'README.txt', data: new TextEncoder().encode(`Avata library backup (${counts}).\nRestore: Avata → Settings → Data → Import backup.\nlibrary.json holds all records; images/ holds the photos.\n`) });
  return { blob: makeZip(files), name: `avata-library-${stamp}.zip`, counts };
}

const dataUrlToBlob = u => fetch(u).then(r => r.blob());

/** Parse a .zip or .json backup → {models, styles, looks} with Blobs restored. */
export async function parseBackup(file) {
  let data, zip;
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (head[0] === 0x50 && head[1] === 0x4b) {
    zip = await readZip(file);
    const j = zip.get('library.json'); if (!j) throw new Error('library.json missing in zip');
    data = JSON.parse(new TextDecoder().decode(j));
  } else data = JSON.parse(await file.text());
  if (data?.app !== 'avata') throw new Error('Not an Avata backup');
  const restore = async v => {
    if (Array.isArray(v)) return Promise.all(v.map(restore));
    if (v && typeof v === 'object') {
      if (v.$data) return dataUrlToBlob(v.$data);
      if (v.$file) { const u = zip?.get(v.$file); if (!u) throw new Error(`Missing ${v.$file}`); return new Blob([u], { type: v.type || 'application/octet-stream' }); }
      const o = {}; for (const [k, x] of Object.entries(v)) o[k] = await restore(x); return o;
    }
    return v;
  };
  const out = {};
  for (const s of STORES) out[s] = await restore(data[s] || []);
  out.exportedAt = data.exportedAt;
  return out;
}

export async function applyBackup(parsed, mode = 'merge') {
  for (const s of STORES) {
    if (mode === 'replace') await db.clear(s);
    await db.putMany(s, parsed[s]);
  }
  await db.put('kv', true, 'seeded'); await db.put('kv', true, 'seededV2'); // don't re-seed over a restored library
}

/* ---------- CSV ---------- */
const csvCell = v => {
  let s = Array.isArray(v) ? v.join('; ') : v == null ? '' : String(v);
  if (typeof v === 'string' && /^[=+\-@\t]/.test(s)) s = "'" + s; // spreadsheet formula-injection guard
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export function stylesCsv(styles, looks) {
  const cols = ['sku', 'name', 'collection', 'season', 'category', 'status', 'fabric', 'composition', 'colorways', 'sizes', 'supplier', 'cost', 'price', 'tags', 'notes', 'mockups', 'sample', 'created', 'updated'];
  const rows = styles.map(s => cols.map(c => c === 'mockups' ? looks.filter(l => (l.styleIds || []).includes(s.id)).length : c === 'created' ? (s.createdAt ? new Date(s.createdAt).toISOString() : '') : c === 'updated' ? (s.updatedAt ? new Date(s.updatedAt).toISOString() : '') : c === 'sample' ? (s.sample ? 'yes' : '') : s[c]));
  return '\ufeff' + [cols, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');
}
