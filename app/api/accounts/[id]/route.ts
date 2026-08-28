import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { deleteAccount, getAccountForUser, setZernioKey, updateAccount } from '@/lib/accounts';
import { getSessionUser } from '@/lib/auth';
import { hasEncryptionKey } from '@/lib/crypto';

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z
  .object({
    label: z.string().min(1).max(60),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    apiKey: z.string().min(10).max(400), // rotar la key de Zernio
  })
  .partial();

// Nota: "cuenta no encontrada" y "cuenta de otro usuario" devuelven el mismo
// 404 — no confirmar la existencia de un id ajeno evita que se puedan
// enumerar cuentas de otros usuarios.
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const { apiKey, ...fields } = parsed.data;

  const owned = await getAccountForUser(id, user.id);
  if (!owned) {
    return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });
  }

  if (apiKey) {
    if (!hasEncryptionKey()) {
      return NextResponse.json(
        { error: 'Falta ENCRYPTION_KEY en el servidor para guardar la API key.' },
        { status: 503 }
      );
    }
    await setZernioKey(id, apiKey);
  }

  const updated = Object.keys(fields).length ? await updateAccount(id, fields) : owned;
  if (!updated) {
    return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });
  }
  return NextResponse.json({ account: updated });
}

// Elimina la cuenta Y todos sus datos (métricas, ideas, calendario,
// guiones y reportes). No se puede borrar la última cuenta que queda.
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const owned = await getAccountForUser(id, user.id);
  if (!owned) {
    return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });
  }

  try {
    await deleteAccount(id);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
