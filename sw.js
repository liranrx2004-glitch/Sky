// Sky Shader Viewer — offline app shell cache.
// Bump this on any content change so iOS actually picks up the new
// version instead of serving the stale cached copy indefinitely.
const CACHE_NAME = 'sky-viewer-v13';

const APP_SHELL = [
  './index.html',
  './manifest.webmanifest',
  './icon-120.png',
  './icon-152.png',
  './icon-167.png',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

// Cache-first for the app shell, since this is a static tool with no
// backend — nothing here goes stale in a way that matters more than
// instant offline load.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Only ever touch this app's own files. Cross-origin calls (the Gemini API)
  // must go straight to the network — routing them through the cache logic
  // below turns a normal API error into an opaque "Load failed".
  let url;
  try { url = new URL(event.request.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Don't try to cache opaque/error responses.
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      }).catch(() => cached);
    })
  );
});
