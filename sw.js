// ═══════════════════════════════════════════════════════════
//  DODGE DASH LEGENDS — Service Worker
//  Cache-first for assets, network-first for navigation.
//  Falls back to offline.html when network is unavailable.
// ═══════════════════════════════════════════════════════════

const CACHE_NAME = 'ddl-v1';
const OFFLINE_URL = '/Dodge-Dash-Legends/offline.html';

// All files to pre-cache on install
const PRECACHE_URLS = [
  '/Dodge-Dash-Legends/',
  '/Dodge-Dash-Legends/index.html',
  '/Dodge-Dash-Legends/offline.html',
  '/Dodge-Dash-Legends/manifest.json',
  '/Dodge-Dash-Legends/style.css',
  '/Dodge-Dash-Legends/script.js',
  '/Dodge-Dash-Legends/icons/icon-192.png',
  '/Dodge-Dash-Legends/icons/icon-512.png',
  '/Dodge-Dash-Legends/icons/apple-touch-icon.png',
  '/Dodge-Dash-Legends/icons/favicon.ico',
];

// ── Install: pre-cache all listed assets ──────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: delete old caches, claim clients ────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: strategy depends on request type ───────────────
self.addEventListener('fetch', event => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests (e.g. Three.js CDN)
  // — let the browser handle those normally
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigation requests: network-first, offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache a fresh copy of the page on successful fetch
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.match(request).then(cached =>
            cached || caches.match(OFFLINE_URL)
          )
        )
    );
    return;
  }

  // Static assets: cache-first, fall back to network then cache new copy
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request).then(response => {
        // Only cache successful same-origin responses
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return response;
      }).catch(() => {
        // Last resort: return offline page for HTML requests
        if (request.headers.get('Accept') && request.headers.get('Accept').includes('text/html')) {
          return caches.match(OFFLINE_URL);
        }
      });
    })
  );
});

// ── Message: allow page to trigger cache updates ──────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
