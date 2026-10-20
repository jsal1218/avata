// Avata service worker. VERSION is stamped automatically by the pre-commit hook (.githooks/pre-commit). Do not edit by hand.
// Strategy: same-origin HTML/JS/CSS/JSON/manifest are network-first (revalidated against the server, cache only as the
// offline fallback) so a new deploy is never served stale; big images/fonts are cache-first. Cross-origin requests
// (only the optional BYOK APIs) are never touched. skipWaiting + clients.claim, so a new version takes over at once;
// js/update.js then reloads the page when it's safe.
const VERSION = '2026.10.20-055229-424c749';
const CACHE = `avata-${VERSION}`;
const SHELL = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'js/app.js', 'js/update.js', 'js/db.js', 'js/imaging.js', 'js/prompt.js', 'js/providers.js', 'js/starters.js', 'js/starter-sync.js', 'js/ui.js', 'js/store.js', 'js/backup.js',
  'js/looks.js', 'js/styles-view.js', 'js/models-view.js', 'js/studio.js', 'js/settings-view.js',
  'js/spin-core.js', 'js/spin-build.js', 'js/spin-viewer.js', 'js/spin-view.js',
  'assets/samples/sketch-tank.svg', 'assets/samples/sketch-short.svg', 'assets/samples/sketch-set.svg',
  'assets/fonts/bodoni-moda.woff2', 'assets/fonts/bodoni-moda-italic.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-64.png',
  ...[...[5, 6, 7, 9, 10, 12, 13, 14, 17, 18, 19, 20, 21, 22, 23, 24, 25].map(n => `exact-${n}`), 'exact-5-tank-shorts', 'exact-5-yoga-set', 'exact-5-linen-set', 'exact-6-yoga-set', 'exact-25-red-dress', 'generated-1', 'generated-1-summer-denim', 'generated-1-sundress', 'generated-1-linen-set', 'generated-2', 'generated-2-yoga-set', 'generated-3', 'generated-3-turtleneck', 'generated-3-slip-dress', 'generated-3-tank-shorts'].flatMap(m => ['sheet', 'front', 'back', 'thumb'].map(k => `assets/models/${m}-${k}.webp`)),
];
// cache:'reload' bypasses the HTTP cache (GitHub Pages sends max-age=600) so a new version never precaches old files
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('avata-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('message', e => { if (e.data?.type === 'version') e.ports[0]?.postMessage({ version: VERSION }); });

const FRESH = /(\/|\.(html?|m?js|css|json|webmanifest|svg|txt))$/i;
const keep = (req, res) => { if (res.ok && res.type === 'basic') { const c = res.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return res; };
self.addEventListener('fetch', e => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // never touch API / third-party traffic
  if (req.mode === 'navigate' || FRESH.test(url.pathname)) {
    // network-first; 'no-cache' revalidates with the server (cheap 304s) instead of trusting the 10-minute HTTP cache
    e.respondWith(fetch(req, { cache: 'no-cache' }).then(r => keep(req, r)).catch(async () =>
      (await caches.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => keep(req, r))));
});
