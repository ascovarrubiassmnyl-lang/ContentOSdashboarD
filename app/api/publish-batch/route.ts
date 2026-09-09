// Subir un video/imagen UNA vez y programarlo en VARIOS perfiles a la vez.
//
// Cada cuenta de ContentOS es un perfil de una sola red (una de Instagram, una
// Página de Facebook, una de TikTok — ver lib/accounts.ts). Publicar la misma
// pieza en varios perfiles significa crear una pieza de calendario POR CADA
// UNO, cada una con su propia copia del archivo: así cada perfil puede
// avanzar, fallar o reintentarse sin afectar a los demás.
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { accountPlatform, getAccountForUser, listAccountsForUser, readFor, writeFor } from '@/lib/accounts';
import { uid } from '@/lib/db';
import { advanceItem, emptyPublish, publishBlocker } from '@/lib/publish';
import { maxUploadBytes, mediaKind, putMedia } from '@/lib/media/store';
import { CalendarFormat, CalendarItem } from '@/types';

export const runtime = 'nodejs';

// ── Listar lo programado/publicado a través de esta pantalla, en TODAS las
// cuentas del usuario — no solo la activa, porque una pieza puede vivir en
// cualquiera de los perfiles elegidos al subirla.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const accounts = await listAccountsForUser(user.id);
  const rows: (CalendarItem & {
    account_label: string;
    account_platform: string;
    account_color: string;
  })[] = [];
  for (const ws of accounts) {
    const items = await readFor<CalendarItem>(ws, 'calendar_items');
    for (const item of items) {
      if (!item.publish && !item.media) continue;
      rows.push({
        ...item,
        account_label: ws.label,
        account_platform: accountPlatform(ws),
        account_color: ws.color,
      });
    }
  }
  rows.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  return NextResponse.json({ items: rows });
}

interface AccountResult {
  account_id: string;
  label: string;
  ok: boolean;
  error?: string;
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file');
  const caption = String(form.get('caption') ?? '').trim();
  const scheduledAtRaw = String(form.get('scheduled_at') ?? '');
  const accountIdsRaw = String(form.get('account_ids') ?? '[]');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Falta el archivo.' }, { status: 400 });
  }
  const scheduledDate = new Date(scheduledAtRaw);
  if (Number.isNaN(scheduledDate.getTime())) {
    return NextResponse.json({ error: 'Fecha u hora inválida.' }, { status: 400 });
  }
  let accountIds: unknown;
  try {
    accountIds = JSON.parse(accountIdsRaw);
  } catch {
    accountIds = null;
  }
  if (!Array.isArray(accountIds) || accountIds.length === 0) {
    return NextResponse.json({ error: 'Elige al menos un perfil.' }, { status: 400 });
  }

  const mime = file.type.split(';')[0].trim().toLowerCase();
  const kind = mediaKind(mime);
  if (!kind) {
    return NextResponse.json(
      {
        error: `Tipo de archivo no soportado (${mime || 'desconocido'}). Usa MP4/MOV/WebM para video o JPG/PNG/WebP para imagen.`,
      },
      { status: 415 }
    );
  }
  const max = maxUploadBytes();
  if (file.size > max) {
    return NextResponse.json(
      { error: `El archivo pesa más del máximo permitido (${Math.round(max / 1024 / 1024)} MB).` },
      { status: 413 }
    );
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.byteLength === 0) {
    return NextResponse.json({ error: 'El archivo llegó vacío.' }, { status: 400 });
  }

  const title = (caption || 'Publicación programada').slice(0, 160);
  // Un solo archivo de video sale como reel; una sola imagen sale como
  // publicación de feed (el mismo criterio que usa PublishBlock en Calendario).
  const format: CalendarFormat = kind === 'video' ? 'reel' : 'carrusel';

  const results: AccountResult[] = [];
  for (const accountId of accountIds) {
    if (typeof accountId !== 'string') continue;
    const ws = await getAccountForUser(accountId, user.id);
    if (!ws) {
      results.push({ account_id: accountId, label: accountId, ok: false, error: 'Cuenta no encontrada.' });
      continue;
    }

    // Se comprueba con un item "de prueba" (sin subir el archivo todavía) para
    // no dejar un binario huérfano si esta cuenta no puede publicarlo — p. ej.
    // una imagen hacia un perfil de TikTok.
    const probe: CalendarItem = {
      id: 'probe',
      account_id: ws.id,
      script_id: null,
      title,
      format,
      nivel: null,
      scheduled_at: scheduledDate.toISOString(),
      status: 'idea',
      notes: '',
      caption,
      media: {
        key: '',
        filename: file.name || 'archivo',
        mime,
        size: bytes.byteLength,
        kind,
        uploaded_at: new Date().toISOString(),
      },
      publish: null,
    };
    const blocker = publishBlocker(ws, probe);
    if (blocker) {
      results.push({ account_id: ws.id, label: ws.label, ok: false, error: blocker });
      continue;
    }

    try {
      const stored = await putMedia(bytes, { filename: file.name || 'archivo', mime });
      const item: CalendarItem = {
        ...probe,
        id: uid(),
        media: {
          key: stored.key,
          filename: stored.filename,
          mime: stored.mime,
          size: stored.size,
          kind,
          uploaded_at: stored.created_at,
        },
        publish: { ...emptyPublish(), auto: true },
      };
      const items = await readFor<CalendarItem>(ws, 'calendar_items');
      items.push(item);
      await writeFor(ws, 'calendar_items', items);
      // Si la hora ya está dentro de la ventana de subida, sale de inmediato en
      // vez de esperar al siguiente pase del cron.
      await advanceItem(ws, item.id);
      results.push({ account_id: ws.id, label: ws.label, ok: true });
    } catch (err) {
      results.push({ account_id: ws.id, label: ws.label, ok: false, error: (err as Error).message });
    }
  }

  return NextResponse.json({ results });
}
