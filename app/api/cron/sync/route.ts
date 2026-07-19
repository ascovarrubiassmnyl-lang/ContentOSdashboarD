import { NextRequest, NextResponse } from 'next/server';
import { hasZernioKey, syncFromZernio } from '@/lib/zernio';
import { purgeExpiredCalendar } from '@/lib/maintenance';

// Cron diario (7:00 a.m.): sincroniza Instagram vía Zernio y purga el
// calendario. Protegido con CRON_SECRET — el scheduler (Cloudflare Cron
// Trigger o similar) debe llamar:
//   GET /api/cron/sync  con header  authorization: Bearer <CRON_SECRET>
//   (o ?secret=<CRON_SECRET> si el scheduler no soporta headers)
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET no está configurado en el servidor' },
      { status: 503 }
    );
  }
  const provided =
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    req.nextUrl.searchParams.get('secret');
  if (provided !== secret) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const started = Date.now();
  const result: Record<string, unknown> = {};

  // 1) Sync de Instagram (solo si Zernio está configurado)
  if (hasZernioKey()) {
    try {
      result.sync = await syncFromZernio();
    } catch (err) {
      result.syncError = (err as Error).message;
    }
  } else {
    result.sync = 'omitido (sin ZERNIO_API_KEY)';
  }

  // 2) Purga de piezas vencidas del calendario
  try {
    result.calendarPurged = await purgeExpiredCalendar();
  } catch (err) {
    result.purgeError = (err as Error).message;
  }

  return NextResponse.json({
    ok: !result.syncError && !result.purgeError,
    ...result,
    tookMs: Date.now() - started,
    at: new Date().toISOString(),
  });
}

// Algunos schedulers solo hacen POST
export const POST = GET;
