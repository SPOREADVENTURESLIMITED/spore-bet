const CACHE = "spore-bet-shell-v2";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icons/spore.svg"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("spore-bet-shell-") && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Never cache authenticated API responses, sessions, wallet balances or bet data.
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    // Only the actual app shell may populate the offline homepage fallback.
    if (url.pathname !== "/" && url.pathname !== "/index.html") {
      event.respondWith(fetch(request));
      return;
    }
    event.respondWith(fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put("/index.html", copy));
      }
      return response;
    }).catch(async () => (await caches.match("/index.html")) || Response.error()));
    return;
  }

  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (response.ok && response.type === "basic") {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(request, copy));
    }
    return response;
  })));
});
