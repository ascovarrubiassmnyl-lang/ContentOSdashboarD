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

// Lo único imprescindible es la key y el id de la cuenta en Zernio. El resto
// son datos cosméticos que llegan tal cual de Zernio, y ninguno debería impedir
// añadir una cuenta: se recorta o se descarta lo que venga raro.
//
// Antes se validaban a rajatabla y una Página de Facebook los rompía de tres
// formas —sin nombre de usuario, con un nombre largo, o con un avatar cuya URL
// firmada por la CDN de Meta pasa de 600 caracteres—, así que el alta moría con
// un "Datos inválidos" que no decía nada.
const text = (max: number) =>
  z
    .unknown()
    .transform((v) => (typeof v === 'string' ? v.trim().slice(0, max) : ''));

const createSchema = z.object({
  apiKey: z.string().min(10).max(400),
  zernioAccountId: z.string().min(1).max(120),
  username: text(80),
  platform: z.enum(PLATFORMS).optional().catch(undefined),
  label: text(60),
  followers: z.coerce.number().int().min(0).catch(0),
  // Solo se pinta como <img src>: se descarta lo que no sea http(s).
  avatarUrl: text(2000).transform((v) => (/^https?:\/\//.test(v) ? v : null)),
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
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    // Nombrar el campo que falla: un "Datos inválidos" a secas no se puede
    // diagnosticar desde el aviso rojo del panel.
    const campos = [...new Set(parsed.error.issues.map((i) => i.path.join('.') || 'cuerpo'))];
    return NextResponse.json(
      { error: `Datos inválidos: ${campos.join(', ')}.`, issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;
  let ws;
  try {
    ws = await createAccount({
      ...data,
      // Sin nombre, el id de Zernio la identifica: preferible a no poder añadirla.
      username: data.username || `${data.platform ?? 'cuenta'}-${data.zernioAccountId.slice(-6)}`,
      label: data.label || undefined,
      ownerUserId: user.id,
    });
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
