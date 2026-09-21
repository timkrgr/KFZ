const CACHE_VERSION = "v42";
const CACHE_NAME = `kfz-karteikarten-${CACHE_VERSION}`;

const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css?v=42",
  "./app.js?v=42",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/logo-round.png",
  "./icons/avatar-tim.jpg",
  "./icons/avatar-huseyn.jpg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Netzwerk zuerst: bei jedem Öffnen online werden frische Dateien geladen.
// cache: "no-store" umgeht auch den normalen HTTP-Cache des Browsers, nicht
// nur unseren eigenen Cache Storage. Der Cache dient nur als Offline-Fallback.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const freshRequest = new Request(event.request, { cache: "no-store" });

  event.respondWith(
    fetch(freshRequest)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
