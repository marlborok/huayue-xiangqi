/* 花月象棋 — offline support. Everything the game loads is kept in the cache as it is fetched:
 * - the game's own code and pages (html, js, css, json, manifest): network first, so an update shows up whenever there is a connection,
 *   falling back to the cached copy offline;
 * - pictures, the three.js files and the fonts: cache first (they never change under the same address), network to fill the cache.
 * One full load while online is enough to play offline afterwards. Bump VERSION only to throw the whole cache away.
 */
const VERSION = 'huayue-v2';
const SHELL = ['./', 'index.html', 'css/style.css', 'manifest.webmanifest',
  'js/look.js', 'js/sound.js', 'js/rules.js', 'js/ai.js', 'js/figures.js', 'js/paper.js', 'js/terrain.js', 'js/game.js', 'js/book.js', 'assets/paper/variants.json'];

/* fetched up front, so the first offline start has everything even if the browser served them from memory before.
 * Add new pictures here when they are added to assets/. */
const ASSETS = [
  'assets/paper/flower-A.webp',
  'assets/paper/flower-B.webp',
  'assets/paper/flower-C.webp',
  'assets/paper/flower-K.webp',
  'assets/paper/flower-N.webp',
  'assets/paper/flower-P.webp',
  'assets/paper/flower-R.webp',
  'assets/paper/moon-A.webp',
  'assets/paper/moon-B.webp',
  'assets/paper/moon-C.webp',
  'assets/paper/moon-K.webp',
  'assets/paper/moon-N.webp',
  'assets/paper/moon-P.webp',
  'assets/paper/moon-R.webp',
  'assets/paper/scene-flower-bridge.webp',
  'assets/paper/scene-flower-bush.webp',
  'assets/paper/scene-flower-pavilion.webp',
  'assets/paper/scene-flower-tree.webp',
  'assets/paper/scene-flower-tree2.webp',
  'assets/paper/scene-moon-hill.webp',
  'assets/paper/scene-moon-lantern.webp',
  'assets/paper/scene-moon-lavender.webp',
  'assets/paper/scene-moon-mushrooms.webp',
  'assets/paper/scene-moon-observatory.webp',
  'assets/paper/sky-flower.jpg',
  'assets/paper/sky-moon.jpg',
  'assets/icons/apple-touch-icon.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/maskable-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/environments/RoomEnvironment.js',
  'https://fonts.googleapis.com/css2?family=LXGW+WenKai+TC:wght@400;700&family=Noto+Sans+TC:wght@400;700&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(async c => {
    await c.addAll(SHELL);
    await Promise.allSettled(ASSETS.map(u => c.add(u)));   /* one missing picture must not stop the rest */
  }).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const isCode = url => url.origin === self.location.origin && /(\/|\.html|\.js|\.css|\.json|\.webmanifest)$/.test(url.pathname);
const keep = (req, res) => { if (res && (res.ok || res.type === 'opaque')) caches.open(VERSION).then(c => c.put(req, res.clone())); return res; };

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (isCode(url) || req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => keep(req, res)).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
  } else {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => keep(req, res))));
  }
});
