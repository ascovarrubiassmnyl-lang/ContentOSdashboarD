import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireWorkspace } from '@/lib/session';
import { listNotifications, markRead } from '@/lib/notifications/store';

// El historial que ve el panel lateral. Antes de la Fase 5 ese panel mostraba
// tres avisos inventados: ahora son hechos reales de la cuenta activa.
export async function GET() {
  const r = await requireWorkspace();
  if ('error' in r) return r.error;

  const notifications = await listNotifications(r.ws);
  return NextResponse.json({
    notifications,
    unread: notifications.filter((n) => !n.read_at).length,
  });
}

const patchSchema = z.object({ ids: z.array(z.string()).optional() });

export async function PATCH(req: NextRequest) {
  const r = await requireWorkspace();
  if ('error' in r) return r.error;

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  const changed = await markRead(r.ws, parsed.success ? parsed.data.ids : undefined);
  return NextResponse.json({ ok: true, marked: changed });
}
