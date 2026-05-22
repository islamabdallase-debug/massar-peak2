// ============================================================
//  مسار — Service Worker (Offline-first PWA)
//  v5.0.0 — Cache + IndexedDB sync strategy
// ============================================================

const CACHE_NAME = 'massar-v6';
const STATIC_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap',
];

// ── Install: cache static assets (no skipWaiting — user controls update timing)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_URLS))
  );
  // Do NOT call self.skipWaiting() here — prevents disruptive mid-session updates.
  // The main thread sends 'SKIP_WAITING' when it is safe to activate.
});

// ── Message: allow controlled activation from the main thread
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Activate: remove old caches
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

// ── Fetch: network-first for API, cache-first for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and Supabase API calls
  if (request.method !== 'GET') return;
  if (url.hostname.includes('supabase')) return;

  // Cache-first for static assets (JS/CSS/fonts/images)
  if (
    url.pathname.match(/\.(js|css|png|jpg|svg|woff2?)$/) ||
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

  // Network-first for HTML (app shell)
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

// ── Background sync (future: sync pending ops)
self.addEventListener('sync', (event) => {
  if (event.tag === 'massar-sync') {
    event.waitUntil(Promise.resolve()); // placeholder for sync logic
  }
});
