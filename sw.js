/**
 * Dodge Dash Legends — Service Worker
 * Handles: offline caching, cache versioning, push notifications,
 * background sync, update notifications, and periodic background sync.
 */

'use strict';

// ─────────────────────────────────────────────────────────────
//  CACHE CONFIG
// ─────────────────────────────────────────────────────────────
const APP_VERSION   = 'v1.0.0';
const CACHE_STATIC  = `ddl-static-${APP_VERSION}`;
const CACHE_RUNTIME = `ddl-runtime-${APP_VERSION}`;
const CACHE_IMAGES  = `ddl-images-${APP_VERSION}`;

// All caches owned by this SW — any cache NOT in this list gets deleted on activate
const ALL_CACHES = [CACHE_STATIC, CACHE_RUNTIME, CACHE_IMAGES];

// Core app shell — cached on install, always served from cache first
const PRECACHE_URLS = [
  './dodge-dash-legends.html',
  './manifest.json',
  './sw.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
];

// CDN resources to cache at runtime on first fetch
const CDN_ORIGINS = [
  'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net',
  'unpkg.com',
];

// Offline fallback page (inlined, no extra file needed)
const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<meta name="theme-color" content="#7c4dff">
<title>Dodge Dash Legends — Offline</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#0a0a0f;color:#fff;font-family:'Segoe UI',Arial,sans-serif;
       display:flex;flex-direction:column;align-items:center;justify-content:center;
       min-height:100vh;padding:24px;text-align:center;}
  .icon{font-size:72px;margin-bottom:16px;animation:spin 4s linear infinite}
  @keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
  h1{font-size:28px;font-weight:900;letter-spacing:2px;
     background:linear-gradient(135deg,#00e5ff,#7c4dff,#ff6d00);
     -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
     margin-bottom:8px}
  p{color:#888;font-size:15px;margin-bottom:32px;line-height:1.6;max-width:320px}
  button{background:linear-gradient(135deg,#7c4dff,#e040fb);border:none;
         border-radius:12px;color:#fff;padding:14px 32px;font-size:15px;
         font-weight:800;letter-spacing:1.5px;cursor:pointer;
         text-transform:uppercase;width:100%;max-width:280px}
  .tip{margin-top:20px;font-size:12px;color:#444;line-height:1.6}
</style>
</head>
<body>
  <div class="icon">🏎️</div>
  <h1>YOU'RE OFFLINE</h1>
  <p>No connection detected. Once the game has loaded once, it works fully offline!</p>
  <button onclick="location.reload()">🔄 TRY AGAIN</button>
  <p class="tip">Tip: Open the game while connected once to cache it for offline play.</p>
</body>
</html>`;

// ─────────────────────────────────────────────────────────────
//  INSTALL — pre-cache app shell
// ─────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_STATIC);

      // Cache each URL individually so one failure doesn't abort the install
      const results = await Promise.allSettled(
        PRECACHE_URLS.map(url =>
          cache.add(url).catch(err => {
            console.warn(`[SW] Pre-cache skipped (not found yet): ${url}`, err.message);
          })
        )
      );

      // Store the offline fallback page directly
      await cache.put(
        new Request('/__offline__'),
        new Response(OFFLINE_HTML, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        })
      );

      console.log(`[SW] Install complete — ${APP_VERSION}`);

      // Skip waiting: activate immediately without waiting for old tabs to close
      await self.skipWaiting();
    })()
  );
});

// ─────────────────────────────────────────────────────────────
//  ACTIVATE — clean up old caches, claim all clients
// ─────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      // Remove caches from old versions
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(key => !ALL_CACHES.includes(key))
          .map(key => {
            console.log(`[SW] Deleting old cache: ${key}`);
            return caches.delete(key);
          })
      );

      // Take control of all open tabs immediately
      await self.clients.claim();

      // Notify all open clients that a new version is active
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(client =>
        client.postMessage({ type: 'SW_UPDATED', version: APP_VERSION })
      );

      console.log(`[SW] Activated — ${APP_VERSION}, controlling ${clients.length} client(s)`);
    })()
  );
});

// ─────────────────────────────────────────────────────────────
//  FETCH — caching strategies
// ─────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and non-http(s) requests
  if (!url.protocol.startsWith('http')) return;

  // ── Strategy 1: Cache-first for pre-cached app shell ──────
  if (isAppShell(url)) {
    event.respondWith(cacheFirst(request, CACHE_STATIC));
    return;
  }

  // ── Strategy 2: Cache-first for icons and images ──────────
  if (isImage(url)) {
    event.respondWith(cacheFirst(request, CACHE_IMAGES));
    return;
  }

  // ── Strategy 3: Stale-while-revalidate for CDN scripts ────
  if (isCDN(url)) {
    event.respondWith(staleWhileRevalidate(request, CACHE_RUNTIME));
    return;
  }

  // ── Strategy 4: Network-first for same-origin pages ───────
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request, CACHE_RUNTIME));
    return;
  }

  // ── Strategy 5: Network-only for everything else ──────────
  event.respondWith(networkOnly(request));
});

// ─────────────────────────────────────────────────────────────
//  URL CLASSIFIERS
// ─────────────────────────────────────────────────────────────
function isAppShell(url) {
  return PRECACHE_URLS.some(p => url.href.includes(p.replace('./', ''))) ||
         url.pathname === '/' ||
         url.pathname.endsWith('.html');
}

function isImage(url) {
  return /\.(png|jpg|jpeg|gif|webp|svg|ico)(\?.*)?$/i.test(url.pathname);
}

function isCDN(url) {
  return CDN_ORIGINS.some(origin => url.hostname.includes(origin));
}

// ─────────────────────────────────────────────────────────────
//  CACHING STRATEGIES
// ─────────────────────────────────────────────────────────────

/** Cache-first: serve from cache, fall back to network, store result */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetchWithTimeout(request, 8000);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return offlineFallback(request);
  }
}

/** Network-first: try network, fall back to cache, then offline page */
async function networkFirst(request, cacheName) {
  try {
    const response = await fetchWithTimeout(request, 5000);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return offlineFallback(request);
  }
}

/** Stale-while-revalidate: serve cached immediately, update cache in background */
async function staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetchWithTimeout(request, 10000)
    .then(response => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  return cached || await fetchPromise || offlineFallback(request);
}

/** Network-only: no caching */
async function networkOnly(request) {
  try {
    return await fetchWithTimeout(request, 8000);
  } catch {
    return offlineFallback(request);
  }
}

/** Fetch with a configurable timeout */
function fetchWithTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Fetch timeout')), ms);
    fetch(request)
      .then(r => { clearTimeout(timer); resolve(r); })
      .catch(e => { clearTimeout(timer); reject(e); });
  });
}

/** Returns the offline fallback — HTML page for navigation, 503 for assets */
async function offlineFallback(request) {
  if (request.destination === 'document' || request.mode === 'navigate') {
    const fallback = await caches.match('/__offline__');
    return fallback || new Response(OFFLINE_HTML, {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
  // For images return a transparent 1×1 PNG
  if (request.destination === 'image') {
    return new Response(
      // 1×1 transparent PNG (base64-decoded)
      Uint8Array.from(atob(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      ), c => c.charCodeAt(0)),
      { status: 200, headers: { 'Content-Type': 'image/png' } }
    );
  }
  return new Response('', { status: 503, statusText: 'Service Unavailable' });
}

// ─────────────────────────────────────────────────────────────
//  PUSH NOTIFICATIONS
// ─────────────────────────────────────────────────────────────
self.addEventListener('push', event => {
  let data = {
    title:   'Dodge Dash Legends',
    body:    'A new challenge awaits! Tap to race.',
    icon:    './icons/icon-192.png',
    badge:   './icons/icon-96.png',
    tag:     'ddl-notification',
    renotify: false,
    silent:  false,
    data:    { url: './dodge-dash-legends.html' },
  };

  // Parse payload if the push event carries JSON data
  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch {
      data.body = event.data.text() || data.body;
    }
  }

  const options = {
    body:      data.body,
    icon:      data.icon,
    badge:     data.badge,
    tag:       data.tag,
    renotify:  data.renotify,
    silent:    data.silent,
    vibrate:   [100, 50, 100, 50, 200],
    timestamp: Date.now(),
    requireInteraction: false,
    actions: [
      { action: 'race',  title: '🏁 Race Now',  icon: './icons/icon-96.png' },
      { action: 'close', title: '✕ Dismiss' },
    ],
    data: data.data,
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ─────────────────────────────────────────────────────────────
//  NOTIFICATION CLICK
// ─────────────────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'close') return;

  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : './dodge-dash-legends.html';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        // Focus existing window if open
        for (const client of clients) {
          if (client.url.includes('dodge-dash-legends') && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

// ─────────────────────────────────────────────────────────────
//  NOTIFICATION CLOSE (dismissed without clicking)
// ─────────────────────────────────────────────────────────────
self.addEventListener('notificationclose', event => {
  // Could send analytics here if needed
  console.log('[SW] Notification dismissed:', event.notification.tag);
});

// ─────────────────────────────────────────────────────────────
//  BACKGROUND SYNC — retry failed operations when back online
// ─────────────────────────────────────────────────────────────
self.addEventListener('sync', event => {
  console.log('[SW] Background sync triggered:', event.tag);

  if (event.tag === 'ddl-save-sync') {
    // Retry saving game progress to any remote backend
    event.waitUntil(syncGameSave());
  }

  if (event.tag === 'ddl-score-submit') {
    event.waitUntil(syncScoreSubmit());
  }
});

async function syncGameSave() {
  try {
    const db = await openSyncDB();
    const pending = await db.getAll('pending-saves');
    for (const save of pending) {
      // POST save data when a backend URL is configured
      // await fetch('/api/save', { method: 'POST', body: JSON.stringify(save) });
      await db.delete('pending-saves', save.id);
    }
    console.log('[SW] Game save sync complete.');
  } catch (err) {
    console.warn('[SW] syncGameSave failed, will retry:', err);
    throw err; // Re-throw to keep the sync retry alive
  }
}

async function syncScoreSubmit() {
  try {
    console.log('[SW] Score submit sync complete (no backend configured).');
  } catch (err) {
    console.warn('[SW] syncScoreSubmit failed:', err);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
//  PERIODIC BACKGROUND SYNC — check for app updates
// ─────────────────────────────────────────────────────────────
self.addEventListener('periodicsync', event => {
  if (event.tag === 'ddl-update-check') {
    event.waitUntil(checkForAppUpdate());
  }
});

async function checkForAppUpdate() {
  try {
    // Fetch the main page with cache-busting to detect a new version
    const response = await fetch('./dodge-dash-legends.html?_cb=' + Date.now(), {
      cache: 'no-store',
    });
    if (!response.ok) return;

    const cache    = await caches.open(CACHE_STATIC);
    const existing = await cache.match('./dodge-dash-legends.html');

    if (!existing) {
      // Nothing cached yet — just cache it
      await cache.put('./dodge-dash-legends.html', response);
      return;
    }

    const newText = await response.text();
    const oldText = await existing.clone().text();

    if (newText !== oldText) {
      // New version detected — cache it and notify all clients
      await cache.put(
        './dodge-dash-legends.html',
        new Response(newText, { headers: response.headers })
      );

      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(client =>
        client.postMessage({ type: 'UPDATE_AVAILABLE', version: APP_VERSION })
      );

      // Show a notification if permitted
      if (self.registration.showNotification) {
        await self.registration.showNotification('Dodge Dash Legends', {
          body:    'A new version is ready! Refresh to get the latest race features.',
          icon:    './icons/icon-192.png',
          badge:   './icons/icon-96.png',
          tag:     'ddl-update',
          silent:  true,
          data:    { url: './dodge-dash-legends.html', type: 'update' },
        });
      }
    }
  } catch (err) {
    console.warn('[SW] Update check failed:', err);
  }
}

// ─────────────────────────────────────────────────────────────
//  MESSAGE HANDLER — communication from the main page
// ─────────────────────────────────────────────────────────────
self.addEventListener('message', event => {
  const { type, payload } = event.data || {};

  switch (type) {

    // Page requests the SW to skip waiting and activate immediately
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    // Page asks for the current SW version
    case 'GET_VERSION':
      event.source.postMessage({ type: 'SW_VERSION', version: APP_VERSION });
      break;

    // Page asks to clear all caches (e.g. after a forced update)
    case 'CLEAR_CACHES':
      event.waitUntil(
        caches.keys().then(keys =>
          Promise.all(keys.map(k => caches.delete(k)))
        ).then(() => {
          event.source.postMessage({ type: 'CACHES_CLEARED' });
        })
      );
      break;

    // Page queues a save for background sync
    case 'QUEUE_SAVE':
      if (payload) {
        event.waitUntil(
          openSyncDB().then(db => db.put('pending-saves', {
            id: Date.now(),
            data: payload,
          }))
        );
      }
      break;

    default:
      break;
  }
});

// ─────────────────────────────────────────────────────────────
//  SIMPLE INDEXEDDB HELPER (no external lib)
// ─────────────────────────────────────────────────────────────
function openSyncDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('ddl-sync-db', 1);

    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('pending-saves')) {
        db.createObjectStore('pending-saves', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('pending-scores')) {
        db.createObjectStore('pending-scores', { keyPath: 'id' });
      }
    };

    req.onsuccess = e => {
      const db = e.target.result;

      // Minimal wrapper so callers can use await db.getAll() / db.put() / db.delete()
      resolve({
        getAll(storeName) {
          return new Promise((res, rej) => {
            const tx  = db.transaction(storeName, 'readonly');
            const req = tx.objectStore(storeName).getAll();
            req.onsuccess = () => res(req.result);
            req.onerror   = () => rej(req.error);
          });
        },
        put(storeName, value) {
          return new Promise((res, rej) => {
            const tx  = db.transaction(storeName, 'readwrite');
            const req = tx.objectStore(storeName).put(value);
            req.onsuccess = () => res(req.result);
            req.onerror   = () => rej(req.error);
          });
        },
        delete(storeName, key) {
          return new Promise((res, rej) => {
            const tx  = db.transaction(storeName, 'readwrite');
            const req = tx.objectStore(storeName).delete(key);
            req.onsuccess = () => res();
            req.onerror   = () => rej(req.error);
          });
        },
      });
    };

    req.onerror = () => reject(req.error);
  });
}
