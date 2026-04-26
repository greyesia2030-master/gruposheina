const CACHE_NAME = 'foodsync-v1';
const SHELL_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/offline'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Solo cachear same-origin
  if (url.origin !== self.location.origin) return;

  // Network-first para API y data fetches de Next
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/data/')) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Stale-while-revalidate para documents, scripts, styles, images, fonts
  if (
    request.destination === 'document' ||
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font'
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((resp) => {
            if (resp && resp.ok && resp.type === 'basic') {
              const clone = resp.clone();
              caches.open(CACHE_NAME).then((c) => c.put(request, clone));
            }
            return resp;
          })
          .catch(() => cached || caches.match('/offline'));
        return cached || fetchPromise;
      })
    );
  }
});

// Placeholder para C.1.3 — push notifications
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Grupo Sheina';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: data.url ? { url: data.url } : {}
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(self.clients.openWindow(url));
});
