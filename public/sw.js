// ============================================================
//  مسار — Service Worker (Offline-first PWA)
//  v6.0.0 — skipWaiting immediately + safe hashed-asset caching
//
//  ROOT CAUSE FIX (2026-05):
//  Previous SW (massar-v7) waited for SKIP_WAITING message before
//  activating. This left the old broken SW serving stale index.html
//  + stale JS bundle indefinitely. Fixed by calling skipWaiting()
//  immediately in install, so new SW takes control on first load.
//
//  CACHING STRATEGY CHANGE:
//  Old: cache-first for ALL .js/.css (dangerous — caches index.html
//       references that point to hashed bundles, breaking on redeploy)
//  New: cache-first ONLY for Vite-hashed assets (/assets/*-[hash].js)
//       — these are immutable (content-addressed), safe to cache forever.
//       index.html and manifest.json use network-first so they're
//       always fresh and reference the latest bundle hashes.
// ============================================================

const CACHE_NAME = 'massar-v8';
const STATIC_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap',
];

// ── Install: cache static assets + activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_URLS))
  );
  // Skip waiting immediately so this SW takes control of all clients.
  // Safe because Vite uses content-hashed filenames — stale asset
  // requests simply miss the cache and are fetched fresh from network.
  self.skipWaiting();
});

// ── Message: allow controlled activation from the main thread (compat)
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Activate: remove ALL old caches + claim all clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first for HTML/manifest, cache-first for hashed assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and Supabase API calls
  if (request.method !== 'GET') return;
  if (url.hostname.includes('supabase')) return;

  // ── Fonts (external CDN): cache-first — they never change
  if (
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  ) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ?? fetch(request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return res;
        })
      )
    );
    return;
  }

  // ── Vite hashed assets (e.g. /assets/index-B2pJEBfh.js):
  //    cache-first — content-hash guarantees immutability.
  //    Pattern: /assets/<name>-<8+chars>.<ext>
  if (
    url.pathname.match(/\/assets\/[^/]+-[A-Za-z0-9_-]{6,}\.(js|css)$/) ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|ico|woff2?)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ?? fetch(request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return res;
        })
      )
    );
    return;
  }

  // ── Everything else (index.html, manifest.json, /):
  //    Network-first — always get the latest entry point so
  //    updated bundle hashes are picked up immediately.
  event.respondWith(
    fetch(request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return res;
      })
      .catch(() => caches.match(request).then((c) => c ?? caches.match('/index.html')))
  );
});

// ── Background sync (future: sync pending ops when back online)
self.addEventListener('sync', (event) => {
  if (event.tag === 'massar-sync') {
    event.waitUntil(Promise.resolve());
  }
});
