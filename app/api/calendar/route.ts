import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { uid } from '@/lib/db';
import { readFor, writeFor } from '@/lib/accounts';
import { requireWorkspace } from '@/lib/session';
import { seedIfNeeded } from '@/lib/mock';
import { filterExpired, releaseItems } from '@/lib/maintenance';
import { CalendarItem } from '@/types';

const itemSchema = z.object({
  title: z.string().min(2).max(160),
  format: z.enum(['reel', 'carrusel', 'historia', 'ad']),
  nivel: z.enum(['tofu', 'mofu', 'bofu']).nullable().default(null),
  scheduled_at: z.string().datetime({ offset: true }).or(z.string().datetime()),
  status: z.enum(['idea', 'en_produccion', 'listo', 'publicado']).default('idea'),
  notes: z.string().default(''),
  script_id: z.string().nullable().default(null),
  // El texto que se publica. Distinto de `notes`, que son apuntes internos y
  // nunca salen a Instagram.
  caption: z.string().max(2200).default(''),
});

// Limpieza automática (piezas con más de 24 h vencidas) en cada lectura.
export async function GET() {
  const r = await requireWorkspace();
  if ('error' in r) return r.error;
  const ws = r.ws;
  await seedIfNeeded(ws);
  const all = await readFor<CalendarItem>(ws, 'calendar_items');
  const { kept, dropped, removed } = filterExpired(all);
  if (removed > 0) {
    await writeFor(ws, 'calendar_items', kept);
    await releaseItems(ws, dropped);
  }
  const items = [...kept].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  return NextResponse.json({ items, purged: removed });
}

export async function POST(req: NextRequest) {
  const r = await requireWorkspace();
  if ('error' in r) return r.error;
  const ws = r.ws;
  await seedIfNeeded(ws);
  const parsed = itemSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const item: CalendarItem = {
    id: uid(),
    account_id: ws.id,
    ...parsed.data,
  };
  const items = await readFor<CalendarItem>(ws, 'calendar_items');
  items.push(item);
  await writeFor(ws, 'calendar_items', items);
  return NextResponse.json({ item }, { status: 201 });
}
