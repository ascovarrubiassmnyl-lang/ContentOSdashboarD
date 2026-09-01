// Envío de push. Nunca lanza por un dispositivo caído: un teléfono que
// desinstaló la PWA no puede impedir que el resto reciba su aviso.

import { ensureConfigured, isPushConfigured } from './vapid';
import { listForUser, removeByEndpoint } from './subscriptions';

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
  kind: string;
}

export interface PushResult {
  sent: number;
  removed: number;
  failed: number;
  skipped_reason?: string;
}

export async function sendToUser(userId: string, payload: PushPayload): Promise<PushResult> {
  if (!isPushConfigured()) {
    return { sent: 0, removed: 0, failed: 0, skipped_reason: 'sin claves VAPID' };
  }

  const subs = await listForUser(userId);
  if (subs.length === 0) {
    return { sent: 0, removed: 0, failed: 0, skipped_reason: 'el usuario no tiene dispositivos' };
  }

  const webpush = ensureConfigured();
  let sent = 0;
  let removed = 0;
  let failed = 0;

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        JSON.stringify(payload),
        { TTL: 60 * 60 * 12 }
      );
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      // 404/410 = el push service dice que ese endpoint ya no existe. Es
      // definitivo: conservarlo hace que cada envío futuro tarde más y falle
      // más, hasta que nadie sabe si el push funciona.
      if (status === 404 || status === 410) {
        await removeByEndpoint(sub.endpoint);
        removed++;
      } else {
        failed++;
      }
    }
  }

  return { sent, removed, failed };
}
