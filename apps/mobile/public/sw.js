// DuoOrb Service Worker (v1.0.0)
// Lightweight network-first service worker satisfying PWA installability criteria
// without caching API calls or dynamic multiplayer websocket traffic.

const CACHE_NAME = 'duoorb-shell-v2';
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/css/style.css',
  '/duoorb_analyzer.wasm',
  '/models/quoridor_9x9.onnx',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// Network-first fetch handler for static shell; bypass for API and socket
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bypass service worker for non-GET, API, socket, or cross-origin requests
  if (
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/socket.io') ||
    url.origin !== self.location.origin
  ) {
    return;
  }

  // Network-first strategy: always fetch fresh from network, fallback to cache if offline
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
