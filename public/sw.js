/* Bi-bi XLSX Lite — Service Worker (PWA)
 * Стратегия:
 *  - /api/* → только сеть (auth/файлы пользователя не кэшируем)
 *  - навигация → сеть, при офлайне — кэшированный index.html (оболочка)
 *  - статика same-origin GET → cache-first с фоновым обновлением
 */

const CACHE_NAME = 'xlsx-lite-v2';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // API и внешние хосты — только сеть, без кэша
  if (url.pathname.startsWith('/api/') || url.origin !== self.location.origin) {
    event.respondWith(fetch(request));
    return;
  }

  // Навигация (переходы/перезагрузка) — сеть, при офлайне отдаём оболочку
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match('/index.html').then((cached) => cached || caches.match('/')),
        ),
    );
    return;
  }

  // Остальная статика — cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        // Тихо обновляем кэш в фоне
        fetch(request)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
            }
          })
          .catch(() => {});
        return cached;
      }
      return fetch(request).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return res;
      });
    }),
  );
});
