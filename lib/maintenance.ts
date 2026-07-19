// Tareas de mantenimiento compartidas entre el calendario y el cron.
import { readCollection, writeCollection } from './db';
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

export async function purgeExpiredCalendar(): Promise<number> {
  const all = await readCollection<CalendarItem>('calendar_items');
  const { kept, removed } = filterExpired(all);
  if (removed > 0) await writeCollection('calendar_items', kept);
  return removed;
}
