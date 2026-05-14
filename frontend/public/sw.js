/* Mind Matters service worker.
 *
 * Strategy:
 *   /api/*               → network-first (mutations handled by IndexedDB sync queue;
 *                          GETs fall back to last-cached response when offline).
 *   navigation (HTML)    → network-first with cache fallback (so reloads work offline).
 *   static assets        → stale-while-revalidate (fast paint, refresh in background).
 *
 * Versioning: bump CACHE_VERSION whenever the shell changes meaningfully.
 */
const CACHE_VERSION = "mm-v1";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const API_CACHE = `${CACHE_VERSION}-api`;
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const ALL_CACHES = [SHELL_CACHE, API_CACHE, STATIC_CACHE];

const SHELL_FILES = ["/", "/index.html", "/manifest.json", "/rkm-logo.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL_FILES)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => !ALL_CACHES.includes(k)).map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

const isApiRequest = (url) => url.pathname.startsWith("/api/");
const isNavigation = (req) =>
  req.mode === "navigate" ||
  (req.method === "GET" &&
    (req.headers.get("accept") || "").includes("text/html"));

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // mutations handled by syncQueue, not the SW
  const url = new URL(req.url);

  // API GETs: try network first, fall back to cached response when offline.
  if (isApiRequest(url)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Only cache 2xx responses
          if (res.ok) {
            const clone = res.clone();
            caches.open(API_CACHE).then((c) => c.put(req, clone)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req).then((m) => m || new Response(
          JSON.stringify({ offline: true, detail: "Offline — no cached response" }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        ))),
    );
    return;
  }

  // HTML navigations: network-first with cache fallback.
  if (isNavigation(req)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(req, clone)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(req).then((m) => m || caches.match("/index.html")),
        ),
    );
    return;
  }

  // Static assets (JS/CSS/images/fonts): stale-while-revalidate.
  if (
    url.origin === self.location.origin ||
    /\.(?:js|css|png|jpg|jpeg|svg|gif|webp|ico|woff2?|ttf)$/i.test(url.pathname)
  ) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const fetchPromise = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      }),
    );
  }
});
