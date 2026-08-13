// Tareas de mantenimiento compartidas entre el calendario y el cron.
import { Workspace, listAccounts, readFor, writeFor } from './accounts';
import { CalendarItem } from '@/types';

// Las piezas se eliminan solas 24 h después de su fecha programada.
const EXPIRY_MS = 24 * 60 * 60 * 1000;

export function filterExpired(items: CalendarItem[]): {
  kept: CalendarItem[];
  removed: number;
} {
  const cutoff = Date.now() - EXPIRY_MS;
  const kept = items.filter((i) => {
    const t = new Date(i.scheduled_at).getTime();
    return isNaN(t) || t >= cutoff;
  });
  return { kept, removed: items.length - kept.length };
}

export async function purgeExpiredCalendar(ws: Workspace): Promise<number> {
  const all = await readFor<CalendarItem>(ws, 'calendar_items');
  const { kept, removed } = filterExpired(all);
  if (removed > 0) await writeFor(ws, 'calendar_items', kept);
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
