/* ═════════════════════════════════════════════════════════════════
   ContentOS — Service Worker (PWA)
   Estrategias de caché: Stale-While-Revalidate para estáticos y
   Network-First con fallback offline para navegación.
   ═════════════════════════════════════════════════════════════════ */

const CACHE_NAME = 'contentos-pwa-v2';
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

  // Las notificaciones y el push nunca se sirven de caché: una bandeja
  // cacheada muestra avisos viejos como si acabaran de llegar.
  if (url.pathname.startsWith('/api/notifications') || url.pathname.startsWith('/api/push')) {
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

/* ═════════════════════════════════════════════════════════════════
   4. Notificaciones push (Fase 5)

   El sonido y la vibración los pone el SISTEMA OPERATIVO, con el tono de
   notificación que el usuario tenga configurado — igual que WhatsApp. La
   Notification API no permite enviar un tono propio en segundo plano (el
   campo `sound` quedó fuera del estándar y ningún navegador actual lo
   respeta), así que no se intenta.
   ═════════════════════════════════════════════════════════════════ */

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'ContentOS', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'ContentOS';
  const options = {
    body: payload.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    // Patrón corto: avisa sin taladrar. El sistema lo ignora si el usuario
    // tiene la vibración desactivada.
    vibrate: [200, 100, 200],
    // Colapsa avisos del mismo asunto en vez de apilar tarjetas iguales.
    tag: payload.tag || 'contentos',
    renotify: true,
    data: { url: payload.url || '/', kind: payload.kind || 'system_alert' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';

  // Si ya hay una ventana de ContentOS abierta se enfoca y se navega ahí, en
  // vez de abrir una pestaña nueva encima de la que el usuario ya tenía.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});

// El navegador puede rotar la suscripción por su cuenta. Sin este handler, el
// dispositivo deja de recibir en silencio y nadie se entera hasta que alguien
// pregunta por qué no le llegan avisos.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const res = await fetch('/api/push');
        const data = await res.json();
        if (!data.public_key) return;
        const subscription = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: data.public_key,
        });
        await fetch('/api/push', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(subscription.toJSON()),
        });
      } catch {
        // Sin sesión activa no se puede re-suscribir: la UI lo detecta y
        // vuelve a ofrecer la activación la próxima vez que abra la app.
      }
    })()
  );
});
