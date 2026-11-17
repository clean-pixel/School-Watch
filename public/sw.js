const CACHE = "schulwatch-static-v1";
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(["/", "/manifest.webmanifest"])).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  // Never cache private routes, API payloads, authenticated HTML, or messages.
  if (url.pathname.startsWith("/dashboard") || url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;
  if (request.destination === "document") {
    event.respondWith(fetch(request).catch(async () => (await caches.match("/")) || Response.error()));
    return;
  }
  if (request.destination === "style" || request.destination === "script" || request.destination === "image") {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
  }
});
