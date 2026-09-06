import { NextRequest, NextResponse } from 'next/server';
import { listAccounts, readFor } from '@/lib/accounts';
import { PublishTickReport, runPublishTick } from '@/lib/publish';
import { deleteMedia, listMediaKeys } from '@/lib/media/store';
import { CalendarItem } from '@/types';

export const runtime = 'nodejs';

// Tick de publicación. Comparte horario con los recordatorios (cada ~15 min,
// `npm run cron:notify` en Railway) porque hace falta la misma granularidad:
// una pieza programada a las 10:15 no puede esperar al barrido diario.
//
// Cada pase hace tres cosas por cuenta:
//   · empuja a Zernio las piezas que entran en la ventana de subida
//   · refresca el estado de las que ya están programadas allí
//   · borra los binarios que ya no referencia ninguna pieza
//
//   POST /api/cron/publish  con  authorization: Bearer <CRON_SECRET>

// Margen antes de considerar huérfano un binario. Sin él, un archivo subido en
// el mismo momento en que corre el cron podría borrarse entre la subida y el
// momento en que la pieza lo referencia.
const ORPHAN_GRACE_MS = 60 * 60_000;

async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET no está configurado' }, { status: 503 });
  }
  const provided =
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    req.nextUrl.searchParams.get('secret');
  if (provided !== secret) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const started = Date.now();
  const accounts = await listAccounts();
  const results: (PublishTickReport | { account: string; error: string })[] = [];
  const referenced = new Set<string>();
  let failed = 0;

  for (const ws of accounts) {
    try {
      results.push(await runPublishTick(ws));
    } catch (err) {
      results.push({ account: ws.label, error: (err as Error).message });
      failed++;
    }
    // Se recogen las claves DESPUÉS del pase: una pieza que acaba de
    // publicarse ya soltó su archivo y no debe contarse como referencia.
    try {
      for (const item of await readFor<CalendarItem>(ws, 'calendar_items')) {
        if (item.media) referenced.add(item.media.key);
      }
    } catch {
      // Si no se puede leer una cuenta, se aborta la purga: borrar binarios
      // con una lista de referencias incompleta destruiría archivos vivos.
      failed++;
      return NextResponse.json({
        ok: false,
        results,
        purged: 0,
        note: 'Purga omitida: no se pudo leer el calendario de todas las cuentas.',
        tookMs: Date.now() - started,
        at: new Date().toISOString(),
      });
    }
  }

  const cutoff = Date.now() - ORPHAN_GRACE_MS;
  let purged = 0;
  for (const blob of await listMediaKeys()) {
    if (referenced.has(blob.key)) continue;
    if (new Date(blob.created_at).getTime() > cutoff) continue;
    await deleteMedia(blob.key);
    purged++;
  }

  return NextResponse.json({
    ok: failed === 0,
    accounts: accounts.length,
    purged,
    results,
    tookMs: Date.now() - started,
    at: new Date().toISOString(),
  });
}

export const GET = run;
export const POST = run;
