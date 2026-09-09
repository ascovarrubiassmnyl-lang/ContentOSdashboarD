// Quitar UNA pieza programada desde la pantalla de Publicar. Necesita
// `account_id` porque la pieza puede vivir en cualquiera de las cuentas del
// usuario, no solo en la activa (a diferencia de /api/calendar/[id]).
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getAccountForUser, readFor, writeFor } from '@/lib/accounts';
import { deleteMedia } from '@/lib/media/store';
import { cancelInZernio } from '@/lib/publish';
import { CalendarItem } from '@/types';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const accountId = req.nextUrl.searchParams.get('account_id');
  if (!accountId) return NextResponse.json({ error: 'Falta la cuenta.' }, { status: 400 });
  const ws = await getAccountForUser(accountId, user.id);
  if (!ws) return NextResponse.json({ error: 'Cuenta no encontrada.' }, { status: 404 });

  const items = await readFor<CalendarItem>(ws, 'calendar_items');
  const item = items.find((i) => i.id === id);
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
