import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { ACTIVE_COOKIE, getAccount } from '@/lib/accounts';

const schema = z.object({ id: z.string().min(1).max(120) });

// Cambia la cuenta activa. Vive en una cookie httpOnly, así que todas las
// rutas del servidor resuelven la cuenta sola: la UI no tiene que arrastrar
// el id en cada petición.
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Id inválido' }, { status: 400 });
  }
  const ws = await getAccount(parsed.data.id);
  if (!ws) {
    return NextResponse.json({ error: 'Esa cuenta no existe' }, { status: 404 });
  }
  (await cookies()).set(ACTIVE_COOKIE, ws.id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return NextResponse.json({ ok: true, account: { id: ws.id, label: ws.label } });
}
