// Service Worker for School Attendance PWA
const CACHE_NAME = "attendance-pwa-v3";
const RUNTIME_CACHE = "attendance-runtime-v2";
const ASSETS = [
  "/",
  "/login",
  "/student",
  "/offline",
  "/manifest.json",
  "/smdlogo.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== RUNTIME_CACHE) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const { request } = e;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (request.mode === "navigate") {
    e.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return cache.match(request) || cache.match("/offline") || cache.match("/");
      })
    );
    return;
  }

  if (isSameOrigin && ["style", "script", "image", "font", "document"].includes(request.destination)) {
    e.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) return cachedResponse;

        try {
          const networkResponse = await fetch(request);
          cache.put(request, networkResponse.clone());
          return networkResponse;
        } catch (error) {
          const fallback = await caches.match(request);
          return fallback || caches.match("/offline") || Response.error();
        }
      })
    );
    return;
  }

  e.respondWith(
    fetch(request).catch(async () => {
      return (await caches.match(request)) || (await caches.match("/offline")) || Response.error();
    })
  );
});
