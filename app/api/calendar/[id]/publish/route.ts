// Encender, apagar o forzar la publicación automática de una pieza.
//
//   { mode: 'auto' }  → que salga sola a su hora
//   { mode: 'now'  }  → publicar ya, sin esperar
//   { mode: 'off'  }  → volver a ser solo planificación (cancela en Zernio)
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { readFor, writeFor } from '@/lib/accounts';
import { requireWorkspace } from '@/lib/session';
import {
  advanceItem,
  cancelInZernio,
  emptyPublish,
  publishBlocker,
} from '@/lib/publish';
import { CalendarItem } from '@/types';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({ mode: z.enum(['auto', 'now', 'off']) });

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const r = await requireWorkspace();
  if ('error' in r) return r.error;
  const ws = r.ws;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Falta el modo (auto, now u off).' }, { status: 400 });
  }
  const { mode } = parsed.data;

  const items = await readFor<CalendarItem>(ws, 'calendar_items');
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return NextResponse.json({ error: 'Pieza no encontrada' }, { status: 404 });
  const item = items[idx];

  if (mode === 'off') {
    await cancelInZernio(ws, item);
    items[idx] = {
      ...item,
      publish: item.publish?.state === 'publicado'
        ? { ...item.publish, auto: false }
        : { ...emptyPublish(), auto: false, state: 'off' },
    };
    await writeFor(ws, 'calendar_items', items);
    return NextResponse.json({ item: items[idx] });
  }

  // Se comprueba ANTES de tocar nada para poder responder con el motivo
  // exacto en vez de dejar la pieza en error y que el usuario lo descubra
  // después mirando el calendario.
  const blocker = publishBlocker(ws, item);
  if (blocker) return NextResponse.json({ error: blocker }, { status: 409 });

  items[idx] = {
    ...item,
    publish: { ...emptyPublish(), ...(item.publish ?? {}), auto: true, error: null },
  };
  await writeFor(ws, 'calendar_items', items);

  // Un reintento explícito sobre algo que falló tiene que volver a empujar de
  // verdad, no limitarse a releer el estado del post que falló.
  const updated =
    (await advanceItem(ws, id, {
      now: mode === 'now',
      force: mode === 'now' || item.publish?.state === 'error',
    })) ?? items[idx];
  if (updated.publish?.state === 'error') {
    return NextResponse.json({ item: updated, error: updated.publish.error }, { status: 502 });
  }
  return NextResponse.json({ item: updated });
}
