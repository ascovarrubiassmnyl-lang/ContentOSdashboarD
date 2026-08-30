/* ═════════════════════════════════════════════════════════════════
   ContentOS — Service Worker (PWA)
   Estrategias de caché: Stale-While-Revalidate para estáticos y
   Network-First con fallback offline para navegación.
   ═════════════════════════════════════════════════════════════════ */

const CACHE_NAME = 'contentos-pwa-v1';
const OFFLINE_FALLBACK = '/offline';

const PRECACHE_ASSETS = [
  OFFLINE_FALLBACK,
  '/',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/favicon.ico',
];

// ── 1. Instalación: precache del shell base ─────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// ── 2. Activación: limpieza de cachés anteriores ────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── 3. Intercepción de Peticiones (Fetch) ───────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo interceptar peticiones GET dentro de nuestro mismo origen
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // Ignorar peticiones de autenticación para preservar seguridad de cookies
  if (url.pathname.startsWith('/api/auth')) {
    return;
  }

  // A. Peticiones de Navegación (Páginas HTML): Network-First con fallback offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // Si no está en caché, servir la página offline
          const offlineFallback = await caches.match(OFFLINE_FALLBACK);
          return offlineFallback || new Response('Offline', { status: 503, statusText: 'Offline' });
        })
    );
    return;
  }

  // B. Assets estáticos (_next/static, fuentes, iconos, css): Stale-While-Revalidate
  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|ico|woff2?|css|js)$/);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // C. APIs y datos de la app: Network-First con fallback a caché
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(request))
    );
    return;
  }
});
