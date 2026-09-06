import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { readFor, writeFor } from '@/lib/accounts';
import { requireWorkspace } from '@/lib/session';
import { deleteMedia } from '@/lib/media/store';
import { advanceItem, cancelInZernio, isWithinPushWindow } from '@/lib/publish';
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
    caption: z.string().max(2200),
  })
  .partial();

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const r = await requireWorkspace();
  if ('error' in r) return r.error;
  const ws = r.ws;
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
  const before = items[idx];
  items[idx] = { ...before, ...parsed.data, id };
  const after = items[idx];

  // Un post ya creado en Zernio guarda una copia de la hora y del texto. Si
  // aquí cambia cualquiera de los dos, ese post ya no representa a esta pieza:
  // se cancela y se vuelve a crear con lo nuevo. Editar el post existente
  // (PUT /v1/posts) haría lo mismo con más estados a medias.
  const changed =
    before.scheduled_at !== after.scheduled_at ||
    (before.caption ?? '') !== (after.caption ?? '') ||
    before.title !== after.title ||
    before.format !== after.format;

  if (changed && after.publish?.zernio_post_id && after.publish.state !== 'publicado') {
    await cancelInZernio(ws, after);
    items[idx] = {
      ...after,
      publish: {
        ...after.publish,
        zernio_post_id: null,
        permalink: null,
        pushed_at: null,
        error: null,
        state: after.publish.auto ? 'pendiente' : 'off',
      },
    };
    await writeFor(ws, 'calendar_items', items);
    if (items[idx].publish?.auto && isWithinPushWindow(items[idx])) {
      const reprogrammed = await advanceItem(ws, id);
      if (reprogrammed) return NextResponse.json({ item: reprogrammed });
    }
    return NextResponse.json({ item: items[idx] });
  }

  await writeFor(ws, 'calendar_items', items);
  return NextResponse.json({ item: items[idx] });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const r = await requireWorkspace();
  if ('error' in r) return r.error;
  const ws = r.ws;
  const items = await readFor<CalendarItem>(ws, 'calendar_items');
  const item = items.find((i) => i.id === id);
  // Borrar la pieza tiene que borrar también lo que arrastra: el post que
  // estaba esperando en Zernio y el archivo guardado aquí. Si no, la pieza
  // desaparece del calendario y el video sale igual el martes.
  if (item) {
    await cancelInZernio(ws, item);
    if (item.media) await deleteMedia(item.media.key);
  }
  await writeFor(
    ws,
    'calendar_items',
    items.filter((i) => i.id !== id)
  );
  return NextResponse.json({ ok: true });
}
