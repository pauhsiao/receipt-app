const CACHE = 'receipt-v8';
const PRECACHE = [
  '/',
  '/index.html',
  '/app.js',
  '/config.js',
  '/manifest.json',
  '/icons/pikachu.png',
  '/icons/icon-192.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
];

const SHELL = new Set(['/', '/index.html', '/app.js', '/config.js', '/manifest.json']);

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
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Skip Supabase API calls and Vercel functions
  if (url.pathname.startsWith('/api/')) return;
  if (url.hostname.endsWith('supabase.co')) return;

  // Cache-first: app shell + CDN scripts + icons
  const isShell = url.origin === self.location.origin && (SHELL.has(url.pathname) || url.pathname.startsWith('/icons/'));
  const isCdn = url.hostname === 'cdn.jsdelivr.net';

  if (isShell || isCdn) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        });
      })
    );
    return;
  }

  // Network-first for everything else
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
