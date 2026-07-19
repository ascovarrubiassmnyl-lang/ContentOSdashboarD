import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { readCollection, uid, writeCollection } from '@/lib/db';
import { seedIfNeeded } from '@/lib/mock';
import { filterExpired } from '@/lib/maintenance';
import { CalendarItem } from '@/types';

const itemSchema = z.object({
  title: z.string().min(2).max(160),
  format: z.enum(['reel', 'carrusel', 'historia', 'ad']),
  nivel: z.enum(['tofu', 'mofu', 'bofu']).nullable().default(null),
  scheduled_at: z.string().datetime({ offset: true }).or(z.string().datetime()),
  status: z.enum(['idea', 'en_produccion', 'listo', 'publicado']).default('idea'),
  notes: z.string().default(''),
  script_id: z.string().nullable().default(null),
});

// Limpieza automática (piezas con más de 24 h vencidas) en cada lectura.
export async function GET() {
  await seedIfNeeded();
  const all = await readCollection<CalendarItem>('calendar_items');
  const { kept, removed } = filterExpired(all);
  if (removed > 0) await writeCollection('calendar_items', kept);
  const items = [...kept].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  return NextResponse.json({ items, purged: removed });
}

export async function POST(req: NextRequest) {
  await seedIfNeeded();
  const parsed = itemSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const item: CalendarItem = {
    id: uid(),
    account_id: 'acc_scav86',
    ...parsed.data,
  };
  const items = await readCollection<CalendarItem>('calendar_items');
  items.push(item);
  await writeCollection('calendar_items', items);
  return NextResponse.json({ item }, { status: 201 });
}
