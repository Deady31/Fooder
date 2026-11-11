// Service worker minimal : assets en cache, pages en réseau d'abord, jamais l'API ni les tuiles.
const VERSION = 'fooder-v1';
const STATIC = [/^\/stickers\//, /^\/avatars\//, /^\/logo\//, /^\/icons\//, /^\/_next\/static\//];

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (STATIC.some(re => re.test(url.pathname))) {
    event.respondWith(
      caches.open(VERSION).then(async cache => {
        const cached = await cache.match(req);
        const network = fetch(req)
          .then(res => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('/swipe')))
    );
  }
});
