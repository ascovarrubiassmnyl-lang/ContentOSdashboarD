import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { listAccounts } from '@/lib/accounts';
import { listInstagramAccounts, toAccountOption } from '@/lib/zernio';

const schema = z.object({ apiKey: z.string().min(10).max(400) });

// Valida una API key de Zernio y devuelve las cuentas de Instagram que tiene
// conectadas, marcando las que ya están añadidas aquí. La key NO se guarda:
// solo se usa para esta consulta; se persiste al crear la cuenta.
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'API key inválida' }, { status: 400 });
  }

  let raw;
  try {
    raw = await listInstagramAccounts(parsed.data.apiKey.trim());
  } catch (err) {
    return NextResponse.json(
      { error: `No se pudo conectar con Zernio: ${(err as Error).message}` },
      { status: 502 }
    );
  }

  const existing = new Set((await listAccounts()).map((w) => w.id));
  const options = raw.map(toAccountOption).map((o) => ({
    ...o,
    alreadyAdded: existing.has(`acc_${o.id}`),
  }));

  if (options.length === 0) {
    return NextResponse.json(
      {
        error:
          'Esa API key no tiene ninguna cuenta de Instagram conectada. Conéctala primero en el panel de Zernio.',
      },
      { status: 404 }
    );
  }
  return NextResponse.json({ options });
}
