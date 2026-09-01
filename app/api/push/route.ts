import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser } from '@/lib/auth';
import { isPushConfigured, publicKey } from '@/lib/push/vapid';
import { listForUser, removeByEndpoint, saveSubscription } from '@/lib/push/subscriptions';

// `web-push` usa crypto de Node: esta ruta no puede correr en el Edge.
export const runtime = 'nodejs';

// Estado del push + clave pública para que el navegador se suscriba.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  return NextResponse.json({
    configured: isPushConfigured(),
    public_key: publicKey(),
    devices: (await listForUser(user.id)).map((s) => ({
      id: s.id,
      user_agent: s.user_agent,
      created_at: s.created_at,
    })),
  });
}

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!isPushConfigured()) {
    return NextResponse.json(
      {
        error:
          'Este servidor no tiene claves VAPID configuradas, así que no puede enviar notificaciones push. Genéralas con "npx web-push generate-vapid-keys" y añade VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY.',
      },
      { status: 503 }
    );
  }

  const parsed = subscribeSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Suscripción inválida' }, { status: 400 });
  }

  const saved = await saveSubscription({
    userId: user.id,
    endpoint: parsed.data.endpoint,
    keys: parsed.data.keys,
    userAgent: req.headers.get('user-agent')?.slice(0, 200) ?? 'desconocido',
  });

  return NextResponse.json({ ok: true, id: saved.id }, { status: 201 });
}

const unsubscribeSchema = z.object({ endpoint: z.string().url() });

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const parsed = unsubscribeSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Falta el endpoint' }, { status: 400 });

  await removeByEndpoint(parsed.data.endpoint);
  return NextResponse.json({ ok: true });
}
