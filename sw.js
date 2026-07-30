// Dodge Dash Legends - Service Worker
'use strict';

const CACHE_NAME = 'ddl-v1';

// Assets to cache on install (app shell)
const PRECACHE = [
  './index.html',
  './manifest.json',
  './icons/icon-48.png',
  './icons/icon-96.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
];

// Install: pre-cache the app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// Activate: delete old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first for precached assets, network-first for everything else
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response && response.status === 200) {
          const url = new URL(request.url);
          const isCacheable =
            url.origin === self.location.origin ||
            url.hostname === 'cdnjs.cloudflare.com';
          if (isCacheable) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
        }
        return response;
      });
    })
  );
});
