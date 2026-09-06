// Tareas de mantenimiento compartidas entre el calendario y el cron.
import { Workspace, listAccounts, readFor, writeFor } from './accounts';
import { deleteMedia } from './media/store';
import { cancelInZernio } from './publish';
import { CalendarItem } from '@/types';

// Las piezas se eliminan solas 24 h después de su fecha programada.
const EXPIRY_MS = 24 * 60 * 60 * 1000;

export function filterExpired(items: CalendarItem[]): {
  kept: CalendarItem[];
  dropped: CalendarItem[];
  removed: number;
} {
  const cutoff = Date.now() - EXPIRY_MS;
  const kept: CalendarItem[] = [];
  const dropped: CalendarItem[] = [];
  for (const i of items) {
    const t = new Date(i.scheduled_at).getTime();
    (isNaN(t) || t >= cutoff ? kept : dropped).push(i);
  }
  return { kept, dropped, removed: dropped.length };
}

// Una pieza que se va se lleva su archivo y su post pendiente. El archivo, para
// no dejar binarios huérfanos ocupando la base de datos; el post, porque una
// pieza que ya no existe en el calendario no debería publicarse sola dos días
// después.
export async function releaseItems(ws: Workspace, items: CalendarItem[]): Promise<void> {
  for (const item of items) {
    if (item.publish?.zernio_post_id && item.publish.state !== 'publicado') {
      await cancelInZernio(ws, item);
    }
    if (item.media) await deleteMedia(item.media.key);
  }
}

export async function purgeExpiredCalendar(ws: Workspace): Promise<number> {
  const all = await readFor<CalendarItem>(ws, 'calendar_items');
  const { kept, dropped, removed } = filterExpired(all);
  if (removed > 0) {
    await writeFor(ws, 'calendar_items', kept);
    await releaseItems(ws, dropped);
  }
  return removed;
}

// El cron purga el calendario de TODAS las cuentas, no solo la activa.
export async function purgeAllAccounts(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const ws of await listAccounts()) {
    out[ws.label] = await purgeExpiredCalendar(ws);
  }
  return out;
}
