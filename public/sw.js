/**
 * Focube service worker — cache-first for static assets.
 *
 * Installs immediately, activates immediately, and serves the app shell from
 * cache so Focube works offline once visited.
 */

const CACHE = "focube-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => {
      return cache.addAll(["/", "/favicon.svg", "/manifest.json"]);
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Only handle GET requests.
  if (event.request.method !== "GET") return;

  // Skip non-HTTP(S) and browser-extension requests.
  const { protocol } = new URL(event.request.url);
  if (!["http:", "https:"].includes(protocol)) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      // Return cached response if available, otherwise fetch from network.
      const fetched = fetch(event.request)
        .then((response) => {
          // Cache a copy of successful responses for next time.
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || fetched;
    }),
  );
});
