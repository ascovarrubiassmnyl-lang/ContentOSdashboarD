import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { listAccountsForUser } from '@/lib/accounts';
import { getSessionUser } from '@/lib/auth';
import { listConnectedAccounts, toAccountOption } from '@/lib/zernio';

const schema = z.object({ apiKey: z.string().min(10).max(400) });

// Valida una API key de Zernio y devuelve las cuentas de Instagram y Páginas de
// Facebook que tiene conectadas, marcando las que el usuario ya tiene añadidas.
// La key NO se guarda: solo se usa para esta consulta; se persiste al crear la
// cuenta.
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'API key inválida' }, { status: 400 });
  }

  let raw;
  try {
    raw = await listConnectedAccounts(parsed.data.apiKey.trim());
  } catch (err) {
    return NextResponse.json(
      { error: `No se pudo conectar con Zernio: ${(err as Error).message}` },
      { status: 502 }
    );
  }

  const existing = new Set((await listAccountsForUser(user.id)).map((w) => w.id));
  const options = raw.map(toAccountOption).map((o) => ({
    ...o,
    alreadyAdded: existing.has(`acc_${o.id}`),
  }));

  if (options.length === 0) {
    return NextResponse.json(
      {
        error:
          'Esa API key no tiene ninguna cuenta de Instagram ni Página de Facebook conectada. ' +
          'Conéctala primero en el panel de Zernio.',
      },
      { status: 404 }
    );
  }
  return NextResponse.json({ options });
}
