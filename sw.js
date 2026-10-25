// Stream Companion service worker — v2.1.0 (Publish studio + Twitch Sync).
// Cache name bumps with the app version (same rule as his other apps:
// a stale cache name means a new version never installs).
var CACHE = 'stream-companion-v2.1.0';
var FILES = [
  './', 'index.html', 'styles.css', 'app.js', 'features.js',
  'sync.js', 'publish.js',
  'manifest.json', 'icon-192.png', 'icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  // twitch-stats.json changes every 6 hours — never serve it from cache,
  // or the Dashboard would show stale follower counts.
  if (e.request.url.indexOf('twitch-stats.json') !== -1) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
    return hit || fetch(e.request);
  }));
});
