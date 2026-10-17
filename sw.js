// Avata service worker: precache the app shell, cache-first for static assets,
// network-first for HTML. Cross-origin requests (only the optional BYOK APIs) are never touched.
const VERSION = '2026.10.17-3';
const CACHE = `avata-${VERSION}`;
const SHELL = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'js/app.js', 'js/db.js', 'js/imaging.js', 'js/prompt.js', 'js/providers.js', 'js/starters.js', 'js/ui.js', 'js/store.js', 'js/backup.js',
  'js/looks.js', 'js/styles-view.js', 'js/models-view.js', 'js/studio.js', 'js/settings-view.js',
  'js/spin-core.js', 'js/spin-build.js', 'js/spin-viewer.js', 'js/spin-view.js',
  'assets/samples/sketch-tank.svg', 'assets/samples/sketch-short.svg', 'assets/samples/sketch-set.svg',
  'assets/fonts/bodoni-moda.woff2', 'assets/fonts/bodoni-moda-italic.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-64.png',
  ...['model-1', 'model-2'].flatMap(m => ['sheet', 'front', 'back', 'thumb'].map(k => `assets/models/${m}-${k}.webp`)),
];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('avata-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // never touch API traffic
  if (req.mode === 'navigate' || url.pathname.endsWith('.html')) {
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); return r; }).catch(() => caches.match(req).then(r => r || caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return r; })));
});
