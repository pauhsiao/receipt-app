const CACHE = 'receipt-v4';
const PRECACHE = ['/', '/index.html', '/app.js', '/config.js', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Only intercept same-origin GET requests (avoids cross-origin CORS issues and POST body problems)
  if (e.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Don't cache API routes — always hit network
  if (url.pathname.startsWith('/api/')) return;

  // Stale-while-revalidate: serve from cache instantly, refresh in background
  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(e.request).then(cached => {
        const fresh = fetch(e.request).then(res => {
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        }).catch(() => cached);
        return cached || fresh;
      })
    )
  );
});
