// Historial de notificaciones (por cuenta) y preferencias (por usuario).
//
// El historial es de la CUENTA porque "faltan 2 h para el reel" es un hecho de
// esa cuenta y debe morir con ella (está en SCOPED_COLLECTIONS). Las
// preferencias son del USUARIO porque describen su teléfono y sus horarios.

import { Workspace, readFor, writeFor } from '../accounts';
import { readSingleton, uid, writeSingleton } from '../db';
import {
  AppNotification,
  DEFAULT_PREFERENCES,
  NotificationKind,
  NotificationPreferences,
} from './types';

// Tope por cuenta: el historial es una bandeja, no un log de auditoría.
export const MAX_NOTIFICATIONS = 200;

const PREFS_KEY = 'notification_preferences';

export async function listNotifications(ws: Workspace): Promise<AppNotification[]> {
  return (await readFor<AppNotification>(ws, 'notifications')).sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  );
}

export async function countUnread(ws: Workspace): Promise<number> {
  return (await readFor<AppNotification>(ws, 'notifications')).filter((n) => !n.read_at).length;
}

export async function hasDedupeKey(ws: Workspace, key: string): Promise<boolean> {
  return (await readFor<AppNotification>(ws, 'notifications')).some((n) => n.dedupe_key === key);
}

export async function createNotification(
  ws: Workspace,
  input: { kind: NotificationKind; title: string; body: string; url: string; dedupeKey: string }
): Promise<AppNotification> {
  const rows = await readFor<AppNotification>(ws, 'notifications');
  const notification: AppNotification = {
    id: uid(),
    account_id: ws.id,
    kind: input.kind,
    title: input.title,
    body: input.body,
    url: input.url,
    dedupe_key: input.dedupeKey,
    created_at: new Date().toISOString(),
    read_at: null,
  };
  const next = [notification, ...rows]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, MAX_NOTIFICATIONS);
  await writeFor(ws, 'notifications', next);
  return notification;
}

export async function markRead(ws: Workspace, ids?: string[]): Promise<number> {
  const rows = await readFor<AppNotification>(ws, 'notifications');
  const now = new Date().toISOString();
  let changed = 0;
  for (const row of rows) {
    if (row.read_at) continue;
    if (ids && !ids.includes(row.id)) continue;
    row.read_at = now;
    changed++;
  }
  if (changed > 0) await writeFor(ws, 'notifications', rows);
  return changed;
}

// ── Preferencias ─────────────────────────────────────────────
type PrefsMap = Record<string, NotificationPreferences>;

export async function getPreferences(userId: string): Promise<NotificationPreferences> {
  const all = (await readSingleton<PrefsMap>(PREFS_KEY)) ?? {};
  return all[userId] ?? { user_id: userId, ...DEFAULT_PREFERENCES };
}

export async function setPreferences(
  userId: string,
  patch: Partial<Omit<NotificationPreferences, 'user_id' | 'kinds'>> & {
    // Se aceptan tipos sueltos: el formulario puede cambiar solo uno.
    kinds?: Partial<Record<NotificationKind, boolean>>;
  }
): Promise<NotificationPreferences> {
  const all = (await readSingleton<PrefsMap>(PREFS_KEY)) ?? {};
  const current = all[userId] ?? { user_id: userId, ...DEFAULT_PREFERENCES };
  const next: NotificationPreferences = {
    ...current,
    ...patch,
    kinds: { ...current.kinds, ...(patch.kinds ?? {}) },
    user_id: userId,
  };
  all[userId] = next;
  await writeSingleton(PREFS_KEY, all);
  return next;
}
