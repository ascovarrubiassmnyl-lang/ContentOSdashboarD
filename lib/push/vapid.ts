// Claves VAPID del servidor. Se generan una vez con:
//   npx web-push generate-vapid-keys
// y se ponen en VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT.
//
// Sin ellas el push simplemente no existe: la app arranca igual, el historial
// de notificaciones funciona y la UI explica qué falta. Es la misma
// degradación elegante que el resto del sistema (sin IA → plantillas, sin
// Zernio → demo, sin AUTH_SECRET → app abierta).

import webpush from 'web-push';

let configured = false;

export function isPushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function publicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

// Perezoso a propósito: configurar en el import haría que un despliegue sin
// claves fallara al cargar el módulo, en vez de al intentar enviar.
export function ensureConfigured(): typeof webpush {
  if (!isPushConfigured()) {
    throw new Error(
      'Faltan las claves VAPID en el servidor (VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY). Genéralas con "npx web-push generate-vapid-keys" y añádelas a las variables de entorno.'
    );
  }
  if (!configured) {
    webpush.setVapidDetails(
      // El subject debe ser un mailto: o una URL; los push services rechazan
      // otra cosa.
      process.env.VAPID_SUBJECT || 'mailto:soporte@contentos.app',
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );
    configured = true;
  }
  return webpush;
}
