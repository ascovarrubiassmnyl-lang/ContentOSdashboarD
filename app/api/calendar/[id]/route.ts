import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { activeWorkspace, readFor, writeFor } from '@/lib/accounts';
import { CalendarItem } from '@/types';

type Ctx = { params: Promise<{ id: string }> };

// Todos los campos opcionales — es un patch parcial. Campos desconocidos
// se descartan (strip) para que nadie inyecte llaves arbitrarias.
const patchSchema = z
  .object({
    title: z.string().min(2).max(160),
    format: z.enum(['reel', 'carrusel', 'historia', 'ad']),
    nivel: z.enum(['tofu', 'mofu', 'bofu']).nullable(),
    scheduled_at: z.string().datetime({ offset: true }).or(z.string().datetime()),
    status: z.enum(['idea', 'en_produccion', 'listo', 'publicado']),
    notes: z.string().max(2000),
    script_id: z.string().nullable(),
  })
  .partial();

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const ws = await activeWorkspace();
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const items = await readFor<CalendarItem>(ws, 'calendar_items');
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
  items[idx] = { ...items[idx], ...parsed.data, id };
  await writeFor(ws, 'calendar_items', items);
  return NextResponse.json({ item: items[idx] });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const ws = await activeWorkspace();
  const items = await readFor<CalendarItem>(ws, 'calendar_items');
  await writeFor(
    ws,
    'calendar_items',
    items.filter((i) => i.id !== id)
  );
  return NextResponse.json({ ok: true });
}
