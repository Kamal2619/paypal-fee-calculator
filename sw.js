// Service Worker for MinimalFee™ by Minimal Creates
// Version 2.2.0 — Instant Network-First Update Engine
const CACHE_NAME = 'minimalfee-mc-v2.2.0';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css?v=2.2.0',
  './script.js?v=2.2.0',
  './manifest.json',
  './assets/mc-icon.png',
  './assets/mc-logo.png'
];

// Install Event — Cache assets and immediately activate
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activate Event — Invalidate all previous caches immediately
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event — Network-First for HTML, Scripts & Styles so updates are instantaneous
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;

  // 1. API Requests — Network first with cache fallback
  if (url.includes('api.exchangerate') || url.includes('open.er-api')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // 2. Navigation (HTML) & Core Code (JS/CSS) — Network First, falling back to cache
  if (event.request.mode === 'navigate' || url.endsWith('.html') || url.includes('.js') || url.includes('.css')) {
    event.respondWith(
      fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        }
        return networkResponse;
      }).catch(() => {
        return caches.match(event.request).then(cached => cached || caches.match('./index.html'));
      })
    );
    return;
  }

  // 3. Static Assets (Images/Icons/Fonts) — Cache first, network fallback
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        }
        return networkResponse;
      });
    })
  );
});
