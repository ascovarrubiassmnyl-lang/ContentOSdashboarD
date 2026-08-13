import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { deleteAccount, getAccount, setZernioKey, updateAccount } from '@/lib/accounts';
import { hasEncryptionKey } from '@/lib/crypto';

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z
  .object({
    label: z.string().min(1).max(60),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    apiKey: z.string().min(10).max(400), // rotar la key de Zernio
  })
  .partial();

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const { apiKey, ...fields } = parsed.data;

  if (apiKey) {
    if (!hasEncryptionKey()) {
      return NextResponse.json(
        { error: 'Falta ENCRYPTION_KEY en el servidor para guardar la API key.' },
        { status: 503 }
      );
    }
    if (!(await getAccount(id))) {
      return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });
    }
    await setZernioKey(id, apiKey);
  }

  const updated = Object.keys(fields).length ? await updateAccount(id, fields) : await getAccount(id);
  if (!updated) {
    return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });
  }
  return NextResponse.json({ account: updated });
}

// Elimina la cuenta Y todos sus datos (métricas, fuentes, ideas, calendario,
// guiones y reportes). No se puede borrar la última cuenta que queda.
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    await deleteAccount(id);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
