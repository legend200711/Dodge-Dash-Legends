// Dodge Dash Legends — Service Worker v3
// Caches the full game for offline play after the first load.

const CACHE = 'ddl-v3';
const ASSETS = [
  './dodge-dash-legends.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
];

// ── Install: pre-cache all assets ───────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      // addAll fails if any single request fails (e.g. CDN offline at install time).
      // Cache local files unconditionally; try the CDN but don't block on it.
      const localAssets = ASSETS.filter(a => a.startsWith('./'));
      const cdnAssets   = ASSETS.filter(a => !a.startsWith('./'));

      return cache.addAll(localAssets).then(() =>
        Promise.allSettled(cdnAssets.map(url =>
          fetch(url).then(r => r.ok ? cache.put(url, r) : Promise.resolve())
                    .catch(() => {}) // CDN unavailable at install time — that's fine
        ))
      );
    })
  );
  self.skipWaiting();
});

// ── Activate: wipe old caches ────────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: cache-first for local files, network-first for CDN ────────────────
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Skip non-GET and browser-extension requests
  if (e.request.method !== 'GET') return;
  if (!url.startsWith('http')) return;

  // Cache-first strategy for everything (good for a self-contained game)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;

      // Not in cache yet — fetch from network and store for next time
      return fetch(e.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        // Clone so we can both cache and return
        const toCache = response.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, toCache));
        return response;
      }).catch(() => {
        // Offline and not cached — return the main HTML as fallback
        return caches.match('./dodge-dash-legends.html');
      });
    })
  );
});
