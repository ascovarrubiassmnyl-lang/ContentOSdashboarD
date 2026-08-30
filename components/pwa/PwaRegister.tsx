'use client';

import { useEffect } from 'react';

export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const registerWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        // Detectar si hay una nueva versión del service worker esperando
        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.addEventListener('statechange', () => {
              if (
                installingWorker.state === 'installed' &&
                navigator.serviceWorker.controller
              ) {
                console.log('[PWA] Nueva versión de ContentOS disponible.');
              }
            });
          }
        });
      } catch (error) {
        console.warn('[PWA] Error al registrar el Service Worker:', error);
      }
    };

    if (document.readyState === 'complete') {
      registerWorker();
    } else {
      window.addEventListener('load', registerWorker);
      return () => window.removeEventListener('load', registerWorker);
    }
  }, []);

  return null;
}
