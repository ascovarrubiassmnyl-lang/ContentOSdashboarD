// Suscripciones de push, por USUARIO y por dispositivo.
//
// Decisión #4 del plan de Fase 5: un teléfono pertenece a una persona, no a un
// workspace. Todo lo demás en el almacén está namespaceado por cuenta
// (`ideas__acc_123`), pero esto no puede estarlo: un usuario con tres cuentas
// y un teléfono tendría tres suscripciones al mismo endpoint y recibiría todo
// por triplicado.

import { readCollection, writeCollection } from '../db';

const KEY = 'push_subscriptions';

export interface StoredSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  user_agent: string;
  created_at: string;
}

export async function listAllSubscriptions(): Promise<StoredSubscription[]> {
  return readCollection<StoredSubscription>(KEY);
}

export async function listForUser(userId: string): Promise<StoredSubscription[]> {
  return (await listAllSubscriptions()).filter((s) => s.user_id === userId);
}

// Idempotente por endpoint: el navegador devuelve la MISMA suscripción cada
// vez que se vuelve a suscribir el mismo dispositivo. Guardar una fila nueva
// en cada visita duplicaría los avisos.
export async function saveSubscription(input: {
  userId: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent: string;
}): Promise<StoredSubscription> {
  const all = await listAllSubscriptions();
  const existing = all.find((s) => s.endpoint === input.endpoint);

  if (existing) {
    existing.user_id = input.userId;
    existing.keys = input.keys;
    existing.user_agent = input.userAgent;
    await writeCollection(KEY, all);
    return existing;
  }

  const row: StoredSubscription = {
    id: `sub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    user_id: input.userId,
    endpoint: input.endpoint,
    keys: input.keys,
    user_agent: input.userAgent,
    created_at: new Date().toISOString(),
  };
  await writeCollection(KEY, [...all, row]);
  return row;
}

export async function removeByEndpoint(endpoint: string): Promise<void> {
  const all = await listAllSubscriptions();
  await writeCollection(
    KEY,
    all.filter((s) => s.endpoint !== endpoint)
  );
}

export async function removeForUser(userId: string): Promise<number> {
  const all = await listAllSubscriptions();
  const kept = all.filter((s) => s.user_id !== userId);
  await writeCollection(KEY, kept);
  return all.length - kept.length;
}
