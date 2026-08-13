import { NextRequest, NextResponse } from 'next/server';
import { hasZernioFor, listAccounts } from '@/lib/accounts';
import { syncFromZernio } from '@/lib/zernio';
import { purgeExpiredCalendar } from '@/lib/maintenance';

// Cron diario (7:00 a.m.): sincroniza Instagram vía Zernio y purga el
// calendario — de TODAS las cuentas, una por una. Protegido con CRON_SECRET;
// el scheduler (Cloudflare Cron Trigger o similar) debe llamar:
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
  const accounts = await listAccounts();
  const results: Record<string, unknown>[] = [];
  let failed = 0;

  for (const ws of accounts) {
    const entry: Record<string, unknown> = { account: ws.label };

    // 1) Sync de Instagram (solo si esa cuenta tiene Zernio configurado)
    if (await hasZernioFor(ws)) {
      try {
        entry.sync = await syncFromZernio(ws);
      } catch (err) {
        entry.syncError = (err as Error).message;
        failed++;
      }
    } else {
      entry.sync = 'omitido (sin API key de Zernio)';
    }

    // 2) Purga de piezas vencidas del calendario de esa cuenta
    try {
      entry.calendarPurged = await purgeExpiredCalendar(ws);
    } catch (err) {
      entry.purgeError = (err as Error).message;
      failed++;
    }

    results.push(entry);
  }

  return NextResponse.json({
    ok: failed === 0,
    accounts: results.length,
    results,
    tookMs: Date.now() - started,
    at: new Date().toISOString(),
  });
}

// Algunos schedulers solo hacen POST
export const POST = GET;
