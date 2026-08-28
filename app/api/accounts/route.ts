import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import {
  ACTIVE_COOKIE,
  PLATFORMS,
  accountPlatform,
  activeWorkspace,
  createAccount,
  listAccountsForUser,
  zernioKeyState,
} from '@/lib/accounts';
import { getSessionUser } from '@/lib/auth';
import { hasEncryptionKey } from '@/lib/crypto';
import { syncFromZernio } from '@/lib/zernio';

// La API key JAMÁS sale de aquí: solo se informa si existe y de dónde viene.
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const accounts = await listAccountsForUser(user.id);
  if (accounts.length === 0) {
    return NextResponse.json({ accounts: [], activeId: null });
  }

  const active = await activeWorkspace(user.id);
  const rows = await Promise.all(
    accounts.map(async (ws) => ({
      id: ws.id,
      label: ws.label,
      username: ws.username,
      platform: accountPlatform(ws),
      color: ws.color,
      followers: ws.followers,
      avatar_url: ws.avatar_url,
      last_sync_at: ws.last_sync_at,
      legacy: Boolean(ws.legacy),
      keyState: await zernioKeyState(ws),
      active: ws.id === active.id,
    }))
  );
  return NextResponse.json({ accounts: rows, activeId: active.id });
}

const createSchema = z.object({
  apiKey: z.string().min(10).max(400),
  zernioAccountId: z.string().min(1).max(120),
  username: z.string().min(1).max(80),
  platform: z.enum(PLATFORMS).optional(),
  label: z.string().max(60).optional(),
  followers: z.number().int().min(0).optional(),
  // Solo se pinta como <img src>. Se descarta lo que no sea http(s) en vez de
  // rechazar la petición: un avatar raro no debería impedir añadir la cuenta.
  avatarUrl: z
    .string()
    .max(600)
    .nullable()
    .optional()
    .transform((v) => (v && /^https?:\/\//.test(v) ? v : null)),
});

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  if (!hasEncryptionKey()) {
    return NextResponse.json(
      {
        error:
          'Falta ENCRYPTION_KEY en el servidor. Genérala con "openssl rand -hex 32", añádela a las variables de entorno y reinicia.',
      },
      { status: 503 }
    );
  }
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  let ws;
  try {
    ws = await createAccount({ ...parsed.data, ownerUserId: user.id });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 409 });
  }

  // Deja la cuenta nueva como activa y trae sus datos de una vez.
  (await cookies()).set(ACTIVE_COOKIE, ws.id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });

  let syncError: string | null = null;
  try {
    await syncFromZernio(ws);
  } catch (err) {
    // La cuenta queda creada aunque el primer sync falle: se puede reintentar.
    syncError = (err as Error).message;
  }

  return NextResponse.json({ account: ws, syncError }, { status: 201 });
}
