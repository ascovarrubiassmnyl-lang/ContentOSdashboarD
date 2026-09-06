// El archivo (video o imagen) de una pieza del calendario.
//
// Va colgado de la pieza y no de una ruta /api/media/<clave> a propósito: así
// la pertenencia se comprueba sola. Si la pieza está en el workspace activo
// del usuario, el archivo es suyo; si no, no existe para él.
import { NextRequest, NextResponse } from 'next/server';
import { readFor, writeFor } from '@/lib/accounts';
import { requireWorkspace } from '@/lib/session';
import {
  deleteMedia,
  getMediaBytes,
  maxUploadBytes,
  mediaKind,
  putMedia,
} from '@/lib/media/store';
import { advanceItem, cancelInZernio, emptyPublish, isWithinPushWindow } from '@/lib/publish';
import { CalendarItem } from '@/types';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

async function loadItem(id: string) {
  const r = await requireWorkspace();
  if ('error' in r) return { error: r.error } as const;
  const items = await readFor<CalendarItem>(r.ws, 'calendar_items');
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) {
    return { error: NextResponse.json({ error: 'Pieza no encontrada' }, { status: 404 }) } as const;
  }
  return { ws: r.ws, items, idx, item: items[idx] } as const;
}

// ── Subir ───────────────────────────────────────────────────
// El archivo llega como cuerpo crudo, no como multipart: un video de 100 MB no
// gana nada pasando por un parser de formularios, y así el cliente puede
// mandar el File tal cual.
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const found = await loadItem(id);
  if ('error' in found) return found.error;
  const { ws, items, idx, item } = found;

  const mime = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  const kind = mediaKind(mime);
  if (!kind) {
    return NextResponse.json(
      { error: `Tipo de archivo no soportado (${mime || 'desconocido'}). Usa MP4/MOV para video o JPG/PNG para imagen.` },
      { status: 415 }
    );
  }

  const max = maxUploadBytes();
  const declared = Number(req.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > max) {
    return NextResponse.json(
      { error: `El archivo pesa más del máximo permitido (${Math.round(max / 1024 / 1024)} MB).` },
      { status: 413 }
    );
  }

  const bytes = Buffer.from(await req.arrayBuffer());
  if (bytes.byteLength === 0) {
    return NextResponse.json({ error: 'El archivo llegó vacío.' }, { status: 400 });
  }
  if (bytes.byteLength > max) {
    return NextResponse.json(
      { error: `El archivo pesa más del máximo permitido (${Math.round(max / 1024 / 1024)} MB).` },
      { status: 413 }
    );
  }

  const filename = req.nextUrl.searchParams.get('filename') ?? `archivo.${kind === 'video' ? 'mp4' : 'jpg'}`;
  const stored = await putMedia(bytes, { filename, mime });

  // Cambiar el archivo de una pieza ya creada en Zernio invalida ese post: se
  // cancela y se vuelve a empujar con el archivo nuevo.
  if (item.publish?.zernio_post_id && item.publish.state !== 'publicado') {
    await cancelInZernio(ws, item);
  }
  if (item.media) await deleteMedia(item.media.key);

  const wasScheduled = Boolean(item.publish?.zernio_post_id);
  items[idx] = {
    ...item,
    media: {
      key: stored.key,
      filename: stored.filename,
      mime: stored.mime,
      size: stored.size,
      kind,
      uploaded_at: stored.created_at,
    },
    publish: item.publish
      ? { ...item.publish, zernio_post_id: null, permalink: null, error: null, pushed_at: null,
          state: item.publish.auto ? 'pendiente' : 'off' }
      : item.publish ?? null,
  };
  await writeFor(ws, 'calendar_items', items);

  // Si ya estaba dentro de la ventana (o ya estaba programada), se vuelve a
  // empujar en el acto para no esperar al siguiente tick del cron.
  let final = items[idx];
  if (final.publish?.auto && (wasScheduled || isWithinPushWindow(final))) {
    final = (await advanceItem(ws, id)) ?? final;
  }
  return NextResponse.json({ item: final }, { status: 201 });
}

// ── Descargar (previsualización en el navegador) ────────────
export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const found = await loadItem(id);
  if ('error' in found) return found.error;
  const media = found.item.media;
  if (!media) return NextResponse.json({ error: 'Esta pieza no tiene archivo' }, { status: 404 });

  const bytes = await getMediaBytes(media.key);
  if (!bytes) return NextResponse.json({ error: 'El archivo ya no está' }, { status: 404 });

  const total = bytes.byteLength;
  const common = {
    'content-type': media.mime,
    'accept-ranges': 'bytes',
    // Privado y sin caché compartida: es contenido de una cuenta concreta.
    'cache-control': 'private, max-age=0, must-revalidate',
  };

  // Safari no reproduce un <video> si el servidor no responde a Range: pide el
  // primer trozo con `bytes=0-` y si recibe un 200 entero, no lo pinta.
  const range = req.headers.get('range');
  const match = range?.match(/bytes=(\d*)-(\d*)/);
  if (match) {
    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Math.min(Number(match[2]), total - 1) : total - 1;
    if (Number.isNaN(start) || start >= total || end < start) {
      return new NextResponse(null, {
        status: 416,
        headers: { ...common, 'content-range': `bytes */${total}` },
      });
    }
    const chunk = bytes.subarray(start, end + 1);
    return new NextResponse(new Uint8Array(chunk), {
      status: 206,
      headers: {
        ...common,
        'content-range': `bytes ${start}-${end}/${total}`,
        'content-length': String(chunk.byteLength),
      },
    });
  }

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: { ...common, 'content-length': String(total) },
  });
}

// ── Quitar ──────────────────────────────────────────────────
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const found = await loadItem(id);
  if ('error' in found) return found.error;
  const { ws, items, idx, item } = found;
  if (!item.media) return NextResponse.json({ item });

  if (item.publish?.state !== 'publicado') await cancelInZernio(ws, item);
  await deleteMedia(item.media.key);

  const auto = Boolean(item.publish?.auto);
  items[idx] = {
    ...item,
    media: null,
    publish: item.publish
      ? {
          ...item.publish,
          zernio_post_id: null,
          pushed_at: null,
          // Sin archivo no hay publicación posible, pero la intención del
          // usuario se respeta: sigue en automática, y en cuanto suba otro
          // archivo vuelve a programarse sola.
          state: auto ? 'pendiente' : 'off',
          error: auto ? 'Falta el archivo: sube un video o una imagen.' : null,
        }
      : emptyPublish(),
  };
  await writeFor(ws, 'calendar_items', items);
  return NextResponse.json({ item: items[idx] });
}
